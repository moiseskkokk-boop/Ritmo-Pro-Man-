DROP INDEX IF EXISTS training_sessions_user_date;
--> statement-breakpoint
CREATE INDEX training_sessions_user_date ON training_sessions ("userId", "activityDate");
--> statement-breakpoint
ALTER TABLE training_sessions ADD COLUMN "smartwatchJson" text, ADD COLUMN summary text;
--> statement-breakpoint
CREATE TABLE workout_ai_weeks ("userId" integer NOT NULL, "weekStart" varchar(10) NOT NULL, "reservationId" varchar(36) NOT NULL, "createdAt" timestamp DEFAULT now() NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX workout_ai_weeks_user_week ON workout_ai_weeks ("userId", "weekStart");
