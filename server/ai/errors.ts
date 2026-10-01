export type AiErrorCode =
  | "AI_NOT_CONFIGURED" | "AI_INVALID_KEY" | "AI_INVALID_MODEL"
  | "AI_RATE_LIMIT" | "AI_QUOTA_EXCEEDED" | "AI_TIMEOUT"
  | "AI_PROVIDER_ERROR" | "AI_INVALID_RESPONSE" | "AI_CONTEXT_ERROR";

export class AiError extends Error {
  constructor(public readonly code: AiErrorCode, message: string, public readonly status?: number) {
    super(message);
    this.name = "AiError";
  }
}
