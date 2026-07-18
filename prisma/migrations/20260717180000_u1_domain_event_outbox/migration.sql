-- U1 DomainEvent outbox and notification-center state. This migration is
-- additive and intentionally performs no backfill of existing notifications.

CREATE TABLE "DomainEvent" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "actorKind" TEXT NOT NULL,
  "actorUserId" TEXT,
  "sourceFeature" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "workspaceKind" TEXT,
  "workspaceId" TEXT,
  "audienceRule" TEXT NOT NULL,
  "audienceHint" JSONB,
  "visibilityClass" TEXT NOT NULL DEFAULT 'personal',
  "actionKind" TEXT NOT NULL,
  "actionTarget" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "retentionClass" TEXT NOT NULL DEFAULT 'standard90',
  "meta" JSONB,
  "projectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DomainEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "NotificationEvent"
  ADD COLUMN "eventId" TEXT,
  ADD COLUMN "dismissedAt" TIMESTAMP(3),
  ADD COLUMN "workspaceKind" TEXT,
  ADD COLUMN "workspaceId" TEXT;

CREATE UNIQUE INDEX "DomainEvent_idempotencyKey_key"
  ON "DomainEvent"("idempotencyKey");
CREATE INDEX "DomainEvent_projectedAt_id_idx"
  ON "DomainEvent"("projectedAt", "id");
CREATE INDEX "DomainEvent_workspaceKind_workspaceId_occurredAt_idx"
  ON "DomainEvent"("workspaceKind", "workspaceId", "occurredAt");
CREATE INDEX "DomainEvent_sourceType_sourceId_occurredAt_idx"
  ON "DomainEvent"("sourceType", "sourceId", "occurredAt");
CREATE INDEX "DomainEvent_retentionClass_occurredAt_idx"
  ON "DomainEvent"("retentionClass", "occurredAt");
CREATE INDEX "DomainEvent_actorUserId_occurredAt_idx"
  ON "DomainEvent"("actorUserId", "occurredAt");
CREATE INDEX "NotificationEvent_eventId_idx"
  ON "NotificationEvent"("eventId");
CREATE INDEX "NotificationEvent_userId_dismissedAt_readAt_createdAt_idx"
  ON "NotificationEvent"("userId", "dismissedAt", "readAt", "createdAt");

ALTER TABLE "DomainEvent"
  ADD CONSTRAINT "DomainEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
