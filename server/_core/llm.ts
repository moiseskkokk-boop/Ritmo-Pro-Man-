import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";
export type TextContent = { type: "text"; text: string };
export type ImageContent = { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } };
export type FileContent = { type: "file_url"; file_url: { url: string; mime_type?: string } };
export type MessageContent = string | TextContent | ImageContent | FileContent;
export type Message = { role: Role; content: MessageContent | MessageContent[]; name?: string; tool_call_id?: string };
export type Tool = { type: "function"; function: { name: string; description?: string; parameters?: Record<string, unknown> } };
export type ToolChoice = "none" | "auto" | "required" | { name: string } | { type: "function"; function: { name: string } };
export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  model?: string;
};
export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type InvokeResult = {
  id: string; created: number; model: string;
  choices: Array<{ index: number; message: { role: Role; content: string; tool_calls?: ToolCall[] }; finish_reason: string | null }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};
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
  const format = params.responseFormat ?? params.response_format;
  const output = params.outputSchema ?? params.output_schema;
  if (format?.type === "json_schema") return format.json_schema.schema;
  if (output) return output.schema;
  if (format?.type === "json_object") return { type: "object" };
  return undefined;
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  if (!ENV.geminiApiKey) throw new Error("GEMINI_API_KEY is not configured");
  const model = params.model || ENV.geminiModel;
  const system = params.messages.filter(m => m.role === "system").map(m => asParts(m.content)).flat().map((p: any) => p.text ?? "").join("\\n");
  const contents = params.messages.filter(m => m.role !== "system").map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: asParts(m.content),
  }));
  const generationConfig: Record<string, unknown> = {};
  const schema = schemaFrom(params);
  if (schema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = schema;
  }
  const maxTokens = params.max_tokens ?? params.maxTokens;
  if (typeof maxTokens === "number") generationConfig.maxOutputTokens = maxTokens;

  const body: Record<string, unknown> = { contents, generationConfig };
  if (system) body.systemInstruction = { parts: [{ text: system }] };

  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(ENV.geminiApiKey);
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error("Gemini request failed: " + response.status + " " + errorText);
  }
  const data = await response.json() as any;
  const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
  return {
    id: data.responseId ?? crypto.randomUUID(),
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: data.candidates?.[0]?.finishReason ?? null }],
    usage: data.usageMetadata ? {
      prompt_tokens: data.usageMetadata.promptTokenCount ?? 0,
      completion_tokens: data.usageMetadata.candidatesTokenCount ?? 0,
      total_tokens: data.usageMetadata.totalTokenCount ?? 0,
    } : undefined,
  };
}

export async function listLLMModels() {
  if (!ENV.geminiApiKey) throw new Error("GEMINI_API_KEY is not configured");
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models?key=" + encodeURIComponent(ENV.geminiApiKey));
  if (!response.ok) throw new Error("Gemini model listing failed: " + response.status);
  return await response.json();
}
