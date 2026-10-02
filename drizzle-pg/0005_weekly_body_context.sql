ALTER TABLE "weekly_assessments" ADD COLUMN IF NOT EXISTS "weightKg" varchar(10);
ALTER TABLE "body_analyses" ALTER COLUMN "analysisMonth" TYPE varchar(10);
