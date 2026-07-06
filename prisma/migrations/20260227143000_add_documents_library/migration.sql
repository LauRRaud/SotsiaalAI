-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('TEMPLATE', 'MATERIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "TemplateFor" AS ENUM ('REPORT_DRAFT', 'CASE_BRIEF', 'MEETING_SUMMARY', 'CHECKLIST', 'LETTER_DRAFT', 'OTHER');

-- CreateEnum
CREATE TYPE "AgentArtifactType" AS ENUM ('MEETING_SUMMARY', 'CASE_BRIEF', 'REPORT_DRAFT', 'CHECKLIST', 'LETTER_DRAFT', 'OTHER');

-- CreateTable
CREATE TABLE "UserDocument" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "kind" "DocumentKind" NOT NULL DEFAULT 'MATERIAL',
  "templateFor" "TemplateFor",
  "agentAllowed" BOOLEAN NOT NULL DEFAULT false,
  "mime" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "UserDocument_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserDocument_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentArtifact" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "type" "AgentArtifactType" NOT NULL,
  "title" TEXT,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "AgentArtifact_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AgentArtifact_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "UserDocument_ownerId_updatedAt_idx" ON "UserDocument"("ownerId", "updatedAt");

-- CreateIndex
CREATE INDEX "UserDocument_ownerId_kind_updatedAt_idx" ON "UserDocument"("ownerId", "kind", "updatedAt");

-- CreateIndex
CREATE INDEX "UserDocument_ownerId_agentAllowed_updatedAt_idx" ON "UserDocument"("ownerId", "agentAllowed", "updatedAt");

-- CreateIndex
CREATE INDEX "UserDocument_sha256_idx" ON "UserDocument"("sha256");

-- CreateIndex
CREATE INDEX "AgentArtifact_ownerId_updatedAt_idx" ON "AgentArtifact"("ownerId", "updatedAt");

-- CreateIndex
CREATE INDEX "AgentArtifact_ownerId_type_updatedAt_idx" ON "AgentArtifact"("ownerId", "type", "updatedAt");
