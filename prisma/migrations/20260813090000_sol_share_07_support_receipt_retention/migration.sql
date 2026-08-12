-- SOL-SHARE-07: sensitive support content has a short state-based lifetime,
-- while a contentless receipt survives parent deletion for three years.

ALTER TABLE "WellbeingSupportShare"
  ALTER COLUMN "ownerUserId" DROP NOT NULL,
  ALTER COLUMN "organizationId" DROP NOT NULL,
  ALTER COLUMN "recipientMembershipId" DROP NOT NULL,
  ALTER COLUMN "sharedSnapshotJson" DROP NOT NULL,
  ADD COLUMN "preShareNoticeVersion" TEXT NOT NULL DEFAULT '2026-08-13',
  ADD COLUMN "retentionPolicyVersion" TEXT NOT NULL DEFAULT '2.0',
  ADD COLUMN "ownerPseudonym" TEXT,
  ADD COLUMN "organizationPseudonym" TEXT,
  ADD COLUMN "recipientPseudonym" TEXT,
  ADD COLUMN "recipientRoleSnapshot" TEXT,
  ADD COLUMN "contentHmac" TEXT,
  ADD COLUMN "contentDeletionDueAt" TIMESTAMP(3),
  ADD COLUMN "contentDeletedAt" TIMESTAMP(3),
  ADD COLUMN "contentDeletionReason" TEXT,
  ADD COLUMN "receiptRetentionEndsAt" TIMESTAMP(3) NOT NULL DEFAULT (now() + '3 years'::interval),
  ADD COLUMN "legalHoldUntil" TIMESTAMP(3),
  ADD COLUMN "legalHoldReasonCode" TEXT,
  ADD COLUMN "ownerErasedAt" TIMESTAMP(3),
  ADD COLUMN "organizationErasedAt" TIMESTAMP(3),
  ADD COLUMN "recipientErasedAt" TIMESTAMP(3);

UPDATE "WellbeingSupportShare"
SET
  "preShareNoticeVersion" = 'legacy-before-2026-08-13',
  "retentionPolicyVersion" = '1.0-legacy',
  "receiptRetentionEndsAt" = GREATEST(
    "sentAt",
    COALESCE("openedAt", "sentAt"),
    COALESCE("recalledAt", "sentAt"),
    COALESCE("correctedAt", "sentAt"),
    COALESCE("closedAt", "sentAt")
  ) + '3 years'::interval,
  "contentDeletionDueAt" = CASE
    WHEN "recalledAt" IS NOT NULL THEN "recalledAt"
    WHEN "closedAt" IS NOT NULL THEN LEAST("sentAt" + '1 year'::interval, "closedAt" + '90 days'::interval)
    WHEN "openedAt" IS NOT NULL OR "correctedAt" IS NOT NULL THEN "sentAt" + '1 year'::interval
    ELSE "sentAt" + '30 days'::interval
  END;

ALTER TABLE "WellbeingSupportShare" DROP CONSTRAINT "WellbeingSupportShare_ownerUserId_fkey";
ALTER TABLE "WellbeingSupportShare" DROP CONSTRAINT "WellbeingSupportShare_organizationId_fkey";
ALTER TABLE "WellbeingSupportShare" DROP CONSTRAINT "WellbeingSupportShare_recipientMembershipId_fkey";

ALTER TABLE "WellbeingSupportShare"
  ADD CONSTRAINT "WellbeingSupportShare_ownerUserId_fkey"
    FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "WellbeingSupportShare_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "WellbeingSupportShare_recipientMembershipId_fkey"
    FOREIGN KEY ("recipientMembershipId") REFERENCES "OrganizationMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "WellbeingSupportShare_contentDeletionDueAt_contentDeletedAt_idx"
  ON "WellbeingSupportShare"("contentDeletionDueAt", "contentDeletedAt");
CREATE INDEX "WellbeingSupportShare_receiptRetentionEndsAt_idx"
  ON "WellbeingSupportShare"("receiptRetentionEndsAt");

