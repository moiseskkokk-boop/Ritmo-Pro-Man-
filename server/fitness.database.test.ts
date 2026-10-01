import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
const state = vi.hoisted(() => ({ database: undefined as any, llm: vi.fn(), put: vi.fn(), remove: vi.fn() }));
vi.mock("drizzle-orm/node-postgres", () => ({ drizzle: () => state.database }));
vi.mock("./_core/llm", () => ({ invokeLLM: state.llm }));
vi.mock("./storage", () => ({ storagePut: state.put, storageRemove: state.remove, storageGetSignedUrl: vi.fn(async key => `https://private.test/${key}`) }));
import { appRouter } from "./routers";
import { reserveWorkoutWeek } from "./workout-ai-limit";
import { trainingSessions, trainingSets, userSubscriptions, workoutAiWeeks, bodyAnalyses } from "../drizzle/schema";
import { realToday, originalSnapshot, preferencesSchema } from "../shared/fitness";
import { ENV } from "./_core/env";
import type { TrpcContext } from "./_core/context";

const ctx = (id: number) => ({ user: { id, name: "Test", role: "user" }, req: { headers: {}, protocol: "https" }, res: {} }) as TrpcContext;
const a = () => appRouter.createCaller(ctx(42));
const b = () => appRouter.createCaller(ctx(43));
const today = realToday();
const yesterday = new Date(`${today}T12:00:00Z`); yesterday.setUTCDate(yesterday.getUTCDate() - 1);
const past = yesterday.toISOString().slice(0, 10);
const jpeg = Buffer.alloc(20); jpeg[0] = 255; jpeg[1] = 216; jpeg[18] = 255; jpeg[19] = 217;
const photo = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
const metrics = { activityDate: null, activityType: null, durationMinutes: 20, activeCaloriesKcal: null, totalCaloriesKcal: null, averageHeartRate: 120, maxHeartRate: null, distanceKm: null, steps: null, pace: null, speedKmh: null, heartRateZones: [], otherMetrics: [], confidence: "medium" as const };
const bodyResult = { bodyFatEstimatePercent: null, confidencePercent: 20, observations: "Não há evidência suficiente para uma estimativa visual confiável.", performanceAlignment: "O desempenho deve ser avaliado pelas séries e cargas registradas.", trainingConsiderations: [], nutritionHydrationReview: "Os dados fornecidos não sustentam conclusões sobre nutrição ou hidratação.", dataLimitations: ["Estimativa visual não é diagnóstico."] };
const answer = (value: unknown) => ({ choices: [{ message: { content: typeof value === "string" ? value : JSON.stringify(value) } }] });
let pg: PGlite;
const originalUrl = process.env.DATABASE_URL;
const originalKey = ENV.geminiApiKey;
beforeAll(async () => {
  process.env.DATABASE_URL = "postgresql://localhost/isolated_test";
  ENV.geminiApiKey = "test-only";
  pg = new PGlite(); state.database = drizzle(pg);
  await pg.exec(readFileSync("drizzle-pg/0000_pg_initial.sql", "utf8"));
  // Apply migration over an existing session to verify data preservation.
  await pg.query(`INSERT INTO training_sessions (id,"userId","activityDate","snapshotJson") VALUES ($1,99,$2,$3)`, ["12345678-1234-4234-8234-123456789abc", today, JSON.stringify(originalSnapshot("A"))]);
  await pg.exec(readFileSync("drizzle-pg/0001_sessions_ai_week.sql", "utf8"));
  await pg.exec(readFileSync("drizzle-pg/0002_session_water_cardio.sql", "utf8"));
  await pg.exec(readFileSync("drizzle-pg/0004_experience_parity.sql", "utf8"));
  expect((await pg.query(`SELECT * FROM training_sessions WHERE "userId"=99`)).rows).toMatchObject([{ experience: "man", completedExercisesJson: "[]" }]);
}, 30000);
afterAll(async () => { await pg.close(); process.env.DATABASE_URL = originalUrl; ENV.geminiApiKey = originalKey; });
beforeEach(async () => {
  vi.clearAllMocks();
  await pg.exec(`TRUNCATE training_sessions, training_sets, fitness_revisions, fitness_preferences, auth_rate_limits, workout_plans, workout_ai_weeks, body_analyses, user_subscriptions`);
  await state.database.insert(userSubscriptions).values({ userId: 42, planCode: "test", status: "active", externalReference: "test-42", amount: "1", currency: "EUR", currentPeriodEnd: new Date(Date.now() + 86400000) });
  state.put.mockImplementation(async (key: string) => ({ key: key.replace(/\.(jpg|png|webp)$/, "_ab12cd34.$1") }));
});
async function start(id: "A" | "B" = "A") { return a().fitness.start({ activityDate: today, originalId: id }); }
async function confirm(sessionId: string, reps = 10) {
  const session = await a().fitness.session({ sessionId });
  if (session?.status !== "completed") for (let exerciseIndex = 0; session?.status === "in_progress" && exerciseIndex < session!.snapshot.exercises.length; exerciseIndex++) await a().fitness.markExercise({ sessionId, exerciseIndex, done: true });
  return a().fitness.confirmSet({ sessionId, exerciseIndex: 0, setIndex: 0, reps, seconds: null, loadKg: 25, note: "série real", confirmed: true }); }

