-- AlterTable
ALTER TABLE "OrganizationAdmin"
ADD COLUMN "ingestStatus" TEXT NOT NULL DEFAULT 'NOT_INGESTED',
ADD COLUMN "lastIngestedAt" TIMESTAMP(3),
ADD COLUMN "lastIngestError" TEXT,
ADD COLUMN "ragDocId" TEXT;

-- CreateIndex
CREATE INDEX "OrganizationAdmin_ingestStatus_idx" ON "OrganizationAdmin"("ingestStatus");
