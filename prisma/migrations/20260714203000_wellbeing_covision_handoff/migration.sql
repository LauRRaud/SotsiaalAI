-- B2/O7 — owner-private WellbeingOutputDraft -> CovisionCase handoff.
-- Both columns are nullable, so existing drafts remain unchanged and no
-- backfill is required. The unique FK makes the source-to-case link 1:1.

ALTER TABLE "WellbeingOutputDraft"
  ADD COLUMN "covisionCaseId" TEXT,
  ADD COLUMN "handedOffAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "WellbeingOutputDraft_covisionCaseId_key"
  ON "WellbeingOutputDraft"("covisionCaseId");

ALTER TABLE "WellbeingOutputDraft"
  ADD CONSTRAINT "WellbeingOutputDraft_covisionCaseId_fkey"
  FOREIGN KEY ("covisionCaseId") REFERENCES "CovisionCase"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
