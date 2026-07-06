CREATE TYPE "PreInquiryRecipientType" AS ENUM ('KOV_CONTACT', 'SERVICE_PROVIDER');

CREATE TYPE "PreInquiryDeliveryChannel" AS ENUM ('INTERNAL', 'EXTERNAL_EMAIL');

CREATE TYPE "PreInquiryStatus" AS ENUM ('DRAFT', 'READY', 'SENT', 'DOWNLOADED', 'ARCHIVED');

CREATE TABLE "PreInquiry" (
  "id" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "recipientOwnerId" TEXT,
  "recipientEntryId" TEXT,
  "recipientType" "PreInquiryRecipientType" NOT NULL,
  "deliveryChannel" "PreInquiryDeliveryChannel" NOT NULL DEFAULT 'INTERNAL',
  "selectedRecipientEmail" TEXT,
  "selectedRecipientName" TEXT,
  "topic" TEXT,
  "situation" TEXT NOT NULL,
  "generatedDraft" TEXT,
  "userEditedDraft" TEXT,
  "status" "PreInquiryStatus" NOT NULL DEFAULT 'DRAFT',
  "sentAt" TIMESTAMP(3),
  "externalSendConfirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PreInquiry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PreInquiry_authorId_updatedAt_idx" ON "PreInquiry"("authorId", "updatedAt");
CREATE INDEX "PreInquiry_recipientOwnerId_updatedAt_idx" ON "PreInquiry"("recipientOwnerId", "updatedAt");
CREATE INDEX "PreInquiry_recipientEntryId_idx" ON "PreInquiry"("recipientEntryId");
CREATE INDEX "PreInquiry_recipientType_idx" ON "PreInquiry"("recipientType");
CREATE INDEX "PreInquiry_deliveryChannel_idx" ON "PreInquiry"("deliveryChannel");
CREATE INDEX "PreInquiry_status_idx" ON "PreInquiry"("status");
CREATE INDEX "PreInquiry_createdAt_idx" ON "PreInquiry"("createdAt");

ALTER TABLE "PreInquiry"
  ADD CONSTRAINT "PreInquiry_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PreInquiry"
  ADD CONSTRAINT "PreInquiry_recipientOwnerId_fkey"
  FOREIGN KEY ("recipientOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PreInquiry"
  ADD CONSTRAINT "PreInquiry_recipientEntryId_fkey"
  FOREIGN KEY ("recipientEntryId") REFERENCES "ServiceMapEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