-- An old-policy row keeps the former privacy promise: account deletion always
-- removes content. A new-policy row may keep already-opened content until its
-- short deadline, but an unopened row is automatically recalled and scrubbed.
CREATE OR REPLACE FUNCTION scrub_support_share_on_owner_delete()
RETURNS trigger AS $$
BEGIN
  UPDATE "WellbeingSupportShare"
  SET
    "ownerUserId" = NULL,
    "ownerErasedAt" = COALESCE("ownerErasedAt", CURRENT_TIMESTAMP),
    "sourceRecordId" = NULL,
    "sourceDraftId" = NULL,
    "status" = CASE
      WHEN "openedAt" IS NULL AND "status" = 'SENT' THEN 'RECALLED'::"WellbeingSupportShareStatus"
      ELSE "status"
    END,
    "recalledAt" = CASE
      WHEN "openedAt" IS NULL AND "status" = 'SENT' THEN COALESCE("recalledAt", CURRENT_TIMESTAMP)
      ELSE "recalledAt"
    END,
    "sharedSnapshotJson" = CASE
      WHEN "retentionPolicyVersion" = '2.0' AND "openedAt" IS NOT NULL THEN "sharedSnapshotJson"
      ELSE NULL
    END,
    "contentDeletedAt" = CASE
      WHEN "retentionPolicyVersion" = '2.0' AND "openedAt" IS NOT NULL THEN "contentDeletedAt"
      ELSE COALESCE("contentDeletedAt", CURRENT_TIMESTAMP)
    END,
    "contentDeletionReason" = CASE
      WHEN "retentionPolicyVersion" = '2.0' AND "openedAt" IS NOT NULL THEN "contentDeletionReason"
      ELSE COALESCE("contentDeletionReason", 'OWNER_ACCOUNT_DELETED')
    END,
    "receiptRetentionEndsAt" = GREATEST("receiptRetentionEndsAt", CURRENT_TIMESTAMP + '3 years'::interval)
  WHERE "ownerUserId" = OLD."id";
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION scrub_support_share_on_recipient_delete()
RETURNS trigger AS $$
BEGIN
  UPDATE "WellbeingSupportShare"
  SET
    "recipientMembershipId" = NULL,
    "recipientErasedAt" = COALESCE("recipientErasedAt", CURRENT_TIMESTAMP),
    "sourceRecordId" = NULL,
    "sourceDraftId" = NULL,
    "sharedSnapshotJson" = NULL,
    "contentDeletedAt" = COALESCE("contentDeletedAt", CURRENT_TIMESTAMP),
    "contentDeletionReason" = COALESCE("contentDeletionReason", 'RECIPIENT_MEMBERSHIP_DELETED'),
    "receiptRetentionEndsAt" = GREATEST("receiptRetentionEndsAt", CURRENT_TIMESTAMP + '3 years'::interval)
  WHERE "recipientMembershipId" = OLD."id";
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION scrub_support_share_on_organization_delete()
RETURNS trigger AS $$
BEGIN
  UPDATE "WellbeingSupportShare"
  SET
    "organizationId" = NULL,
    "organizationErasedAt" = COALESCE("organizationErasedAt", CURRENT_TIMESTAMP),
    "sourceRecordId" = NULL,
    "sourceDraftId" = NULL,
    "sharedSnapshotJson" = NULL,
    "contentDeletedAt" = COALESCE("contentDeletedAt", CURRENT_TIMESTAMP),
    "contentDeletionReason" = COALESCE("contentDeletionReason", 'ORGANIZATION_DELETED'),
    "receiptRetentionEndsAt" = GREATEST("receiptRetentionEndsAt", CURRENT_TIMESTAMP + '3 years'::interval)
  WHERE "organizationId" = OLD."id";
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "WellbeingSupportShare_owner_delete_scrub"
BEFORE DELETE ON "User"
FOR EACH ROW EXECUTE FUNCTION scrub_support_share_on_owner_delete();

CREATE TRIGGER "WellbeingSupportShare_recipient_delete_scrub"
BEFORE DELETE ON "OrganizationMembership"
FOR EACH ROW EXECUTE FUNCTION scrub_support_share_on_recipient_delete();

CREATE TRIGGER "WellbeingSupportShare_organization_delete_scrub"
BEFORE DELETE ON "Organization"
FOR EACH ROW EXECUTE FUNCTION scrub_support_share_on_organization_delete();
