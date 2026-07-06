-- CreateEnum
CREATE TYPE "DocumentAuditAction" AS ENUM (
  'UPLOAD',
  'DOWNLOAD',
  'UPDATE',
  'DELETE',
  'ARTIFACT_CREATE',
  'ARTIFACT_UPDATE',
  'ARTIFACT_APPROVE',
  'ARTIFACT_DOWNLOAD',
  'ARTIFACT_DELETE'
);

-- CreateTable
CREATE TABLE "DocumentAudit" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "documentId" TEXT,
  "artifactId" TEXT,
  "action" "DocumentAuditAction" NOT NULL,
  "meta" JSONB,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "DocumentAudit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DocumentAudit_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DocumentAudit_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "UserDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "DocumentAudit_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "AgentArtifact"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DocumentAudit_ownerId_createdAt_idx" ON "DocumentAudit"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentAudit_documentId_createdAt_idx" ON "DocumentAudit"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentAudit_artifactId_createdAt_idx" ON "DocumentAudit"("artifactId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentAudit_action_createdAt_idx" ON "DocumentAudit"("action", "createdAt");
