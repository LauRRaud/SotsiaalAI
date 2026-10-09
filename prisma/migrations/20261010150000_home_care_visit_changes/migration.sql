-- KODUTEENUS kiht 3, K3-b — ühe päeva erand käigumustris: ümbertõstmine ja ärajätmine.
--
-- Käigumuster (K3-a) ütleb, mis käigud korduvad. Päris töös haigestub hooldaja, klient
-- läheb arsti juurde või ütleb käigu ära: muster jääb samaks, aga üks päev läheb teisiti.
-- Rida on ühe korduva käigu erand ühel päeval:
--   MOVED      selle päeva käigu teeb teine töötaja ja/või teisel kellaajal;
--   CANCELLED  selle päeva käik jääb ära, põhjusega.
-- Ühel käigul on ühel päeval kõige rohkem üks erand; uus otsus asendab eelmise ja
-- tagasivõtmine kustutab rea (muutus jääb auditisse).
--
-- MOVED real on `workerMembershipId` selle päeva tegelik töötaja (NULL = sel päeval
-- määramata) ja `startMinute` uus algus (NULL = mustri aeg).
--
-- Aditiivne: üks uus tabel. Eelmine rakenduse versioon seda ei loe.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "CareVisitChange" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "workerMembershipId" TEXT,
    "startMinute" INTEGER,
    "reason" TEXT,
    "note" TEXT,
    "createdByMembershipId" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareVisitChange_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CareVisitChange_slotId_day_key" ON "CareVisitChange"("slotId", "day");
CREATE INDEX "CareVisitChange_organizationId_day_idx" ON "CareVisitChange"("organizationId", "day");
CREATE INDEX "CareVisitChange_clientId_day_idx" ON "CareVisitChange"("clientId", "day");
CREATE INDEX "CareVisitChange_workerMembershipId_day_idx" ON "CareVisitChange"("workerMembershipId", "day");

ALTER TABLE "CareVisitChange"
  ADD CONSTRAINT "CareVisitChange_slotId_fkey"
  FOREIGN KEY ("slotId") REFERENCES "CareVisitSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareVisitChange"
  ADD CONSTRAINT "CareVisitChange_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "CareClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareVisitChange"
  ADD CONSTRAINT "CareVisitChange_workerMembershipId_fkey"
  FOREIGN KEY ("workerMembershipId") REFERENCES "OrganizationMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CareVisitChange"
  ADD CONSTRAINT "CareVisitChange_day_check" CHECK ("day" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');
ALTER TABLE "CareVisitChange"
  ADD CONSTRAINT "CareVisitChange_startMinute_check" CHECK ("startMinute" IS NULL OR "startMinute" BETWEEN 0 AND 1439);
-- Liik ja selle väljad käivad koos: ärajätmisel on põhjus ja ei ole töötajat ega aega;
-- ümbertõstmisel põhjuse koodi ei ole.
ALTER TABLE "CareVisitChange"
  ADD CONSTRAINT "CareVisitChange_kind_check" CHECK (
    ("kind" = 'CANCELLED' AND "reason" IS NOT NULL
      AND "reason" IN ('CLIENT_AWAY', 'CLIENT_CANCELLED', 'WORKER_ABSENT', 'OTHER')
      AND "workerMembershipId" IS NULL AND "startMinute" IS NULL)
    OR ("kind" = 'MOVED' AND "reason" IS NULL)
  );

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE IF EXISTS "CareVisitChange";
