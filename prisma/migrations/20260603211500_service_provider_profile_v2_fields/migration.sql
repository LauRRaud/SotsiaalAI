ALTER TABLE "ServiceProviderProfile"
  ADD COLUMN "organizationType" TEXT,
  ADD COLUMN "registryCode" TEXT,
  ADD COLUMN "longDescription" TEXT,
  ADD COLUMN "primaryContactName" TEXT,
  ADD COLUMN "generalAccessibilityNote" TEXT,
  ADD COLUMN "assistantRecommendationAllowed" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ServiceProviderService"
  ADD COLUMN "longDescription" TEXT,
  ADD COLUMN "includesText" TEXT,
  ADD COLUMN "excludesText" TEXT,
  ADD COLUMN "additionalInfo" TEXT,
  ADD COLUMN "categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "ageGroups" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "requesterRoles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "needTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "lifeDomains" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "deliveryModes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "serviceAreaType" TEXT,
  ADD COLUMN "county" TEXT,
  ADD COLUMN "municipalityIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "areaDescription" TEXT,
  ADD COLUMN "serviceLanguages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "inquiryLanguages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "communicationSupport" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "availabilityStatus" TEXT,
  ADD COLUMN "availabilityDescription" TEXT,
  ADD COLUMN "directContactAllowed" TEXT,
  ADD COLUMN "requiresKovAssessment" TEXT,
  ADD COLUMN "requiresKovDecision" TEXT,
  ADD COLUMN "requiresSkaReferral" TEXT,
  ADD COLUMN "requiresSpecialistReferral" TEXT,
  ADD COLUMN "requiredDocumentsNote" TEXT,
  ADD COLUMN "referralNotes" TEXT,
  ADD COLUMN "contactMode" TEXT;

ALTER TABLE "ServiceProviderLocation"
  ADD COLUMN "openingHours" TEXT;
