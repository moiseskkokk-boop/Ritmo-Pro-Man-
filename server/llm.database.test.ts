import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync } from "node:fs";
const state = vi.hoisted(() => ({ database: undefined as any }));
vi.mock("drizzle-orm/node-postgres", () => ({ drizzle: () => state.database }));
import { invokeLLM } from "./_core/llm";
import { ENV } from "./_core/env";
let pg: PGlite;
const original = { ...ENV }; const originalUrl = process.env.DATABASE_URL;
let countStatus = 200, generateStatus = 200, counted = 10, calls = 0;
beforeAll(async () => {
  process.env.DATABASE_URL = "postgresql://localhost/isolated_test";
  pg = new PGlite(); state.database = drizzle(pg);
  await pg.exec(readFileSync("drizzle-pg/0000_pg_initial.sql", "utf8"));
}, 30000);
afterAll(async () => { Object.assign(ENV, original); process.env.DATABASE_URL = originalUrl; vi.unstubAllGlobals(); await pg.close(); });
beforeEach(async () => {
  await pg.exec("TRUNCATE gemini_usage_daily");
  Object.assign(ENV, { geminiApiKey: "test-secret-key", geminiMaxInputTokens: 1000, geminiMaxOutputTokens: 100, geminiDailyTokenLimit: 150, geminiUserDailyTokenLimit: 150 });
  countStatus = 200; generateStatus = 200; counted = 10; calls = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.includes(":countTokens")) return new Response(JSON.stringify(countStatus === 200 ? { totalTokens: counted } : { error: { status: "RESOURCE_EXHAUSTED" } }), { status: countStatus });
    calls++;
    return new Response(JSON.stringify(generateStatus === 200 ? { candidates: [{ content: { parts: [{ text: "Resposta" }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, thoughtsTokenCount: 5, totalTokenCount: 35 } } : { error: { status: generateStatus === 403 ? "PERMISSION_DENIED" : "RESOURCE_EXHAUSTED" } }), { status: generateStatus });
  }));
});
const ask = (userId = 42) => invokeLLM({ userId, feature: "test", maxTokens: 100, messages: [{ role: "user", content: "Test" }] });
describe("Gemini PostgreSQL ledger and error classification", () => {
  it("reads PostgreSQL result.rows, settles actual usage including thought tokens, and allows a second small request", async () => {
    await ask(); await ask();
    expect(calls).toBe(2);
    const rows = (await pg.query<{ totalTokens: number; feature: string; userId: number }>('SELECT * FROM gemini_usage_daily')).rows;
    expect(rows.find(r => r.userId === 42 && r.feature === "__budget__")?.totalTokens).toBe(70);
    expect(rows.find(r => r.userId === 42 && r.feature === "test")?.totalTokens).toBe(70);
  });
  it("serializes reservations and clearly identifies the local app budget", async () => {
    const results = await Promise.allSettled([ask(), ask()]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find(r => r.status === "rejected")).toMatchObject({ reason: { code: "TOO_MANY_REQUESTS", message: expect.stringContaining("orçamento diário") } });
    expect(calls).toBe(1);
  });
  it("distinguishes Gemini HTTP 429, releases its local reservation and allows retry", async () => {
    generateStatus = 429; await expect(ask()).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS", message: expect.stringContaining("HTTP 429") });
    generateStatus = 200; await expect(ask()).resolves.toMatchObject({ choices: [{ message: { content: "Resposta" } }] });
  });
  it("never treats a failed countTokens request as a giant base64/token estimate", async () => {
    countStatus = 429;
    await expect(ask()).rejects.toMatchObject({ message: expect.stringContaining("HTTP 429") }); expect(calls).toBe(0);
    expect((await pg.query("SELECT * FROM gemini_usage_daily")).rows).toHaveLength(0);
  });
  it("uses multimodal provider counts instead of image byte length", async () => {
    await expect(invokeLLM({ userId: 42, maxTokens: 100, messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: "data:image/jpeg;base64," + "A".repeat(100000) } }] }] })).resolves.toBeDefined();
  });
  it("classifies provider permissions, input limit and missing configuration without claiming quota exhaustion", async () => {
    generateStatus = 403; await expect(ask()).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: expect.stringContaining("HTTP 403") });
    counted = 1001; await expect(ask()).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
    ENV.geminiApiKey = ""; await expect(ask()).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: expect.stringContaining("não está configurado") });
  });
});
