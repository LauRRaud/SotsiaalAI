-- CreateTable
CREATE TABLE "ChatLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "role" TEXT,
    "event" TEXT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "ChatLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatLog_createdAt_idx" ON "ChatLog"("createdAt");

-- CreateIndex
CREATE INDEX "ChatLog_event_createdAt_idx" ON "ChatLog"("event", "createdAt");

-- CreateIndex
CREATE INDEX "ChatLog_role_createdAt_idx" ON "ChatLog"("role", "createdAt");
