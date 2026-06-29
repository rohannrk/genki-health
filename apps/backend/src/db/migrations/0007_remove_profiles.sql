-- Collapse multi-profile model into a single user-as-patient model.
-- Re-keys medical_documents, biomarker_readings, chat_messages from
-- patient_profiles(id) -> users(id), moves name/dob + BYOK key onto users,
-- drops the profile_id column on shares, and finally drops patient_profiles.
-- Data preserving: every record is mapped to its profile's owning user.

-- 1. Add the user's own patient identity ("about you"), captured once.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "name" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "dob" date;--> statement-breakpoint

-- Backfill name/dob from the user's first (oldest) profile.
UPDATE "users" u SET
  "name" = p."name",
  "dob"  = p."dob"
FROM (
  SELECT DISTINCT ON (owner_id) owner_id, name, dob
  FROM "patient_profiles"
  ORDER BY owner_id, created_at ASC
) p
WHERE p.owner_id = u.id AND u."name" IS NULL;--> statement-breakpoint

-- Carry over a BYOK key from the user's first key-bearing profile if the user
-- has none of their own yet.
UPDATE "users" u SET
  "encrypted_api_key" = p."encrypted_api_key",
  "ai_provider"       = p."ai_provider"
FROM (
  SELECT DISTINCT ON (owner_id) owner_id, encrypted_api_key, ai_provider
  FROM "patient_profiles"
  WHERE encrypted_api_key IS NOT NULL
  ORDER BY owner_id, created_at ASC
) p
WHERE p.owner_id = u.id AND u."encrypted_api_key" IS NULL;--> statement-breakpoint

-- 2. medical_documents.profile_id -> user_id
ALTER TABLE "medical_documents" ADD COLUMN IF NOT EXISTS "user_id" uuid;--> statement-breakpoint
UPDATE "medical_documents" d SET "user_id" = p."owner_id"
FROM "patient_profiles" p WHERE p."id" = d."profile_id";--> statement-breakpoint
ALTER TABLE "medical_documents" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "medical_documents" ADD CONSTRAINT "medical_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DROP INDEX IF EXISTS "docs_profile_id_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "docs_user_id_idx" ON "medical_documents" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "medical_documents" DROP CONSTRAINT IF EXISTS "medical_documents_profile_id_patient_profiles_id_fk";--> statement-breakpoint
ALTER TABLE "medical_documents" DROP COLUMN IF EXISTS "profile_id";--> statement-breakpoint

-- 3. biomarker_readings.profile_id -> user_id
ALTER TABLE "biomarker_readings" ADD COLUMN IF NOT EXISTS "user_id" uuid;--> statement-breakpoint
UPDATE "biomarker_readings" b SET "user_id" = p."owner_id"
FROM "patient_profiles" p WHERE p."id" = b."profile_id";--> statement-breakpoint
ALTER TABLE "biomarker_readings" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "biomarker_readings" ADD CONSTRAINT "biomarker_readings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DROP INDEX IF EXISTS "biomarkers_profile_code_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "biomarkers_user_code_idx" ON "biomarker_readings" USING btree ("user_id","code");--> statement-breakpoint
ALTER TABLE "biomarker_readings" DROP CONSTRAINT IF EXISTS "biomarker_readings_profile_id_patient_profiles_id_fk";--> statement-breakpoint
ALTER TABLE "biomarker_readings" DROP COLUMN IF EXISTS "profile_id";--> statement-breakpoint

-- 4. chat_messages.profile_id -> user_id
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "user_id" uuid;--> statement-breakpoint
UPDATE "chat_messages" c SET "user_id" = p."owner_id"
FROM "patient_profiles" p WHERE p."id" = c."profile_id";--> statement-breakpoint
ALTER TABLE "chat_messages" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DROP INDEX IF EXISTS "chat_messages_profile_id_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_messages_user_id_idx" ON "chat_messages" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "chat_messages" DROP CONSTRAINT IF EXISTS "chat_messages_profile_id_patient_profiles_id_fk";--> statement-breakpoint
ALTER TABLE "chat_messages" DROP COLUMN IF EXISTS "profile_id";--> statement-breakpoint

-- 5. shares: drop profile_id (ownerId is sufficient)
ALTER TABLE "shares" DROP CONSTRAINT IF EXISTS "shares_profile_id_patient_profiles_id_fk";--> statement-breakpoint
ALTER TABLE "shares" DROP COLUMN IF EXISTS "profile_id";--> statement-breakpoint

-- 6. Finally drop the patient_profiles table.
DROP TABLE IF EXISTS "patient_profiles";
