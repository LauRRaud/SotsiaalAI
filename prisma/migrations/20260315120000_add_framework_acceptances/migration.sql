-- CreateTable
CREATE TABLE "FrameworkAcceptance" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "frameworkKey" TEXT NOT NULL,
  "frameworkVersion" TEXT NOT NULL,
  "acceptanceType" TEXT NOT NULL,
  "acceptanceSource" TEXT NOT NULL,
  "roleAtAcceptance" "Role" NOT NULL,
  "locale" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "acceptedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "reviewDocumentOpenedAt" TIMESTAMP,
  "signedDocumentDownloadedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "FrameworkAcceptance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FrameworkAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- AlterTable
ALTER TABLE "UserDocument"
ADD COLUMN "frameworkAcceptanceId" TEXT;

-- CreateIndex
CREATE INDEX "FrameworkAcceptance_userId_acceptedAt_idx" ON "FrameworkAcceptance"("userId", "acceptedAt");

-- CreateIndex
CREATE INDEX "FrameworkAcceptance_frameworkKey_frameworkVersion_acceptedAt_idx" ON "FrameworkAcceptance"("frameworkKey", "frameworkVersion", "acceptedAt");

-- CreateIndex
CREATE INDEX "FrameworkAcceptance_acceptanceType_acceptedAt_idx" ON "FrameworkAcceptance"("acceptanceType", "acceptedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserDocument_frameworkAcceptanceId_key" ON "UserDocument"("frameworkAcceptanceId");

-- AddForeignKey
ALTER TABLE "UserDocument"
ADD CONSTRAINT "UserDocument_frameworkAcceptanceId_fkey"
FOREIGN KEY ("frameworkAcceptanceId") REFERENCES "FrameworkAcceptance"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
