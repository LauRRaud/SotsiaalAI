ALTER TABLE "MunicipalityKovAdmin"
ADD COLUMN "rtAutoCheckStatus" "KovAutoCheckStatus" NOT NULL DEFAULT 'IDLE',
ADD COLUMN "rtLastLightCheckAt" TIMESTAMP(3),
ADD COLUMN "rtNextLightCheckAt" TIMESTAMP(3),
ADD COLUMN "rtLastChangeDetectedAt" TIMESTAMP(3),
ADD COLUMN "rtLightCheckSnapshot" JSONB,
ADD COLUMN "rtLastLightCheckSummary" JSONB;

CREATE INDEX "MunicipalityKovAdmin_rtAutoCheckStatus_idx" ON "MunicipalityKovAdmin"("rtAutoCheckStatus");
CREATE INDEX "MunicipalityKovAdmin_rtNextLightCheckAt_idx" ON "MunicipalityKovAdmin"("rtNextLightCheckAt");
