import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  getWorkoutPlans: vi.fn(),
  createWorkoutPlan: vi.fn(),
  updateWorkoutPlan: vi.fn(),
  deleteWorkoutPlan: vi.fn(),
}));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, ...dbMocks };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const user = {
  id: 42, openId: "account-42", passwordHash: null, sessionVersion: 0, name: "Ritmo User", email: "user@example.com",
  loginMethod: "google", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
  termsAcceptedAt: new Date(), privacyAcceptedAt: new Date(), profileImageKey: null, profileImageUrl: null,
};
const planRow = {
  id: 5, userId: 42, source: "manual" as const, baseWorkoutId: null, name: "Treino A", objective: "Força", focusGroup: "Peito",
  durationMinutes: 45, notes: null, exercisesJson: JSON.stringify([{ exerciseId: "A01", sets: 3, reps: "8–12", loadKg: null, restSeconds: 90, note: null }]),
  createdAt: new Date(), updatedAt: new Date(),
};
function callerFor(currentUser: typeof user | null) {
  const ctx: TrpcContext = { user: currentUser, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
  return appRouter.createCaller(ctx);
}

describe("workouts ownership", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the authenticated account as the owner when creating a plan", async () => {
    dbMocks.createWorkoutPlan.mockResolvedValue(planRow);
    const result = await callerFor(user).workouts.create({
      name: "Treino A", objective: "Força", focusGroup: "Peito", durationMinutes: 45, notes: null, source: "manual",
      exercises: [{ exerciseId: "A01", sets: 3, reps: "8–12", loadKg: null, restSeconds: 90, note: null }],
      userId: 900 as never,
    } as never);
    expect(dbMocks.createWorkoutPlan).toHaveBeenCalledWith(expect.objectContaining({ userId: 42 }));
    expect(result).not.toHaveProperty("userId");
  });

  it("scopes listing to the current account and blocks edits to another account's plan", async () => {
    dbMocks.getWorkoutPlans.mockResolvedValue([]);
    await callerFor(user).workouts.list();
    expect(dbMocks.getWorkoutPlans).toHaveBeenCalledWith(42);
    dbMocks.updateWorkoutPlan.mockResolvedValue(undefined);
    await expect(callerFor(user).workouts.update({
      id: 900, name: "Plano alheio", objective: "Força", focusGroup: "Costas", durationMinutes: 45, notes: null,
      exercises: [{ exerciseId: "B01", sets: 3, reps: "8–12", loadKg: null, restSeconds: 90, note: null }],
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(dbMocks.updateWorkoutPlan).toHaveBeenCalledWith(42, 900, expect.any(Object));
  });

  it("requires a validated session for the workout library", async () => {
    await expect(callerFor(null).workouts.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
