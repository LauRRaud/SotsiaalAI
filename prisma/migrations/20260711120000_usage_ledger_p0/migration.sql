-- P0: normalized plans, entitlements and the immutable usage ledger.
-- Subscription.plan remains as a compatibility field until the P2 route migration is complete.

CREATE TYPE "UsageMetric" AS ENUM (
  'CHAT_ASSISTANT_REPLY',
  'DOCUMENT_GENERATE',
  'DOCUMENT_REFINE',
  'FILE_ANALYZE',
  'DEEP_RESEARCH_RUN',
  'RAG_SEARCH',
  'STT_SECONDS',
  'TTS_CHARS',
  'STORAGE_BYTES'
);

CREATE TYPE "UsagePeriod" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'LIFETIME');
CREATE TYPE "UsageReservationStatus" AS ENUM ('RESERVED', 'COMMITTED', 'RELEASED');
CREATE TYPE "UsageEventType" AS ENUM ('RESERVED', 'COMMITTED', 'RELEASED', 'ADJUSTMENT');

CREATE TABLE "PlanDefinition" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "price" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "version" INTEGER NOT NULL DEFAULT 1,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlanDefinition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlanDefinition_price_check" CHECK ("price" >= 0)
);

CREATE TABLE "PlanEntitlement" (
  "id" TEXT NOT NULL,
  "planDefinitionId" TEXT NOT NULL,
  "metric" "UsageMetric" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "softLimit" BIGINT,
  "hardLimit" BIGINT,
  "period" "UsagePeriod" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlanEntitlement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlanEntitlement_limits_check" CHECK (
    ("softLimit" IS NULL OR "softLimit" >= 0) AND
    ("hardLimit" IS NULL OR "hardLimit" > 0) AND
    ("softLimit" IS NULL OR "hardLimit" IS NULL OR "softLimit" <= "hardLimit")
  )
);

CREATE TABLE "UserEntitlementOverride" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "metric" "UsageMetric" NOT NULL,
  "enabled" BOOLEAN,
  "softLimit" BIGINT,
  "hardLimit" BIGINT,
  "period" "UsagePeriod",
  "reason" TEXT NOT NULL,
  "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validUntil" TIMESTAMP(3),
  "createdByAdminId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserEntitlementOverride_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserEntitlementOverride_dates_check" CHECK ("validUntil" IS NULL OR "validUntil" > "validFrom"),
  CONSTRAINT "UserEntitlementOverride_limits_check" CHECK (
    ("softLimit" IS NULL OR "softLimit" >= 0) AND
    ("hardLimit" IS NULL OR "hardLimit" > 0) AND
    ("softLimit" IS NULL OR "hardLimit" IS NULL OR "softLimit" <= "hardLimit")
  )
);

CREATE TABLE "UsageBucket" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "metric" "UsageMetric" NOT NULL,
  "period" "UsagePeriod" NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "softLimit" BIGINT,
  "hardLimit" BIGINT NOT NULL,
  "used" BIGINT NOT NULL DEFAULT 0,
  "reserved" BIGINT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UsageBucket_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UsageBucket_period_check" CHECK ("periodEnd" > "periodStart"),
  CONSTRAINT "UsageBucket_limits_check" CHECK (
    "hardLimit" > 0 AND
    ("softLimit" IS NULL OR ("softLimit" >= 0 AND "softLimit" <= "hardLimit"))
  ),
  CONSTRAINT "UsageBucket_usage_check" CHECK (
    "used" >= 0 AND "reserved" >= 0 AND "used" + "reserved" <= "hardLimit"
  )
);

CREATE TABLE "UsageReservation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "bucketId" TEXT NOT NULL,
  "metric" "UsageMetric" NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "reservedAmount" BIGINT NOT NULL,
  "committedAmount" BIGINT,
  "status" "UsageReservationStatus" NOT NULL DEFAULT 'RESERVED',
  "expiresAt" TIMESTAMP(3),
  "committedAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "releaseReason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UsageReservation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UsageReservation_amounts_check" CHECK (
    "reservedAmount" > 0 AND ("committedAmount" IS NULL OR "committedAmount" >= 0)
  )
);

CREATE TABLE "ModelPrice" (
  "id" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "inputPerMillion" DECIMAL(18,6) NOT NULL,
  "cachedInputPerMillion" DECIMAL(18,6) NOT NULL,
  "outputPerMillion" DECIMAL(18,6) NOT NULL,
  "reasoningPerMillion" DECIMAL(18,6) NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModelPrice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ModelPrice_dates_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom"),
  CONSTRAINT "ModelPrice_prices_check" CHECK (
    "inputPerMillion" >= 0 AND "cachedInputPerMillion" >= 0 AND
    "outputPerMillion" >= 0 AND "reasoningPerMillion" >= 0
  )
);

