-- T25 ORG-FOUNDATION-V1 (viil A)
--
-- Puhtalt ADITIIVNE migratsioon: ühtegi olemasolevat tabelit, veergu, indeksit
-- ega piirangut ei muudeta. Rollback = osa 3 lõpus kirjeldatud DROP vastupidises
-- järjekorras; olemasolevatele andmetele ei ole mingit mõju.
--
-- Osa 1 — enumid ja tabelid (genereeritud `prisma migrate diff`-iga).
-- Osa 2 — osalised unikaalindeksid ja CHECK-piirangud, mida Prisma skeemikeel
--         ei väljenda. Need EI OLE kosmeetika: nad kannavad arenduskava §5.2–§5.5
--         invariante ja peavad kehtima ka siis, kui teenusekiht eksib.

-- ===========================================================================
-- OSA 1 — enumid
-- ===========================================================================

-- CreateEnum
CREATE TYPE "OrganizationLegalKind" AS ENUM ('MUNICIPALITY', 'PUBLIC_AGENCY', 'COMPANY', 'NGO', 'FOUNDATION', 'SOLE_PROPRIETOR', 'OTHER');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('DRAFT', 'PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OrganizationModuleKey" AS ENUM ('KOV_INTAKE', 'SERVICE_DELIVERY', 'PROFESSIONAL_SUPPORT', 'ORG_KNOWLEDGE');

-- CreateEnum
CREATE TYPE "OrganizationModuleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "OrganizationUnitType" AS ENUM ('DEPARTMENT', 'TEAM', 'SERVICE_LOCATION', 'OTHER');

-- CreateEnum
CREATE TYPE "OrganizationUnitStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OrganizationMembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ENDED');

-- CreateEnum
CREATE TYPE "OrganizationSeatRole" AS ENUM ('SOCIAL_WORKER', 'SERVICE_PROVIDER');

-- CreateEnum
CREATE TYPE "OrganizationCapability" AS ENUM ('ORG_OWNER', 'MEMBER_ADMIN', 'UNIT_LEAD', 'INBOX_COORDINATOR', 'WORK_ASSIGNER', 'SERVICE_PROFILE_EDITOR', 'SUPPORT_CONTACT_ADMIN', 'BILLING_MANAGER', 'AUDIT_VIEWER');

-- CreateEnum
CREATE TYPE "OrganizationCapabilityScopeType" AS ENUM ('ORGANIZATION', 'UNIT');

-- CreateEnum
CREATE TYPE "OrganizationInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED');

-- ===========================================================================
-- OSA 1 — tabelid
-- ===========================================================================

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "legalName" TEXT,
    "registryCode" TEXT,
    "legalKind" "OrganizationLegalKind" NOT NULL,
    "municipalityId" TEXT,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'DRAFT',
    "defaultLocale" TEXT NOT NULL DEFAULT 'et',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Tallinn',
    "createdByUserId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedByUserId" TEXT,
    "verificationNote" TEXT,
    "activatedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "suspendedReason" TEXT,
    "archivedAt" TIMESTAMP(3),
    "archivedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationModule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "moduleKey" "OrganizationModuleKey" NOT NULL,
    "status" "OrganizationModuleStatus" NOT NULL DEFAULT 'DRAFT',
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "activatedByUserId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationUnit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "parentUnitId" TEXT,
    "type" "OrganizationUnitType" NOT NULL DEFAULT 'TEAM',
    "name" TEXT NOT NULL,
    "status" "OrganizationUnitStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "depth" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMembership" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "OrganizationMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "seatRole" "OrganizationSeatRole" NOT NULL,
    "jobTitle" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endedReason" TEXT,
    "invitedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMembershipUnit" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationMembershipUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationCapabilityGrant" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "capability" "OrganizationCapability" NOT NULL,
    "scopeType" "OrganizationCapabilityScopeType" NOT NULL DEFAULT 'ORGANIZATION',
    "scopeUnitId" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedByUserId" TEXT,
    "grantedByUserId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationCapabilityGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationInvite" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "OrganizationInviteStatus" NOT NULL DEFAULT 'PENDING',
    "seatRole" "OrganizationSeatRole" NOT NULL,
    "primaryUnitId" TEXT,
    "capabilityTemplate" TEXT,
    "jobTitle" TEXT,
    "invitedByUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" TEXT,
    "declinedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationInvite_pkey" PRIMARY KEY ("id")
);

