import { fitnessRouter, assertToday } from "./fitness";
import { reserveWorkoutWeek } from "./workout-ai-limit";
import { and, eq } from "drizzle-orm";
import { trainingSessions, fitnessRevisions } from "../drizzle/schema";
import { getDb } from "./db";
import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { createRemoteJWKSet, SignJWT, jwtVerify } from "jose";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import type { TrpcContext } from "./_core/context";
import { ENV, getJwtSecret } from "./_core/env";
import { attachMercadoPagoCheckout, createPendingSubscription, createLocalUser, createOAuthUser, createWorkoutPlan, deleteWorkoutPlan, getLatestUserSubscription, getUserByEmail, getUserById, getWorkoutPlans, invalidateUserSessions, saveBodyAnalysis, setUserLastSignedIn, updateSubscriptionByProviderId, updateUserName, updateUserExperience, updateUserPassword, updateWorkoutPlan, consumeAuthEmailToken, consumeAuthRateLimit, issueAuthEmailToken, markEmailVerified, setPendingUserEmail, updateUserEmail } from "./db";
import { runWorkoutGeneration } from "./ai/features/workout-generation";
import { runSmartwatchPhoto, runWeeklyWearable } from "./ai/features/smartwatch";
import { runDay5 } from "./ai/features/day5";
import { runBodyAnalysis } from "./ai/features/body-analysis";
import { runNutritionAnalysis } from "./ai/features/nutrition-analysis";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getRecentTrainingContext, clearCurrentAssessment, deleteAllUserData, getAssessmentHistory, getBodyAnalysisHistory, getCurrentAssessment, getDailyHistory, getDailyLog, getWeeklyActivityAnalysis, getWearableActivities, getWearableConnections, ingestWearableActivity, resetUserProgress, saveAssessment, saveDailyLog, updateUserProfileImage, upsertWearableConnection } from "./db";
import { storageGetSignedUrl, storagePut, storageRemove } from "./storage";
import { bodyAnalysisResultSchema, decodeBodyImage, parseBodyAnalysisResponse } from "./body-analysis";
import { beginWearableOAuth, disconnectWearableAccount, syncWearable } from "./wearables";
import type { User } from "../drizzle/schema";
import { hasPremiumAccess, isMercadoPagoCheckoutUrl, makeUserExternalReference, MercadoPagoClient } from "./mercadopago";
import { exerciseById, exerciseIds, catalogFor, assertExperienceExercises as assertCatalogExperience, type Experience } from "@shared/workouts";
import { sendAuthEmail } from "./auth-emails";

function assertExperienceExercises(exercises: { exerciseId: string }[], experience: Experience) {
  try { assertCatalogExperience(exercises, experience); }
  catch { throw new TRPCError({ code: "BAD_REQUEST", message: "Exercício não pertence a esta experiência." }); }
}

async function toClientUser(user: User) {
  let profileImageUrl: string | null = null;
  if (user.profileImageKey) {
    try { profileImageUrl = await storageGetSignedUrl(user.profileImageKey); }
    catch (error) { console.warn("[Profile] Could not refresh the signed photo URL"); }
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: Boolean(user.emailVerifiedAt),
    loginMethod: user.loginMethod,
    hasPassword: Boolean(user.passwordHash),
    profileImageUrl,
    experience: user.experience,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastSignedIn: user.lastSignedIn,
  };
}

function isDuplicateEntry(error: unknown): boolean {
  let current: unknown = error;
  while (current && typeof current === "object") {
    const candidate = current as { code?: unknown; cause?: unknown };
    if (candidate.code === "ER_DUP_ENTRY") return true;
    current = candidate.cause;
  }
  return false;
}

