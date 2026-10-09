-- KODUTEENUS K4-c — kliendi sularaha hooldaja käes (kava II.6.11).
--
-- Klient annab hooldajale sularaha poeskäiguks või arve maksmiseks. Siin on kirjas, kui
-- palju hooldaja sai, kui palju kulutas ja kui palju tagastas: jääk kliendi kaupa on
-- alati näha ja üle nädala lahtine jääk jõuab hooldusjuhi ette. Kirje kaitseb hooldajat.
--
-- See on ARVESTUS, mitte makse: platvorm raha ei liiguta ega hoia kaardi andmeid. Summa
-- on sentides täisarvuna. Rida ei kustutata: ekslik rida tühistatakse (`retractedAt`).
-- Aditiivne: üks uus tabel, eelmine rakenduse versioon seda ei loe.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "CareMoneyEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "holderMembershipId" TEXT NOT NULL,
    "holderName" TEXT,
    "kind" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "note" TEXT,
    "occurredOn" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retractedAt" TIMESTAMP(3),
    "retractedByMembershipId" TEXT,
    "retractedByName" TEXT,

    CONSTRAINT "CareMoneyEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CareMoneyEntry_organizationId_holderMembershipId_idx" ON "CareMoneyEntry"("organizationId", "holderMembershipId");
CREATE INDEX "CareMoneyEntry_clientId_holderMembershipId_createdAt_idx" ON "CareMoneyEntry"("clientId", "holderMembershipId", "createdAt");

ALTER TABLE "CareMoneyEntry"
  ADD CONSTRAINT "CareMoneyEntry_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "CareClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CareMoneyEntry"
  ADD CONSTRAINT "CareMoneyEntry_kind_check" CHECK ("kind" IN ('RECEIVED', 'SPENT', 'RETURNED'));
-- Summa sentides: positiivne ja kuni 10 000 eurot ühe rea kohta.
ALTER TABLE "CareMoneyEntry"
  ADD CONSTRAINT "CareMoneyEntry_amount_check" CHECK ("amountCents" BETWEEN 1 AND 1000000);
ALTER TABLE "CareMoneyEntry"
  ADD CONSTRAINT "CareMoneyEntry_note_check" CHECK ("note" IS NULL OR char_length(btrim("note")) BETWEEN 1 AND 200);
-- Päev kujul AAAA-KK-PP.
ALTER TABLE "CareMoneyEntry"
  ADD CONSTRAINT "CareMoneyEntry_occurredOn_check" CHECK ("occurredOn" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE IF EXISTS "CareMoneyEntry";
