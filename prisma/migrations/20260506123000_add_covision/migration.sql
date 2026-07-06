CREATE TYPE "CovisionCaseStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUMMARY_READY', 'CLOSED', 'ARCHIVED');
CREATE TYPE "CovisionVisibility" AS ENUM ('PRIVATE', 'ORGANIZATION');
CREATE TYPE "CovisionParticipantRole" AS ENUM ('OWNER', 'PARTICIPANT', 'OBSERVER', 'CO_MODERATOR', 'SUMMARY_REVIEWER');
CREATE TYPE "CovisionInviteStatus" AS ENUM ('INVITED', 'ACCEPTED', 'DECLINED', 'EXPIRED');
CREATE TYPE "CovisionFactorType" AS ENUM ('RISK', 'PROTECTIVE');
CREATE TYPE "CovisionSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "CovisionStepStatus" AS ENUM ('CONFIRMED', 'NEEDS_CLARIFICATION');
CREATE TYPE "CovisionMessageType" AS ENUM ('FREE_TEXT', 'OBSERVATION', 'QUESTION', 'RISK', 'PROTECTIVE_FACTOR', 'NEXT_STEP', 'EXPERIENCE', 'SOURCE_NOTE', 'DOCUMENTATION_NOTE', 'NETWORK_NOTE');
CREATE TYPE "EffectivePracticeStatus" AS ENUM ('DRAFT', 'ANONYMITY_CHECK', 'REVIEW', 'PUBLISHED', 'HIDDEN', 'ARCHIVED');

