ALTER TABLE "MaterialSubmission"
  ADD COLUMN "retentionClass" TEXT NOT NULL DEFAULT 'DECISION_PENDING',
  ADD COLUMN "retentionUntil" TIMESTAMP(3),
  ADD COLUMN "retentionPolicyVersion" TEXT,
  ADD COLUMN "retentionState" TEXT NOT NULL DEFAULT 'DECISION_PENDING',
  ADD COLUMN "retentionAnchorAt" TIMESTAMP(3);

ALTER TABLE "MaterialUploadQuarantine"
  ADD COLUMN "retentionClass" TEXT NOT NULL DEFAULT 'DECISION_PENDING',
  ADD COLUMN "retentionUntil" TIMESTAMP(3),
  ADD COLUMN "retentionPolicyVersion" TEXT,
  ADD COLUMN "retentionState" TEXT NOT NULL DEFAULT 'DECISION_PENDING',
  ADD COLUMN "retentionAnchorAt" TIMESTAMP(3);

CREATE INDEX "MaterialSubmission_retentionState_retentionUntil_idx"
  ON "MaterialSubmission"("retentionState", "retentionUntil");

CREATE INDEX "MaterialUploadQuarantine_retentionState_retentionUntil_idx"
  ON "MaterialUploadQuarantine"("retentionState", "retentionUntil");

ALTER TABLE "MaterialSubmission"
  ADD CONSTRAINT "MaterialSubmission_retention_contract_check"
  CHECK (
    ("retentionState" = 'DECISION_PENDING' AND "retentionClass" = 'DECISION_PENDING' AND "retentionUntil" IS NULL AND "retentionPolicyVersion" IS NULL)
    OR
    ("retentionState" IN ('SCHEDULED', 'DELETE_PENDING') AND "retentionClass" <> 'DECISION_PENDING' AND "retentionUntil" IS NOT NULL AND "retentionPolicyVersion" IS NOT NULL)
  );

ALTER TABLE "MaterialUploadQuarantine"
  ADD CONSTRAINT "MaterialUploadQuarantine_retention_contract_check"
  CHECK (
    ("retentionState" = 'DECISION_PENDING' AND "retentionClass" = 'DECISION_PENDING' AND "retentionUntil" IS NULL AND "retentionPolicyVersion" IS NULL)
    OR
    ("retentionState" IN ('SCHEDULED', 'DELETE_PENDING', 'DELETED') AND "retentionClass" <> 'DECISION_PENDING' AND "retentionUntil" IS NOT NULL AND "retentionPolicyVersion" IS NOT NULL)
  );
