import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
vi.setConfig({ testTimeout: 30_000 });
const state = vi.hoisted(() => ({
  database: undefined as unknown,
  llm: vi.fn(),
}));
vi.mock("drizzle-orm/mysql2", async importOriginal => ({
  ...(await importOriginal<object>()),
  drizzle: () => state.database,
}));
vi.mock("./_core/llm", () => ({ invokeLLM: state.llm }));
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { mysqlConnectionOptions } from "./_core/mysql-connection";
import {
  trainingSessions,
  trainingSets,
  wellnessEntries,
  fitnessRevisions,
  bodyMeasurements,
} from "../drizzle/schema";
import { realToday, originalSnapshot } from "../shared/fitness";

// Every table accessed in this suite is shadowed by a connection-local temporary
// table. No real rows are written, and no external AI/storage calls are made.
describe.skipIf(process.env.FITNESS_DATABASE_TESTS !== "1")(
  "fitness with isolated MySQL tables",
  () => {
    let connection: Awaited<ReturnType<typeof mysql.createConnection>>;
    let db: ReturnType<(typeof import("drizzle-orm/mysql2"))["drizzle"]>;
    let sessionId: string;
    const ctx = (id: number | null) =>
      ({
        user:
          id === null
            ? null
            : {
                id,
                name: `Test ${id}`,
                email: `test${id}@example.test`,
                role: "user",
              },
        req: { headers: {}, protocol: "https" },
        res: {},
      }) as TrpcContext;
    const a = () => appRouter.createCaller(ctx(42));
    const b = () => appRouter.createCaller(ctx(43));
    beforeAll(async () => {
      dotenv.config({ quiet: true });
      try {
        connection = await mysql.createConnection({
          ...mysqlConnectionOptions(process.env.DATABASE_URL!),
          connectTimeout: 15_000,
        });
        for (const table of [
          "training_sessions",
          "training_sets",
          "wellness_entries",
          "body_measurements",
          "fitness_preferences",
          "fitness_revisions",
          "coach_turns",
          "auth_rate_limits",
          "workout_plans",
          "weekly_assessments",
          "body_analyses",
          "wearable_connections",
          "wearable_activities",
          "wearable_daily_summaries",
          "daily_logs",
        ]) {
          const [definition] = await connection.query<mysql.RowDataPacket[]>(
            `SHOW CREATE TABLE \`${table}\``
          );
          await connection.query(
            String(definition[0]["Create Table"]).replace(
              /^CREATE TABLE/,
              "CREATE TEMPORARY TABLE"
            )
          );
        }
        const actual =
          await vi.importActual<typeof import("drizzle-orm/mysql2")>(
            "drizzle-orm/mysql2"
          );
        db = actual.drizzle(connection);
        state.database = db;
      } catch (error) {
        throw new Error(
          `Isolated fitness database unavailable (${error && typeof error === "object" && "code" in error ? String(error.code) : "CONFIGURATION_ERROR"})`
        );
      }
    }, 60_000);
    afterAll(async () => {
      await connection?.end();
    });
    it("rejects past and future starts including manipulated frontend dates", async () => {
      for (const activityDate of ["2000-01-01", "2099-01-01"])
        await expect(
          a().fitness.start({ activityDate, originalId: "A" })
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
    it("starts any of the four workouts today and stores no unconfirmed sets", async () => {
      const s = await a().fitness.start({
        activityDate: realToday(),
        originalId: "C",
      });
      sessionId = s.id;
      expect(JSON.parse(s.snapshotJson).originalId).toBe("C");
      expect(await db.select().from(trainingSets)).toHaveLength(0);
    });
    it("repeated concurrent starts reuse the same session", async () => {
      const results = await Promise.all([
        a().fitness.start({ activityDate: realToday(), originalId: "C" }),
        a().fitness.start({ activityDate: realToday(), originalId: "D" }),
      ]);
      expect(results.map(s => s.id)).toEqual([sessionId, sessionId]);
    });
    it("does not finalize a session with no confirmed sets", async () => {
      await expect(
        a().fitness.finish({ sessionId, confirmed: true })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
    it("isolates session reads and writes from another authenticated user", async () => {
      expect(
        await b().fitness.session({ activityDate: realToday() })
      ).toBeNull();
      await expect(
        b().fitness.confirmSet({
          sessionId,
          exerciseIndex: 0,
          setIndex: 0,
          reps: 10,
          seconds: null,
          loadKg: 20,
          confirmed: true,
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        b().fitness.finish({ sessionId, confirmed: true })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
    it("stores only explicit sets and corrects idempotently while preserving earlier data", async () => {
      const input = {
        sessionId,
        exerciseIndex: 0,
        setIndex: 0,
        reps: 10,
        seconds: null,
        loadKg: 20,
        confirmed: true as const,
      };
      await a().fitness.confirmSet(input);
      await a().fitness.confirmSet({ ...input, reps: 12, loadKg: 22 });
      const sets = await db.select().from(trainingSets);
      expect(sets).toHaveLength(1);
      expect(sets[0]).toMatchObject({ reps: 12, loadKg: "22" });
      expect(await db.select().from(fitnessRevisions)).toHaveLength(1);
    });
    it("retracts a mistaken confirmation without deleting the saved set", async () => {
      await a().fitness.retractSet({
        sessionId,
        exerciseIndex: 0,
        setIndex: 0,
        confirmed: true,
      });
      expect(
        (await a().fitness.session({ activityDate: realToday() }))?.sets
      ).toHaveLength(0);
      expect(await db.select().from(trainingSets)).toHaveLength(1);
      await a().fitness.confirmSet({
        sessionId,
        exerciseIndex: 0,
        setIndex: 0,
        reps: 12,
        seconds: null,
        loadKg: 22,
        confirmed: true,
      });
      expect(
        (await a().fitness.session({ activityDate: realToday() }))?.sets
      ).toHaveLength(1);
    });
    it("records seconds separately without inventing repetitions", async () => {
      await a().fitness.confirmSet({
        sessionId,
        exerciseIndex: 7,
        setIndex: 0,
        reps: null,
        seconds: 35,
        loadKg: null,
        confirmed: true,
      });
      const s = await a().fitness.session({ activityDate: realToday() });
      expect(s?.metrics).toMatchObject({
        confirmedSets: 2,
        repetitions: 12,
        volumeKg: 264,
        timedSeconds: 35,
      });
    });
    it("finalizes only confirmed sets and then blocks edits", async () => {
      await a().fitness.finish({
        sessionId,
        note: "Partial session",
        confirmed: true,
      });
      await expect(
        a().fitness.confirmSet({
          sessionId,
          exerciseIndex: 0,
          setIndex: 1,
          reps: 10,
          seconds: null,
          loadKg: 20,
          confirmed: true,
        })
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(
        (await a().fitness.session({ activityDate: realToday() }))?.sets
      ).toHaveLength(2);
    });
    it("revalidates the actual date for existing sessions on write", async () => {
      const old = randomUUID();
      await db.insert(trainingSessions).values({
        id: old,
        userId: 42,
        activityDate: "2000-01-01",
        snapshotJson: JSON.stringify(originalSnapshot("A")),
      });
      await expect(
        a().fitness.confirmSet({
          sessionId: old,
          exerciseIndex: 0,
          setIndex: 0,
          reps: 10,
          seconds: null,
          loadKg: 20,
          confirmed: true,
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(
        a().fitness.finish({ sessionId: old, confirmed: true })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(
        await a().fitness.session({ activityDate: "2000-01-01" })
      ).not.toBeNull();
    });
    it("water corrections preserve previous values and reject stale/foreign revisions", async () => {
      const entry = await a().fitness.saveEntry({
        activityDate: realToday(),
        data: { kind: "water", amountMl: 250 },
      });
      await a().fitness.saveEntry({
        id: entry.id,
        revision: 0,
        activityDate: realToday(),
        data: { kind: "water", amountMl: 500 },
      });
      await expect(
        a().fitness.saveEntry({
          id: entry.id,
          revision: 0,
          activityDate: realToday(),
          data: { kind: "water", amountMl: 300 },
        })
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(
        b().fitness.saveEntry({
          id: entry.id,
          revision: 1,
          activityDate: realToday(),
          data: { kind: "water", amountMl: 300 },
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      const [row] = await db
        .select()
        .from(wellnessEntries)
        .where(eq(wellnessEntries.id, entry.id));
      expect(row.userId).toBe(42);
      expect(JSON.parse(row.dataJson).amountMl).toBe(500);
    });
    it("meal data and manual cardio are user-scoped and do not invent calories", async () => {
      await a().fitness.saveEntry({
        activityDate: realToday(),
        data: {
          kind: "meal",
          meal: "Lunch",
          food: "Rice",
          quantity: "100 g",
          time: "12:00",
          note: "User information",
          photoKey: null,
        },
      });
      await a().fitness.saveEntry({
        activityDate: realToday(),
        data: {
          kind: "cardio",
          modality: "Walk",
          durationMinutes: 30,
          distanceKm: null,
          intensity: "unspecified",
          note: "",
        },
      });
      const o = await a().fitness.overview();
      expect(o.entries).toHaveLength(3);
      expect((await b().fitness.overview()).entries).toHaveLength(0);
      expect(o.nextSuggested).toBe("D");
      expect(o.entries.find(e => e.kind === "cardio")?.data).not.toHaveProperty(
        "caloriesKcal"
      );
    });
    it("body corrections retain originals and block foreign ownership", async () => {
      const data = {
        heightCm: 180,
        weightKg: 80,
        bodyFatPercent: null,
        waistCm: null,
        chestCm: null,
        hipCm: null,
        note: "Measured",
      };
      const m = await a().fitness.saveMeasurement({
        activityDate: realToday(),
        data,
        photoKey: null,
      });
      await expect(
        b().fitness.saveMeasurement({
          id: m.id,
          revision: 0,
          activityDate: realToday(),
          data,
          photoKey: null,
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await a().fitness.saveMeasurement({
        id: m.id,
        revision: 0,
        activityDate: realToday(),
        data: { ...data, weightKg: 79 },
        photoKey: null,
      });
      const [row] = await db.select().from(bodyMeasurements);
      expect(row.revision).toBe(1);
      expect(JSON.parse(row.dataJson).weightKg).toBe(79);
    });
    it("blocks foreign photo keys on meals and body records before storage", async () => {
      await expect(
        a().fitness.saveEntry({
          activityDate: realToday(),
          data: {
            kind: "meal",
            meal: "Lunch",
            food: "Rice",
            quantity: "",
            time: "12:00",
            note: "",
            photoKey: "fitness/43/abc_ab12cd34.jpg",
          },
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it("includes completed training in weekly analysis without counting the same legacy date twice", async () => {
      const date = realToday();
      const week = (await a().progress.today()).weekStart;
      const { dailyLogs } = await import("../drizzle/schema");
      await db
        .insert(dailyLogs)
        .values({
          userId: 42,
          activityDate: date,
          workoutId: "C",
          completedCount: 2,
        });
      const result = await a().progress.weeklyActivityAnalysis({
        from: week,
        to: date,
        weekStart: week,
      });
      expect(result.workoutsCompleted).toBe(1);
    });
    it("coach sends no history without authorization and uses the exact requested model", async () => {
      state.llm.mockResolvedValue({
        choices: [
          { message: { content: "Test response without external request" } },
        ],
      });
      await a().fitness.askCoach({
        question: "How should I track my progress?",
        language: "en",
        contextAuthorized: false,
        mode: "coach",
      });
      const request = state.llm.mock.calls.at(-1)![0];
      expect(request).toMatchObject({
        userId: 42,
        model: "gemini-3.5-flash-lite",
      });
      expect(JSON.parse(request.messages[1].content).context).toBeNull();
    });
    it("authorized context is bounded and excludes secrets, photos and other users", async () => {
      await a().fitness.askCoach({
        question: "Review my confirmed training",
        language: "en",
        contextAuthorized: true,
        mode: "coach",
      });
      const request = state.llm.mock.calls.at(-1)![0];
      const payload = JSON.parse(request.messages[1].content);
      expect(payload.context.training).toHaveLength(1);
      expect(payload.context.training[0].setsSample).toHaveLength(2);
      expect(request.messages[1].content).not.toMatch(
        /passwordHash|tokenPayloadEncrypted|signedURL|photoKey|DATABASE_URL/
      );
      expect(await b().fitness.coachHistory()).toHaveLength(0);
    });
  }
);
