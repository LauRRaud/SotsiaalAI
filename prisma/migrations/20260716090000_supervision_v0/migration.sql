-- CreateEnum
CREATE TYPE "SupervisionProcessType" AS ENUM ('INDIVIDUAL', 'GROUP');

-- CreateEnum
CREATE TYPE "SupervisionProcessStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupervisionContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "SupervisionParticipationStatus" AS ENUM ('INVITED', 'ACCEPTED', 'DECLINED', 'LEFT', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "SupervisionPrivateItemKind" AS ENUM ('PREP_TOPIC', 'PRIVATE_NOTE', 'CLOSING_REFLECTION');

-- CreateEnum
CREATE TYPE "SupervisionTopicAudience" AS ENUM ('SUPERVISOR_ONLY', 'PROCESS');

-- CreateEnum
CREATE TYPE "SupervisionTopicSourceKind" AS ENUM ('MANUAL', 'WELLBEING_HANDOFF');

-- CreateEnum
CREATE TYPE "SupervisionTopicStatus" AS ENUM ('SHARED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "SupervisionMeetingStatus" AS ENUM ('PLANNED', 'HELD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SupervisionSummaryKind" AS ENUM ('MEETING', 'FINAL');

-- CreateEnum
CREATE TYPE "SupervisionSummaryStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'DISCARDED');

-- CreateTable
CREATE TABLE "SupervisorGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedByUserId" TEXT,
    "grantBasis" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupervisorGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupervisionProcess" (
    "id" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "type" "SupervisionProcessType" NOT NULL,
    "title" TEXT NOT NULL,
    "goal" TEXT,
    "plannedMeetingCount" INTEGER NOT NULL DEFAULT 5,
    "status" "SupervisionProcessStatus" NOT NULL DEFAULT 'DRAFT',
    "activeContractVersionId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "SupervisionProcess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupervisionContractVersion" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "status" "SupervisionContractStatus" NOT NULL DEFAULT 'DRAFT',
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupervisionContractVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupervisionParticipation" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invitedByUserId" TEXT,
    "status" "SupervisionParticipationStatus" NOT NULL DEFAULT 'INVITED',
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupervisionParticipation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupervisionContractAcceptance" (
    "id" TEXT NOT NULL,
    "participationId" TEXT NOT NULL,
    "contractVersionId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupervisionContractAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupervisionPrivateItem" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "kind" "SupervisionPrivateItemKind" NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "sharedTopicId" TEXT,
    "sourceKind" "SupervisionTopicSourceKind" NOT NULL DEFAULT 'MANUAL',
    "sourceWellbeingDraftId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupervisionPrivateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupervisionSharedTopic" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "authorParticipationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" "SupervisionTopicAudience" NOT NULL,
    "sourceKind" "SupervisionTopicSourceKind" NOT NULL,
    "status" "SupervisionTopicStatus" NOT NULL DEFAULT 'SHARED',
    "sharedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupervisionSharedTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupervisionMeeting" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "plannedAt" TIMESTAMP(3),
    "heldAt" TIMESTAMP(3),
    "markedHeldByUserId" TEXT,
    "status" "SupervisionMeetingStatus" NOT NULL DEFAULT 'PLANNED',
    "agendaTopicIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT,
    "topicCountAtClose" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupervisionMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupervisionSummary" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "meetingId" TEXT,
    "kind" "SupervisionSummaryKind" NOT NULL,
    "body" TEXT NOT NULL,
    "status" "SupervisionSummaryStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupervisionSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupervisionSummaryApproval" (
    "id" TEXT NOT NULL,
    "summaryId" TEXT NOT NULL,
    "participationId" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupervisionSummaryApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupervisionClosure" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "closedByUserId" TEXT,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "factsJson" JSONB NOT NULL,
    "purgeReport" JSONB NOT NULL,
    "retentionStatus" TEXT NOT NULL DEFAULT 'AWAITING_POLICY',

    CONSTRAINT "SupervisionClosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupervisionPersonalOutcome" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "processId" TEXT,
    "processTitleGeneralized" TEXT NOT NULL,
    "contentJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupervisionPersonalOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupervisionAuditEvent" (
    "id" TEXT NOT NULL,
    "processId" TEXT,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetKind" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupervisionAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupervisorGrant_userId_revokedAt_validUntil_idx" ON "SupervisorGrant"("userId", "revokedAt", "validUntil");

-- CreateIndex
CREATE UNIQUE INDEX "SupervisionProcess_activeContractVersionId_key" ON "SupervisionProcess"("activeContractVersionId");

-- CreateIndex
CREATE INDEX "SupervisionProcess_supervisorId_status_updatedAt_idx" ON "SupervisionProcess"("supervisorId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "SupervisionProcess_status_lastActivityAt_idx" ON "SupervisionProcess"("status", "lastActivityAt");

-- CreateIndex
CREATE INDEX "SupervisionContractVersion_processId_status_idx" ON "SupervisionContractVersion"("processId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SupervisionContractVersion_processId_versionNumber_key" ON "SupervisionContractVersion"("processId", "versionNumber");

-- CreateIndex
CREATE INDEX "SupervisionParticipation_userId_status_updatedAt_idx" ON "SupervisionParticipation"("userId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupervisionParticipation_processId_userId_key" ON "SupervisionParticipation"("processId", "userId");

-- CreateIndex
CREATE INDEX "SupervisionContractAcceptance_contractVersionId_idx" ON "SupervisionContractAcceptance"("contractVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "SupervisionContractAcceptance_participationId_contractVersi_key" ON "SupervisionContractAcceptance"("participationId", "contractVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "SupervisionPrivateItem_sourceWellbeingDraftId_key" ON "SupervisionPrivateItem"("sourceWellbeingDraftId");

-- CreateIndex
CREATE INDEX "SupervisionPrivateItem_processId_ownerUserId_updatedAt_idx" ON "SupervisionPrivateItem"("processId", "ownerUserId", "updatedAt");

-- CreateIndex
CREATE INDEX "SupervisionSharedTopic_processId_status_sharedAt_idx" ON "SupervisionSharedTopic"("processId", "status", "sharedAt");

-- CreateIndex
CREATE INDEX "SupervisionSharedTopic_authorParticipationId_idx" ON "SupervisionSharedTopic"("authorParticipationId");

-- CreateIndex
CREATE UNIQUE INDEX "SupervisionMeeting_processId_seq_key" ON "SupervisionMeeting"("processId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "SupervisionSummary_meetingId_key" ON "SupervisionSummary"("meetingId");

-- CreateIndex
CREATE INDEX "SupervisionSummary_processId_kind_status_idx" ON "SupervisionSummary"("processId", "kind", "status");

-- CreateIndex
CREATE INDEX "SupervisionSummaryApproval_summaryId_idx" ON "SupervisionSummaryApproval"("summaryId");

-- CreateIndex
CREATE UNIQUE INDEX "SupervisionSummaryApproval_summaryId_participationId_key" ON "SupervisionSummaryApproval"("summaryId", "participationId");

-- CreateIndex
CREATE UNIQUE INDEX "SupervisionClosure_processId_key" ON "SupervisionClosure"("processId");

-- CreateIndex
CREATE INDEX "SupervisionPersonalOutcome_ownerUserId_createdAt_idx" ON "SupervisionPersonalOutcome"("ownerUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupervisionPersonalOutcome_processId_ownerUserId_key" ON "SupervisionPersonalOutcome"("processId", "ownerUserId");

-- CreateIndex
CREATE INDEX "SupervisionAuditEvent_processId_createdAt_idx" ON "SupervisionAuditEvent"("processId", "createdAt");

-- CreateIndex
CREATE INDEX "SupervisionAuditEvent_actorUserId_createdAt_idx" ON "SupervisionAuditEvent"("actorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "SupervisorGrant" ADD CONSTRAINT "SupervisorGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisorGrant" ADD CONSTRAINT "SupervisorGrant_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisorGrant" ADD CONSTRAINT "SupervisorGrant_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionProcess" ADD CONSTRAINT "SupervisionProcess_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionProcess" ADD CONSTRAINT "SupervisionProcess_activeContractVersionId_fkey" FOREIGN KEY ("activeContractVersionId") REFERENCES "SupervisionContractVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionContractVersion" ADD CONSTRAINT "SupervisionContractVersion_processId_fkey" FOREIGN KEY ("processId") REFERENCES "SupervisionProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionContractVersion" ADD CONSTRAINT "SupervisionContractVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionParticipation" ADD CONSTRAINT "SupervisionParticipation_processId_fkey" FOREIGN KEY ("processId") REFERENCES "SupervisionProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionParticipation" ADD CONSTRAINT "SupervisionParticipation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionParticipation" ADD CONSTRAINT "SupervisionParticipation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionContractAcceptance" ADD CONSTRAINT "SupervisionContractAcceptance_participationId_fkey" FOREIGN KEY ("participationId") REFERENCES "SupervisionParticipation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionContractAcceptance" ADD CONSTRAINT "SupervisionContractAcceptance_contractVersionId_fkey" FOREIGN KEY ("contractVersionId") REFERENCES "SupervisionContractVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionPrivateItem" ADD CONSTRAINT "SupervisionPrivateItem_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionPrivateItem" ADD CONSTRAINT "SupervisionPrivateItem_processId_fkey" FOREIGN KEY ("processId") REFERENCES "SupervisionProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionPrivateItem" ADD CONSTRAINT "SupervisionPrivateItem_sharedTopicId_fkey" FOREIGN KEY ("sharedTopicId") REFERENCES "SupervisionSharedTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey (kept on the M6 side so WellbeingOutputDraft remains unchanged)
ALTER TABLE "SupervisionPrivateItem" ADD CONSTRAINT "SupervisionPrivateItem_sourceWellbeingDraftId_fkey" FOREIGN KEY ("sourceWellbeingDraftId") REFERENCES "WellbeingOutputDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionSharedTopic" ADD CONSTRAINT "SupervisionSharedTopic_processId_fkey" FOREIGN KEY ("processId") REFERENCES "SupervisionProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionSharedTopic" ADD CONSTRAINT "SupervisionSharedTopic_authorParticipationId_fkey" FOREIGN KEY ("authorParticipationId") REFERENCES "SupervisionParticipation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionMeeting" ADD CONSTRAINT "SupervisionMeeting_processId_fkey" FOREIGN KEY ("processId") REFERENCES "SupervisionProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionMeeting" ADD CONSTRAINT "SupervisionMeeting_markedHeldByUserId_fkey" FOREIGN KEY ("markedHeldByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionSummary" ADD CONSTRAINT "SupervisionSummary_processId_fkey" FOREIGN KEY ("processId") REFERENCES "SupervisionProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionSummary" ADD CONSTRAINT "SupervisionSummary_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "SupervisionMeeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionSummary" ADD CONSTRAINT "SupervisionSummary_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionSummaryApproval" ADD CONSTRAINT "SupervisionSummaryApproval_summaryId_fkey" FOREIGN KEY ("summaryId") REFERENCES "SupervisionSummary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionSummaryApproval" ADD CONSTRAINT "SupervisionSummaryApproval_participationId_fkey" FOREIGN KEY ("participationId") REFERENCES "SupervisionParticipation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionClosure" ADD CONSTRAINT "SupervisionClosure_processId_fkey" FOREIGN KEY ("processId") REFERENCES "SupervisionProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionClosure" ADD CONSTRAINT "SupervisionClosure_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionPersonalOutcome" ADD CONSTRAINT "SupervisionPersonalOutcome_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionPersonalOutcome" ADD CONSTRAINT "SupervisionPersonalOutcome_processId_fkey" FOREIGN KEY ("processId") REFERENCES "SupervisionProcess"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionAuditEvent" ADD CONSTRAINT "SupervisionAuditEvent_processId_fkey" FOREIGN KEY ("processId") REFERENCES "SupervisionProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionAuditEvent" ADD CONSTRAINT "SupervisionAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
