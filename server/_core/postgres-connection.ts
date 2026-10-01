import type { PoolConfig } from "pg";

export function postgresConnectionOptions(connectionString: string): PoolConfig {
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("DATABASE_URL must use PostgreSQL");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const ca = process.env.DATABASE_SSL_CA?.trim();
  return {
    connectionString,
    connectionTimeoutMillis: 15_000,
    ssl: ca ? { ca, rejectUnauthorized: true } : local ? undefined : { rejectUnauthorized: false },
  };
}
