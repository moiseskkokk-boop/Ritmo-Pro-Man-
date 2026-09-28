import { and, desc, eq, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, dailyLogs, users, wearableActivities, wearableConnections, weeklyAssessments } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
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

export async function createLocalUser(input: { name: string; email: string; passwordHash: string; openId: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(users).values({ ...input, loginMethod: "password", lastSignedIn: new Date() });
  return getUserByEmail(input.email);
}

export async function setUserLastSignedIn(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ lastSignedIn: new Date(), updatedAt: new Date() }).where(eq(users.id, userId));
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

export async function deleteAllUserData(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(wearableActivities).where(eq(wearableActivities.userId, userId));
  await db.delete(wearableConnections).where(eq(wearableConnections.userId, userId));
  await db.delete(dailyLogs).where(eq(dailyLogs.userId, userId));
  await db.delete(weeklyAssessments).where(eq(weeklyAssessments.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
  return { success: true as const };
}

export async function resetUserProgress(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(wearableActivities).where(eq(wearableActivities.userId, userId));
  await db.delete(wearableConnections).where(eq(wearableConnections.userId, userId));
  await db.delete(dailyLogs).where(eq(dailyLogs.userId, userId));
  await db.delete(weeklyAssessments).where(eq(weeklyAssessments.userId, userId));
  return { success: true as const };
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
  waterLiters?: string | null; recovery?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(dailyLogs).values(input).onDuplicateKeyUpdate({
    set: {
      workoutId: input.workoutId ?? null, completedCount: input.completedCount,
      completedExercises: input.completedExercises ?? null,
      cardioMinutes: input.cardioMinutes ?? null, mealsNote: input.mealsNote ?? null,
      waterLiters: input.waterLiters ?? null, recovery: input.recovery ?? null,
      updatedAt: new Date(),
    },
  });
  return getDailyLog(input.userId, input.activityDate);
}

export async function getWearableConnections(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(wearableConnections).where(eq(wearableConnections.userId, userId));
}

export async function upsertWearableConnection(input: {
  userId: number; provider: string; status: string; connectedAt?: Date | null; lastSyncedAt?: Date | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(wearableConnections).values(input).onDuplicateKeyUpdate({
    set: { status: input.status, connectedAt: input.connectedAt ?? null, lastSyncedAt: input.lastSyncedAt ?? null, updatedAt: new Date() },
  });
  const rows = await db.select().from(wearableConnections).where(and(eq(wearableConnections.userId, input.userId), eq(wearableConnections.provider, input.provider))).limit(1);
  return rows[0];
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
  averageHeartRate?: number | null; maxHeartRate?: number | null; steps?: number | null;
  distanceKm?: string | null; cardioMinutes?: number | null; sleepMinutes?: number | null;
  recoveryNote?: string | null; rawMetrics?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(wearableActivities).values(input).onDuplicateKeyUpdate({
    set: {
      activityDate: input.activityDate, activityStartedAt: input.activityStartedAt ?? null,
      activityType: input.activityType ?? null, durationMinutes: input.durationMinutes ?? null,
      caloriesKcal: input.caloriesKcal ?? null, averageHeartRate: input.averageHeartRate ?? null,
      maxHeartRate: input.maxHeartRate ?? null, steps: input.steps ?? null, distanceKm: input.distanceKm ?? null,
      cardioMinutes: input.cardioMinutes ?? null, sleepMinutes: input.sleepMinutes ?? null,
      recoveryNote: input.recoveryNote ?? null, rawMetrics: input.rawMetrics ?? null, updatedAt: new Date(),
    },
  });
  const rows = await db.select().from(wearableActivities).where(and(eq(wearableActivities.userId, input.userId), eq(wearableActivities.provider, input.provider), eq(wearableActivities.externalId, input.externalId))).limit(1);
  await upsertWearableConnection({ userId: input.userId, provider: input.provider, status: "connected", connectedAt: new Date(), lastSyncedAt: new Date() });
  return rows[0];
}

export async function getWeeklyActivityAnalysis(userId: number, from: string, to: string, weekStart: string) {
  const [activities, logs, assessment, assessmentHistory] = await Promise.all([
    getWearableActivities(userId, from, to),
    getDailyHistory(userId, from, to),
    getCurrentAssessment(userId, weekStart),
    getAssessmentHistory(userId, 12),
  ]);
  const sum = (field: "caloriesKcal" | "durationMinutes" | "cardioMinutes" | "steps" | "sleepMinutes") => {
    const values = activities.map(row => row[field]).filter((value): value is number => typeof value === "number");
    return values.length ? values.reduce((total, value) => total + value, 0) : null;
  };
  const heartRates = activities.map(row => row.averageHeartRate).filter((value): value is number => typeof value === "number");
  const maxHeartRates = activities.map(row => row.maxHeartRate).filter((value): value is number => typeof value === "number");
  const distances = activities.map(row => row.distanceKm == null ? null : Number(row.distanceKm)).filter((value): value is number => Number.isFinite(value));
  const workoutDates = new Set(logs.filter(log => log.workoutId).map(log => log.activityDate));
  const activityDays = new Set(activities.map(row => row.activityDate));
  const activityTypes = Array.from(new Set(activities.map(row => row.activityType).filter((value): value is string => Boolean(value))));
  const recovery = assessment?.recovery ?? logs.find(log => log.recovery)?.recovery ?? null;
  return {
    from, to, workoutsCompleted: workoutDates.size, workoutsTarget: 4,
    caloriesKcal: sum("caloriesKcal"), durationMinutes: sum("durationMinutes"),
    cardioMinutes: sum("cardioMinutes"), steps: sum("steps"), sleepMinutes: sum("sleepMinutes"),
    distanceKm: distances.length ? Number(distances.reduce((total, value) => total + value, 0).toFixed(2)) : null,
    averageHeartRate: heartRates.length ? Math.round(heartRates.reduce((total, value) => total + value, 0) / heartRates.length) : null,
    maxHeartRate: maxHeartRates.length ? Math.max(...maxHeartRates) : null,
    volumeMinutes: sum("durationMinutes"), previousWeeksConsidered: assessmentHistory.filter(row => row.weekStart !== weekStart).length,
    activityCount: activities.length, activityDays: activityDays.size, activityTypes, recovery, assessmentAvailable: Boolean(assessment),
    dataAvailable: activities.length > 0 || logs.length > 0,
  };
}