-- ===========================================================================
-- OSA 1 — indeksid
-- ===========================================================================

-- CreateIndex
CREATE INDEX "Organization_status_idx" ON "Organization"("status");

-- CreateIndex
CREATE INDEX "Organization_legalKind_idx" ON "Organization"("legalKind");

-- CreateIndex
CREATE INDEX "Organization_municipalityId_idx" ON "Organization"("municipalityId");

-- CreateIndex
CREATE INDEX "Organization_createdByUserId_idx" ON "Organization"("createdByUserId");

-- CreateIndex
CREATE INDEX "Organization_registryCode_idx" ON "Organization"("registryCode");

-- CreateIndex
CREATE INDEX "OrganizationModule_organizationId_status_idx" ON "OrganizationModule"("organizationId", "status");

-- CreateIndex
CREATE INDEX "OrganizationModule_moduleKey_status_idx" ON "OrganizationModule"("moduleKey", "status");

-- CreateIndex
CREATE INDEX "OrganizationUnit_organizationId_status_sortOrder_idx" ON "OrganizationUnit"("organizationId", "status", "sortOrder");

-- CreateIndex
CREATE INDEX "OrganizationUnit_organizationId_parentUnitId_idx" ON "OrganizationUnit"("organizationId", "parentUnitId");

-- CreateIndex
CREATE INDEX "OrganizationUnit_parentUnitId_idx" ON "OrganizationUnit"("parentUnitId");

-- CreateIndex
CREATE INDEX "OrganizationMembership_organizationId_status_idx" ON "OrganizationMembership"("organizationId", "status");

-- CreateIndex
CREATE INDEX "OrganizationMembership_userId_status_idx" ON "OrganizationMembership"("userId", "status");

-- CreateIndex
CREATE INDEX "OrganizationMembership_organizationId_seatRole_status_idx" ON "OrganizationMembership"("organizationId", "seatRole", "status");

-- CreateIndex
CREATE INDEX "OrganizationMembershipUnit_membershipId_endedAt_idx" ON "OrganizationMembershipUnit"("membershipId", "endedAt");

-- CreateIndex
CREATE INDEX "OrganizationMembershipUnit_unitId_endedAt_idx" ON "OrganizationMembershipUnit"("unitId", "endedAt");

-- CreateIndex
CREATE INDEX "OrganizationCapabilityGrant_membershipId_revokedAt_idx" ON "OrganizationCapabilityGrant"("membershipId", "revokedAt");

-- CreateIndex
CREATE INDEX "OrganizationCapabilityGrant_capability_revokedAt_idx" ON "OrganizationCapabilityGrant"("capability", "revokedAt");

