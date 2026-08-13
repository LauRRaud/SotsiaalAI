ALTER TABLE "MaterialSubmission"
  DROP CONSTRAINT "MaterialSubmission_retention_contract_check";

ALTER TABLE "MaterialSubmission"
  DROP CONSTRAINT "MaterialSubmission_imported_receipt_check";

DROP INDEX "MaterialSubmission_retentionState_retentionUntil_idx";

ALTER TABLE "MaterialSubmission"
  RENAME COLUMN "retentionClass" TO "originalRetentionClass";
ALTER TABLE "MaterialSubmission"
  RENAME COLUMN "retentionUntil" TO "originalRetentionUntil";
ALTER TABLE "MaterialSubmission"
  RENAME COLUMN "retentionPolicyVersion" TO "originalRetentionPolicyVersion";
ALTER TABLE "MaterialSubmission"
  RENAME COLUMN "retentionState" TO "originalRetentionState";
ALTER TABLE "MaterialSubmission"
  RENAME COLUMN "retentionAnchorAt" TO "originalRetentionAnchorAt";

ALTER TABLE "MaterialSubmission"
  ALTER COLUMN "storagePath" DROP NOT NULL,
  ALTER COLUMN "originalRetentionClass" SET DEFAULT 'MATERIAL_PENDING',
  ALTER COLUMN "originalRetentionState" SET DEFAULT 'SCHEDULED',
  ADD COLUMN "originalDeletedAt" TIMESTAMP(3),
  ADD COLUMN "derivativeStoragePath" TEXT,
  ADD COLUMN "derivativeSha256" TEXT,
  ADD COLUMN "derivativeSize" INTEGER,
  ADD COLUMN "derivativeRetentionClass" TEXT NOT NULL DEFAULT 'MATERIAL_SANITIZED_DERIVATIVE',
  ADD COLUMN "derivativeRetentionUntil" TIMESTAMP(3),
  ADD COLUMN "derivativeRetentionPolicyVersion" TEXT,
  ADD COLUMN "derivativeRetentionState" TEXT NOT NULL DEFAULT 'NOT_PRESENT',
  ADD COLUMN "derivativeRetentionAnchorAt" TIMESTAMP(3),
  ADD COLUMN "derivativeDeletedAt" TIMESTAMP(3),
  ADD COLUMN "ragRetentionClass" TEXT NOT NULL DEFAULT 'MATERIAL_RAG_COPY',
  ADD COLUMN "ragRetentionUntil" TIMESTAMP(3),
  ADD COLUMN "ragRetentionPolicyVersion" TEXT,
  ADD COLUMN "ragRetentionState" TEXT NOT NULL DEFAULT 'NOT_PRESENT',
  ADD COLUMN "ragRetentionAnchorAt" TIMESTAMP(3),
  ADD COLUMN "ragRightsReviewedAt" TIMESTAMP(3),
  ADD COLUMN "ragFreshnessReviewedAt" TIMESTAMP(3),
  ADD COLUMN "rightsValidUntil" TIMESTAMP(3),
  ADD COLUMN "sourceValidUntil" TIMESTAMP(3),
  ADD COLUMN "ragDeletedAt" TIMESTAMP(3),
  ADD COLUMN "contentSafetyState" TEXT NOT NULL DEFAULT 'NOT_REVIEWED';

