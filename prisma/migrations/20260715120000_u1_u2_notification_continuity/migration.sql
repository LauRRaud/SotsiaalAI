-- U1/U2 notification and continuity core. All changes are additive. Rolling
-- back the application is safe while these nullable/defaulted columns and the
-- new table remain; destructive rollback should only drop them after the old
-- application is restored and pending notification delivery has been drained.

ALTER TABLE "User"
  ADD COLUMN "notificationEmailEnabled" BOOLEAN,
  ADD COLUMN "notificationPreferenceVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "PreInquiry"
  ADD COLUMN "nextContactOn" TEXT;

CREATE TABLE "NotificationEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "targetKind" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "emailPolicy" TEXT NOT NULL DEFAULT 'NONE',
  "emailStatus" TEXT NOT NULL DEFAULT 'NOT_REQUESTED',
  "emailAttempts" INTEGER NOT NULL DEFAULT 0,
  "emailNextAttemptAt" TIMESTAMP(3),
  "emailClaimedAt" TIMESTAMP(3),
  "emailedAt" TIMESTAMP(3),
  "emailLastErrorCode" TEXT,
  "emailMessageId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationEvent_dedupeKey_key"
  ON "NotificationEvent"("dedupeKey");

CREATE INDEX "NotificationEvent_userId_readAt_createdAt_id_idx"
  ON "NotificationEvent"("userId", "readAt", "createdAt", "id");

CREATE INDEX "NotificationEvent_emailStatus_emailNextAttemptAt_id_idx"
  ON "NotificationEvent"("emailStatus", "emailNextAttemptAt", "id");

CREATE INDEX "NotificationEvent_userId_sourceType_sourceId_readAt_idx"
  ON "NotificationEvent"("userId", "sourceType", "sourceId", "readAt");

CREATE INDEX "PreInquiry_recipientOwnerId_nextContactOn_status_idx"
  ON "PreInquiry"("recipientOwnerId", "nextContactOn", "status");

ALTER TABLE "NotificationEvent"
  ADD CONSTRAINT "NotificationEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
