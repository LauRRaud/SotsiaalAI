ALTER TABLE "DataDeletionJob"
  ADD COLUMN "claimToken" TEXT,
  ADD COLUMN "claimedAt" TIMESTAMP(3);

CREATE INDEX "DataDeletionJob_resourceType_status_claimedAt_idx"
  ON "DataDeletionJob"("resourceType", "status", "claimedAt");
