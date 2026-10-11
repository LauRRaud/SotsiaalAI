-- Additive: old application versions keep working. Private content has only an owner relation.
SET lock_timeout = '5s';
SET statement_timeout = '30s';
CREATE TABLE "EthicsReflection" (
  "id" TEXT NOT NULL, "ownerUserId" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 1,
  "content" JSONB NOT NULL, "creationKey" TEXT NOT NULL, "creationHash" TEXT NOT NULL,
  "covisionCaseId" TEXT, "sharedText" TEXT, "sharedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EthicsReflection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EthicsReflection_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "EthicsReflection_ownerUserId_creationKey_key" ON "EthicsReflection"("ownerUserId", "creationKey");
CREATE INDEX "EthicsReflection_ownerUserId_id_idx" ON "EthicsReflection"("ownerUserId", "id");
RESET lock_timeout;
RESET statement_timeout;
