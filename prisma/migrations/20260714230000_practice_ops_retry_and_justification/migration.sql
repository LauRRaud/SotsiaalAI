-- P1 Best-practices operational package.
-- Additive only: new nullable columns + one index. No enum change, no backfill,
-- no existing row touched. Existing DataDeletionJob rows keep NULL retry fields
-- (the worker treats NULL nextAttemptAt as "eligible now" and NULL maxAttempts as
-- the code default); existing audit events keep NULL justification fields.

-- P1-A: durable retry scheduling on the generic RAG job carrier.
ALTER TABLE "DataDeletionJob"
  ADD COLUMN "nextAttemptAt" TIMESTAMP(3),
  ADD COLUMN "lastErrorCode" TEXT,
  ADD COLUMN "maxAttempts" INTEGER;

CREATE INDEX "DataDeletionJob_action_status_nextAttemptAt_idx"
  ON "DataDeletionJob"("action", "status", "nextAttemptAt");

-- P1-D: immutable review-justification ledger fields on the existing append-only
-- audit-event model.
ALTER TABLE "EffectivePracticeAuditEvent"
  ADD COLUMN "decisionType" TEXT,
  ADD COLUMN "justification" TEXT,
  ADD COLUMN "justificationVisibility" TEXT;
