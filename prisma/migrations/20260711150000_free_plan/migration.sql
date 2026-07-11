-- Align the usage ledger with the public 0 EUR package shown on /hinnastus.
INSERT INTO "PlanDefinition" (
  "id", "key", "name", "role", "price", "currency", "version", "active",
  "effectiveFrom", "createdAt", "updatedAt"
)
VALUES (
  'plan_free_v1', 'free', 'Tasuta', 'CLIENT', 0.00, 'EUR', 1, true,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("key", "version") DO UPDATE SET
  "name" = EXCLUDED."name",
  "role" = EXCLUDED."role",
  "price" = EXCLUDED."price",
  "currency" = EXCLUDED."currency",
  "active" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

-- NONE is the existing persisted state for a free registration. Keep that
-- status for compatibility, but give it an explicit package identity.
UPDATE "Subscription"
SET
  "plan" = 'free',
  "planDefinitionId" = 'plan_free_v1',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "status" = 'NONE';

ALTER TABLE "Subscription" ALTER COLUMN "plan" SET DEFAULT 'free';
