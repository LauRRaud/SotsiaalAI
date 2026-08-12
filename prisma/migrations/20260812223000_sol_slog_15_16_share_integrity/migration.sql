ALTER TYPE "ServiceReportShareStatus" ADD VALUE 'PREPARING' BEFORE 'SENT';

ALTER TABLE "ServiceReportShare"
  ADD COLUMN "stagingStoragePath" TEXT,
  ADD COLUMN "retentionEndsAt" TIMESTAMP(3),
  ADD COLUMN "ownerErasedAt" TIMESTAMP(3),
  ADD COLUMN "organizationErasedAt" TIMESTAMP(3),
  ADD COLUMN "recipientErasedAt" TIMESTAMP(3);

UPDATE "ServiceReportShare"
SET "retentionEndsAt" = make_date(EXTRACT(YEAR FROM "sentAt")::INTEGER + 7, 12, 31)
  + INTERVAL '1 day' - INTERVAL '1 millisecond'
WHERE "retentionEndsAt" IS NULL;

ALTER TABLE "ServiceReportShare" ALTER COLUMN "retentionEndsAt" SET NOT NULL;

ALTER TABLE "ServiceReportShare" DROP CONSTRAINT "ServiceReportShare_ownerUserId_fkey";
ALTER TABLE "ServiceReportShare" DROP CONSTRAINT "ServiceReportShare_organizationId_fkey";
ALTER TABLE "ServiceReportShare" DROP CONSTRAINT "ServiceReportShare_recipientMembershipId_fkey";

ALTER TABLE "ServiceReportShare" ALTER COLUMN "ownerUserId" DROP NOT NULL;
ALTER TABLE "ServiceReportShare" ALTER COLUMN "organizationId" DROP NOT NULL;
ALTER TABLE "ServiceReportShare" ALTER COLUMN "recipientMembershipId" DROP NOT NULL;

ALTER TABLE "ServiceReportShare" ADD CONSTRAINT "ServiceReportShare_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceReportShare" ADD CONSTRAINT "ServiceReportShare_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceReportShare" ADD CONSTRAINT "ServiceReportShare_recipientMembershipId_fkey"
  FOREIGN KEY ("recipientMembershipId") REFERENCES "OrganizationMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "service_report_share_mark_erased"()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."ownerUserId" IS NOT NULL AND NEW."ownerUserId" IS NULL THEN
    NEW."ownerErasedAt" := COALESCE(NEW."ownerErasedAt", CURRENT_TIMESTAMP);
  END IF;
  IF OLD."organizationId" IS NOT NULL AND NEW."organizationId" IS NULL THEN
    NEW."organizationErasedAt" := COALESCE(NEW."organizationErasedAt", CURRENT_TIMESTAMP);
  END IF;
  IF OLD."recipientMembershipId" IS NOT NULL AND NEW."recipientMembershipId" IS NULL THEN
    NEW."recipientErasedAt" := COALESCE(NEW."recipientErasedAt", CURRENT_TIMESTAMP);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ServiceReportShare_mark_erased"
BEFORE UPDATE ON "ServiceReportShare"
FOR EACH ROW EXECUTE FUNCTION "service_report_share_mark_erased"();

CREATE INDEX "ServiceReportShare_retentionEndsAt_idx"
ON "ServiceReportShare"("retentionEndsAt");
