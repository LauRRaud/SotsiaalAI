-- T16 EXPORT-V1: owner-private portable data-copy jobs. The partial index is
-- the final race guard: one user can have one queued/running/ready ZIP only.
CREATE TABLE "DataExportJob" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "readyAt" TIMESTAMP(3),
  "downloadedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "outputPath" TEXT,
  "outputSha256" TEXT,
  "outputBytes" INTEGER,
  "manifest" JSONB,
  "failureCode" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DataExportJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DataExportJob_userId_idempotencyKey_key" ON "DataExportJob"("userId", "idempotencyKey");
CREATE INDEX "DataExportJob_userId_status_updatedAt_idx" ON "DataExportJob"("userId", "status", "updatedAt");
CREATE INDEX "DataExportJob_status_expiresAt_idx" ON "DataExportJob"("status", "expiresAt");
CREATE UNIQUE INDEX "DataExportJob_one_active_user" ON "DataExportJob"("userId")
  WHERE "status" IN ('queued', 'running', 'ready');
ALTER TABLE "DataExportJob" ADD CONSTRAINT "DataExportJob_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
