-- A4 — MTR tegevusloa kontroll teenuseprofiilil.
--
-- ADDITIIVNE: kolm uut enum'i, neli uut tabelit, kaks uut nullitavat veergu
-- olemasolevatel tabelitel. Ühtegi olemasolevat rida ei puudutata ega ühtegi
-- veergu ei muudeta. Ilma seotud teenuseta (`serviceKey` IS NULL) ei tekita
-- funktsioon ühtki MTR-i päringut ega avalikku loaväidet.
--
-- KAKS ASJA, MIDA HILJEM LÕDVENDADA EI TOHI:
--
--   1. "ServiceProviderService"."serviceKey" on TEKST, mitte enum. Kataloogi
--      kasvamine peab olema andmeline muudatus, mitte migratsioon. Sama kehtib
--      "ServiceLicenceAssessment"."serviceKey" kohta.
--   2. "ServiceLicenceAssessment" hoiab loakohustuse otsust KONTROLLI HETKE
--      KOOPIANA (`requirementAtAssessment`, `activityExpected`,
--      `activityTypeExpected`, `catalogueVersion`). Vaate asemel koopia on siin
--      tahtlik: kui vastavustabel hiljem muutub, ei tohi vana kirje vaikselt
--      uut tähendust omandada.
--
-- "LicenceCheck" jääb alles ka ebaõnnestunud päringu korral: „me proovisime ja
-- ei saanud" on omaette fakt, mille osutaja ja admin peavad nägema. Tühi
-- tulemus EI tähenda kunagi „luba puudub".

CREATE TYPE "LicenceCheckResult" AS ENUM (
  'OK',
  'UNCONFIRMED'
);

CREATE TYPE "LicenceCoverage" AS ENUM (
  'EXACT_MATCH',
  'ACTIVITY_MATCH_ONLY',
  'NO_MATCH',
  'UNCONFIRMED'
);

CREATE TYPE "LicencePublicStatus" AS ENUM (
  'VERIFIED',
  'NO_SHS_LICENCE_REQUIRED',
  'NOT_FOUND',
  'UNCONFIRMED',
  'NOT_CHECKED',
  'SERVICE_MAPPING_REQUIRED'
);

ALTER TABLE "ServiceProviderService" ADD COLUMN "serviceKey" TEXT;

CREATE INDEX "ServiceProviderService_serviceKey_idx" ON "ServiceProviderService"("serviceKey");

CREATE TABLE "LicenceCheck" (
  "id" TEXT NOT NULL,
  "providerProfileId" TEXT NOT NULL,
  "registryCode" TEXT NOT NULL,
  "result" "LicenceCheckResult" NOT NULL,
  "reason" TEXT,
  "entityResolved" BOOLEAN NOT NULL DEFAULT false,
  "entityName" TEXT,
  "checksumValid" BOOLEAN NOT NULL DEFAULT false,
  "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verifiedAt" TIMESTAMP(3),
  "nextCheckAt" TIMESTAMP(3),
  "unknownColumns" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "missingOrderedColumns" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LicenceCheck_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LicenceCheck_providerProfileId_attemptedAt_idx" ON "LicenceCheck"("providerProfileId", "attemptedAt");
CREATE INDEX "LicenceCheck_registryCode_attemptedAt_idx" ON "LicenceCheck"("registryCode", "attemptedAt");
CREATE INDEX "LicenceCheck_nextCheckAt_idx" ON "LicenceCheck"("nextCheckAt");

CREATE TABLE "LicenceRecord" (
  "id" TEXT NOT NULL,
  "checkId" TEXT NOT NULL,
  "licenceNumber" TEXT NOT NULL,
  "registryCode" TEXT NOT NULL,
  "activity" TEXT NOT NULL,
  "activityType" TEXT,
  "validFrom" TIMESTAMP(3) NOT NULL,
  "validUntil" TIMESTAMP(3),
  "indefinite" BOOLEAN NOT NULL DEFAULT false,
  "valid" BOOLEAN NOT NULL DEFAULT false,
  "organizationName" TEXT NOT NULL,
  "licensedMaxPersons" INTEGER,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LicenceRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LicenceRecord_checkId_idx" ON "LicenceRecord"("checkId");
CREATE INDEX "LicenceRecord_registryCode_activity_idx" ON "LicenceRecord"("registryCode", "activity");

CREATE TABLE "LicenceRecordLocation" (
  "id" TEXT NOT NULL,
  "recordId" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "licensedMaxPersons" INTEGER,

  CONSTRAINT "LicenceRecordLocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LicenceRecordLocation_recordId_idx" ON "LicenceRecordLocation"("recordId");

CREATE TABLE "ServiceLicenceAssessment" (
  "id" TEXT NOT NULL,
  "providerServiceId" TEXT NOT NULL,
  "checkId" TEXT,
  "serviceKey" TEXT NOT NULL,
  "catalogueVersion" TEXT NOT NULL,
  "requirementAtAssessment" TEXT NOT NULL,
  "activityExpected" TEXT,
  "activityTypeExpected" TEXT,
  "coverage" "LicenceCoverage" NOT NULL,
  "publicStatus" "LicencePublicStatus" NOT NULL,
  "consecutiveMissCount" INTEGER NOT NULL DEFAULT 0,
  "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ServiceLicenceAssessment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceLicenceAssessment_providerServiceId_key" ON "ServiceLicenceAssessment"("providerServiceId");
CREATE INDEX "ServiceLicenceAssessment_serviceKey_idx" ON "ServiceLicenceAssessment"("serviceKey");
CREATE INDEX "ServiceLicenceAssessment_publicStatus_idx" ON "ServiceLicenceAssessment"("publicStatus");

ALTER TABLE "LicenceCheck" ADD CONSTRAINT "LicenceCheck_providerProfileId_fkey"
  FOREIGN KEY ("providerProfileId") REFERENCES "ServiceProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LicenceRecord" ADD CONSTRAINT "LicenceRecord_checkId_fkey"
  FOREIGN KEY ("checkId") REFERENCES "LicenceCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LicenceRecordLocation" ADD CONSTRAINT "LicenceRecordLocation_recordId_fkey"
  FOREIGN KEY ("recordId") REFERENCES "LicenceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceLicenceAssessment" ADD CONSTRAINT "ServiceLicenceAssessment_providerServiceId_fkey"
  FOREIGN KEY ("providerServiceId") REFERENCES "ServiceProviderService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceLicenceAssessment" ADD CONSTRAINT "ServiceLicenceAssessment_checkId_fkey"
  FOREIGN KEY ("checkId") REFERENCES "LicenceCheck"("id") ON DELETE SET NULL ON UPDATE CASCADE;
