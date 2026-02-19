import { randomUUID } from "crypto";
import type { PoolClient } from "pg";
import { corePool, ledgerPool } from "../../db";
import { CoreRepository } from "./CoreRepository";
import {
  FailpointManager,
  PartitionSimulationError,
  failpointManager,
} from "./FailpointManager";
import { LedgerRepository } from "./LedgerRepository";
import {
  CoordinatorPhase,
  FailPoint,
  HealthCheckResult,
  LedgerTransactionStatus,
  RecoveryResult,
  TransactionState,
  TransactionStatusResult,
  TransferRequest,
  TransferResult,
} from "./transaction.types";

export class TransactionCoordinator {
  private static readonly MAX_IN_MEMORY_TRANSACTIONS = 2000;
  private readonly stateStore = new Map<string, TransactionState>();
  private readonly recoveryRequestStore = new Map<string, TransferRequest>();

  constructor(
    private readonly coreRepository: CoreRepository = new CoreRepository(),
    private readonly ledgerRepository: LedgerRepository = new LedgerRepository(),
    private readonly failpoints: FailpointManager = failpointManager,
  ) {}

  async executeTransfer(request: TransferRequest): Promise<TransferResult> {
    this.validateRequest(request);

    const transactionId = randomUUID();
    const state: TransactionState = {
      transactionId,
      phase: CoordinatorPhase.INIT,
      corePrepared: false,
      ledgerPrepared: false,
      coreCommitted: false,
      ledgerCommitted: false,
      rolledBack: false,
    };
    this.setState(state);
    this.setRecoveryRequest(transactionId, request);

    let coreClient: PoolClient | null = null;
    let ledgerClient: PoolClient | null = null;
    let coreTransactionStarted = false;
    let ledgerTransactionStarted = false;

    try {
      coreClient = await corePool.connect();
      ledgerClient = await ledgerPool.connect();

      await coreClient.query("BEGIN");
      coreTransactionStarted = true;
      await ledgerClient.query("BEGIN");
      ledgerTransactionStarted = true;
      state.phase = CoordinatorPhase.PREPARING;
      this.setState(state);

      this.failpoints.assertNoFailure(
        FailPoint.BEFORE_CORE_PREPARE,
        request.failPoint,
      );
      await this.coreRepository.prepareTransfer(coreClient, request);
      state.corePrepared = true;
      this.setState(state);

      this.failpoints.assertNoFailure(
        FailPoint.BEFORE_LEDGER_PREPARE,
        request.failPoint,
      );
      await this.ledgerRepository.insertPendingTransfer(
        ledgerClient,
        transactionId,
        request,
      );
      state.ledgerPrepared = true;
      state.phase = CoordinatorPhase.PREPARED;
      this.setState(state);

      /**
       * Why: this failpoint simulates a partition after both participants prepared,
       * which is the critical CAP demonstration point for 2PC coordination.
       */
      this.failpoints.assertNoFailure(FailPoint.BEFORE_COMMIT, request.failPoint);

      state.phase = CoordinatorPhase.COMMITTING;
      this.setState(state);

      await coreClient.query("COMMIT");
      state.coreCommitted = true;
      this.setState(state);
      this.failpoints.assertNoFailure(FailPoint.AFTER_CORE_COMMIT, request.failPoint);

      await this.ledgerRepository.markCommitted(ledgerClient, transactionId);
      await ledgerClient.query("COMMIT");
      state.ledgerCommitted = true;
      this.setState(state);
      this.failpoints.assertNoFailure(
        FailPoint.AFTER_LEDGER_COMMIT,
        request.failPoint,
      );

      state.phase = CoordinatorPhase.COMMITTED;
      this.setState(state);

      return {
        success: true,
        transactionId,
        state,
      };
    } catch (error) {
      state.errorMessage =
        error instanceof Error ? error.message : "Unknown transfer error";

      if (error instanceof PartitionSimulationError) {
        state.failPointTriggered = error.stage;
      }

      const bothCommitted = state.coreCommitted && state.ledgerCommitted;
      const hasPartialCommit = state.coreCommitted || state.ledgerCommitted;

      if (coreClient && coreTransactionStarted && !state.coreCommitted) {
        await this.rollbackSafely(coreClient, "core", state);
      }

      if (ledgerClient && ledgerTransactionStarted && !state.ledgerCommitted) {
        await this.rollbackSafely(ledgerClient, "ledger", state);
      }

      if (bothCommitted) {
        state.phase = CoordinatorPhase.COMMITTED;
      } else if (hasPartialCommit) {
        state.phase = CoordinatorPhase.IN_DOUBT;
      } else {
        state.phase = CoordinatorPhase.ABORTED;
        state.rolledBack = true;
        await this.recordAbortedSafely(transactionId, request, state);
      }
      this.setState(state);

      return {
        success: state.phase === CoordinatorPhase.COMMITTED,
        transactionId,
        state,
      };
    } finally {
      coreClient?.release();
      ledgerClient?.release();

      if (state.phase !== CoordinatorPhase.IN_DOUBT) {
        this.clearRecoveryRequest(transactionId);
      }
    }
  }

