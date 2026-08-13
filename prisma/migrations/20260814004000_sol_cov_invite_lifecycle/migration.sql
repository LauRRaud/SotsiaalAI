-- SOL-COV-01/02/03: invitation identity and readiness must have a terminal,
-- auditable lifecycle independent of a reusable email address.

ALTER TABLE "CovisionParticipant"
  ADD COLUMN "inviteExpiresAt" TIMESTAMP(3),
  ADD COLUMN "decisionAt" TIMESTAMP(3),
  ADD COLUMN "revokedAt" TIMESTAMP(3),
  ADD COLUMN "revokedByUserId" TEXT,
  ADD COLUMN "identityErasedAt" TIMESTAMP(3);

ALTER TABLE "CovisionCase"
  ADD COLUMN "ownerRoleSnapshot" TEXT,
  ADD COLUMN "ownerErasedAt" TIMESTAMP(3),
  ALTER COLUMN "ownerId" DROP NOT NULL;

ALTER TABLE "CovisionClosure"
  ADD COLUMN "ownerRoleSnapshot" TEXT,
  ADD COLUMN "ownerErasedAt" TIMESTAMP(3),
  ALTER COLUMN "ownerId" DROP NOT NULL;

ALTER TABLE "CovisionCase" DROP CONSTRAINT "CovisionCase_ownerId_fkey";
ALTER TABLE "CovisionCase"
  ADD CONSTRAINT "CovisionCase_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CovisionClosure" DROP CONSTRAINT "CovisionClosure_ownerId_fkey";
ALTER TABLE "CovisionClosure"
  ADD CONSTRAINT "CovisionClosure_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "CovisionParticipant"
SET "inviteExpiresAt" = "createdAt" + INTERVAL '14 days'
WHERE "inviteStatus" = 'INVITED' AND "inviteExpiresAt" IS NULL;

UPDATE "CovisionParticipant"
SET "decisionAt" = COALESCE("decisionAt", "updatedAt")
WHERE "inviteStatus" = 'ACCEPTED';

-- Existing accepted rows predate the readiness gate. Preserve their current
-- access explicitly; all new acceptance goes through the monotone chain.
UPDATE "CovisionParticipantState" AS state
SET
  "roleConfirmedAt" = COALESCE(state."roleConfirmedAt", participant."updatedAt"),
  "agreementConfirmedAt" = COALESCE(state."agreementConfirmedAt", participant."updatedAt"),
  "readyAt" = COALESCE(state."readyAt", participant."updatedAt")
FROM "CovisionParticipant" AS participant
WHERE state."participantId" = participant."id"
  AND participant."inviteStatus" = 'ACCEPTED';

ALTER TABLE "CovisionParticipant"
  ADD CONSTRAINT "CovisionParticipant_revokedByUserId_fkey"
    FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "CovisionParticipant_inviteStatus_inviteExpiresAt_idx"
  ON "CovisionParticipant"("inviteStatus", "inviteExpiresAt");

CREATE INDEX "CovisionParticipant_revokedByUserId_idx"
  ON "CovisionParticipant"("revokedByUserId");

CREATE TABLE "CovisionInviteDelivery" (
  "id" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "recipientEmail" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "messageId" TEXT NOT NULL,
  "lastErrorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CovisionInviteDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CovisionInviteDelivery_participantId_fkey"
    FOREIGN KEY ("participantId") REFERENCES "CovisionParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CovisionInviteDelivery_participantId_key"
  ON "CovisionInviteDelivery"("participantId");
CREATE UNIQUE INDEX "CovisionInviteDelivery_messageId_key"
  ON "CovisionInviteDelivery"("messageId");
CREATE INDEX "CovisionInviteDelivery_status_nextAttemptAt_id_idx"
  ON "CovisionInviteDelivery"("status", "nextAttemptAt", "id");

CREATE TABLE "CovisionAuditEvent" (
  "id" TEXT NOT NULL,
  "covisionCaseId" TEXT NOT NULL,
  "participantId" TEXT,
  "actorUserId" TEXT,
  "actorRoleSnapshot" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CovisionAuditEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CovisionAuditEvent_covisionCaseId_fkey"
    FOREIGN KEY ("covisionCaseId") REFERENCES "CovisionCase"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CovisionAuditEvent_participantId_fkey"
    FOREIGN KEY ("participantId") REFERENCES "CovisionParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "CovisionAuditEvent_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CovisionAuditEvent_idempotencyKey_key" ON "CovisionAuditEvent"("idempotencyKey");
CREATE INDEX "CovisionAuditEvent_covisionCaseId_occurredAt_id_idx"
  ON "CovisionAuditEvent"("covisionCaseId", "occurredAt", "id");
CREATE INDEX "CovisionAuditEvent_participantId_occurredAt_idx"
  ON "CovisionAuditEvent"("participantId", "occurredAt");
CREATE INDEX "CovisionAuditEvent_actorUserId_occurredAt_idx"
  ON "CovisionAuditEvent"("actorUserId", "occurredAt");
CREATE INDEX "CovisionAuditEvent_action_occurredAt_idx"
  ON "CovisionAuditEvent"("action", "occurredAt");
