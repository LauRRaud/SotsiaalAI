CREATE TABLE "AgentArtifactRefinement" (
  "id" TEXT NOT NULL,
  "artifactId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "claimToken" TEXT NOT NULL,
  "expectedUpdatedAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "leaseExpiresAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 1,
  "slotAuditId" TEXT,
  "resultContent" TEXT,
  "resultUpdatedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentArtifactRefinement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentArtifactRefinement_slotAuditId_key"
  ON "AgentArtifactRefinement"("slotAuditId");
CREATE UNIQUE INDEX "AgentArtifactRefinement_ownerId_idempotencyKey_key"
  ON "AgentArtifactRefinement"("ownerId", "idempotencyKey");
CREATE INDEX "AgentArtifactRefinement_artifactId_status_updatedAt_idx"
  ON "AgentArtifactRefinement"("artifactId", "status", "updatedAt");
CREATE INDEX "AgentArtifactRefinement_status_leaseExpiresAt_idx"
  ON "AgentArtifactRefinement"("status", "leaseExpiresAt");

ALTER TABLE "AgentArtifactRefinement"
  ADD CONSTRAINT "AgentArtifactRefinement_artifactId_fkey"
  FOREIGN KEY ("artifactId") REFERENCES "AgentArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentArtifactRefinement"
  ADD CONSTRAINT "AgentArtifactRefinement_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentArtifactRefinement"
  ADD CONSTRAINT "AgentArtifactRefinement_status_check"
  CHECK ("status" IN ('RUNNING', 'DONE', 'FAILED'));
