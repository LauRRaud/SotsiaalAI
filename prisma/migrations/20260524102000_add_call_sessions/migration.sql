ALTER TYPE "public"."DocumentKind" ADD VALUE IF NOT EXISTS 'CALL_AUDIO_RECORDING';
ALTER TYPE "public"."DocumentKind" ADD VALUE IF NOT EXISTS 'CALL_TRANSCRIPT';

CREATE TYPE "public"."CallContextType" AS ENUM ('ROOM', 'PRE_ASSESSMENT', 'COVISION', 'MENTORING');
CREATE TYPE "public"."CallProvider" AS ENUM ('MOCK', 'LIVEKIT_SELF_HOSTED');
CREATE TYPE "public"."CallMode" AS ENUM ('AUDIO');
CREATE TYPE "public"."CallSessionStatus" AS ENUM ('ACTIVE', 'ENDED');
CREATE TYPE "public"."CallParticipantRole" AS ENUM ('HOST', 'PARTICIPANT');
CREATE TYPE "public"."CallSpeakRequestStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'CANCELLED');
CREATE TYPE "public"."CallRecordingPurpose" AS ENUM ('GENERAL_SUMMARY', 'CASE_SUMMARY', 'PRE_ASSESSMENT_SUMMARY', 'STAR_HELPER', 'MENTORING_SUMMARY', 'COVISION_SUMMARY', 'OTHER');
CREATE TYPE "public"."CallRecordingRequestStatus" AS ENUM ('REQUESTED', 'CONSENTED', 'DECLINED', 'ACTIVE', 'STOPPED', 'COMPLETED', 'FAILED', 'DELETED');
CREATE TYPE "public"."CallRecordingConsentStatus" AS ENUM ('REQUESTED', 'CONSENTED', 'DECLINED', 'WITHDRAWN');
CREATE TYPE "public"."CallRecordingFileStatus" AS ENUM ('PROCESSING', 'AVAILABLE', 'FAILED', 'DELETED');

