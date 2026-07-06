CREATE TABLE "WellbeingRecord" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "schemaVersion" TEXT NOT NULL DEFAULT '1.0',
  "scoringVersion" TEXT NOT NULL,
  "workflowType" TEXT NOT NULL,
  "period" TEXT,
  "roleGroup" TEXT,
  "standardizedFields" JSONB NOT NULL,
  "computedSignal" JSONB NOT NULL,
  "loadFactors" JSONB NOT NULL,
  "resourceFactors" JSONB NOT NULL,
  "riskMarkers" JSONB NOT NULL,
  "recommendedActions" JSONB NOT NULL,
  "visibility" TEXT NOT NULL DEFAULT 'private',
  "aggregationEligible" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WellbeingRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WellbeingRecord_ownerUserId_workflowType_createdAt_idx" ON "WellbeingRecord"("ownerUserId", "workflowType", "createdAt");
CREATE INDEX "WellbeingRecord_workflowType_createdAt_idx" ON "WellbeingRecord"("workflowType", "createdAt");
CREATE INDEX "WellbeingRecord_aggregationEligible_workflowType_createdAt_idx" ON "WellbeingRecord"("aggregationEligible", "workflowType", "createdAt");

ALTER TABLE "WellbeingRecord" ADD CONSTRAINT "WellbeingRecord_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
