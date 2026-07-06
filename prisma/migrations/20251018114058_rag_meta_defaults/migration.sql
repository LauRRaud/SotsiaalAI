/*
  Warnings:

  - A unique constraint covering the columns `[remoteId]` on the table `RagDocument` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex (use IF EXISTS to stay idempotent across environments)
DROP INDEX IF EXISTS "ConversationRun_userId_status_updatedAt_idx";

-- AlterTable
ALTER TABLE "public"."RagDocument" ADD COLUMN     "articleId" TEXT,
ADD COLUMN     "authors" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "issueId" TEXT,
ADD COLUMN     "issueLabel" TEXT,
ADD COLUMN     "journalTitle" TEXT,
ADD COLUMN     "pageRange" TEXT,
ADD COLUMN     "pages" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "section" TEXT,
ADD COLUMN     "year" INTEGER;

-- CreateIndex
CREATE INDEX "ConversationRun_userId_status_updatedAt_idx" ON "public"."ConversationRun"("userId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RagDocument_remoteId_key" ON "public"."RagDocument"("remoteId");

-- CreateIndex
CREATE INDEX "RagDocument_insertedAt_idx" ON "public"."RagDocument"("insertedAt");

-- CreateIndex
CREATE INDEX "RagDocument_journalTitle_idx" ON "public"."RagDocument"("journalTitle");

-- CreateIndex
CREATE INDEX "RagDocument_issueLabel_idx" ON "public"."RagDocument"("issueLabel");

-- CreateIndex
CREATE INDEX "RagDocument_year_idx" ON "public"."RagDocument"("year");

-- CreateIndex
CREATE INDEX "RagDocument_articleId_idx" ON "public"."RagDocument"("articleId");
