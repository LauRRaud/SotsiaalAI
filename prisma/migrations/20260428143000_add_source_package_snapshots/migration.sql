CREATE TABLE "SourcePackageSnapshot" (
  "id" TEXT NOT NULL,
  "packageId" TEXT NOT NULL,
  "canonicalItemId" TEXT NOT NULL,
  "municipalityId" TEXT,
  "packageType" TEXT NOT NULL,
  "title" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "confidence" TEXT,
  "missingSections" JSONB NOT NULL,
  "packageHash" TEXT NOT NULL,
  "lastBuiltAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastChecked" TIMESTAMP(3),
  "version" INTEGER NOT NULL,
  "sectionSummary" JSONB NOT NULL,
  "sourceMembership" JSONB NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SourcePackageSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SourcePackageSnapshot_packageId_packageHash_key" ON "SourcePackageSnapshot"("packageId", "packageHash");
CREATE UNIQUE INDEX "SourcePackageSnapshot_packageId_version_key" ON "SourcePackageSnapshot"("packageId", "version");
CREATE INDEX "SourcePackageSnapshot_packageId_active_idx" ON "SourcePackageSnapshot"("packageId", "active");
CREATE INDEX "SourcePackageSnapshot_municipalityId_idx" ON "SourcePackageSnapshot"("municipalityId");
CREATE INDEX "SourcePackageSnapshot_packageType_idx" ON "SourcePackageSnapshot"("packageType");
CREATE INDEX "SourcePackageSnapshot_status_idx" ON "SourcePackageSnapshot"("status");
CREATE INDEX "SourcePackageSnapshot_lastBuiltAt_idx" ON "SourcePackageSnapshot"("lastBuiltAt");
