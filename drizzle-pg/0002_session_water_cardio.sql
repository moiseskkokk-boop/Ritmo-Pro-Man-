ALTER TABLE "training_sessions" ADD COLUMN IF NOT EXISTS "cardioMinutes" integer;
ALTER TABLE "training_sessions" ADD COLUMN IF NOT EXISTS "waterLiters" varchar(10);
