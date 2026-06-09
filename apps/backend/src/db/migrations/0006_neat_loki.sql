CREATE TABLE IF NOT EXISTS "biomarker_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"value" double precision NOT NULL,
	"unit" varchar(32) DEFAULT '' NOT NULL,
	"ref_low" double precision,
	"ref_high" double precision,
	"measured_at" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "biomarker_readings" ADD CONSTRAINT "biomarker_readings_profile_id_patient_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."patient_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "biomarker_readings" ADD CONSTRAINT "biomarker_readings_document_id_medical_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."medical_documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "biomarkers_profile_code_idx" ON "biomarker_readings" USING btree ("profile_id","code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "biomarkers_document_idx" ON "biomarker_readings" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "biomarkers_measured_at_idx" ON "biomarker_readings" USING btree ("measured_at");
