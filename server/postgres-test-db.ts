import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { readFile } from "node:fs/promises";
import { postgresConnectionOptions } from "./_core/postgres-connection";

// All tables and their serial sequences live in pg_temp. No production table,
// index or sequence is written. One client owns the entire isolated test schema.
export async function isolatedPostgres() {
  const connection = new Client(postgresConnectionOptions(process.env.DATABASE_URL!));
  await connection.connect();
  try {
    await connection.query("SET search_path TO pg_temp");
    for (const file of ["0000_pg_initial.sql", "0001_sessions_ai_week.sql", "0002_session_water_cardio.sql"]) {
      const source = await readFile(new URL(`../drizzle-pg/${file}`, import.meta.url), "utf8");
      await connection.query(source.replace(/CREATE TABLE/g, "CREATE TEMP TABLE"));
    }
    const real = drizzle(connection);
    let pending = Promise.resolve();
    const db = new Proxy(real, {
      get(target, key) {
        if (key === "transaction") return async (callback: Parameters<typeof real.transaction>[0]) => {
          const previous = pending;
          let release!: () => void;
          pending = new Promise<void>(resolve => { release = resolve; });
          await previous;
          try { return await target.transaction(callback); } finally { release(); }
        };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    return { connection, db };
  } catch (error) { await connection.end(); throw error; }
}
