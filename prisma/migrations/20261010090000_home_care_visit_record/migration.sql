-- KODUTEENUS kiht 2, K2-d — käigu kirje: kestus ja tehtud toimingud päeviku kirjel.
--
-- Hooldaja kirjutas seni käigu kohta vaba teksti. Sellest ei saa lugeda, kui kaua
-- käik kestis ega mida hoolduskavast tehti, ja otsustatud mahu kõrvale ei ole
-- midagi panna. Käigu kirje ei ole eraldi asi: see on sama päeviku kirje, millel on
-- kestus minutites ja tehtud toimingud. Nii on kliendi juures üks kirje ühe käigu
-- kohta, see salvestub ka võrguta ja parandus käib sama jälje kaudu.
--
-- Tehtud toiming kannab toimingu nime ja rühma koopiat (kava või kataloogi
-- hilisem muutmine kirjet ei muuda) ja seda, KUIDAS tehti: inimene tegi ise ja
-- hooldaja juhendas, tehti koos, hooldaja aitas osaliselt või tegi tema eest.
--
-- Aditiivne: üks nullitav veerg ja üks uus tabel. Eelmine rakenduse versioon
-- neid ei loe ega kirjuta. CHECK olemasolevale tabelile lisatakse NOT VALID-ina
-- (olemasolevatel ridadel on veerg NULL; uusi ridu kontrollitakse kohe).

SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE "CareClientEntry" ADD COLUMN "visitMinutes" INTEGER;

-- Kestus jääb ühe ööpäeva piiresse. Et kestus on ainult käigul (kontakti viis VISIT),
-- hoiab rakendus: andmebaasi kontroll seda ei seo, sest eelmine rakenduse versioon
-- peab saama kontakti viisi parandada ka real, millel kestus juba on.
ALTER TABLE "CareClientEntry"
  ADD CONSTRAINT "CareClientEntry_visitMinutes_check"
  CHECK ("visitMinutes" IS NULL OR "visitMinutes" BETWEEN 1 AND 1440) NOT VALID;

CREATE TABLE "CareEntryActivity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "planLineId" TEXT,
    "activityId" TEXT,
    "activityName" TEXT NOT NULL,
    "activityGroup" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "outsidePlan" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareEntryActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CareEntryActivity_entryId_position_idx" ON "CareEntryActivity"("entryId", "position");
CREATE INDEX "CareEntryActivity_clientId_idx" ON "CareEntryActivity"("clientId");
CREATE INDEX "CareEntryActivity_activityId_idx" ON "CareEntryActivity"("activityId");
CREATE INDEX "CareEntryActivity_planLineId_idx" ON "CareEntryActivity"("planLineId");
-- Üks toiming ühel kirjel üks kord.
CREATE UNIQUE INDEX "CareEntryActivity_entryId_activityId_key" ON "CareEntryActivity"("entryId", "activityId") WHERE "activityId" IS NOT NULL;

ALTER TABLE "CareEntryActivity"
  ADD CONSTRAINT "CareEntryActivity_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "CareClientEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Kava rida ja kataloogi toimingut rakendus ei kustuta (asendab, arhiveerib). Kui
-- need siiski kaovad (kliendi või asutuse kustutamine), jääb nime koopia alles.
ALTER TABLE "CareEntryActivity"
  ADD CONSTRAINT "CareEntryActivity_planLineId_fkey"
  FOREIGN KEY ("planLineId") REFERENCES "CarePlanLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CareEntryActivity"
  ADD CONSTRAINT "CareEntryActivity_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "CareActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CareEntryActivity"
  ADD CONSTRAINT "CareEntryActivity_activityGroup_check" CHECK ("activityGroup" IN (
    'SHOPPING', 'SERVICES_AND_ERRANDS', 'HEATING', 'HOME_SAFETY', 'HOUSEKEEPING', 'OTHER_HOME_HELP',
    'HYGIENE', 'NUTRITION', 'DRESSING', 'LAUNDRY', 'MEDICATION', 'ABILITY_MONITORING',
    'NETWORK', 'MENTAL_SUPPORT', 'ASSISTIVE_TECH', 'OTHER_PERSONAL_HELP'
  ));
ALTER TABLE "CareEntryActivity"
  ADD CONSTRAINT "CareEntryActivity_mode_check" CHECK ("mode" IN ('GUIDE', 'TOGETHER', 'ASSIST', 'FOR'));
ALTER TABLE "CareEntryActivity"
  ADD CONSTRAINT "CareEntryActivity_activityName_check" CHECK (char_length(btrim("activityName")) > 0);
-- Kavaväline toiming ei viita kava reale; kava toiming on kavaväline ainult siis, kui viide on kadunud.
ALTER TABLE "CareEntryActivity"
  ADD CONSTRAINT "CareEntryActivity_outsidePlan_check" CHECK (NOT ("outsidePlan" AND "planLineId" IS NOT NULL));

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE IF EXISTS "CareEntryActivity";
--   ALTER TABLE "CareClientEntry" DROP CONSTRAINT IF EXISTS "CareClientEntry_visitMinutes_check";
--   ALTER TABLE "CareClientEntry" DROP COLUMN IF EXISTS "visitMinutes";
