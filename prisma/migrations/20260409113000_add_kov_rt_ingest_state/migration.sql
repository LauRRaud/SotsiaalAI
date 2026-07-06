ALTER TABLE "public"."MunicipalityKovAdmin"
ADD COLUMN "rtIngestStatus" "public"."KovIngestStatus" NOT NULL DEFAULT 'NOT_INGESTED',
ADD COLUMN "rtLastIngestedAt" TIMESTAMP(3),
ADD COLUMN "rtLastIngestError" TEXT,
ADD COLUMN "rtRagDocId" TEXT;

CREATE INDEX "MunicipalityKovAdmin_rtIngestStatus_idx"
ON "public"."MunicipalityKovAdmin"("rtIngestStatus");
