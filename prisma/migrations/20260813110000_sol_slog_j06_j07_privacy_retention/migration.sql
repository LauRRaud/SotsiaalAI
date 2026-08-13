-- SOL-SLOG-J-06/J-07: explicit identity tombstones and deterministic retention anchors.
ALTER TABLE "ServiceReferral"
  ADD COLUMN "retentionEndsAt" TIMESTAMP(3) NOT NULL
  DEFAULT (date_trunc('year', now()) + interval '8 years' - interval '1 millisecond');

ALTER TABLE "ServiceMonthlyNarrative"
  ADD COLUMN "retentionEndsAt" TIMESTAMP(3) NOT NULL
  DEFAULT (date_trunc('year', now()) + interval '8 years' - interval '1 millisecond');

ALTER TABLE "ServiceWorkRoute"
  ADD COLUMN "workerErasedAt" TIMESTAMP(3),
  ADD COLUMN "retentionEndsAt" TIMESTAMP(3) NOT NULL
  DEFAULT (date_trunc('year', now()) + interval '8 years' - interval '1 millisecond');

ALTER TABLE "ServiceVisit"
  ADD COLUMN "ownerErasedAt" TIMESTAMP(3),
  ADD COLUMN "clientErasedAt" TIMESTAMP(3),
  ADD COLUMN "retentionEndsAt" TIMESTAMP(3) NOT NULL
  DEFAULT (date_trunc('year', now()) + interval '8 years' - interval '1 millisecond');

-- Existing rows get their domain anchor, not migration time.
UPDATE "ServiceReferral"
SET "retentionEndsAt" = make_timestamp(
  EXTRACT(YEAR FROM COALESCE("periodEnd"::timestamp, "createdAt"))::int + 7,
  12, 31, 23, 59, 59.999
);

UPDATE "ServiceMonthlyNarrative"
SET "retentionEndsAt" = make_timestamp("periodYear" + 7, 12, 31, 23, 59, 59.999);

UPDATE "ServiceWorkRoute"
SET "retentionEndsAt" = make_timestamp(EXTRACT(YEAR FROM "date")::int + 7, 12, 31, 23, 59, 59.999);

UPDATE "ServiceVisit"
SET "retentionEndsAt" = make_timestamp(
  EXTRACT(YEAR FROM COALESCE("completedAt", "cancelledAt", "plannedStartAt", "createdAt"))::int + 7,
  12, 31, 23, 59, 59.999
);

CREATE INDEX "ServiceReferral_retentionEndsAt_idx" ON "ServiceReferral"("retentionEndsAt");
CREATE INDEX "ServiceMonthlyNarrative_retentionEndsAt_idx" ON "ServiceMonthlyNarrative"("retentionEndsAt");
CREATE INDEX "ServiceWorkRoute_retentionEndsAt_idx" ON "ServiceWorkRoute"("retentionEndsAt");
CREATE INDEX "ServiceVisit_retentionEndsAt_idx" ON "ServiceVisit"("retentionEndsAt");

-- Insert-time anchors keep direct Prisma writers and future imports honest.
CREATE OR REPLACE FUNCTION service_log_retention_anchor()
RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'ServiceReferral' THEN
    NEW."retentionEndsAt" := make_timestamp(EXTRACT(YEAR FROM COALESCE(NEW."periodEnd"::timestamp, NEW."createdAt"))::int + 7, 12, 31, 23, 59, 59.999);
  ELSIF TG_TABLE_NAME = 'ServiceMonthlyNarrative' THEN
    NEW."retentionEndsAt" := make_timestamp(NEW."periodYear" + 7, 12, 31, 23, 59, 59.999);
  ELSIF TG_TABLE_NAME = 'ServiceWorkRoute' THEN
    NEW."retentionEndsAt" := make_timestamp(EXTRACT(YEAR FROM NEW."date")::int + 7, 12, 31, 23, 59, 59.999);
  ELSIF TG_TABLE_NAME = 'ServiceVisit' THEN
    NEW."retentionEndsAt" := make_timestamp(EXTRACT(YEAR FROM COALESCE(NEW."completedAt", NEW."cancelledAt", NEW."plannedStartAt", NEW."createdAt"))::int + 7, 12, 31, 23, 59, 59.999);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ServiceReferral_retention_anchor"
BEFORE INSERT OR UPDATE OF "periodEnd" ON "ServiceReferral" FOR EACH ROW EXECUTE FUNCTION service_log_retention_anchor();
CREATE TRIGGER "ServiceMonthlyNarrative_retention_anchor"
BEFORE INSERT OR UPDATE OF "periodYear" ON "ServiceMonthlyNarrative" FOR EACH ROW EXECUTE FUNCTION service_log_retention_anchor();
CREATE TRIGGER "ServiceWorkRoute_retention_anchor"
BEFORE INSERT OR UPDATE OF "date" ON "ServiceWorkRoute" FOR EACH ROW EXECUTE FUNCTION service_log_retention_anchor();
CREATE TRIGGER "ServiceVisit_retention_anchor"
BEFORE INSERT OR UPDATE OF "completedAt", "cancelledAt", "plannedStartAt" ON "ServiceVisit" FOR EACH ROW EXECUTE FUNCTION service_log_retention_anchor();
