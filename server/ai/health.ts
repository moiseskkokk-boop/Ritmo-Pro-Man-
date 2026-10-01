import { AI_CONFIG } from "./config";
import { testGeminiConnection } from "./gemini-client";
import { aiHealthSchema } from "./schemas";
let lastSuccessfulRequest: string | null = null;
export async function checkGeminiHealth() {
  if (!AI_CONFIG.configured) return { configured: false, reachable: false, model: AI_CONFIG.model, lastSuccessfulRequest };
  const started = Date.now();
  try {
    const result = await testGeminiConnection();
    lastSuccessfulRequest = new Date().toISOString();
    const health = aiHealthSchema.parse({ ...result, latencyMs: Date.now() - started });
    return { configured: true, reachable: true, ...health, lastSuccessfulRequest };
  } catch (error) {
    return { configured: true, reachable: false, model: AI_CONFIG.model, lastSuccessfulRequest, error: error instanceof Error ? error.message : "AI provider error" };
  }
}