const GOOGLE_CHALLENGE_COOKIE = "ritmo_google_login";
function requestCookie(req: TrpcContext["req"], name: string) {
  return (req.headers.cookie || "").split(";").map(value => value.trim()).find(value => value.startsWith(name + "="))?.slice(name.length + 1);
}
async function createLoginChallenge(ctx: Pick<TrpcContext, "req" | "res">) {
  const nonce = randomBytes(32).toString("base64url");
  const state = randomBytes(24).toString("base64url");
  const token = await new SignJWT({ purpose: "google_login", nonce, state }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m").sign(getJwtSecret());
  ctx.res.cookie(GOOGLE_CHALLENGE_COOKIE, token, { ...getSessionCookieOptions(ctx.req), path: "/api/trpc", maxAge: 10 * 60 * 1000 });
  return { nonce, state, challengeToken: token };
}
async function consumeLoginChallenge(ctx: Pick<TrpcContext, "req" | "res">, suppliedToken: string) {
  const token = suppliedToken || requestCookie(ctx.req, GOOGLE_CHALLENGE_COOKIE);
  ctx.res.clearCookie(GOOGLE_CHALLENGE_COOKIE, { ...getSessionCookieOptions(ctx.req), path: "/api/trpc" });
  if (!token) throw new TRPCError({ code: "UNAUTHORIZED", message: "A validação de segurança do provedor expirou. Tente novamente." });
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), { algorithms: ["HS256"] });
    if (payload.purpose !== "google_login" || typeof payload.nonce !== "string" || typeof payload.state !== "string") throw new Error("Invalid challenge");
    return { nonce: payload.nonce, state: payload.state };
  } catch {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "A validação de segurança do provedor expirou. Tente novamente." });
  }
}
const passwordHash = async (password: string) => {
  const salt = randomBytes(16).toString("hex");
  const hash = await promisify(scryptCb)(password, salt, 64) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
};
async function checkPassword(password: string, encoded: string | null) {
  const [candidateSalt, candidateHash] = (encoded ?? "").split(":");
  const valid = /^[a-f0-9]{32}$/i.test(candidateSalt || "") && /^[a-f0-9]{128}$/i.test(candidateHash || "");
  // Unknown and provider-only accounts still perform the expensive password check.
  const salt = valid ? candidateSalt : "0".repeat(32);
  const stored = valid ? candidateHash : "0".repeat(128);
  const hash = await promisify(scryptCb)(password, salt, 64) as Buffer;
  const expected = Buffer.from(stored, "hex");
  return timingSafeEqual(expected, hash) && valid;
}
async function setSession(ctx: Pick<TrpcContext, "req" | "res">, user: User) {
  const token = await new SignJWT({ sv: user.sessionVersion }).setProtectedHeader({ alg: "HS256" }).setSubject(String(user.id)).setIssuedAt().setExpirationTime("30d").sign(getJwtSecret());
  ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: 30 * 24 * 60 * 60 * 1000 });
}
const POLICY_VERSION = "2026-09";
const strongPassword = z.string().min(10, "Use uma senha com pelo menos 10 caracteres.").max(128).regex(/[a-z]/, "Inclua uma letra minúscula.").regex(/[A-Z]/, "Inclua uma letra maiúscula.").regex(/[0-9]/, "Inclua um número.");
type AuthTokenPurpose = "verify_email" | "password_reset" | "email_change";
function emailDeliveryConfigured() {
  if (!ENV.resendApiKey || !ENV.emailFrom || !ENV.appPublicUrl) return false;
  try { const url = new URL(ENV.appPublicUrl); return !url.username && !url.password && (url.protocol === "https:" || (!ENV.isProduction && url.protocol === "http:")); }
  catch { return false; }
}
function actionUrl(path: string, token: string) {
  try {
    const base = new URL(ENV.appPublicUrl);
    if (ENV.isProduction && base.protocol !== "https:") return null;
    base.pathname = path;
    base.search = "";
    base.hash = `#${path === "/login" ? "reset" : "token"}=${encodeURIComponent(token)}`;
    return base.toString();
  } catch { return null; }
}
async function mintEmailToken(user: User, purpose: AuthTokenPurpose, targetEmail?: string | null) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const lifetime = purpose === "password_reset" ? 20 : 30;
  await issueAuthEmailToken({ tokenHash, userId: user.id, purpose, targetEmail: targetEmail ?? user.email, expectedSessionVersion: user.sessionVersion, expiresAt: new Date(Date.now() + lifetime * 60_000) });
  return { token, tokenHash };
}
async function authRateAllowed(ctx: Pick<TrpcContext, "req">, scope: string, identity: string, limit: number, windowMs = 15 * 60_000) {
  const ip = ctx.req.ip || ctx.req.socket?.remoteAddress || "unknown";
  const rateKey = createHash("sha256").update(`${scope}\0identity\0${identity.trim().toLowerCase()}`).digest("hex");
  const ipRateKey = createHash("sha256").update(`${scope}\0ip\0${ip}`).digest("hex");
  const identityAllowed = await consumeAuthRateLimit(rateKey, limit, windowMs);
  const ipAllowed = await consumeAuthRateLimit(ipRateKey, limit * 5, windowMs);
  return identityAllowed && ipAllowed;
}
async function authIpRateAllowed(ctx: Pick<TrpcContext, "req">, scope: string, limit: number, windowMs = 15 * 60_000) {
  const ip = ctx.req.ip || ctx.req.socket?.remoteAddress || "unknown";
  const ipRateKey = createHash("sha256").update(`${scope}\0ip\0${ip}`).digest("hex");
  return consumeAuthRateLimit(ipRateKey, limit, windowMs);
}
const providerRateWindows = new Map<string, { startedAt: number; attempts: number }>();
function providerIpRateAllowed(ctx: Pick<TrpcContext, "req">, scope: string, limit: number, windowMs = 15 * 60_000) {
  const now = Date.now();
  const ip = ctx.req.ip || ctx.req.socket?.remoteAddress || "unknown";
  const key = createHash("sha256").update(`${scope}\0ip\0${ip}`).digest("hex");
  const current = providerRateWindows.get(key);
  if (!current || now - current.startedAt >= windowMs) {
    providerRateWindows.set(key, { startedAt: now, attempts: 1 });
  } else {
    current.attempts += 1;
  }
  if (providerRateWindows.size > 10_000) {
    providerRateWindows.forEach((value, candidate) => { if (now - value.startedAt >= windowMs) providerRateWindows.delete(candidate); });
  }
  return (providerRateWindows.get(key)?.attempts ?? 0) <= limit;
}
async function deliverEmailAction(user: User, purpose: AuthTokenPurpose, kind: "verify_email" | "email_change" | "password_reset", targetEmail?: string) {
  if (!emailDeliveryConfigured()) return false;
  const { token, tokenHash } = await mintEmailToken(user, purpose, targetEmail);
  const url = actionUrl(purpose === "password_reset" ? "/login" : "/confirm-email", token);
  if (!url) return false;
  return sendAuthEmail(kind, targetEmail ?? user.email ?? "", { name: user.name, actionUrl: url }, tokenHash);
}
async function signInGoogleUser(providerId: string, emailValue: string, nameValue: unknown) {
  const email = emailValue.trim().toLowerCase();
  if (!z.string().email().max(320).safeParse(email).success) throw new TRPCError({ code: "UNAUTHORIZED", message: "Não foi possível validar a conta deste provedor." });
  let user = await getUserByEmail(email);
  if (!user) {
    try {
      const acceptedAt = new Date();
      user = await createOAuthUser({ provider: "google", providerId, email, name: typeof nameValue === "string" && nameValue.trim() ? nameValue.trim().slice(0, 100) : email.split("@")[0], termsAcceptedAt: acceptedAt, privacyAcceptedAt: acceptedAt, termsAcceptedVersion: POLICY_VERSION, privacyAcceptedVersion: POLICY_VERSION });
    } catch (error) {
      if (!isDuplicateEntry(error)) throw error;
      user = await getUserByEmail(email);
    }
  }
  if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível carregar a conta." });
  if (!user.emailVerifiedAt) {
    user = await markEmailVerified(user.id, email, user.sessionVersion, true);
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "A conta foi alterada. Tente entrar novamente." });
  }
  await setUserLastSignedIn(user.id);
  return getUserById(user.id);
}

function lisbonDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ENV.appTimeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function currentWeekStart(date = new Date()) {
  const day = new Date(`${lisbonDate(date)}T12:00:00Z`);
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() - weekday + 1);
  return day.toISOString().slice(0, 10);
}
function currentWeekEnd(date = new Date()) {
  const week = new Date(`${currentWeekStart(date)}T12:00:00Z`);
  week.setUTCDate(week.getUTCDate() + 6);
  return week.toISOString().slice(0, 10);
}
async function removeUserBodyPhotos(userId: number) {
  const history = await getBodyAnalysisHistory(userId, 1000);
  for (const row of history) {
    try {
      const keys = JSON.parse(row.photoKeys) as Record<string, unknown>;
      for (const key of Object.values(keys)) if (typeof key === "string") await storageRemove(key);
    } catch (error) { console.warn("[BodyAnalysis] Photo cleanup failed"); }
  }
}
async function requirePremium(userId: number) {
  if (ENV.freeProAccess) return;
  const subscription = await getLatestUserSubscription(userId);
  if (!subscription || !hasPremiumAccess(subscription.status, subscription.currentPeriodEnd)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Esta funcionalidade requer uma assinatura Ritmo Pro ativa." });
  }
}

const workoutExerciseSchema = z.object({
  exerciseId: z.enum(exerciseIds),
  sets: z.number().int().min(1).max(10),
  reps: z.string().trim().min(1).max(24),
  loadKg: z.number().min(0).max(500).nullable(),
  restSeconds: z.number().int().min(0).max(900),
  note: z.string().max(240).nullable().optional(),
});
const workoutPlanInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  objective: z.string().trim().min(2).max(80),
  focusGroup: z.string().trim().min(2).max(80),
  durationMinutes: z.number().int().min(10).max(240),
  notes: z.string().max(2000).nullable().optional(),
  exercises: z.array(workoutExerciseSchema).min(1).max(20),
});
function publicWorkoutPlan(plan: Awaited<ReturnType<typeof getWorkoutPlans>>[number]) {
  let exercises: unknown;
  try { exercises = JSON.parse(plan.exercisesJson); } catch { exercises = []; }
  return { id: plan.id, source: plan.source, baseWorkoutId: plan.baseWorkoutId, name: plan.name, objective: plan.objective, focusGroup: plan.focusGroup, durationMinutes: plan.durationMinutes, notes: plan.notes, exercises: z.array(workoutExerciseSchema).parse(exercises), createdAt: plan.createdAt, updatedAt: plan.updatedAt };
}