CREATE TABLE "UsageEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "bucketId" TEXT NOT NULL,
  "reservationId" TEXT,
  "metric" "UsageMetric" NOT NULL,
  "type" "UsageEventType" NOT NULL,
  "amount" BIGINT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "modelPriceId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Subscription" ADD COLUMN "planDefinitionId" TEXT;

CREATE UNIQUE INDEX "PlanDefinition_key_version_key" ON "PlanDefinition"("key", "version");
CREATE INDEX "PlanDefinition_role_active_idx" ON "PlanDefinition"("role", "active");
CREATE INDEX "PlanDefinition_key_active_idx" ON "PlanDefinition"("key", "active");
CREATE UNIQUE INDEX "PlanEntitlement_planDefinitionId_metric_key" ON "PlanEntitlement"("planDefinitionId", "metric");
CREATE INDEX "PlanEntitlement_metric_enabled_idx" ON "PlanEntitlement"("metric", "enabled");
CREATE INDEX "UserEntitlementOverride_userId_metric_validFrom_idx" ON "UserEntitlementOverride"("userId", "metric", "validFrom");
CREATE INDEX "UserEntitlementOverride_createdByAdminId_createdAt_idx" ON "UserEntitlementOverride"("createdByAdminId", "createdAt");
CREATE INDEX "UserEntitlementOverride_validUntil_idx" ON "UserEntitlementOverride"("validUntil");
CREATE UNIQUE INDEX "UsageBucket_userId_metric_periodStart_periodEnd_key" ON "UsageBucket"("userId", "metric", "periodStart", "periodEnd");
CREATE INDEX "UsageBucket_userId_periodEnd_idx" ON "UsageBucket"("userId", "periodEnd");
CREATE INDEX "UsageBucket_metric_periodStart_idx" ON "UsageBucket"("metric", "periodStart");
CREATE UNIQUE INDEX "UsageReservation_userId_idempotencyKey_key" ON "UsageReservation"("userId", "idempotencyKey");
CREATE INDEX "UsageReservation_bucketId_status_idx" ON "UsageReservation"("bucketId", "status");
CREATE INDEX "UsageReservation_status_expiresAt_idx" ON "UsageReservation"("status", "expiresAt");
CREATE UNIQUE INDEX "UsageEvent_idempotencyKey_key" ON "UsageEvent"("idempotencyKey");
CREATE INDEX "UsageEvent_userId_metric_createdAt_idx" ON "UsageEvent"("userId", "metric", "createdAt");
CREATE INDEX "UsageEvent_bucketId_createdAt_idx" ON "UsageEvent"("bucketId", "createdAt");
CREATE INDEX "UsageEvent_reservationId_idx" ON "UsageEvent"("reservationId");
CREATE INDEX "UsageEvent_modelPriceId_idx" ON "UsageEvent"("modelPriceId");
CREATE UNIQUE INDEX "ModelPrice_model_effectiveFrom_key" ON "ModelPrice"("model", "effectiveFrom");
CREATE INDEX "ModelPrice_model_effectiveTo_idx" ON "ModelPrice"("model", "effectiveTo");
CREATE INDEX "Subscription_planDefinitionId_idx" ON "Subscription"("planDefinitionId");

