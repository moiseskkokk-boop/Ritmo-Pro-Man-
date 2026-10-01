import { TRPCError } from "@trpc/server";
import { ENV } from "./env";
import { sql } from "drizzle-orm";
import { getDb } from "../db";

export type Role = "system" | "user" | "assistant" | "tool" | "function";
export type TextContent = { type: "text"; text: string };
export type ImageContent = { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } };
export type FileContent = { type: "file_url"; file_url: { url: string; mime_type?: string } };
export type MessageContent = string | TextContent | ImageContent | FileContent;
export type Message = { role: Role; content: MessageContent | MessageContent[]; name?: string; tool_call_id?: string };
export type Tool = { type: "function"; function: { name: string; description?: string; parameters?: Record<string, unknown> } };
export type ToolChoice = "none" | "auto" | "required" | { name: string } | { type: "function"; function: { name: string } };
export type InvokeParams = {
  messages: Message[]; tools?: Tool[]; toolChoice?: ToolChoice; tool_choice?: ToolChoice;
  maxTokens?: number; max_tokens?: number; outputSchema?: OutputSchema; output_schema?: OutputSchema;
  responseFormat?: ResponseFormat; response_format?: ResponseFormat; model?: string;
  userId?: number; feature?: string;
};
export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type InvokeResult = { id: string; created: number; model: string; choices: Array<{ index: number; message: { role: Role; content: string; tool_calls?: ToolCall[] }; finish_reason: string | null }>; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } };
export type JsonSchema = { name: string; schema: Record<string, unknown>; strict?: boolean };
export type OutputSchema = JsonSchema;
export type ResponseFormat = { type: "text" } | { type: "json_object" } | { type: "json_schema"; json_schema: JsonSchema };

