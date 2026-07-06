ALTER TYPE "public"."CallRecordingRequestStatus" ADD VALUE IF NOT EXISTS 'READY_TO_RECORD';
ALTER TYPE "public"."CallRecordingFileStatus" ADD VALUE IF NOT EXISTS 'NOT_CREATED';

ALTER TABLE "public"."CallRecordingFile" ALTER COLUMN "status" SET DEFAULT 'NOT_CREATED';
