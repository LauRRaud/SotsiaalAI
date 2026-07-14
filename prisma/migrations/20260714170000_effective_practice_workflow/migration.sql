-- Production-safe effective-practice workflow. This migration creates the new
-- workflow structures. The following 20260714171000 migration quarantines every
-- legacy publication before any row can enter the immutable-version public flow.

ALTER TYPE "EffectivePracticeStatus" ADD VALUE IF NOT EXISTS 'SUBMITTED';
ALTER TYPE "EffectivePracticeStatus" ADD VALUE IF NOT EXISTS 'IN_REVIEW';
ALTER TYPE "EffectivePracticeStatus" ADD VALUE IF NOT EXISTS 'NEEDS_CHANGES';
ALTER TYPE "EffectivePracticeStatus" ADD VALUE IF NOT EXISTS 'READY_TO_PUBLISH';
ALTER TYPE "EffectivePracticeStatus" ADD VALUE IF NOT EXISTS 'RE_REVIEW';

CREATE TYPE "PracticeCapabilityType" AS ENUM ('REVIEWER', 'ETHICS', 'EDITOR', 'APPROVER');
CREATE TYPE "EffectivePracticeRiskLevel" AS ENUM ('LOW', 'HIGH');
CREATE TYPE "EffectivePracticeReviewDecision" AS ENUM ('PENDING', 'APPROVED', 'NEEDS_CHANGES', 'DECLINED', 'CONFLICT');
CREATE TYPE "EffectivePracticeConflictStatus" AS ENUM ('NONE', 'MANAGEABLE', 'DECLINED');
CREATE TYPE "EffectivePracticeApplicationStatus" AS ENUM ('DRAFT', 'WAITING_FOR_REVIEW', 'SUBMITTED', 'ACCEPTED', 'NEEDS_CHANGES', 'REJECTED');
CREATE TYPE "PracticeCapabilityAuditAction" AS ENUM ('GRANTED', 'REVOKED');
CREATE TYPE "EffectivePracticeReviewAssignmentStatus" AS ENUM ('ASSIGNED', 'COMPLETED', 'DECLINED');

ALTER TABLE "EffectivePractice"
  ADD COLUMN "publicId" TEXT,
  ADD COLUMN "sourceClosureId" TEXT,
  ADD COLUMN "summary" TEXT,
  ADD COLUMN "suitableContext" TEXT,
  ADD COLUMN "conditions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "steps" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "practiceType" TEXT,
  ADD COLUMN "targetGroups" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "environments" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "maturityLevel" TEXT NOT NULL DEFAULT 'practice_candidate',
  ADD COLUMN "riskLevel" "EffectivePracticeRiskLevel" NOT NULL DEFAULT 'LOW',
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "contentVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "publishedVersion" INTEGER,
  ADD COLUMN "ownerConfirmedNoIdentifiersAt" TIMESTAMP(3),
  ADD COLUMN "ownerConfirmedNoIdentifiersVersion" INTEGER,
  ADD COLUMN "anonymityCheckedVersion" INTEGER,
  ADD COLUMN "professionalReviewedAt" TIMESTAMP(3),
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "nextReviewAt" TIMESTAMP(3);

ALTER TABLE "EffectivePractice"
  DROP CONSTRAINT IF EXISTS "EffectivePractice_authorId_fkey",
  ALTER COLUMN "authorId" DROP NOT NULL,
  ADD CONSTRAINT "EffectivePractice_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Public identifiers are deliberately distinct from internal row ids.
UPDATE "EffectivePractice"
SET "publicId" = md5(random()::text || clock_timestamp()::text || "id")
WHERE "publicId" IS NULL;
ALTER TABLE "EffectivePractice" ALTER COLUMN "publicId" SET NOT NULL;