UPDATE "MaterialSubmission"
SET
  "originalRetentionClass" = CASE "status"
    WHEN 'pending' THEN 'MATERIAL_PENDING'
    WHEN 'rejected' THEN 'MATERIAL_REJECTED'
    WHEN 'reviewed' THEN 'MATERIAL_REVIEWED'
    WHEN 'imported' THEN 'MATERIAL_IMPORTED_ORIGINAL'
    ELSE 'MATERIAL_PENDING'
  END,
  "originalRetentionAnchorAt" = CASE
    WHEN "status" = 'imported' THEN COALESCE("ragIngestedAt", "reviewedAt", "createdAt")
    WHEN "status" IN ('reviewed', 'rejected') THEN COALESCE("reviewedAt", "createdAt")
    ELSE "createdAt"
  END,
  "originalRetentionUntil" = CASE
    WHEN "status" = 'imported' THEN COALESCE("ragIngestedAt", "reviewedAt", "createdAt") + INTERVAL '7 days'
    WHEN "status" IN ('reviewed', 'rejected') THEN COALESCE("reviewedAt", "createdAt") + INTERVAL '30 days'
    ELSE "createdAt" + INTERVAL '14 days'
  END,
  "originalRetentionPolicyVersion" = 'SOL-MAT-12-2026-08-13',
  "originalRetentionState" = CASE
    WHEN "storagePath" IS NULL THEN 'DELETED'
    WHEN "storageStatus" = 'DELETE_PENDING' THEN 'DELETE_PENDING'
    ELSE 'SCHEDULED'
  END,
  "originalDeletedAt" = CASE WHEN "storagePath" IS NULL THEN "updatedAt" ELSE NULL END;

UPDATE "MaterialSubmission"
SET
  "ragRetentionUntil" = COALESCE("ragIngestedAt", "reviewedAt", "createdAt") + INTERVAL '365 days',
  "ragRetentionPolicyVersion" = 'SOL-MAT-12-2026-08-13',
  "ragRetentionState" = CASE WHEN "ragRemovalStatus" = 'DONE' THEN 'DELETED' ELSE 'SCHEDULED' END,
  "ragRetentionAnchorAt" = COALESCE("ragIngestedAt", "reviewedAt", "createdAt"),
  "ragRightsReviewedAt" = COALESCE("rightsConfirmedAt", "ragIngestedAt", "reviewedAt", "createdAt"),
  "ragFreshnessReviewedAt" = COALESCE("ragIngestedAt", "reviewedAt", "createdAt"),
  "ragRetentionMode" = 'DELETE_WITH_SUBMISSION_OR_ACCOUNT',
  "ragDeletedAt" = CASE WHEN "ragRemovalStatus" = 'DONE' THEN "updatedAt" ELSE NULL END
WHERE "status" = 'imported' AND "ragDocId" IS NOT NULL;

CREATE INDEX "MaterialSubmission_originalRetentionState_originalRetentionUntil_idx"
  ON "MaterialSubmission"("originalRetentionState", "originalRetentionUntil");
CREATE INDEX "MaterialSubmission_derivativeRetentionState_derivativeRetentionUntil_idx"
  ON "MaterialSubmission"("derivativeRetentionState", "derivativeRetentionUntil");
CREATE INDEX "MaterialSubmission_ragRetentionState_ragRetentionUntil_idx"
  ON "MaterialSubmission"("ragRetentionState", "ragRetentionUntil");
CREATE INDEX "MaterialSubmission_rightsValidUntil_idx"
  ON "MaterialSubmission"("rightsValidUntil");
CREATE INDEX "MaterialSubmission_sourceValidUntil_idx"
  ON "MaterialSubmission"("sourceValidUntil");

