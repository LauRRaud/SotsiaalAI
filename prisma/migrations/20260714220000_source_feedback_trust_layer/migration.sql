CREATE TABLE "SourceFeedback" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "note" VARCHAR(500),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolutionNote" VARCHAR(1000),

    CONSTRAINT "SourceFeedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SourceFeedback_dedupeKey_key" ON "SourceFeedback"("dedupeKey");
CREATE INDEX "SourceFeedback_reporterId_createdAt_idx" ON "SourceFeedback"("reporterId", "createdAt");
CREATE INDEX "SourceFeedback_status_createdAt_idx" ON "SourceFeedback"("status", "createdAt");
CREATE INDEX "SourceFeedback_sourceId_status_idx" ON "SourceFeedback"("sourceId", "status");

ALTER TABLE "SourceFeedback" ADD CONSTRAINT "SourceFeedback_reporterId_fkey"
FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SourceFeedback" ADD CONSTRAINT "SourceFeedback_resolvedById_fkey"
FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
