-- KODUTEENUS K5-n — ohutuskaart: kodu kui töökoht (kava II.6.4).
--
-- Hooldaja töötab üksi võõras kodus. Püsikaardi vaba tekstiga ohuread sõltuvad sellest,
-- mis kellelgi meelde tuli; ohutuskaart KÜSIB kümme asja üle: loomad, suitsetamine toas,
-- küte ja tuleoht, ligipääs talvel, tõstmine, teised inimesed kodus, varasem agressiivsus,
-- kaitsevahendid, ainult kahekesi, levi. Iga rea vastus on jah või ei ja soovi korral
-- lühike faktipõhine märkus.
--
-- Ridu ei muudeta ega kustutata: uus vastus lõpetab eelmise (`endedAt`).
-- Aditiivne: üks uus tabel, eelmine rakenduse versioon seda ei loe.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "CareSafetyItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "note" TEXT,
    "createdByMembershipId" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endedByMembershipId" TEXT,

    CONSTRAINT "CareSafetyItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CareSafetyItem_clientId_endedAt_idx" ON "CareSafetyItem"("clientId", "endedAt");
CREATE INDEX "CareSafetyItem_organizationId_endedAt_idx" ON "CareSafetyItem"("organizationId", "endedAt");

-- Üks kehtiv vastus kliendi ja teema kohta.
CREATE UNIQUE INDEX "CareSafetyItem_active_key" ON "CareSafetyItem"("clientId", "topic") WHERE "endedAt" IS NULL;

ALTER TABLE "CareSafetyItem"
  ADD CONSTRAINT "CareSafetyItem_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "CareClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CareSafetyItem"
  ADD CONSTRAINT "CareSafetyItem_topic_check"
  CHECK ("topic" IN ('ANIMALS', 'SMOKING', 'FIRE', 'WINTER_ACCESS', 'LIFTING', 'OTHER_PEOPLE', 'AGGRESSION', 'PROTECTIVE_GEAR', 'PAIR_ONLY', 'NO_SIGNAL'));
ALTER TABLE "CareSafetyItem"
  ADD CONSTRAINT "CareSafetyItem_answer_check" CHECK ("answer" IN ('YES', 'NO'));
ALTER TABLE "CareSafetyItem"
  ADD CONSTRAINT "CareSafetyItem_note_check" CHECK ("note" IS NULL OR char_length(btrim("note")) BETWEEN 1 AND 200);

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE IF EXISTS "CareSafetyItem";