  async getTransactionStatus(
    transactionId: string,
  ): Promise<TransactionStatusResult> {
    const state = this.stateStore.get(transactionId);
    const ledgerStatus = this.normalizeLedgerStatus(
      await this.ledgerRepository.getTransactionStatusById(transactionId),
    );

    if (!state && !ledgerStatus) {
      return {
        found: false,
        transactionId,
      };
    }

    return {
      found: true,
      transactionId,
      phase: state?.phase ?? this.phaseFromLedgerStatus(ledgerStatus),
      ledgerStatus: ledgerStatus ?? undefined,
      state,
    };
  }

  async recoverTransaction(transactionId: string): Promise<RecoveryResult> {
    const previousLedgerStatus = this.normalizeLedgerStatus(
      await this.ledgerRepository.getTransactionStatusById(transactionId),
    );
    const currentState = this.stateStore.get(transactionId);
    const recoveryRequest = this.recoveryRequestStore.get(transactionId);

    if (!previousLedgerStatus) {
      const canRebuildMissingLedgerRecord =
        currentState?.phase === CoordinatorPhase.IN_DOUBT &&
        currentState.coreCommitted &&
        !currentState.ledgerCommitted &&
        !!recoveryRequest;

      if (canRebuildMissingLedgerRecord && recoveryRequest) {
        await this.ledgerRepository.upsertCommittedTransferWithEntries(
          transactionId,
          recoveryRequest,
        );

        const currentLedgerStatus = this.normalizeLedgerStatus(
          await this.ledgerRepository.getTransactionStatusById(transactionId),
        );

        if (currentLedgerStatus !== LedgerTransactionStatus.COMMITTED) {
          return {
            success: false,
            transactionId,
            currentLedgerStatus: currentLedgerStatus ?? undefined,
            message: "Could not reconstruct missing ledger transaction.",
          };
        }

        currentState.ledgerCommitted = true;
        currentState.phase = CoordinatorPhase.COMMITTED;
        this.setState(currentState);
        this.clearRecoveryRequest(transactionId);

        return {
          success: true,
          transactionId,
          currentLedgerStatus,
          message: "Recovery reconstructed and committed missing ledger transaction.",
        };
      }

      return {
        success: false,
        transactionId,
        message: "Transaction not found in ledger.",
      };
    }

    if (previousLedgerStatus === LedgerTransactionStatus.COMMITTED) {
      return {
        success: true,
        transactionId,
        previousLedgerStatus,
        currentLedgerStatus: previousLedgerStatus,
        message: "Transaction is already committed.",
      };
    }

    if (previousLedgerStatus !== LedgerTransactionStatus.PENDING) {
      return {
        success: false,
        transactionId,
        previousLedgerStatus,
        currentLedgerStatus: previousLedgerStatus,
        message: `Recovery only supports ${LedgerTransactionStatus.PENDING} transactions.`,
      };
    }

    const updated = await this.ledgerRepository.markCommittedById(transactionId);
    const currentLedgerStatus = this.normalizeLedgerStatus(
      await this.ledgerRepository.getTransactionStatusById(transactionId),
    );

    if (!updated || currentLedgerStatus !== LedgerTransactionStatus.COMMITTED) {
      return {
        success: false,
        transactionId,
        previousLedgerStatus,
        currentLedgerStatus: currentLedgerStatus ?? undefined,
        message: "Could not finalize transaction from PENDING to COMMITTED.",
      };
    }

    if (currentState) {
      currentState.ledgerCommitted = true;
      if (currentState.coreCommitted) {
        currentState.phase = CoordinatorPhase.COMMITTED;
      }
      this.setState(currentState);
    }
    this.clearRecoveryRequest(transactionId);

    return {
      success: true,
      transactionId,
      previousLedgerStatus,
      currentLedgerStatus,
      message: "Recovery committed the pending ledger transaction.",
    };
  }

