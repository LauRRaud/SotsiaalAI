CREATE TABLE "FieldVisitHandover" (
  "id" TEXT NOT NULL,
  "visitId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "clientActionId" TEXT NOT NULL,
  "requestSha256" TEXT NOT NULL,
  "requestPayload" JSONB NOT NULL,
  "targetStates" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FieldVisitHandover_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FieldVisitHandover_visitId_clientActionId_key"
  ON "FieldVisitHandover"("visitId", "clientActionId");
CREATE INDEX "FieldVisitHandover_ownerUserId_updatedAt_idx"
  ON "FieldVisitHandover"("ownerUserId", "updatedAt");
CREATE INDEX "FieldVisitHandover_visitId_updatedAt_idx"
  ON "FieldVisitHandover"("visitId", "updatedAt");

ALTER TABLE "FieldVisitHandover"
  ADD CONSTRAINT "FieldVisitHandover_visitId_fkey"
  FOREIGN KEY ("visitId") REFERENCES "FieldVisit"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FieldVisitAttachment"
  ADD COLUMN "captureBasis" TEXT,
  ADD COLUMN "documentRequestReason" VARCHAR(500),
  ADD COLUMN "documentRequestAt" TIMESTAMP(3),
  ADD COLUMN "storageStatus" TEXT NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX "FieldVisitAttachment_storageStatus_updatedAt_idx"
  ON "FieldVisitAttachment"("storageStatus", "updatedAt");

ALTER TABLE "FieldVisitAttachment"
  ADD CONSTRAINT "FieldVisitAttachment_capture_basis_check"
  CHECK (
    ("captureBasis" IS NULL AND "documentRequestReason" IS NULL AND "documentRequestAt" IS NULL)
    OR ("captureBasis" = 'CONSENT' AND "documentRequestReason" IS NULL AND "documentRequestAt" IS NULL)
    OR ("captureBasis" = 'CLIENT_DOCUMENT_REQUEST' AND "documentRequestReason" IS NOT NULL AND "documentRequestAt" IS NOT NULL)
  );

ALTER TABLE "FieldVisitAttachment"
  ADD CONSTRAINT "FieldVisitAttachment_storage_status_check"
  CHECK ("storageStatus" IN ('PENDING_PUBLISH', 'ACTIVE', 'DELETE_PENDING'));

ALTER TABLE "FieldVisit"
  ADD COLUMN "safetyResolvedNoticeStatus" TEXT;

CREATE TABLE "FieldOcrJob" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "visitId" TEXT NOT NULL,
  "attachmentId" TEXT NOT NULL,
  "contentSha256" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "leaseStartedAt" TIMESTAMP(3),
  "resultText" TEXT,
  "resultTruncated" BOOLEAN NOT NULL DEFAULT false,
  "lastErrorCode" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FieldOcrJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FieldOcrRateEvent" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "ipHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FieldOcrRateEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FieldOcrJob_attachmentId_contentSha256_key" ON "FieldOcrJob"("attachmentId", "contentSha256");
CREATE INDEX "FieldOcrJob_ownerUserId_status_updatedAt_idx" ON "FieldOcrJob"("ownerUserId", "status", "updatedAt");
CREATE INDEX "FieldOcrJob_status_leaseStartedAt_idx" ON "FieldOcrJob"("status", "leaseStartedAt");
CREATE INDEX "FieldOcrJob_visitId_createdAt_idx" ON "FieldOcrJob"("visitId", "createdAt");
CREATE INDEX "FieldOcrRateEvent_ownerUserId_createdAt_idx" ON "FieldOcrRateEvent"("ownerUserId", "createdAt");
CREATE INDEX "FieldOcrRateEvent_ipHash_createdAt_idx" ON "FieldOcrRateEvent"("ipHash", "createdAt");

ALTER TABLE "FieldOcrJob" ADD CONSTRAINT "FieldOcrJob_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FieldOcrJob" ADD CONSTRAINT "FieldOcrJob_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "FieldVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FieldOcrJob" ADD CONSTRAINT "FieldOcrJob_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "FieldVisitAttachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FieldOcrRateEvent" ADD CONSTRAINT "FieldOcrRateEvent_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FieldOcrJob" ADD CONSTRAINT "FieldOcrJob_status_check" CHECK ("status" IN ('PENDING', 'RUNNING', 'DONE', 'FAILED'));
