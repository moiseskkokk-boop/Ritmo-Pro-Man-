import { int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

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
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
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
  waterLiters: varchar("waterLiters", { length: 10 }),
  recovery: varchar("recovery", { length: 40 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ userDate: uniqueIndex("daily_logs_user_date").on(table.userId, table.activityDate) }));

export type WeeklyAssessment = typeof weeklyAssessments.$inferSelect;
export type DailyLog = typeof dailyLogs.$inferSelect;

export const wearableConnections = mysqlTable("wearable_connections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  provider: varchar("provider", { length: 40 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("authorization_required"),
  connectedAt: timestamp("connectedAt"),
  lastSyncedAt: timestamp("lastSyncedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ userProvider: uniqueIndex("wearable_connections_user_provider").on(table.userId, table.provider) }));

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
  averageHeartRate: int("averageHeartRate"),
  maxHeartRate: int("maxHeartRate"),
  steps: int("steps"),
  distanceKm: varchar("distanceKm", { length: 16 }),
  cardioMinutes: int("cardioMinutes"),
  sleepMinutes: int("sleepMinutes"),
  recoveryNote: varchar("recoveryNote", { length: 120 }),
  rawMetrics: text("rawMetrics"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ externalActivity: uniqueIndex("wearable_activities_user_provider_external").on(table.userId, table.provider, table.externalId) }));

export type WearableConnection = typeof wearableConnections.$inferSelect;
export type WearableActivity = typeof wearableActivities.$inferSelect;