CREATE TABLE "public"."CallSession" (
    "id" TEXT NOT NULL,
    "contextType" "public"."CallContextType" NOT NULL DEFAULT 'ROOM',
    "contextId" TEXT NOT NULL,
    "roomId" TEXT,
    "provider" "public"."CallProvider" NOT NULL DEFAULT 'MOCK',
    "providerRoomName" TEXT NOT NULL,
    "mode" "public"."CallMode" NOT NULL DEFAULT 'AUDIO',
    "status" "public"."CallSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedByUserId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "maxParticipants" INTEGER NOT NULL DEFAULT 8,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."CallParticipant" (
    "id" TEXT NOT NULL,
    "callSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "public"."CallParticipantRole" NOT NULL DEFAULT 'PARTICIPANT',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "micMuted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."CallSpeakRequest" (
    "id" TEXT NOT NULL,
    "callSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "public"."CallSpeakRequestStatus" NOT NULL DEFAULT 'ACTIVE',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallSpeakRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."CallRecordingRequest" (
    "id" TEXT NOT NULL,
    "callSessionId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "purpose" "public"."CallRecordingPurpose" NOT NULL DEFAULT 'GENERAL_SUMMARY',
    "purposeText" TEXT,
    "status" "public"."CallRecordingRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "consentTextVersion" TEXT NOT NULL,
    "consentTextSnapshot" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "stoppedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallRecordingRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."CallRecordingConsent" (
    "id" TEXT NOT NULL,
    "recordingRequestId" TEXT NOT NULL,
    "callSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "public"."CallRecordingConsentStatus" NOT NULL DEFAULT 'REQUESTED',
    "consentTextVersion" TEXT NOT NULL,
    "consentTextSnapshot" TEXT NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "ipAddressHash" TEXT,
    "userAgentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallRecordingConsent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."CallRecordingFile" (
    "id" TEXT NOT NULL,
    "recordingRequestId" TEXT NOT NULL,
    "callSessionId" TEXT NOT NULL,
    "egressId" TEXT,
    "storageProvider" TEXT,
    "filePath" TEXT,
    "mimeType" TEXT,
    "fileSizeBytes" INTEGER,
    "durationSeconds" INTEGER,
    "checksum" TEXT,
    "status" "public"."CallRecordingFileStatus" NOT NULL DEFAULT 'PROCESSING',
    "createdDocumentId" TEXT,
    "retentionUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallRecordingFile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CallSession_contextType_contextId_status_idx" ON "public"."CallSession"("contextType", "contextId", "status");
CREATE INDEX "CallSession_roomId_status_idx" ON "public"."CallSession"("roomId", "status");
CREATE INDEX "CallSession_startedByUserId_startedAt_idx" ON "public"."CallSession"("startedByUserId", "startedAt");
CREATE UNIQUE INDEX "CallSession_one_active_room_call_idx" ON "public"."CallSession"("roomId") WHERE "contextType" = 'ROOM' AND "status" = 'ACTIVE' AND "roomId" IS NOT NULL;

CREATE INDEX "CallParticipant_callSessionId_leftAt_idx" ON "public"."CallParticipant"("callSessionId", "leftAt");
CREATE INDEX "CallParticipant_callSessionId_userId_idx" ON "public"."CallParticipant"("callSessionId", "userId");
CREATE INDEX "CallParticipant_userId_joinedAt_idx" ON "public"."CallParticipant"("userId", "joinedAt");

CREATE INDEX "CallSpeakRequest_callSessionId_status_requestedAt_idx" ON "public"."CallSpeakRequest"("callSessionId", "status", "requestedAt");
CREATE INDEX "CallSpeakRequest_userId_status_idx" ON "public"."CallSpeakRequest"("userId", "status");

CREATE INDEX "CallRecordingRequest_callSessionId_status_idx" ON "public"."CallRecordingRequest"("callSessionId", "status");
CREATE INDEX "CallRecordingRequest_requestedByUserId_requestedAt_idx" ON "public"."CallRecordingRequest"("requestedByUserId", "requestedAt");

CREATE INDEX "CallRecordingConsent_recordingRequestId_status_idx" ON "public"."CallRecordingConsent"("recordingRequestId", "status");
CREATE INDEX "CallRecordingConsent_callSessionId_userId_idx" ON "public"."CallRecordingConsent"("callSessionId", "userId");

CREATE INDEX "CallRecordingFile_recordingRequestId_status_idx" ON "public"."CallRecordingFile"("recordingRequestId", "status");
CREATE INDEX "CallRecordingFile_callSessionId_status_idx" ON "public"."CallRecordingFile"("callSessionId", "status");
CREATE INDEX "CallRecordingFile_createdDocumentId_idx" ON "public"."CallRecordingFile"("createdDocumentId");

ALTER TABLE "public"."CallSession" ADD CONSTRAINT "CallSession_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."CallSession" ADD CONSTRAINT "CallSession_startedByUserId_fkey" FOREIGN KEY ("startedByUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."CallParticipant" ADD CONSTRAINT "CallParticipant_callSessionId_fkey" FOREIGN KEY ("callSessionId") REFERENCES "public"."CallSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."CallParticipant" ADD CONSTRAINT "CallParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."CallSpeakRequest" ADD CONSTRAINT "CallSpeakRequest_callSessionId_fkey" FOREIGN KEY ("callSessionId") REFERENCES "public"."CallSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."CallSpeakRequest" ADD CONSTRAINT "CallSpeakRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."CallSpeakRequest" ADD CONSTRAINT "CallSpeakRequest_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."CallRecordingRequest" ADD CONSTRAINT "CallRecordingRequest_callSessionId_fkey" FOREIGN KEY ("callSessionId") REFERENCES "public"."CallSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."CallRecordingRequest" ADD CONSTRAINT "CallRecordingRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."CallRecordingConsent" ADD CONSTRAINT "CallRecordingConsent_recordingRequestId_fkey" FOREIGN KEY ("recordingRequestId") REFERENCES "public"."CallRecordingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."CallRecordingConsent" ADD CONSTRAINT "CallRecordingConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."CallRecordingFile" ADD CONSTRAINT "CallRecordingFile_recordingRequestId_fkey" FOREIGN KEY ("recordingRequestId") REFERENCES "public"."CallRecordingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."CallRecordingFile" ADD CONSTRAINT "CallRecordingFile_callSessionId_fkey" FOREIGN KEY ("callSessionId") REFERENCES "public"."CallSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."CallRecordingFile" ADD CONSTRAINT "CallRecordingFile_createdDocumentId_fkey" FOREIGN KEY ("createdDocumentId") REFERENCES "public"."UserDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
