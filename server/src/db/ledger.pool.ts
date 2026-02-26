import { buildPool, getRequiredEnv } from "./pool.shared";

/**
 * Singleton ledger DB pool (transactions/entries).
 * Reads LEDGER_DB_URL from .env (Sameer's Supabase URL on port 5432).
 */
export const ledgerPool = buildPool(getRequiredEnv("LEDGER_DB_URL"));
