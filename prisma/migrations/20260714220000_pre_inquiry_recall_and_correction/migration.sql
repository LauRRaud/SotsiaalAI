-- U3-lite — deterministic pre-inquiry recall/open/correction lifecycle.
-- The lifecycle stays orthogonal to PreInquiryStatus: nullable timestamps and
-- a 1:1 self-reference preserve history without extending the PostgreSQL enum.

ALTER TABLE "PreInquiry"
  ADD COLUMN "openedAt" TIMESTAMP(3),
  ADD COLUMN "recalledAt" TIMESTAMP(3),
  ADD COLUMN "supersededById" TEXT;

-- Existing SENT rows are unambiguously sent even when the older application
-- path omitted sentAt. No other status is guessed or backfilled.
UPDATE "PreInquiry"
SET "sentAt" = COALESCE("updatedAt", "createdAt")
WHERE "status" = 'SENT'::"PreInquiryStatus"
  AND "sentAt" IS NULL;

CREATE UNIQUE INDEX "PreInquiry_supersededById_key"
  ON "PreInquiry"("supersededById");

CREATE INDEX "PreInquiry_authorId_sentAt_idx"
  ON "PreInquiry"("authorId", "sentAt");

CREATE INDEX "PreInquiry_recipientOwnerId_recalledAt_updatedAt_idx"
  ON "PreInquiry"("recipientOwnerId", "recalledAt", "updatedAt");

ALTER TABLE "PreInquiry"
  ADD CONSTRAINT "PreInquiry_supersededById_fkey"
  FOREIGN KEY ("supersededById") REFERENCES "PreInquiry"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
