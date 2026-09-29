import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { BodyAnalysis, InsertUser, bodyAnalyses, dailyLogs, mercadoPagoWebhookEvents, subscriptionPayments, subscriptionPlans, userSubscriptions, users, wearableActivities, wearableConnections, wearableOauthStates, wearableDailySummaries, weeklyAssessments, workoutPlans } from "../drizzle/schema";
import { ENV } from './_core/env';
import { canClaimWebhookEvent } from "./mercadopago";
import { mysqlConnectionOptions } from "./_core/mysql-connection";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle({ connection: mysqlConnectionOptions(process.env.DATABASE_URL) });
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

export async function createLocalUser(input: { name: string; email: string; passwordHash: string; openId: string; termsAcceptedAt: Date; privacyAcceptedAt: Date }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(users).values({ ...input, loginMethod: "password", lastSignedIn: new Date() });
  return getUserByEmail(input.email);
}

export async function createOAuthUser(input: { name: string; email: string; provider: "google" | "apple"; providerId: string; termsAcceptedAt: Date; privacyAcceptedAt: Date }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(users).values({
    openId: `${input.provider}:${input.providerId}`.slice(0, 64),
    name: input.name,
    email: input.email,
    passwordHash: null,
    loginMethod: input.provider,
    termsAcceptedAt: input.termsAcceptedAt,
    privacyAcceptedAt: input.privacyAcceptedAt,
    lastSignedIn: new Date(),
  });
  return getUserByEmail(input.email);
}

export async function updateUserName(userId: number, name: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(users).set({ name, updatedAt: new Date() }).where(eq(users.id, userId));
  return getUserById(userId);
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(users).set({ passwordHash, sessionVersion: sql`${users.sessionVersion} + 1`, updatedAt: new Date() }).where(eq(users.id, userId));
  return getUserById(userId);
}

