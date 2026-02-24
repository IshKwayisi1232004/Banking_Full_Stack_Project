import { Router, type Request } from "express";
import { randomUUID } from "node:crypto";
import { corePool, ledgerPool } from "../../db";
import { requireAuth } from "../auth/auth.middleware";
import type { AuthTokenPayload } from "../auth/auth.service";
import { TransactionCoordinator } from "../transactions/TransactionCoordinator";

type AuthenticatedRequest = Request & { auth?: AuthTokenPayload };

interface OverviewUserRow {
  id: string;
  username: string;
}

interface OverviewAccountRow {
  acc_id: string;
  user_id: string;
  balance: string;
}

interface AccountOwnerRow {
  acc_id: string;
  user_id: string;
  balance: string;
}

interface LedgerTxRow {
  id: string;
  source_id: string;
  target_id: string;
  amount: string;
  status: string;
  created_at: string;
}

type LedgerSchema =
  | {
      mode: "user";
      idColumn: "id" | "trx_id";
      fromColumn: "from_usr_id";
      toColumn: "to_usr_id";
    }
  | {
      mode: "account";
      idColumn: "id" | "trx_id";
      fromColumn: "from_acc";
      toColumn: "to_acc";
    };

type BalanceAdjustBody = {
  delta?: number | string;
};

type CreateAccountBody = {
  initialBalance?: number | string;
};

type TransferBody = {
  toAccountId?: string;
  amount?: number | string;
};

interface TransferTargetRow {
  acc_id: string;
  user_id: string;
}

const transactionCoordinator = new TransactionCoordinator();

function parseLimit(rawLimit: unknown): number {
  const parsed = Number(rawLimit);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 5;
  }
  return Math.min(Math.floor(parsed), 50);
}

function parseDelta(rawDelta: unknown): number {
  const parsed = Number(rawDelta);
  if (!Number.isFinite(parsed) || parsed === 0) {
    throw new Error("delta must be a non-zero number.");
  }
  return parsed;
}

function parsePositiveAmount(rawAmount: unknown): number {
  const parsed = Number(rawAmount);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("amount must be a positive number.");
  }
  return parsed;
}

