-- Persistent privacy/audit trail for sensitive data operations.
CREATE TABLE "DataAuditLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT,
    "targetUserId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "meta" JSONB,

    CONSTRAINT "DataAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DataAuditLog_createdAt_idx" ON "DataAuditLog"("createdAt");
CREATE INDEX "DataAuditLog_actorUserId_createdAt_idx" ON "DataAuditLog"("actorUserId", "createdAt");
CREATE INDEX "DataAuditLog_targetUserId_createdAt_idx" ON "DataAuditLog"("targetUserId", "createdAt");
CREATE INDEX "DataAuditLog_action_createdAt_idx" ON "DataAuditLog"("action", "createdAt");

-- Durable deletion work ledger. Kept independent from deleted user/document rows.
CREATE TABLE "DataDeletionJob" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "actorUserId" TEXT,
    "targetUserId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "storagePath" TEXT,
    "externalRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,

    CONSTRAINT "DataDeletionJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DataDeletionJob_status_createdAt_idx" ON "DataDeletionJob"("status", "createdAt");
CREATE INDEX "DataDeletionJob_targetUserId_createdAt_idx" ON "DataDeletionJob"("targetUserId", "createdAt");
CREATE INDEX "DataDeletionJob_resourceType_resourceId_idx" ON "DataDeletionJob"("resourceType", "resourceId");
