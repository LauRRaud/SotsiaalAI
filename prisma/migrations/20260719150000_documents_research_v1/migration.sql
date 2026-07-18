-- T07 DOCUMENTS-RESEARCH-V1: persistent draft idempotency + savable analysis object.
-- Both changes are additive. No existing row is rewritten and no column is dropped.

-- E2: a generated draft is persisted immediately; idempotencyKey lets a retry/race resolve to the
-- same DRAFT instead of creating a duplicate. NULL keys stay distinct in Postgres, so every legacy
-- AgentArtifact (which has no key) is unaffected and multiple keyless rows per owner remain valid.
ALTER TABLE "AgentArtifact" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "AgentArtifact_ownerId_idempotencyKey_key" ON "AgentArtifact"("ownerId", "idempotencyKey");

-- E2: a document analysis becomes a findable, owner-private object. Cascade-deleted with the owner
-- so it is covered by account deletion; the source-document references are a minimal id snapshot.
CREATE TABLE "SavedAnalysis" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "title" TEXT,
  "content" TEXT NOT NULL,
  "sourceDocumentIds" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SavedAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SavedAnalysis_ownerId_updatedAt_idx" ON "SavedAnalysis"("ownerId", "updatedAt");
ALTER TABLE "SavedAnalysis" ADD CONSTRAINT "SavedAnalysis_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
