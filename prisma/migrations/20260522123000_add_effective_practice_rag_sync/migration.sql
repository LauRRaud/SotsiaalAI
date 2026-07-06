-- Add controlled RAG sync metadata for published effective practice examples.

ALTER TABLE "EffectivePractice"
ADD COLUMN "ragSourceId" TEXT,
ADD COLUMN "ragMetadata" JSONB;

CREATE INDEX "EffectivePractice_ragSourceId_idx" ON "EffectivePractice"("ragSourceId");