CREATE TABLE "CovisionCase" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "anonymizedDescription" TEXT,
  "centralQuestion" TEXT,
  "expectedHelpTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "topics" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "CovisionCaseStatus" NOT NULL DEFAULT 'DRAFT',
  "visibility" "CovisionVisibility" NOT NULL DEFAULT 'PRIVATE',
  "sourcePreInquiryId" TEXT,
  "anonymityConfirmedAt" TIMESTAMP(3),
  "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CovisionCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CovisionJourneyStep" (
  "id" TEXT NOT NULL,
  "covisionCaseId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT,
  "description" TEXT,
  "relatedPartyIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "order" INTEGER NOT NULL DEFAULT 0,
  "dateLabel" TEXT,
  "notes" TEXT,
  "status" "CovisionStepStatus" NOT NULL DEFAULT 'NEEDS_CLARIFICATION',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CovisionJourneyStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CovisionParty" (
  "id" TEXT NOT NULL,
  "covisionCaseId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "roleDescription" TEXT,
  "involvementStatus" TEXT,
  "cooperationStatus" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CovisionParty_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CovisionRiskFactor" (
  "id" TEXT NOT NULL,
  "covisionCaseId" TEXT NOT NULL,
  "type" "CovisionFactorType" NOT NULL,
  "label" TEXT NOT NULL,
  "severity" "CovisionSeverity" NOT NULL DEFAULT 'MEDIUM',
  "note" TEXT,
  "needsAttention" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CovisionRiskFactor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CovisionParticipant" (
  "id" TEXT NOT NULL,
  "covisionCaseId" TEXT NOT NULL,
  "userId" TEXT,
  "email" TEXT,
  "role" "CovisionParticipantRole" NOT NULL DEFAULT 'PARTICIPANT',
  "inviteStatus" "CovisionInviteStatus" NOT NULL DEFAULT 'INVITED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CovisionParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CovisionMessage" (
  "id" TEXT NOT NULL,
  "covisionCaseId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "messageType" "CovisionMessageType" NOT NULL DEFAULT 'FREE_TEXT',
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "CovisionMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CovisionSummary" (
  "id" TEXT NOT NULL,
  "covisionCaseId" TEXT NOT NULL,
  "content" TEXT,
  "keyObservations" TEXT,
  "questions" TEXT,
  "risks" TEXT,
  "protectiveFactors" TEXT,
  "possibleNextSteps" TEXT,
  "ethicalNotes" TEXT,
  "documentationNotes" TEXT,
  "networkNotes" TEXT,
  "takeaways" TEXT,
  "openQuestions" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CovisionSummary_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EffectivePractice" (
  "id" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "sourceCovisionCaseId" TEXT,
  "title" TEXT NOT NULL,
  "background" TEXT,
  "mainChallenge" TEXT,
  "whatHelped" TEXT,
  "networkOrServiceRole" TEXT,
  "outcome" TEXT,
  "learningPoints" TEXT,
  "limitations" TEXT,
  "sources" TEXT,
  "topics" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "EffectivePracticeStatus" NOT NULL DEFAULT 'DRAFT',
  "anonymityCheckedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EffectivePractice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CovisionCase_ownerId_updatedAt_idx" ON "CovisionCase"("ownerId", "updatedAt");
CREATE INDEX "CovisionCase_sourcePreInquiryId_idx" ON "CovisionCase"("sourcePreInquiryId");
CREATE INDEX "CovisionCase_status_idx" ON "CovisionCase"("status");
CREATE INDEX "CovisionCase_visibility_idx" ON "CovisionCase"("visibility");
CREATE INDEX "CovisionCase_lastActivityAt_idx" ON "CovisionCase"("lastActivityAt");

CREATE INDEX "CovisionJourneyStep_covisionCaseId_order_idx" ON "CovisionJourneyStep"("covisionCaseId", "order");

CREATE INDEX "CovisionParty_covisionCaseId_idx" ON "CovisionParty"("covisionCaseId");
CREATE INDEX "CovisionParty_category_idx" ON "CovisionParty"("category");
CREATE INDEX "CovisionParty_type_idx" ON "CovisionParty"("type");

CREATE INDEX "CovisionRiskFactor_covisionCaseId_type_idx" ON "CovisionRiskFactor"("covisionCaseId", "type");
CREATE INDEX "CovisionRiskFactor_severity_idx" ON "CovisionRiskFactor"("severity");

CREATE UNIQUE INDEX "CovisionParticipant_covisionCaseId_userId_key" ON "CovisionParticipant"("covisionCaseId", "userId");
CREATE UNIQUE INDEX "CovisionParticipant_covisionCaseId_email_key" ON "CovisionParticipant"("covisionCaseId", "email");
CREATE INDEX "CovisionParticipant_userId_idx" ON "CovisionParticipant"("userId");
CREATE INDEX "CovisionParticipant_email_idx" ON "CovisionParticipant"("email");
CREATE INDEX "CovisionParticipant_inviteStatus_idx" ON "CovisionParticipant"("inviteStatus");

CREATE INDEX "CovisionMessage_covisionCaseId_createdAt_idx" ON "CovisionMessage"("covisionCaseId", "createdAt");
CREATE INDEX "CovisionMessage_authorId_idx" ON "CovisionMessage"("authorId");
CREATE INDEX "CovisionMessage_messageType_idx" ON "CovisionMessage"("messageType");

CREATE UNIQUE INDEX "CovisionSummary_covisionCaseId_key" ON "CovisionSummary"("covisionCaseId");

CREATE INDEX "EffectivePractice_authorId_updatedAt_idx" ON "EffectivePractice"("authorId", "updatedAt");
CREATE INDEX "EffectivePractice_sourceCovisionCaseId_idx" ON "EffectivePractice"("sourceCovisionCaseId");
CREATE INDEX "EffectivePractice_status_idx" ON "EffectivePractice"("status");
CREATE INDEX "EffectivePractice_createdAt_idx" ON "EffectivePractice"("createdAt");

ALTER TABLE "CovisionCase" ADD CONSTRAINT "CovisionCase_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CovisionCase" ADD CONSTRAINT "CovisionCase_sourcePreInquiryId_fkey" FOREIGN KEY ("sourcePreInquiryId") REFERENCES "PreInquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CovisionJourneyStep" ADD CONSTRAINT "CovisionJourneyStep_covisionCaseId_fkey" FOREIGN KEY ("covisionCaseId") REFERENCES "CovisionCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CovisionParty" ADD CONSTRAINT "CovisionParty_covisionCaseId_fkey" FOREIGN KEY ("covisionCaseId") REFERENCES "CovisionCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CovisionRiskFactor" ADD CONSTRAINT "CovisionRiskFactor_covisionCaseId_fkey" FOREIGN KEY ("covisionCaseId") REFERENCES "CovisionCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CovisionParticipant" ADD CONSTRAINT "CovisionParticipant_covisionCaseId_fkey" FOREIGN KEY ("covisionCaseId") REFERENCES "CovisionCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CovisionParticipant" ADD CONSTRAINT "CovisionParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CovisionMessage" ADD CONSTRAINT "CovisionMessage_covisionCaseId_fkey" FOREIGN KEY ("covisionCaseId") REFERENCES "CovisionCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CovisionMessage" ADD CONSTRAINT "CovisionMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CovisionSummary" ADD CONSTRAINT "CovisionSummary_covisionCaseId_fkey" FOREIGN KEY ("covisionCaseId") REFERENCES "CovisionCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EffectivePractice" ADD CONSTRAINT "EffectivePractice_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EffectivePractice" ADD CONSTRAINT "EffectivePractice_sourceCovisionCaseId_fkey" FOREIGN KEY ("sourceCovisionCaseId") REFERENCES "CovisionCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
