-- KODUTEENUS kiht 2, K2-c — otsus ja maht kliendi juures.
--
-- SHS § 18 lg 2 järgi osutatakse koduteenust haldusakti või halduslepingu alusel.
-- Seni ei olnud koduteenuse kliendi juures kohta, kuhu kirjutada, kes otsustas, mis
-- ajani otsus kehtib ja kui palju abi on otsustatud. Teenuspäeviku suunamine kuulub
-- ühe töötaja isiklikule profiilile ega sobi asutuse ühiseks otsuse kirjeks.
--
-- Maht on minutites nädalas või kuus (ekraanil tundides): nii saab seda hiljem
-- võrrelda osutatud käikude ajaga ilma ümardamiseta. Päevad on tekstina AAAA-KK-PP
-- (sama kuju mis hoolduskava ülevaatuse päeval), et ajavöönd neid ei nihutaks.
--
-- Aditiivne: üks uus tabel. Eelmine rakenduse versioon seda ei loe.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "CareDecision" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "issuerName" TEXT,
    "documentNumber" TEXT,
    "decidedOn" TEXT,
    "validFrom" TEXT NOT NULL,
    "validUntil" TEXT,
    "volumeMinutes" INTEGER,
    "volumePeriod" TEXT,
    "feeNote" TEXT,
    "note" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByMembershipId" TEXT,
    "createdByName" TEXT,
    "retractedAt" TIMESTAMP(3),
    "retractedByMembershipId" TEXT,
    "retractedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareDecision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CareDecision_clientId_validFrom_idx" ON "CareDecision"("clientId", "validFrom");
CREATE INDEX "CareDecision_organizationId_validUntil_idx" ON "CareDecision"("organizationId", "validUntil");

ALTER TABLE "CareDecision"
  ADD CONSTRAINT "CareDecision_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "CareClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CareDecision"
  ADD CONSTRAINT "CareDecision_kind_check" CHECK ("kind" IN ('ACT', 'CONTRACT'));
-- Päevad kujul AAAA-KK-PP; lõpp ei ole enne algust (sama kuju tekstid võrduvad päevade järjekorras).
ALTER TABLE "CareDecision"
  ADD CONSTRAINT "CareDecision_days_check" CHECK (
    "validFrom" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    AND ("validUntil" IS NULL OR "validUntil" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
    AND ("decidedOn" IS NULL OR "decidedOn" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
  );
ALTER TABLE "CareDecision"
  ADD CONSTRAINT "CareDecision_period_check" CHECK ("validUntil" IS NULL OR "validUntil" >= "validFrom");
-- Maht: kas mõlemad väljad või mitte kumbki; nädalas kuni 168 tundi, kuus kuni 744.
ALTER TABLE "CareDecision"
  ADD CONSTRAINT "CareDecision_volume_check" CHECK (
    ("volumeMinutes" IS NULL AND "volumePeriod" IS NULL)
    OR ("volumeMinutes" IS NOT NULL AND "volumePeriod" IS NOT NULL
      AND (("volumePeriod" = 'WEEK' AND "volumeMinutes" BETWEEN 1 AND 10080)
        OR ("volumePeriod" = 'MONTH' AND "volumeMinutes" BETWEEN 1 AND 44640)))
  );

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE IF EXISTS "CareDecision";
