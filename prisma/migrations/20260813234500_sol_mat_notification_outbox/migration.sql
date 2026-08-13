ALTER TABLE "MaterialSubmissionBatch"
  ADD COLUMN "notificationClaimedAt" TIMESTAMP(3);

ALTER TABLE "MaterialSubmissionBatch"
  ADD CONSTRAINT "MaterialSubmissionBatch_notification_status_check"
  CHECK ("notificationStatus" IN ('PENDING', 'SENDING', 'RETRY', 'SENT', 'FAILED'));

ALTER TABLE "MaterialSubmissionBatch"
  ADD CONSTRAINT "MaterialSubmissionBatch_notification_attempts_check"
  CHECK ("notificationAttempts" >= 0);
