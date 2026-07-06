CREATE TYPE "public"."KovFileValidationStatus" AS ENUM ('MISSING', 'VALID', 'INVALID');

ALTER TABLE "public"."MunicipalityKovAdminFile"
ADD COLUMN "validationStatus" "public"."KovFileValidationStatus" NOT NULL DEFAULT 'INVALID',
ADD COLUMN "validationMessage" TEXT,
ADD COLUMN "validatedAt" TIMESTAMP(3);

UPDATE "public"."MunicipalityKovAdminFile"
SET "validationMessage" = 'Validation pending legacy file'
WHERE "validationMessage" IS NULL;

CREATE INDEX "MunicipalityKovAdminFile_validationStatus_idx"
ON "public"."MunicipalityKovAdminFile"("validationStatus");
