import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { SignJWT } from "jose";
import { getSessionCookieOptions } from "./_core/cookies";
import { createLocalUser, getUserByEmail, setUserLastSignedIn } from "./db";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { clearCurrentAssessment, deleteAllUserData, getAssessmentHistory, getCurrentAssessment, getDailyHistory, getDailyLog, getWeeklyActivityAnalysis, getWearableActivities, getWearableConnections, ingestWearableActivity, resetUserProgress, saveAssessment, saveDailyLog, updateUserProfileImage, upsertWearableConnection } from "./db";
import { storagePut } from "./storage";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    register: publicProcedure.input(z.object({ name: z.string().min(2).max(100), email: z.string().email().max(320), password: z.string().min(8).max(128) })).mutation(async ({ ctx, input }) => {
      if (await getUserByEmail(input.email.toLowerCase())) throw new Error("Email already registered");
      const salt = randomBytes(16).toString("hex");
      const hash = await promisify(scryptCb)(input.password, salt, 64) as Buffer;
      const user = await createLocalUser({ name: input.name.trim(), email: input.email.toLowerCase(), passwordHash: `${salt}:${hash.toString("hex")}`, openId: randomBytes(24).toString("hex") });
      if (!user) throw new Error("Could not create account");
      const token = await new SignJWT({}).setProtectedHeader({ alg:"HS256" }).setSubject(String(user.id)).setIssuedAt().setExpirationTime("30d").sign(new TextEncoder().encode(process.env.JWT_SECRET || "development-secret"));
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: 30*24*60*60*1000 });
      return user;
    }),
    login: publicProcedure.input(z.object({ email: z.string().email(), password: z.string().min(1) })).mutation(async ({ ctx, input }) => {
      const user = await getUserByEmail(input.email.toLowerCase());
      if (!user?.passwordHash) throw new Error("Invalid email or password");
      const [salt, stored] = user.passwordHash.split(":");
      const hash = await promisify(scryptCb)(input.password, salt, 64) as Buffer;
      const ok = stored && timingSafeEqual(Buffer.from(stored, "hex"), hash);
      if (!ok) throw new Error("Invalid email or password");
      await setUserLastSignedIn(user.id);
      const token = await new SignJWT({}).setProtectedHeader({ alg:"HS256" }).setSubject(String(user.id)).setIssuedAt().setExpirationTime("30d").sign(new TextEncoder().encode(process.env.JWT_SECRET || "development-secret"));
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: 30*24*60*60*1000 });
      return user;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
    }),
  }),


  profile: router({
    savePhoto: protectedProcedure.input(z.object({
      dataUrl: z.string().regex(/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/).max(7_000_000),
    })).mutation(async ({ ctx, input }) => {
      const match = input.dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/);
      if (!match) throw new Error("Invalid profile image");
      const [, contentType, encoded] = match;
      const buffer = Buffer.from(encoded, "base64");
      if (buffer.byteLength > 5 * 1024 * 1024) throw new Error("Profile image is too large");
      const uploaded = await storagePut(`profiles/${ctx.user.id}/avatar`, buffer, contentType === "image/jpg" ? "image/jpeg" : contentType);
      const user = await updateUserProfileImage(ctx.user.id, uploaded.key, uploaded.url);
      return { user };
    }),
    removePhoto: protectedProcedure.mutation(async ({ ctx }) => {
      const user = await updateUserProfileImage(ctx.user.id, null, null);
      return { user };
    }),
  }),

  progress: router({
    currentAssessment: protectedProcedure.input(z.object({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).query(({ ctx, input }) =>
      getCurrentAssessment(ctx.user.id, input.weekStart)),
    assessmentHistory: protectedProcedure.query(({ ctx }) => getAssessmentHistory(ctx.user.id)),
    saveAssessment: protectedProcedure.input(z.object({
      weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      objective: z.string().min(1).max(80), heightCm: z.number().int().min(100).max(250),
      benchPressLevel: z.string().min(1).max(80), squatLevel: z.string().min(1).max(80),
      cardio: z.string().min(1).max(40), sleep: z.string().min(1).max(40),
      recovery: z.string().min(1).max(40), fatigue: z.string().min(1).max(100),
    })).mutation(({ ctx, input }) => saveAssessment({ ...input, userId: ctx.user.id })),
    clearCurrentAssessment: protectedProcedure.input(z.object({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).mutation(({ ctx, input }) =>
      clearCurrentAssessment(ctx.user.id, input.weekStart)),
    deleteAllMyData: protectedProcedure.mutation(({ ctx }) => deleteAllUserData(ctx.user.id)),
    resetMyProgress: protectedProcedure.mutation(({ ctx }) => resetUserProgress(ctx.user.id)),
    dailyLog: protectedProcedure.input(z.object({ activityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).query(({ ctx, input }) =>
      getDailyLog(ctx.user.id, input.activityDate)),
    dailyHistory: protectedProcedure.input(z.object({ from: z.string(), to: z.string() })).query(({ ctx, input }) =>
      getDailyHistory(ctx.user.id, input.from, input.to)),
    saveDailyLog: protectedProcedure.input(z.object({
      activityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), workoutId: z.string().max(2).nullable().optional(),
      completedCount: z.number().int().min(0).max(32), completedExercises: z.string().max(2000).nullable().optional(),
      cardioMinutes: z.number().int().min(0).max(1440).nullable().optional(), mealsNote: z.string().max(2000).nullable().optional(),
      waterLiters: z.string().max(10).nullable().optional(), recovery: z.string().max(40).nullable().optional(),
    })).mutation(({ ctx, input }) => {
      const todayInPortugal = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      if (input.activityDate !== todayInPortugal) {
        throw new Error("Only the current calendar day can be registered.");
      }
      return saveDailyLog({ ...input, userId: ctx.user.id });
    }),
    wearableConnections: protectedProcedure.query(({ ctx }) => getWearableConnections(ctx.user.id)),
    wearableActivities: protectedProcedure.input(z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).query(({ ctx, input }) =>
      getWearableActivities(ctx.user.id, input.from, input.to)),
    weeklyActivityAnalysis: protectedProcedure.input(z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).query(({ ctx, input }) =>
      getWeeklyActivityAnalysis(ctx.user.id, input.from, input.to, input.weekStart)),
    analyzeDay5: protectedProcedure.input(z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), language: z.enum(["pt", "en", "es"]) })).mutation(async ({ ctx, input }) => {
      const [analysis, assessment, history] = await Promise.all([
        getWeeklyActivityAnalysis(ctx.user.id, input.from, input.to, input.weekStart),
        getCurrentAssessment(ctx.user.id, input.weekStart),
        getAssessmentHistory(ctx.user.id, 12),
      ]);
      const fallback = () => {
        const lowRecovery = assessment?.recovery === "very_low" || assessment?.recovery === "low" || assessment?.fatigue === "very_high";
        const highCardio = (analysis.cardioMinutes ?? 0) >= 150 || assessment?.cardio === "45_60" || assessment?.cardio === "over60";
        const recommendation = lowRecovery ? "recovery" : highCardio && assessment?.recovery !== "very_good" ? "mobility" : assessment?.objective === "strength" && ["b1", "b2", "b3"].includes(assessment?.benchPressLevel ?? "") ? "technical" : assessment?.objective === "fatloss" && ["none", "u20"].includes(assessment?.cardio ?? "") ? "conditioning" : Number(assessment?.heightCm) >= 190 ? "core" : "complementary";
        const rationale = {
          pt: lowRecovery ? "A recuperação ou a fadiga registrada indicam que uma sessão leve é mais adequada agora." : "A recomendação cruza seus quatro treinos, a avaliação semanal e o volume real sincronizado nesta semana.",
          en: lowRecovery ? "The recorded recovery or fatigue suggests a light session is more appropriate now." : "The recommendation combines your four workouts, weekly assessment and real synced volume from this week.",
          es: lowRecovery ? "La recuperación o fatiga registrada indican que una sesión ligera es más adecuada ahora." : "La recomendación cruza tus cuatro entrenamientos, la evaluación semanal y el volumen real sincronizado esta semana.",
        }[input.language];
        return { recommendation, rationale, confidence: "medium" as const, source: "rules" as const, historyWeeksConsidered: history.length };
      };
      if (!assessment || !analysis.dataAvailable || analysis.workoutsCompleted < 4) return fallback();
      try {
        const llmResponse = await invokeLLM({
          messages: [
            { role: "system", content: "Você é o motor de personalização do Ritmo Pro Man. Analise somente os dados JSON fornecidos. Nunca invente métricas, nunca substitua os quatro treinos principais e recomende o quinto dia apenas como opcional. Se um campo for null, trate-o como indisponível. Escreva a rationale no idioma indicado no campo language (pt, en ou es). Responda apenas com o JSON do schema." },
            { role: "user", content: JSON.stringify({ language: input.language, week: analysis, assessment, previousAssessments: (history as any[]).filter((row: any) => row.weekStart !== input.weekStart).slice(0, 6).map((row: any) => ({ weekStart: row.weekStart, objective: row.objective, cardio: row.cardio, sleep: row.sleep, recovery: row.recovery, fatigue: row.fatigue, benchPressLevel: row.benchPressLevel, squatLevel: row.squatLevel })) }) },
          ],
          response_format: { type: "json_schema", json_schema: { name: "day5_recommendation", strict: true, schema: { type: "object", properties: { recommendation: { type: "string", enum: ["recovery", "mobility", "core", "stability", "conditioning", "technical", "complementary", "rest"] }, rationale: { type: "string", minLength: 20, maxLength: 500 }, confidence: { type: "string", enum: ["low", "medium", "high"] } }, required: ["recommendation", "rationale", "confidence"], additionalProperties: false } } },
        });
        const content = llmResponse.choices[0]?.message.content;
        const text = typeof content === "string" ? content : Array.isArray(content) ? (content as any[]).filter((part: any) => part.type === "text").map((part: any) => part.text).join(" ") : "";
        const parsed = JSON.parse(text) as { recommendation: string; rationale: string; confidence: "low" | "medium" | "high" };
        return { ...parsed, source: "ai" as const, historyWeeksConsidered: history.length };
      } catch (error) {
        console.warn("[Day5] AI analysis unavailable, using data-only fallback", error);
        return fallback();
      }
    }),
    requestWearableConnection: protectedProcedure.input(z.object({ provider: z.enum(["coros", "google_health", "garmin", "apple_health", "health_connect"]) })).mutation(({ ctx, input }) =>
      upsertWearableConnection({ userId: ctx.user.id, provider: input.provider, status: "authorization_required" }).then(connection => ({ connection, authorizationRequired: true }))),
    requestWearableSync: protectedProcedure.input(z.object({ provider: z.enum(["coros", "google_health", "garmin", "apple_health", "health_connect"]) })).mutation(async ({ ctx, input }) => {
      const connection = await upsertWearableConnection({ userId: ctx.user.id, provider: input.provider, status: "authorization_required" });
      return { connection, imported: 0, status: "authorization_required" as const, message: "Autorização oficial e credenciais da plataforma ainda são necessárias. Nenhuma métrica foi inventada ou importada." };
    }),
    ingestWearableActivity: protectedProcedure.input(z.object({
      provider: z.enum(["coros", "google_health", "garmin", "apple_health", "health_connect"]),
      externalId: z.string().min(1).max(160), activityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), activityStartedAt: z.coerce.date().nullable().optional(),
      activityType: z.string().max(80).nullable().optional(), durationMinutes: z.number().int().min(0).max(100000).nullable().optional(), caloriesKcal: z.number().int().min(0).max(1000000).nullable().optional(),
      averageHeartRate: z.number().int().min(0).max(300).nullable().optional(), maxHeartRate: z.number().int().min(0).max(300).nullable().optional(), steps: z.number().int().min(0).max(200000).nullable().optional(),
      distanceKm: z.string().max(16).nullable().optional(), cardioMinutes: z.number().int().min(0).max(100000).nullable().optional(), sleepMinutes: z.number().int().min(0).max(2000).nullable().optional(), recoveryNote: z.string().max(120).nullable().optional(), rawMetrics: z.string().max(10000).nullable().optional(),
    })).mutation(({ ctx, input }) => ingestWearableActivity({ ...input, userId: ctx.user.id })),
  }),
});

export type AppRouter = typeof appRouter;
