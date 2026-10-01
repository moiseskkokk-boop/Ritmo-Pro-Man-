import { bigint, bigserial, index, integer, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = pgTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: serial("id").primaryKey(),
  /** Authentication identifier (openId) for the application user. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  sessionVersion: integer("sessionVersion").default(0).notNull(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  termsAcceptedAt: timestamp("termsAcceptedAt"),
  privacyAcceptedAt: timestamp("privacyAcceptedAt"),
  termsAcceptedVersion: varchar("termsAcceptedVersion", { length: 32 }),
  privacyAcceptedVersion: varchar("privacyAcceptedVersion", { length: 32 }),
  emailVerifiedAt: timestamp("emailVerifiedAt"),
  pendingEmail: varchar("pendingEmail", { length: 320 }),
  profileImageKey: varchar("profileImageKey", { length: 255 }),
  profileImageUrl: varchar("profileImageUrl", { length: 512 }),
  experience: varchar("experience", { length: 16, enum: ["man", "woman"] }),
  role: varchar("role", { length: 32, enum: ["user", "admin"] }).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const authEmailTokens = pgTable("auth_email_tokens", {
  tokenHash: varchar("tokenHash", { length: 64 }).primaryKey(),
  userId: integer("userId").notNull(),
  purpose: varchar("purpose", { length: 32, enum: ["verify_email", "password_reset", "email_change"] }).notNull(),
  targetEmail: varchar("targetEmail", { length: 320 }),
  expiresAt: timestamp("expiresAt").notNull(),
  consumedAt: timestamp("consumedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ userPurpose: index("auth_email_tokens_user_purpose").on(table.userId, table.purpose), expires: index("auth_email_tokens_expires").on(table.expiresAt) }));

export const authRateLimits = pgTable("auth_rate_limits", {
  rateKey: varchar("rateKey", { length: 64 }).primaryKey(),
  windowStartedAt: timestamp("windowStartedAt").notNull(),
  attempts: integer("attempts").notNull().default(0),
}, table => ({ windowStarted: index("auth_rate_limits_window_started").on(table.windowStartedAt) }));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const trainingSessions = pgTable("training_sessions", {
  id: varchar("id", { length: 36 }).primaryKey(), userId: integer("userId").notNull(), activityDate: varchar("activityDate", { length: 10 }).notNull(),
  status: varchar("status", { length: 32, enum: ["in_progress", "completed"] }).default("in_progress").notNull(),
  snapshotJson: text("snapshotJson").notNull(), note: text("note"), startedAt: timestamp("startedAt").defaultNow().notNull(), completedAt: timestamp("completedAt"), smartwatchJson: text("smartwatchJson"), summary: text("summary"), cardioMinutes: integer("cardioMinutes"), waterLiters: varchar("waterLiters", { length: 10 }),
}, table => ({ userDate: index("training_sessions_user_date").on(table.userId, table.activityDate) }));
export const trainingSets = pgTable("training_sets", {
  id: varchar("id", { length: 80 }).primaryKey(), sessionId: varchar("sessionId", { length: 36 }).notNull(), exerciseIndex: integer("exerciseIndex").notNull(), setIndex: integer("setIndex").notNull(),
  exerciseId: varchar("exerciseId", { length: 8 }).notNull(), reps: integer("reps"), seconds: integer("seconds"), loadKg: varchar("loadKg", { length: 12 }), note: varchar("note", { length: 500 }), confirmedAt: timestamp("confirmedAt").defaultNow().notNull(), voidedAt: timestamp("voidedAt"),
}, table => ({ session: index("training_sets_session").on(table.sessionId) }));
export const fitnessPreferences = pgTable("fitness_preferences", { userId: integer("userId").primaryKey(), dataJson: text("dataJson").notNull(), updatedAt: timestamp("updatedAt").defaultNow().notNull() });
export const wellnessEntries = pgTable("wellness_entries", {
  id: varchar("id", { length: 36 }).primaryKey(), userId: integer("userId").notNull(), activityDate: varchar("activityDate", { length: 10 }).notNull(), kind: varchar("kind", { length: 32, enum: ["meal", "water", "cardio"] }).notNull(),
  dataJson: text("dataJson").notNull(), revision: integer("revision").default(0).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, table => ({ userDate: index("wellness_entries_user_date").on(table.userId, table.activityDate) }));
export const bodyMeasurements = pgTable("body_measurements", {
  id: varchar("id", { length: 36 }).primaryKey(), userId: integer("userId").notNull(), activityDate: varchar("activityDate", { length: 10 }).notNull(), dataJson: text("dataJson").notNull(), revision: integer("revision").default(0).notNull(),
  photoKey: varchar("photoKey", { length: 255 }), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, table => ({ userDate: index("body_measurements_user_date").on(table.userId, table.activityDate) }));
export const fitnessRevisions = pgTable("fitness_revisions", {
  id: serial("id").primaryKey(), userId: integer("userId").notNull(), entityId: varchar("entityId", { length: 80 }).notNull(), kind: varchar("kind", { length: 32 }).notNull(), previousJson: text("previousJson").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ userEntity: index("fitness_revisions_user_entity").on(table.userId, table.entityId) }));
export const coachTurns = pgTable("coach_turns", {
  id: varchar("id", { length: 36 }).primaryKey(), userId: integer("userId").notNull(), question: text("question").notNull(), answer: text("answer"), status: varchar("status", { length: 32, enum: ["processing", "completed", "failed"] }).default("processing").notNull(), contextAuthorized: integer("contextAuthorized").default(0).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ userCreated: index("coach_turns_user_created").on(table.userId, table.createdAt) }));

export const weeklyAssessments = pgTable("weekly_assessments", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  weekStart: varchar("weekStart", { length: 10 }).notNull(),
  objective: varchar("objective", { length: 80 }).notNull(),
  heightCm: integer("heightCm").notNull(),
  benchPressLevel: varchar("benchPressLevel", { length: 80 }).notNull(),
  squatLevel: varchar("squatLevel", { length: 80 }).notNull(),
  cardio: varchar("cardio", { length: 40 }).notNull(),
  sleep: varchar("sleep", { length: 40 }).notNull(),
  recovery: varchar("recovery", { length: 40 }).notNull(),
  fatigue: varchar("fatigue", { length: 100 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({ userWeek: uniqueIndex("weekly_assessments_user_week").on(table.userId, table.weekStart) }));

export const dailyLogs = pgTable("daily_logs", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  activityDate: varchar("activityDate", { length: 10 }).notNull(),
  workoutId: varchar("workoutId", { length: 2 }),
  completedCount: integer("completedCount").default(0).notNull(),
  completedExercises: text("completedExercises"),
  cardioMinutes: integer("cardioMinutes"),
  mealsNote: text("mealsNote"),
  mealAnalysisJson: text("mealAnalysisJson"),
  waterLiters: varchar("waterLiters", { length: 10 }),
  recovery: varchar("recovery", { length: 40 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({ userDate: uniqueIndex("daily_logs_user_date").on(table.userId, table.activityDate) }));

export const workoutPlans = pgTable("workout_plans", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  source: varchar("source", { length: 32, enum: ["manual", "ai", "customized", "day5"] }).notNull().default("manual"),
  baseWorkoutId: varchar("baseWorkoutId", { length: 8 }),
  name: varchar("name", { length: 120 }).notNull(),
  objective: varchar("objective", { length: 80 }).notNull(),
  focusGroup: varchar("focusGroup", { length: 80 }).notNull(),
  durationMinutes: integer("durationMinutes").notNull(),
  notes: text("notes"),
  exercisesJson: text("exercisesJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, table => ({ userPlans: index("workout_plans_user_created").on(table.userId, table.createdAt) }));

export const bodyAnalyses = pgTable("body_analyses", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  analysisMonth: varchar("analysisMonth", { length: 7 }).notNull(),
  objective: varchar("objective", { length: 80 }),
  photoKeys: text("photoKeys").notNull(),
  bodyFatEstimatePercent: integer("bodyFatEstimatePercent"),
  confidencePercent: integer("confidencePercent").notNull(),
  analysisJson: text("analysisJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({ userMonth: uniqueIndex("body_analyses_user_month").on(table.userId, table.analysisMonth) }));

export type WeeklyAssessment = typeof weeklyAssessments.$inferSelect;
export type DailyLog = typeof dailyLogs.$inferSelect;
export type BodyAnalysis = typeof bodyAnalyses.$inferSelect;

export const wearableConnections = pgTable("wearable_connections", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({ userProvider: uniqueIndex("wearable_connections_user_provider").on(table.userId, table.provider) }));

export const wearableOauthStates = pgTable("wearable_oauth_states", {
  stateHash: varchar("stateHash", { length: 64 }).primaryKey(),
  userId: integer("userId").notNull(),
  provider: varchar("provider", { length: 40 }).notNull(),
  verifierEncrypted: text("verifierEncrypted"),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const wearableDailySummaries = pgTable("wearable_daily_summaries", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  provider: varchar("provider", { length: 40 }).notNull(),
  activityDate: varchar("activityDate", { length: 10 }).notNull(),
  timeZone: varchar("timeZone", { length: 64 }),
  workoutCaloriesKcal: integer("workoutCaloriesKcal"),
  activityCaloriesKcal: integer("activityCaloriesKcal"),
  totalCaloriesKcal: integer("totalCaloriesKcal"),
  durationMinutes: integer("durationMinutes"),
  cardioMinutes: integer("cardioMinutes"),
  distanceKm: varchar("distanceKm", { length: 16 }),
  steps: integer("steps"),
  averageHeartRate: integer("averageHeartRate"),
  minHeartRate: integer("minHeartRate"),
  maxHeartRate: integer("maxHeartRate"),
  sleepMinutes: integer("sleepMinutes"),
  recoveryScore: integer("recoveryScore"),
  recoveryNote: varchar("recoveryNote", { length: 120 }),
  activityCount: integer("activityCount"),
  syncedAt: timestamp("syncedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({ userProviderDate: uniqueIndex("wearable_daily_summaries_user_provider_date").on(table.userId, table.provider, table.activityDate) }));

export const wearableActivities = pgTable("wearable_activities", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  provider: varchar("provider", { length: 40 }).notNull(),
  externalId: varchar("externalId", { length: 160 }).notNull(),
  activityDate: varchar("activityDate", { length: 10 }).notNull(),
  activityStartedAt: timestamp("activityStartedAt"),
  activityType: varchar("activityType", { length: 80 }),
  durationMinutes: integer("durationMinutes"),
  caloriesKcal: integer("caloriesKcal"),
  activityCaloriesKcal: integer("activityCaloriesKcal"),
  totalCaloriesKcal: integer("totalCaloriesKcal"),
  averageHeartRate: integer("averageHeartRate"),
  maxHeartRate: integer("maxHeartRate"),
  steps: integer("steps"),
  distanceKm: varchar("distanceKm", { length: 16 }),
  cardioMinutes: integer("cardioMinutes"),
  sleepMinutes: integer("sleepMinutes"),
  recoveryNote: varchar("recoveryNote", { length: 120 }),
  sourceType: varchar("sourceType", { length: 24 }).notNull().default("provider_api"),
  sourceTimeZone: varchar("sourceTimeZone", { length: 64 }),
  utcOffsetMinutes: integer("utcOffsetMinutes"),
  rawMetrics: text("rawMetrics"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({ externalActivity: uniqueIndex("wearable_activities_user_provider_external").on(table.userId, table.provider, table.externalId) }));

export type WearableConnection = typeof wearableConnections.$inferSelect;
export type WearableActivity = typeof wearableActivities.$inferSelect;
export type WearableDailySummary = typeof wearableDailySummaries.$inferSelect;

export const subscriptionPlans = pgTable("subscription_plans", {
  code: varchar("code", { length: 40 }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  interval: varchar("interval", { length: 20 }).notNull(),
  amount: varchar("amount", { length: 16 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  active: integer("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const userSubscriptions = pgTable("user_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  planCode: varchar("planCode", { length: 40 }).notNull(),
  provider: varchar("provider", { length: 32 }).notNull().default("mercadopago"),
  status: varchar("status", { length: 32, enum: ["pending", "active", "payment_pending", "cancelled", "expired", "error"] }).notNull().default("pending"),
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({ userHistory: index("user_subscriptions_user_history").on(table.userId, table.createdAt) }));

export const subscriptionPayments = pgTable("subscription_payments", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscriptionId").notNull(),
  userId: integer("userId").notNull(),
  providerPaymentId: varchar("providerPaymentId", { length: 100 }).notNull().unique(),
  status: varchar("status", { length: 32 }).notNull(),
  amount: varchar("amount", { length: 16 }),
  currency: varchar("currency", { length: 3 }),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({ subscriptionPayments: index("subscription_payments_subscription").on(table.subscriptionId), userPayments: index("subscription_payments_user").on(table.userId) }));

export const mercadoPagoWebhookEvents = pgTable("mercadopago_webhook_events", {
  id: serial("id").primaryKey(),
  eventKey: varchar("eventKey", { length: 191 }).notNull().unique(),
  topic: varchar("topic", { length: 64 }).notNull(),
  resourceId: varchar("resourceId", { length: 100 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("processing"),
  processingAt: timestamp("processingAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  processedAt: timestamp("processedAt"),
});

export const geminiUsageDaily = pgTable("gemini_usage_daily", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  usageDate: varchar("usageDate", { length: 10 }).notNull(),
  userId: integer("userId").default(0).notNull(),
  feature: varchar("feature", { length: 64 }).default("general").notNull(),
  calls: integer("calls").default(0).notNull(),
  inputTokens: bigint("inputTokens", { mode: "number" }).default(0).notNull(),
  outputTokens: bigint("outputTokens", { mode: "number" }).default(0).notNull(),
  totalTokens: bigint("totalTokens", { mode: "number" }).default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  usageScope: uniqueIndex("gemini_usage_scope").on(table.usageDate, table.userId, table.feature),
  usageDateIndex: index("gemini_usage_date").on(table.usageDate),
}));

export type UserSubscription = typeof userSubscriptions.$inferSelect;

export const workoutAiWeeks = pgTable("workout_ai_weeks", {
  userId: integer("userId").notNull(), weekStart: varchar("weekStart", { length: 10 }).notNull(),
  reservationId: varchar("reservationId", { length: 36 }).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ userWeek: uniqueIndex("workout_ai_weeks_user_week").on(table.userId, table.weekStart) }));
