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
async function getUsage(usageDate: string, userId: number) {
  const db = await getDb(); if (!db) throw new Error("Database is required to enforce Gemini usage limits");
  const rows = await db.execute(sql`SELECT COALESCE(SUM(totalTokens),0) AS totalTokens FROM gemini_usage_daily WHERE usageDate=${usageDate} AND userId=${userId}`) as any;
  return { totalTokens: Number(rows[0]?.[0]?.totalTokens ?? 0) };
}
async function getGlobalUsage(usageDate: string) {
  const db = await getDb(); if (!db) throw new Error("Database is required to enforce Gemini usage limits");
  const rows = await db.execute(sql`SELECT COALESCE(SUM(totalTokens),0) AS totalTokens FROM gemini_usage_daily WHERE usageDate=${usageDate}`) as any;
  return { totalTokens: Number(rows[0]?.[0]?.totalTokens ?? 0) };
}
async function recordUsage(usageDate: string, userId: number, feature: string, inputTokens: number, outputTokens: number) {
  const db = await getDb(); if (!db) throw new Error("Database is required to record Gemini usage");
  const total = inputTokens + outputTokens;
  await db.execute(sql`INSERT INTO gemini_usage_daily (usageDate,userId,feature,calls,inputTokens,outputTokens,totalTokens) VALUES (${usageDate},${userId},${feature},1,${inputTokens},${outputTokens},${total}) ON DUPLICATE KEY UPDATE calls=calls+1,inputTokens=inputTokens+VALUES(inputTokens),outputTokens=outputTokens+VALUES(outputTokens),totalTokens=totalTokens+VALUES(totalTokens)`);
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  if (!ENV.geminiApiKey) throw new Error("GEMINI_API_KEY is not configured");
  const model = params.model || ENV.geminiModel;
  const userId = params.userId ?? 0; const feature = (params.feature || "general").slice(0,64);
  const system = params.messages.filter(m => m.role === "system").map(m => asParts(m.content)).flat().map((p: any) => p.text ?? "").join("\n");
  const contents = params.messages.filter(m => m.role !== "system").map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: asParts(m.content) }));
  const generationConfig: Record<string, unknown> = {}; const schema = schemaFrom(params);
  if (schema) { generationConfig.responseMimeType = "application/json"; generationConfig.responseSchema = schema; }
  const configuredMax = params.max_tokens ?? params.maxTokens;
  const maxTokens = Math.min(typeof configuredMax === "number" ? configuredMax : ENV.geminiMaxOutputTokens, ENV.geminiMaxOutputTokens);
  generationConfig.maxOutputTokens = maxTokens;
  const body: Record<string, unknown> = { contents, generationConfig }; if (system) body.systemInstruction = { parts: [{ text: system }] };
  const usageDate = dateKey();
  const estimatedInput = Math.ceil(JSON.stringify(body).length / 4);
  let countedInput = estimatedInput;
  try {
  const countResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":countTokens?key=" + encodeURIComponent(ENV.geminiApiKey), { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ contents, systemInstruction: system ? { parts:[{text:system}] } : undefined }), signal: AbortSignal.timeout(15_000) });
    if (countResponse.ok) { const countData = await countResponse.json() as any; countedInput = Number(countData.totalTokens ?? estimatedInput); }
  } catch { /* fallback estimate */ }
  if (countedInput > ENV.geminiMaxInputTokens) throw new Error(`Gemini input limit reached: ${countedInput} > ${ENV.geminiMaxInputTokens} tokens`);
  const [userUsage, globalUsage] = await Promise.all([getUsage(usageDate, userId), getGlobalUsage(usageDate)]);
  if (userUsage.totalTokens + countedInput + maxTokens > ENV.geminiUserDailyTokenLimit) throw new Error("Daily AI token limit reached for this account. Try again tomorrow.");
  if (globalUsage.totalTokens + countedInput + maxTokens > ENV.geminiDailyTokenLimit) throw new Error("Daily AI capacity reached. Please try again tomorrow.");
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(ENV.geminiApiKey);
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(60_000) });
  if (!response.ok) { const errorText = await response.text(); throw new Error("Gemini request failed: " + response.status + " " + errorText); }
  const data = await response.json() as any;
  const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
  const usage = data.usageMetadata ? { prompt_tokens: data.usageMetadata.promptTokenCount ?? countedInput, completion_tokens: data.usageMetadata.candidatesTokenCount ?? 0, total_tokens: data.usageMetadata.totalTokenCount ?? countedInput } : { prompt_tokens: countedInput, completion_tokens: 0, total_tokens: countedInput };
  await recordUsage(usageDate, userId, feature, Number(usage.prompt_tokens), Number(usage.completion_tokens));
  return { id: data.responseId ?? crypto.randomUUID(), created: Math.floor(Date.now()/1000), model, choices: [{ index:0, message:{ role:"assistant", content:text }, finish_reason:data.candidates?.[0]?.finishReason ?? null }], usage };
}
export async function listLLMModels() {
  if (!ENV.geminiApiKey) throw new Error("GEMINI_API_KEY is not configured");
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models?key=" + encodeURIComponent(ENV.geminiApiKey));
  if (!response.ok) throw new Error("Gemini model listing failed: " + response.status); return await response.json();
}