CREATE TABLE "PracticeCapability" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "grantedByUserId" TEXT,
  "type" "PracticeCapabilityType" NOT NULL,
  "scope" TEXT NOT NULL DEFAULT '',
  "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validUntil" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "grantBasis" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PracticeCapability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EffectivePracticeReview" (
  "id" TEXT NOT NULL,
  "practiceId" TEXT NOT NULL,
  "reviewerId" TEXT,
  "capabilityType" "PracticeCapabilityType" NOT NULL,
  "scope" TEXT NOT NULL DEFAULT '',
  "reviewedVersion" INTEGER NOT NULL,
  "decision" "EffectivePracticeReviewDecision" NOT NULL DEFAULT 'PENDING',
  "conflictStatus" "EffectivePracticeConflictStatus" NOT NULL DEFAULT 'NONE',
  "authorFeedback" TEXT,
  "privateNotes" TEXT,
  "conflictNote" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EffectivePracticeReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EffectivePracticeVersion" (
  "id" TEXT NOT NULL,
  "practiceId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "publicSnapshot" JSONB NOT NULL,
  "professionalReviewRoles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "publishedById" TEXT,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "nextReviewAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EffectivePracticeVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EffectivePracticeReviewAssignment" (
  "id" TEXT NOT NULL,
  "practiceId" TEXT NOT NULL,
  "reviewerId" TEXT,
  "capabilityType" "PracticeCapabilityType" NOT NULL,
  "scope" TEXT NOT NULL DEFAULT '',
  "contentVersion" INTEGER NOT NULL,
  "status" "EffectivePracticeReviewAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EffectivePracticeReviewAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EffectivePracticeApplication" (
  "id" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "practiceId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "reviewedById" TEXT,
  "assignedReviewerId" TEXT,
  "assignedCapabilityType" "PracticeCapabilityType",
  "versionUsed" INTEGER NOT NULL,
  "practiceSnapshot" JSONB NOT NULL,
  "context" TEXT NOT NULL,
  "targetGroup" TEXT NOT NULL,
  "adaptations" TEXT NOT NULL,
  "whatWorked" TEXT NOT NULL,
  "whatDidNot" TEXT NOT NULL,
  "limitationOrRisk" TEXT NOT NULL,
  "followUpAt" TIMESTAMP(3),
  "needsReview" BOOLEAN NOT NULL DEFAULT false,
  "status" "EffectivePracticeApplicationStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 0,
  "reviewNote" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EffectivePracticeApplication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PracticeCapabilityAudit" (
  "id" TEXT NOT NULL,
  "targetUserId" TEXT,
  "actorUserId" TEXT,
  "action" "PracticeCapabilityAuditAction" NOT NULL,
  "type" "PracticeCapabilityType" NOT NULL,
  "scope" TEXT NOT NULL DEFAULT '',
  "validUntil" TIMESTAMP(3),
  "grantBasis" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PracticeCapabilityAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EffectivePracticeAuditEvent" (
  "id" TEXT NOT NULL,
  "practiceId" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT,
  "contentVersion" INTEGER NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EffectivePracticeAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EffectivePractice_publicId_key" ON "EffectivePractice"("publicId");
CREATE UNIQUE INDEX "EffectivePractice_sourceClosureId_key" ON "EffectivePractice"("sourceClosureId");
CREATE INDEX "EffectivePractice_status_publishedAt_idx" ON "EffectivePractice"("status", "publishedAt");
CREATE INDEX "EffectivePractice_riskLevel_status_idx" ON "EffectivePractice"("riskLevel", "status");

CREATE UNIQUE INDEX "PracticeCapability_userId_type_scope_key" ON "PracticeCapability"("userId", "type", "scope");
CREATE INDEX "PracticeCapability_userId_revokedAt_validUntil_idx" ON "PracticeCapability"("userId", "revokedAt", "validUntil");
CREATE INDEX "PracticeCapability_type_scope_idx" ON "PracticeCapability"("type", "scope");

CREATE INDEX "EffectivePracticeReview_practiceId_reviewedVersion_decision_idx"
  ON "EffectivePracticeReview"("practiceId", "reviewedVersion", "decision");
CREATE INDEX "EffectivePracticeReview_reviewerId_decision_updatedAt_idx"
  ON "EffectivePracticeReview"("reviewerId", "decision", "updatedAt");
CREATE UNIQUE INDEX "EffectivePracticeReviewAssignment_practiceId_reviewerId_capabilityType_contentVersion_key"
  ON "EffectivePracticeReviewAssignment"("practiceId", "reviewerId", "capabilityType", "contentVersion");
CREATE INDEX "EffectivePracticeReviewAssignment_reviewerId_status_updatedAt_idx"
  ON "EffectivePracticeReviewAssignment"("reviewerId", "status", "updatedAt");
CREATE INDEX "EffectivePracticeReviewAssignment_practiceId_contentVersion_status_idx"
  ON "EffectivePracticeReviewAssignment"("practiceId", "contentVersion", "status");

CREATE UNIQUE INDEX "EffectivePracticeVersion_practiceId_version_key" ON "EffectivePracticeVersion"("practiceId", "version");
CREATE INDEX "EffectivePracticeVersion_practiceId_publishedAt_idx" ON "EffectivePracticeVersion"("practiceId", "publishedAt");

CREATE INDEX "EffectivePracticeApplication_practiceId_status_createdAt_idx"
  ON "EffectivePracticeApplication"("practiceId", "status", "createdAt");
CREATE INDEX "EffectivePracticeApplication_authorId_updatedAt_idx"
  ON "EffectivePracticeApplication"("authorId", "updatedAt");
CREATE INDEX "EffectivePracticeApplication_assignedReviewerId_status_createdAt_idx"
  ON "EffectivePracticeApplication"("assignedReviewerId", "status", "createdAt");
CREATE INDEX "EffectivePracticeApplication_needsReview_status_idx"
  ON "EffectivePracticeApplication"("needsReview", "status");
CREATE UNIQUE INDEX "EffectivePracticeApplication_publicId_key" ON "EffectivePracticeApplication"("publicId");
CREATE INDEX "PracticeCapabilityAudit_targetUserId_createdAt_idx" ON "PracticeCapabilityAudit"("targetUserId", "createdAt");
CREATE INDEX "PracticeCapabilityAudit_actorUserId_createdAt_idx" ON "PracticeCapabilityAudit"("actorUserId", "createdAt");
CREATE INDEX "EffectivePracticeAuditEvent_practiceId_createdAt_idx" ON "EffectivePracticeAuditEvent"("practiceId", "createdAt");
CREATE INDEX "EffectivePracticeAuditEvent_actorId_createdAt_idx" ON "EffectivePracticeAuditEvent"("actorId", "createdAt");

ALTER TABLE "EffectivePractice"
  ADD CONSTRAINT "EffectivePractice_sourceClosureId_fkey"
  FOREIGN KEY ("sourceClosureId") REFERENCES "CovisionClosure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PracticeCapability"
  ADD CONSTRAINT "PracticeCapability_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PracticeCapability_grantedByUserId_fkey"
  FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EffectivePracticeReview"
  ADD CONSTRAINT "EffectivePracticeReview_practiceId_fkey"
  FOREIGN KEY ("practiceId") REFERENCES "EffectivePractice"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "EffectivePracticeReview_reviewerId_fkey"
  FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EffectivePracticeVersion"
  ADD CONSTRAINT "EffectivePracticeVersion_practiceId_fkey"
  FOREIGN KEY ("practiceId") REFERENCES "EffectivePractice"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "EffectivePracticeVersion_publishedById_fkey"
  FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EffectivePracticeReviewAssignment"
  ADD CONSTRAINT "EffectivePracticeReviewAssignment_practiceId_fkey"
  FOREIGN KEY ("practiceId") REFERENCES "EffectivePractice"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "EffectivePracticeReviewAssignment_reviewerId_fkey"
  FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EffectivePracticeApplication"
  ADD CONSTRAINT "EffectivePracticeApplication_practiceId_fkey"
  FOREIGN KEY ("practiceId") REFERENCES "EffectivePractice"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "EffectivePracticeApplication_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "EffectivePracticeApplication_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "EffectivePracticeApplication_assignedReviewerId_fkey"
  FOREIGN KEY ("assignedReviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PracticeCapabilityAudit"
  ADD CONSTRAINT "PracticeCapabilityAudit_targetUserId_fkey"
  FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "PracticeCapabilityAudit_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EffectivePracticeAuditEvent"
  ADD CONSTRAINT "EffectivePracticeAuditEvent_practiceId_fkey"
  FOREIGN KEY ("practiceId") REFERENCES "EffectivePractice"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "EffectivePracticeAuditEvent_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
