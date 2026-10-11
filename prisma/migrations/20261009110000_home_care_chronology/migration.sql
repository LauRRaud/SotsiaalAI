-- KODUTEENUS K1-d — kliendi kronoloogia väljastus ja väljastuste tööloend.
--
-- Aditiivne: kaks uut tabelit. Olemasolevaid tabeleid ei muudeta; eelmine
-- rakenduse versioon neid tabeleid ei loe.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

-- ===========================================================================
-- OSA 1 — skeem
-- ===========================================================================

CREATE TABLE "CareChronologyRelease" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "periodFromDay" TEXT NOT NULL,
    "periodToDay" TEXT NOT NULL,
    "requester" TEXT NOT NULL,
    "basis" TEXT NOT NULL,
    "registryRef" TEXT,
    "summary" TEXT,
    "entryCount" INTEGER NOT NULL,
    "contentSha256" TEXT NOT NULL,
    "createdByMembershipId" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "clientRequestId" TEXT,
    "requestHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareChronologyRelease_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CareChronologyReleaseItem" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "entryId" TEXT NOT NULL,
    "entryRevision" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "authorName" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "contactMode" TEXT NOT NULL,
    "incidentType" TEXT,
    "text" TEXT NOT NULL,
    "redacted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CareChronologyReleaseItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CareChronologyRelease_createdByMembershipId_clientRequestId_key" ON "CareChronologyRelease"("createdByMembershipId", "clientRequestId");

CREATE INDEX "CareChronologyRelease_organizationId_createdAt_idx" ON "CareChronologyRelease"("organizationId", "createdAt");

CREATE INDEX "CareChronologyRelease_clientId_createdAt_idx" ON "CareChronologyRelease"("clientId", "createdAt");

CREATE INDEX "CareChronologyReleaseItem_entryId_idx" ON "CareChronologyReleaseItem"("entryId");

CREATE UNIQUE INDEX "CareChronologyReleaseItem_releaseId_position_key" ON "CareChronologyReleaseItem"("releaseId", "position");

ALTER TABLE "CareChronologyRelease" ADD CONSTRAINT "CareChronologyRelease_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "CareClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CareChronologyReleaseItem" ADD CONSTRAINT "CareChronologyReleaseItem_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "CareChronologyRelease"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ===========================================================================
-- OSA 2 — reeglid, mida Prisma skeem ei väljenda
-- ===========================================================================

-- Väljastusel peab olema, kes küsis ja mis alusel, ning vähemalt üks kirje.
ALTER TABLE "CareChronologyRelease"
  ADD CONSTRAINT "CareChronologyRelease_requester_not_blank" CHECK (length(btrim("requester")) > 0);

ALTER TABLE "CareChronologyRelease"
  ADD CONSTRAINT "CareChronologyRelease_basis_not_blank" CHECK (length(btrim("basis")) > 0);

ALTER TABLE "CareChronologyRelease"
  ADD CONSTRAINT "CareChronologyRelease_entry_count_positive" CHECK ("entryCount" >= 1);

-- Väljastatud dokument on muutmatu (sama funktsioon mis parandusjäljel,
-- loodud migratsioonis 20261009040000_home_care_k1). Kustuda saab ainult koos
-- kliendiga (kaskaad).
CREATE TRIGGER "CareChronologyRelease_prevent_update"
  BEFORE UPDATE ON "CareChronologyRelease"
  FOR EACH ROW EXECUTE FUNCTION "prevent_care_client_log_update"();

CREATE TRIGGER "CareChronologyReleaseItem_prevent_update"
  BEFORE UPDATE ON "CareChronologyReleaseItem"
  FOR EACH ROW EXECUTE FUNCTION "prevent_care_client_log_update"();

-- ===========================================================================
-- OSA 3 — rollback (kommentaarina; migratsioon on aditiivne)
-- ===========================================================================
--
--   DROP TABLE IF EXISTS "CareChronologyReleaseItem" CASCADE;
--   DROP TABLE IF EXISTS "CareChronologyRelease"     CASCADE;
