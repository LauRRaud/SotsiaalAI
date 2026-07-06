ALTER TYPE "DocumentKind" ADD VALUE IF NOT EXISTS 'AUDIO_TRANSCRIPT';
ALTER TYPE "DocumentKind" ADD VALUE IF NOT EXISTS 'TRANSCRIPT_SUMMARY';
ALTER TYPE "AgentArtifactType" ADD VALUE IF NOT EXISTS 'TRANSCRIPT_SUMMARY';

CREATE TYPE "TranscriptionJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

ALTER TABLE "AgentArtifact"
ADD COLUMN "metadata" JSONB;

CREATE TABLE "TranscriptionJob" (
    "id" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "transcriptDocumentId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "language" TEXT,
    "status" "TranscriptionJobStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TranscriptionJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TranscriptionJob_sourceDocumentId_status_idx" ON "TranscriptionJob"("sourceDocumentId", "status");
CREATE INDEX "TranscriptionJob_requestedByUserId_status_idx" ON "TranscriptionJob"("requestedByUserId", "status");
CREATE INDEX "TranscriptionJob_transcriptDocumentId_idx" ON "TranscriptionJob"("transcriptDocumentId");
CREATE INDEX "TranscriptionJob_createdAt_idx" ON "TranscriptionJob"("createdAt");

ALTER TABLE "TranscriptionJob" ADD CONSTRAINT "TranscriptionJob_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "UserDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TranscriptionJob" ADD CONSTRAINT "TranscriptionJob_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TranscriptionJob" ADD CONSTRAINT "TranscriptionJob_transcriptDocumentId_fkey" FOREIGN KEY ("transcriptDocumentId") REFERENCES "UserDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
