CREATE TABLE "OrganizationAdmin" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "focus" TEXT,
    "county" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "officialWebsite" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "notes" TEXT,
    "crawlReadiness" TEXT NOT NULL DEFAULT 'PLANNED',
    "fileCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationAdmin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationAdmin_slug_key" ON "OrganizationAdmin"("slug");
CREATE UNIQUE INDEX "OrganizationAdmin_displayName_key" ON "OrganizationAdmin"("displayName");

CREATE INDEX "OrganizationAdmin_type_idx" ON "OrganizationAdmin"("type");
CREATE INDEX "OrganizationAdmin_county_idx" ON "OrganizationAdmin"("county");
CREATE INDEX "OrganizationAdmin_isActive_idx" ON "OrganizationAdmin"("isActive");
CREATE INDEX "OrganizationAdmin_crawlReadiness_idx" ON "OrganizationAdmin"("crawlReadiness");
