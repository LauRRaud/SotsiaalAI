CREATE TYPE "public"."KovAdminStatus" AS ENUM ('NOT_STARTED', 'DRAFT', 'READY_FOR_INGEST', 'INGESTED', 'NEEDS_REVIEW');

CREATE TYPE "public"."KovAdminFileRole" AS ENUM ('SOURCES_JSON', 'DATA_JSON', 'META_JSON', 'RAG_MD');

CREATE TABLE "public"."MunicipalityKovAdmin" (
    "id" TEXT NOT NULL,
    "municipalityId" TEXT NOT NULL,
    "officialWebsite" TEXT,
    "riigiTeatajaUrl" TEXT,
    "status" "public"."KovAdminStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "checkedAt" TIMESTAMP(3),
    "notes" TEXT,
    "readyForIngest" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MunicipalityKovAdmin_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."MunicipalityKovAdminFile" (
    "id" TEXT NOT NULL,
    "kovAdminId" TEXT NOT NULL,
    "role" "public"."KovAdminFileRole" NOT NULL,
    "originalName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MunicipalityKovAdminFile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MunicipalityKovAdmin_municipalityId_key" ON "public"."MunicipalityKovAdmin"("municipalityId");
CREATE INDEX "MunicipalityKovAdmin_status_idx" ON "public"."MunicipalityKovAdmin"("status");
CREATE INDEX "MunicipalityKovAdmin_checkedAt_idx" ON "public"."MunicipalityKovAdmin"("checkedAt");
CREATE INDEX "MunicipalityKovAdmin_readyForIngest_idx" ON "public"."MunicipalityKovAdmin"("readyForIngest");

CREATE UNIQUE INDEX "MunicipalityKovAdminFile_kovAdminId_role_key" ON "public"."MunicipalityKovAdminFile"("kovAdminId", "role");
CREATE INDEX "MunicipalityKovAdminFile_role_idx" ON "public"."MunicipalityKovAdminFile"("role");
CREATE INDEX "MunicipalityKovAdminFile_storagePath_idx" ON "public"."MunicipalityKovAdminFile"("storagePath");

ALTER TABLE "public"."MunicipalityKovAdmin"
ADD CONSTRAINT "MunicipalityKovAdmin_municipalityId_fkey"
FOREIGN KEY ("municipalityId") REFERENCES "public"."Municipality"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."MunicipalityKovAdminFile"
ADD CONSTRAINT "MunicipalityKovAdminFile_kovAdminId_fkey"
FOREIGN KEY ("kovAdminId") REFERENCES "public"."MunicipalityKovAdmin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
