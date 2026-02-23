import { Pool } from "pg";
import type { PoolClient } from "pg";
import { ledgerPool } from "../../db";
import {
  LedgerTransactionStatus,
  TransferRequest,
} from "./transaction.types";

interface TransactionRow {
  trx_id: string;
  from_acc: string;
  to_acc: string;
  amount: string;
  status: string;
  created_at: string;
}

export class LedgerRepository {
  constructor(private readonly pool: Pool = ledgerPool) {}

  async insertPendingTransfer(
    client: PoolClient,
    transactionId: string,
    request: TransferRequest,
  ): Promise<void> {
    /**
     * Why: a `PENDING` row records that prepare-phase succeeded on ledger
     * before we decide whether global commit is allowed.
     */
    await client.query(
      `
      INSERT INTO transactions (trx_id, from_acc, to_acc, amount, status)
      VALUES ($1::uuid, $2::uuid, $3::uuid, $4::numeric, $5)
      `,
      [
        transactionId,
        request.fromAccountId,
        request.toAccountId,
        request.amount,
        LedgerTransactionStatus.PENDING,
      ],
    );

    await client.query(
      `
      INSERT INTO entries (trx_id, acc_id, amount)
      VALUES
        ($1::uuid, $2::uuid, ($3::numeric * -1)),
        ($1::uuid, $4::uuid, $3::numeric)
      `,
      [
        transactionId,
        request.fromAccountId,
        request.amount,
        request.toAccountId,
      ],
    );
  }

  async markCommitted(client: PoolClient, transactionId: string): Promise<void> {
    await client.query(
      `
      UPDATE transactions
      SET status = $2
      WHERE trx_id = $1::uuid
      `,
      [transactionId, LedgerTransactionStatus.COMMITTED],
    );
  }

  async markCommittedById(transactionId: string): Promise<boolean> {
    const result = await this.pool.query(
      `
      UPDATE transactions
      SET status = $2
      WHERE trx_id = $1::uuid
        AND UPPER(status) = $3
      `,
      [
        transactionId,
        LedgerTransactionStatus.COMMITTED,
        LedgerTransactionStatus.PENDING,
      ],
    );

    return result.rowCount === 1;
  }

  async upsertCommittedTransferWithEntries(
    transactionId: string,
    request: TransferRequest,
  ): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(
        `
        INSERT INTO transactions (trx_id, from_acc, to_acc, amount, status)
        VALUES ($1::uuid, $2::uuid, $3::uuid, $4::numeric, $5)
        ON CONFLICT (trx_id)
        DO UPDATE SET status = EXCLUDED.status
        `,
        [
          transactionId,
          request.fromAccountId,
          request.toAccountId,
          request.amount,
          LedgerTransactionStatus.COMMITTED,
        ],
      );

      await client.query(
        `
        DELETE FROM entries
        WHERE trx_id = $1::uuid
        `,
        [transactionId],
      );

      await client.query(
        `
        INSERT INTO entries (trx_id, acc_id, amount)
        VALUES
          ($1::uuid, $2::uuid, ($3::numeric * -1)),
          ($1::uuid, $4::uuid, $3::numeric)
        `,
        [
          transactionId,
          request.fromAccountId,
          request.amount,
          request.toAccountId,
        ],
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async recordAbortedTransfer(
    transactionId: string,
    request: TransferRequest,
  ): Promise<void> {
    /**
     * when both DB transactions roll back, the original PENDING insert may not exist.
     *
     */
    await this.pool.query(
      `
      INSERT INTO transactions (trx_id, from_acc, to_acc, amount, status)
      VALUES ($1::uuid, $2::uuid, $3::uuid, $4::numeric, $5)
      ON CONFLICT (trx_id)
      DO UPDATE SET status = EXCLUDED.status
      `,
      [
        transactionId,
        request.fromAccountId,
        request.toAccountId,
        request.amount,
        LedgerTransactionStatus.ABORTED,
      ],
    );
  }

  async getTransactionById(transactionId: string): Promise<TransactionRow | null> {
    const result = await this.pool.query<TransactionRow>(
      `
      SELECT
        trx_id,
        from_acc,
        to_acc,
        amount::text AS amount,
        status,
        created_at::text AS created_at
      FROM transactions
      WHERE trx_id = $1::uuid
      `,
      [transactionId],
    );

    return result.rows[0] ?? null;
  }

  async getTransactionStatusById(transactionId: string): Promise<string | null> {
    const row = await this.getTransactionById(transactionId);
    return row?.status ? row.status.toUpperCase() : null;
  }
}
