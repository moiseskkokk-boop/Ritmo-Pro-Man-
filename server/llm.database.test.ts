import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { mysqlConnectionOptions } from "./_core/mysql-connection";
const state = vi.hoisted(() => ({
  database: undefined as unknown,
  generateCalls: 0,
}));
vi.mock("drizzle-orm/mysql2", async original => ({
  ...(await original<object>()),
  drizzle: () => state.database,
}));
import { invokeLLM } from "./_core/llm";
import { ENV } from "./_core/env";
vi.setConfig({ testTimeout: 30_000 });
describe.skipIf(process.env.FITNESS_DATABASE_TESTS !== "1")(
  "Gemini budget with isolated MySQL ledger",
  () => {
    let connection: Awaited<ReturnType<typeof mysql.createConnection>>;
    const original = { ...ENV };
    beforeAll(async () => {
      dotenv.config({ quiet: true });
      try {
        connection = await mysql.createConnection({
          ...mysqlConnectionOptions(process.env.DATABASE_URL!),
          connectTimeout: 15000,
        });
        const [ddl] = await connection.query<mysql.RowDataPacket[]>(
          "SHOW CREATE TABLE gemini_usage_daily"
        );
        await connection.query(
          String(ddl[0]["Create Table"]).replace(
            /^CREATE TABLE/,
            "CREATE TEMPORARY TABLE"
          )
        );
        const { drizzle } =
          await vi.importActual<typeof import("drizzle-orm/mysql2")>(
            "drizzle-orm/mysql2"
          );
        const real = drizzle(connection);
        // Drizzle production uses a pool. Temporary tables require one connection;
        // grant each test transaction exclusive ownership so transactions cannot
        // accidentally nest/interleave on that single physical connection.
        let pending = Promise.resolve();
        state.database = new Proxy(real, {
          get(target, key) {
            if (key === "transaction")
              return async (
                callback: Parameters<typeof real.transaction>[0]
              ) => {
                const previous = pending;
                let release!: () => void;
                pending = new Promise<void>(resolve => {
                  release = resolve;
                });
                await previous;
                try {
                  return await target.transaction(callback);
                } finally {
                  release();
                }
              };
            const value = Reflect.get(target, key);
            return typeof value === "function" ? value.bind(target) : value;
          },
        });
      } catch {
        throw new Error("Isolated Gemini ledger setup unavailable");
      }
      ENV.geminiApiKey = "test-only-no-external-delivery";
      ENV.geminiMaxInputTokens = 200;
      ENV.geminiMaxOutputTokens = 100;
      ENV.geminiDailyTokenLimit = 150;
      ENV.geminiUserDailyTokenLimit = 150;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
          if (url.includes(":countTokens"))
            return new Response(JSON.stringify({ totalTokens: 10 }), {
              status: 200,
            });
          state.generateCalls++;
          await new Promise(resolve => setTimeout(resolve, 1500));
          return new Response(
            JSON.stringify({
              candidates: [{ content: { parts: [{ text: "Test answer" }] } }],
              usageMetadata: {
                promptTokenCount: 10,
                candidatesTokenCount: 20,
                thoughtsTokenCount: 5,
                totalTokenCount: 35,
              },
            }),
            { status: 200 }
          );
        })
      );
    }, 30000);
    afterAll(async () => {
      Object.assign(ENV, original);
      vi.unstubAllGlobals();
      await connection?.end();
    });
    const ask = (userId: number) =>
      invokeLLM({
        userId,
        feature: "ai_coach",
        maxTokens: 100,
        messages: [{ role: "user", content: "Test request" }],
      });
    it("reserves global capacity before concurrent in-flight generations", async () => {
      const results = await Promise.allSettled([ask(42), ask(43)]);
      expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
      expect(state.generateCalls).toBe(1);
    });
    it("accounts for model thinking tokens and settles unused capacity", async () => {
      const [rows] = await connection.query<mysql.RowDataPacket[]>(
        "SELECT userId,feature,totalTokens FROM gemini_usage_daily"
      );
      expect(
        rows.find(r => r.userId === 0 && r.feature === "__budget__")
          ?.totalTokens
      ).toBe(35);
      expect(rows.find(r => r.feature === "ai_coach")?.totalTokens).toBe(35);
    });
    it("enforces the per-user limit separately from global capacity", async () => {
      ENV.geminiUserDailyTokenLimit = 40;
      ENV.geminiDailyTokenLimit = 1000;
      await expect(ask(42)).rejects.toThrow(/Daily AI/);
      expect(state.generateCalls).toBe(1);
    });
    it("fails closed on unauthenticated calls and invalid token configuration", async () => {
      await expect(ask(0)).rejects.toThrow(/Authenticated/);
      ENV.geminiMaxOutputTokens = NaN;
      await expect(ask(42)).rejects.toThrow(/configuration/);
      ENV.geminiMaxOutputTokens = 100;
    });
    it("does not expose provider error bodies and retains uncertain reservations", async () => {
      ENV.geminiUserDailyTokenLimit = 500;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) =>
          url.includes(":countTokens")
            ? new Response(JSON.stringify({ totalTokens: 10 }))
            : new Response("PRIVATE_PROVIDER_ERROR_BODY", { status: 503 })
        )
      );
      await expect(ask(44)).rejects.toThrow("Gemini request failed (HTTP 503)");
      const [rows] = await connection.query<mysql.RowDataPacket[]>(
        "SELECT totalTokens FROM gemini_usage_daily WHERE userId=44 AND feature='__budget__'"
      );
      expect(Number(rows[0].totalTokens)).toBe(110);
    });
  }
);