export async function setUserLastSignedIn(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ lastSignedIn: new Date(), updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function invalidateUserSessions(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(users)
    .set({ sessionVersion: sql`${users.sessionVersion} + 1`, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserProfileImage(userId: number, profileImageKey: string | null, profileImageUrl: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(users).set({ profileImageKey, profileImageUrl, updatedAt: new Date() }).where(eq(users.id, userId));
  return db.select().from(users).where(eq(users.id, userId)).limit(1).then(rows => rows[0]);
}

export async function getLatestUserSubscription(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const rows = await db.select().from(userSubscriptions).where(eq(userSubscriptions.userId, userId)).orderBy(desc(userSubscriptions.createdAt), desc(userSubscriptions.id)).limit(1);
  return rows[0] ?? null;
}

export async function getSubscriptionByProviderId(providerSubscriptionId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const rows = await db.select().from(userSubscriptions).where(eq(userSubscriptions.providerSubscriptionId, providerSubscriptionId)).limit(1);
  return rows[0] ?? null;
}

export async function getSubscriptionByExternalReference(externalReference: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const rows = await db.select().from(userSubscriptions).where(eq(userSubscriptions.externalReference, externalReference)).limit(1);
  return rows[0] ?? null;
}

export async function getUserPremiumState(userId: number) {
  const subscription = await getLatestUserSubscription(userId);
  return subscription;
}

export async function createPendingSubscription(input: {
  userId: number; planCode: string; planName: string; amount: string; currency: string; externalReference: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const now = new Date();
  await db.insert(subscriptionPlans).values({ code: input.planCode, name: input.planName, interval: "month", amount: input.amount, currency: input.currency, active: 1 })
    .onDuplicateKeyUpdate({ set: { name: input.planName, amount: input.amount, currency: input.currency, active: 1, updatedAt: now } });
  await db.insert(userSubscriptions).values({
    userId: input.userId, planCode: input.planCode, provider: "mercadopago", status: "pending",
    externalReference: input.externalReference, providerSubscriptionId: null, checkoutUrl: null,
    amount: input.amount, currency: input.currency,
    currentPeriodStart: now,
  });
  return getLatestUserSubscription(input.userId);
}

export async function attachMercadoPagoCheckout(id: number, input: { providerSubscriptionId: string; checkoutUrl: string; periodStart?: Date | null; periodEnd?: Date | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(userSubscriptions).set({
    providerSubscriptionId: input.providerSubscriptionId, checkoutUrl: input.checkoutUrl,
    currentPeriodStart: input.periodStart ?? new Date(), currentPeriodEnd: input.periodEnd ?? null, updatedAt: new Date(),
  }).where(eq(userSubscriptions.id, id));
}

export async function updateSubscriptionByProviderId(providerSubscriptionId: string, input: {
  localId?: number;
  status: "pending" | "active" | "payment_pending" | "cancelled" | "expired" | "error";
  periodStart?: Date | null; periodEnd?: Date | null; cancelledAt?: Date | null; expiredAt?: Date | null;
  lastPaymentId?: string | null; lastPaymentStatus?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const patch: Record<string, unknown> = { status: input.status, updatedAt: new Date() };
  if (input.periodStart !== undefined) patch.currentPeriodStart = input.periodStart;
  if (input.periodEnd !== undefined) patch.currentPeriodEnd = input.periodEnd;
  if (input.cancelledAt !== undefined) patch.cancelledAt = input.cancelledAt;
  if (input.expiredAt !== undefined) patch.expiredAt = input.expiredAt;
  if (input.lastPaymentId !== undefined) patch.lastPaymentId = input.lastPaymentId;
  if (input.lastPaymentStatus !== undefined) patch.lastPaymentStatus = input.lastPaymentStatus;
  await db.update(userSubscriptions).set(patch).where(input.localId !== undefined ? eq(userSubscriptions.id, input.localId) : eq(userSubscriptions.providerSubscriptionId, providerSubscriptionId));
  return getSubscriptionByProviderId(providerSubscriptionId);
}

export async function upsertSubscriptionPayment(input: {
  subscriptionId: number; userId: number; providerPaymentId: string; status: string;
  amount?: string | null; currency?: string | null; paidAt?: Date | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(subscriptionPayments).values(input).onDuplicateKeyUpdate({ set: {
    status: input.status, amount: input.amount ?? null, currency: input.currency ?? null,
    paidAt: input.paidAt ?? null, updatedAt: new Date(),
  } });
}

export async function beginMercadoPagoWebhookEvent(input: { eventKey: string; topic: string; resourceId: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const now = new Date();
  return db.transaction(async tx => {
    // The unique-key upsert takes an InnoDB row lock. The following read/update
    // occurs in the same transaction, so simultaneous deliveries cannot both claim it.
    await tx.insert(mercadoPagoWebhookEvents).values({ ...input, status: "queued", processingAt: null })
      .onDuplicateKeyUpdate({ set: { eventKey: input.eventKey } });
    const rows = await tx.select().from(mercadoPagoWebhookEvents)
      .where(eq(mercadoPagoWebhookEvents.eventKey, input.eventKey)).for("update").limit(1);
    const event = rows[0];
    if (!event || !canClaimWebhookEvent(event.status, event.processingAt, now)) return false;
    await tx.update(mercadoPagoWebhookEvents)
      .set({ status: "processing", processingAt: now, processedAt: null })
      .where(eq(mercadoPagoWebhookEvents.id, event.id));
    return true;
  });
}

export async function finishMercadoPagoWebhookEvent(eventKey: string, status: "processed" | "failed") {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(mercadoPagoWebhookEvents).set({ status, processingAt: null, processedAt: status === "processed" ? new Date() : null }).where(eq(mercadoPagoWebhookEvents.eventKey, eventKey));
}

export async function getCurrentAssessment(userId: number, weekStart: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(weeklyAssessments)
    .where(and(eq(weeklyAssessments.userId, userId), eq(weeklyAssessments.weekStart, weekStart)))
    .limit(1);
  return result[0];
}

export async function getAssessmentHistory(userId: number, limit = 12) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(weeklyAssessments)
    .where(eq(weeklyAssessments.userId, userId))
    .orderBy(desc(weeklyAssessments.weekStart))
    .limit(limit);
}

export async function saveAssessment(input: {
  userId: number; weekStart: string; objective: string; heightCm: number;
  benchPressLevel: string; squatLevel: string; cardio: string; sleep: string;
  recovery: string; fatigue: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(weeklyAssessments).values(input).onDuplicateKeyUpdate({
    set: {
      objective: input.objective, heightCm: input.heightCm,
      benchPressLevel: input.benchPressLevel, squatLevel: input.squatLevel,
      cardio: input.cardio, sleep: input.sleep, recovery: input.recovery,
      fatigue: input.fatigue, updatedAt: new Date(),
    },
  });
  return getCurrentAssessment(input.userId, input.weekStart);
}

export async function clearCurrentAssessment(userId: number, weekStart: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(weeklyAssessments)
    .where(and(eq(weeklyAssessments.userId, userId), eq(weeklyAssessments.weekStart, weekStart)));
  return { success: true as const };
}

export async function getWorkoutPlans(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(workoutPlans).where(eq(workoutPlans.userId, userId)).orderBy(desc(workoutPlans.updatedAt));
}

export async function createWorkoutPlan(input: {
  userId: number; source: "manual" | "ai" | "customized" | "day5"; baseWorkoutId?: string | null;
  name: string; objective: string; focusGroup: string; durationMinutes: number; notes?: string | null; exercisesJson: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(workoutPlans).values(input);
  const id = Number(result[0].insertId);
  const rows = await db.select().from(workoutPlans).where(and(eq(workoutPlans.id, id), eq(workoutPlans.userId, input.userId))).limit(1);
  return rows[0];
}

export async function updateWorkoutPlan(userId: number, id: number, input: {
  name: string; objective: string; focusGroup: string; durationMinutes: number; notes?: string | null; exercisesJson: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(workoutPlans).set({ ...input, updatedAt: new Date() }).where(and(eq(workoutPlans.id, id), eq(workoutPlans.userId, userId)));
  const rows = await db.select().from(workoutPlans).where(and(eq(workoutPlans.id, id), eq(workoutPlans.userId, userId))).limit(1);
  return rows[0];
}

export async function deleteWorkoutPlan(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.delete(workoutPlans).where(and(eq(workoutPlans.id, id), eq(workoutPlans.userId, userId)));
  return Number(result[0].affectedRows) > 0;
}

export async function deleteAllUserData(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(wearableActivities).where(eq(wearableActivities.userId, userId));
  await db.delete(wearableDailySummaries).where(eq(wearableDailySummaries.userId, userId));
  await db.delete(wearableOauthStates).where(eq(wearableOauthStates.userId, userId));
  await db.delete(wearableConnections).where(eq(wearableConnections.userId, userId));
  await db.delete(dailyLogs).where(eq(dailyLogs.userId, userId));
  await db.delete(workoutPlans).where(eq(workoutPlans.userId, userId));
  await db.delete(bodyAnalyses).where(eq(bodyAnalyses.userId, userId));
  await db.delete(weeklyAssessments).where(eq(weeklyAssessments.userId, userId));
  await db.delete(subscriptionPayments).where(eq(subscriptionPayments.userId, userId));
  await db.delete(userSubscriptions).where(eq(userSubscriptions.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
  return { success: true as const };
}

export async function resetUserProgress(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(wearableActivities).where(eq(wearableActivities.userId, userId));
  await db.delete(wearableDailySummaries).where(eq(wearableDailySummaries.userId, userId));
  await db.delete(wearableOauthStates).where(eq(wearableOauthStates.userId, userId));
  await db.delete(wearableConnections).where(eq(wearableConnections.userId, userId));
  await db.delete(dailyLogs).where(eq(dailyLogs.userId, userId));
  await db.delete(workoutPlans).where(eq(workoutPlans.userId, userId));
  await db.delete(bodyAnalyses).where(eq(bodyAnalyses.userId, userId));
  await db.delete(weeklyAssessments).where(eq(weeklyAssessments.userId, userId));
  return { success: true as const };
}

export async function getBodyAnalysisHistory(userId: number, limit = 12) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bodyAnalyses).where(eq(bodyAnalyses.userId, userId))
    .orderBy(desc(bodyAnalyses.analysisMonth)).limit(limit);
}

export async function saveBodyAnalysis(input: Omit<BodyAnalysis, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(bodyAnalyses).values(input).onDuplicateKeyUpdate({ set: {
    objective: input.objective, photoKeys: input.photoKeys,
    bodyFatEstimatePercent: input.bodyFatEstimatePercent,
    confidencePercent: input.confidencePercent, analysisJson: input.analysisJson,
    updatedAt: new Date(),
  } });
  const rows = await db.select().from(bodyAnalyses)
    .where(and(eq(bodyAnalyses.userId, input.userId), eq(bodyAnalyses.analysisMonth, input.analysisMonth))).limit(1);
  return rows[0];
}

export async function getDailyLog(userId: number, activityDate: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(dailyLogs)
    .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.activityDate, activityDate)))
    .limit(1);
  return result[0];
}

export async function getDailyHistory(userId: number, from: string, to: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(dailyLogs)
    .where(and(eq(dailyLogs.userId, userId), gte(dailyLogs.activityDate, from), lte(dailyLogs.activityDate, to)))
    .orderBy(desc(dailyLogs.activityDate));
}

export async function saveDailyLog(input: {
  userId: number; activityDate: string; workoutId?: string | null; completedCount: number;
  completedExercises?: string | null; cardioMinutes?: number | null; mealsNote?: string | null;
  mealAnalysisJson?: string | null; waterLiters?: string | null; recovery?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(dailyLogs).values(input).onDuplicateKeyUpdate({
    set: {
      workoutId: input.workoutId ?? null, completedCount: input.completedCount,
      completedExercises: input.completedExercises ?? null,
      cardioMinutes: input.cardioMinutes ?? null, mealsNote: input.mealsNote ?? null,
      mealAnalysisJson: input.mealAnalysisJson ?? null,
      waterLiters: input.waterLiters ?? null, recovery: input.recovery ?? null,
      updatedAt: new Date(),
    },
  });
  return getDailyLog(input.userId, input.activityDate);
}

export async function getWearableConnections(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: wearableConnections.id, userId: wearableConnections.userId, provider: wearableConnections.provider,
    status: wearableConnections.status, connectedAt: wearableConnections.connectedAt,
    lastSyncedAt: wearableConnections.lastSyncedAt, tokenExpiresAt: wearableConnections.tokenExpiresAt,
    grantedScopes: wearableConnections.grantedScopes, timeZone: wearableConnections.timeZone,
    lastSyncStatus: wearableConnections.lastSyncStatus, lastSyncError: wearableConnections.lastSyncError,
    createdAt: wearableConnections.createdAt, updatedAt: wearableConnections.updatedAt,
  }).from(wearableConnections).where(eq(wearableConnections.userId, userId));
}

export async function upsertWearableConnection(input: {
  userId: number; provider: string; status: string; connectedAt?: Date | null; lastSyncedAt?: Date | null;
  lastSyncStatus?: string; lastSyncError?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const set: Record<string, unknown> = { status: input.status, updatedAt: new Date() };
  if (input.connectedAt !== undefined) set.connectedAt = input.connectedAt;
  if (input.lastSyncedAt !== undefined) set.lastSyncedAt = input.lastSyncedAt;
  if (input.lastSyncStatus !== undefined) set.lastSyncStatus = input.lastSyncStatus;
  if (input.lastSyncError !== undefined) set.lastSyncError = input.lastSyncError;
  await db.insert(wearableConnections).values(input).onDuplicateKeyUpdate({ set });
  const rows = await db.select().from(wearableConnections).where(and(eq(wearableConnections.userId, input.userId), eq(wearableConnections.provider, input.provider))).limit(1);
  return rows[0];
}

export async function getWearableConnectionPrivate(userId: number, provider: string) {
  const db = await getDb(); if (!db) return undefined;
  const rows = await db.select().from(wearableConnections)
    .where(and(eq(wearableConnections.userId, userId), eq(wearableConnections.provider, provider))).limit(1);
  return rows[0];
}

export async function saveWearableOAuthState(input: { stateHash: string; userId: number; provider: string; verifierEncrypted: string | null; expiresAt: Date }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  await db.delete(wearableOauthStates).where(lte(wearableOauthStates.expiresAt, new Date()));
  await db.insert(wearableOauthStates).values(input);
}

export async function consumeWearableOAuthState(stateHash: string) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const rows = await db.select().from(wearableOauthStates).where(eq(wearableOauthStates.stateHash, stateHash)).limit(1);
  await db.delete(wearableOauthStates).where(eq(wearableOauthStates.stateHash, stateHash));
  const row = rows[0];
  return row && row.expiresAt.getTime() > Date.now() ? row : undefined;
}

export async function saveWearableTokens(input: {
  userId: number; provider: string; tokenPayloadEncrypted: string; tokenExpiresAt: Date | null;
  grantedScopes: string | null; timeZone: string | null;
}) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  await db.insert(wearableConnections).values({
    userId: input.userId, provider: input.provider, status: "connected", connectedAt: new Date(),
    tokenPayloadEncrypted: input.tokenPayloadEncrypted, tokenExpiresAt: input.tokenExpiresAt,
    grantedScopes: input.grantedScopes, timeZone: input.timeZone, lastSyncStatus: "never_synced",
  }).onDuplicateKeyUpdate({ set: {
    status: "connected", connectedAt: new Date(), tokenPayloadEncrypted: input.tokenPayloadEncrypted,
    tokenExpiresAt: input.tokenExpiresAt, grantedScopes: input.grantedScopes,
    timeZone: input.timeZone, lastSyncStatus: "never_synced", lastSyncError: null, updatedAt: new Date(),
  } });
}

export async function refreshWearableAccessToken(input: { userId: number; provider: string; tokenPayloadEncrypted: string; tokenExpiresAt: Date | null }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  await db.update(wearableConnections).set({ tokenPayloadEncrypted: input.tokenPayloadEncrypted, tokenExpiresAt: input.tokenExpiresAt, updatedAt: new Date() })
    .where(and(eq(wearableConnections.userId, input.userId), eq(wearableConnections.provider, input.provider)));
}

export async function saveWearableDailySummary(input: {
  userId: number; provider: string; activityDate: string; timeZone?: string | null;
  workoutCaloriesKcal?: number | null; activityCaloriesKcal?: number | null; totalCaloriesKcal?: number | null;
  durationMinutes?: number | null; cardioMinutes?: number | null; distanceKm?: string | null; steps?: number | null;
  averageHeartRate?: number | null; minHeartRate?: number | null; maxHeartRate?: number | null;
  sleepMinutes?: number | null; recoveryScore?: number | null; recoveryNote?: string | null; activityCount?: number | null;
}) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const row = { ...input, syncedAt: new Date() };
  const set: Record<string, unknown> = { syncedAt: new Date(), updatedAt: new Date() };
  for (const [key, value] of Object.entries(input)) if (value !== undefined && value !== null && key !== "userId" && key !== "provider" && key !== "activityDate") set[key] = value;
  await db.insert(wearableDailySummaries).values(row).onDuplicateKeyUpdate({ set });
}

export async function getWearableDailySummaries(userId: number, from: string, to: string) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(wearableDailySummaries)
    .where(and(eq(wearableDailySummaries.userId, userId), gte(wearableDailySummaries.activityDate, from), lte(wearableDailySummaries.activityDate, to)))
    .orderBy(desc(wearableDailySummaries.activityDate));
}

export async function updateWearableSyncState(input: { userId: number; provider: string; status: string; lastSyncStatus: string; lastSyncError?: string | null; lastSyncedAt?: Date }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const set: Record<string, unknown> = { status: input.status, lastSyncStatus: input.lastSyncStatus, lastSyncError: input.lastSyncError ?? null, updatedAt: new Date() };
  if (input.lastSyncedAt) set.lastSyncedAt = input.lastSyncedAt;
  await db.update(wearableConnections).set(set)
    .where(and(eq(wearableConnections.userId, input.userId), eq(wearableConnections.provider, input.provider)));
}

export async function disconnectWearable(userId: number, provider: string) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  await db.update(wearableConnections).set({ status: "disconnected", tokenPayloadEncrypted: null, tokenExpiresAt: null, grantedScopes: null, connectedAt: null, lastSyncStatus: "disconnected", lastSyncError: null, updatedAt: new Date() })
    .where(and(eq(wearableConnections.userId, userId), eq(wearableConnections.provider, provider)));
}

export async function getWearableActivities(userId: number, from: string, to: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(wearableActivities)
    .where(and(eq(wearableActivities.userId, userId), gte(wearableActivities.activityDate, from), lte(wearableActivities.activityDate, to)))
    .orderBy(desc(wearableActivities.activityDate), desc(wearableActivities.activityStartedAt));
}

export async function ingestWearableActivity(input: {
  userId: number; provider: string; externalId: string; activityDate: string; activityStartedAt?: Date | null;
  activityType?: string | null; durationMinutes?: number | null; caloriesKcal?: number | null;
  activityCaloriesKcal?: number | null; totalCaloriesKcal?: number | null;
  averageHeartRate?: number | null; maxHeartRate?: number | null; steps?: number | null;
  distanceKm?: string | null; cardioMinutes?: number | null; sleepMinutes?: number | null;
  recoveryNote?: string | null; rawMetrics?: string | null; sourceType?: string; sourceTimeZone?: string | null; utcOffsetMinutes?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const set: Record<string, unknown> = { activityDate: input.activityDate, updatedAt: new Date() };
  for (const key of ["activityStartedAt", "activityType", "durationMinutes", "caloriesKcal", "activityCaloriesKcal", "totalCaloriesKcal", "averageHeartRate", "maxHeartRate", "steps", "distanceKm", "cardioMinutes", "sleepMinutes", "recoveryNote", "rawMetrics", "sourceType", "sourceTimeZone", "utcOffsetMinutes"] as const) {
    const value = input[key];
    if (value !== undefined && value !== null) set[key] = value;
  }
  await db.insert(wearableActivities).values(input).onDuplicateKeyUpdate({ set });
  const rows = await db.select().from(wearableActivities).where(and(eq(wearableActivities.userId, input.userId), eq(wearableActivities.provider, input.provider), eq(wearableActivities.externalId, input.externalId))).limit(1);
  return rows[0];
}

export async function getWeeklyActivityAnalysis(userId: number, from: string, to: string, weekStart: string) {
  const previousStartDate = new Date(`${weekStart}T00:00:00Z`); previousStartDate.setUTCDate(previousStartDate.getUTCDate() - 7);
  const previousStart = previousStartDate.toISOString().slice(0, 10);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: ENV.appTimeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const effectiveEnd = to > today ? today : to;
  const elapsedDays = Math.max(0, Math.floor((Date.parse(`${effectiveEnd}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1);
  const previousEndDate = new Date(`${weekStart}T00:00:00Z`);
  previousEndDate.setUTCDate(previousEndDate.getUTCDate() + (to > today ? elapsedDays - 8 : -1));
  const previousEnd = previousEndDate.toISOString().slice(0, 10);
  const [allActivities, allSummaries, logs, assessment, assessmentHistory, allPreviousActivities, allPreviousSummaries, previousLogs] = await Promise.all([
    getWearableActivities(userId, from, to),
    getWearableDailySummaries(userId, from, to),
    getDailyHistory(userId, from, to),
    getCurrentAssessment(userId, weekStart),
    getAssessmentHistory(userId, 12),
    getWearableActivities(userId, previousStart, previousEnd),
    getWearableDailySummaries(userId, previousStart, previousEnd),
    getDailyHistory(userId, previousStart, previousEnd),
  ]);
  const collapseDailySummaries = (rows: Awaited<ReturnType<typeof getWearableDailySummaries>>) => {
    const grouped = new Map<string, typeof rows>();
    for (const row of rows) grouped.set(row.activityDate, [...(grouped.get(row.activityDate) ?? []), row]);
    return Array.from(grouped.values()).map(dayRows => {
      const first = dayRows[0];
      const maxOf = (field: "workoutCaloriesKcal" | "activityCaloriesKcal" | "totalCaloriesKcal" | "durationMinutes" | "cardioMinutes" | "steps" | "sleepMinutes" | "maxHeartRate" | "activityCount") => {
        const values = dayRows.map(row => row[field]).filter((value): value is number => typeof value === "number");
        return values.length ? Math.max(...values) : null;
      };
      const minValues = dayRows.map(row => row.minHeartRate).filter((value): value is number => typeof value === "number");
      const distances = dayRows.map(row => row.distanceKm == null ? null : Number(row.distanceKm)).filter((value): value is number => Number.isFinite(value));
      return { ...first, workoutCaloriesKcal: maxOf("workoutCaloriesKcal"), activityCaloriesKcal: maxOf("activityCaloriesKcal"), totalCaloriesKcal: maxOf("totalCaloriesKcal"), durationMinutes: maxOf("durationMinutes"), cardioMinutes: maxOf("cardioMinutes"), steps: maxOf("steps"), sleepMinutes: maxOf("sleepMinutes"), maxHeartRate: maxOf("maxHeartRate"), activityCount: maxOf("activityCount"), minHeartRate: minValues.length ? Math.min(...minValues) : null, distanceKm: distances.length ? Math.max(...distances).toFixed(2) : null };
    });
  };
  const dedupeActivities = (rows: typeof allActivities) => {
    const accepted: typeof allActivities = [];
    for (const row of rows.filter(item => item.sourceType === "provider_api")) {
      const start = row.activityStartedAt?.getTime();
      const duration = row.durationMinutes;
      const duplicate = start != null && duration != null && accepted.some(item => item.activityDate === row.activityDate && item.activityStartedAt != null && item.durationMinutes != null && Math.abs(item.activityStartedAt.getTime() - start) <= 120_000 && Math.abs(item.durationMinutes - duration) <= 2);
      if (!duplicate) accepted.push(row);
    }
    return accepted;
  };
  const activities = dedupeActivities(allActivities);
  const summaries = collapseDailySummaries(allSummaries);
  const previousActivities = dedupeActivities(allPreviousActivities);
  const previousSummaries = collapseDailySummaries(allPreviousSummaries);
  const providerActivities = activities;
  const sum = (field: "caloriesKcal" | "durationMinutes" | "cardioMinutes" | "steps" | "sleepMinutes") => {
    const values = providerActivities.map(row => row[field]).filter((value): value is number => typeof value === "number");
    return values.length ? values.reduce((total, value) => total + value, 0) : null;
  };
  const heartRates = providerActivities.map(row => row.averageHeartRate).filter((value): value is number => typeof value === "number");
  const maxHeartRates = providerActivities.map(row => row.maxHeartRate).filter((value): value is number => typeof value === "number");
  const distances = providerActivities.map(row => row.distanceKm == null ? null : Number(row.distanceKm)).filter((value): value is number => Number.isFinite(value));
  const workoutDates = new Set(logs.filter(log => log.workoutId).map(log => log.activityDate));
  const activityDays = new Set(providerActivities.map(row => row.activityDate));
  const activityTypes = Array.from(new Set(providerActivities.map(row => row.activityType).filter((value): value is string => Boolean(value))));
  const recovery = assessment?.recovery ?? logs.find(log => log.recovery)?.recovery ?? null;
  const sumSummary = (field: "workoutCaloriesKcal" | "activityCaloriesKcal" | "totalCaloriesKcal" | "durationMinutes" | "cardioMinutes" | "steps" | "sleepMinutes") => {
    const values = summaries.map(row => row[field]).filter((value): value is number => typeof value === "number");
    return values.length ? values.reduce((total, value) => total + value, 0) : null;
  };
  const summaryHr = summaries.map(row => row.averageHeartRate).filter((v): v is number => typeof v === "number");
  const summaryMaxHr = summaries.map(row => row.maxHeartRate).filter((v): v is number => typeof v === "number");
  const summaryDistance = summaries.map(row => row.distanceKm == null ? null : Number(row.distanceKm)).filter((v): v is number => Number.isFinite(v));
  const manualCalories = sum("caloriesKcal");
  const workoutsCalories = sumSummary("workoutCaloriesKcal");
  const activeCalories = sumSummary("activityCaloriesKcal");
  const totalCalories = sumSummary("totalCaloriesKcal");
  const previousProviderActivities = previousActivities;
  const previousWorkoutDates = new Set(previousLogs.filter(log => log.workoutId).map(log => log.activityDate));
  const previousSummaryTotal = (field: "workoutCaloriesKcal" | "activityCaloriesKcal" | "totalCaloriesKcal" | "durationMinutes" | "steps" | "sleepMinutes") => {
    const values = previousSummaries.map(row => row[field]).filter((value): value is number => typeof value === "number");
    return values.length ? values.reduce((a, b) => a + b, 0) : null;
  };
  const previousActivityDays = new Set(previousProviderActivities.map(row => row.activityDate));
  const delta = (current: number | null, previous: number | null) => current === null || previous === null ? null : current - previous;
  const previousWorkoutCalories = previousSummaryTotal("workoutCaloriesKcal");
  const previousDuration = previousSummaryTotal("durationMinutes");
  const previousSteps = previousSummaryTotal("steps");
  return {
    from, to, workoutsCompleted: workoutDates.size, workoutsTarget: 4,
    caloriesKcal: workoutsCalories ?? manualCalories, workoutCaloriesKcal: workoutsCalories, activityCaloriesKcal: activeCalories, totalCaloriesKcal: totalCalories,
    durationMinutes: sumSummary("durationMinutes") ?? sum("durationMinutes"),
    cardioMinutes: sumSummary("cardioMinutes") ?? sum("cardioMinutes"), steps: sumSummary("steps") ?? sum("steps"), sleepMinutes: sumSummary("sleepMinutes") ?? sum("sleepMinutes"),
    distanceKm: summaryDistance.length ? Number(summaryDistance.reduce((total, value) => total + value, 0).toFixed(2)) : distances.length ? Number(distances.reduce((total, value) => total + value, 0).toFixed(2)) : null,
    averageHeartRate: summaryHr.length ? Math.round(summaryHr.reduce((a, b) => a + b, 0) / summaryHr.length) : heartRates.length ? Math.round(heartRates.reduce((total, value) => total + value, 0) / heartRates.length) : null,
    maxHeartRate: summaryMaxHr.length ? Math.max(...summaryMaxHr) : maxHeartRates.length ? Math.max(...maxHeartRates) : null,
    volumeMinutes: sum("durationMinutes"), previousWeeksConsidered: assessmentHistory.filter(row => row.weekStart !== weekStart).length,
    activityCount: summaries.length || providerActivities.length ? summaries.reduce((n, s) => n + (s.activityCount ?? 0), 0) || providerActivities.length : null, activityDays: summaries.length || activityDays.size ? Math.max(activityDays.size, summaries.length) : null, activityTypes, recovery, assessmentAvailable: Boolean(assessment),
    consistency: { workoutDays: workoutDates.size, workoutTarget: 4, wearableActivityDays: Math.max(activityDays.size, summaries.length) },
    evolution: { comparison: to > today ? "current week to date versus the same weekdays in the previous calendar week" : "current calendar week versus previous calendar week", previousWeek: { from: previousStart, to: previousEnd, workoutsCompleted: previousWorkoutDates.size, activityDays: Math.max(previousActivityDays.size, previousSummaries.length), workoutCaloriesKcal: previousWorkoutCalories, durationMinutes: previousDuration, steps: previousSteps, sleepMinutes: previousSummaryTotal("sleepMinutes"), totalCaloriesKcal: previousSummaryTotal("totalCaloriesKcal") }, change: { workoutsCompleted: delta(workoutDates.size, previousWorkoutDates.size), activityDays: delta(Math.max(activityDays.size, summaries.length), Math.max(previousActivityDays.size, previousSummaries.length)), workoutCaloriesKcal: delta(workoutsCalories, previousWorkoutCalories), durationMinutes: delta(sumSummary("durationMinutes"), previousDuration), steps: delta(sumSummary("steps"), previousSteps) } },
    sources: Array.from(new Set([...allSummaries.map(row => row.provider), ...allActivities.filter(row => row.sourceType === "provider_api").map(row => row.provider)])),
    dataAvailable: providerActivities.length > 0 || summaries.length > 0 || logs.length > 0, wearableDataAvailable: summaries.length > 0 || providerActivities.length > 0,
    metricsSufficient: summaries.length >= 3 || providerActivities.length >= 3, dailySummaries: summaries.map(s => ({ date: s.activityDate, activityCount: s.activityCount, workoutCaloriesKcal: s.workoutCaloriesKcal, activityCaloriesKcal: s.activityCaloriesKcal, totalCaloriesKcal: s.totalCaloriesKcal, steps: s.steps, sleepMinutes: s.sleepMinutes, durationMinutes: s.durationMinutes, distanceKm: s.distanceKm, averageHeartRate: s.averageHeartRate, recoveryScore: s.recoveryScore })),
  };
}
