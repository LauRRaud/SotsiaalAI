-- T25 ORG-FUNDING-INBOX-V1 (viil B)
--
-- ADITIIVNE: olemasolevatele tabelitele lisatakse ainult NULLABLE veerud ja
-- kahele enumile uus väärtus. Ühtegi veergu ei kustutata, ühtegi tüüpi ei
-- kitsendata, ühtegi rida ei muudeta. Olemasolevad tellimused ja
-- eelpöördumised jäävad täpselt sellisteks, nagu nad on.
--
-- Osa 1 — enumid, tabelid, veerud (genereeritud `prisma migrate diff`-iga).
-- Osa 2 — osalised unikaalindeksid ja CHECK-piirangud.
-- Osa 3 — rollback.
--
-- NB `ALTER TYPE ... ADD VALUE`: uut väärtust EI kasutata samas migratsioonis,
-- seega Postgresi „unsafe use of new value" piirang ei rakendu.

-- CreateEnum
CREATE TYPE "OrganizationSeatPlanSource" AS ENUM ('PILOT', 'MANUAL_CONTRACT', 'INVOICE', 'FUTURE_CHECKOUT');

-- CreateEnum
CREATE TYPE "OrganizationSeatPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "OrganizationSeatAssignmentStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ENDED');

-- CreateEnum
CREATE TYPE "OrganizationInboxSourceType" AS ENUM ('PRE_INQUIRY');

-- CreateEnum
CREATE TYPE "OrganizationInboxStatus" AS ENUM ('RECEIVED', 'REVIEWING', 'ASSIGNMENT_PENDING', 'ASSIGNED', 'ACCEPTED', 'CLOSED', 'REJECTED', 'RECALLED');

-- CreateEnum
CREATE TYPE "OrganizationWorkAssignmentStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'HANDED_OVER', 'ENDED');

-- CreateEnum
CREATE TYPE "OrganizationClientSponsorshipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "PreInquiryRecipientType" ADD VALUE 'ORGANIZATION_INBOX';

-- AlterEnum
ALTER TYPE "BillingSource" ADD VALUE 'SPONSORED_BY_ORGANIZATION';

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "orgClientSponsorshipId" TEXT,
ADD COLUMN     "sponsorOrganizationId" TEXT;

-- AlterTable
ALTER TABLE "PreInquiry" ADD COLUMN     "recipientOrganizationId" TEXT;

