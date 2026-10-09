-- KODUTEENUS kiht 2, K2-a — asutuse toimingute kataloog.
--
-- Sotsiaalkaitseministri 29.06.2023 määrus nr 40 „Nõuded koduteenusele" § 2 nimetab
-- kuus koduabi ja kümme isikuabi toimingurühma. See on kataloogi ülemine tase ja
-- seda asutus ei muuda. Alumine tase on asutuse enda toimingud tema enda sõnastuses;
-- iga toiming kuulub ühte riiklikku rühma. Samast kataloogist võtavad edaspidi oma
-- sõnad hoolduskava, käigu kirje ja kuu aruanne.
--
-- Aditiivne: üks uus tabel. Eelmine rakenduse versioon seda ei loe.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "CareActivity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" TIMESTAMP(3),
    "createdByMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CareActivity_organizationId_archivedAt_group_position_idx"
  ON "CareActivity"("organizationId", "archivedAt", "group", "position");

-- Üks kehtiv toiming ühe nimega asutuse kohta (suur- ja väiketäht ei erista).
-- Arhiveeritud nimi on vaba: sama nimega toimingu võib uuesti luua.
CREATE UNIQUE INDEX "CareActivity_organizationId_name_active_key"
  ON "CareActivity"("organizationId", lower("name"))
  WHERE "archivedAt" IS NULL;

ALTER TABLE "CareActivity"
  ADD CONSTRAINT "CareActivity_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rühm on määruse loend; seda muudab ainult määruse muutus koos uue migratsiooniga.
ALTER TABLE "CareActivity"
  ADD CONSTRAINT "CareActivity_group_check" CHECK ("group" IN (
    'SHOPPING', 'SERVICES_AND_ERRANDS', 'HEATING', 'HOME_SAFETY', 'HOUSEKEEPING', 'OTHER_HOME_HELP',
    'HYGIENE', 'NUTRITION', 'DRESSING', 'LAUNDRY', 'MEDICATION', 'ABILITY_MONITORING',
    'NETWORK', 'MENTAL_SUPPORT', 'ASSISTIVE_TECH', 'OTHER_PERSONAL_HELP'
  ));
ALTER TABLE "CareActivity"
  ADD CONSTRAINT "CareActivity_name_check" CHECK (char_length(btrim("name")) > 0);

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE IF EXISTS "CareActivity";
