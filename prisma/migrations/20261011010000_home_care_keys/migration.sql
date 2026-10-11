-- KODUTEENUS K4-b — võtmeraamat (kava II.6.11).
--
-- Kliendi kodu võtmel on numbriripats ilma nime ja aadressita; seos kliendiga on ainult
-- rakenduses. Siin on kirjas, mis võtmed asutuse käes on, kelle käes iga võti praegu on
-- ja kes selle kellele üle andis. Nii näeb hooldusjuht enne asenduse määramist, kas
-- asendajal on võti, ja teenuse lõpus, mis võtmed on tagastamata.
--
-- Võtit ei kustutata: see kas tagastatakse kliendile (`RETURNED`) või märgitakse kadunuks
-- (`LOST`). Aditiivne: kaks uut tabelit, eelmine rakenduse versioon neid ei loe.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "CareKey" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "label" TEXT,
    "holderMembershipId" TEXT,
    "holderName" TEXT,
    "heldSince" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByMembershipId" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "outcome" TEXT,
    "closedByMembershipId" TEXT,
    "closedByName" TEXT,

    CONSTRAINT "CareKey_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CareKey_organizationId_closedAt_idx" ON "CareKey"("organizationId", "closedAt");
CREATE INDEX "CareKey_clientId_closedAt_idx" ON "CareKey"("clientId", "closedAt");
CREATE INDEX "CareKey_holderMembershipId_closedAt_idx" ON "CareKey"("holderMembershipId", "closedAt");

-- Ripatsi number on asutuse käes olevate võtmete seas kordumatu (suur- ja väiketähti eristamata).
CREATE UNIQUE INDEX "CareKey_tag_key" ON "CareKey"("organizationId", lower("tag")) WHERE "closedAt" IS NULL;

ALTER TABLE "CareKey"
  ADD CONSTRAINT "CareKey_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "CareClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CareKey"
  ADD CONSTRAINT "CareKey_tag_check" CHECK (char_length(btrim("tag")) BETWEEN 1 AND 20);
ALTER TABLE "CareKey"
  ADD CONSTRAINT "CareKey_label_check" CHECK ("label" IS NULL OR char_length(btrim("label")) BETWEEN 1 AND 100);
-- Asutuse käes oleval võtmel ei ole tulemust; ära antud võtmel on.
ALTER TABLE "CareKey"
  ADD CONSTRAINT "CareKey_outcome_check" CHECK (
    ("closedAt" IS NULL AND "outcome" IS NULL)
    OR ("closedAt" IS NOT NULL AND "outcome" IS NOT NULL AND "outcome" IN ('RETURNED', 'LOST'))
  );

CREATE TABLE "CareKeyHandover" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "fromMembershipId" TEXT,
    "fromName" TEXT,
    "toMembershipId" TEXT,
    "toName" TEXT,
    "recordedByMembershipId" TEXT,
    "recordedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareKeyHandover_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CareKeyHandover_keyId_createdAt_idx" ON "CareKeyHandover"("keyId", "createdAt");
CREATE INDEX "CareKeyHandover_organizationId_idx" ON "CareKeyHandover"("organizationId");

ALTER TABLE "CareKeyHandover"
  ADD CONSTRAINT "CareKeyHandover_keyId_fkey"
  FOREIGN KEY ("keyId") REFERENCES "CareKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE IF EXISTS "CareKeyHandover";
--   DROP TABLE IF EXISTS "CareKey";
