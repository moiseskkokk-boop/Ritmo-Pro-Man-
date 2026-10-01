CREATE TABLE "auth_email_tokens" (
	"tokenHash" varchar(64) PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"purpose" varchar(32) NOT NULL,
	"targetEmail" varchar(320),
	"expiresAt" timestamp NOT NULL,
	"consumedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_rate_limits" (
	"rateKey" varchar(64) PRIMARY KEY NOT NULL,
	"windowStartedAt" timestamp NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "body_analyses" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"analysisMonth" varchar(7) NOT NULL,
	"objective" varchar(80),
	"photoKeys" text NOT NULL,
	"bodyFatEstimatePercent" integer,
	"confidencePercent" integer NOT NULL,
	"analysisJson" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "body_measurements" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"activityDate" varchar(10) NOT NULL,
	"dataJson" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"photoKey" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_turns" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"question" text NOT NULL,
	"answer" text,
	"status" varchar(32) DEFAULT 'processing' NOT NULL,
	"contextAuthorized" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"activityDate" varchar(10) NOT NULL,
	"workoutId" varchar(2),
	"completedCount" integer DEFAULT 0 NOT NULL,
	"completedExercises" text,
	"cardioMinutes" integer,
	"mealsNote" text,
	"mealAnalysisJson" text,
	"waterLiters" varchar(10),
	"recovery" varchar(40),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fitness_preferences" (
	"userId" integer PRIMARY KEY NOT NULL,
	"dataJson" text NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fitness_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"entityId" varchar(80) NOT NULL,
	"kind" varchar(32) NOT NULL,
	"previousJson" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gemini_usage_daily" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"usageDate" varchar(10) NOT NULL,
	"userId" integer DEFAULT 0 NOT NULL,
	"feature" varchar(64) DEFAULT 'general' NOT NULL,
	"calls" integer DEFAULT 0 NOT NULL,
	"inputTokens" bigint DEFAULT 0 NOT NULL,
	"outputTokens" bigint DEFAULT 0 NOT NULL,
	"totalTokens" bigint DEFAULT 0 NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mercadopago_webhook_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"eventKey" varchar(191) NOT NULL,
	"topic" varchar(64) NOT NULL,
	"resourceId" varchar(100) NOT NULL,
	"status" varchar(16) DEFAULT 'processing' NOT NULL,
	"processingAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"processedAt" timestamp,
	CONSTRAINT "mercadopago_webhook_events_eventKey_unique" UNIQUE("eventKey")
);
--> statement-breakpoint
CREATE TABLE "subscription_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscriptionId" integer NOT NULL,
	"userId" integer NOT NULL,
	"providerPaymentId" varchar(100) NOT NULL,
	"status" varchar(32) NOT NULL,
	"amount" varchar(16),
	"currency" varchar(3),
	"paidAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_payments_providerPaymentId_unique" UNIQUE("providerPaymentId")
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"code" varchar(40) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"interval" varchar(20) NOT NULL,
	"amount" varchar(16) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_sessions" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"activityDate" varchar(10) NOT NULL,
	"status" varchar(32) DEFAULT 'in_progress' NOT NULL,
	"snapshotJson" text NOT NULL,
	"note" text,
	"startedAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "training_sets" (
	"id" varchar(80) PRIMARY KEY NOT NULL,
	"sessionId" varchar(36) NOT NULL,
	"exerciseIndex" integer NOT NULL,
	"setIndex" integer NOT NULL,
	"exerciseId" varchar(8) NOT NULL,
	"reps" integer,
	"seconds" integer,
	"loadKg" varchar(12),
	"note" varchar(500),
	"confirmedAt" timestamp DEFAULT now() NOT NULL,
	"voidedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"planCode" varchar(40) NOT NULL,
	"provider" varchar(32) DEFAULT 'mercadopago' NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"externalReference" varchar(191) NOT NULL,
	"providerSubscriptionId" varchar(100),
	"checkoutUrl" varchar(1000),
	"amount" varchar(16) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"currentPeriodStart" timestamp,
	"currentPeriodEnd" timestamp,
	"cancelledAt" timestamp,
	"expiredAt" timestamp,
	"lastPaymentId" varchar(100),
	"lastPaymentStatus" varchar(32),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_subscriptions_externalReference_unique" UNIQUE("externalReference"),
	CONSTRAINT "user_subscriptions_providerSubscriptionId_unique" UNIQUE("providerSubscriptionId")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"passwordHash" varchar(255),
	"sessionVersion" integer DEFAULT 0 NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"termsAcceptedAt" timestamp,
	"privacyAcceptedAt" timestamp,
	"termsAcceptedVersion" varchar(32),
	"privacyAcceptedVersion" varchar(32),
	"emailVerifiedAt" timestamp,
	"pendingEmail" varchar(320),
	"profileImageKey" varchar(255),
	"profileImageUrl" varchar(512),
	"role" varchar(32) DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "wearable_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"provider" varchar(40) NOT NULL,
	"externalId" varchar(160) NOT NULL,
	"activityDate" varchar(10) NOT NULL,
	"activityStartedAt" timestamp,
	"activityType" varchar(80),
	"durationMinutes" integer,
	"caloriesKcal" integer,
	"activityCaloriesKcal" integer,
	"totalCaloriesKcal" integer,
	"averageHeartRate" integer,
	"maxHeartRate" integer,
	"steps" integer,
	"distanceKm" varchar(16),
	"cardioMinutes" integer,
	"sleepMinutes" integer,
	"recoveryNote" varchar(120),
	"sourceType" varchar(24) DEFAULT 'provider_api' NOT NULL,
	"sourceTimeZone" varchar(64),
	"utcOffsetMinutes" integer,
	"rawMetrics" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wearable_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"provider" varchar(40) NOT NULL,
	"status" varchar(32) DEFAULT 'authorization_required' NOT NULL,
	"connectedAt" timestamp,
	"lastSyncedAt" timestamp,
	"tokenPayloadEncrypted" text,
	"tokenExpiresAt" timestamp,
	"grantedScopes" text,
	"timeZone" varchar(64),
	"lastSyncStatus" varchar(32) DEFAULT 'never_synced' NOT NULL,
	"lastSyncError" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wearable_daily_summaries" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"provider" varchar(40) NOT NULL,
	"activityDate" varchar(10) NOT NULL,
	"timeZone" varchar(64),
	"workoutCaloriesKcal" integer,
	"activityCaloriesKcal" integer,
	"totalCaloriesKcal" integer,
	"durationMinutes" integer,
	"cardioMinutes" integer,
	"distanceKm" varchar(16),
	"steps" integer,
	"averageHeartRate" integer,
	"minHeartRate" integer,
	"maxHeartRate" integer,
	"sleepMinutes" integer,
	"recoveryScore" integer,
	"recoveryNote" varchar(120),
	"activityCount" integer,
	"syncedAt" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wearable_oauth_states" (
	"stateHash" varchar(64) PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"provider" varchar(40) NOT NULL,
	"verifierEncrypted" text,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_assessments" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"weekStart" varchar(10) NOT NULL,
	"objective" varchar(80) NOT NULL,
	"heightCm" integer NOT NULL,
	"benchPressLevel" varchar(80) NOT NULL,
	"squatLevel" varchar(80) NOT NULL,
	"cardio" varchar(40) NOT NULL,
	"sleep" varchar(40) NOT NULL,
	"recovery" varchar(40) NOT NULL,
	"fatigue" varchar(100) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wellness_entries" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"activityDate" varchar(10) NOT NULL,
	"kind" varchar(32) NOT NULL,
	"dataJson" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"source" varchar(32) DEFAULT 'manual' NOT NULL,
	"baseWorkoutId" varchar(8),
	"name" varchar(120) NOT NULL,
	"objective" varchar(80) NOT NULL,
	"focusGroup" varchar(80) NOT NULL,
	"durationMinutes" integer NOT NULL,
	"notes" text,
	"exercisesJson" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "auth_email_tokens_user_purpose" ON "auth_email_tokens" USING btree ("userId","purpose");--> statement-breakpoint
CREATE INDEX "auth_email_tokens_expires" ON "auth_email_tokens" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "auth_rate_limits_window_started" ON "auth_rate_limits" USING btree ("windowStartedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "body_analyses_user_month" ON "body_analyses" USING btree ("userId","analysisMonth");--> statement-breakpoint
CREATE INDEX "body_measurements_user_date" ON "body_measurements" USING btree ("userId","activityDate");--> statement-breakpoint
CREATE INDEX "coach_turns_user_created" ON "coach_turns" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_logs_user_date" ON "daily_logs" USING btree ("userId","activityDate");--> statement-breakpoint
CREATE INDEX "fitness_revisions_user_entity" ON "fitness_revisions" USING btree ("userId","entityId");--> statement-breakpoint
CREATE UNIQUE INDEX "gemini_usage_scope" ON "gemini_usage_daily" USING btree ("usageDate","userId","feature");--> statement-breakpoint
CREATE INDEX "gemini_usage_date" ON "gemini_usage_daily" USING btree ("usageDate");--> statement-breakpoint
CREATE INDEX "subscription_payments_subscription" ON "subscription_payments" USING btree ("subscriptionId");--> statement-breakpoint
CREATE INDEX "subscription_payments_user" ON "subscription_payments" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "training_sessions_user_date" ON "training_sessions" USING btree ("userId","activityDate");--> statement-breakpoint
CREATE INDEX "training_sets_session" ON "training_sets" USING btree ("sessionId");--> statement-breakpoint
CREATE INDEX "user_subscriptions_user_history" ON "user_subscriptions" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "wearable_activities_user_provider_external" ON "wearable_activities" USING btree ("userId","provider","externalId");--> statement-breakpoint
CREATE UNIQUE INDEX "wearable_connections_user_provider" ON "wearable_connections" USING btree ("userId","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "wearable_daily_summaries_user_provider_date" ON "wearable_daily_summaries" USING btree ("userId","provider","activityDate");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_assessments_user_week" ON "weekly_assessments" USING btree ("userId","weekStart");--> statement-breakpoint
CREATE INDEX "wellness_entries_user_date" ON "wellness_entries" USING btree ("userId","activityDate");--> statement-breakpoint
CREATE INDEX "workout_plans_user_created" ON "workout_plans" USING btree ("userId","createdAt");