import { wearableState } from "../shared/wearable-status";
import { describe, expect, it } from "vitest";
import {
  assertPhotoOwner,
  assertToday,
  confirmedSetSchema,
  validateSet,
} from "./fitness";
import {
  dateSchema,
  realToday,
  nextSuggested,
  originalSnapshot,
  originalIds,
  trainingMetrics,
  measurementSchema,
  wellnessDataSchema,
} from "../shared/fitness";
import { defaultWorkoutTemplates } from "../shared/workouts";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const set = {
  sessionId: "12345678-1234-4234-8234-123456789abc",
  exerciseIndex: 0,
  setIndex: 0,
  reps: 10,
  seconds: null,
  loadKg: 20,
  note: "",
  confirmed: true as const,
};
describe("fitness domain rules", () => {
  it("uses Lisbon summer midnight rather than UTC date", () => {
    expect(realToday(new Date("2026-09-29T23:05:00Z"))).toBe("2026-09-30");
    expect(() =>
      assertToday("2026-09-29", new Date("2026-09-29T23:05:00Z"))
    ).toThrow();
  });
  it("uses Lisbon winter date without artificial summer offset", () => {
    expect(realToday(new Date("2026-12-29T23:05:00Z"))).toBe("2026-12-29");
    expect(() =>
      assertToday("2026-12-30", new Date("2026-12-29T23:05:00Z"))
    ).toThrow();
  });
  it("handles DST transitions", () => {
    expect(realToday(new Date("2026-03-29T23:30:00Z"))).toBe("2026-03-30");
    expect(realToday(new Date("2026-10-25T23:30:00Z"))).toBe("2026-10-25");
  });
  it("rejects invalid calendar dates", () => {
    expect(dateSchema.safeParse("2026-02-30").success).toBe(false);
    expect(dateSchema.safeParse("2024-02-29").success).toBe(true);
  });
  it("cycles four suggestions independently of weekdays", () => {
    expect([null, "A", "B", "C", "D"].map(nextSuggested)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "A",
    ]);
  });
  it("preserves every original exercise and prescription including timed planks", () => {
    for (const id of originalIds) {
      expect(originalSnapshot(id).exercises.map(e => e.exerciseId)).toEqual(
        defaultWorkoutTemplates[id].exercises
      );
    }
    expect(originalSnapshot("C").exercises[6].sets).toBe(4);
    expect(originalSnapshot("C").exercises[7].reps).toContain("s");
  });
  it("requires explicit confirmation", () => {
    expect(
      confirmedSetSchema.safeParse({ ...set, confirmed: false }).success
    ).toBe(false);
    expect(
      confirmedSetSchema.safeParse({ ...set, confirmed: undefined }).success
    ).toBe(false);
  });
  it("rejects zero, negative and excessive values", () => {
    for (const patch of [
      { reps: 0 },
      { loadKg: -1 },
      { loadKg: 501 },
      { setIndex: 10 },
      { exerciseIndex: -1 },
    ])
      expect(confirmedSetSchema.safeParse({ ...set, ...patch }).success).toBe(
        false
      );
  });
  it("validates snapshot set and exercise boundaries", () => {
    expect(() =>
      validateSet(JSON.stringify(originalSnapshot("A")), {
        ...set,
        setIndex: 3,
      })
    ).toThrow();
    expect(() =>
      validateSet(JSON.stringify(originalSnapshot("A")), {
        ...set,
        exerciseIndex: 9,
      })
    ).toThrow();
  });
  it("requires reps for rep exercises and seconds for timed exercises", () => {
    expect(() =>
      validateSet(JSON.stringify(originalSnapshot("A")), {
        ...set,
        reps: null,
        seconds: 30,
      })
    ).toThrow();
    expect(() =>
      validateSet(JSON.stringify(originalSnapshot("C")), {
        ...set,
        exerciseIndex: 7,
      })
    ).toThrow();
    expect(
      validateSet(JSON.stringify(originalSnapshot("C")), {
        ...set,
        exerciseIndex: 7,
        reps: null,
        seconds: 30,
      }).exerciseId
    ).toBe("C08");
  });
  it("does not invent volume when load is absent", () => {
    expect(
      trainingMetrics([{ reps: 10, seconds: null, loadKg: null }])
    ).toMatchObject({ repetitions: 10, volumeKg: null, volumeComplete: false });
    expect(trainingMetrics([])).toMatchObject({
      volumeKg: null,
      repetitions: null,
      timedSeconds: null,
    });
  });
  it("separates timed work and marks partial known volume", () => {
    expect(
      trainingMetrics([
        { reps: 10, seconds: null, loadKg: 20 },
        { reps: 8, seconds: null, loadKg: null },
        { reps: null, seconds: 35, loadKg: null },
      ])
    ).toEqual({
      confirmedSets: 3,
      repetitions: 18,
      volumeKg: 200,
      volumeComplete: false,
      timedSeconds: 35,
    });
  });
  it("keeps private photo ownership and rejects path traversal", () => {
    const key = "fitness/42/12345678-1234-4234-8234-123456789abc_ab12cd34.jpg";
    expect(() => assertPhotoOwner(key, 42)).not.toThrow();
    for (const candidate of [
      key,
      "fitness/43/../42/abc_ab12cd34.jpg",
      "/fitness/43/abc_ab12cd34.jpg",
      "fitness/43/abc_ab12cd34.svg",
      "fitness/43/%2e%2e/abc_ab12cd34.jpg",
    ])
      expect(() => assertPhotoOwner(candidate, 43)).toThrow();
  });
  it("requires at least one measured body metric", () => {
    expect(
      measurementSchema.safeParse({
        heightCm: null,
        weightKg: null,
        bodyFatPercent: null,
        waistCm: null,
        chestCm: null,
        hipCm: null,
        note: "",
      }).success
    ).toBe(false);
  });
  it("validates meal time and preserves unknown cardio distance", () => {
    expect(
      wellnessDataSchema.safeParse({
        kind: "meal",
        meal: "Lunch",
        food: "Rice",
        time: "25:00",
      }).success
    ).toBe(false);
    expect(
      wellnessDataSchema.parse({
        kind: "cardio",
        modality: "Run",
        durationMinutes: 30,
      })
    ).toMatchObject({ distanceKm: null });
  });
  it("distinguishes all wearable availability states without simulated connections", () => {
    expect(wearableState("apple_health")).toBe("integration_unavailable");
    expect(wearableState("coros")).toBe("disconnected");
    expect(
      wearableState("coros", {
        status: "authorization_required",
        lastSyncStatus: "never_synced",
      })
    ).toBe("authorization_required");
    expect(
      wearableState("coros", { status: "connected", lastSyncStatus: "error" })
    ).toBe("error");
    expect(
      wearableState(
        "coros",
        { status: "connected", lastSyncStatus: "synced" },
        false
      )
    ).toBe("no_data");
    expect(
      wearableState(
        "coros",
        { status: "connected", lastSyncStatus: "synced" },
        true
      )
    ).toBe("connected");
  });
  it("keeps the pre-existing optional fifth day paused even through direct API calls", async () => {
    const caller = appRouter.createCaller({
      user: { id: 42, role: "user" },
      req: { headers: {} },
      res: {},
    } as TrpcContext);
    await expect(
      caller.progress.analyzeDay5({
        from: "2026-09-28",
        to: "2026-10-04",
        weekStart: "2026-09-28",
        language: "pt",
      })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(
      caller.workouts.create({
        name: "Optional",
        objective: "Strength",
        focusGroup: "Chest",
        durationMinutes: 30,
        source: "day5",
        exercises: originalSnapshot("A").exercises,
      })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
  it("rejects unauthenticated access to all private fitness domains", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    });
    for (const query of [
      () => caller.fitness.overview(),
      () => caller.fitness.coachHistory(),
      () => caller.fitness.session({ sessionId: set.sessionId }),
      () => caller.fitness.photo({ key: "fitness/42/abc_ab12cd34.jpg" }),
    ])
      await expect(query()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
