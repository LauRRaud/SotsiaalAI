-- KODUTEENUS K4-a — eeltingimus enne teenuse algust (kava II.3.7 punkt 3).
--
-- Koduteenuse juhendi järgi ei saa teenust mõnikord alustada enne, kui kodus on midagi
-- korda tehtud: suurpuhastus, putukatõrje, ohtlik küttekolle või elektrisüsteem. Selle
-- korraldab omavalitsus. Siin on kirjas, mida oodatakse, kes korraldab ja mis ajaks, et
-- ootel klient ei jääks kellegi mällu.
--
-- Rida ei kustutata: eeltingimus kas täidetakse (`DONE`) või jäetakse ära (`DROPPED`).
-- Aditiivne: üks uus tabel, eelmine rakenduse versioon seda ei loe.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "CarePrecondition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "note" TEXT,
    "responsible" TEXT NOT NULL,
    "dueOn" TEXT,
    "createdByMembershipId" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "outcome" TEXT,
    "closedByMembershipId" TEXT,
    "closedByName" TEXT,

    CONSTRAINT "CarePrecondition_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CarePrecondition_organizationId_closedAt_idx" ON "CarePrecondition"("organizationId", "closedAt");
CREATE INDEX "CarePrecondition_clientId_closedAt_idx" ON "CarePrecondition"("clientId", "closedAt");

ALTER TABLE "CarePrecondition"
  ADD CONSTRAINT "CarePrecondition_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "CareClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CarePrecondition"
  ADD CONSTRAINT "CarePrecondition_kind_check"
  CHECK ("kind" IN ('CLEANING', 'PEST_CONTROL', 'HEATING', 'ELECTRICITY', 'OTHER'));
-- „Muu" vajab täpsustust; täpsustus on kuni 300 märki.
ALTER TABLE "CarePrecondition"
  ADD CONSTRAINT "CarePrecondition_note_check" CHECK (
    ("note" IS NULL AND "kind" <> 'OTHER')
    OR ("note" IS NOT NULL AND char_length(btrim("note")) BETWEEN 1 AND 300)
  );
ALTER TABLE "CarePrecondition"
  ADD CONSTRAINT "CarePrecondition_responsible_check" CHECK (char_length(btrim("responsible")) BETWEEN 1 AND 200);
-- Tähtaeg kujul AAAA-KK-PP või puudub.
ALTER TABLE "CarePrecondition"
  ADD CONSTRAINT "CarePrecondition_dueOn_check" CHECK ("dueOn" IS NULL OR "dueOn" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');
-- Lõpetatud real on tulemus, lahtisel ei ole.
ALTER TABLE "CarePrecondition"
  ADD CONSTRAINT "CarePrecondition_outcome_check" CHECK (
    ("closedAt" IS NULL AND "outcome" IS NULL)
    OR ("closedAt" IS NOT NULL AND "outcome" IS NOT NULL AND "outcome" IN ('DONE', 'DROPPED'))
  );

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE IF EXISTS "CarePrecondition";
