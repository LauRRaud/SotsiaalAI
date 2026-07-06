CREATE TYPE "OrganizationAdminFileRole" AS ENUM ('SOURCES_JSON', 'DATA_JSON', 'META_JSON', 'RAG_MD', 'ATTACHMENT');

ALTER TABLE "OrganizationAdminFile"
ADD COLUMN "role" "OrganizationAdminFileRole" NOT NULL DEFAULT 'ATTACHMENT';

CREATE INDEX "OrganizationAdminFile_role_idx" ON "OrganizationAdminFile"("role");