  async healthCheck(): Promise<HealthCheckResult> {
    let coreDb: "up" | "down" = "up";
    let ledgerDb: "up" | "down" = "up";

    try {
      await corePool.query("SELECT 1");
    } catch {
      coreDb = "down";
    }

    try {
      await ledgerPool.query("SELECT 1");
    } catch {
      ledgerDb = "down";
    }

    return {
      ok: coreDb === "up" && ledgerDb === "up",
      coreDb,
      ledgerDb,
    };
  }

  private validateRequest(request: TransferRequest): void {
    const amount = Number(request.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Transfer amount must be a positive number.");
    }

    if (
      !request.fromUserId ||
      !request.toUserId ||
      !request.fromAccountId ||
      !request.toAccountId
    ) {
      throw new Error("Transfer request is missing required identifiers.");
    }
  }

  private async rollbackSafely(
    client: PoolClient,
    participant: "core" | "ledger",
    state: TransactionState,
  ): Promise<void> {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      const rollbackMessage =
        rollbackError instanceof Error
          ? rollbackError.message
          : "unknown rollback error";
      state.errorMessage = `${state.errorMessage}; ${participant} rollback failed: ${rollbackMessage}`;
    }
  }

  private async recordAbortedSafely(
    transactionId: string,
    request: TransferRequest,
    state: TransactionState,
  ): Promise<void> {
    try {
      await this.ledgerRepository.recordAbortedTransfer(transactionId, request);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "unknown ledger abort error";
      state.errorMessage = `${state.errorMessage}; failed to persist ABORTED status: ${message}`;
    }
  }

  private setState(state: TransactionState): void {
    this.stateStore.set(state.transactionId, { ...state });
    this.evictOldestIfNeeded(this.stateStore);
  }

  private setRecoveryRequest(
    transactionId: string,
    request: TransferRequest,
  ): void {
    this.recoveryRequestStore.set(transactionId, { ...request });
    this.evictOldestIfNeeded(this.recoveryRequestStore);
  }

  private clearRecoveryRequest(transactionId: string): void {
    this.recoveryRequestStore.delete(transactionId);
  }

  private normalizeLedgerStatus(status: string | null): string | null {
    return status ? status.toUpperCase() : null;
  }

  private evictOldestIfNeeded(store: Map<string, unknown>): void {
    while (store.size > TransactionCoordinator.MAX_IN_MEMORY_TRANSACTIONS) {
      const oldestKey = store.keys().next().value;
      if (!oldestKey) {
        return;
      }
      store.delete(oldestKey);
    }
  }

  private phaseFromLedgerStatus(status: string | null): CoordinatorPhase | undefined {
    if (!status) {
      return undefined;
    }

    switch (status.toUpperCase()) {
      case LedgerTransactionStatus.PENDING:
        return CoordinatorPhase.PREPARED;
      case LedgerTransactionStatus.COMMITTED:
        return CoordinatorPhase.COMMITTED;
      case LedgerTransactionStatus.ABORTED:
        return CoordinatorPhase.ABORTED;
      default:
        return undefined;
    }
  }
}
