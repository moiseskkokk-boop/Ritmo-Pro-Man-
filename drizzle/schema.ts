import { bigint, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Authentication identifier (openId) for the application user. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  sessionVersion: int("sessionVersion").default(0).notNull(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  termsAcceptedAt: timestamp("termsAcceptedAt"),
  privacyAcceptedAt: timestamp("privacyAcceptedAt"),
  profileImageKey: varchar("profileImageKey", { length: 255 }),
  profileImageUrl: varchar("profileImageUrl", { length: 512 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const weeklyAssessments = mysqlTable("weekly_assessments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  weekStart: varchar("weekStart", { length: 10 }).notNull(),
  objective: varchar("objective", { length: 80 }).notNull(),
  heightCm: int("heightCm").notNull(),
  benchPressLevel: varchar("benchPressLevel", { length: 80 }).notNull(),
  squatLevel: varchar("squatLevel", { length: 80 }).notNull(),
  cardio: varchar("cardio", { length: 40 }).notNull(),
  sleep: varchar("sleep", { length: 40 }).notNull(),
  recovery: varchar("recovery", { length: 40 }).notNull(),
  fatigue: varchar("fatigue", { length: 100 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ userWeek: uniqueIndex("weekly_assessments_user_week").on(table.userId, table.weekStart) }));

export const dailyLogs = mysqlTable("daily_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  activityDate: varchar("activityDate", { length: 10 }).notNull(),
  workoutId: varchar("workoutId", { length: 2 }),
  completedCount: int("completedCount").default(0).notNull(),
  completedExercises: text("completedExercises"),
  cardioMinutes: int("cardioMinutes"),
  mealsNote: text("mealsNote"),
  mealAnalysisJson: text("mealAnalysisJson"),
  waterLiters: varchar("waterLiters", { length: 10 }),
  recovery: varchar("recovery", { length: 40 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ userDate: uniqueIndex("daily_logs_user_date").on(table.userId, table.activityDate) }));

export const workoutPlans = mysqlTable("workout_plans", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  source: mysqlEnum("source", ["manual", "ai", "customized", "day5"]).notNull().default("manual"),
  baseWorkoutId: varchar("baseWorkoutId", { length: 8 }),
  name: varchar("name", { length: 120 }).notNull(),
  objective: varchar("objective", { length: 80 }).notNull(),
  focusGroup: varchar("focusGroup", { length: 80 }).notNull(),
  durationMinutes: int("durationMinutes").notNull(),
  notes: text("notes"),
  exercisesJson: text("exercisesJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ userPlans: index("workout_plans_user_created").on(table.userId, table.createdAt) }));

export const bodyAnalyses = mysqlTable("body_analyses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  analysisMonth: varchar("analysisMonth", { length: 7 }).notNull(),
  objective: varchar("objective", { length: 80 }),
  photoKeys: text("photoKeys").notNull(),
  bodyFatEstimatePercent: int("bodyFatEstimatePercent"),
  confidencePercent: int("confidencePercent").notNull(),
  analysisJson: text("analysisJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ userMonth: uniqueIndex("body_analyses_user_month").on(table.userId, table.analysisMonth) }));

export type WeeklyAssessment = typeof weeklyAssessments.$inferSelect;
export type DailyLog = typeof dailyLogs.$inferSelect;
export type BodyAnalysis = typeof bodyAnalyses.$inferSelect;

export const wearableConnections = mysqlTable("wearable_connections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  provider: varchar("provider", { length: 40 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("authorization_required"),
  connectedAt: timestamp("connectedAt"),
  lastSyncedAt: timestamp("lastSyncedAt"),
  tokenPayloadEncrypted: text("tokenPayloadEncrypted"),
  tokenExpiresAt: timestamp("tokenExpiresAt"),
  grantedScopes: text("grantedScopes"),
  timeZone: varchar("timeZone", { length: 64 }),
  lastSyncStatus: varchar("lastSyncStatus", { length: 32 }).notNull().default("never_synced"),
  lastSyncError: varchar("lastSyncError", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ userProvider: uniqueIndex("wearable_connections_user_provider").on(table.userId, table.provider) }));

export const wearableOauthStates = mysqlTable("wearable_oauth_states", {
  stateHash: varchar("stateHash", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  provider: varchar("provider", { length: 40 }).notNull(),
  verifierEncrypted: text("verifierEncrypted"),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const wearableDailySummaries = mysqlTable("wearable_daily_summaries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  provider: varchar("provider", { length: 40 }).notNull(),
  activityDate: varchar("activityDate", { length: 10 }).notNull(),
  timeZone: varchar("timeZone", { length: 64 }),
  workoutCaloriesKcal: int("workoutCaloriesKcal"),
  activityCaloriesKcal: int("activityCaloriesKcal"),
  totalCaloriesKcal: int("totalCaloriesKcal"),
  durationMinutes: int("durationMinutes"),
  cardioMinutes: int("cardioMinutes"),
  distanceKm: varchar("distanceKm", { length: 16 }),
  steps: int("steps"),
  averageHeartRate: int("averageHeartRate"),
  minHeartRate: int("minHeartRate"),
  maxHeartRate: int("maxHeartRate"),
  sleepMinutes: int("sleepMinutes"),
  recoveryScore: int("recoveryScore"),
  recoveryNote: varchar("recoveryNote", { length: 120 }),
  activityCount: int("activityCount"),
  syncedAt: timestamp("syncedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ userProviderDate: uniqueIndex("wearable_daily_summaries_user_provider_date").on(table.userId, table.provider, table.activityDate) }));

export const wearableActivities = mysqlTable("wearable_activities", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  provider: varchar("provider", { length: 40 }).notNull(),
  externalId: varchar("externalId", { length: 160 }).notNull(),
  activityDate: varchar("activityDate", { length: 10 }).notNull(),
  activityStartedAt: timestamp("activityStartedAt"),
  activityType: varchar("activityType", { length: 80 }),
  durationMinutes: int("durationMinutes"),
  caloriesKcal: int("caloriesKcal"),
  activityCaloriesKcal: int("activityCaloriesKcal"),
  totalCaloriesKcal: int("totalCaloriesKcal"),
  averageHeartRate: int("averageHeartRate"),
  maxHeartRate: int("maxHeartRate"),
  steps: int("steps"),
  distanceKm: varchar("distanceKm", { length: 16 }),
  cardioMinutes: int("cardioMinutes"),
  sleepMinutes: int("sleepMinutes"),
  recoveryNote: varchar("recoveryNote", { length: 120 }),
  sourceType: varchar("sourceType", { length: 24 }).notNull().default("provider_api"),
  sourceTimeZone: varchar("sourceTimeZone", { length: 64 }),
  utcOffsetMinutes: int("utcOffsetMinutes"),
  rawMetrics: text("rawMetrics"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ externalActivity: uniqueIndex("wearable_activities_user_provider_external").on(table.userId, table.provider, table.externalId) }));

export type WearableConnection = typeof wearableConnections.$inferSelect;
export type WearableActivity = typeof wearableActivities.$inferSelect;
export type WearableDailySummary = typeof wearableDailySummaries.$inferSelect;

export const subscriptionPlans = mysqlTable("subscription_plans", {
  code: varchar("code", { length: 40 }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  interval: varchar("interval", { length: 20 }).notNull(),
  amount: varchar("amount", { length: 16 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  active: int("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const userSubscriptions = mysqlTable("user_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  planCode: varchar("planCode", { length: 40 }).notNull(),
  provider: varchar("provider", { length: 32 }).notNull().default("mercadopago"),
  status: mysqlEnum("status", ["pending", "active", "payment_pending", "cancelled", "expired", "error"]).notNull().default("pending"),
  externalReference: varchar("externalReference", { length: 191 }).notNull().unique(),
  providerSubscriptionId: varchar("providerSubscriptionId", { length: 100 }).unique(),
  checkoutUrl: varchar("checkoutUrl", { length: 1000 }),
  amount: varchar("amount", { length: 16 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  currentPeriodStart: timestamp("currentPeriodStart"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  cancelledAt: timestamp("cancelledAt"),
  expiredAt: timestamp("expiredAt"),
  lastPaymentId: varchar("lastPaymentId", { length: 100 }),
  lastPaymentStatus: varchar("lastPaymentStatus", { length: 32 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ userHistory: index("user_subscriptions_user_history").on(table.userId, table.createdAt) }));

export const subscriptionPayments = mysqlTable("subscription_payments", {
  id: int("id").autoincrement().primaryKey(),
  subscriptionId: int("subscriptionId").notNull(),
  userId: int("userId").notNull(),
  providerPaymentId: varchar("providerPaymentId", { length: 100 }).notNull().unique(),
  status: varchar("status", { length: 32 }).notNull(),
  amount: varchar("amount", { length: 16 }),
  currency: varchar("currency", { length: 3 }),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ subscriptionPayments: index("subscription_payments_subscription").on(table.subscriptionId), userPayments: index("subscription_payments_user").on(table.userId) }));

export const mercadoPagoWebhookEvents = mysqlTable("mercadopago_webhook_events", {
  id: int("id").autoincrement().primaryKey(),
  eventKey: varchar("eventKey", { length: 191 }).notNull().unique(),
  topic: varchar("topic", { length: 64 }).notNull(),
  resourceId: varchar("resourceId", { length: 100 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("processing"),
  processingAt: timestamp("processingAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  processedAt: timestamp("processedAt"),
});

export const geminiUsageDaily = mysqlTable("gemini_usage_daily", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  usageDate: varchar("usageDate", { length: 10 }).notNull(),
  userId: int("userId").default(0).notNull(),
  feature: varchar("feature", { length: 64 }).default("general").notNull(),
  calls: int("calls").default(0).notNull(),
  inputTokens: bigint("inputTokens", { mode: "number" }).default(0).notNull(),
  outputTokens: bigint("outputTokens", { mode: "number" }).default(0).notNull(),
  totalTokens: bigint("totalTokens", { mode: "number" }).default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  usageScope: uniqueIndex("gemini_usage_scope").on(table.usageDate, table.userId, table.feature),
  usageDateIndex: index("gemini_usage_date").on(table.usageDate),
}));

export type UserSubscription = typeof userSubscriptions.$inferSelect;
