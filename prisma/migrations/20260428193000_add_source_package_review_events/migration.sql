CREATE TABLE "SourcePackageSnapshotReviewEvent" (
  "id" TEXT NOT NULL,
  "snapshotId" TEXT NOT NULL,
  "packageId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actor" TEXT,
  "note" TEXT,
  "fromStatus" TEXT,
  "toStatus" TEXT,
  "fromReviewStatus" TEXT,
  "toReviewStatus" TEXT,
  "fromActive" BOOLEAN,
  "toActive" BOOLEAN,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SourcePackageSnapshotReviewEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SourcePackageSnapshotReviewEvent_snapshotId_createdAt_idx"
  ON "SourcePackageSnapshotReviewEvent"("snapshotId", "createdAt");

CREATE INDEX "SourcePackageSnapshotReviewEvent_packageId_createdAt_idx"
  ON "SourcePackageSnapshotReviewEvent"("packageId", "createdAt");

CREATE INDEX "SourcePackageSnapshotReviewEvent_action_idx"
  ON "SourcePackageSnapshotReviewEvent"("action");

ALTER TABLE "SourcePackageSnapshotReviewEvent"
  ADD CONSTRAINT "SourcePackageSnapshotReviewEvent_snapshotId_fkey"
  FOREIGN KEY ("snapshotId") REFERENCES "SourcePackageSnapshot"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
