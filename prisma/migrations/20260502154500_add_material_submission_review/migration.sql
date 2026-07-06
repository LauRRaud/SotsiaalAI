ALTER TABLE "MaterialSubmission"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedBy" TEXT,
  ADD COLUMN "reviewNote" TEXT;

CREATE INDEX "MaterialSubmission_status_createdAt_idx" ON "MaterialSubmission"("status", "createdAt");
CREATE INDEX "MaterialSubmission_reviewedAt_idx" ON "MaterialSubmission"("reviewedAt");
