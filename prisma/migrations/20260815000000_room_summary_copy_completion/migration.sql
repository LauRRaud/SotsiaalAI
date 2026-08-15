ALTER TABLE "RoomSummaryCopy"
ADD COLUMN "completedAt" TIMESTAMP(3);

-- Existing linked rows are completed handovers. Keeping this marker after the
-- SavedAnalysis relation is set null prevents a later room lifecycle event from
-- recreating a copy that its recipient deliberately deleted.
UPDATE "RoomSummaryCopy"
SET "completedAt" = "copiedAt"
WHERE "savedAnalysisId" IS NOT NULL;
