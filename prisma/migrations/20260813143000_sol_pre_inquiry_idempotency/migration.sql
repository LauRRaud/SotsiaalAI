-- SOL-PRE-16: a browser retry or a parallel double submit is one create action.
-- Nullable keeps older/internal callers compatible; the public UI always sends a UUID.
ALTER TABLE "PreInquiry"
  ADD COLUMN "clientActionId" TEXT,
  ADD COLUMN "clientActionHash" TEXT;

CREATE UNIQUE INDEX "PreInquiry_authorId_clientActionId_key"
  ON "PreInquiry"("authorId", "clientActionId");

ALTER TABLE "PreInquiry"
  ADD CONSTRAINT "PreInquiry_clientActionId_shape"
  CHECK ("clientActionId" IS NULL OR "clientActionId" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  ADD CONSTRAINT "PreInquiry_clientAction_hash_pair"
  CHECK (("clientActionId" IS NULL) = ("clientActionHash" IS NULL));
