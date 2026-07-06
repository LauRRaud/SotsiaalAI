-- Remove legacy anonymous material submissions that are no longer valid
DELETE FROM "MaterialSubmission"
WHERE "submittedByUserId" IS NULL;

-- Rebuild MaterialSubmission ownership as required + cascading
ALTER TABLE "MaterialSubmission"
DROP CONSTRAINT "MaterialSubmission_submittedByUserId_fkey";

ALTER TABLE "MaterialSubmission"
ALTER COLUMN "submittedByUserId" SET NOT NULL;

ALTER TABLE "MaterialSubmission"
ADD CONSTRAINT "MaterialSubmission_submittedByUserId_fkey"
FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- Enforce denormalized HelpMatch actor ids as real user foreign keys.
-- NOT VALID keeps the migration resilient if old data has drifted, while
-- still enforcing the constraint for new writes immediately.
ALTER TABLE "public"."HelpMatch"
ADD CONSTRAINT "HelpMatch_requesterId_fkey"
FOREIGN KEY ("requesterId") REFERENCES "public"."User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE
NOT VALID;

ALTER TABLE "public"."HelpMatch"
ADD CONSTRAINT "HelpMatch_offererId_fkey"
FOREIGN KEY ("offererId") REFERENCES "public"."User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE
NOT VALID;
