-- Add service-level records under a service provider profile.
-- The profile stays the map-marker owner; these rows describe the services shown and searched under that marker.

CREATE TABLE "ServiceProviderService" (
  "id" TEXT NOT NULL,
  "providerProfileId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "targetGroups" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "serviceArea" TEXT,
  "feeType" "ServiceProviderFeeType" NOT NULL DEFAULT 'UNKNOWN',
  "priceDescription" TEXT,
  "contactName" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "website" TEXT,
  "acceptsPlatformPreInquiries" BOOLEAN,
  "acceptsEmailPreInquiries" BOOLEAN,
  "mapVisible" BOOLEAN NOT NULL DEFAULT true,
  "status" "ServiceProviderProfileStatus" NOT NULL DEFAULT 'PUBLISHED',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ServiceProviderService_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ServiceProviderService_providerProfileId_idx" ON "ServiceProviderService"("providerProfileId");
CREATE INDEX "ServiceProviderService_status_idx" ON "ServiceProviderService"("status");
CREATE INDEX "ServiceProviderService_mapVisible_idx" ON "ServiceProviderService"("mapVisible");
CREATE INDEX "ServiceProviderService_feeType_idx" ON "ServiceProviderService"("feeType");
CREATE INDEX "ServiceProviderService_sortOrder_idx" ON "ServiceProviderService"("sortOrder");

ALTER TABLE "ServiceProviderService"
  ADD CONSTRAINT "ServiceProviderService_providerProfileId_fkey"
  FOREIGN KEY ("providerProfileId") REFERENCES "ServiceProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
