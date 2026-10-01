import { ENV } from "../_core/env";
export const AI_CONFIG = {
  get configured() { return Boolean(ENV.geminiApiKey); },
  get model() { return ENV.geminiModel; },
  timeoutMs: 60_000,
} as const;
