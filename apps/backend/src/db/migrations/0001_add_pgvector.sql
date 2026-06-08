CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
ALTER TABLE "medical_documents" ADD COLUMN IF NOT EXISTS "embedding" vector(768);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "docs_embedding_idx" ON "medical_documents" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
