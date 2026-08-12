ALTER TABLE "ServiceMapEntry"
  ADD COLUMN "sourceNamespace" TEXT,
  ADD COLUMN "sourceGeneration" TEXT,
  ADD COLUMN "lastSeenAt" TIMESTAMP(3),
  ADD COLUMN "tombstonedAt" TIMESTAMP(3),
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;

UPDATE "ServiceMapEntry"
SET "sourceNamespace" = CASE
  WHEN "id" LIKE 'service-provider-rag-%' THEN 'RAG_SERVICE_PROVIDER'
  WHEN "id" LIKE 'rag-kov-contact-%' THEN 'RAG_KOV_CONTACT'
  WHEN "id" LIKE 'kov-contact-%' THEN 'LEGACY_KOV_CONTACT'
  WHEN "id" LIKE 'kov-municipality-%' THEN 'KOV_MUNICIPALITY'
  ELSE NULL
END,
"lastSeenAt" = COALESCE("checkedAt", "updatedAt")
WHERE "sourceNamespace" IS NULL;

-- The old file and RAG importers shared one id prefix, so their provenance
-- cannot be reconstructed safely. Retire those ambiguous rows; the next
-- complete namespaced sync recreates them for review without duplicate public data.
UPDATE "ServiceMapEntry"
SET "status" = 'HIDDEN', "tombstonedAt" = NOW(), "revision" = "revision" + 1
WHERE "sourceNamespace" = 'LEGACY_KOV_CONTACT';

CREATE INDEX "ServiceMapEntry_sourceNamespace_sourceGeneration_idx"
  ON "ServiceMapEntry"("sourceNamespace", "sourceGeneration");
CREATE INDEX "ServiceMapEntry_sourceNamespace_lastSeenAt_idx"
  ON "ServiceMapEntry"("sourceNamespace", "lastSeenAt");

ALTER TABLE "PreInquiry"
  ADD COLUMN "recipientServiceId" TEXT,
  ADD COLUMN "recipientLocationId" TEXT;
