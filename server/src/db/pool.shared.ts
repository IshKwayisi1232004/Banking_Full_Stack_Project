import { Pool, PoolClient } from "pg";

const SSL_DISABLED_VALUES = new Set(["1", "true", "yes"]);

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

  return new Pool({
    connectionString,
    // Supabase Postgres commonly requires TLS in production.
    ssl: disableSsl ? false : { rejectUnauthorized: false },
  });
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
