-- SOL-NET-03: NetworkShare is also a singleton room origin.
-- The partial index lives in SQL because Prisma schema cannot express its
-- predicate. Recreate it with NETWORK_SHARE included; deployment fails closed
-- if historical duplicates exist and therefore requires cleanup before retry.

BEGIN;

DROP INDEX IF EXISTS "Room_origin_singleton_unique";

CREATE UNIQUE INDEX "Room_origin_singleton_unique"
  ON "Room" ("originType", "originId")
  WHERE "originId" IS NOT NULL
    AND "originType" IN (
      'PRE_INQUIRY',
      'SERVICE_PROVIDER_INQUIRY',
      'HELP_MATCH',
      'NETWORK_SHARE'
    );

COMMIT;
