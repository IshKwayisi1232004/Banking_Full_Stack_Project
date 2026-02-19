import { buildPool, getRequiredEnv } from "./pool.shared";

/**
 * Singleton core DB pool (users/accounts/balances).
 * Reads CORE_DB_URL from .env (Sameer's Supabase URL on port 5432).
 */
export const corePool = buildPool(getRequiredEnv("CORE_DB_URL"));
