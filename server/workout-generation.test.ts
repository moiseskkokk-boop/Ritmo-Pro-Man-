import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ release: vi.fn(), reserve: vi.fn(), llm: vi.fn() }));
vi.mock("./workout-ai-limit", () => ({ reserveWorkoutWeek: state.reserve }));
vi.mock("./_core/llm", () => ({ invokeLLM: state.llm }));
vi.mock("./db", async original => ({
  ...(await original<object>()),
  getLatestUserSubscription: async () => ({ status: "active", currentPeriodEnd: new Date(Date.now() + 86400000) }),
  getCurrentAssessment: async () => null,
  getWeeklyActivityAnalysis: async () => ({}),
  getDailyHistory: async () => [],
  getAssessmentHistory: async () => [],
  getBodyAnalysisHistory: async () => [],
  getWorkoutPlans: async () => [],
  getRecentTrainingContext: async () => [],
}));
import { appRouter } from "./routers";
import { ENV } from "./_core/env";
import type { TrpcContext } from "./_core/context";
const caller = appRouter.createCaller({ user: { id: 42 }, req: { headers: {} }, res: {} } as TrpcContext);
const input = { objective: "Força", focusGroup: "Peito", durationMinutes: 45, availabilityDays: 7, language: "pt" as const };
const draft = { name: "Treino", objective: "Força", focusGroup: "Peito", durationMinutes: 45, notes: null, exercises: [{ exerciseId: "A01", sets: 3, reps: "10", loadKg: null, restSeconds: 90, note: null }] };
const originalKey = ENV.geminiApiKey;
beforeEach(() => { vi.clearAllMocks(); ENV.geminiApiKey = "test-key"; state.reserve.mockResolvedValue(state.release); state.release.mockResolvedValue(undefined); });
afterEach(() => { ENV.geminiApiKey = originalKey; });
describe("weekly AI draft consumption", () => {
  it("retains the week when a valid editable draft is returned, before saving", async () => {
    state.llm.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(draft) } }] });
    expect(await caller.workouts.generateWithAI(input)).toEqual(draft);
    expect(state.reserve).toHaveBeenCalledWith(42);
    expect(state.release).not.toHaveBeenCalled();
  });
  it.each(["not JSON", "{}", JSON.stringify({ ...draft, exercises: [] }), JSON.stringify({ ...draft, exercises: [{ ...draft.exercises[0], exerciseId: "invented" }] })])("releases the week after an invalid provider draft: %s", async content => {
    state.llm.mockResolvedValue({ choices: [{ message: { content } }] });
    await expect(caller.workouts.generateWithAI(input)).rejects.toMatchObject({ code: "BAD_GATEWAY" });
    expect(state.release).toHaveBeenCalledOnce();
  });
  it("releases the week after provider or transport failures", async () => {
    state.llm.mockRejectedValue(new Error("provider failed"));
    await expect(caller.workouts.generateWithAI(input)).rejects.toThrow("provider failed");
    expect(state.release).toHaveBeenCalledOnce();
  });
  it("does not call the provider when another successful draft already owns the week", async () => {
    state.reserve.mockRejectedValue(new Error("week reserved"));
    await expect(caller.workouts.generateWithAI(input)).rejects.toThrow("week reserved");
    expect(state.llm).not.toHaveBeenCalled();
  });
  it.each([0, 8])("rejects availability outside 1–7 (%s) without reservation", async availabilityDays => {
    await expect(caller.workouts.generateWithAI({ ...input, availabilityDays })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(state.reserve).not.toHaveBeenCalled();
  });
});
