-- AlterTable
ALTER TABLE "ServiceProviderService" ADD COLUMN     "activityCatalog" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "ServiceReferral" (
    "id" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "serviceId" TEXT,
    "kovName" TEXT NOT NULL,
    "referralNumber" TEXT,
    "clientUserId" TEXT,
    "clientErasedAt" TIMESTAMP(3),
    "clientDisplayName" TEXT,
    "clientExternalRef" TEXT,
    "periodStart" DATE,
    "periodEnd" DATE,
    "unit" TEXT NOT NULL DEFAULT 'HOUR',
    "allocatedQuantity" DECIMAL(10,2),
    "allocationPeriod" TEXT NOT NULL DEFAULT 'MONTH',
    "goalsText" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "retentionClass" TEXT NOT NULL DEFAULT 'accounting7y',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceEntry" (
    "id" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "ownerErasedAt" TIMESTAMP(3),
    "referralId" TEXT,
    "serviceId" TEXT,
    "clientUserId" TEXT,
    "clientErasedAt" TIMESTAMP(3),
    "clientDisplayName" TEXT,
    "clientExternalRef" TEXT,
    "date" DATE NOT NULL,
    "departedForVisitAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "locationStamps" JSONB,
    "unit" TEXT NOT NULL DEFAULT 'HOUR',
    "quantity" DECIMAL(10,2) NOT NULL,
    "activities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "moneyAmount" DECIMAL(10,2),
    "moneyNote" TEXT,
    "workerName" TEXT,
    "note" TEXT,
    "noteProvenance" TEXT,
    "confirmedManually" BOOLEAN NOT NULL DEFAULT false,
    "confirmedByClientAt" TIMESTAMP(3),
    "retentionClass" TEXT NOT NULL DEFAULT 'accounting7y',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceMonthlyNarrative" (
    "id" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "referralId" TEXT,
    "clientUserId" TEXT,
    "clientErasedAt" TIMESTAMP(3),
    "clientDisplayName" TEXT,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "bodyText" TEXT NOT NULL,
    "draftSource" TEXT,
    "retentionClass" TEXT NOT NULL DEFAULT 'accounting7y',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceMonthlyNarrative_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceReferral_providerProfileId_status_idx" ON "ServiceReferral"("providerProfileId", "status");

-- CreateIndex
CREATE INDEX "ServiceReferral_providerProfileId_periodStart_idx" ON "ServiceReferral"("providerProfileId", "periodStart");

-- CreateIndex
CREATE INDEX "ServiceReferral_clientUserId_idx" ON "ServiceReferral"("clientUserId");

-- CreateIndex
CREATE INDEX "ServiceReferral_serviceId_idx" ON "ServiceReferral"("serviceId");

-- CreateIndex
CREATE INDEX "ServiceEntry_providerProfileId_date_idx" ON "ServiceEntry"("providerProfileId", "date");

-- CreateIndex
CREATE INDEX "ServiceEntry_referralId_idx" ON "ServiceEntry"("referralId");

-- CreateIndex
CREATE INDEX "ServiceEntry_providerProfileId_clientUserId_date_idx" ON "ServiceEntry"("providerProfileId", "clientUserId", "date");

-- CreateIndex
CREATE INDEX "ServiceEntry_ownerUserId_date_idx" ON "ServiceEntry"("ownerUserId", "date");

-- CreateIndex
CREATE INDEX "ServiceEntry_serviceId_idx" ON "ServiceEntry"("serviceId");

-- CreateIndex
CREATE INDEX "ServiceMonthlyNarrative_providerProfileId_periodYear_period_idx" ON "ServiceMonthlyNarrative"("providerProfileId", "periodYear", "periodMonth");

-- CreateIndex
CREATE INDEX "ServiceMonthlyNarrative_referralId_idx" ON "ServiceMonthlyNarrative"("referralId");

-- CreateIndex
CREATE INDEX "ServiceMonthlyNarrative_clientUserId_idx" ON "ServiceMonthlyNarrative"("clientUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceMonthlyNarrative_providerProfileId_referralId_period_key" ON "ServiceMonthlyNarrative"("providerProfileId", "referralId", "periodYear", "periodMonth");

-- AddForeignKey
ALTER TABLE "ServiceReferral" ADD CONSTRAINT "ServiceReferral_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "ServiceProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceReferral" ADD CONSTRAINT "ServiceReferral_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ServiceProviderService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceReferral" ADD CONSTRAINT "ServiceReferral_clientUserId_fkey" FOREIGN KEY ("clientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceEntry" ADD CONSTRAINT "ServiceEntry_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "ServiceProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceEntry" ADD CONSTRAINT "ServiceEntry_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceEntry" ADD CONSTRAINT "ServiceEntry_clientUserId_fkey" FOREIGN KEY ("clientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceEntry" ADD CONSTRAINT "ServiceEntry_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "ServiceReferral"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceEntry" ADD CONSTRAINT "ServiceEntry_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ServiceProviderService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceMonthlyNarrative" ADD CONSTRAINT "ServiceMonthlyNarrative_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "ServiceProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceMonthlyNarrative" ADD CONSTRAINT "ServiceMonthlyNarrative_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "ServiceReferral"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceMonthlyNarrative" ADD CONSTRAINT "ServiceMonthlyNarrative_clientUserId_fkey" FOREIGN KEY ("clientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Osalised unikaalindeksid: ÜKS kuunarratiiv kliendi kohta kuus, ka siis kui
-- suunamiskirjet ei ole. Prisma `@@unique` katab ainult suunamisega rea, sest
-- Postgresis ei ole kaks NULL-i võrdsed — ilma nende kaheta saaks sama kliendi
-- sama kuu kohta tekkida piiramatu arv narratiive ja aruanne muutuks
-- mitmetimõistetavaks. Kaks indeksit, sest klient on kahel rajal:
-- platvormi kasutaja VÕI väline nimi.
CREATE UNIQUE INDEX "ServiceMonthlyNarrative_noreferral_clientuser_key"
  ON "ServiceMonthlyNarrative" ("providerProfileId", "clientUserId", "periodYear", "periodMonth")
  WHERE "referralId" IS NULL AND "clientUserId" IS NOT NULL;

CREATE UNIQUE INDEX "ServiceMonthlyNarrative_noreferral_clientname_key"
  ON "ServiceMonthlyNarrative" ("providerProfileId", "clientDisplayName", "periodYear", "periodMonth")
  WHERE "referralId" IS NULL AND "clientUserId" IS NULL AND "clientDisplayName" IS NOT NULL;
