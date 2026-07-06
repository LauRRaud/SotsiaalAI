CREATE TYPE "OrganizationFileValidationStatus" AS ENUM ('MISSING', 'VALID', 'INVALID');

ALTER TABLE "OrganizationAdminFile"
ADD COLUMN "validationStatus" "OrganizationFileValidationStatus" NOT NULL DEFAULT 'INVALID',
ADD COLUMN "validationMessage" TEXT,
ADD COLUMN "validatedAt" TIMESTAMP(3);
