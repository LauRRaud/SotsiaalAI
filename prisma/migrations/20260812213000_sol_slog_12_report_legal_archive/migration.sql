CREATE TABLE "ServiceLogReportLegalArchive" (
    "id" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "metadata" JSONB,
    "retentionEndsAt" TIMESTAMP(3) NOT NULL,
    "issuedDocumentCreatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceLogReportLegalArchive_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceLogReportLegalArchive_sourceDocumentId_key"
ON "ServiceLogReportLegalArchive"("sourceDocumentId");

CREATE INDEX "ServiceLogReportLegalArchive_retentionEndsAt_idx"
ON "ServiceLogReportLegalArchive"("retentionEndsAt");

CREATE INDEX "ServiceLogReportLegalArchive_sha256_idx"
ON "ServiceLogReportLegalArchive"("sha256");
