export type MoneyValue = string | number;

export enum FailPoint {
  BEFORE_CORE_PREPARE = "BEFORE_CORE_PREPARE",
  BEFORE_LEDGER_PREPARE = "BEFORE_LEDGER_PREPARE",
  BEFORE_COMMIT = "BEFORE_COMMIT",
  AFTER_CORE_COMMIT = "AFTER_CORE_COMMIT",
  AFTER_LEDGER_COMMIT = "AFTER_LEDGER_COMMIT",
}

export enum CoordinatorPhase {
  INIT = "INIT",
  PREPARING = "PREPARING",
  PREPARED = "PREPARED",
  COMMITTING = "COMMITTING",
  COMMITTED = "COMMITTED",
  ABORTED = "ABORTED",
  IN_DOUBT = "IN_DOUBT",
}

export enum LedgerTransactionStatus {
  PENDING = "PENDING",
  COMMITTED = "COMMITTED",
  ABORTED = "ABORTED",
}

export interface TransferRequest {
  fromUserId: string;
  toUserId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: MoneyValue;
  /**
   * Request-scoped failpoint to simulate a partition event in a deterministic stage.
   */
  failPoint?: FailPoint;
}

export interface TransactionState {
  transactionId: string;
  phase: CoordinatorPhase;
  corePrepared: boolean;
  ledgerPrepared: boolean;
  coreCommitted: boolean;
  ledgerCommitted: boolean;
  rolledBack: boolean;
  failPointTriggered?: FailPoint;
  errorMessage?: string;
}

export interface TransferResult {
  success: boolean;
  transactionId: string;
  state: TransactionState;
}

export interface TransactionStatusResult {
  found: boolean;
  transactionId: string;
  phase?: CoordinatorPhase;
  ledgerStatus?: string;
  state?: TransactionState;
}

export interface RecoveryResult {
  success: boolean;
  transactionId: string;
  previousLedgerStatus?: string;
  currentLedgerStatus?: string;
  message: string;
}

export interface HealthCheckResult {
  ok: boolean;
  coreDb: "up" | "down";
  ledgerDb: "up" | "down";
}
