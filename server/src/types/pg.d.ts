declare module "pg" {
  export interface QueryResult<R = unknown> {
    command: string;
    rowCount: number;
    rows: R[];
  }

  export interface PoolConfig {
    connectionString?: string;
    ssl?: boolean | { rejectUnauthorized?: boolean };
  }

  export class PoolClient {
    query<R = unknown>(
      text: string,
      values?: unknown[],
    ): Promise<QueryResult<R>>;
    release(): void;
  }

  export class Pool {
    constructor(config?: PoolConfig);
    connect(): Promise<PoolClient>;
    query<R = unknown>(
      text: string,
      values?: unknown[],
    ): Promise<QueryResult<R>>;
  }
}
