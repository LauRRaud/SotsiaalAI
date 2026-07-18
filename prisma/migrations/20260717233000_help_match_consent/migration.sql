-- T11: remember who initiated a peer match so only the other participant can decide.
ALTER TABLE "HelpMatch" ADD COLUMN "initiatedByUserId" TEXT;

-- Existing historical matches already have a room or are a completed contact.
-- Retaining the requester as a deterministic legacy initiator makes the new column safe.
UPDATE "HelpMatch"
SET "initiatedByUserId" = "requesterId"
WHERE "initiatedByUserId" IS NULL;

ALTER TABLE "HelpMatch" ALTER COLUMN "initiatedByUserId" SET NOT NULL;
CREATE INDEX "HelpMatch_initiatedByUserId_idx" ON "HelpMatch"("initiatedByUserId");
