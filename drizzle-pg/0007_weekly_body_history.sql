ALTER TABLE "body_analyses" ADD COLUMN IF NOT EXISTS "assessmentWeekStart" varchar(10);
ALTER TABLE "body_analyses" ADD COLUMN IF NOT EXISTS "experience" varchar(16) NOT NULL DEFAULT 'man';
CREATE INDEX IF NOT EXISTS "body_analyses_user_week" ON "body_analyses" ("userId", "assessmentWeekStart");
