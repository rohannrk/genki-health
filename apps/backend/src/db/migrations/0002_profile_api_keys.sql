-- Per-profile BYOK: each patient profile stores its own encrypted AI key + provider.
ALTER TABLE "patient_profiles" ADD COLUMN IF NOT EXISTS "encrypted_api_key" text;
ALTER TABLE "patient_profiles" ADD COLUMN IF NOT EXISTS "ai_provider" varchar(20);