ALTER TABLE "MaterialSubmission"
  ADD CONSTRAINT "MaterialSubmission_original_retention_contract_check"
  CHECK (
    ("originalRetentionState" IN ('SCHEDULED', 'DELETE_PENDING', 'FAILED') AND "originalRetentionUntil" IS NOT NULL AND "originalRetentionPolicyVersion" IS NOT NULL)
    OR
    ("originalRetentionState" = 'DELETED' AND "storagePath" IS NULL AND "originalDeletedAt" IS NOT NULL)
  ),
  ADD CONSTRAINT "MaterialSubmission_derivative_retention_contract_check"
  CHECK (
    ("derivativeRetentionState" = 'NOT_PRESENT' AND "derivativeStoragePath" IS NULL AND "derivativeRetentionUntil" IS NULL)
    OR
    ("derivativeRetentionState" IN ('SCHEDULED', 'DELETE_PENDING', 'FAILED') AND "derivativeStoragePath" IS NOT NULL AND "derivativeRetentionUntil" IS NOT NULL AND "derivativeRetentionPolicyVersion" IS NOT NULL)
    OR
    ("derivativeRetentionState" = 'DELETED' AND "derivativeStoragePath" IS NULL AND "derivativeDeletedAt" IS NOT NULL)
  ),
  ADD CONSTRAINT "MaterialSubmission_rag_retention_contract_check"
  CHECK (
    ("ragRetentionState" = 'NOT_PRESENT' AND "ragDocId" IS NULL AND "ragRetentionUntil" IS NULL)
    OR
    ("ragRetentionState" = 'PROCESSING' AND "ragDocId" IS NOT NULL AND "ragRetentionUntil" IS NULL)
    OR
    ("ragRetentionState" IN ('SCHEDULED', 'DELETE_PENDING', 'FAILED') AND "ragDocId" IS NOT NULL AND "ragRetentionUntil" IS NOT NULL AND "ragRetentionPolicyVersion" IS NOT NULL AND "ragRightsReviewedAt" IS NOT NULL AND "ragFreshnessReviewedAt" IS NOT NULL)
    OR
    ("ragRetentionState" = 'DELETED' AND "ragDeletedAt" IS NOT NULL)
  ),
  ADD CONSTRAINT "MaterialSubmission_content_safety_state_check"
  CHECK ("contentSafetyState" IN ('NOT_REVIEWED', 'ALLOWED', 'PROHIBITED', 'PERSONAL_DATA'));

ALTER TABLE "MaterialSubmission"
  ADD CONSTRAINT "MaterialSubmission_imported_receipt_check"
  CHECK (
    "status" <> 'imported' OR (
      "ragIngestStatus" IN ('IMPORTED', 'RETENTION_BLOCKED', 'DELETED')
      AND "sourceId" IS NOT NULL
      AND "ragDocId" IS NOT NULL
      AND "ragVersion" > 0
      AND "ragContentHash" IS NOT NULL
      AND "ragCollection" IS NOT NULL
      AND "ragAudience" IS NOT NULL
      AND "ragPolicyVersion" IS NOT NULL
      AND "rightsEvidenceMode" IS NOT NULL
      AND "ragRetentionMode" = 'DELETE_WITH_SUBMISSION_OR_ACCOUNT'
      AND "ragWithdrawalAuthority" IS NOT NULL
      AND "ragIngestedAt" IS NOT NULL
      AND "ragIngestedByUserId" IS NOT NULL
      AND "authorName" IS NOT NULL
      AND "rightsHolder" IS NOT NULL
      AND "rightsBasis" IS NOT NULL
      AND "rightsEvidence" IS NOT NULL
      AND "rightsConfirmedAt" IS NOT NULL
      AND "rightsConfirmedByUserId" IS NOT NULL
    )
  ) NOT VALID;

UPDATE "MaterialUploadQuarantine"
SET
  "retentionClass" = CASE
    WHEN "scanState" = 'CLEAN' THEN 'MATERIAL_QUARANTINE_CLEAN'
    WHEN "scanState" = 'FAILED' THEN 'MATERIAL_QUARANTINE_FAILED'
    ELSE 'MATERIAL_QUARANTINE_PENDING'
  END,
  "retentionUntil" = COALESCE("scannedAt", "createdAt") + INTERVAL '1 day',
  "retentionPolicyVersion" = 'SOL-MAT-12-2026-08-13',
  "retentionState" = CASE WHEN "storageState" = 'REMOVED' THEN 'DELETED' ELSE 'SCHEDULED' END,
  "retentionAnchorAt" = COALESCE("scannedAt", "createdAt");
