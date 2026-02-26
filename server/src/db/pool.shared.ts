import { Pool } from "pg";
import type { PoolClient } from "pg";

const SSL_DISABLED_VALUES = new Set(["1", "true", "yes"]);
const LOG_THROTTLE_MS = 30_000;
const lastPoolErrorLogAt = new Map<string, number>();

export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function buildPool(connectionString: string): Pool {
  const disableSsl = SSL_DISABLED_VALUES.has(
    String(process.env.PG_DISABLE_SSL ?? "").toLowerCase(),
  );

  const pool = new Pool({
    connectionString,
    // Supabase Postgres commonly requires TLS in production.
    ssl: disableSsl ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    keepAlive: true,
    max: 10,
  });

  pool.on("error", (error: Error) => {
    const key = error.message || "unknown";
    const now = Date.now();
    const lastLoggedAt = lastPoolErrorLogAt.get(key) ?? 0;
    if (now - lastLoggedAt < LOG_THROTTLE_MS) {
      return;
    }
    lastPoolErrorLogAt.set(key, now);
    console.error("[db-pool] Unexpected idle client error:", error.message);
  });

  return pool;
}

export async function withClient<T>(
  pool: Pool,
  action: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    return await action(client);
  } finally {
    client.release();
  }
}
