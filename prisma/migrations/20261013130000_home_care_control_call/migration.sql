-- KODUTEENUS K6-l — hooldusjuhi kontrollkõne kliendile (kava II.6.9).
--
-- Koduteenuse saaja ei kinnita iga käiku allkirjaga. Selle asemel saab ta kuulehe ja kord
-- kvartalis helistab hooldusjuht talle ise, MITTE hooldaja kaudu, ja küsib, kas käigud on
-- toimunud nii, nagu kirjas. Siin on selle kõne kirje: mis päeval, kellega räägiti ja mis
-- selgus (klapib, ei klapi, ei saanud kätte).
--
-- Kirjet näeb ainult hooldusjuht: see on kontroll hooldaja töö üle. Rida ei kustutata:
-- ekslik kirje tühistatakse. Aditiivne: üks uus tabel, eelmine rakenduse versioon seda ei loe.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "CareControlCall" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "calledOn" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "spokeWith" TEXT,
    "note" TEXT,
    "createdByMembershipId" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retractedAt" TIMESTAMP(3),
    "retractedByMembershipId" TEXT,
    "retractedByName" TEXT,

    CONSTRAINT "CareControlCall_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CareControlCall_organizationId_calledOn_idx" ON "CareControlCall"("organizationId", "calledOn");
CREATE INDEX "CareControlCall_clientId_calledOn_idx" ON "CareControlCall"("clientId", "calledOn");

ALTER TABLE "CareControlCall"
  ADD CONSTRAINT "CareControlCall_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "CareClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CareControlCall"
  ADD CONSTRAINT "CareControlCall_calledOn_check" CHECK ("calledOn" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');
ALTER TABLE "CareControlCall"
  ADD CONSTRAINT "CareControlCall_outcome_check" CHECK ("outcome" IN ('MATCHES', 'DIFFERS', 'NOT_REACHED'));
-- Kellega räägiti, on kirjas siis ja ainult siis, kui kedagi kätte saadi.
ALTER TABLE "CareControlCall"
  ADD CONSTRAINT "CareControlCall_spokeWith_check" CHECK (
    ("outcome" = 'NOT_REACHED' AND "spokeWith" IS NULL)
    OR ("outcome" <> 'NOT_REACHED' AND "spokeWith" IS NOT NULL AND "spokeWith" IN ('CLIENT', 'RELATIVE', 'REPRESENTATIVE'))
  );
-- Kui jutt ei klapi kirjapanduga, peab olema kirjas, mis ei klappinud; märkus kuni 500 märki.
ALTER TABLE "CareControlCall"
  ADD CONSTRAINT "CareControlCall_note_check" CHECK (
    ("note" IS NULL AND "outcome" <> 'DIFFERS')
    OR ("note" IS NOT NULL AND char_length(btrim("note")) BETWEEN 1 AND 500)
  );

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE IF EXISTS "CareControlCall";
