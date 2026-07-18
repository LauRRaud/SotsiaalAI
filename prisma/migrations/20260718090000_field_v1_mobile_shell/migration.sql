-- FIELD-V1 (T24): mobile field-work shell. Additive only — three new tables,
-- one DocumentKind value and no changes to existing rows. Statuses, item
-- states and provenance values are application-level constants, not PG enums.
-- Rollback: DROP TABLE "FieldVisitAttachment", "FieldVisitNote", "FieldVisit";
-- the added enum value stays (PostgreSQL enum values are append-only) but is
-- unused after rollback.

ALTER TYPE "DocumentKind" ADD VALUE IF NOT EXISTS 'FIELD_PHOTO';

CREATE TABLE "FieldVisit" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "goal" TEXT,
  "locationText" TEXT,
  "plannedStartAt" TIMESTAMP(3),
  "plannedEndAt" TIMESTAMP(3),
  "preInquiryId" TEXT,
  "packKeyQuestions" JSONB,
  "packSummaryText" TEXT,
  "packTakenAt" TIMESTAMP(3),
  "packSourceUpdatedAt" TIMESTAMP(3),
  "arrivedConfirmedAt" TIMESTAMP(3),
  "departedConfirmedAt" TIMESTAMP(3),
  "safetyArmedAt" TIMESTAMP(3),
  "safetyDeadlineAt" TIMESTAMP(3),
  "safetyContactName" TEXT,
  "safetyContactEmail" TEXT,
  "safetyInstructions" TEXT,
  "safetyRemindedAt" TIMESTAMP(3),
  "safetyEscalatedAt" TIMESTAMP(3),
  "safetyEscalationAttempts" INTEGER NOT NULL DEFAULT 0,
  "safetyEscalationNextAttemptAt" TIMESTAMP(3),
  "safetyEscalationStatus" TEXT,
  "safetyResolvedNotifiedAt" TIMESTAMP(3),
  "safetyCancelledAt" TIMESTAMP(3),
  "handoverArtifactAt" TIMESTAMP(3),
  "handoverPreInquiryAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "retentionClass" TEXT NOT NULL DEFAULT 'standard90',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FieldVisit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FieldVisitNote" (
  "id" TEXT NOT NULL,
  "visitId" TEXT NOT NULL,
  "clientItemId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "kind" TEXT NOT NULL DEFAULT 'note',
  "provenance" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "contentSha256" TEXT,
  "consentKind" TEXT,
  "consentSubject" TEXT,
  "consentForm" TEXT,
  "consentWithdrawnAt" TIMESTAMP(3),
  "aiConfirmedAt" TIMESTAMP(3),
  "conflictState" TEXT,
  "conflictRevision" INTEGER,
  "conflictBody" TEXT,
  "conflictProvenance" TEXT,
  "deviceCreatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FieldVisitNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FieldVisitAttachment" (
  "id" TEXT NOT NULL,
  "visitId" TEXT NOT NULL,
  "clientItemId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "documentId" TEXT,
  "consentClientItemId" TEXT,
  "transcriptConfirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FieldVisitAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FieldVisit_ownerUserId_updatedAt_idx" ON "FieldVisit"("ownerUserId", "updatedAt");
CREATE INDEX "FieldVisit_ownerUserId_status_updatedAt_idx" ON "FieldVisit"("ownerUserId", "status", "updatedAt");
CREATE INDEX "FieldVisit_status_closedAt_idx" ON "FieldVisit"("status", "closedAt");
CREATE INDEX "FieldVisit_status_cancelledAt_idx" ON "FieldVisit"("status", "cancelledAt");
CREATE INDEX "FieldVisit_safetyArmedAt_safetyDeadlineAt_idx" ON "FieldVisit"("safetyArmedAt", "safetyDeadlineAt");
CREATE INDEX "FieldVisit_preInquiryId_idx" ON "FieldVisit"("preInquiryId");

CREATE UNIQUE INDEX "FieldVisitNote_visitId_clientItemId_key" ON "FieldVisitNote"("visitId", "clientItemId");
CREATE INDEX "FieldVisitNote_visitId_createdAt_idx" ON "FieldVisitNote"("visitId", "createdAt");
CREATE INDEX "FieldVisitNote_visitId_kind_idx" ON "FieldVisitNote"("visitId", "kind");

CREATE UNIQUE INDEX "FieldVisitAttachment_visitId_clientItemId_key" ON "FieldVisitAttachment"("visitId", "clientItemId");
CREATE INDEX "FieldVisitAttachment_visitId_createdAt_idx" ON "FieldVisitAttachment"("visitId", "createdAt");
CREATE INDEX "FieldVisitAttachment_documentId_idx" ON "FieldVisitAttachment"("documentId");
CREATE INDEX "FieldVisitAttachment_role_createdAt_idx" ON "FieldVisitAttachment"("role", "createdAt");

ALTER TABLE "FieldVisit"
  ADD CONSTRAINT "FieldVisit_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FieldVisit"
  ADD CONSTRAINT "FieldVisit_preInquiryId_fkey"
  FOREIGN KEY ("preInquiryId") REFERENCES "PreInquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FieldVisitNote"
  ADD CONSTRAINT "FieldVisitNote_visitId_fkey"
  FOREIGN KEY ("visitId") REFERENCES "FieldVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FieldVisitAttachment"
  ADD CONSTRAINT "FieldVisitAttachment_visitId_fkey"
  FOREIGN KEY ("visitId") REFERENCES "FieldVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FieldVisitAttachment"
  ADD CONSTRAINT "FieldVisitAttachment_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "UserDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
