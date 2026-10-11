-- KODUTEENUS K5-k — kliendi lähedased ja jagamisaste (kava II.6.8).
--
-- Lähedased helistavad hooldajale ja hooldusjuhile; hooldaja peab teadma, kellele ja mida
-- klient on lubanud rääkida. Kokkulepe tehakse kliendiga ilma lähedaseta, iga lähedase
-- kohta eraldi:
--   aste 1: saab teada, kas käidi;
--   aste 2: ka seda, mida koos tehti;
--   aste 3: lisaks võtab hooldusjuht ühendust, kui hooldajad on märganud muutust.
-- Juures on rida „sellest ma ei taha, et räägitaks" ja päev, millal klient seda viimati
-- kinnitas: kokkulepe küsitakse üle vähemalt kord poole aasta jooksul.
--
-- Ridu ei muudeta ega kustutata: muudatus lõpetab rea ja teeb uue (`endedAt`).
-- Aditiivne: üks uus tabel, eelmine rakenduse versioon seda ei loe.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "CareClientRelative" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relation" TEXT,
    "phone" TEXT,
    "level" INTEGER NOT NULL,
    "noTell" TEXT,
    "agreedOn" TEXT NOT NULL,
    "createdByMembershipId" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endedByMembershipId" TEXT,

    CONSTRAINT "CareClientRelative_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CareClientRelative_clientId_endedAt_idx" ON "CareClientRelative"("clientId", "endedAt");
CREATE INDEX "CareClientRelative_organizationId_endedAt_idx" ON "CareClientRelative"("organizationId", "endedAt");

ALTER TABLE "CareClientRelative"
  ADD CONSTRAINT "CareClientRelative_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "CareClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CareClientRelative"
  ADD CONSTRAINT "CareClientRelative_level_check" CHECK ("level" BETWEEN 1 AND 3);
ALTER TABLE "CareClientRelative"
  ADD CONSTRAINT "CareClientRelative_text_check"
  CHECK (
    char_length(btrim("name")) BETWEEN 1 AND 120
    AND ("relation" IS NULL OR char_length(btrim("relation")) BETWEEN 1 AND 60)
    AND ("phone" IS NULL OR char_length(btrim("phone")) BETWEEN 3 AND 40)
    AND ("noTell" IS NULL OR char_length(btrim("noTell")) BETWEEN 1 AND 300)
  );
ALTER TABLE "CareClientRelative"
  ADD CONSTRAINT "CareClientRelative_agreedOn_check" CHECK ("agreedOn" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE IF EXISTS "CareClientRelative";
