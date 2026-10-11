-- KODUTEENUS K5-v — „võõras ukse taga" (kava II.6.8).
--
-- Kui kliendi juurde läheb töötaja, kes ei ole seal varem käinud, paneb hooldusjuht kirja,
-- kuidas kliendile sellest teatati: helistati, püsihooldaja ütles eelmisel käigul või ei
-- jõutud. Töötaja näeb seda oma päevas.
--
-- Ridu ei muudeta ega kustutata: uus märge lõpetab eelmise (`endedAt`).
-- Aditiivne: üks uus tabel, eelmine rakenduse versioon seda ei loe.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "CareFirstVisitNotice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "workerMembershipId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "createdByMembershipId" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endedByMembershipId" TEXT,

    CONSTRAINT "CareFirstVisitNotice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CareFirstVisitNotice_clientId_day_idx" ON "CareFirstVisitNotice"("clientId", "day");
CREATE INDEX "CareFirstVisitNotice_organizationId_day_endedAt_idx" ON "CareFirstVisitNotice"("organizationId", "day", "endedAt");

-- Üks kehtiv märge kliendi, töötaja ja päeva kohta.
CREATE UNIQUE INDEX "CareFirstVisitNotice_active_key" ON "CareFirstVisitNotice"("clientId", "workerMembershipId", "day") WHERE "endedAt" IS NULL;

ALTER TABLE "CareFirstVisitNotice"
  ADD CONSTRAINT "CareFirstVisitNotice_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "CareClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CareFirstVisitNotice"
  ADD CONSTRAINT "CareFirstVisitNotice_outcome_check" CHECK ("outcome" IN ('CALLED', 'TOLD_BY_REGULAR', 'NOT_REACHED'));
ALTER TABLE "CareFirstVisitNotice"
  ADD CONSTRAINT "CareFirstVisitNotice_day_check" CHECK ("day" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE IF EXISTS "CareFirstVisitNotice";
