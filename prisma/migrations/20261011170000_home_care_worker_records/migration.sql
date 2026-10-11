-- KODUTEENUS K5-e — töötaja kaart (kava II.6.10, juhendi ptk 3).
--
-- Sotsiaalkindlustusameti juhend ootab koduteenuse osutajalt, et töötaja taust on
-- kontrollitud ja väljaõpe olemas. Hooldusjuht peab seda praegu meeles või tabelis.
-- Siin on töötaja kohta kaks liiki ridu: taustakontroll (ainult kuupäev, tulemust ega
-- sisu ei hoita) ja koolitus (teema, kuupäev, soovi korral kehtivuse lõpp).
--
-- Ridu ei muudeta ega kustutata: eemaldatud rida saab lõpu (`endedAt`).
-- Aditiivne: üks uus tabel, eelmine rakenduse versioon seda ei loe.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "CareWorkerRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT,
    "doneOn" TEXT NOT NULL,
    "validUntil" TEXT,
    "createdByMembershipId" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endedByMembershipId" TEXT,

    CONSTRAINT "CareWorkerRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CareWorkerRecord_organizationId_endedAt_idx" ON "CareWorkerRecord"("organizationId", "endedAt");
CREATE INDEX "CareWorkerRecord_membershipId_endedAt_idx" ON "CareWorkerRecord"("membershipId", "endedAt");

ALTER TABLE "CareWorkerRecord"
  ADD CONSTRAINT "CareWorkerRecord_membershipId_fkey"
  FOREIGN KEY ("membershipId") REFERENCES "OrganizationMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CareWorkerRecord"
  ADD CONSTRAINT "CareWorkerRecord_kind_check" CHECK ("kind" IN ('BACKGROUND_CHECK', 'TRAINING'));
-- Koolitusel on teema; taustakontrollil vaba teksti ei ole (tulemust ega sisu ei hoita).
ALTER TABLE "CareWorkerRecord"
  ADD CONSTRAINT "CareWorkerRecord_title_check"
  CHECK (
    ("kind" = 'TRAINING' AND "title" IS NOT NULL AND char_length(btrim("title")) BETWEEN 1 AND 120)
    OR ("kind" = 'BACKGROUND_CHECK' AND "title" IS NULL)
  );
-- Päevad kujul AAAA-KK-PP; kehtivus ei lõpe enne tegemise päeva.
ALTER TABLE "CareWorkerRecord"
  ADD CONSTRAINT "CareWorkerRecord_days_check"
  CHECK (
    "doneOn" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    AND ("validUntil" IS NULL OR ("validUntil" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND "validUntil" >= "doneOn"))
  );

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE IF EXISTS "CareWorkerRecord";
