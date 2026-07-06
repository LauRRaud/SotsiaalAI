CREATE TYPE "public"."KovIngestStatus" AS ENUM ('NOT_INGESTED', 'READY', 'INGESTING', 'INGESTED', 'ERROR');

ALTER TABLE "public"."MunicipalityKovAdmin"
ADD COLUMN "ingestStatus" "public"."KovIngestStatus" NOT NULL DEFAULT 'NOT_INGESTED',
ADD COLUMN "lastIngestedAt" TIMESTAMP(3),
ADD COLUMN "lastIngestError" TEXT,
ADD COLUMN "ragDocId" TEXT;

CREATE INDEX "MunicipalityKovAdmin_ingestStatus_idx"
ON "public"."MunicipalityKovAdmin"("ingestStatus");
