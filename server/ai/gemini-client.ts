import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { ENV } from "../_core/env";

export type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };
export type GeminiMessage = { role: "user" | "model"; parts: GeminiPart[] };
export type GeminiRequest = {
  feature: string;
  contents: GeminiMessage[];
  systemInstruction?: string;
  maxOutputTokens?: number;
  responseMimeType?: "application/json";
  responseSchema?: Record<string, unknown>;
  model?: string;
};
export type GeminiResult = { requestId: string; model: string; text: string; usage: { input: number; output: number; total: number } };

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_FALLBACK_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash"];

export async function discoverAvailableGeminiModels(): Promise<string[]> {
  if (!ENV.geminiApiKey) return [];
  const response = await fetch(`${API_BASE}/models?key=${encodeURIComponent(ENV.geminiApiKey)}`, { signal: AbortSignal.timeout(20_000) });
  const data = await response.json().catch(() => null) as any;
  if (!response.ok) return [];
  return (data?.models ?? []).filter((m:any) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent")).map((m:any) => String(m.name || "").replace(/^models\//, "")).filter(Boolean);
}

async function resolveGeminiModel(preferred?: string): Promise<string> {
  const wanted = (preferred || ENV.geminiModel || "").replace(/^models\//, "").trim();
  const available = await discoverAvailableGeminiModels();
  if (wanted && available.includes(wanted)) return wanted;
  for (const candidate of DEFAULT_FALLBACK_MODELS) if (available.includes(candidate)) return candidate;
  const flash = available.find(m => m.includes("flash-lite")) || available.find(m => m.includes("flash"));
  return flash || wanted || DEFAULT_FALLBACK_MODELS[0];
}
const safeProvider = (value: unknown) => typeof value === "string" ? value.replace(/AIza[\w-]+/g, "[REDACTED]").slice(0, 500) : "";

function providerError(status: number, detail: any, requestId: string, feature: string, model: string): TRPCError {
  const providerStatus = safeProvider(detail?.error?.status);
  const providerMessage = safeProvider(detail?.error?.message);
  console.error(`[Gemini] requestId=${requestId} feature=${feature} model=${model} status=${status} providerStatus=${providerStatus} providerMessage=${providerMessage}`);
  const code = status === 429 ? "TOO_MANY_REQUESTS" : status === 401 || status === 403 ? "PRECONDITION_FAILED" : "BAD_GATEWAY";
  const message = status === 429 ? "Gemini atingiu a quota ou limite de frequência. Tente novamente mais tarde." : status === 401 || status === 403 ? "Gemini recusou a autenticação do servidor." : `Gemini recusou a solicitação (HTTP ${status}).`;
  return new TRPCError({ code, message });
}

export async function generateWithGemini(input: GeminiRequest): Promise<GeminiResult> {
  if (!ENV.geminiApiKey) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "O serviço Gemini não está configurado no servidor." });
  const requestId = randomUUID();
  const model = await resolveGeminiModel(input.model);
  const maxOutputTokens = Math.min(input.maxOutputTokens ?? ENV.geminiMaxOutputTokens, ENV.geminiMaxOutputTokens);
  const generationConfig: Record<string, unknown> = { maxOutputTokens };
  if (input.responseMimeType) generationConfig.responseMimeType = input.responseMimeType;
  if (input.responseSchema) generationConfig.responseSchema = input.responseSchema;
  const body: Record<string, unknown> = { contents: input.contents, generationConfig };
  if (input.systemInstruction) body.systemInstruction = { parts: [{ text: input.systemInstruction }] };
  const started = Date.now();
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(ENV.geminiApiKey)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(60_000) });
  } catch (cause) {
    console.error(`[Gemini] requestId=${requestId} feature=${input.feature} model=${model} network_error durationMs=${Date.now()-started}`);
    throw new TRPCError({ code: "BAD_GATEWAY", message: "Gemini não respondeu. Tente novamente.", cause });
  }
  const data = await response.json().catch(() => null) as any;
  if (!response.ok) throw providerError(response.status, data, requestId, input.feature, model);
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => typeof p?.text === "string" ? p.text : "").join("") ?? "";
  if (!text) throw new TRPCError({ code: "BAD_GATEWAY", message: "Gemini respondeu sem conteúdo utilizável." });
  const usage = data?.usageMetadata ?? {};
  const result = { input: Number(usage.promptTokenCount ?? 0), output: Number(usage.candidatesTokenCount ?? 0), total: Number(usage.totalTokenCount ?? 0) };
  console.info(`[Gemini] requestId=${requestId} feature=${input.feature} model=${model} status=200 durationMs=${Date.now()-started} tokens=${result.total}`);
  return { requestId, model, text, usage: result };
}

export async function testGeminiConnection(): Promise<{ ok: true; model: string; requestId: string }> {
  const result = await generateWithGemini({ feature: "connection_test", maxOutputTokens: 32, contents: [{ role: "user", parts: [{ text: "Responda apenas: RITMO_GEMINI_OK" }] }] });
  if (!result.text.includes("RITMO_GEMINI_OK")) throw new TRPCError({ code: "BAD_GATEWAY", message: "Gemini respondeu ao teste com conteúdo inesperado." });
  return { ok: true, model: result.model, requestId: result.requestId };
}