function fifthDayPaused(): boolean { return false; }

export const appRouter = router({
  fitness: fitnessRouter,
  auth: router({
    me: publicProcedure.query(async opts => opts.ctx.user ? toClientUser(opts.ctx.user) : null),
    sessionStatus: publicProcedure.query(opts => ({ expired: Boolean(opts.ctx.sessionExpired) })),
    providers: publicProcedure.query(() => ({ googleClientId: ENV.googleClientId || null })),
    googleChallenge: publicProcedure.mutation(async ({ ctx }) => {
      if (!providerIpRateAllowed(ctx, "google_challenge", 30)) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Muitas tentativas. Aguarde alguns minutos." });
      return createLoginChallenge(ctx);
    }),
    googleSignIn: publicProcedure.input(z.object({ credential: z.string().min(100).max(12000), challengeToken: z.string().min(100).max(4096) })).mutation(async ({ ctx, input }) => {
      if (!ENV.googleClientId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Login com Google ainda não está configurado." });
      if (!providerIpRateAllowed(ctx, "google_signin", 20)) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Muitas tentativas. Aguarde alguns minutos." });
      const challenge = await consumeLoginChallenge(ctx, input.challengeToken);
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(input.credential)}`, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new TRPCError({ code: "UNAUTHORIZED", message: "Não foi possível validar a conta do Google." });
      const claims = await response.json() as { aud?: string; iss?: string; sub?: string; email?: string; email_verified?: string | boolean; name?: string; exp?: string; nonce?: string };
      const expiry = Number(claims.exp);
      if (claims.aud !== ENV.googleClientId || !["accounts.google.com", "https://accounts.google.com"].includes(claims.iss ?? "") || !claims.sub || !claims.email || ![true, "true"].includes(claims.email_verified ?? false) || !Number.isFinite(expiry) || expiry * 1000 <= Date.now() || claims.nonce !== challenge.nonce) throw new TRPCError({ code: "UNAUTHORIZED", message: "Não foi possível validar a conta do Google." });
      const user = await signInGoogleUser(claims.sub, claims.email, claims.name);
      if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível carregar a conta." });
      await setSession(ctx, user);
      return toClientUser(user);
    }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      if (ctx.user) await invalidateUserSessions(ctx.user.id);
      return { success: true } as const;
    }),
  }),


  profile: router({
    setExperience: protectedProcedure.input(z.object({ experience: z.enum(["man", "woman"]) })).mutation(async ({ ctx, input }) => {
      const user = await updateUserExperience(ctx.user.id, input.experience);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Perfil não encontrado." });
      return toClientUser(user);
    }),
    updateName: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(100) })).mutation(async ({ ctx, input }) => {
      const user = await updateUserName(ctx.user.id, input.name);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Perfil não encontrado." });
      return toClientUser(user);
    }),
    changePassword: protectedProcedure.input(z.object({ currentPassword: z.string().max(128).optional(), newPassword: strongPassword })).mutation(async ({ ctx, input }) => {
      if (!await authRateAllowed(ctx, "change_password", String(ctx.user.id), 5)) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Muitas tentativas. Aguarde alguns minutos." });
      if (ctx.user.passwordHash && (!input.currentPassword || !await checkPassword(input.currentPassword, ctx.user.passwordHash))) throw new TRPCError({ code: "UNAUTHORIZED", message: "A senha atual está incorreta." });
      const user = await updateUserPassword(ctx.user.id, await passwordHash(input.newPassword), ctx.user.sessionVersion);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Perfil não encontrado." });
      ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      await sendAuthEmail("password_changed", ctx.user.email ?? "", { name: ctx.user.name }, `password-changed-${ctx.user.id}-${user.sessionVersion}`);
      await sendAuthEmail("security_alert", ctx.user.email ?? "", { name: ctx.user.name, detail: "A senha da sua conta foi alterada. Se você não reconhece esta ação, entre em contato com o suporte." }, `password-alert-${ctx.user.id}-${user.sessionVersion}`);
      return { success: true as const };
    }),
    changeEmail: protectedProcedure.input(z.object({ email: z.string().trim().email().max(320), currentPassword: z.string().max(128).optional() })).mutation(async ({ ctx, input }) => {
      const email = input.email.trim().toLowerCase();
      if (email === ctx.user.email?.toLowerCase()) throw new TRPCError({ code: "BAD_REQUEST", message: "Este já é o e-mail atual da conta." });
      if (ctx.user.passwordHash && (!input.currentPassword || !await checkPassword(input.currentPassword, ctx.user.passwordHash))) throw new TRPCError({ code: "UNAUTHORIZED", message: "A senha atual está incorreta." });
      if (!await authRateAllowed(ctx, "change_email", String(ctx.user.id), 3)) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Muitas solicitações. Aguarde alguns minutos." });
      if (await getUserByEmail(email)) return { success: true as const };
      const pending = await setPendingUserEmail(ctx.user.id, email);
      if (!pending) throw new TRPCError({ code: "NOT_FOUND", message: "Perfil não encontrado." });
      await deliverEmailAction(pending, "email_change", "email_change", email);
      if (ctx.user.email) await sendAuthEmail("security_alert", ctx.user.email, { name: ctx.user.name, detail: "Foi solicitada uma alteração de e-mail na sua conta. O novo endereço só será ativado após a confirmação. Se não foi você, altere sua senha." }, `email-change-request-${ctx.user.id}-${email}`);
      return { success: true as const };
    }),
    subscription: protectedProcedure.query(async ({ ctx }) => {
      if (ENV.freeProAccess) return { status: "active" as const, premium: true, plan: { code: "ritmo_free_pro", amount: "0.00", currency: ENV.mercadoPagoCurrency.toUpperCase(), interval: "month" as const }, currentPeriodEnd: null, lastPaymentStatus: null, offer: { name: "Ritmo Pro — GRÁTIS", amount: "0.00", currency: ENV.mercadoPagoCurrency.toUpperCase(), interval: "month" as const }, freeAccess: true as const };
      const subscription = await getLatestUserSubscription(ctx.user.id);
      if (!subscription) return { status: "none" as const, premium: false, plan: null, currentPeriodEnd: null, lastPaymentStatus: null, offer: { name: "Ritmo Pro", amount: ENV.mercadoPagoPlanMonthlyPrice, currency: ENV.mercadoPagoCurrency.toUpperCase(), interval: "month" as const } };
      const status = subscription.status === "active" && subscription.currentPeriodEnd && subscription.currentPeriodEnd.getTime() <= Date.now() ? "expired" as const : subscription.status;
      return {
        status,
        premium: hasPremiumAccess(status, subscription.currentPeriodEnd),
        plan: { code: subscription.planCode, amount: subscription.amount, currency: subscription.currency, interval: "month" as const },
        currentPeriodEnd: subscription.currentPeriodEnd,
        lastPaymentStatus: subscription.lastPaymentStatus,
        offer: { name: "Ritmo Pro", amount: subscription.amount, currency: subscription.currency, interval: "month" as const },
      };
    }),
    checkout: protectedProcedure.mutation(async ({ ctx }) => {
      if (ENV.freeProAccess) return { status: "active" as const, checkoutUrl: null };
      if (!ctx.user.email) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "An account email is required to start a subscription." });
      if (!ENV.mercadoPagoAccessToken || !ENV.appPublicUrl) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Mercado Pago is not configured on the server." });
      const price = ENV.mercadoPagoPlanMonthlyPrice;
      const currency = ENV.mercadoPagoCurrency.toUpperCase();
      if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(price) || Number(price) <= 0 || !/^[A-Z]{3}$/.test(currency)) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Subscription price configuration is invalid." });
      }
      const existing = await getLatestUserSubscription(ctx.user.id);
      if (existing?.status === "active" && hasPremiumAccess(existing.status, existing.currentPeriodEnd)) return { status: existing.status, checkoutUrl: null };
      if (existing?.status === "pending" && existing.checkoutUrl) return { status: existing.status, checkoutUrl: existing.checkoutUrl };
      if (existing?.status === "payment_pending") return { status: existing.status, checkoutUrl: existing.checkoutUrl };
      const publicUrl = ENV.appPublicUrl.replace(/\/$/, "");
      if (ENV.isProduction && !publicUrl.startsWith("https://")) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "PUBLIC_APP_URL must use HTTPS in production." });
      const client = new MercadoPagoClient();
      const draft = existing?.status === "pending" && !existing.checkoutUrl ? existing : await createPendingSubscription({
        userId: ctx.user.id, planCode: "ritmo_monthly", planName: "Ritmo Pro Mensal", amount: price, currency,
        externalReference: makeUserExternalReference(ctx.user.id, randomBytes(18).toString("hex")),
      });
      if (!draft) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not reserve the subscription checkout." });
      const remote = await client.createMonthlySubscription({ externalReference: draft.externalReference, email: ctx.user.email, amount: price, currency, publicUrl });
      const remoteId = remote.id == null ? "" : String(remote.id);
      const checkoutUrl = typeof remote.init_point === "string" ? remote.init_point : "";
      if (!remoteId || !checkoutUrl || !isMercadoPagoCheckoutUrl(checkoutUrl)) {
        if (remoteId) await client.cancelSubscription(remoteId).catch(() => undefined);
        throw new TRPCError({ code: "BAD_GATEWAY", message: "Mercado Pago did not return a valid subscription checkout." });
      }
      try {
        await attachMercadoPagoCheckout(draft.id, { providerSubscriptionId: remoteId, checkoutUrl, periodStart: remote.date_created ? new Date(remote.date_created) : null, periodEnd: remote.next_payment_date ? new Date(remote.next_payment_date) : null });
      } catch (error) {
        await client.cancelSubscription(remoteId).catch(() => undefined);
        throw error;
      }
      return { status: "pending" as const, checkoutUrl };
    }),
    cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
      const subscription = await getLatestUserSubscription(ctx.user.id);
      if (!subscription || !subscription.providerSubscriptionId || !["pending", "active", "payment_pending"].includes(subscription.status)) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No cancellable subscription was found." });
      }
      const client = new MercadoPagoClient();
      const remote = await client.cancelSubscription(subscription.providerSubscriptionId);
      const status = typeof remote.status === "string" ? remote.status : "cancelled";
      await updateSubscriptionByProviderId(subscription.providerSubscriptionId, { status: status === "cancelled" || status === "canceled" ? "cancelled" : "error", cancelledAt: new Date() });
      return { status: status === "cancelled" || status === "canceled" ? "cancelled" as const : "error" as const };
    }),
    savePhoto: protectedProcedure.input(z.object({
      dataUrl: z.string().regex(/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/).max(7_000_000),
    })).mutation(async ({ ctx, input }) => {
      const normalized = input.dataUrl.replace(/^data:image\/jpg;/, "data:image/jpeg;");
      const { mimeType, data } = decodeBodyImage(normalized, 5 * 1024 * 1024);
      const uploaded = await storagePut(`profiles/${ctx.user.id}/avatar`, data, mimeType);
      const user = await updateUserProfileImage(ctx.user.id, uploaded.key, uploaded.url);
      if (ctx.user.profileImageKey && ctx.user.profileImageKey !== uploaded.key) {
        try { await storageRemove(ctx.user.profileImageKey); } catch (error) { console.warn("[Profile] Previous photo cleanup failed"); }
      }
      return { user: user ? await toClientUser(user) : null };
    }),
    removePhoto: protectedProcedure.mutation(async ({ ctx }) => {
      const previousKey = ctx.user.profileImageKey;
      const user = await updateUserProfileImage(ctx.user.id, null, null);
      if (previousKey) {
        try { await storageRemove(previousKey); } catch (error) { console.warn("[Profile] Photo cleanup failed"); }
      }
      return { user: user ? await toClientUser(user) : null };
    }),
  }),

  workouts: router({
    catalog: protectedProcedure.query(({ ctx }) => catalogFor(ctx.user.experience ?? "man")),
    list: protectedProcedure.query(async ({ ctx }) => (await getWorkoutPlans(ctx.user.id, ctx.user.experience ?? "man")).map(publicWorkoutPlan)),
    create: protectedProcedure.input(workoutPlanInputSchema.extend({ baseWorkoutId: z.enum(["A", "B", "C", "D"]).nullable().optional(), source: z.enum(["manual", "ai", "customized", "day5"]).default("manual") })).mutation(async ({ ctx, input }) => {
      const { exercises, ...details } = input;
      try { assertExperienceExercises(exercises, ctx.user.experience ?? "man"); }
      catch { throw new TRPCError({ code: "BAD_REQUEST", message: "Exercício não pertence a esta experiência." }); }
      const saved = await createWorkoutPlan({ ...details, userId: ctx.user.id, experience: ctx.user.experience ?? "man", exercisesJson: JSON.stringify(exercises), notes: details.notes ?? null, baseWorkoutId: details.baseWorkoutId ?? null, source: details.baseWorkoutId ? "customized" : details.source });
      if (!saved) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível salvar o treino." });
      return publicWorkoutPlan(saved);
    }),
    update: protectedProcedure.input(workoutPlanInputSchema.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const { id, exercises, ...details } = input;
      try { assertExperienceExercises(exercises, ctx.user.experience ?? "man"); }
      catch { throw new TRPCError({ code: "BAD_REQUEST", message: "Exercício não pertence a esta experiência." }); }
      const updated = await updateWorkoutPlan(ctx.user.id, id, { ...details, exercisesJson: JSON.stringify(exercises), notes: details.notes ?? null }, ctx.user.experience ?? "man");
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Treino não encontrado." });
      return publicWorkoutPlan(updated);
    }),
    remove: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      if (!await deleteWorkoutPlan(ctx.user.id, input.id, ctx.user.experience ?? "man")) throw new TRPCError({ code: "NOT_FOUND", message: "Treino não encontrado." });
      return { success: true as const };
    }),
    generateWithAI: protectedProcedure.input(z.object({ objective: z.string().trim().min(2).max(80), focusGroup: z.string().trim().min(2).max(80), durationMinutes: z.number().int().min(10).max(180), availabilityDays: z.number().int().min(1).max(7), language: z.enum(["pt", "en", "es"]) })).mutation(async ({ ctx, input }) => {
      await requirePremium(ctx.user.id);
      if (!ENV.geminiApiKey) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "O serviço de IA não está configurado." });
      const release = await reserveWorkoutWeek(ctx.user.id);
      try {
      const today = lisbonDate(); const weekStart = currentWeekStart();
      const fromDate = new Date(`${today}T12:00:00Z`); fromDate.setUTCDate(fromDate.getUTCDate() - 29);
      const from = fromDate.toISOString().slice(0, 10);
      const [assessment, week, daily, history, bodyHistory, savedPlans, sessionTraining] = await Promise.all([
        getCurrentAssessment(ctx.user.id, weekStart),
        getWeeklyActivityAnalysis(ctx.user.id, weekStart, today, weekStart, ctx.user.experience ?? "man"),
        getDailyHistory(ctx.user.id, from, today),
        getAssessmentHistory(ctx.user.id, 6),
        getBodyAnalysisHistory(ctx.user.id, 2),
        getWorkoutPlans(ctx.user.id, ctx.user.experience ?? "man"),
        getRecentTrainingContext(ctx.user.id, from, today, ctx.user.experience ?? "man"),
      ]);
      const body = bodyHistory[0] ? JSON.parse(bodyHistory[0].analysisJson) as unknown : null;
      const data = { requested: input, recentTrainingSessions: sessionTraining, currentAssessment: assessment ?? null, weeklyTrainingAndWearableData: week, recentDailyLogs: daily.map(row => ({ date: row.activityDate, workoutId: row.workoutId, completedCount: row.completedCount, cardioMinutes: row.cardioMinutes, recovery: row.recovery, waterLiters: row.waterLiters, mealsNote: row.mealsNote })), previousWeeklyAssessments: history, latestBodyAnalysis: body, priorCustomizations: savedPlans.slice(0, 8).map(plan => ({ name: plan.name, focusGroup: plan.focusGroup, source: plan.source, exercises: JSON.parse(plan.exercisesJson) })) };
      const response = await runWorkoutGeneration({ language: input.language, experience: ctx.user.experience ?? "man", data, exerciseCatalog: catalogFor(ctx.user.experience ?? "man") });
      try {
        const plan = workoutPlanInputSchema.parse(JSON.parse(response.text));
        assertExperienceExercises(plan.exercises, ctx.user.experience ?? "man");
        return plan;
      } catch {
        throw new TRPCError({ code: "BAD_GATEWAY", message: "A IA não conseguiu montar um treino válido agora. Tente novamente." });
      }
      } catch (error) { await release(); throw error; }
    }),
  }),

  progress: router({
    today: protectedProcedure.query(() => ({ activityDate: lisbonDate(), weekStart: currentWeekStart(), weekEnd: currentWeekEnd() })),
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
    deleteAllMyData: protectedProcedure.mutation(async ({ ctx }) => {
      const subscription = await getLatestUserSubscription(ctx.user.id);
      if (subscription?.providerSubscriptionId && ["pending", "active", "payment_pending"].includes(subscription.status)) {
        if (!ENV.mercadoPagoAccessToken) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cancel the Mercado Pago subscription before deleting this account." });
        const remote = await new MercadoPagoClient().cancelSubscription(subscription.providerSubscriptionId);
        if (remote.status !== "cancelled" && remote.status !== "canceled") throw new TRPCError({ code: "BAD_GATEWAY", message: "Mercado Pago did not confirm cancellation. Account data was not deleted." });
        await updateSubscriptionByProviderId(subscription.providerSubscriptionId, { status: "cancelled", cancelledAt: new Date() });
      }
      await removeUserBodyPhotos(ctx.user.id);
      if (ctx.user.profileImageKey) {
        try { await storageRemove(ctx.user.profileImageKey); } catch (error) { console.warn("[Profile] Account photo cleanup failed"); }
      }
      return deleteAllUserData(ctx.user.id);
    }),
    resetMyProgress: protectedProcedure.mutation(async ({ ctx }) => { await removeUserBodyPhotos(ctx.user.id); return resetUserProgress(ctx.user.id); }),
    bodyAnalysisHistory: protectedProcedure.query(async ({ ctx }) => {
      const rows = await getBodyAnalysisHistory(ctx.user.id);
      return Promise.all(rows.map(async row => {
        const parsed = bodyAnalysisResultSchema.parse(JSON.parse(row.analysisJson));
        const photoKeys = JSON.parse(row.photoKeys) as Record<string, string>;
        const photos = Object.fromEntries(await Promise.all(Object.entries(photoKeys).map(async ([slot, key]) => [slot, await storageGetSignedUrl(key)] as const)));
        return { analysisMonth: row.analysisMonth, objective: row.objective, bodyFatEstimatePercent: row.bodyFatEstimatePercent, confidencePercent: row.confidencePercent, analysis: parsed, photos, createdAt: row.createdAt };
      }));
    }),
    analyzeBody: protectedProcedure.input(z.object({
      language: z.enum(["pt", "en", "es"]),
      photos: z.object({
        front: z.string().regex(/^data:image\/(?:jpeg|png|webp);base64,/).max(2_100_000),
        left: z.string().regex(/^data:image\/(?:jpeg|png|webp);base64,/).max(2_100_000),
        back: z.string().regex(/^data:image\/(?:jpeg|png|webp);base64,/).max(2_100_000),
        right: z.string().regex(/^data:image\/(?:jpeg|png|webp);base64,/).max(2_100_000),
      }),
    })).mutation(async ({ ctx, input }) => {
      await requirePremium(ctx.user.id);
      const imageSlots = ["front", "left", "back", "right"] as const;
      const images = imageSlots.map(slot => ({ slot, ...decodeBodyImage(input.photos[slot]) }));
      const totalImageBytes = images.reduce((sum, image) => sum + image.data.length, 0);
      if (totalImageBytes > 5_000_000) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "O conjunto de imagens excede 5 MB." });
      const today = lisbonDate();
      const weekStart = currentWeekStart();
      const monthStart = `${today.slice(0, 8)}01`;
      const [assessment, daily, weekly, history] = await Promise.all([
        getCurrentAssessment(ctx.user.id, weekStart),
        getDailyHistory(ctx.user.id, monthStart, today),
        getWeeklyActivityAnalysis(ctx.user.id, weekStart, today, weekStart, ctx.user.experience ?? "man"),
        getBodyAnalysisHistory(ctx.user.id, 3),
      ]);
      const previousThisMonth = history.find(row => row.analysisMonth === today.slice(0, 7));
      const nutritionHydration = daily.map(log => ({ date: log.activityDate, meals: log.mealsNote, waterLiters: log.waterLiters, cardioMinutes: log.cardioMinutes, recovery: log.recovery, workoutId: log.workoutId, completedCount: log.completedCount }));
      const previousAnalysis = history[0] ? JSON.parse(history[0].analysisJson) as unknown : null;
      const result = await runBodyAnalysis({
        language: input.language, experience: ctx.user.experience ?? "man", images,
        context: { objectiveAndAssessment: assessment ? { objective: assessment.objective, heightCm: assessment.heightCm, benchPressLevel: assessment.benchPressLevel, squatLevel: assessment.squatLevel, cardio: assessment.cardio, sleep: assessment.sleep, recovery: assessment.recovery, fatigue: assessment.fatigue } : null, currentWeek: weekly, dailyRecords: nutritionHydration, previousMonthlyAnalysis: previousAnalysis },
      });
      const storedKeys: Record<string, string> = {};
      try {
        for (const image of images) {
          const uploaded = await storagePut(`body-analysis/${ctx.user.id}/${today.slice(0, 7)}/${randomBytes(12).toString("hex")}-${image.slot}.${image.mimeType === "image/png" ? "png" : image.mimeType === "image/webp" ? "webp" : "jpg"}`, image.data, image.mimeType);
          storedKeys[image.slot] = uploaded.key;
        }
        const saved = await saveBodyAnalysis({
          userId: ctx.user.id, analysisMonth: today.slice(0, 7), objective: assessment?.objective ?? null,
          photoKeys: JSON.stringify(storedKeys), bodyFatEstimatePercent: result.bodyFatEstimatePercent,
          confidencePercent: result.confidencePercent, analysisJson: JSON.stringify(result),
        });
        if (previousThisMonth) {
          try {
            const oldKeys = JSON.parse(previousThisMonth.photoKeys) as Record<string, unknown>;
            await Promise.allSettled(Object.values(oldKeys).filter((key): key is string => typeof key === "string").map(key => storageRemove(key)));
          } catch (cleanupError) { console.warn("[BodyAnalysis] Previous monthly photo cleanup failed"); }
        }
        return { ...saved, analysis: result };
      } catch (error) {
        await Promise.allSettled(Object.values(storedKeys).map(key => storageRemove(key)));
        throw error;
      }
    }),
    dailyLog: protectedProcedure.input(z.object({ activityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).query(({ ctx, input }) =>
      getDailyLog(ctx.user.id, input.activityDate)),
    dailyHistory: protectedProcedure.input(z.object({ from: z.string(), to: z.string() })).query(({ ctx, input }) =>
      getDailyHistory(ctx.user.id, input.from, input.to)),
    saveDailyLog: protectedProcedure.input(z.object({
      activityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), workoutId: z.string().max(2).nullable().optional(),
      completedCount: z.number().int().min(0).max(32), completedExercises: z.string().max(2000).nullable().optional(),
      cardioMinutes: z.number().int().min(0).max(1440).nullable().optional(), mealsNote: z.string().max(2000).nullable().optional(),
      waterLiters: z.string().max(10).nullable().optional().refine(value => value == null || (/^\d{1,2}(?:\.\d{1,2})?$/.test(value) && Number(value) <= 20), "Informe água entre 0 e 20 litros."), recovery: z.string().max(40).nullable().optional(),
    })).mutation(({ ctx, input }) => {
      const todayInPortugal = lisbonDate();
      if (input.activityDate !== todayInPortugal) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only the current calendar day can be registered." });
      }
      return saveDailyLog({ ...input, userId: ctx.user.id });
    }),
    analyzeMeals: protectedProcedure.input(z.object({ activityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), language: z.enum(["pt", "en", "es"]) })).mutation(async ({ ctx, input }) => {
      const today = lisbonDate();
      if (input.activityDate !== today) throw new TRPCError({ code: "BAD_REQUEST", message: "A análise alimentar pode ser registrada apenas para o dia atual." });
      await requirePremium(ctx.user.id);
      const daily = await getDailyLog(ctx.user.id, today);
      if (!daily?.mealsNote?.trim()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Registre primeiro o que você comeu hoje." });
      const result = await runNutritionAnalysis({ language: input.language, foodsRecorded: daily.mealsNote, waterLiters: daily.waterLiters, objective: (await getCurrentAssessment(ctx.user.id, currentWeekStart()))?.objective ?? null });
      await saveDailyLog({ userId: ctx.user.id, activityDate: today, workoutId: daily.workoutId, completedCount: daily.completedCount, completedExercises: daily.completedExercises, cardioMinutes: daily.cardioMinutes, mealsNote: daily.mealsNote, mealAnalysisJson: JSON.stringify(result), waterLiters: daily.waterLiters, recovery: daily.recovery });
      return result;
    }),
    analyzeSmartwatchPhoto: protectedProcedure.input(z.object({
      sessionId: z.string().uuid(),
      kind: z.enum(["workout", "cardio"]).default("cardio"),
      modality: z.enum(["Treino", "Esteira", "Bicicleta", "Corrida livre"]),
      dataUrl: z.string().regex(/^data:image\/(?:jpeg|png|webp);base64,/).max(3_000_000),
      language: z.enum(["pt", "en", "es"]),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Banco indisponível." });
      const [session] = await db.select().from(trainingSessions).where(and(eq(trainingSessions.id, input.sessionId), eq(trainingSessions.userId, ctx.user.id), eq(trainingSessions.experience, ctx.user.experience ?? "man")));
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada." });
      if (session.status !== "completed") assertToday(session.activityDate);

      const image = decodeBodyImage(input.dataUrl, 2_000_000);
      const response = await runSmartwatchPhoto({ language: input.language, mimeType: image.mimeType, data: image.data });
      return z.object({ activityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), activityType: z.string().max(100).nullable(), durationMinutes: z.number().int().min(0).max(100000).nullable(), activeCaloriesKcal: z.number().int().min(0).max(1000000).nullable(), totalCaloriesKcal: z.number().int().min(0).max(1000000).nullable(), averageHeartRate: z.number().int().min(0).max(300).nullable(), maxHeartRate: z.number().int().min(0).max(300).nullable(), distanceKm: z.number().min(0).max(100000).nullable(), steps: z.number().int().min(0).max(500000).nullable(), pace: z.string().max(80).nullable(), speedKmh: z.number().min(0).max(500).nullable(), heartRateZones: z.array(z.string().max(120)).max(8), otherMetrics: z.array(z.string().max(160)).max(8), confidence: z.enum(["low", "medium", "high"]) }).parse(JSON.parse(response.text));
    }),
    confirmSmartwatchPhoto: protectedProcedure.input(z.object({
      sessionId: z.string().uuid(),
      kind: z.enum(["workout", "cardio"]).default("cardio"),
      modality: z.enum(["Treino", "Esteira", "Bicicleta", "Corrida livre"]),
      dataUrl: z.string().regex(/^data:image\/(?:jpeg|png|webp);base64,/).max(3_000_000).optional(),
      photoKey: z.string().max(255).optional(),
      result: z.object({ activityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), activityType: z.string().max(100).nullable(), durationMinutes: z.number().int().min(0).max(100000).nullable(), activeCaloriesKcal: z.number().int().min(0).max(1000000).nullable(), totalCaloriesKcal: z.number().int().min(0).max(1000000).nullable(), averageHeartRate: z.number().int().min(0).max(300).nullable(), maxHeartRate: z.number().int().min(0).max(300).nullable(), distanceKm: z.number().min(0).max(100000).nullable(), steps: z.number().int().min(0).max(500000).nullable(), pace: z.string().max(80).nullable(), speedKmh: z.number().min(0).max(500).nullable(), heartRateZones: z.array(z.string().max(120)).max(8), otherMetrics: z.array(z.string().max(160)).max(8), confidence: z.enum(["low", "medium", "high"]) }),
    }).refine(input => Boolean(input.dataUrl) !== Boolean(input.photoKey), "Envie uma foto ou use a foto desta sessão.")).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Banco indisponível." });
      const [session] = await db.select().from(trainingSessions).where(and(eq(trainingSessions.id, input.sessionId), eq(trainingSessions.userId, ctx.user.id), eq(trainingSessions.experience, ctx.user.experience ?? "man")));
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada." });
      if (session.status !== "completed") assertToday(session.activityDate);

      let uploaded: { key: string } | null = null;
      if (input.dataUrl) {
        const image = decodeBodyImage(input.dataUrl, 2_000_000);
        uploaded = await storagePut(`fitness/${ctx.user.id}/${crypto.randomUUID()}.${image.mimeType === "image/png" ? "png" : image.mimeType === "image/webp" ? "webp" : "jpg"}`, image.data, image.mimeType);
      }
      const photoKey = uploaded?.key ?? input.photoKey!;
      try {
        await db.transaction(async tx => {
          const [current] = await tx.select().from(trainingSessions).where(and(eq(trainingSessions.id, input.sessionId), eq(trainingSessions.userId, ctx.user.id), eq(trainingSessions.experience, ctx.user.experience ?? "man"))).for("update");
          if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada." });
          if (current.status !== "completed") assertToday(current.activityDate);
          const previous = current.smartwatchJson ? JSON.parse(current.smartwatchJson) : null;
          const legacy = previous?.photoKey ? previous : null;
          const existingWorkout = previous?.workout ?? null;
          const existingCardio = previous?.cardio ?? legacy;
          const selected = input.kind === "workout" ? existingWorkout : existingCardio;
          if (input.photoKey && selected?.photoKey !== input.photoKey) throw new TRPCError({ code: "FORBIDDEN", message: "A foto não pertence a este registro da sessão." });
          const record = { photoKey, modality: input.kind === "workout" ? "Treino" : input.modality, metrics: input.result, confirmedByUser: true };
          const nextSmartwatch = { workout: input.kind === "workout" ? record : existingWorkout, cardio: input.kind === "cardio" ? record : existingCardio };
          await tx.insert(fitnessRevisions).values({ userId: ctx.user.id, entityId: current.id, kind: "session_smartwatch", previousJson: JSON.stringify(current) });
          await tx.update(trainingSessions).set({ smartwatchJson: JSON.stringify(nextSmartwatch), summary: null }).where(eq(trainingSessions.id, current.id));
        });
      } catch (error) { if (uploaded) await storageRemove(uploaded.key); throw error; }
      return { success: true as const };

    }),
    wearableConnections: protectedProcedure.query(({ ctx }) => getWearableConnections(ctx.user.id)),
    wearableActivities: protectedProcedure.input(z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).query(({ ctx, input }) =>
      getWearableActivities(ctx.user.id, input.from, input.to)),
    weeklyActivityAnalysis: protectedProcedure.input(z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).query(({ ctx, input }) =>
      getWeeklyActivityAnalysis(ctx.user.id, input.from, input.to, input.weekStart, ctx.user.experience ?? "man")),
    analyzeWeeklyWearable: protectedProcedure.input(z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), language: z.enum(["pt", "en", "es"]) })).mutation(async ({ ctx, input }) => {
      await requirePremium(ctx.user.id);
      const analysis = await getWeeklyActivityAnalysis(ctx.user.id, input.from, input.to, input.weekStart, ctx.user.experience ?? "man");
      if (!analysis.wearableDataAvailable || !analysis.metricsSufficient) return { sufficient: false, source: "rules" as const, summary: "Ainda não há dados suficientes sincronizados do wearable para comparar a semana. Sincronize novamente após usar o dispositivo.", recommendations: [] as string[] };
      const [assessment, daily] = await Promise.all([getCurrentAssessment(ctx.user.id, input.weekStart), getDailyHistory(ctx.user.id, input.from, input.to)]);
      try {
        const result = await runWeeklyWearable({ language: input.language, wearableWeek: analysis, assessment, dailyLogs: daily.map(row => ({ date: row.activityDate, meals: row.mealsNote, waterLiters: row.waterLiters, cardioMinutes: row.cardioMinutes, recovery: row.recovery, workoutId: row.workoutId, completedCount: row.completedCount })) });
        const content = result.text;
        const parsed = z.object({ summary: z.string().min(15).max(1200), recommendations: z.array(z.string().min(3).max(300)).max(3) }).parse(JSON.parse(content));
        return { sufficient: true, source: "ai" as const, ...parsed };
      } catch (error) {
        console.warn("[WeeklyWearable] AI analysis unavailable");
        return { sufficient: true, source: "rules" as const, summary: "A análise por IA está temporariamente indisponível. As métricas sincronizadas continuam disponíveis acima.", recommendations: [] as string[] };
      }
    }),
    analyzeDay5: protectedProcedure.input(z.object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), language: z.enum(["pt", "en", "es"]),
      readiness: z.object({ weeklyFeeling: z.string().trim().min(2).max(500), perceivedCapacity: z.enum(["yes","maybe","no"]), soreness: z.boolean(), sorenessRegions: z.array(z.string().trim().min(2).max(40)).max(10), sorenessIntensity: z.enum(["light","moderate","strong"]), selectedWorkoutIds: z.array(z.number().int().positive()).max(20), perceivedPriority: z.string().trim().max(300).optional().default("") })
    })).mutation(async ({ ctx, input }) => {
      if (fifthDayPaused()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "O quinto dia permanece pausado." });
      await requirePremium(ctx.user.id);
      const today = lisbonDate();
      if (input.weekStart !== currentWeekStart() || input.from !== input.weekStart || input.to !== currentWeekEnd()) throw new TRPCError({ code: "BAD_REQUEST", message: "O quinto dia usa apenas a semana de treino atual." });
      const experience = ctx.user.experience ?? "man";
      const [analysis, assessment, history, daily, bodyHistory, sessions] = await Promise.all([
        getWeeklyActivityAnalysis(ctx.user.id, input.from, input.to, input.weekStart, experience), getCurrentAssessment(ctx.user.id, input.weekStart), getAssessmentHistory(ctx.user.id, 12), getDailyHistory(ctx.user.id, input.from, input.to), getBodyAnalysisHistory(ctx.user.id, 2), getRecentTrainingContext(ctx.user.id, input.from, today, experience)
      ]);
      const completedSessions = sessions.filter(s => s.status === "completed");
      const muscleVolume: Record<string, number> = {};
      for (const session of completedSessions) for (const set of session.sets) { const ex = exerciseIds.includes(set.exerciseId as any) ? exerciseById[set.exerciseId as keyof typeof exerciseById] : null; if (ex) muscleVolume[ex.group] = (muscleVolume[ex.group] ?? 0) + 1; }
      const hardStop = input.readiness.perceivedCapacity === "no" || (input.readiness.soreness && input.readiness.sorenessIntensity === "strong") || assessment?.recovery === "very_low" || assessment?.fatigue === "very_high";
      const body = bodyHistory[0] ? JSON.parse(bodyHistory[0].analysisJson) as unknown : null;
      const base = { userReadiness: input.readiness, week: analysis, completedTraining: completedSessions, muscleVolumeConfirmedSets: muscleVolume, weeklyAssessment: assessment, latestBodyAnalysis: body, previousBodyAnalysis: bodyHistory[1] ? JSON.parse(bodyHistory[1].analysisJson) : null, previousAssessments: history.filter(r => r.weekStart !== input.weekStart).slice(0,6), dailyLogs: daily.map(l => ({date:l.activityDate,recovery:l.recovery,workoutId:l.workoutId,completedCount:l.completedCount})), exerciseCatalog: catalogFor(experience), experience };
      if (hardStop) return { decision: "REST" as const, recommendation: "rest" as const, rationale: "Os dados de recuperação informados não justificam acrescentar outro treino de musculação hoje. O descanso tem melhor relação benefício/recuperação.", confidence: "high" as const, source: "rules" as const, userPerceptionAssessment: { supported: false, reason: "A preferência muscular não supera sinais de recuperação insuficiente." }, dataUsed: { completedWorkouts: completedSessions.length, bodyAnalysis: Boolean(body), weeklyAssessment: Boolean(assessment), wearable: analysis.wearableDataAvailable }, historyWeeksConsidered: history.length, exercises: [] };
      try {
        const llmResponse = await runDay5(base); const parsed = z.object({ decision: z.enum(["TRAIN","LIGHT_SESSION","ACTIVE_RECOVERY","REST","INSUFFICIENT_DATA"]), recommendation: z.enum(["recovery","mobility","core","stability","conditioning","technical","complementary","rest"]), rationale: z.string().min(20).max(900), confidence: z.enum(["low","medium","high"]), userPerceptionAssessment: z.object({ supported: z.boolean(), reason: z.string().min(5).max(400) }), exercises: z.array(workoutExerciseSchema.omit({ loadKg: true })).max(5) }).parse(JSON.parse(llmResponse.text));
        assertExperienceExercises(parsed.exercises, experience);
        if (["REST","ACTIVE_RECOVERY","INSUFFICIENT_DATA"].includes(parsed.decision) && parsed.exercises.length) parsed.exercises = [];
        return { ...parsed, exercises: parsed.exercises.map(ex => ({...ex,loadKg:null,name:exerciseById[ex.exerciseId].name,prescription:String(ex.sets)+" × "+ex.reps})), source:"ai" as const, dataUsed:{completedWorkouts:completedSessions.length,bodyAnalysis:Boolean(body),weeklyAssessment:Boolean(assessment),wearable:analysis.wearableDataAvailable}, historyWeeksConsidered:history.length };
      } catch (error) { console.warn("[Day5] AI decision unavailable", error instanceof Error ? error.message : "unknown"); return { decision:"INSUFFICIENT_DATA" as const,recommendation:"rest" as const,rationale:"Não foi possível validar dados suficientes para gerar um quinto treino com segurança agora.",confidence:"low" as const,source:"rules" as const,userPerceptionAssessment:{supported:false,reason:"A percepção foi registada, mas não pôde ser validada com segurança."},dataUsed:{completedWorkouts:completedSessions.length,bodyAnalysis:Boolean(body),weeklyAssessment:Boolean(assessment),wearable:analysis.wearableDataAvailable},historyWeeksConsidered:history.length,exercises:[] }; }
    }),
    requestWearableConnection: protectedProcedure.input(z.object({ provider: z.enum(["coros", "google_health", "garmin", "apple_health", "health_connect"]) })).mutation(async ({ ctx, input }) => {
      if (input.provider === "apple_health" || input.provider === "health_connect") {
        return { status: "integration_unavailable" as const, authorizationUrl: null, message: "Esta plataforma necessita de uma aplicação móvel com bridge nativo e permissões do sistema. Não há ligação web disponível." };
      }
      return beginWearableOAuth(ctx.user.id, input.provider);
    }),
    requestWearableSync: protectedProcedure.input(z.object({ provider: z.enum(["coros", "google_health", "garmin", "apple_health", "health_connect"]), from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).mutation(async ({ ctx, input }) => {
      if (input.provider === "apple_health" || input.provider === "health_connect") return { status: "integration_unavailable" as const, imported: 0, message: "É necessário um bridge nativo com permissão do utilizador." };
      const today = lisbonDate();
      const from = input.from > today ? today : input.from;
      const to = input.to > today ? today : input.to;
      if (from > to) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid wearable sync date range." });
      if (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`) > 13 * 24 * 60 * 60 * 1000) throw new TRPCError({ code: "BAD_REQUEST", message: "Wearable sync is limited to 14 days per request." });
      return syncWearable(ctx.user.id, input.provider, from, to);
    }),
    disconnectWearable: protectedProcedure.input(z.object({ provider: z.enum(["coros", "google_health", "garmin", "apple_health", "health_connect"]) })).mutation(({ ctx, input }) => disconnectWearableAccount(ctx.user.id, input.provider)),
    ingestWearableActivity: protectedProcedure.input(z.object({
      provider: z.enum(["coros", "google_health", "garmin", "apple_health", "health_connect"]),
      externalId: z.string().min(1).max(160), activityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), activityStartedAt: z.coerce.date().nullable().optional(),
      activityType: z.string().max(80).nullable().optional(), durationMinutes: z.number().int().min(0).max(100000).nullable().optional(), caloriesKcal: z.number().int().min(0).max(1000000).nullable().optional(),
      averageHeartRate: z.number().int().min(0).max(300).nullable().optional(), maxHeartRate: z.number().int().min(0).max(300).nullable().optional(), steps: z.number().int().min(0).max(200000).nullable().optional(),
      distanceKm: z.string().max(16).nullable().optional(), cardioMinutes: z.number().int().min(0).max(100000).nullable().optional(), sleepMinutes: z.number().int().min(0).max(2000).nullable().optional(), recoveryNote: z.string().max(120).nullable().optional(), rawMetrics: z.string().max(10000).nullable().optional(),
    })).mutation(({ ctx, input }) => ingestWearableActivity({ ...input, sourceType: "manual_import", userId: ctx.user.id })),
  }),
});

export type AppRouter = typeof appRouter;
