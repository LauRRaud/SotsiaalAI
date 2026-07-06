CREATE TYPE "KovAutoCheckStatus" AS ENUM (
  'IDLE',
  'DUE',
  'CHECKING',
  'CHANGES_DETECTED',
  'NO_CHANGES',
  'ERROR'
);

ALTER TABLE "MunicipalityKovAdmin"
ADD COLUMN "reviewCadence" TEXT NOT NULL DEFAULT 'ANNUAL_JAN_PLUS_JULY_CHECK',
ADD COLUMN "autoCheckStatus" "KovAutoCheckStatus" NOT NULL DEFAULT 'IDLE',
ADD COLUMN "lastFullReviewAt" TIMESTAMP(3),
ADD COLUMN "nextFullReviewAt" TIMESTAMP(3),
ADD COLUMN "lastLightCheckAt" TIMESTAMP(3),
ADD COLUMN "nextLightCheckAt" TIMESTAMP(3),
ADD COLUMN "lastChangeDetectedAt" TIMESTAMP(3);

CREATE INDEX "MunicipalityKovAdmin_autoCheckStatus_idx" ON "MunicipalityKovAdmin"("autoCheckStatus");
CREATE INDEX "MunicipalityKovAdmin_nextFullReviewAt_idx" ON "MunicipalityKovAdmin"("nextFullReviewAt");
CREATE INDEX "MunicipalityKovAdmin_nextLightCheckAt_idx" ON "MunicipalityKovAdmin"("nextLightCheckAt");
