ALTER TABLE "MaterialSubmission"
  ADD COLUMN "sourceId" TEXT,
  ADD COLUMN "ragDocId" TEXT,
  ADD COLUMN "ragVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "ragContentHash" TEXT,
  ADD COLUMN "ragCollection" TEXT,
  ADD COLUMN "ragAudience" TEXT,
  ADD COLUMN "ragPolicyVersion" TEXT,
  ADD COLUMN "rightsEvidenceMode" TEXT,
  ADD COLUMN "ragRetentionMode" TEXT,
  ADD COLUMN "ragWithdrawalAuthority" TEXT,
  ADD COLUMN "ragIngestStatus" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
  ADD COLUMN "ragIngestedAt" TIMESTAMP(3),
  ADD COLUMN "ragIngestedByUserId" TEXT,
  ADD COLUMN "ragIngestErrorCode" TEXT,
  ADD COLUMN "ragIngestAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "ragIngestNextAt" TIMESTAMP(3),
  ADD COLUMN "ragRemovalStatus" TEXT,
  ADD COLUMN "authorName" TEXT,
  ADD COLUMN "rightsHolder" TEXT,
  ADD COLUMN "rightsBasis" TEXT,
  ADD COLUMN "rightsEvidence" TEXT,
  ADD COLUMN "rightsConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "rightsConfirmedByUserId" TEXT;

CREATE UNIQUE INDEX "MaterialSubmission_sourceId_key"
  ON "MaterialSubmission"("sourceId");
CREATE UNIQUE INDEX "MaterialSubmission_ragDocId_key"
  ON "MaterialSubmission"("ragDocId");
CREATE UNIQUE INDEX "MaterialSubmission_sha256_ragCollection_ragAudience_key"
  ON "MaterialSubmission"("sha256", "ragCollection", "ragAudience");
CREATE INDEX "MaterialSubmission_ragIngestStatus_ragIngestNextAt_idx"
  ON "MaterialSubmission"("ragIngestStatus", "ragIngestNextAt");
CREATE INDEX "MaterialSubmission_ragRemovalStatus_idx"
  ON "MaterialSubmission"("ragRemovalStatus");

ALTER TABLE "MaterialSubmission"
  ADD CONSTRAINT "MaterialSubmission_rag_counters_check"
  CHECK ("ragVersion" >= 0 AND "ragIngestAttempts" >= 0);

-- Legacy rows may already carry the former manual `imported` label. Do not
-- rewrite that historical data without an owner decision, but enforce the
-- receipt contract for every new or changed row from this migration onward.
ALTER TABLE "MaterialSubmission"
  ADD CONSTRAINT "MaterialSubmission_imported_receipt_check"
  CHECK (
    "status" <> 'imported' OR (
      "ragIngestStatus" = 'IMPORTED'
      AND "sourceId" IS NOT NULL
      AND "ragDocId" IS NOT NULL
      AND "ragVersion" > 0
      AND "ragContentHash" IS NOT NULL
      AND "ragCollection" IS NOT NULL
      AND "ragAudience" IS NOT NULL
      AND "ragPolicyVersion" IS NOT NULL
      AND "rightsEvidenceMode" IS NOT NULL
      AND "ragRetentionMode" IS NOT NULL
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
