import { Pool, type QueryResult, type QueryResultRow } from "pg";

declare global {
  var modudadamPostgresPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL이 설정되지 않았습니다.");
  const hostname = new URL(connectionString).hostname;
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";

  return new Pool({
    connectionString,
    application_name: process.env.APP_NAME ?? "modudadam-backend",
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    max: 5,
    ssl: !isLocal && process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  });
}

export const db = globalThis.modudadamPostgresPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalThis.modudadamPostgresPool = db;

export function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return db.query<T>(text, params);
}
