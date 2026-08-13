-- SOL-REF-07/08: traceable contract retention and recoverable owner deletion.
ALTER TABLE "PracticeReflection"
  ADD COLUMN "retentionState" TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "retentionDeadline" TIMESTAMP(3),
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "undoUntil" TIMESTAMP(3);

-- Existing records inherit the best available private-module contract date.
-- An active open-ended subscription deliberately keeps a NULL deadline.
UPDATE "PracticeReflection" AS reflection
SET "retentionDeadline" = CASE
  WHEN EXISTS (
    SELECT 1 FROM "Subscription" AS subscription
    WHERE subscription."userId" = reflection."ownerUserId"
      AND subscription."status" = 'ACTIVE'
      AND subscription."validUntil" IS NULL
  ) THEN NULL
  ELSE (
    SELECT MAX(subscription."validUntil")
    FROM "Subscription" AS subscription
    WHERE subscription."userId" = reflection."ownerUserId"
  )
END;

CREATE INDEX "PracticeReflection_retentionState_retentionDeadline_id_idx"
  ON "PracticeReflection"("retentionState", "retentionDeadline", "id");
CREATE INDEX "PracticeReflection_retentionState_undoUntil_id_idx"
  ON "PracticeReflection"("retentionState", "undoUntil", "id");

CREATE TABLE "PracticeReflectionRetentionRun" (
  "id" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "ok" BOOLEAN NOT NULL DEFAULT false,
  "scanned" INTEGER NOT NULL DEFAULT 0,
  "purged" INTEGER NOT NULL DEFAULT 0,
  "deferred" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0,
  "errorCode" TEXT,
  CONSTRAINT "PracticeReflectionRetentionRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PracticeReflectionRetentionRun_startedAt_idx"
  ON "PracticeReflectionRetentionRun"("startedAt");
