import { generateWithGemini } from "../gemini-client";
import { COACH_SYSTEM_PROMPT } from "../prompts/coach";
import { buildUserAiContext } from "../context/user-context";
export async function runAiCoach(input: { language: string; experience: "man" | "woman"; question: string; authorized?: boolean; context?: unknown; mode?: string }) {
  const context = buildUserAiContext({ experience: input.experience, authorized: input.authorized !== false, data: input.context });
  return generateWithGemini({ feature: input.mode === "nutrition" ? "nutrition_analysis" : "ai_coach", maxOutputTokens: 1200, systemInstruction: COACH_SYSTEM_PROMPT, contents: [{ role: "user", parts: [{ text: JSON.stringify({ language: input.language, question: input.question, mode: input.mode, context }) }] }] });
}
