CREATE TABLE "ServiceProviderProfileRagJob" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "revisionAt" TIMESTAMP(3) NOT NULL,
    "documentId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "payloadSha256" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseToken" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServiceProviderProfileRagJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceProviderProfileRagJob_profileId_revisionAt_key"
    ON "ServiceProviderProfileRagJob"("profileId", "revisionAt");
CREATE INDEX "ServiceProviderProfileRagJob_status_nextAttemptAt_createdAt_idx"
    ON "ServiceProviderProfileRagJob"("status", "nextAttemptAt", "createdAt");
CREATE INDEX "ServiceProviderProfileRagJob_profileId_createdAt_idx"
    ON "ServiceProviderProfileRagJob"("profileId", "createdAt");

ALTER TABLE "ServiceProviderProfileRagJob"
    ADD CONSTRAINT "ServiceProviderProfileRagJob_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "ServiceProviderProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
