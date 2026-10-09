-- KODUTEENUS K1-b — erijuhtumi käik (täiendused, seisumuutused, vastutaja).
--
-- Aditiivne: üks uus tabel ja üks uus veerg eelmise migratsiooni tabelis
-- `CareClientEntry` (nullitav, vaikeväärtuseta; tabel on uus ja lipu taga).
-- Eelmine rakenduse versioon neid ei loe.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

-- ===========================================================================
-- OSA 1 — skeem
-- ===========================================================================

ALTER TABLE "CareClientEntry" ADD COLUMN "incidentAssigneeName" TEXT;

CREATE TABLE "CareIncidentUpdate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "assigneeMembershipId" TEXT,
    "assigneeName" TEXT,
    "actorMembershipId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "byCoordinator" BOOLEAN NOT NULL DEFAULT false,
    "clientRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareIncidentUpdate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CareIncidentUpdate_actorMembershipId_clientRequestId_key" ON "CareIncidentUpdate"("actorMembershipId", "clientRequestId");

CREATE INDEX "CareIncidentUpdate_entryId_createdAt_idx" ON "CareIncidentUpdate"("entryId", "createdAt");

CREATE INDEX "CareIncidentUpdate_organizationId_createdAt_idx" ON "CareIncidentUpdate"("organizationId", "createdAt");

CREATE INDEX "CareIncidentUpdate_clientId_idx" ON "CareIncidentUpdate"("clientId");

ALTER TABLE "CareIncidentUpdate" ADD CONSTRAINT "CareIncidentUpdate_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "CareClientEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CareIncidentUpdate" ADD CONSTRAINT "CareIncidentUpdate_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "CareClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===========================================================================
-- OSA 2 — reeglid, mida Prisma skeem ei väljenda
-- ===========================================================================

-- Täiendus ilma tekstita ei ole täiendus; seisumuutusel peab olema uus seis.
ALTER TABLE "CareIncidentUpdate"
  ADD CONSTRAINT "CareIncidentUpdate_note_has_text" CHECK ("kind" <> 'NOTE' OR length(btrim(coalesce("text", ''))) > 0);

ALTER TABLE "CareIncidentUpdate"
  ADD CONSTRAINT "CareIncidentUpdate_status_has_target" CHECK ("kind" <> 'STATUS' OR "toStatus" IS NOT NULL);

-- Käik on muutmatu nagu parandusjälg ja avamislogi (sama funktsioon, loodud
-- migratsioonis 20261009040000_home_care_k1).
CREATE TRIGGER "CareIncidentUpdate_prevent_update"
  BEFORE UPDATE ON "CareIncidentUpdate"
  FOR EACH ROW EXECUTE FUNCTION "prevent_care_client_log_update"();

-- ===========================================================================
-- OSA 3 — rollback (kommentaarina; migratsioon on aditiivne)
-- ===========================================================================
--
--   DROP TABLE IF EXISTS "CareIncidentUpdate" CASCADE;
--   ALTER TABLE "CareClientEntry" DROP COLUMN IF EXISTS "incidentAssigneeName";
