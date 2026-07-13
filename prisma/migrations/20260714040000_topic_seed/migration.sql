-- A6.1 — Teemaseeme owner-private persistent core (O2 variant B: a SEPARATE
-- model, never a CovisionCase). Forward-compatible: adds a new enum + TopicSeed
-- table only; no existing row or table is touched, so no backfill is needed.

-- CreateEnum
CREATE TYPE "TopicSeedStatus" AS ENUM ('DRAFT', 'WAITING');

-- CreateTable
CREATE TABLE "TopicSeed" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT,
    "contextType" TEXT,
    "caseType" TEXT,
    "whyNow" TEXT,
    "requestedSupport" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "importance" INTEGER,
    "safetyGate" TEXT,
    "status" "TopicSeedStatus" NOT NULL DEFAULT 'DRAFT',
    "sharedCardSnapshot" JSONB,
    "ownerConfirmedAt" TIMESTAMP(3),
    "sharedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopicSeed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TopicSeed_ownerId_updatedAt_idx" ON "TopicSeed"("ownerId", "updatedAt");

-- CreateIndex
CREATE INDEX "TopicSeed_status_idx" ON "TopicSeed"("status");

-- CreateIndex
CREATE INDEX "TopicSeed_createdAt_idx" ON "TopicSeed"("createdAt");

-- AddForeignKey
ALTER TABLE "TopicSeed" ADD CONSTRAINT "TopicSeed_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
