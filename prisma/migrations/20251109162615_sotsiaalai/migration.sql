-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_userId_fkey";

-- DropForeignKey
ALTER TABLE "ConversationMessage" DROP CONSTRAINT "ConversationMessage_authorId_fkey";

-- DropForeignKey
ALTER TABLE "ConversationMessage" DROP CONSTRAINT "ConversationMessage_conversationId_fkey";

-- DropIndex
DROP INDEX "Conversation_userId_lastActivityAt_idx";

-- AlterTable
ALTER TABLE "AnalyzeUsage" ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Conversation" ALTER COLUMN "role" DROP DEFAULT,
ALTER COLUMN "lastActivityAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "expiresAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "archivedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ConversationMessage" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Conversation_userId_isPinned_lastActivityAt_idx" ON "Conversation"("userId", "isPinned", "lastActivityAt");

-- CreateIndex
CREATE INDEX "RagDocument_updatedAt_idx" ON "RagDocument"("updatedAt");

-- CreateIndex
CREATE INDEX "RagDocument_sourceUrl_idx" ON "RagDocument"("sourceUrl");

-- CreateIndex
CREATE INDEX "RagDocument_fileName_idx" ON "RagDocument"("fileName");

-- CreateIndex
CREATE INDEX "RagDocument_mimeType_idx" ON "RagDocument"("mimeType");

-- CreateIndex
CREATE INDEX "RagDocument_status_updatedAt_createdAt_idx" ON "RagDocument"("status", "updatedAt", "createdAt");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
