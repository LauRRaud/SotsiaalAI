-- Add conversations + messages tables
CREATE TYPE "ConversationMessageRole" AS ENUM ('USER','ASSISTANT','SYSTEM');

CREATE TABLE "Conversation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "title" TEXT,
  "summary" TEXT,
  "role" "Role" NOT NULL DEFAULT 'CLIENT',
  "lastActivityAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expiresAt" TIMESTAMPTZ,
  "archivedAt" TIMESTAMPTZ,
  "isPinned" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "ConversationMessage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "conversationId" TEXT NOT NULL REFERENCES "Conversation"("id") ON DELETE CASCADE,
  "authorId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "role" "ConversationMessageRole" NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "Conversation_userId_lastActivityAt_idx" ON "Conversation"("userId", "isPinned", "lastActivityAt" DESC);
CREATE INDEX "Conversation_userId_archivedAt_idx" ON "Conversation"("userId", "archivedAt");
CREATE INDEX "Conversation_expiresAt_idx" ON "Conversation"("expiresAt");

CREATE INDEX "ConversationMessage_conversationId_createdAt_idx" ON "ConversationMessage"("conversationId", "createdAt");
CREATE INDEX "ConversationMessage_authorId_idx" ON "ConversationMessage"("authorId");
