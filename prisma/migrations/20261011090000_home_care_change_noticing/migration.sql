-- KODUTEENUS K5-a — „Kas täna oli midagi teisiti?" (kava II.6.2).
--
-- Kui klienti jagab mitu hooldajat, ei märka keegi aeglast muutust. Seepärast kannab
-- muutust süsteem: kliendi juures on kirjas tema TAVALINE SEIS kuues valdkonnas,
-- käigu lõpus vastab hooldaja ühele küsimusele („ei" on üks puudutus) ja kui kaks eri
-- hooldajat märgivad 14 päeva jooksul sama valdkonna või üks märgib suure muutuse,
-- tekib hooldusjuhile MÄRKAMINE, mis vajab vastust.
--
-- Aditiivne: kolm uut veergu kirjel (vanadel ridadel vastus puudub) ja kaks uut
-- tabelit; eelmine rakenduse versioon neid ei loe.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

-- Vastus käigu lõpu küsimusele. NULL = ei küsitud või ei vastatud.
ALTER TABLE "CareClientEntry" ADD COLUMN "changeAnswer" TEXT;
ALTER TABLE "CareClientEntry" ADD COLUMN "changeAreas" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "CareClientEntry" ADD COLUMN "changeMajor" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "CareClientEntry"
  ADD CONSTRAINT "CareClientEntry_changeAnswer_check"
  CHECK ("changeAnswer" IS NULL OR "changeAnswer" IN ('NO', 'YES'));
-- Valdkonnad ja „suur muutus" ainult vastusega „jah"; „jah" nõuab vähemalt ühte valdkonda.
-- Võrdlus on IS (NOT) DISTINCT FROM, sest tavaline võrdlus annaks puuduva vastuse korral
-- NULL-i ja CHECK laseks rea läbi.
ALTER TABLE "CareClientEntry"
  ADD CONSTRAINT "CareClientEntry_changeAreas_check"
  CHECK (
    "changeAreas" IS NOT NULL
    AND "changeAreas" <@ ARRAY['MOBILITY', 'EATING', 'MOOD', 'MEMORY', 'SKIN_PAIN', 'HOME']::TEXT[]
    AND (
      ("changeAnswer" IS NOT DISTINCT FROM 'YES' AND cardinality("changeAreas") BETWEEN 1 AND 6)
      OR ("changeAnswer" IS DISTINCT FROM 'YES' AND cardinality("changeAreas") = 0 AND "changeMajor" = false)
    )
  );

-- Tavaline seis: üks kehtiv rida valdkonna kohta. Ridu ei muudeta: uus tekst lõpetab eelmise.
CREATE TABLE "CareUsualState" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdByMembershipId" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endedByMembershipId" TEXT,

    CONSTRAINT "CareUsualState_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CareUsualState_clientId_endedAt_idx" ON "CareUsualState"("clientId", "endedAt");
CREATE INDEX "CareUsualState_organizationId_idx" ON "CareUsualState"("organizationId");
CREATE UNIQUE INDEX "CareUsualState_active_key" ON "CareUsualState"("clientId", "area") WHERE "endedAt" IS NULL;

ALTER TABLE "CareUsualState"
  ADD CONSTRAINT "CareUsualState_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "CareClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareUsualState"
  ADD CONSTRAINT "CareUsualState_area_check"
  CHECK ("area" IN ('MOBILITY', 'EATING', 'MOOD', 'MEMORY', 'SKIN_PAIN', 'HOME'));
ALTER TABLE "CareUsualState"
  ADD CONSTRAINT "CareUsualState_text_check" CHECK (char_length(btrim("text")) BETWEEN 1 AND 300);

-- Märkamine, mis vajab hooldusjuhi vastust. Üks lahtine kliendi ja valdkonna kohta.
CREATE TABLE "CareChangeSignal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "entryId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handledAt" TIMESTAMP(3),
    "handledByMembershipId" TEXT,
    "handledByName" TEXT,
    "outcome" TEXT,
    "note" TEXT,

    CONSTRAINT "CareChangeSignal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CareChangeSignal_clientId_openedAt_idx" ON "CareChangeSignal"("clientId", "openedAt");
CREATE INDEX "CareChangeSignal_organizationId_handledAt_idx" ON "CareChangeSignal"("organizationId", "handledAt");
CREATE UNIQUE INDEX "CareChangeSignal_open_key" ON "CareChangeSignal"("clientId", "area") WHERE "handledAt" IS NULL;

ALTER TABLE "CareChangeSignal"
  ADD CONSTRAINT "CareChangeSignal_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "CareClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareChangeSignal"
  ADD CONSTRAINT "CareChangeSignal_area_check"
  CHECK ("area" IN ('MOBILITY', 'EATING', 'MOOD', 'MEMORY', 'SKIN_PAIN', 'HOME'));
ALTER TABLE "CareChangeSignal"
  ADD CONSTRAINT "CareChangeSignal_reason_check" CHECK ("reason" IN ('TWO_WORKERS', 'MAJOR'));
-- Vastus on kas tervikuna olemas või puudub; vastuse liik kindlast loendist.
ALTER TABLE "CareChangeSignal"
  ADD CONSTRAINT "CareChangeSignal_handled_check"
  CHECK (
    ("handledAt" IS NULL AND "outcome" IS NULL AND "note" IS NULL)
    OR (
      "handledAt" IS NOT NULL
      AND "outcome" IS NOT NULL
      AND "outcome" IN ('TALKED_CLIENT', 'TOLD_RELATIVE', 'TOLD_DOCTOR', 'TOLD_SOCIAL_WORKER', 'WATCHING', 'NO_ACTION')
      AND ("note" IS NULL OR char_length("note") <= 300)
    )
  );

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE IF EXISTS "CareChangeSignal";
--   DROP TABLE IF EXISTS "CareUsualState";
--   ALTER TABLE "CareClientEntry" DROP COLUMN IF EXISTS "changeMajor", DROP COLUMN IF EXISTS "changeAreas", DROP COLUMN IF EXISTS "changeAnswer";
