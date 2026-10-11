SET lock_timeout = '5s';
SET statement_timeout = '30s';

-- KODUTEENUS K1 — klient organisatsioonis, meeskond, püsikaart, päevik ja
-- avamiste jälg.
--
-- Puhtalt ADITIIVNE migratsioon: seitse uut tabelit ja kaks uut enumiväärtust.
-- Ühtegi olemasolevat tabelit, veergu, indeksit ega piirangut ei muudeta, seega
-- sobib see ka eelmise rakenduse versiooniga. `Organization`, `OrganizationUnit`
-- ja `OrganizationMembership` uued Prisma-väljad on tagasiviited, mitte veerud.
--
-- Osa 1 — enumiväärtused ja tabelid (genereeritud `prisma migrate diff`-iga).
--         Uusi enumiväärtusi selles migratsioonis EI KASUTATA (ei DEFAULT-is,
--         CHECK-is ega INSERT-is): Postgres ei luba värskelt lisatud väärtust
--         samas tehingus kasutada.
-- Osa 2 — osaline unikaalindeks, CHECK-id ja muutumatuse triggerid, mida Prisma
--         skeemikeel ei väljenda.
-- Osa 3 — rollback kommentaarina.

-- ===========================================================================
-- OSA 1 — enumiväärtused ja tabelid
-- ===========================================================================

-- AlterEnum
ALTER TYPE "OrganizationModuleKey" ADD VALUE IF NOT EXISTS 'HOME_CARE';

-- AlterEnum
ALTER TYPE "OrganizationCapability" ADD VALUE IF NOT EXISTS 'HOME_CARE_COORDINATOR';

-- CreateTable
CREATE TABLE "CareClient" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "unitId" TEXT,
    "displayName" TEXT NOT NULL,
    "internalCode" TEXT,
    "address" TEXT,
    "contactPhone" TEXT,
    "contactNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "statusNote" TEXT,
    "statusChangedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "clientErasedAt" TIMESTAMP(3),
    "createdByMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareClientTeamMember" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "addedByMembershipId" TEXT,
    "endedByMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareClientTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareClientCardLine" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "addedByMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endedByMembershipId" TEXT,

    CONSTRAINT "CareClientCardLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareClientEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "authorMembershipId" TEXT,
    "authorName" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "contactMode" TEXT NOT NULL DEFAULT 'VISIT',
    "text" TEXT NOT NULL,
    "coordinatorOnly" BOOLEAN NOT NULL DEFAULT false,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "deviceCreatedAt" TIMESTAMP(3),
    "companionMembershipId" TEXT,
    "companionName" TEXT,
    "incidentType" TEXT,
    "incidentAssessment" TEXT,
    "incidentActions" JSONB,
    "incidentStatus" TEXT,
    "incidentAssigneeMembershipId" TEXT,
    "incidentResolvedAt" TIMESTAMP(3),
    "incidentResolvedByMembershipId" TEXT,
    "incidentResolutionNote" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "retractedAt" TIMESTAMP(3),
    "clientRequestId" TEXT,
    "requestSha256" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareClientEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareClientEntryRevision" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "entryKind" TEXT NOT NULL,
    "contactMode" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "snapshot" JSONB,
    "revision" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "actorMembershipId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareClientEntryRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareClientEntryRead" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareClientEntryRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareClientAccess" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "basis" TEXT NOT NULL,
    "reasonCode" TEXT,
    "reason" TEXT,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareClientAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CareClient_organizationId_status_displayName_idx" ON "CareClient"("organizationId", "status", "displayName");

-- CreateIndex
CREATE INDEX "CareClient_unitId_idx" ON "CareClient"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "CareClient_organizationId_internalCode_key" ON "CareClient"("organizationId", "internalCode");

-- CreateIndex
CREATE INDEX "CareClientTeamMember_clientId_endedAt_idx" ON "CareClientTeamMember"("clientId", "endedAt");

-- CreateIndex
CREATE INDEX "CareClientTeamMember_membershipId_endedAt_idx" ON "CareClientTeamMember"("membershipId", "endedAt");

-- CreateIndex
CREATE INDEX "CareClientCardLine_clientId_endedAt_position_idx" ON "CareClientCardLine"("clientId", "endedAt", "position");

-- CreateIndex
CREATE INDEX "CareClientEntry_clientId_occurredAt_idx" ON "CareClientEntry"("clientId", "occurredAt");

-- CreateIndex
CREATE INDEX "CareClientEntry_clientId_kind_occurredAt_idx" ON "CareClientEntry"("clientId", "kind", "occurredAt");

