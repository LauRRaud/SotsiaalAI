-- SOL-SEED-01…05: monotonic mutation CAS, persisted privacy-review evidence,
-- and indexes for bounded owner/status cursor pagination.

ALTER TABLE "TopicSeed"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "privacyAssessment" JSONB,
  ADD COLUMN "privacyReviewedAt" TIMESTAMP(3);

CREATE INDEX "TopicSeed_ownerId_updatedAt_id_idx"
  ON "TopicSeed"("ownerId", "updatedAt", "id");

CREATE INDEX "TopicSeed_ownerId_status_updatedAt_id_idx"
  ON "TopicSeed"("ownerId", "status", "updatedAt", "id");