async function detectLedgerSchema(): Promise<LedgerSchema> {
  const result = await ledgerPool.query<{ column_name: string }>(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'transactions'
    `,
  );

  const columns = new Set(result.rows.map((row) => row.column_name));
  const idColumn: "id" | "trx_id" = columns.has("id") ? "id" : "trx_id";

  if (columns.has("from_usr_id") && columns.has("to_usr_id")) {
    return {
      mode: "user",
      idColumn,
      fromColumn: "from_usr_id",
      toColumn: "to_usr_id",
    };
  }

  if (columns.has("from_acc") && columns.has("to_acc")) {
    return {
      mode: "account",
      idColumn,
      fromColumn: "from_acc",
      toColumn: "to_acc",
    };
  }

  throw new Error(
    "Unsupported ledger transactions schema: expected user-id or account-id columns.",
  );
}

function formatSignedAmount(row: LedgerTxRow, basisId: string): string {
  const amount = Number(row.amount);
  if (!Number.isFinite(amount)) {
    return "0.00";
  }

  if (row.source_id === basisId && row.target_id === basisId) {
    return amount.toFixed(2);
  }

  if (row.source_id === basisId) {
    return (-Math.abs(amount)).toFixed(2);
  }

  if (row.target_id === basisId) {
    return Math.abs(amount).toFixed(2);
  }

  return amount.toFixed(2);
}

function getDescription(row: LedgerTxRow, basisId: string): string {
  if (row.source_id === basisId && row.target_id === basisId) {
    return "Balance adjustment";
  }
  if (row.source_id === basisId) {
    return "Outgoing transfer";
  }
  if (row.target_id === basisId) {
    return "Incoming transfer";
  }
  return "Transaction";
}

const router = Router();

router.post("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = req.auth?.sub;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized." });
    return;
  }

  const body = (req.body ?? {}) as CreateAccountBody;
  const parsedInitialBalance =
    body.initialBalance === undefined ? 0 : Number(body.initialBalance);
  const initialBalance = Number.isFinite(parsedInitialBalance)
    ? parsedInitialBalance
    : NaN;

  if (!Number.isFinite(initialBalance)) {
    res.status(400).json({ message: "initialBalance must be a number." });
    return;
  }

  try {
    const result = await corePool.query<OverviewAccountRow>(
      `
      INSERT INTO accounts (user_id, balance)
      VALUES ($1::uuid, $2::numeric)
      RETURNING
        acc_id,
        user_id,
        balance::text AS balance
      `,
      [userId, initialBalance],
    );

    const account = result.rows[0];
    if (!account) {
      res.status(500).json({ message: "Failed to create account." });
      return;
    }

    res.status(201).json({ account });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error.";
    res.status(500).json({ message });
  }
});

router.get("/overview", requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = req.auth?.sub;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized." });
    return;
  }

  try {
    const [userResult, accountsResult] = await Promise.all([
      corePool.query<OverviewUserRow>(
        `
        SELECT id, username
        FROM users
        WHERE id = $1::uuid
        LIMIT 1
        `,
        [userId],
      ),
      corePool.query<OverviewAccountRow>(
        `
        SELECT
          acc_id,
          user_id,
          balance::text AS balance
        FROM accounts
        WHERE user_id = $1::uuid
        ORDER BY created_at DESC
        `,
        [userId],
      ),
    ]);

    const user = userResult.rows[0];
    if (!user) {
      res.status(404).json({ message: "User not found." });
      return;
    }

    res.status(200).json({
      user,
      accounts: accountsResult.rows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error.";
    res.status(500).json({ message });
  }
});

router.get(
  "/:accId/transactions",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    const userId = req.auth?.sub;
    const { accId } = req.params;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized." });
      return;
    }
    if (!accId) {
      res.status(400).json({ message: "Missing account id." });
      return;
    }

    try {
      const ownerResult = await corePool.query<AccountOwnerRow>(
        `
        SELECT
          acc_id,
          user_id,
          balance::text AS balance
        FROM accounts
        WHERE acc_id = $1::uuid
          AND user_id = $2::uuid
        LIMIT 1
        `,
        [accId, userId],
      );

      const account = ownerResult.rows[0];
      if (!account) {
        res.status(404).json({ message: "Account not found." });
        return;
      }

      const schema = await detectLedgerSchema();
      const limit = parseLimit(req.query.limit);
      const txResult = await ledgerPool.query<LedgerTxRow>(
        `
        SELECT
          ${schema.idColumn}::text AS id,
          ${schema.fromColumn}::text AS source_id,
          ${schema.toColumn}::text AS target_id,
          amount::text AS amount,
          status,
          created_at::text AS created_at
        FROM transactions
        WHERE ${schema.fromColumn} = $1::uuid
           OR ${schema.toColumn} = $1::uuid
        ORDER BY created_at DESC
        LIMIT $2
        `,
        [schema.mode === "account" ? accId : userId, limit],
      );

      const basisId = schema.mode === "account" ? accId : userId;
      const transactions = txResult.rows.map((row) => ({
        id: row.id,
        date: row.created_at,
        description: getDescription(row, basisId),
        amount: formatSignedAmount(row, basisId),
        status: row.status,
      }));

      res.status(200).json({
        account,
        transactions,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Server error.";
      res.status(500).json({ message });
    }
  },
);

router.post(
  "/:accId/transfer",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    const userId = req.auth?.sub;
    const { accId } = req.params;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized." });
      return;
    }
    if (!accId) {
      res.status(400).json({ message: "Missing source account id." });
      return;
    }

    const body = (req.body ?? {}) as TransferBody;
    const toAccountId = String(body.toAccountId ?? "");
    if (!toAccountId) {
      res.status(400).json({ message: "toAccountId is required." });
      return;
    }

    let amount: number;
    try {
      amount = parsePositiveAmount(body.amount);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid amount.";
      res.status(400).json({ message });
      return;
    }

    try {
      const sourceResult = await corePool.query<TransferTargetRow>(
        `
        SELECT acc_id, user_id
        FROM accounts
        WHERE acc_id = $1::uuid
          AND user_id = $2::uuid
        LIMIT 1
        `,
        [accId, userId],
      );

      const sourceAccount = sourceResult.rows[0];
      if (!sourceAccount) {
        res.status(404).json({ message: "Source account not found." });
        return;
      }

      const targetResult = await corePool.query<TransferTargetRow>(
        `
        SELECT acc_id, user_id
        FROM accounts
        WHERE acc_id = $1::uuid
        LIMIT 1
        `,
        [toAccountId],
      );

      const targetAccount = targetResult.rows[0];
      if (!targetAccount) {
        res.status(404).json({ message: "Destination account not found." });
        return;
      }

      const result = await transactionCoordinator.executeTransfer({
        fromUserId: sourceAccount.user_id,
        toUserId: targetAccount.user_id,
        fromAccountId: sourceAccount.acc_id,
        toAccountId: targetAccount.acc_id,
        amount,
      });

      res.status(result.success ? 200 : 409).json(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected transfer error.";
      res.status(500).json({ message });
    }
  },
);

router.post(
  "/:accId/adjust-balance",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    const userId = req.auth?.sub;
    const { accId } = req.params;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized." });
      return;
    }
    if (!accId) {
      res.status(400).json({ message: "Missing account id." });
      return;
    }

    const body = (req.body ?? {}) as BalanceAdjustBody;
    let delta: number;
    try {
      delta = parseDelta(body.delta);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid delta.";
      res.status(400).json({ message });
      return;
    }

    const coreClient = await corePool.connect();
    const ledgerClient = await ledgerPool.connect();

    try {
      await coreClient.query("BEGIN");
      await ledgerClient.query("BEGIN");

      const updated = await coreClient.query<AccountOwnerRow>(
        `
        UPDATE accounts
        SET balance = balance + $1::numeric,
            updated_at = NOW()
        WHERE acc_id = $2::uuid
          AND user_id = $3::uuid
        RETURNING
          acc_id,
          user_id,
          balance::text AS balance
        `,
        [delta, accId, userId],
      );

      const account = updated.rows[0];
      if (!account) {
        await coreClient.query("ROLLBACK");
        await ledgerClient.query("ROLLBACK");
        res.status(404).json({ message: "Account not found." });
        return;
      }

      const schema = await detectLedgerSchema();

      if (schema.mode === "user") {
        await ledgerClient.query(
          `
          INSERT INTO transactions (${schema.idColumn}, from_usr_id, to_usr_id, amount, status)
          VALUES ($1::uuid, $2::uuid, $2::uuid, $3::numeric, 'committed')
          `,
          [randomUUID(), userId, delta],
        );
      } else {
        await ledgerClient.query(
          `
          INSERT INTO transactions (${schema.idColumn}, from_acc, to_acc, amount, status)
          VALUES ($1::uuid, $2::uuid, $2::uuid, $3::numeric, 'committed')
          `,
          [randomUUID(), accId, delta],
        );
      }

      await coreClient.query("COMMIT");
      await ledgerClient.query("COMMIT");

      res.status(200).json({
        account,
      });
    } catch (error) {
      await coreClient.query("ROLLBACK").catch(() => undefined);
      await ledgerClient.query("ROLLBACK").catch(() => undefined);
      const message = error instanceof Error ? error.message : "Server error.";
      res.status(500).json({ message });
    } finally {
      coreClient.release();
      ledgerClient.release();
    }
  },
);

export default router;
