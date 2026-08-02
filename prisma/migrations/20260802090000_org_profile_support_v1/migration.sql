-- T25 ORG-PROFILE-SUPPORT-V1 (viil C)
--
-- AINUS VIIL, MILLE MIGRATSIOON PUUDUTAB OLEMASOLEVAT TABELIT DESTRUKTIIVSELT.
-- Puudutatav on `ServiceProviderProfile` ja täpselt kolm asja (E0 leid L4):
--
--   1. `@@unique([ownerId])` -> osaline unikaalindeks (ainult SOLO-režiimis);
--   2. `owner` FK `ON DELETE CASCADE` -> `SET NULL`;
--   3. `ownerId` NOT NULL -> nullable.
--
-- MIDA SEE EI TEE: ei kustuta ühtegi rida, ei muuda ühegi olemasoleva profiili
-- sisu ega omanikku. `ownershipMode` saab vaikeväärtuse 'SOLO', seega KÕIK
-- olemasolevad profiilid jäävad täpselt sellisteks, nagu nad on.
--
-- MIKS PUNKT 2 ON VAJALIK: enne seda hävitas töötaja konto kustutamine
-- teenuseprofiili (Cascade). Arenduskava §5.9 nõuab otsesõnu vastupidist —
-- „konto kustutamine ei hävita org-profiili".
--
-- ROLLBACK-VÄRAV on osas 3: Cascade tagasi panemine on OHUTU AINULT SIIS, kui
-- ORGANIZATION-režiimi profiile ei ole tekkinud.

-- CreateEnum
CREATE TYPE "OrganizationSupportContactType" AS ENUM ('DIRECT_MANAGER', 'ALTERNATE_SUPPORT', 'SAFETY_CONTACT');

