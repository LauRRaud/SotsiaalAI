-- Additive only: attempts start at the new release, not inferred from old messages.
CREATE TYPE "RagAttemptStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'ABANDONED');
CREATE TABLE "RagAttempt" (
  "id" TEXT NOT NULL,
  "chatTurnId" TEXT NOT NULL,
  "attempt" INTEGER NOT NULL,
  "userMessageId" TEXT,
  "assistantMessageId" TEXT,
  "status" "RagAttemptStatus" NOT NULL DEFAULT 'RUNNING',
  "stage" TEXT NOT NULL DEFAULT 'claimed',
  "sequence" INTEGER NOT NULL DEFAULT 0,
  "evidence" JSONB,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "leaseExpiresAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "RagAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RagAttempt_attempt_positive" CHECK ("attempt" > 0),
  CONSTRAINT "RagAttempt_sequence_nonnegative" CHECK ("sequence" >= 0)
);
CREATE UNIQUE INDEX "RagAttempt_chatTurnId_attempt_key" ON "RagAttempt"("chatTurnId", "attempt");
CREATE INDEX "RagAttempt_status_leaseExpiresAt_idx" ON "RagAttempt"("status", "leaseExpiresAt");
CREATE INDEX "RagAttempt_startedAt_idx" ON "RagAttempt"("startedAt");
ALTER TABLE "RagAttempt" ADD CONSTRAINT "RagAttempt_chatTurnId_fkey" FOREIGN KEY ("chatTurnId") REFERENCES "ChatTurn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RagAttempt" ADD CONSTRAINT "RagAttempt_userMessageId_fkey" FOREIGN KEY ("userMessageId") REFERENCES "ConversationMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RagAttempt" ADD CONSTRAINT "RagAttempt_assistantMessageId_fkey" FOREIGN KEY ("assistantMessageId") REFERENCES "ConversationMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
