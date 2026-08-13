ALTER TABLE "FieldVisitNote"
  ADD COLUMN "recoveryImportedAt" TIMESTAMP(3);

ALTER TABLE "FieldVisitAttachment"
  ADD COLUMN "deviceCreatedAt" TIMESTAMP(3),
  ADD COLUMN "recoveryImportedAt" TIMESTAMP(3);

ALTER TABLE "FieldVisitNote"
  ADD CONSTRAINT "FieldVisitNote_recovery_requires_device_time_check"
  CHECK ("recoveryImportedAt" IS NULL OR "deviceCreatedAt" IS NOT NULL);

ALTER TABLE "FieldVisitAttachment"
  ADD CONSTRAINT "FieldVisitAttachment_recovery_requires_device_time_check"
  CHECK ("recoveryImportedAt" IS NULL OR "deviceCreatedAt" IS NOT NULL);
