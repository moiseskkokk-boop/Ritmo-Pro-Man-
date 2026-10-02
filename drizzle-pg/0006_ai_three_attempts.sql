ALTER TABLE "workout_ai_weeks" ADD COLUMN IF NOT EXISTS "attempts" integer DEFAULT 0 NOT NULL;
ALTER TABLE "workout_ai_weeks" DROP COLUMN IF EXISTS "reservationId";
