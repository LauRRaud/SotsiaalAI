CREATE TYPE "ServiceProviderProfileStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'HIDDEN');

CREATE TYPE "ServiceProviderFeeType" AS ENUM ('FREE', 'PAID', 'AGREEMENT', 'MIXED', 'UNKNOWN');

CREATE TYPE "ServiceMapEntryType" AS ENUM ('KOV_SOCIAL_CONTACT', 'KOV_GENERAL_CONTACT', 'SERVICE_PROVIDER');

CREATE TYPE "ServiceMapEntryStatus" AS ENUM ('DRAFT', 'NEEDS_REVIEW', 'PUBLISHED', 'HIDDEN');

CREATE TYPE "ServiceMapGeocodingStatus" AS ENUM ('PENDING', 'MATCHED', 'AMBIGUOUS', 'FAILED', 'MANUALLY_CONFIRMED');

CREATE TABLE "ServiceProviderProfile" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "organizationName" TEXT NOT NULL,
  "shortDescription" TEXT,
  "services" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "serviceCategories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "targetGroups" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "serviceArea" TEXT,
  "serviceAreaMunicipalityIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "county" TEXT,
  "address" TEXT,
  "normalizedAddress" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "website" TEXT,
  "languages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "accessibilityInfo" TEXT,
  "feeType" "ServiceProviderFeeType" NOT NULL DEFAULT 'UNKNOWN',
  "mapVisible" BOOLEAN NOT NULL DEFAULT false,
  "acceptsPlatformPreInquiries" BOOLEAN NOT NULL DEFAULT true,
  "acceptsEmailPreInquiries" BOOLEAN NOT NULL DEFAULT true,
  "status" "ServiceProviderProfileStatus" NOT NULL DEFAULT 'DRAFT',
  "publicSlug" TEXT,
  "publishedAt" TIMESTAMP(3),
  "hiddenAt" TIMESTAMP(3),
  "checkedAt" TIMESTAMP(3),
  "ragSourceId" TEXT,
  "ragMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ServiceProviderProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceMapEntry" (
  "id" TEXT NOT NULL,
  "type" "ServiceMapEntryType" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "municipalityId" TEXT,
  "municipalityName" TEXT,
  "county" TEXT,
  "address" TEXT,
  "normalizedAddress" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "website" TEXT,
  "sourceUrl" TEXT,
  "sourceDocId" TEXT,
  "checkedAt" TIMESTAMP(3),
  "providerProfileId" TEXT,
  "status" "ServiceMapEntryStatus" NOT NULL DEFAULT 'DRAFT',
  "geocodingStatus" "ServiceMapGeocodingStatus" NOT NULL DEFAULT 'PENDING',
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "adsObjectId" TEXT,
  "geocodingRaw" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ServiceMapEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceProviderProfile_ownerId_key" ON "ServiceProviderProfile"("ownerId");
CREATE UNIQUE INDEX "ServiceProviderProfile_publicSlug_key" ON "ServiceProviderProfile"("publicSlug");
CREATE INDEX "ServiceProviderProfile_ownerId_updatedAt_idx" ON "ServiceProviderProfile"("ownerId", "updatedAt");
CREATE INDEX "ServiceProviderProfile_status_idx" ON "ServiceProviderProfile"("status");
CREATE INDEX "ServiceProviderProfile_mapVisible_idx" ON "ServiceProviderProfile"("mapVisible");
CREATE INDEX "ServiceProviderProfile_acceptsPlatformPreInquiries_idx" ON "ServiceProviderProfile"("acceptsPlatformPreInquiries");
CREATE INDEX "ServiceProviderProfile_acceptsEmailPreInquiries_idx" ON "ServiceProviderProfile"("acceptsEmailPreInquiries");
CREATE INDEX "ServiceProviderProfile_publicSlug_idx" ON "ServiceProviderProfile"("publicSlug");

CREATE UNIQUE INDEX "ServiceMapEntry_providerProfileId_key" ON "ServiceMapEntry"("providerProfileId");
CREATE INDEX "ServiceMapEntry_type_idx" ON "ServiceMapEntry"("type");
CREATE INDEX "ServiceMapEntry_status_idx" ON "ServiceMapEntry"("status");
CREATE INDEX "ServiceMapEntry_geocodingStatus_idx" ON "ServiceMapEntry"("geocodingStatus");
CREATE INDEX "ServiceMapEntry_municipalityId_idx" ON "ServiceMapEntry"("municipalityId");
CREATE INDEX "ServiceMapEntry_municipalityName_idx" ON "ServiceMapEntry"("municipalityName");
CREATE INDEX "ServiceMapEntry_county_idx" ON "ServiceMapEntry"("county");
CREATE INDEX "ServiceMapEntry_providerProfileId_idx" ON "ServiceMapEntry"("providerProfileId");
CREATE INDEX "ServiceMapEntry_status_geocodingStatus_idx" ON "ServiceMapEntry"("status", "geocodingStatus");

ALTER TABLE "ServiceProviderProfile"
  ADD CONSTRAINT "ServiceProviderProfile_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceMapEntry"
  ADD CONSTRAINT "ServiceMapEntry_municipalityId_fkey"
  FOREIGN KEY ("municipalityId") REFERENCES "Municipality"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ServiceMapEntry"
  ADD CONSTRAINT "ServiceMapEntry_providerProfileId_fkey"
  FOREIGN KEY ("providerProfileId") REFERENCES "ServiceProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