ALTER TABLE "PlanEntitlement" ADD CONSTRAINT "PlanEntitlement_planDefinitionId_fkey"
  FOREIGN KEY ("planDefinitionId") REFERENCES "PlanDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserEntitlementOverride" ADD CONSTRAINT "UserEntitlementOverride_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserEntitlementOverride" ADD CONSTRAINT "UserEntitlementOverride_createdByAdminId_fkey"
  FOREIGN KEY ("createdByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UsageBucket" ADD CONSTRAINT "UsageBucket_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsageReservation" ADD CONSTRAINT "UsageReservation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsageReservation" ADD CONSTRAINT "UsageReservation_bucketId_fkey"
  FOREIGN KEY ("bucketId") REFERENCES "UsageBucket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_bucketId_fkey"
  FOREIGN KEY ("bucketId") REFERENCES "UsageBucket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "UsageReservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_modelPriceId_fkey"
  FOREIGN KEY ("modelPriceId") REFERENCES "ModelPrice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planDefinitionId_fkey"
  FOREIGN KEY ("planDefinitionId") REFERENCES "PlanDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Corrections must be appended as ADJUSTMENT events. DELETE remains possible for the
-- orchestrated account-deletion flow required by the privacy policy.
CREATE FUNCTION "prevent_usage_event_update"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'UsageEvent rows are immutable; append an ADJUSTMENT event instead';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "UsageEvent_prevent_update"
  BEFORE UPDATE ON "UsageEvent"
  FOR EACH ROW EXECUTE FUNCTION "prevent_usage_event_update"();

-- Stable seed identifiers make the migration and prisma seed idempotent with each other.
INSERT INTO "PlanDefinition" (
  "id", "key", "name", "role", "price", "currency", "version", "active", "effectiveFrom", "createdAt", "updatedAt"
) VALUES
  ('plan_client_v1', 'client_monthly', 'Pöörduja', 'CLIENT', 7.99, 'EUR', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan_social_worker_v1', 'social_worker_monthly', 'Spetsialist', 'SOCIAL_WORKER', 14.99, 'EUR', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan_service_provider_v1', 'service_provider_monthly', 'Teenuseosutaja', 'SERVICE_PROVIDER', 19.99, 'EUR', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key", "version") DO NOTHING;

INSERT INTO "PlanEntitlement" (
  "id", "planDefinitionId", "metric", "enabled", "softLimit", "hardLimit", "period", "createdAt", "updatedAt"
) VALUES
  ('ent_client_chat_v1', 'plan_client_v1', 'CHAT_ASSISTANT_REPLY', true, 120, 150, 'MONTHLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ent_client_document_v1', 'plan_client_v1', 'DOCUMENT_GENERATE', true, NULL, 2, 'WEEKLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ent_client_analyze_v1', 'plan_client_v1', 'FILE_ANALYZE', true, NULL, 4, 'WEEKLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ent_client_storage_v1', 'plan_client_v1', 'STORAGE_BYTES', true, NULL, 52428800, 'LIFETIME', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ent_worker_chat_v1', 'plan_social_worker_v1', 'CHAT_ASSISTANT_REPLY', true, 300, 360, 'MONTHLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ent_worker_document_v1', 'plan_social_worker_v1', 'DOCUMENT_GENERATE', true, NULL, 4, 'WEEKLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ent_worker_analyze_v1', 'plan_social_worker_v1', 'FILE_ANALYZE', true, NULL, 10, 'WEEKLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ent_worker_storage_v1', 'plan_social_worker_v1', 'STORAGE_BYTES', true, NULL, 104857600, 'LIFETIME', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ent_provider_chat_v1', 'plan_service_provider_v1', 'CHAT_ASSISTANT_REPLY', true, 600, 750, 'MONTHLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ent_provider_document_v1', 'plan_service_provider_v1', 'DOCUMENT_GENERATE', true, NULL, 8, 'WEEKLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ent_provider_analyze_v1', 'plan_service_provider_v1', 'FILE_ANALYZE', true, NULL, 20, 'WEEKLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ent_provider_storage_v1', 'plan_service_provider_v1', 'STORAGE_BYTES', true, NULL, 157286400, 'LIFETIME', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("planDefinitionId", "metric") DO NOTHING;

-- Known plan keys win; legacy generic values are mapped by the owning user's role.
UPDATE "Subscription" AS subscription
SET "planDefinitionId" = CASE
  WHEN LOWER(subscription."plan") = 'client_monthly' THEN 'plan_client_v1'
  WHEN LOWER(subscription."plan") = 'social_worker_monthly' THEN 'plan_social_worker_v1'
  WHEN LOWER(subscription."plan") = 'service_provider_monthly' THEN 'plan_service_provider_v1'
  WHEN user_row."role" = 'CLIENT' THEN 'plan_client_v1'
  WHEN user_row."role" = 'SOCIAL_WORKER' THEN 'plan_social_worker_v1'
  WHEN user_row."role" = 'SERVICE_PROVIDER' THEN 'plan_service_provider_v1'
  ELSE NULL
END
FROM "User" AS user_row
WHERE subscription."userId" = user_row."id";

-- Canonicalize the deprecated text value while old readers still exist.
UPDATE "Subscription" AS subscription
SET "plan" = plan_definition."key"
FROM "PlanDefinition" AS plan_definition
WHERE subscription."planDefinitionId" = plan_definition."id";

-- A subscription that grants or records access must always have a normalized plan.
-- NONE may remain planless for pre-checkout/admin placeholder rows.
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_normalized_plan_check"
  CHECK ("status" = 'NONE' OR "planDefinitionId" IS NOT NULL);
