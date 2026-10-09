-- KODUTEENUS kiht 3, K3-a — käigumuster: kliendi korduvad käigud nädalas.
--
-- Seni ei olnud koduteenuse kliendi juures kirjas, mis päevadel ja kellaaegadel tema
-- juures käiakse ja kes läheb. Hooldaja ei näinud oma tänast päeva ühest kohast ja
-- hooldusjuht ei näinud, mis käigud on kellelegi määramata.
--
-- Rida on üks korduv käik: nädalapäev, algusaeg (minutid südaööst asutuse aja järgi),
-- plaanitud kestus ja töötaja. Muster kehtib päevast päevani (tekst AAAA-KK-PP, tühi
-- lõpp = kehtib edasi). Muudatus „alates tänasest" lõpetab vana rea eilse päevaga ja
-- loob uue: nii jääb alles, mis varem plaanis oli, ja möödunud päevade pilt ei muutu.
--
-- Töötaja viide on liikmesusele; liikmesuse kadumisel jääb käik määramata, mitte ei kao.
--
-- Aditiivne: üks uus tabel. Eelmine rakenduse versioon seda ei loe.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "CareVisitSlot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "plannedMinutes" INTEGER NOT NULL,
    "workerMembershipId" TEXT,
    "note" TEXT,
    "validFrom" TEXT NOT NULL,
    "validUntil" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareVisitSlot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CareVisitSlot_clientId_weekday_startMinute_idx" ON "CareVisitSlot"("clientId", "weekday", "startMinute");
CREATE INDEX "CareVisitSlot_organizationId_weekday_idx" ON "CareVisitSlot"("organizationId", "weekday");
CREATE INDEX "CareVisitSlot_workerMembershipId_weekday_idx" ON "CareVisitSlot"("workerMembershipId", "weekday");

ALTER TABLE "CareVisitSlot"
  ADD CONSTRAINT "CareVisitSlot_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "CareClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareVisitSlot"
  ADD CONSTRAINT "CareVisitSlot_workerMembershipId_fkey"
  FOREIGN KEY ("workerMembershipId") REFERENCES "OrganizationMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Nädalapäev 1 (esmaspäev) kuni 7 (pühapäev); algus ühe ööpäeva sees; kestus 5 minutit kuni 12 tundi.
ALTER TABLE "CareVisitSlot"
  ADD CONSTRAINT "CareVisitSlot_weekday_check" CHECK ("weekday" BETWEEN 1 AND 7);
ALTER TABLE "CareVisitSlot"
  ADD CONSTRAINT "CareVisitSlot_startMinute_check" CHECK ("startMinute" BETWEEN 0 AND 1439);
ALTER TABLE "CareVisitSlot"
  ADD CONSTRAINT "CareVisitSlot_plannedMinutes_check" CHECK ("plannedMinutes" BETWEEN 5 AND 720);
-- Päevad kujul AAAA-KK-PP; lõpp ei ole enne algust.
ALTER TABLE "CareVisitSlot"
  ADD CONSTRAINT "CareVisitSlot_days_check" CHECK (
    "validFrom" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    AND ("validUntil" IS NULL OR ("validUntil" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND "validUntil" >= "validFrom"))
  );

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE IF EXISTS "CareVisitSlot";
