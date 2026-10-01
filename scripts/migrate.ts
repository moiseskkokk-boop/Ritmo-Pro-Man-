import "dotenv/config";
import { migrate as runMigrations } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

async function migrate() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Missing database configuration");
  const pool = new Pool({
    connectionString: url,
    ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false },
  });
  try {
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
