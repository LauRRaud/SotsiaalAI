CREATE TYPE "JourneyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "JourneySharingStatus" AS ENUM ('PRIVATE');

CREATE TABLE "Journey" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "conversationId" TEXT,
  "roleContext" "Role" NOT NULL DEFAULT 'CLIENT',
  "status" "JourneyStatus" NOT NULL DEFAULT 'ACTIVE',
  "sharingStatus" "JourneySharingStatus" NOT NULL DEFAULT 'PRIVATE',
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "primaryPath" TEXT,
  "domains" JSONB,
  "missingInfo" JSONB,
  "riskSignals" JSONB,
  "suggestedActions" JSONB,
  "context" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Journey_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Journey_ownerUserId_updatedAt_idx" ON "Journey"("ownerUserId", "updatedAt");
CREATE INDEX "Journey_ownerUserId_status_updatedAt_idx" ON "Journey"("ownerUserId", "status", "updatedAt");
CREATE INDEX "Journey_conversationId_idx" ON "Journey"("conversationId");

ALTER TABLE "Journey" ADD CONSTRAINT "Journey_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Journey" ADD CONSTRAINT "Journey_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