function asParts(content: MessageContent | MessageContent[]): any[] {
  const parts = Array.isArray(content) ? content : [content];
  return parts.flatMap((part: MessageContent): any[] => {
    if (typeof part === "string") return [{ text: part }];
    if (part.type === "text") return [{ text: part.text }];
    if (part.type === "image_url") {
      const match = part.image_url.url.match(/^data:([^;]+);base64,(.+)$/);
      return match ? [{ inlineData: { mimeType: match[1], data: match[2] } }] : [{ text: "[Imagem: " + part.image_url.url + "]" }];
    }
    return [{ text: "[Arquivo: " + part.file_url.url + "]" }];
  });
}
function schemaFrom(params: InvokeParams) {
  const format = params.responseFormat ?? params.response_format; const output = params.outputSchema ?? params.output_schema;
  if (format?.type === "json_schema") return format.json_schema.schema; if (output) return output.schema;
  if (format?.type === "json_object") return { type: "object" }; return undefined;
}
function dateKey() { return new Intl.DateTimeFormat("en-CA", { timeZone: ENV.appTimeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
// Reserve the maximum cost while holding a global row lock. This also serializes
// simultaneous requests from separate server processes without calling Gemini
// inside a transaction. Budget rows are separate from feature usage rows.
async function reserveBudget(usageDate: string, userId: number, tokens: number) {
  const db = await getDb(); if (!db) throw new Error("Database required for AI budget");
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error("Authenticated AI user required");
  await db.transaction(async tx => {
    for (const id of [0, userId]) await tx.execute(sql`INSERT INTO gemini_usage_daily ("usageDate","userId",feature) VALUES (${usageDate},${id},'__budget__') ON CONFLICT ("usageDate","userId",feature) DO NOTHING`);
    const { rows: globalRows } = await tx.execute(sql`SELECT "totalTokens" FROM gemini_usage_daily WHERE "usageDate"=${usageDate} AND "userId"=0 AND feature='__budget__' FOR UPDATE`) as any;
    const { rows: userRows } = await tx.execute(sql`SELECT "totalTokens" FROM gemini_usage_daily WHERE "usageDate"=${usageDate} AND "userId"=${userId} AND feature='__budget__' FOR UPDATE`) as any;
    // Include usage written before budget reservations were introduced.
    const { rows: legacyGlobal } = await tx.execute(sql`SELECT COALESCE(SUM("totalTokens"),0) AS total FROM gemini_usage_daily WHERE "usageDate"=${usageDate} AND feature <> '__budget__'`) as any;
    const { rows: legacyUser } = await tx.execute(sql`SELECT COALESCE(SUM("totalTokens"),0) AS total FROM gemini_usage_daily WHERE "usageDate"=${usageDate} AND "userId"=${userId} AND feature <> '__budget__'`) as any;
    const globalTotal = Math.max(Number(globalRows[0].totalTokens), Number(legacyGlobal[0].total));
    const userTotal = Math.max(Number(userRows[0].totalTokens), Number(legacyUser[0].total));
    if (globalTotal + tokens > ENV.geminiDailyTokenLimit || userTotal + tokens > ENV.geminiUserDailyTokenLimit) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "O orçamento diário de IA do aplicativo foi atingido. Tente amanhã. Este limite é do Ritmo Pro, não da quota Gemini." });
    await tx.execute(sql`UPDATE gemini_usage_daily SET "totalTokens"=${globalTotal + tokens},calls=calls+1 WHERE "usageDate"=${usageDate} AND "userId"=0 AND feature='__budget__'`);
    await tx.execute(sql`UPDATE gemini_usage_daily SET "totalTokens"=${userTotal + tokens},calls=calls+1 WHERE "usageDate"=${usageDate} AND "userId"=${userId} AND feature='__budget__'`);
  });
}
async function settleBudget(usageDate: string, userId: number, reserved: number, actual: number) {
  const db = await getDb(); if (!db) throw new Error("Database required for AI budget");
  await db.transaction(async tx => {
    for (const id of [0, userId]) await tx.execute(sql`UPDATE gemini_usage_daily SET "totalTokens"=GREATEST(0,"totalTokens"-${reserved}+${actual}) WHERE "usageDate"=${usageDate} AND "userId"=${id} AND feature='__budget__'`);
  });
}
async function recordUsage(usageDate: string, userId: number, feature: string, inputTokens: number, outputTokens: number) {
  const db = await getDb(); if (!db) throw new Error("Database is required to record Gemini usage");
  const total = inputTokens + outputTokens;
  await db.execute(sql`INSERT INTO gemini_usage_daily ("usageDate","userId",feature,calls,"inputTokens","outputTokens","totalTokens") VALUES (${usageDate},${userId},${feature},1,${inputTokens},${outputTokens},${total}) ON CONFLICT ("usageDate","userId",feature) DO UPDATE SET calls=gemini_usage_daily.calls+1,"inputTokens"=gemini_usage_daily."inputTokens"+EXCLUDED."inputTokens","outputTokens"=gemini_usage_daily."outputTokens"+EXCLUDED."outputTokens","totalTokens"=gemini_usage_daily."totalTokens"+EXCLUDED."totalTokens","updatedAt"=NOW()`);
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  if (!ENV.geminiApiKey) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "O serviço Gemini não está configurado no servidor." });
  const model = params.model || ENV.geminiModel;
  const userId = params.userId ?? 0; const feature = (params.feature || "general").slice(0,64);
  const system = params.messages.filter(m => m.role === "system").map(m => asParts(m.content)).flat().map((p: any) => p.text ?? "").join("\n");
  const contents = params.messages.filter(m => m.role !== "system").map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: asParts(m.content) }));
  const generationConfig: Record<string, unknown> = {}; const schema = schemaFrom(params);
  if (schema) { generationConfig.responseMimeType = "application/json"; generationConfig.responseSchema = schema; }
  const configuredMax = params.max_tokens ?? params.maxTokens;
  const maxTokens = Math.min(typeof configuredMax === "number" ? configuredMax : ENV.geminiMaxOutputTokens, ENV.geminiMaxOutputTokens);
  if (![maxTokens, ENV.geminiMaxInputTokens, ENV.geminiDailyTokenLimit, ENV.geminiUserDailyTokenLimit].every(v => Number.isSafeInteger(v) && v > 0)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Os limites de tokens Gemini no servidor têm configuração inválida." });
  generationConfig.maxOutputTokens = maxTokens;
  const body: Record<string, unknown> = { contents, generationConfig }; if (system) body.systemInstruction = { parts: [{ text: system }] };
  const usageDate = dateKey();
  // Base64 byte length is not an image token count. Fail clearly if counting
  // fails instead of falsely reporting input exhaustion on small photographs.
  let countResponse: Response;
  try {
    countResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":countTokens?key=" + encodeURIComponent(ENV.geminiApiKey), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents, systemInstruction: system ? { parts: [{ text: system }] } : undefined }), signal: AbortSignal.timeout(15_000) });
  } catch (cause) { throw new TRPCError({ code: "BAD_GATEWAY", message: "Não foi possível consultar o Gemini para contar tokens. Tente novamente mais tarde.", cause }); }
  if (!countResponse.ok) {
    const detail = await countResponse.json().catch(() => null) as any;
    throw geminiProviderError(countResponse.status, detail?.error?.status);
  }
  const countData = await countResponse.json() as any;
  const countedInput = Number(countData.totalTokens);
  if (!Number.isSafeInteger(countedInput) || countedInput <= 0) throw new Error("Invalid Gemini token count");
  if (countedInput > ENV.geminiMaxInputTokens) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: `A solicitação excede o limite de entrada do aplicativo (${countedInput}/${ENV.geminiMaxInputTokens} tokens). Reduza os dados enviados.` });
  const reserved = countedInput + maxTokens;
  await reserveBudget(usageDate, userId, reserved);
  // Failed/uncertain requests retain their reservation conservatively.
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(ENV.geminiApiKey);
  let response: Response;
  try { response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(60_000) }); } catch (cause) { throw new TRPCError({ code: "BAD_GATEWAY", message: "Gemini não respondeu à solicitação. Tente novamente mais tarde.", cause }); }
  if (!response.ok) {
    // A rejected HTTP request did not generate output; do not consume local budget.
    await settleBudget(usageDate, userId, reserved, 0);
    const detail = await response.json().catch(() => null) as any;
    throw geminiProviderError(response.status, detail?.error?.status);
  }
  const data = await response.json() as any;
  const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
  const usage = data.usageMetadata ? { prompt_tokens: data.usageMetadata.promptTokenCount ?? countedInput, completion_tokens: Math.max(0, Number(data.usageMetadata.totalTokenCount ?? (Number(data.usageMetadata.promptTokenCount ?? countedInput) + Number(data.usageMetadata.candidatesTokenCount ?? 0) + Number(data.usageMetadata.thoughtsTokenCount ?? 0))) - Number(data.usageMetadata.promptTokenCount ?? countedInput)), total_tokens: data.usageMetadata.totalTokenCount ?? countedInput } : { prompt_tokens: countedInput, completion_tokens: 0, total_tokens: countedInput };
  const actualInput = Number(usage.prompt_tokens), actualOutput = Number(usage.completion_tokens);
  if (![actualInput,actualOutput].every(v => Number.isSafeInteger(v) && v >= 0)) throw new Error("Invalid Gemini usage response");
  await recordUsage(usageDate, userId, feature, actualInput, actualOutput);
  await settleBudget(usageDate, userId, reserved, actualInput + actualOutput);
  return { id: data.responseId ?? crypto.randomUUID(), created: Math.floor(Date.now()/1000), model, choices: [{ index:0, message:{ role:"assistant", content:text }, finish_reason:data.candidates?.[0]?.finishReason ?? null }], usage };
}
export async function listLLMModels() {
  if (!ENV.geminiApiKey) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "O serviço Gemini não está configurado no servidor." });
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models?key=" + encodeURIComponent(ENV.geminiApiKey));
  if (!response.ok) throw new Error("Gemini model listing failed: " + response.status); return await response.json();
}

export function geminiProviderError(status: number, _providerStatus?: string) {
  return new TRPCError({
    code: status === 429 ? "TOO_MANY_REQUESTS" : status === 401 || status === 403 ? "PRECONDITION_FAILED" : "BAD_GATEWAY",
    message: status === 429
      ? "Gemini recusou a solicitação (HTTP 429): quota ou limite de frequência do provedor atingido. Tente mais tarde e verifique a quota Gemini."
      : `Gemini recusou a solicitação (HTTP ${status}). ${status === 401 || status === 403 ? "Verifique a configuração e as permissões no servidor." : "Verifique a disponibilidade e configuração do provedor."}`,
  });
}