-- CreateTable
CREATE TABLE "OrganizationSeatPlan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "seatRole" "OrganizationSeatRole" NOT NULL,
    "seatLimit" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "billingInterval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
    "source" "OrganizationSeatPlanSource" NOT NULL DEFAULT 'MANUAL_CONTRACT',
    "priceReason" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "status" "OrganizationSeatPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationSeatPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationSeatAssignment" (
    "id" TEXT NOT NULL,
    "seatPlanId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "status" "OrganizationSeatAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endedReason" TEXT,
    "assignedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationSeatAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationInboxItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "unitId" TEXT,
    "sourceType" "OrganizationInboxSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" "OrganizationInboxStatus" NOT NULL DEFAULT 'RECEIVED',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastTransitionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "urgencyDeclaredBySender" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationInboxItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationWorkAssignment" (
    "id" TEXT NOT NULL,
    "inboxItemId" TEXT NOT NULL,
    "assigneeMembershipId" TEXT NOT NULL,
    "status" "OrganizationWorkAssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "assignedByUserId" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "endedAt" TIMESTAMP(3),
    "supersedesAssignmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationWorkAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationClientSponsorship" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "OrganizationClientSponsorshipStatus" NOT NULL DEFAULT 'PENDING',
    "unitPriceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "priceReason" TEXT,
    "invitedByUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" TEXT,
    "declinedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationClientSponsorship_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizationSeatPlan_organizationId_status_idx" ON "OrganizationSeatPlan"("organizationId", "status");

-- CreateIndex
CREATE INDEX "OrganizationSeatPlan_seatRole_status_idx" ON "OrganizationSeatPlan"("seatRole", "status");

-- CreateIndex
CREATE INDEX "OrganizationSeatAssignment_seatPlanId_status_idx" ON "OrganizationSeatAssignment"("seatPlanId", "status");

-- CreateIndex
CREATE INDEX "OrganizationSeatAssignment_membershipId_status_idx" ON "OrganizationSeatAssignment"("membershipId", "status");

-- CreateIndex
CREATE INDEX "OrganizationInboxItem_organizationId_status_receivedAt_idx" ON "OrganizationInboxItem"("organizationId", "status", "receivedAt");

-- CreateIndex
CREATE INDEX "OrganizationInboxItem_unitId_status_idx" ON "OrganizationInboxItem"("unitId", "status");

-- CreateIndex
CREATE INDEX "OrganizationInboxItem_sourceType_sourceId_idx" ON "OrganizationInboxItem"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationInboxItem_organizationId_sourceType_sourceId_key" ON "OrganizationInboxItem"("organizationId", "sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationWorkAssignment_supersedesAssignmentId_key" ON "OrganizationWorkAssignment"("supersedesAssignmentId");

-- CreateIndex
CREATE INDEX "OrganizationWorkAssignment_inboxItemId_status_idx" ON "OrganizationWorkAssignment"("inboxItemId", "status");

-- CreateIndex
CREATE INDEX "OrganizationWorkAssignment_assigneeMembershipId_status_idx" ON "OrganizationWorkAssignment"("assigneeMembershipId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationClientSponsorship_tokenHash_key" ON "OrganizationClientSponsorship"("tokenHash");

-- CreateIndex
CREATE INDEX "OrganizationClientSponsorship_organizationId_status_idx" ON "OrganizationClientSponsorship"("organizationId", "status");

-- CreateIndex
CREATE INDEX "OrganizationClientSponsorship_email_status_idx" ON "OrganizationClientSponsorship"("email", "status");

-- CreateIndex
CREATE INDEX "OrganizationClientSponsorship_expiresAt_idx" ON "OrganizationClientSponsorship"("expiresAt");

-- CreateIndex
CREATE INDEX "Subscription_sponsorOrganizationId_idx" ON "Subscription"("sponsorOrganizationId");

-- CreateIndex
CREATE INDEX "Subscription_orgClientSponsorshipId_idx" ON "Subscription"("orgClientSponsorshipId");

-- CreateIndex
CREATE INDEX "PreInquiry_recipientOrganizationId_status_updatedAt_idx" ON "PreInquiry"("recipientOrganizationId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "PreInquiry_recipientOrganizationId_sentAt_idx" ON "PreInquiry"("recipientOrganizationId", "sentAt");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_sponsorOrganizationId_fkey" FOREIGN KEY ("sponsorOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_orgClientSponsorshipId_fkey" FOREIGN KEY ("orgClientSponsorshipId") REFERENCES "OrganizationClientSponsorship"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreInquiry" ADD CONSTRAINT "PreInquiry_recipientOrganizationId_fkey" FOREIGN KEY ("recipientOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationSeatPlan" ADD CONSTRAINT "OrganizationSeatPlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationSeatPlan" ADD CONSTRAINT "OrganizationSeatPlan_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationSeatAssignment" ADD CONSTRAINT "OrganizationSeatAssignment_seatPlanId_fkey" FOREIGN KEY ("seatPlanId") REFERENCES "OrganizationSeatPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationSeatAssignment" ADD CONSTRAINT "OrganizationSeatAssignment_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "OrganizationMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationSeatAssignment" ADD CONSTRAINT "OrganizationSeatAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationInboxItem" ADD CONSTRAINT "OrganizationInboxItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationInboxItem" ADD CONSTRAINT "OrganizationInboxItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "OrganizationUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationWorkAssignment" ADD CONSTRAINT "OrganizationWorkAssignment_inboxItemId_fkey" FOREIGN KEY ("inboxItemId") REFERENCES "OrganizationInboxItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationWorkAssignment" ADD CONSTRAINT "OrganizationWorkAssignment_assigneeMembershipId_fkey" FOREIGN KEY ("assigneeMembershipId") REFERENCES "OrganizationMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationWorkAssignment" ADD CONSTRAINT "OrganizationWorkAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationWorkAssignment" ADD CONSTRAINT "OrganizationWorkAssignment_supersedesAssignmentId_fkey" FOREIGN KEY ("supersedesAssignmentId") REFERENCES "OrganizationWorkAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationClientSponsorship" ADD CONSTRAINT "OrganizationClientSponsorship_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationClientSponsorship" ADD CONSTRAINT "OrganizationClientSponsorship_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationClientSponsorship" ADD CONSTRAINT "OrganizationClientSponsorship_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ===========================================================================
-- OSA 2 — osalised unikaalindeksid
-- ===========================================================================

-- Üks AKTIIVNE kohaplaan organisatsiooni ja koharolli kohta. Segapakett on
-- lubatud (üks org võib omada SOCIAL_WORKER ja SERVICE_PROVIDER plaani), aga
-- kaks aktiivset plaani SAMA rolli kohta teeks kohalimiidi mitmetähenduslikuks.
CREATE UNIQUE INDEX "OrganizationSeatPlan_active_org_role_uniq"
  ON "OrganizationSeatPlan"("organizationId", "seatRole")
  WHERE "status" = 'ACTIVE';

-- Üks AKTIIVNE koht liikmesuse kohta. Kohti ei "stack'ita" kvoodi
-- korrutamiseks (arenduskava §5.6).
CREATE UNIQUE INDEX "OrganizationSeatAssignment_active_membership_uniq"
  ON "OrganizationSeatAssignment"("membershipId")
  WHERE "status" = 'ACTIVE';

-- Üks ELAV määramine töö kohta. PENDING ja ACCEPTED on mõlemad elavad;
-- üleandmine sulgeb vana (HANDED_OVER) enne uue loomist.
CREATE UNIQUE INDEX "OrganizationWorkAssignment_live_inbox_uniq"
  ON "OrganizationWorkAssignment"("inboxItemId")
  WHERE "status" IN ('PENDING', 'ACCEPTED');

-- Üks avatud sponsorlus organisatsiooni ja e-posti kohta.
CREATE UNIQUE INDEX "OrgClientSponsorship_pending_org_email_uniq"
  ON "OrganizationClientSponsorship"("organizationId", lower("email"))
  WHERE "status" = 'PENDING';

-- ===========================================================================
-- OSA 2 — CHECK-piirangud
-- ===========================================================================

-- Kohalimiit ja hind ei saa olla negatiivsed.
ALTER TABLE "OrganizationSeatPlan"
  ADD CONSTRAINT "OrganizationSeatPlan_amounts_chk"
  CHECK ("seatLimit" >= 0 AND "unitPriceCents" >= 0);

ALTER TABLE "OrganizationClientSponsorship"
  ADD CONSTRAINT "OrgClientSponsorship_price_chk"
  CHECK ("unitPriceCents" >= 0);

-- Lõpetatud kohal peab olema lõpuaeg; aktiivsel mitte.
ALTER TABLE "OrganizationSeatAssignment"
  ADD CONSTRAINT "OrganizationSeatAssignment_ended_chk"
  CHECK (
    ("status" = 'ENDED' AND "endedAt" IS NOT NULL)
    OR ("status" <> 'ENDED' AND "endedAt" IS NULL)
  );

-- Suletud postkastikirjel peab olema sulgemisaeg.
ALTER TABLE "OrganizationInboxItem"
  ADD CONSTRAINT "OrganizationInboxItem_closed_chk"
  CHECK (
    ("status" IN ('CLOSED', 'REJECTED') AND "closedAt" IS NOT NULL)
    OR ("status" NOT IN ('CLOSED', 'REJECTED') AND "closedAt" IS NULL)
  );

-- Tagasi lükatud määramisel peab olema tagasilükkamise aeg ja vastupidi.
ALTER TABLE "OrganizationWorkAssignment"
  ADD CONSTRAINT "OrganizationWorkAssignment_rejected_chk"
  CHECK (
    ("status" = 'REJECTED' AND "rejectedAt" IS NOT NULL)
    OR ("status" <> 'REJECTED' AND "rejectedAt" IS NULL)
  );

-- Määramine ei saa iseennast üle anda.
ALTER TABLE "OrganizationWorkAssignment"
  ADD CONSTRAINT "OrganizationWorkAssignment_no_self_handover_chk"
  CHECK ("supersedesAssignmentId" IS NULL OR "supersedesAssignmentId" <> "id");

-- ===========================================================================
-- OSA 3 — ROLLBACK (käsitsi, kui viil B tuleb tagasi võtta)
-- ===========================================================================
--
--   ALTER TABLE "PreInquiry"   DROP CONSTRAINT "PreInquiry_recipientOrganizationId_fkey";
--   ALTER TABLE "PreInquiry"   DROP COLUMN "recipientOrganizationId";
--   ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_sponsorOrganizationId_fkey";
--   ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_orgClientSponsorshipId_fkey";
--   ALTER TABLE "Subscription" DROP COLUMN "sponsorOrganizationId";
--   ALTER TABLE "Subscription" DROP COLUMN "orgClientSponsorshipId";
--   DROP TABLE IF EXISTS "OrganizationWorkAssignment"    CASCADE;
--   DROP TABLE IF EXISTS "OrganizationInboxItem"         CASCADE;
--   DROP TABLE IF EXISTS "OrganizationSeatAssignment"    CASCADE;
--   DROP TABLE IF EXISTS "OrganizationSeatPlan"          CASCADE;
--   DROP TABLE IF EXISTS "OrganizationClientSponsorship" CASCADE;
--   DROP TYPE  IF EXISTS "OrganizationClientSponsorshipStatus";
--   DROP TYPE  IF EXISTS "OrganizationWorkAssignmentStatus";
--   DROP TYPE  IF EXISTS "OrganizationInboxStatus";
--   DROP TYPE  IF EXISTS "OrganizationInboxSourceType";
--   DROP TYPE  IF EXISTS "OrganizationSeatAssignmentStatus";
--   DROP TYPE  IF EXISTS "OrganizationSeatPlanStatus";
--   DROP TYPE  IF EXISTS "OrganizationSeatPlanSource";
--
-- HOIATUS: `BillingSource.SPONSORED_BY_ORGANIZATION` ja
-- `PreInquiryRecipientType.ORGANIZATION_INBOX` JÄÄVAD enumitesse ka pärast
-- rollback'i. Postgres ei võimalda enum-väärtust eemaldada ilma tüüpi ümber
-- ehitamata ja kõiki sõltuvaid veerge ümber kirjutamata. Kasutamata väärtus
-- enumis on kahjutu; tüübi ümberehitus toodangus ei ole.