const woman = () => appRouter.createCaller({ ...ctx(42), user: { ...ctx(42).user!, experience: "woman" } });
const planInput = { name: "Plano Woman", objective: "Força", focusGroup: "Glúteos", durationMinutes: 45, notes: null, exercises: originalSnapshot("A", "woman").exercises, source: "manual" as const };

describe("Woman parity and experience isolation", () => {
  it("imports old local Woman records only on explicit request, once per account, without deleting existing sessions", async () => {
    const existing = await woman().fitness.start({ activityDate: today, originalId: "B" });
    const records = [{ activityDate: past, originalId: "A" as const, waterLiters: "2", cardioMinutes: 25, cardioType: "Bicicleta", savedAt: new Date(`${past}T18:00:00Z`).toISOString() }];
    await expect(a().fitness.importLegacyWoman({ records })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await woman().fitness.importLegacyWoman({ records });
    await woman().fitness.importLegacyWoman({ records });
    const sessions = (await woman().fitness.overview()).sessions;
    expect(sessions).toHaveLength(2);
    expect(sessions.some(s => s.id === existing.id)).toBe(true);
    expect(sessions.find(s => s.activityDate === past)).toMatchObject({ status: "completed", waterLiters: "2", cardioMinutes: 25, sets: [], note: expect.stringContaining("Bicicleta") });
    expect((await a().fitness.overview()).sessions).toEqual([]);
  });
  it("preserves preexisting Man data when applying the additive migration", async () => {
    expect((await pg.query(`SELECT column_default FROM information_schema.columns WHERE table_name='training_sessions' AND column_name='experience'`)).rows[0]).toMatchObject({ column_default: "'man'::character varying" });
  });
  it("supports independent suggested workouts, persisted circles and explicit final save without fabricated sets", async () => {
    const manSession = await start("B");
    const session = await woman().fitness.start({ activityDate: today, originalId: "A" });
    expect(session.experience).toBe("woman");
    expect(JSON.parse(session.snapshotJson)).toEqual(originalSnapshot("A", "woman"));
    await expect(woman().fitness.finish({ sessionId: session.id, confirmed: true })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    for (let exerciseIndex = 0; exerciseIndex < 7; exerciseIndex++) await woman().fitness.markExercise({ sessionId: session.id, exerciseIndex, done: true });
    expect((await woman().fitness.session({ sessionId: session.id }))?.status).toBe("in_progress");
    await woman().fitness.markExercise({ sessionId: session.id, exerciseIndex: 0, done: false });
    await expect(woman().fitness.finish({ sessionId: session.id, confirmed: true })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await woman().fitness.markExercise({ sessionId: session.id, exerciseIndex: 0, done: true });
    await woman().fitness.finish({ sessionId: session.id, confirmed: true, waterLiters: "2.4", cardioMinutes: 20 });
    const saved = await woman().fitness.session({ sessionId: session.id });
    expect(saved).toMatchObject({ status: "completed", waterLiters: "2.4", cardioMinutes: 20, sets: [], metrics: { volumeKg: null, repetitions: null } });
    expect(JSON.parse(saved!.completedExercisesJson)).toHaveLength(7);
    expect((await woman().fitness.overview()).sessions.map(s => s.id)).toEqual([session.id]);
    expect((await a().fitness.overview()).sessions.map(s => s.id)).toEqual([manSession.id]);
    expect((await woman().fitness.overview()).nextSuggested).toBe("B");
    expect((await a().fitness.overview()).nextSuggested).toBe("A");
    expect(await a().fitness.session({ sessionId: session.id })).toBeNull();
    await expect(a().fitness.markExercise({ sessionId: session.id, exerciseIndex: 0, done: true })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(a().fitness.finish({ sessionId: session.id, confirmed: true })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const weekStart = (await woman().progress.today()).weekStart;
    expect(await woman().progress.weeklyActivityAnalysis({ from: weekStart, to: today, weekStart })).toMatchObject({ workoutsCompleted: 1 });
    expect(await a().progress.weeklyActivityAnalysis({ from: weekStart, to: today, weekStart })).toMatchObject({ workoutsCompleted: 0 });
  });
  it("supports Woman library CRUD/reorder without exposing or mutating plans across experiences", async () => {
    const plan = await woman().workouts.create(planInput);
    expect((await woman().workouts.list()).map(p => p.id)).toEqual([plan.id]);
    expect(await a().workouts.list()).toEqual([]);
    await expect(a().fitness.start({ activityDate: today, planId: plan.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(a().workouts.remove({ id: plan.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(a().workouts.update({ ...planInput, exercises: originalSnapshot("A").exercises, id: plan.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const exercises = [...plan.exercises].reverse();
    expect((await woman().workouts.update({ ...planInput, name: "Editado", id: plan.id, exercises })).exercises).toEqual(exercises);
    const session = await woman().fitness.start({ activityDate: today, planId: plan.id });
    expect(JSON.parse(session.snapshotJson).exercises).toEqual(exercises);
    await woman().workouts.remove({ id: plan.id });
    expect(await woman().workouts.list()).toEqual([]);
    expect(await woman().fitness.session({ sessionId: session.id })).not.toBeNull();
    await expect(woman().workouts.create({ ...planInput, exercises: originalSnapshot("A").exercises })).rejects.toThrow("Exercício não pertence");
    await expect(a().workouts.create(planInput)).rejects.toThrow("Exercício não pertence");
  });
  it("requires circles even with recorded sets, validates indices and prevents edits after final save", async () => {
    const session = await start();
    await a().fitness.confirmSet({ sessionId: session.id, exerciseIndex: 0, setIndex: 0, reps: 10, seconds: null, loadKg: 25, note: "", confirmed: true });
    await expect(a().fitness.finish({ sessionId: session.id, confirmed: true })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(a().fitness.markExercise({ sessionId: session.id, exerciseIndex: 19, done: true })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await confirm(session.id);
    await a().fitness.finish({ sessionId: session.id, confirmed: true });
    await expect(a().fitness.markExercise({ sessionId: session.id, exerciseIndex: 0, done: false })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("uses Woman sessions and catalog in AI drafts, rejects cross-experience responses and summarizes actual completion", async () => {
    await start();
    const session = await woman().fitness.start({ activityDate: today, originalId: "B" });
    for (let exerciseIndex = 0; exerciseIndex < 6; exerciseIndex++) await woman().fitness.markExercise({ sessionId: session.id, exerciseIndex, done: true });
    await woman().fitness.finish({ sessionId: session.id, confirmed: true });
    const input = { objective: "Força", focusGroup: "Glúteos", durationMinutes: 45, availabilityDays: 4, language: "pt" as const };
    state.llm.mockResolvedValue(answer({ ...planInput, exercises: originalSnapshot("A").exercises }));
    await expect(woman().workouts.generateWithAI(input)).rejects.toMatchObject({ code: "BAD_GATEWAY" });
    state.llm.mockResolvedValue(answer(planInput));
    expect((await woman().workouts.generateWithAI(input)).exercises).toEqual(planInput.exercises);
    const payload = JSON.parse(state.llm.mock.calls[1][0].messages[1].content);
    expect(payload.exerciseCatalog.every((e: { id: string }) => e.id.startsWith("W"))).toBe(true);
    expect(payload.data.recentTrainingSessions).toHaveLength(1);
    expect(payload.data.recentTrainingSessions[0].completedExercises).toHaveLength(6);
    state.llm.mockResolvedValue(answer("Sessão Woman concluída."));
    await woman().fitness.summarize({ sessionId: session.id });
    await expect(a().fitness.summarize({ sessionId: session.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(a().progress.confirmSmartwatchPhoto({ sessionId: session.id, modality: "Treino", kind: "workout", dataUrl: photo, result: metrics })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await woman().progress.confirmSmartwatchPhoto({ sessionId: session.id, modality: "Treino", kind: "workout", dataUrl: photo, result: metrics });
    expect((await woman().fitness.session({ sessionId: session.id }))?.smartwatch.workout.metrics.averageHeartRate).toBe(120);
  });

  it("uses the shared four-photo assessment and coach with Woman context", async () => {
    state.llm.mockResolvedValue(answer(bodyResult));
    await woman().progress.analyzeBody({ language: "pt", photos: { front: photo, left: photo, back: photo, right: photo } });
    expect(Object.keys((await woman().progress.bodyAnalysisHistory())[0].photos)).toHaveLength(4);
    const session = await woman().fitness.start({ activityDate: today, originalId: "A" });
    await woman().fitness.markExercise({ sessionId: session.id, exerciseIndex: 0, done: true });
    state.llm.mockResolvedValue(answer("Continue no seu ritmo."));
    await woman().fitness.askCoach({ question: "Como evoluir meu treino?", language: "pt", contextAuthorized: true });
    const payload = JSON.parse(state.llm.mock.calls[1][0].messages[1].content);
    expect(payload.experience).toBe("woman");
    expect(payload.context.training[0].completedExercises).toEqual([0]);
    expect((await woman().fitness.coachHistory())[0].answer).toBe("Continue no seu ritmo.");
  });

});

describe("fitness on isolated PostgreSQL (PGlite)", () => {
  it("starts and completes independent same-date sessions, queries by ID and keeps all in overview", async () => {
    const first = await start(); await confirm(first.id); await a().fitness.finish({ sessionId: first.id, note: "Bom treino", waterLiters: "2.5", cardioMinutes: 27, confirmed: true });
    const second = await start("B"); await confirm(second.id, 12); await a().fitness.finish({ sessionId: second.id, note: "Outra sessão", confirmed: true });
    expect(first.id).not.toBe(second.id);
    await a().fitness.preferences({ workoutsPerWeek: 7 });
    const weekStart = (await a().progress.today()).weekStart;
    expect(await a().progress.weeklyActivityAnalysis({ from: weekStart, to: today, weekStart })).toMatchObject({ workoutsCompleted: 2, workoutsTarget: 7 });
    const overview = await a().fitness.overview();
    expect(overview.sessions.map(s => s.id)).toEqual(expect.arrayContaining([first.id, second.id]));
    expect(await a().fitness.session({ sessionId: first.id })).toMatchObject({ waterLiters: "2.5", cardioMinutes: 27 });
    expect((await a().fitness.session({ sessionId: first.id }))?.sets[0].reps).toBe(10);
    expect((await a().fitness.session({ sessionId: second.id }))?.sets[0].reps).toBe(12);
    expect(await b().fitness.session({ sessionId: first.id })).toBeNull();
  });
  it("corrects a historical completed session in place with revisions, sets, load and notes intact", async () => {
    const row = await start(); await confirm(row.id); await a().fitness.finish({ sessionId: row.id, note: "original", confirmed: true });
    await state.database.update(trainingSessions).set({ activityDate: past }).where(eq(trainingSessions.id, row.id));
    await confirm(row.id, 11); await a().fitness.finish({ sessionId: row.id, note: "corrigida", confirmed: true });
    const saved = await a().fitness.session({ sessionId: row.id });
    expect(saved).toMatchObject({ id: row.id, status: "completed", note: "corrigida", activityDate: past });
    expect(saved?.sets[0]).toMatchObject({ reps: 11, loadKg: 25, note: "série real" });
    expect((await state.database.select().from(trainingSessions))).toHaveLength(1);
    await a().fitness.retractSet({ sessionId: row.id, exerciseIndex: 0, setIndex: 0, confirmed: true });
    expect((await a().fitness.session({ sessionId: row.id }))?.sets).toHaveLength(0);
  });
  it("blocks recording old unfinished sessions and starting on any other date", async () => {
    await expect(a().fitness.start({ activityDate: past, originalId: "A" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const row = await start(); await state.database.update(trainingSessions).set({ activityDate: past }).where(eq(trainingSessions.id, row.id));
    await expect(confirm(row.id)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(b().fitness.finish({ sessionId: row.id, note: "", confirmed: true })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("accepts 1..7 workouts/week, defaults to 4 and reducing does not delete sessions", async () => {
    expect(preferencesSchema.parse({}).workoutsPerWeek).toBe(4);
    await start(); await a().fitness.preferences({ workoutsPerWeek: 7 }); await a().fitness.preferences({ workoutsPerWeek: 1 });
    const overview = await a().fitness.overview(); expect(overview.preferences.workoutsPerWeek).toBe(1); expect(overview.sessions).toHaveLength(1);
    await expect(a().fitness.preferences({ workoutsPerWeek: 8 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("stores private photo reference, confirmed corrected metrics and modality on the same session; preserves missing values", async () => {
    const first = await start(); const second = await start("B");
    state.llm.mockResolvedValue(answer(metrics));
    expect(await a().progress.analyzeSmartwatchPhoto({ sessionId: first.id, modality: "Esteira", dataUrl: photo, language: "pt" })).toEqual(metrics);
    await a().progress.confirmSmartwatchPhoto({ sessionId: first.id, modality: "Bicicleta", dataUrl: photo, result: { ...metrics, averageHeartRate: 115 } });
    const rows = (await a().fitness.overview()).sessions;
    const saved = rows.find(s => s.id === first.id)!;
    expect(saved.smartwatch).toMatchObject({ cardio: { modality: "Bicicleta", metrics: { averageHeartRate: 115, distanceKm: null } }, workout: null });
    expect(saved.smartwatch?.cardio?.photoKey).toMatch(/^fitness\/42\//);
    await expect(a().fitness.photo({ key: saved.smartwatch!.cardio!.photoKey })).resolves.toMatchObject({ url: expect.stringContaining(saved.smartwatch!.cardio!.photoKey) });
    expect(saved.smartwatchJson).not.toContain("base64");
    await expect(a().fitness.photo({ key: saved.smartwatch!.cardio!.photoKey })).resolves.toHaveProperty("url");
    await expect(b().fitness.photo({ key: saved.smartwatch!.cardio!.photoKey })).rejects.toMatchObject({ code: "FORBIDDEN" });
    state.put.mockClear();
    await a().progress.confirmSmartwatchPhoto({ sessionId: first.id, modality: "Corrida livre", photoKey: saved.smartwatch!.cardio!.photoKey, result: { ...metrics, averageHeartRate: 110 } });
    expect(state.put).not.toHaveBeenCalled();
    expect((await a().fitness.overview()).sessions.find(s => s.id === first.id)?.smartwatch).toMatchObject({ cardio: { modality: "Corrida livre", metrics: { averageHeartRate: 110 } } });
    await expect(a().progress.confirmSmartwatchPhoto({ sessionId: second.id, modality: "Esteira", photoKey: saved.smartwatch!.cardio!.photoKey, result: metrics })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(rows.find(s => s.id === second.id)?.smartwatch).toBeNull();
    await expect(b().progress.confirmSmartwatchPhoto({ sessionId: first.id, modality: "Esteira", dataUrl: photo, result: metrics })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("finishes with no smartwatch and generates summary from actual exercises, note and confirmed metrics", async () => {
    const row = await start(); await confirm(row.id); await a().fitness.finish({ sessionId: row.id, note: "Boa força hoje", confirmed: true });
    state.llm.mockResolvedValue(answer("Resumo da sessão registrada."));
    await a().fitness.summarize({ sessionId: row.id });
    const payload = JSON.parse(state.llm.mock.calls[0][0].messages[1].content);
    expect(payload).toMatchObject({ note: "Boa força hoje", smartwatch: null }); expect(payload.sets[0].reps).toBe(10); expect(payload.workout.exercises[0].exerciseId).toBe("A01");
    expect((await a().fitness.overview()).sessions[0].summary).toBe("Resumo da sessão registrada.");
    await confirm(row.id, 12); expect((await a().fitness.overview()).sessions[0].summary).toBeNull();
  });
});

describe("AI workout weekly limit", () => {
  it("atomically permits only one concurrent reservation per account and Lisbon ISO week", async () => {
    const now = new Date("2026-09-27T23:30:00Z"); // Monday in Lisbon
    const results = await Promise.allSettled([reserveWorkoutWeek(42, now), reserveWorkoutWeek(42, now)]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find(r => r.status === "rejected")).toMatchObject({ reason: { code: "TOO_MANY_REQUESTS" } });
    expect((await state.database.select().from(workoutAiWeeks))[0].weekStart).toBe("2026-09-28");
    await reserveWorkoutWeek(43, now); await reserveWorkoutWeek(42, new Date("2026-10-04T23:30:00Z"));
    expect(await state.database.select().from(workoutAiWeeks)).toHaveLength(3);
  });
  it("releases only its own reservation, including after a replacement succeeds", async () => {
    const now = new Date("2026-09-28T12:00:00Z");
    const release = await reserveWorkoutWeek(42, now);
    await release();
    await reserveWorkoutWeek(42, now);
    await release();
    expect(await state.database.select().from(workoutAiWeeks)).toHaveLength(1);
    await expect(reserveWorkoutWeek(42, now)).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });
  it("supplies actual sessions and confirmed watch metrics to the AI draft without private photo keys", async () => {
    const row = await start(); await confirm(row.id, 14);
    await a().progress.confirmSmartwatchPhoto({ sessionId: row.id, modality: "Corrida livre", dataUrl: photo, result: metrics });
    const draft = { name: "Treino IA", objective: "Força", focusGroup: "Peito", durationMinutes: 45, notes: "", exercises: originalSnapshot("A").exercises };
    state.llm.mockResolvedValue(answer(draft));
    await a().workouts.generateWithAI({ objective: "Força", focusGroup: "Peito", durationMinutes: 45, availabilityDays: 7, language: "pt" });
    const payload = JSON.parse(state.llm.mock.calls[0][0].messages[1].content);
    expect(payload.data.recentTrainingSessions[0].sets[0].reps).toBe(14);
    expect(payload.data.recentTrainingSessions[0].smartwatch).toMatchObject({ cardio: { modality: "Corrida livre", metrics: { averageHeartRate: 120 } }, workout: null });
    expect(JSON.stringify(payload.data.recentTrainingSessions)).not.toContain("photoKey");
  });
  it("base sessions and manual/customized plans do not consume quota; server blocks the second generation even without saving a draft", async () => {
    const draft = { name: "Treino IA", objective: "Força", focusGroup: "Peito", durationMinutes: 45, notes: "", exercises: originalSnapshot("A").exercises };
    await start(); await a().workouts.create({ ...draft, source: "manual" }); await a().workouts.create({ ...draft, source: "customized", baseWorkoutId: "A" });
    state.llm.mockResolvedValue(answer(draft));
    await a().workouts.generateWithAI({ objective: "Força", focusGroup: "Peito", durationMinutes: 45, availabilityDays: 7, language: "pt" });
    await expect(a().workouts.generateWithAI({ objective: "Força", focusGroup: "Peito", durationMinutes: 45, availabilityDays: 1, language: "pt" })).rejects.toThrow("já utilizou");
    expect(state.llm).toHaveBeenCalledTimes(1);
  });
  it("failed provider requests release the generation reservation and preserve the original error", async () => {
    state.llm.mockRejectedValueOnce(new Error("provider failure"));
    const input = { objective: "Força", focusGroup: "Peito", durationMinutes: 45, availabilityDays: 1, language: "pt" as const };
    await expect(a().workouts.generateWithAI(input)).rejects.toThrow("provider failure");
    expect(await state.database.select().from(workoutAiWeeks)).toHaveLength(0);
  });
});

describe("four-photo monthly body assessment", () => {
  it("sends four identified images to Gemini and stores all four views; old history remains readable", async () => {
    state.llm.mockResolvedValue(answer(bodyResult));
    await a().progress.analyzeBody({ language: "pt", photos: { front: photo, left: photo, back: photo, right: photo } });
    const images = state.llm.mock.calls[0][0].messages[1].content.filter((c: any) => c.type === "image_url"); expect(images).toHaveLength(4);
    const [saved] = await state.database.select().from(bodyAnalyses); expect(Object.keys(JSON.parse(saved.photoKeys)).sort()).toEqual(["back", "front", "left", "right"]);
    await state.database.insert(bodyAnalyses).values({ userId: 42, analysisMonth: "2026-01", photoKeys: JSON.stringify({ front: "old/front", back: "old/back", right: "old/right", left: "old/left" }), confidencePercent: 20, analysisJson: JSON.stringify(bodyResult) });
    expect(Object.keys((await a().progress.bodyAnalysisHistory()).find(r => r.analysisMonth === "2026-01")!.photos)).toHaveLength(4);
    await expect(a().progress.analyzeBody({ language: "pt", photos: {} } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("replaces the monthly image using a fresh key so cleanup cannot delete the replacement", async () => {
    state.llm.mockResolvedValue(answer(bodyResult));
    const photos = { front: photo, left: photo, back: photo, right: photo };
    await a().progress.analyzeBody({ language: "pt", photos }); const [first] = await state.database.select().from(bodyAnalyses);
    await a().progress.analyzeBody({ language: "pt", photos }); const [second] = await state.database.select().from(bodyAnalyses);
    const oldKey = JSON.parse(first.photoKeys).front; const newKey = JSON.parse(second.photoKeys).front;
    expect(oldKey).not.toBe(newKey); expect(state.remove).toHaveBeenCalledWith(oldKey); expect(state.remove).not.toHaveBeenCalledWith(newKey);
  });
});
