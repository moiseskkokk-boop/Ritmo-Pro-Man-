ALTER TABLE "users" ADD COLUMN "experience" varchar(16);--> statement-breakpoint
UPDATE "users" SET "experience" = 'man' WHERE "experience" IS NULL;
