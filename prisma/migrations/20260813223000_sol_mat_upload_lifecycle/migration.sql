CREATE TABLE "MaterialSubmissionBatch" (
    "id" TEXT NOT NULL,
    "submittedByUserId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREPARING',
    "notificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "notificationMessageId" TEXT,
    "notificationAttempts" INTEGER NOT NULL DEFAULT 0,
    "notificationLastError" TEXT,
    "notificationNextAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MaterialSubmissionBatch_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MaterialSubmission"
  ADD COLUMN "storageStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "batchId" TEXT,
  ADD COLUMN "duplicateOfId" TEXT;

CREATE UNIQUE INDEX "MaterialSubmissionBatch_submittedByUserId_idempotencyKey_key"
  ON "MaterialSubmissionBatch"("submittedByUserId", "idempotencyKey");
CREATE INDEX "MaterialSubmissionBatch_submittedByUserId_createdAt_idx"
  ON "MaterialSubmissionBatch"("submittedByUserId", "createdAt");
CREATE INDEX "MaterialSubmissionBatch_notificationStatus_notificationNextAt_idx"
  ON "MaterialSubmissionBatch"("notificationStatus", "notificationNextAt");
CREATE INDEX "MaterialSubmission_batchId_idx" ON "MaterialSubmission"("batchId");
CREATE INDEX "MaterialSubmission_submittedByUserId_storageStatus_createdAt_idx"
  ON "MaterialSubmission"("submittedByUserId", "storageStatus", "createdAt");

ALTER TABLE "MaterialSubmissionBatch"
  ADD CONSTRAINT "MaterialSubmissionBatch_submittedByUserId_fkey"
  FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaterialSubmission"
  ADD CONSTRAINT "MaterialSubmission_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "MaterialSubmissionBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
