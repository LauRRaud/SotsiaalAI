ALTER TABLE "SourcePackageSnapshot"
  ADD COLUMN "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedBy" TEXT,
  ADD COLUMN "reviewNote" TEXT;

CREATE INDEX "SourcePackageSnapshot_reviewStatus_idx" ON "SourcePackageSnapshot"("reviewStatus");
