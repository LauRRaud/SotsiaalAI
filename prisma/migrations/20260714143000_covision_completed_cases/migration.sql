CREATE TYPE "CovisionClosureLifecycleStatus" AS ENUM (
  'FOLLOW_UP_PENDING',
  'DECISION_PENDING',
  'CLOSED',
  'CONTINUATION_PENDING',
  'ARCHIVED'
);

CREATE TYPE "CovisionFollowUpStatus" AS ENUM (
  'SCHEDULED',
  'COMPLETED',
  'RESCHEDULED',
  'CANCELLED'
);

CREATE TYPE "CovisionPracticeCandidateStatus" AS ENUM (
  'NONE',
  'PRIVATE_DRAFT',
  'REVIEW_PENDING',
  'PUBLISHED'
);

CREATE TYPE "CovisionPackageStatus" AS ENUM (
  'NOT_CREATED',
  'CONFIRMED'
);

CREATE TYPE "CovisionRetentionStatus" AS ENUM (
  'RETAINED_SELECTED_OUTPUT',
  'DELETION_PENDING',
  'DELETED',
  'ERROR'
);

CREATE TABLE "CovisionClosure" (
  "id" TEXT NOT NULL,
  "covisionCaseId" TEXT NOT NULL,
  "sourceTopicSeedId" TEXT,
  "continuationTopicSeedId" TEXT,
  "ownerId" TEXT NOT NULL,
  "assignedFollowUpUserId" TEXT,
  "closedById" TEXT NOT NULL,
  "generalizedTitle" TEXT NOT NULL,
  "workFocus" TEXT NOT NULL,
  "selectedDirection" TEXT NOT NULL,
  "nextStep" TEXT NOT NULL,
  "timeframe" TEXT NOT NULL,
  "progressMarker" TEXT NOT NULL,
  "sessionStartedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ownerConfirmedAt" TIMESTAMP(3) NOT NULL,
  "lifecycleStatus" "CovisionClosureLifecycleStatus" NOT NULL DEFAULT 'FOLLOW_UP_PENDING',
  "practiceStatus" "CovisionPracticeCandidateStatus" NOT NULL DEFAULT 'NONE',
  "packageStatus" "CovisionPackageStatus" NOT NULL DEFAULT 'NOT_CREATED',
  "retentionStatus" "CovisionRetentionStatus" NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CovisionClosure_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CovisionFollowUp" (
  "id" TEXT NOT NULL,
  "closureId" TEXT NOT NULL,
  "assignedToUserId" TEXT,
  "status" "CovisionFollowUpStatus" NOT NULL DEFAULT 'SCHEDULED',
  "scheduleLabel" TEXT NOT NULL,
  "scheduledFor" TIMESTAMP(3),
  "responsibleParty" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "whatWasDone" TEXT,
  "whatChanged" TEXT,
  "learning" TEXT,
  "resourceUsed" TEXT,
  "conditionChanged" TEXT,
  "completedById" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CovisionFollowUp_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CovisionOwnerPackage" (
  "id" TEXT NOT NULL,
  "closureId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "status" "CovisionPackageStatus" NOT NULL DEFAULT 'CONFIRMED',
  "content" JSONB NOT NULL,
  "confirmedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CovisionOwnerPackage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CovisionClosure_covisionCaseId_key" ON "CovisionClosure"("covisionCaseId");
CREATE UNIQUE INDEX "CovisionClosure_continuationTopicSeedId_key" ON "CovisionClosure"("continuationTopicSeedId");
CREATE INDEX "CovisionClosure_ownerId_updatedAt_idx" ON "CovisionClosure"("ownerId", "updatedAt");
CREATE INDEX "CovisionClosure_assignedFollowUpUserId_updatedAt_idx" ON "CovisionClosure"("assignedFollowUpUserId", "updatedAt");
CREATE INDEX "CovisionClosure_sourceTopicSeedId_idx" ON "CovisionClosure"("sourceTopicSeedId");
CREATE INDEX "CovisionClosure_lifecycleStatus_closedAt_idx" ON "CovisionClosure"("lifecycleStatus", "closedAt");
CREATE INDEX "CovisionClosure_practiceStatus_idx" ON "CovisionClosure"("practiceStatus");

CREATE INDEX "CovisionFollowUp_closureId_createdAt_idx" ON "CovisionFollowUp"("closureId", "createdAt");
CREATE INDEX "CovisionFollowUp_assignedToUserId_status_idx" ON "CovisionFollowUp"("assignedToUserId", "status");
CREATE INDEX "CovisionFollowUp_status_scheduledFor_idx" ON "CovisionFollowUp"("status", "scheduledFor");

CREATE UNIQUE INDEX "CovisionOwnerPackage_closureId_key" ON "CovisionOwnerPackage"("closureId");
CREATE INDEX "CovisionOwnerPackage_ownerId_updatedAt_idx" ON "CovisionOwnerPackage"("ownerId", "updatedAt");

ALTER TABLE "CovisionClosure"
  ADD CONSTRAINT "CovisionClosure_covisionCaseId_fkey"
  FOREIGN KEY ("covisionCaseId") REFERENCES "CovisionCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CovisionClosure"
  ADD CONSTRAINT "CovisionClosure_sourceTopicSeedId_fkey"
  FOREIGN KEY ("sourceTopicSeedId") REFERENCES "TopicSeed"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CovisionClosure"
  ADD CONSTRAINT "CovisionClosure_continuationTopicSeedId_fkey"
  FOREIGN KEY ("continuationTopicSeedId") REFERENCES "TopicSeed"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CovisionClosure"
  ADD CONSTRAINT "CovisionClosure_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CovisionClosure"
  ADD CONSTRAINT "CovisionClosure_assignedFollowUpUserId_fkey"
  FOREIGN KEY ("assignedFollowUpUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CovisionClosure"
  ADD CONSTRAINT "CovisionClosure_closedById_fkey"
  FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CovisionFollowUp"
  ADD CONSTRAINT "CovisionFollowUp_closureId_fkey"
  FOREIGN KEY ("closureId") REFERENCES "CovisionClosure"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CovisionFollowUp"
  ADD CONSTRAINT "CovisionFollowUp_assignedToUserId_fkey"
  FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CovisionFollowUp"
  ADD CONSTRAINT "CovisionFollowUp_completedById_fkey"
  FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CovisionOwnerPackage"
  ADD CONSTRAINT "CovisionOwnerPackage_closureId_fkey"
  FOREIGN KEY ("closureId") REFERENCES "CovisionClosure"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CovisionOwnerPackage"
  ADD CONSTRAINT "CovisionOwnerPackage_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
