-- Kovisioon persistent session core. The existing case remains the canonical
-- case record; this migration adds a one-to-one TopicSeed handoff and separates
-- shared session work from per-user private state.

-- AlterEnum
ALTER TYPE "TopicSeedStatus" ADD VALUE IF NOT EXISTS 'IN_COVISION';
ALTER TYPE "TopicSeedStatus" ADD VALUE IF NOT EXISTS 'FOLLOW_UP';
ALTER TYPE "TopicSeedStatus" ADD VALUE IF NOT EXISTS 'CLOSED';

-- AlterTable
ALTER TABLE "TopicSeed" ADD COLUMN "covisionCaseId" TEXT;

-- CreateTable
CREATE TABLE "CovisionSessionState" (
    "id" TEXT NOT NULL,
    "covisionCaseId" TEXT NOT NULL,
    "stage" INTEGER NOT NULL DEFAULT 1,
    "phase" TEXT NOT NULL DEFAULT 'waiting_room',
    "version" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "stageStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pausedAt" TIMESTAMP(3),
    "totalPausedMs" INTEGER NOT NULL DEFAULT 0,
    "settings" JSONB,
    "caseConfirmedAt" TIMESTAMP(3),
    "settingsConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CovisionSessionState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CovisionParticipantState" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "presentAt" TIMESTAMP(3),
    "roleConfirmedAt" TIMESTAMP(3),
    "agreementConfirmedAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CovisionParticipantState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CovisionWorkItem" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "stage" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'shared_draft',
    "visibility" TEXT NOT NULL DEFAULT 'shared',
    "authorParticipantId" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "sourceLabel" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CovisionWorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CovisionPrivateState" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stage" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CovisionPrivateState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CovisionStageSnapshot" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "stage" INTEGER NOT NULL,
    "phase" TEXT NOT NULL,
    "sessionVersion" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CovisionStageSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TopicSeed_covisionCaseId_key" ON "TopicSeed"("covisionCaseId");
CREATE UNIQUE INDEX "CovisionSessionState_covisionCaseId_key" ON "CovisionSessionState"("covisionCaseId");
CREATE INDEX "CovisionSessionState_stage_phase_idx" ON "CovisionSessionState"("stage", "phase");
CREATE INDEX "CovisionSessionState_updatedAt_idx" ON "CovisionSessionState"("updatedAt");
CREATE UNIQUE INDEX "CovisionParticipantState_participantId_key" ON "CovisionParticipantState"("participantId");
CREATE INDEX "CovisionParticipantState_sessionId_idx" ON "CovisionParticipantState"("sessionId");
CREATE INDEX "CovisionWorkItem_sessionId_stage_status_idx" ON "CovisionWorkItem"("sessionId", "stage", "status");
CREATE INDEX "CovisionWorkItem_authorParticipantId_idx" ON "CovisionWorkItem"("authorParticipantId");
CREATE INDEX "CovisionWorkItem_visibility_idx" ON "CovisionWorkItem"("visibility");
CREATE UNIQUE INDEX "CovisionPrivateState_sessionId_userId_stage_kind_key" ON "CovisionPrivateState"("sessionId", "userId", "stage", "kind");
CREATE INDEX "CovisionPrivateState_userId_updatedAt_idx" ON "CovisionPrivateState"("userId", "updatedAt");
CREATE INDEX "CovisionPrivateState_sessionId_stage_idx" ON "CovisionPrivateState"("sessionId", "stage");
CREATE UNIQUE INDEX "CovisionStageSnapshot_sessionId_stage_key" ON "CovisionStageSnapshot"("sessionId", "stage");
CREATE INDEX "CovisionStageSnapshot_completedById_idx" ON "CovisionStageSnapshot"("completedById");
CREATE INDEX "CovisionStageSnapshot_completedAt_idx" ON "CovisionStageSnapshot"("completedAt");

-- AddForeignKey
ALTER TABLE "TopicSeed" ADD CONSTRAINT "TopicSeed_covisionCaseId_fkey" FOREIGN KEY ("covisionCaseId") REFERENCES "CovisionCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CovisionSessionState" ADD CONSTRAINT "CovisionSessionState_covisionCaseId_fkey" FOREIGN KEY ("covisionCaseId") REFERENCES "CovisionCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CovisionParticipantState" ADD CONSTRAINT "CovisionParticipantState_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CovisionSessionState"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CovisionParticipantState" ADD CONSTRAINT "CovisionParticipantState_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "CovisionParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CovisionWorkItem" ADD CONSTRAINT "CovisionWorkItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CovisionSessionState"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CovisionWorkItem" ADD CONSTRAINT "CovisionWorkItem_authorParticipantId_fkey" FOREIGN KEY ("authorParticipantId") REFERENCES "CovisionParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CovisionPrivateState" ADD CONSTRAINT "CovisionPrivateState_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CovisionSessionState"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CovisionPrivateState" ADD CONSTRAINT "CovisionPrivateState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CovisionStageSnapshot" ADD CONSTRAINT "CovisionStageSnapshot_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CovisionSessionState"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CovisionStageSnapshot" ADD CONSTRAINT "CovisionStageSnapshot_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
