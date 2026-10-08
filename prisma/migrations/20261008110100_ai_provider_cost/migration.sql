SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "AiProviderCall" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT,
  "turnId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "stage" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'reserved',
  "requestId" TEXT,
  "responseId" TEXT,
  "reservationKey" TEXT NOT NULL,
  "reservedNanoUsd" BIGINT NOT NULL,
  "reservedNanoEur" BIGINT NOT NULL,
  "billedNanoUsd" BIGINT,
  "billedNanoEur" BIGINT,
  "usdPerEurMicros" INTEGER NOT NULL,
  "exchangeRateDate" TEXT NOT NULL,
  "usage" JSONB,
  "pricing" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiProviderCall_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "AiProviderCall_userId_createdAt_idx" ON "AiProviderCall"("userId", "createdAt");
CREATE INDEX "AiProviderCall_projectId_createdAt_idx" ON "AiProviderCall"("projectId", "createdAt");
CREATE INDEX "AiProviderCall_turnId_idx" ON "AiProviderCall"("turnId");
CREATE INDEX "AiProviderCall_state_createdAt_idx" ON "AiProviderCall"("state", "createdAt");
CREATE TABLE "AiExchangeRate" (
  "date" TEXT NOT NULL PRIMARY KEY,
  "usdPerEurMicros" INTEGER NOT NULL,
  "source" TEXT NOT NULL
);

-- Add monetary entitlements without replacing existing plan customisations.
-- 45% of each paid plan, rounded to cents. Internal administration gets a bounded 12 EUR.
INSERT INTO "PlanEntitlement" ("id", "planDefinitionId", "metric", "period", "enabled", "hardLimit", "createdAt", "updatedAt")
SELECT 'ai_cost_' || p.id, p.id, 'AI_COST_NANO_EUR', 'MONTHLY', true,
  CASE WHEN p.key = 'admin_internal' THEN 12000000000
       ELSE ROUND(p.price * 0.45, 2) * 1000000000 END::bigint,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "PlanDefinition" p
WHERE p.key = 'admin_internal' OR (p.price > 0 AND p.currency = 'EUR')
ON CONFLICT ("planDefinitionId", "metric") DO NOTHING;
