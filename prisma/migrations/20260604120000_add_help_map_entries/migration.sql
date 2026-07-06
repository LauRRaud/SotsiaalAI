CREATE TYPE "public"."HelpMapEntryKind" AS ENUM ('HELP_REQUEST', 'HELP_OFFER');

CREATE TYPE "public"."HelpMapMode" AS ENUM ('PHYSICAL', 'AREA', 'AT_HOME', 'ONLINE_PHONE');

CREATE TYPE "public"."HelpMapContactMode" AS ENUM ('PLATFORM', 'PHONE', 'EMAIL', 'OTHER');

CREATE TYPE "public"."HelpMapEntryStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'CLOSED', 'HIDDEN', 'EXPIRED');

ALTER TABLE "public"."HelpRequest"
ADD COLUMN "expiresAt" TIMESTAMP(3);

ALTER TABLE "public"."HelpOffer"
ADD COLUMN "expiresAt" TIMESTAMP(3);

CREATE TABLE "public"."HelpMapEntry" (
  "id" TEXT NOT NULL,
  "kind" "public"."HelpMapEntryKind" NOT NULL,
  "requestId" TEXT,
  "offerId" TEXT,
  "mapVisible" BOOLEAN NOT NULL DEFAULT false,
  "mapMode" "public"."HelpMapMode" NOT NULL DEFAULT 'AREA',
  "address" TEXT,
  "normalizedAddress" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "geocodingStatus" "public"."ServiceMapGeocodingStatus" NOT NULL DEFAULT 'PENDING',
  "geocodingRaw" JSONB,
  "county" TEXT,
  "municipalityIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "serviceArea" TEXT,
  "categoryCode" TEXT,
  "helpType" "public"."HelpType",
  "targetGroupCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "needTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "deliveryModes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "contactMode" "public"."HelpMapContactMode" NOT NULL DEFAULT 'PLATFORM',
  "status" "public"."HelpMapEntryStatus" NOT NULL DEFAULT 'REVIEW',
  "expiresAt" TIMESTAMP(3),
  "privacyNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "HelpMapEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HelpMapEntry_one_listing_chk" CHECK (
    (("requestId" IS NOT NULL AND "offerId" IS NULL AND "kind" = 'HELP_REQUEST') OR
     ("requestId" IS NULL AND "offerId" IS NOT NULL AND "kind" = 'HELP_OFFER'))
  )
);

CREATE UNIQUE INDEX "HelpMapEntry_requestId_key" ON "public"."HelpMapEntry"("requestId");
CREATE UNIQUE INDEX "HelpMapEntry_offerId_key" ON "public"."HelpMapEntry"("offerId");
CREATE INDEX "HelpRequest_expiresAt_idx" ON "public"."HelpRequest"("expiresAt");
CREATE INDEX "HelpOffer_expiresAt_idx" ON "public"."HelpOffer"("expiresAt");
CREATE INDEX "HelpMapEntry_kind_idx" ON "public"."HelpMapEntry"("kind");
CREATE INDEX "HelpMapEntry_mapVisible_idx" ON "public"."HelpMapEntry"("mapVisible");
CREATE INDEX "HelpMapEntry_mapMode_idx" ON "public"."HelpMapEntry"("mapMode");
CREATE INDEX "HelpMapEntry_status_idx" ON "public"."HelpMapEntry"("status");
CREATE INDEX "HelpMapEntry_geocodingStatus_idx" ON "public"."HelpMapEntry"("geocodingStatus");
CREATE INDEX "HelpMapEntry_expiresAt_idx" ON "public"."HelpMapEntry"("expiresAt");
CREATE INDEX "HelpMapEntry_county_idx" ON "public"."HelpMapEntry"("county");

ALTER TABLE "public"."HelpMapEntry"
ADD CONSTRAINT "HelpMapEntry_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "public"."HelpRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."HelpMapEntry"
ADD CONSTRAINT "HelpMapEntry_offerId_fkey"
FOREIGN KEY ("offerId") REFERENCES "public"."HelpOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
