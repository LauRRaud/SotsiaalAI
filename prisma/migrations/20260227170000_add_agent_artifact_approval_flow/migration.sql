-- CreateEnum
CREATE TYPE "AgentArtifactStatus" AS ENUM ('DRAFT', 'FINAL');

-- AlterTable
ALTER TABLE "AgentArtifact"
ADD COLUMN "approvedAt" TIMESTAMP,
ADD COLUMN "status" "AgentArtifactStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "templateId" TEXT;

-- CreateTable
CREATE TABLE "AgentArtifactSourceDocument" (
  "artifactId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "AgentArtifactSourceDocument_pkey" PRIMARY KEY ("artifactId", "documentId"),
  CONSTRAINT "AgentArtifactSourceDocument_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "AgentArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AgentArtifactSourceDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "UserDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AgentArtifact_ownerId_status_updatedAt_idx" ON "AgentArtifact"("ownerId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "AgentArtifact_templateId_idx" ON "AgentArtifact"("templateId");

-- CreateIndex
CREATE INDEX "AgentArtifactSourceDocument_documentId_idx" ON "AgentArtifactSourceDocument"("documentId");

-- AddForeignKey
ALTER TABLE "AgentArtifact" ADD CONSTRAINT "AgentArtifact_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "UserDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
