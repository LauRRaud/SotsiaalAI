CREATE TABLE "WellbeingOutputDraft" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sourceWorkflowType" TEXT NOT NULL,
  "sourceRecordId" TEXT,
  "outputType" TEXT NOT NULL,
  "recipientType" TEXT NOT NULL,
  "generatedText" TEXT NOT NULL,
  "editedText" TEXT,
  "userReviewed" BOOLEAN NOT NULL DEFAULT false,
  "userConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "visibility" TEXT NOT NULL DEFAULT 'private',
  "status" TEXT NOT NULL DEFAULT 'draft',
  "schemaVersion" TEXT NOT NULL DEFAULT '1.0',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WellbeingOutputDraft_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WellbeingOutputDraft_userId_outputType_createdAt_idx" ON "WellbeingOutputDraft"("userId", "outputType", "createdAt");
CREATE INDEX "WellbeingOutputDraft_userId_recipientType_createdAt_idx" ON "WellbeingOutputDraft"("userId", "recipientType", "createdAt");
CREATE INDEX "WellbeingOutputDraft_sourceWorkflowType_outputType_createdAt_idx" ON "WellbeingOutputDraft"("sourceWorkflowType", "outputType", "createdAt");

ALTER TABLE "WellbeingOutputDraft"
  ADD CONSTRAINT "WellbeingOutputDraft_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
