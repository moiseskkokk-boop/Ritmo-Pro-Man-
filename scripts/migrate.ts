import "dotenv/config";
import { migrate as runMigrations } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { postgresConnectionOptions } from "../server/_core/postgres-connection";

async function migrate() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Missing database configuration");
  const pool = new Pool(postgresConnectionOptions(url));
  try {
    // Repair additive columns required by the current app before Drizzle reads them.
    // This is idempotent and protects production from an older/stale migration journal.
    await pool.query(`ALTER TABLE "body_analyses" ADD COLUMN IF NOT EXISTS "assessmentWeekStart" varchar(10)`);
    await pool.query(`ALTER TABLE "body_analyses" ADD COLUMN IF NOT EXISTS "experience" varchar(16) NOT NULL DEFAULT 'man'`);
    await pool.query(`CREATE INDEX IF NOT EXISTS "body_analyses_user_week" ON "body_analyses" ("userId", "assessmentWeekStart")`);
    const db = drizzle(pool);
    await runMigrations(db, { migrationsFolder: "drizzle-pg" });
    console.log("Migration validation completed.");
  } finally {
    await pool.end();
  }
}

void migrate().catch((error) => {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "MIGRATION_ERROR";
  console.error(`Migration stopped (${code}).`);
  process.exitCode = 1;
});
