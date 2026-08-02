-- TEENUSPÄEVIK E2c — PÄEVATEEKOND.
--
-- Neli fikseeritud märget eeldasid, et külastus algab kontorist ja lõpeb
-- kontoris. Koduhooldaja tööpäev ei ole selline: kuus klienti järjest, tagasi
-- ei minda. Päevateekonnal on järgmise töö EN_ROUTE→ARRIVED eelmise lahkumise
-- sõidulõik ja fiktiivset „tagasi" ei ole enam vaja.
--
-- ADDITIIVNE. Ükski olemasolev tabel ei muutu; `ServiceEntry` jääb täpselt
-- selliseks nagu ta on ja OSA I voog töötab edasi muutmata kujul.

CREATE TYPE "ServiceWorkRouteStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "ServiceVisitStatus" AS ENUM (
  'PLANNED', 'EN_ROUTE', 'ARRIVED', 'COMPLETED', 'CANCELLED', 'NOT_DONE', 'NEEDS_CORRECTION'
);

CREATE TABLE "ServiceWorkRoute" (
  "id" TEXT NOT NULL,
  "providerProfileId" TEXT NOT NULL,
  "workerUserId" TEXT,
  "date" DATE NOT NULL,
  "status" "ServiceWorkRouteStatus" NOT NULL DEFAULT 'OPEN',
  "startedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "breakStartedAt" TIMESTAMP(3),
  "breakMinutes" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceWorkRoute_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ServiceWorkRoute_providerProfileId_date_idx" ON "ServiceWorkRoute" ("providerProfileId", "date");
CREATE INDEX "ServiceWorkRoute_workerUserId_status_idx" ON "ServiceWorkRoute" ("workerUserId", "status");

-- ÜKS AVATUD TÖÖPÄEV KORRAGA. Kaks paralleelset avatud teekonda tähendaks, et
-- „jooksev külastus" ei ole üheselt määratud ja nupp ei teaks, mida juhtida.
-- Osaline indeks, sest suletud päevi on igal töötajal palju.
CREATE UNIQUE INDEX "ServiceWorkRoute_open_unique"
  ON "ServiceWorkRoute" ("providerProfileId", "workerUserId")
  WHERE "status" = 'OPEN';

CREATE TABLE "ServiceVisit" (
  "id" TEXT NOT NULL,
  "providerProfileId" TEXT NOT NULL,
  "routeId" TEXT,
  "ownerUserId" TEXT,
  "referralId" TEXT,
  "serviceId" TEXT,
  "clientUserId" TEXT,
  "clientDisplayName" TEXT,
  "clientExternalRef" TEXT,
  "address" TEXT,
  "status" "ServiceVisitStatus" NOT NULL DEFAULT 'PLANNED',
  "plannedStartAt" TIMESTAMP(3),
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "enRouteAt" TIMESTAMP(3),
  "arrivedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "outcomeReason" TEXT,
  "note" TEXT,
  "noteProvenance" TEXT,
  "locationStamps" JSONB,
  "serviceEntryId" TEXT,
  "clientRequestId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceVisit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceVisit_serviceEntryId_key" ON "ServiceVisit" ("serviceEntryId");
-- Idempotentsus: sama nupuvajutus võrgu taastumisel ei loo teist külastust.
-- NULL-id on PostgreSQL-is unikaalindeksis üksteisest erinevad, seega
-- võtmeta külastused ei sega üksteist.
CREATE UNIQUE INDEX "ServiceVisit_providerProfileId_clientRequestId_key"
  ON "ServiceVisit" ("providerProfileId", "clientRequestId");
CREATE INDEX "ServiceVisit_providerProfileId_status_idx" ON "ServiceVisit" ("providerProfileId", "status");
CREATE INDEX "ServiceVisit_routeId_sortOrder_idx" ON "ServiceVisit" ("routeId", "sortOrder");
CREATE INDEX "ServiceVisit_referralId_idx" ON "ServiceVisit" ("referralId");

ALTER TABLE "ServiceWorkRoute" ADD CONSTRAINT "ServiceWorkRoute_providerProfileId_fkey"
  FOREIGN KEY ("providerProfileId") REFERENCES "ServiceProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceVisit" ADD CONSTRAINT "ServiceVisit_providerProfileId_fkey"
  FOREIGN KEY ("providerProfileId") REFERENCES "ServiceProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- SetNull, mitte Cascade: tööpäeva kustumine ei tohi külastusi kaasa viia.
ALTER TABLE "ServiceVisit" ADD CONSTRAINT "ServiceVisit_routeId_fkey"
  FOREIGN KEY ("routeId") REFERENCES "ServiceWorkRoute"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceVisit" ADD CONSTRAINT "ServiceVisit_serviceEntryId_fkey"
  FOREIGN KEY ("serviceEntryId") REFERENCES "ServiceEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceVisit" ADD CONSTRAINT "ServiceVisit_referralId_fkey"
  FOREIGN KEY ("referralId") REFERENCES "ServiceReferral"("id") ON DELETE SET NULL ON UPDATE CASCADE;
