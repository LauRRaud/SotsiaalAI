-- SOL-PRISMA-01/02 — forward repair for databases that already applied the
-- original A4 backfill, plus validation of the two legacy HelpMatch FKs.
--
-- deploy-risk-reviewed: bounded UPDATEs and VALIDATE CONSTRAINT on existing tables
-- deploy-precondition: HelpMatch actor drift is repaired from its FK-protected parents

-- The historical `reason` value is unrecoverable after the old migration dropped
-- it. Do not invent it. We can still correct the false overall success, the
-- identity source result and the overall verification timestamp deterministically.
UPDATE "LicenceCheck"
SET
  "result" = 'UNCONFIRMED'::"LicenceCheckResult",
  "entitySourceResult" = 'UNCONFIRMED'::"LicenceCheckResult",
  "verifiedAt" = NULL,
  "entityReason" = COALESCE("entityReason", 'LEGACY_ENTITY_UNRESOLVED')
WHERE "result" = 'OK'::"LicenceCheckResult"
  AND NOT "entityResolved";

-- If identity was resolved, the identity source itself necessarily succeeded.
-- This repairs old `result = UNCONFIRMED` rows without changing newer rows.
UPDATE "LicenceCheck"
SET "entitySourceResult" = 'OK'::"LicenceCheckResult"
WHERE "entityResolved"
  AND "entitySourceResult" <> 'OK'::"LicenceCheckResult";

-- HelpMatch actor ids are denormalized copies. The request/offer relations and
-- their User FKs were already validated, so they are the deterministic repair
-- source; no match or user content is deleted or guessed.
UPDATE "HelpMatch" AS match
SET "requesterId" = request."userId"
FROM "HelpRequest" AS request
WHERE match."requestId" = request."id"
  AND match."requesterId" <> request."userId";

UPDATE "HelpMatch" AS match
SET "offererId" = offer."userId"
FROM "HelpOffer" AS offer
WHERE match."offerId" = offer."id"
  AND match."offererId" <> offer."userId";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "HelpMatch" AS match
    LEFT JOIN "User" AS requester ON requester."id" = match."requesterId"
    LEFT JOIN "User" AS offerer ON offerer."id" = match."offererId"
    WHERE requester."id" IS NULL OR offerer."id" IS NULL
  ) THEN
    RAISE EXCEPTION 'HelpMatch actor repair left orphaned rows; constraints were not validated';
  END IF;
END $$;

ALTER TABLE "HelpMatch" VALIDATE CONSTRAINT "HelpMatch_requesterId_fkey";
ALTER TABLE "HelpMatch" VALIDATE CONSTRAINT "HelpMatch_offererId_fkey";
