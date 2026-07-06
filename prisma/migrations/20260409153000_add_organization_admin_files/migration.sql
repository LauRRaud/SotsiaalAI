CREATE TABLE "OrganizationAdminFile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationAdminFile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrganizationAdminFile_organizationId_idx" ON "OrganizationAdminFile"("organizationId");
CREATE INDEX "OrganizationAdminFile_storagePath_idx" ON "OrganizationAdminFile"("storagePath");

ALTER TABLE "OrganizationAdminFile"
ADD CONSTRAINT "OrganizationAdminFile_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "OrganizationAdmin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