-- CreateEnum
CREATE TYPE "WellbeingSupportShareStatus" AS ENUM ('SENT', 'OPENED', 'RECALLED', 'CORRECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ServiceProviderOwnershipMode" AS ENUM ('SOLO', 'ORGANIZATION');

-- DropForeignKey
ALTER TABLE "ServiceProviderProfile" DROP CONSTRAINT "ServiceProviderProfile_ownerId_fkey";

-- DropIndex
DROP INDEX "ServiceProviderProfile_ownerId_key";

-- AlterTable
ALTER TABLE "ServiceProviderProfile" ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "ownershipMode" "ServiceProviderOwnershipMode" NOT NULL DEFAULT 'SOLO',
ALTER COLUMN "ownerId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "OrganizationReportingLine" (
    "id" TEXT NOT NULL,
    "memberMembershipId" TEXT NOT NULL,
    "managerMembershipId" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationReportingLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationSupportContact" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "unitId" TEXT,
    "membershipId" TEXT NOT NULL,
    "contactType" "OrganizationSupportContactType" NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationSupportContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WellbeingSupportShare" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "recipientMembershipId" TEXT NOT NULL,
    "supportContactId" TEXT,
    "sourceDraftId" TEXT,
    "sourceRecordId" TEXT,
    "sharedSnapshotJson" JSONB NOT NULL,
    "snapshotSchemaVersion" TEXT NOT NULL DEFAULT '1.0',
    "status" "WellbeingSupportShareStatus" NOT NULL DEFAULT 'SENT',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" TIMESTAMP(3),
    "recalledAt" TIMESTAMP(3),
    "correctedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "supersedesShareId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WellbeingSupportShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizationReportingLine_memberMembershipId_validUntil_idx" ON "OrganizationReportingLine"("memberMembershipId", "validUntil");

-- CreateIndex
CREATE INDEX "OrganizationReportingLine_managerMembershipId_validUntil_idx" ON "OrganizationReportingLine"("managerMembershipId", "validUntil");

-- CreateIndex
CREATE INDEX "OrganizationSupportContact_organizationId_contactType_valid_idx" ON "OrganizationSupportContact"("organizationId", "contactType", "validUntil");

-- CreateIndex
CREATE INDEX "OrganizationSupportContact_unitId_validUntil_idx" ON "OrganizationSupportContact"("unitId", "validUntil");

-- CreateIndex
CREATE INDEX "OrganizationSupportContact_membershipId_validUntil_idx" ON "OrganizationSupportContact"("membershipId", "validUntil");

-- CreateIndex
CREATE UNIQUE INDEX "WellbeingSupportShare_supersedesShareId_key" ON "WellbeingSupportShare"("supersedesShareId");

-- CreateIndex
CREATE INDEX "WellbeingSupportShare_ownerUserId_sentAt_idx" ON "WellbeingSupportShare"("ownerUserId", "sentAt");

-- CreateIndex
CREATE INDEX "WellbeingSupportShare_recipientMembershipId_status_sentAt_idx" ON "WellbeingSupportShare"("recipientMembershipId", "status", "sentAt");

-- CreateIndex
CREATE INDEX "WellbeingSupportShare_organizationId_status_idx" ON "WellbeingSupportShare"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceProviderProfile_organizationId_key" ON "ServiceProviderProfile"("organizationId");

-- CreateIndex
CREATE INDEX "ServiceProviderProfile_ownershipMode_status_idx" ON "ServiceProviderProfile"("ownershipMode", "status");

-- CreateIndex
CREATE INDEX "ServiceProviderProfile_organizationId_idx" ON "ServiceProviderProfile"("organizationId");

-- AddForeignKey
ALTER TABLE "ServiceProviderProfile" ADD CONSTRAINT "ServiceProviderProfile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceProviderProfile" ADD CONSTRAINT "ServiceProviderProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationReportingLine" ADD CONSTRAINT "OrganizationReportingLine_memberMembershipId_fkey" FOREIGN KEY ("memberMembershipId") REFERENCES "OrganizationMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationReportingLine" ADD CONSTRAINT "OrganizationReportingLine_managerMembershipId_fkey" FOREIGN KEY ("managerMembershipId") REFERENCES "OrganizationMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationReportingLine" ADD CONSTRAINT "OrganizationReportingLine_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationSupportContact" ADD CONSTRAINT "OrganizationSupportContact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationSupportContact" ADD CONSTRAINT "OrganizationSupportContact_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "OrganizationUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationSupportContact" ADD CONSTRAINT "OrganizationSupportContact_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "OrganizationMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationSupportContact" ADD CONSTRAINT "OrganizationSupportContact_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellbeingSupportShare" ADD CONSTRAINT "WellbeingSupportShare_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellbeingSupportShare" ADD CONSTRAINT "WellbeingSupportShare_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellbeingSupportShare" ADD CONSTRAINT "WellbeingSupportShare_recipientMembershipId_fkey" FOREIGN KEY ("recipientMembershipId") REFERENCES "OrganizationMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellbeingSupportShare" ADD CONSTRAINT "WellbeingSupportShare_supportContactId_fkey" FOREIGN KEY ("supportContactId") REFERENCES "OrganizationSupportContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellbeingSupportShare" ADD CONSTRAINT "WellbeingSupportShare_supersedesShareId_fkey" FOREIGN KEY ("supersedesShareId") REFERENCES "WellbeingSupportShare"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ===========================================================================
-- OSA 2 — osalised unikaalindeksid
-- ===========================================================================

-- Üks SOLO-profiil omaniku kohta. See ASENDAB kustutatud `@@unique([ownerId])`.
-- `WHERE ownershipMode = 'SOLO' AND ownerId IS NOT NULL`, sest:
--   - org-profiilil võib `ownerId` jääda alles PÄRITOLUNA (kes ta lõi) ja see
--     ei tohi blokeerida sama inimese uut solo-profiili;
--   - konto kustutamisel jääb `ownerId` NULL-iks ja NULL-id ei põrku.
CREATE UNIQUE INDEX "ServiceProviderProfile_solo_owner_uniq"
  ON "ServiceProviderProfile"("ownerId")
  WHERE "ownershipMode" = 'SOLO' AND "ownerId" IS NOT NULL;

-- Üks kehtiv juhiseos liikme kohta. Ajalugu (lõpetatud read) jääb alles.
CREATE UNIQUE INDEX "OrganizationReportingLine_live_member_uniq"
  ON "OrganizationReportingLine"("memberMembershipId")
  WHERE "validUntil" IS NULL;

-- Üks kehtiv sama liiki tugikontakt organisatsiooni ja inimese kohta.
CREATE UNIQUE INDEX "OrganizationSupportContact_live_uniq"
  ON "OrganizationSupportContact"("organizationId", "membershipId", "contactType")
  WHERE "validUntil" IS NULL;

-- ===========================================================================
-- OSA 2 — CHECK-piirangud
-- ===========================================================================

-- Omandirežiim on XOR-ilaadne: ORGANIZATION nõuab organisatsiooni, SOLO keelab
-- selle. `ownerId` kohta siin tingimust EI OLE — muidu blokeeriks CHECK
-- kasutaja konto kustutamise (SetNull teeb `ownerId` NULL-iks).
ALTER TABLE "ServiceProviderProfile"
  ADD CONSTRAINT "ServiceProviderProfile_ownership_chk"
  CHECK (
    ("ownershipMode" = 'ORGANIZATION' AND "organizationId" IS NOT NULL)
    OR ("ownershipMode" = 'SOLO' AND "organizationId" IS NULL)
  );

-- Inimene ei saa olla iseenda juht.
ALTER TABLE "OrganizationReportingLine"
  ADD CONSTRAINT "OrganizationReportingLine_no_self_chk"
  CHECK ("memberMembershipId" <> "managerMembershipId");

-- Toeavalduse seisumasin: avatud avaldusel peab olema avamise aeg, tagasi
-- võetul tagasivõtmise aeg. Ilma selleta saaks „avatud" olekut võltsida ja
-- tagasivõtmisõiguse vaikselt ära võtta.
ALTER TABLE "WellbeingSupportShare"
  ADD CONSTRAINT "WellbeingSupportShare_opened_chk"
  CHECK ("status" <> 'OPENED' OR "openedAt" IS NOT NULL);

ALTER TABLE "WellbeingSupportShare"
  ADD CONSTRAINT "WellbeingSupportShare_recalled_chk"
  CHECK ("status" <> 'RECALLED' OR "recalledAt" IS NOT NULL);

-- Avaldust ei saa iseendaga parandada.
ALTER TABLE "WellbeingSupportShare"
  ADD CONSTRAINT "WellbeingSupportShare_no_self_correction_chk"
  CHECK ("supersedesShareId" IS NULL OR "supersedesShareId" <> "id");

-- ===========================================================================
-- OSA 3 — ROLLBACK
-- ===========================================================================
--
-- VÄRAV ENNE ROLLBACK'I — kohustuslik:
--
--   SELECT count(*) FROM "ServiceProviderProfile" WHERE "ownershipMode" = 'ORGANIZATION';
--
-- Kui tulemus EI OLE 0, siis rollback'i EI TOHI teha: `ownerId` tagasi
-- NOT NULL-iks muutmine kukuks nendel ridadel läbi ja Cascade taastamine
-- seoks org-profiili uuesti ühe inimese konto külge.
--
-- Kui tulemus on 0:
--
--   DROP INDEX IF EXISTS "ServiceProviderProfile_solo_owner_uniq";
--   ALTER TABLE "ServiceProviderProfile" DROP CONSTRAINT "ServiceProviderProfile_ownership_chk";
--   ALTER TABLE "ServiceProviderProfile" DROP CONSTRAINT "ServiceProviderProfile_organizationId_fkey";
--   ALTER TABLE "ServiceProviderProfile" DROP CONSTRAINT "ServiceProviderProfile_ownerId_fkey";
--   ALTER TABLE "ServiceProviderProfile" DROP COLUMN "organizationId";
--   ALTER TABLE "ServiceProviderProfile" DROP COLUMN "ownershipMode";
--   ALTER TABLE "ServiceProviderProfile" ALTER COLUMN "ownerId" SET NOT NULL;
--   CREATE UNIQUE INDEX "ServiceProviderProfile_ownerId_key" ON "ServiceProviderProfile"("ownerId");
--   ALTER TABLE "ServiceProviderProfile" ADD CONSTRAINT "ServiceProviderProfile_ownerId_fkey"
--     FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
--   DROP TABLE IF EXISTS "WellbeingSupportShare"      CASCADE;
--   DROP TABLE IF EXISTS "OrganizationSupportContact" CASCADE;
--   DROP TABLE IF EXISTS "OrganizationReportingLine"  CASCADE;
--   DROP TYPE  IF EXISTS "ServiceProviderOwnershipMode";
--   DROP TYPE  IF EXISTS "WellbeingSupportShareStatus";
--   DROP TYPE  IF EXISTS "OrganizationSupportContactType";
--
-- NB `ALTER COLUMN "ownerId" SET NOT NULL` kukub läbi ka siis, kui mõne
-- solo-profiili omaniku konto on vahepeal kustutatud (SetNull). Sel juhul tuleb
-- need read enne käsitsi lahendada — uus omanik või arhiveerimine.

