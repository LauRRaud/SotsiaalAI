-- Persistent link from a pre-inquiry back to the Journey it was started from (A1).
-- Nullable and forward-compatible: existing pre-inquiries keep "sourceJourneyId" = NULL.
-- Deleting a Journey nulls the link (ON DELETE SET NULL); the pre-inquiry itself survives.

-- AlterTable
ALTER TABLE "PreInquiry" ADD COLUMN "sourceJourneyId" TEXT;

-- CreateIndex
CREATE INDEX "PreInquiry_sourceJourneyId_idx" ON "PreInquiry"("sourceJourneyId");

-- AddForeignKey
ALTER TABLE "PreInquiry" ADD CONSTRAINT "PreInquiry_sourceJourneyId_fkey" FOREIGN KEY ("sourceJourneyId") REFERENCES "Journey"("id") ON DELETE SET NULL ON UPDATE CASCADE;
