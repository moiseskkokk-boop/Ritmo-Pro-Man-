import type { PoolOptions } from "mysql2";

/** Converts MySQL URL SSL parameters into supported mysql2 connection options. */
export function mysqlConnectionOptions(connectionString: string): PoolOptions {
  const url = new URL(connectionString);
  if (url.protocol !== "mysql:") throw new Error("DATABASE_URL must use the mysql: scheme");

  const localHost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname.toLowerCase());
  const sslMode = (url.searchParams.get("ssl-mode") ?? (localHost ? "DISABLED" : "REQUIRED")).toUpperCase();
  url.searchParams.delete("ssl-mode");

  const ca = process.env.DATABASE_SSL_CA?.trim();
  let ssl: PoolOptions["ssl"];
  if (sslMode === "DISABLED") {
    if (ca) throw new Error("DATABASE_SSL_CA cannot be used with ssl-mode=DISABLED");
  } else if (sslMode === "REQUIRED") {
    ssl = ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false };
  } else if (sslMode === "VERIFY_CA" || sslMode === "VERIFY_IDENTITY") {
    ssl = { ...(ca ? { ca } : {}), rejectUnauthorized: true };
  } else {
    throw new Error("Unsupported DATABASE_URL ssl-mode; use DISABLED, REQUIRED, VERIFY_CA, or VERIFY_IDENTITY");
  }

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    ...(ssl ? { ssl } : {}),
    supportBigNumbers: true,
  };
}