-- CreateIndex
CREATE INDEX "OrganizationCapabilityGrant_scopeUnitId_revokedAt_idx" ON "OrganizationCapabilityGrant"("scopeUnitId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationInvite_tokenHash_key" ON "OrganizationInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "OrganizationInvite_organizationId_status_idx" ON "OrganizationInvite"("organizationId", "status");

-- CreateIndex
CREATE INDEX "OrganizationInvite_email_status_idx" ON "OrganizationInvite"("email", "status");

-- CreateIndex
CREATE INDEX "OrganizationInvite_expiresAt_idx" ON "OrganizationInvite"("expiresAt");

-- ===========================================================================
-- OSA 1 — võtmed
-- ===========================================================================

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_municipalityId_fkey" FOREIGN KEY ("municipalityId") REFERENCES "Municipality"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationModule" ADD CONSTRAINT "OrganizationModule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationModule" ADD CONSTRAINT "OrganizationModule_activatedByUserId_fkey" FOREIGN KEY ("activatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationUnit" ADD CONSTRAINT "OrganizationUnit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationUnit" ADD CONSTRAINT "OrganizationUnit_parentUnitId_fkey" FOREIGN KEY ("parentUnitId") REFERENCES "OrganizationUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembershipUnit" ADD CONSTRAINT "OrganizationMembershipUnit_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "OrganizationMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembershipUnit" ADD CONSTRAINT "OrganizationMembershipUnit_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "OrganizationUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationCapabilityGrant" ADD CONSTRAINT "OrganizationCapabilityGrant_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "OrganizationMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- CASCADE, mitte RESTRICT: RESTRICT blokeeriks organisatsiooni päris kustutamise
-- (org → üksus kaskaad jääks grandi taha kinni). Tavakäigus üksust ei kustutata,
-- ta arhiveeritakse.
ALTER TABLE "OrganizationCapabilityGrant" ADD CONSTRAINT "OrganizationCapabilityGrant_scopeUnitId_fkey" FOREIGN KEY ("scopeUnitId") REFERENCES "OrganizationUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationCapabilityGrant" ADD CONSTRAINT "OrganizationCapabilityGrant_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationCapabilityGrant" ADD CONSTRAINT "OrganizationCapabilityGrant_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationInvite" ADD CONSTRAINT "OrganizationInvite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationInvite" ADD CONSTRAINT "OrganizationInvite_primaryUnitId_fkey" FOREIGN KEY ("primaryUnitId") REFERENCES "OrganizationUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationInvite" ADD CONSTRAINT "OrganizationInvite_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationInvite" ADD CONSTRAINT "OrganizationInvite_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ===========================================================================
-- OSA 2 — osalised unikaalindeksid (Prisma skeemikeel ei väljenda `WHERE`-i)
-- ===========================================================================

-- Üks AKTIIVNE liikmesus organisatsiooni ja kasutaja kohta (arenduskava §5.3).
-- Lõpetatud ja peatatud liikmesused jäävad ajalukku ega blokeeri uuesti liitumist.
CREATE UNIQUE INDEX "OrganizationMembership_active_org_user_uniq"
  ON "OrganizationMembership"("organizationId", "userId")
  WHERE "status" = 'ACTIVE';

-- Üks AKTIIVNE moodul organisatsiooni ja moodulivõtme kohta (arenduskava §5.1).
CREATE UNIQUE INDEX "OrganizationModule_active_org_key_uniq"
  ON "OrganizationModule"("organizationId", "moduleKey")
  WHERE "status" = 'ACTIVE';

-- Üks aktiivne PÕHIüksus liikmesuse kohta (arenduskava §5.3).
CREATE UNIQUE INDEX "OrganizationMembershipUnit_active_primary_uniq"
  ON "OrganizationMembershipUnit"("membershipId")
  WHERE "isPrimary" = true AND "endedAt" IS NULL;

-- Sama üksust ei saa liikmesusele kaks korda aktiivsena külge panna.
CREATE UNIQUE INDEX "OrganizationMembershipUnit_active_pair_uniq"
  ON "OrganizationMembershipUnit"("membershipId", "unitId")
  WHERE "endedAt" IS NULL;

-- Üks avatud kutse organisatsiooni ja e-posti kohta. `lower(email)`, sest
-- e-posti aadress ei ole tõstutundlik ja kaks kutset ühele inimesele on viga.
CREATE UNIQUE INDEX "OrganizationInvite_pending_org_email_uniq"
  ON "OrganizationInvite"("organizationId", lower("email"))
  WHERE "status" = 'PENDING';

-- Üks kehtiv sama capability + skoobi grant liikmesuse kohta. `COALESCE`, sest
-- NULL-id ei ole unikaalindeksis omavahel võrdsed ja ORGANIZATION-skoobiga
-- grante tekiks muidu piiramatult.
CREATE UNIQUE INDEX "OrganizationCapabilityGrant_live_uniq"
  ON "OrganizationCapabilityGrant"("membershipId", "capability", "scopeType", COALESCE("scopeUnitId", ''))
  WHERE "revokedAt" IS NULL;

-- ===========================================================================
-- OSA 2 — CHECK-piirangud (invariandid, mis peavad kehtima ka teenusekihi vea korral)
-- ===========================================================================

-- Capability skoop on XOR: UNIT nõuab üksust, ORGANIZATION keelab selle.
-- Ilma selleta tekiks „üksuseõigus ilma üksuseta", mis loeks kogu organisatsiooni.
ALTER TABLE "OrganizationCapabilityGrant"
  ADD CONSTRAINT "OrganizationCapabilityGrant_scope_xor_chk"
  CHECK (
    ("scopeType" = 'ORGANIZATION' AND "scopeUnitId" IS NULL)
    OR ("scopeType" = 'UNIT' AND "scopeUnitId" IS NOT NULL)
  );

-- Maksimaalne toetatud struktuurisügavus V1-s on 3 (arenduskava §5.2).
-- Juuretasand = 1. Tsükli- ja „vanem on teisest organisatsioonist" keeld ei ole
-- CHECK-iga väljendatav → need on teenusekihis (`lib/org/units.js`) ja testides.
ALTER TABLE "OrganizationUnit"
  ADD CONSTRAINT "OrganizationUnit_depth_chk"
  CHECK ("depth" >= 1 AND "depth" <= 3);

-- Juurüksuse sügavus on alati 1.
ALTER TABLE "OrganizationUnit"
  ADD CONSTRAINT "OrganizationUnit_root_depth_chk"
  CHECK ("parentUnitId" IS NOT NULL OR "depth" = 1);

-- Üksus ei tohi olla iseenda vanem.
ALTER TABLE "OrganizationUnit"
  ADD CONSTRAINT "OrganizationUnit_no_self_parent_chk"
  CHECK ("parentUnitId" IS NULL OR "parentUnitId" <> "id");

-- Lõpetatud liikmesusel peab olema lõpuaeg; aktiivsel ei tohi olla.
ALTER TABLE "OrganizationMembership"
  ADD CONSTRAINT "OrganizationMembership_ended_chk"
  CHECK (
    ("status" = 'ENDED' AND "endedAt" IS NOT NULL)
    OR ("status" <> 'ENDED' AND "endedAt" IS NULL)
  );

-- Organisatsioon ei saa jõuda ACTIVE seisu ilma identiteedikontrollita
-- (arenduskava §7.1: „identiteedikontrollita ei saa päris organisatsioonikasutust
-- aktiveerida"). See on aktiveerimisvärav, mis ei tohi sõltuda ainult UI-st.
ALTER TABLE "Organization"
  ADD CONSTRAINT "Organization_active_requires_verification_chk"
  CHECK ("status" <> 'ACTIVE' OR "verifiedAt" IS NOT NULL);

-- ===========================================================================
-- OSA 3 — ROLLBACK (käsitsi, kui viil A tuleb tagasi võtta)
-- ===========================================================================
--
-- Migratsioon on aditiivne, seega rollback ei puuduta ühtegi olemasolevat rida:
--
--   DROP TABLE IF EXISTS "OrganizationCapabilityGrant" CASCADE;
--   DROP TABLE IF EXISTS "OrganizationMembershipUnit"  CASCADE;
--   DROP TABLE IF EXISTS "OrganizationInvite"          CASCADE;
--   DROP TABLE IF EXISTS "OrganizationMembership"      CASCADE;
--   DROP TABLE IF EXISTS "OrganizationUnit"            CASCADE;
--   DROP TABLE IF EXISTS "OrganizationModule"          CASCADE;
--   DROP TABLE IF EXISTS "Organization"                CASCADE;
--   DROP TYPE  IF EXISTS "OrganizationInviteStatus";
--   DROP TYPE  IF EXISTS "OrganizationCapabilityScopeType";
--   DROP TYPE  IF EXISTS "OrganizationCapability";
--   DROP TYPE  IF EXISTS "OrganizationSeatRole";
--   DROP TYPE  IF EXISTS "OrganizationMembershipStatus";
--   DROP TYPE  IF EXISTS "OrganizationUnitStatus";
--   DROP TYPE  IF EXISTS "OrganizationUnitType";
--   DROP TYPE  IF EXISTS "OrganizationModuleStatus";
--   DROP TYPE  IF EXISTS "OrganizationModuleKey";
--   DROP TYPE  IF EXISTS "OrganizationStatus";
--   DROP TYPE  IF EXISTS "OrganizationLegalKind";
--
-- `User` ja `Municipality` tabeleid see migratsioon EI muuda — nende uued
-- Prisma-väljad on tagasiviited, mitte veerud.
