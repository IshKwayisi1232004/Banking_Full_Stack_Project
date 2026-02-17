import { PoolClient } from "pg";
import { TransferRequest } from "./transaction.types";

interface BalanceRow {
  acc_id: string;
  amount: string;
}

export class CoreRepository {
  async prepareTransfer(
    client: PoolClient,
    request: TransferRequest,
  ): Promise<void> {
    if (request.fromAccountId === request.toAccountId) {
      throw new Error("Source and destination accounts must be different.");
    }

    const lockOrder = [request.fromAccountId, request.toAccountId].sort();

    /**
     * Why: `FOR UPDATE` places row-level write locks so concurrent transfers cannot
     * read stale balances or race-update the same accounts.
     * The deterministic sort reduces deadlock risk when two transfers touch the same pair.
     */
    const lockedRows = await client.query<BalanceRow>(
      `
      SELECT acc_id, amount::text AS amount
      FROM balances
      WHERE acc_id = ANY($1::uuid[])
      ORDER BY acc_id
      FOR UPDATE
      `,
      [lockOrder],
    );

    if (lockedRows.rowCount !== 2) {
      throw new Error("One or both accounts were not found in core balances.");
    }

    const debitResult = await client.query<BalanceRow>(
      `
      UPDATE balances
      SET amount = amount - $1::numeric, updated_at = NOW()
      WHERE acc_id = $2::uuid
        AND amount >= $1::numeric
      RETURNING acc_id, amount::text AS amount
      `,
      [request.amount, request.fromAccountId],
    );

    if (debitResult.rowCount !== 1) {
      throw new Error("Insufficient funds or source account not found.");
    }

    const creditResult = await client.query<BalanceRow>(
      `
      UPDATE balances
      SET amount = amount + $1::numeric, updated_at = NOW()
      WHERE acc_id = $2::uuid
      RETURNING acc_id, amount::text AS amount
      `,
      [request.amount, request.toAccountId],
    );

    if (creditResult.rowCount !== 1) {
      throw new Error("Destination account not found.");
    }
  }
}
