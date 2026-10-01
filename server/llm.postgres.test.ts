import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const state = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("../server/db", () => ({ getDb: async () => ({ execute: state.execute, transaction: async (fn: (tx: unknown) => unknown) => fn({ execute: state.execute }) }) }));
import { ENV } from "./_core/env";
import { invokeLLM, geminiProviderError } from "./_core/llm";
const original = { ...ENV };
const dialect = new PgDialect();
const ask = () => invokeLLM({ userId: 42, feature: "test", maxTokens: 100, messages: [{ role: "user", content: "hello" }] });
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(ENV, { geminiApiKey: "test-key", geminiMaxInputTokens: 1000, geminiMaxOutputTokens: 100, geminiDailyTokenLimit: 1000, geminiUserDailyTokenLimit: 1000 });
  state.execute.mockImplementation(async query => {
    const { sql } = dialect.sqlToQuery(query);
    if (sql.includes('SELECT "totalTokens"')) return { rows: [{ totalTokens: "0" }] };
    if (sql.includes('SUM("totalTokens")')) return { rows: [{ total: "0" }] };
    return { rows: [], rowCount: 1 };
  });
});
afterEach(() => { Object.assign(ENV, original); vi.unstubAllGlobals(); });
function provider(status = 200) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(JSON.stringify(url.includes(":countTokens") ? { totalTokens: 10 } : status === 200 ? {
    candidates: [{ content: { parts: [{ text: "valid answer" }] }, finishReason: "STOP" }],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, thoughtsTokenCount: 5, totalTokenCount: 35 },
  } : { error: { status: "PRIVATE_PROVIDER_DETAIL", message: "secret" } }), { status: url.includes(":countTokens") ? 200 : status })));
}
describe("Gemini PostgreSQL ledger", () => {
  it("reads node-postgres rows and counts thinking tokens", async () => {
    provider();
    const result = await ask();
    expect(result.choices[0].message.content).toBe("valid answer");
    expect(result.usage).toEqual({ prompt_tokens: 10, completion_tokens: 25, total_tokens: 35 });
  });
  it("enforces the app budget before generation and labels it separately from provider quota", async () => {
    provider(); ENV.geminiUserDailyTokenLimit = 100;
    await expect(ask()).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS", message: expect.stringContaining("não da quota Gemini") });
    expect(fetch).toHaveBeenCalledOnce();
  });
  it.each([[429, "TOO_MANY_REQUESTS"], [403, "PRECONDITION_FAILED"], [503, "BAD_GATEWAY"]])("classifies HTTP %s and releases rejected request capacity", async (status, code) => {
    provider(Number(status));
    await expect(ask()).rejects.toMatchObject({ code });
    const queries = state.execute.mock.calls.map(([query]) => dialect.sqlToQuery(query));
    expect(queries.filter(q => q.sql.includes("GREATEST")).every(q => q.params.includes(0))).toBe(true);
    expect(queries.filter(q => q.sql.includes("GREATEST"))).toHaveLength(2);
  });
  it("does not expose arbitrary provider status text", () => {
    expect(geminiProviderError(503, "secret key injected in provider response").message).not.toContain("secret key");
  });
});