-- CreateIndex
CREATE INDEX "CareClientEntry_organizationId_createdAt_idx" ON "CareClientEntry"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "CareClientEntry_organizationId_kind_incidentStatus_idx" ON "CareClientEntry"("organizationId", "kind", "incidentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "CareClientEntry_authorMembershipId_clientRequestId_key" ON "CareClientEntry"("authorMembershipId", "clientRequestId");

-- CreateIndex
CREATE INDEX "CareClientEntryRevision_entryId_revision_idx" ON "CareClientEntryRevision"("entryId", "revision");

-- CreateIndex
CREATE INDEX "CareClientEntryRevision_clientId_createdAt_idx" ON "CareClientEntryRevision"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "CareClientEntryRead_membershipId_readAt_idx" ON "CareClientEntryRead"("membershipId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "CareClientEntryRead_entryId_membershipId_key" ON "CareClientEntryRead"("entryId", "membershipId");

-- CreateIndex
CREATE INDEX "CareClientAccess_clientId_createdAt_idx" ON "CareClientAccess"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "CareClientAccess_organizationId_createdAt_idx" ON "CareClientAccess"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "CareClientAccess_clientId_membershipId_createdAt_idx" ON "CareClientAccess"("clientId", "membershipId", "createdAt");

-- AddForeignKey
ALTER TABLE "CareClient" ADD CONSTRAINT "CareClient_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareClient" ADD CONSTRAINT "CareClient_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "OrganizationUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareClientTeamMember" ADD CONSTRAINT "CareClientTeamMember_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "CareClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareClientTeamMember" ADD CONSTRAINT "CareClientTeamMember_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "OrganizationMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareClientCardLine" ADD CONSTRAINT "CareClientCardLine_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "CareClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareClientEntry" ADD CONSTRAINT "CareClientEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareClientEntry" ADD CONSTRAINT "CareClientEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "CareClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareClientEntry" ADD CONSTRAINT "CareClientEntry_authorMembershipId_fkey" FOREIGN KEY ("authorMembershipId") REFERENCES "OrganizationMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareClientEntry" ADD CONSTRAINT "CareClientEntry_companionMembershipId_fkey" FOREIGN KEY ("companionMembershipId") REFERENCES "OrganizationMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareClientEntryRevision" ADD CONSTRAINT "CareClientEntryRevision_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "CareClientEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareClientEntryRead" ADD CONSTRAINT "CareClientEntryRead_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "CareClientEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareClientAccess" ADD CONSTRAINT "CareClientAccess_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "CareClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===========================================================================
-- OSA 2 — invariandid, mida skeemikeel ei väljenda
-- ===========================================================================

-- Üks AKTIIVNE meeskonnarida kliendi ja liikmesuse kohta. Lõpetatud read
-- jäävad ajalukku ega blokeeri sama inimese uuesti lisamist.
CREATE UNIQUE INDEX "CareClientTeamMember_active_pair_uniq"
  ON "CareClientTeamMember"("clientId", "membershipId")
  WHERE "endedAt" IS NULL;

-- Versioon algab ühest ja ei lähe tagasi.
ALTER TABLE "CareClient"
  ADD CONSTRAINT "CareClient_version_positive" CHECK ("version" >= 1);

ALTER TABLE "CareClientEntry"
  ADD CONSTRAINT "CareClientEntry_revision_positive" CHECK ("revision" >= 1);

-- PÕHJUS EI TOHI OLLA TÜHI: parandus ilma põhjuseta on parandus ilma jäljeta.
ALTER TABLE "CareClientEntryRevision"
  ADD CONSTRAINT "CareClientEntryRevision_reason_not_blank" CHECK (btrim("reason") <> '');

ALTER TABLE "CareClientEntryRevision"
  ADD CONSTRAINT "CareClientEntryRevision_revision_positive" CHECK ("revision" >= 1);

-- Põhjusega avamisel peab põhjuse kood olemas olema ja kehtivusaeg kuulub
-- ainult põhjusega avamise juurde.
ALTER TABLE "CareClientAccess"
  ADD CONSTRAINT "CareClientAccess_reason_has_code" CHECK ("basis" <> 'REASON' OR "reasonCode" IS NOT NULL);

ALTER TABLE "CareClientAccess"
  ADD CONSTRAINT "CareClientAccess_valid_until_only_reason" CHECK ("validUntil" IS NULL OR "basis" = 'REASON');

-- MUUTUMATUS ON ANDMEBAASI OMA, mitte teenuskihi lubadus (sama muster mis
-- `CaseWorkMeetingNoteEntryRevision`-il). Paranduse jälge ja avamise logi ei
-- saa muuta; kustuda saavad nad ainult koos kliendiga (kaskaad). Seepärast ei
-- ole neil tabelitel ühtegi SET NULL võõrvõtit: see oleks samuti muutmine.
CREATE FUNCTION "prevent_care_client_log_update"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% rows are immutable; append a new row instead', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "CareClientEntryRevision_prevent_update"
  BEFORE UPDATE ON "CareClientEntryRevision"
  FOR EACH ROW EXECUTE FUNCTION "prevent_care_client_log_update"();

CREATE TRIGGER "CareClientAccess_prevent_update"
  BEFORE UPDATE ON "CareClientAccess"
  FOR EACH ROW EXECUTE FUNCTION "prevent_care_client_log_update"();

-- ===========================================================================
-- OSA 3 — rollback (kommentaarina; migratsioon on aditiivne)
-- ===========================================================================
--
--   DROP TABLE IF EXISTS "CareClientAccess"        CASCADE;
--   DROP TABLE IF EXISTS "CareClientEntryRead"     CASCADE;
--   DROP TABLE IF EXISTS "CareClientEntryRevision" CASCADE;
--   DROP TABLE IF EXISTS "CareClientEntry"         CASCADE;
--   DROP TABLE IF EXISTS "CareClientCardLine"      CASCADE;
--   DROP TABLE IF EXISTS "CareClientTeamMember"    CASCADE;
--   DROP TABLE IF EXISTS "CareClient"              CASCADE;
--   DROP FUNCTION IF EXISTS "prevent_care_client_log_update"();
--
-- Enumiväärtusi `HOME_CARE` ja `HOME_CARE_COORDINATOR` Postgres eemaldada ei
-- lase; kasutamata väärtus ei mõjuta midagi.
