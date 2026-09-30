import "dotenv/config";
import { readMigrationFiles } from "drizzle-orm/migrator";
import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";
import { mysqlConnectionOptions } from "../server/_core/mysql-connection";

// Drizzle's timestamp watermark skips earlier migrations after a scoped run.
// Track every journal entry instead, so unrelated pending work stays pending.
async function migrate() {
  const authOnly = process.argv.includes("--auth-only");
  const journal = JSON.parse(
    readFileSync("drizzle/meta/_journal.json", "utf8")
  ) as {
    entries: { tag: string; when: number }[];
  };
  let connection:
    | Awaited<ReturnType<typeof mysql.createConnection>>
    | undefined;
  let locked = false;
  try {
    if (!process.env.DATABASE_URL)
      throw new Error("Missing database configuration");
    connection = await mysql.createConnection({
      ...mysqlConnectionOptions(process.env.DATABASE_URL),
      connectTimeout: 15_000,
    });
    const [lock] = await connection.query<mysql.RowDataPacket[]>(
      "SELECT GET_LOCK('ritmo_schema_migrations', 30) AS acquired"
    );
    if (Number(lock[0]?.acquired) !== 1)
      throw new Error("Migration lock unavailable");
    locked = true;
    await connection.query(
      "CREATE TABLE IF NOT EXISTS `__drizzle_migrations` (`id` SERIAL PRIMARY KEY, `hash` text NOT NULL, `created_at` bigint)"
    );
    const [applied] = await connection.query<mysql.RowDataPacket[]>(
      "SELECT hash, created_at FROM __drizzle_migrations"
    );
    const migrations = readMigrationFiles({ migrationsFolder: "drizzle" });
    // Validate all historical checksums before executing any DDL.
    for (const migration of migrations) {
      const entry = applied.find(
        row => Number(row.created_at) === migration.folderMillis
      );
      if (entry && entry.hash !== migration.hash)
        throw new Error("Historical migration checksum mismatch");
    }
    for (const migration of migrations) {
      const entry = journal.entries.find(
        row => row.when === migration.folderMillis
      );
      if (!entry) throw new Error("Missing journal entry");
      if (
        applied.some(row => Number(row.created_at) === migration.folderMillis)
      )
        continue;
      if (authOnly && !/^001[5-8]_/.test(entry.tag)) {
        console.log(`Pending outside auth scope: ${entry.tag}`);
        continue;
      }
      // MySQL DDL commits implicitly. A failure stops here, without marking it applied.
      for (const statement of migration.sql) {
        if (statement.trim()) await connection.query(statement);
      }
      await connection.query(
        "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
        [migration.hash, migration.folderMillis]
      );
      console.log(`Applied: ${entry.tag}`);
    }
    console.log("Migration validation completed.");
  } catch (error) {
    // Never log driver messages: they can include credentials or query parameters.
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "VALIDATION_OR_CONFIGURATION_ERROR";
    console.error(
      `Migration stopped (${code}). Inspect schema and history before retrying.`
    );
    process.exitCode = 1;
  } finally {
    if (locked)
      await connection?.query("SELECT RELEASE_LOCK('ritmo_schema_migrations')");
    await connection?.end();
  }
}

void migrate().catch(() => {
  console.error("Migration stopped (INITIALIZATION_OR_CLEANUP_ERROR).");
  process.exitCode = 1;
});
