ALTER TABLE "MaterialSubmission"
  ADD COLUMN "scanState" TEXT NOT NULL DEFAULT 'LEGACY_UNKNOWN',
  ADD COLUMN "validationState" TEXT NOT NULL DEFAULT 'LEGACY_UNKNOWN',
  ADD COLUMN "scannedAt" TIMESTAMP(3),
  ADD COLUMN "scanEngine" TEXT,
  ADD COLUMN "scanEngineVersion" TEXT,
  ADD COLUMN "scanSignatureVersion" TEXT,
  ADD COLUMN "scanSignatureUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "scanFailureCode" TEXT,
  ADD COLUMN "quarantineReceiptId" TEXT;

CREATE TABLE "MaterialUploadQuarantine" (
  "id" TEXT NOT NULL,
  "submittedByUserId" TEXT NOT NULL,
  "declaredMime" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "quarantinePath" TEXT,
  "storageState" TEXT NOT NULL DEFAULT 'QUARANTINED',
  "scanState" TEXT NOT NULL DEFAULT 'PENDING',
  "validationState" TEXT NOT NULL DEFAULT 'PENDING',
  "scannedAt" TIMESTAMP(3),
  "engine" TEXT,
  "engineVersion" TEXT,
  "signatureVersion" TEXT,
  "signatureUpdatedAt" TIMESTAMP(3),
  "failureCode" TEXT,
  "scanAttempts" INTEGER NOT NULL DEFAULT 0,
  "scanNextAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MaterialUploadQuarantine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MaterialSubmission_quarantineReceiptId_key" ON "MaterialSubmission"("quarantineReceiptId");
CREATE INDEX "MaterialSubmission_scanState_validationState_storageStatus_idx" ON "MaterialSubmission"("scanState", "validationState", "storageStatus");
CREATE INDEX "MaterialUploadQuarantine_submittedByUserId_createdAt_idx" ON "MaterialUploadQuarantine"("submittedByUserId", "createdAt");
CREATE INDEX "MaterialUploadQuarantine_scanState_scanNextAt_idx" ON "MaterialUploadQuarantine"("scanState", "scanNextAt");
CREATE INDEX "MaterialUploadQuarantine_storageState_updatedAt_idx" ON "MaterialUploadQuarantine"("storageState", "updatedAt");

ALTER TABLE "MaterialUploadQuarantine"
  ADD CONSTRAINT "MaterialUploadQuarantine_submittedByUserId_fkey"
  FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MaterialSubmission"
  ADD CONSTRAINT "MaterialSubmission_quarantineReceiptId_fkey"
  FOREIGN KEY ("quarantineReceiptId") REFERENCES "MaterialUploadQuarantine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MaterialSubmission"
  ADD CONSTRAINT "MaterialSubmission_active_security_check"
  CHECK (
    "storageStatus" <> 'ACTIVE'
    OR (
      "scanState" = 'CLEAN' AND "validationState" = 'VALIDATED'
      AND "scannedAt" IS NOT NULL AND "scanEngine" IS NOT NULL
      AND "scanEngineVersion" IS NOT NULL AND "scanSignatureVersion" IS NOT NULL
      AND "scanSignatureUpdatedAt" IS NOT NULL
    )
  ) NOT VALID;

ALTER TABLE "MaterialSubmission"
  ADD CONSTRAINT "MaterialSubmission_rag_security_check"
  CHECK (
    "ragIngestStatus" <> 'IMPORTED'
    OR (
      "scanState" = 'CLEAN' AND "validationState" = 'VALIDATED'
      AND "scannedAt" IS NOT NULL AND "scanEngine" IS NOT NULL
      AND "scanEngineVersion" IS NOT NULL AND "scanSignatureVersion" IS NOT NULL
      AND "scanSignatureUpdatedAt" IS NOT NULL
    )
  ) NOT VALID;
