-- KODUTEENUS K5-b — kriisivalmidus kliendi juures (kava II.6.12).
--
-- Koduteenuse korraldamine on omavalitsuse püsiv kriisiülesanne. Sotsiaalkindlustusameti
-- juhend soovitab jaotada koduteenuse kliendid kolme rühma selle järgi, kui palju tuge
-- nad kriisis vajavad: saab varudega seitse päeva ise hakkama, vajab tuge kord või kaks
-- nädalas, vajab hooldaja tuge iga päev. Seda teab ainult koduteenuse osutaja.
--
-- Kliendi juures on kriisiaste, sõltuvused (elekter, küte, vesi, side, liikumine, ravimid)
-- ja kes lähedastest saab aidata. Nendest tekib hooldusjuhile nimekiri, mille saab alla
-- laadida ja välja printida, sest kriisis ei pruugi rakendus töötada.
--
-- Rida ei muudeta ega kustutata: uus hinnang lõpetab eelmise (`endedAt`).
-- Aditiivne: üks uus tabel, eelmine rakenduse versioon seda ei loe.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "CareCrisisProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "dependencies" TEXT[],
    "helper" TEXT,
    "note" TEXT,
    "createdByMembershipId" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endedByMembershipId" TEXT,
    "endedByName" TEXT,

    CONSTRAINT "CareCrisisProfile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CareCrisisProfile_organizationId_endedAt_idx" ON "CareCrisisProfile"("organizationId", "endedAt");
CREATE INDEX "CareCrisisProfile_clientId_createdAt_idx" ON "CareCrisisProfile"("clientId", "createdAt");

-- Üks kehtiv hinnang kliendi kohta.
CREATE UNIQUE INDEX "CareCrisisProfile_active_key" ON "CareCrisisProfile"("clientId") WHERE "endedAt" IS NULL;

ALTER TABLE "CareCrisisProfile"
  ADD CONSTRAINT "CareCrisisProfile_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "CareClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CareCrisisProfile"
  ADD CONSTRAINT "CareCrisisProfile_level_check" CHECK ("level" IN ('DAILY', 'WEEKLY', 'SELF'));
-- Sõltuvused kindlast loendist; tühi loend on lubatud (sõltuvusi ei ole).
ALTER TABLE "CareCrisisProfile"
  ADD CONSTRAINT "CareCrisisProfile_dependencies_check"
  CHECK (
    "dependencies" IS NOT NULL
    AND "dependencies" <@ ARRAY['ELECTRICITY', 'HEATING', 'WATER', 'COMMUNICATION', 'MOBILITY', 'MEDICINE']::TEXT[]
  );
ALTER TABLE "CareCrisisProfile"
  ADD CONSTRAINT "CareCrisisProfile_text_check"
  CHECK (
    ("helper" IS NULL OR char_length(btrim("helper")) BETWEEN 1 AND 200)
    AND ("note" IS NULL OR char_length(btrim("note")) BETWEEN 1 AND 300)
  );

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE IF EXISTS "CareCrisisProfile";
