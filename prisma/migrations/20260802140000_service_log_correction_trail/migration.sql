-- AlterTable
ALTER TABLE "ServiceProviderService" ADD COLUMN     "defaultUnit" TEXT;

-- AlterTable
ALTER TABLE "ServiceEntry" ADD COLUMN     "finalizedAt" TIMESTAMP(3),
ADD COLUMN     "recordedFiscalYear" INTEGER,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ServiceEntryCorrection" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorErasedAt" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "previousValues" JSONB NOT NULL,
    "changedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceEntryCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceEntryCorrection_entryId_createdAt_idx" ON "ServiceEntryCorrection"("entryId", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceEntryCorrection_actorUserId_idx" ON "ServiceEntryCorrection"("actorUserId");

-- CreateIndex
CREATE INDEX "ServiceEntry_providerProfileId_status_date_idx" ON "ServiceEntry"("providerProfileId", "status", "date");

-- AddForeignKey
ALTER TABLE "ServiceEntryCorrection" ADD CONSTRAINT "ServiceEntryCorrection_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ServiceEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceEntryCorrection" ADD CONSTRAINT "ServiceEntryCorrection_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
