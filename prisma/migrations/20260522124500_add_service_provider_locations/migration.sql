-- Add service provider locations and connect services to one or more locations.
-- A map marker represents a location; several services can be shown under the same marker.

CREATE TABLE "ServiceProviderLocation" (
  "id" TEXT NOT NULL,
  "providerProfileId" TEXT NOT NULL,
  "label" TEXT,
  "address" TEXT,
  "normalizedAddress" TEXT,
  "county" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "geocodingStatus" "ServiceMapGeocodingStatus" NOT NULL DEFAULT 'PENDING',
  "adsObjectId" TEXT,
  "geocodingRaw" JSONB,
  "phone" TEXT,
  "email" TEXT,
  "website" TEXT,
  "accessibilityInfo" TEXT,
  "mapVisible" BOOLEAN NOT NULL DEFAULT true,
  "status" "ServiceProviderProfileStatus" NOT NULL DEFAULT 'PUBLISHED',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceProviderLocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceProviderServiceLocation" (
  "id" TEXT NOT NULL,
  "providerServiceId" TEXT NOT NULL,
  "providerLocationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceProviderServiceLocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ServiceProviderLocation_providerProfileId_idx" ON "ServiceProviderLocation"("providerProfileId");
CREATE INDEX "ServiceProviderLocation_status_idx" ON "ServiceProviderLocation"("status");
CREATE INDEX "ServiceProviderLocation_mapVisible_idx" ON "ServiceProviderLocation"("mapVisible");
CREATE INDEX "ServiceProviderLocation_geocodingStatus_idx" ON "ServiceProviderLocation"("geocodingStatus");
CREATE INDEX "ServiceProviderLocation_sortOrder_idx" ON "ServiceProviderLocation"("sortOrder");
CREATE UNIQUE INDEX "ServiceProviderServiceLocation_providerServiceId_providerLocationId_key" ON "ServiceProviderServiceLocation"("providerServiceId", "providerLocationId");
CREATE INDEX "ServiceProviderServiceLocation_providerLocationId_idx" ON "ServiceProviderServiceLocation"("providerLocationId");

ALTER TABLE "ServiceProviderLocation"
  ADD CONSTRAINT "ServiceProviderLocation_providerProfileId_fkey"
  FOREIGN KEY ("providerProfileId") REFERENCES "ServiceProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceProviderServiceLocation"
  ADD CONSTRAINT "ServiceProviderServiceLocation_providerServiceId_fkey"
  FOREIGN KEY ("providerServiceId") REFERENCES "ServiceProviderService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceProviderServiceLocation"
  ADD CONSTRAINT "ServiceProviderServiceLocation_providerLocationId_fkey"
  FOREIGN KEY ("providerLocationId") REFERENCES "ServiceProviderLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
