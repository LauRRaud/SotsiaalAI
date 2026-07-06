ALTER TYPE "public"."DocumentKind" ADD VALUE IF NOT EXISTS 'UPLOADED_AUDIO_SOURCE';

ALTER TYPE "public"."AgentArtifactType" ADD VALUE IF NOT EXISTS 'CASE_SUMMARY';
ALTER TYPE "public"."AgentArtifactType" ADD VALUE IF NOT EXISTS 'PRE_ASSESSMENT_SUMMARY';
ALTER TYPE "public"."AgentArtifactType" ADD VALUE IF NOT EXISTS 'STAR_HELPER';
ALTER TYPE "public"."AgentArtifactType" ADD VALUE IF NOT EXISTS 'ACTION_PLAN';

ALTER TABLE "public"."UserDocument"
ADD COLUMN IF NOT EXISTS "sourceDocumentId" TEXT,
ADD COLUMN IF NOT EXISTS "content" TEXT,
ADD COLUMN IF NOT EXISTS "metadata" JSONB;

CREATE INDEX IF NOT EXISTS "UserDocument_sourceDocumentId_idx" ON "public"."UserDocument"("sourceDocumentId");

ALTER TABLE "public"."UserDocument"
ADD CONSTRAINT "UserDocument_sourceDocumentId_fkey"
FOREIGN KEY ("sourceDocumentId") REFERENCES "public"."UserDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
