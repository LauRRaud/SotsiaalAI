-- SOL-ORG-17: ühe kasutaja sama loomistoiming saab tekitada ainult ühe organisatsiooni.
ALTER TABLE "Organization"
  ADD COLUMN "creationClientActionId" TEXT,
  ADD COLUMN "creationPayloadHash" TEXT;

CREATE UNIQUE INDEX "Organization_creation_action_unique"
  ON "Organization" ("createdByUserId", "creationClientActionId");

ALTER TABLE "Organization"
  ADD CONSTRAINT "Organization_creation_action_pair_check"
  CHECK (
    ("creationClientActionId" IS NULL AND "creationPayloadHash" IS NULL)
    OR
    ("creationClientActionId" IS NOT NULL AND "creationPayloadHash" IS NOT NULL AND "createdByUserId" IS NOT NULL)
  );
