CREATE TYPE "RagAdminCapability" AS ENUM ('NONE', 'KNOWLEDGE_STEWARD', 'PLATFORM_ADMIN');

ALTER TABLE "User"
ADD COLUMN "ragAdminCapability" "RagAdminCapability" NOT NULL DEFAULT 'NONE';

-- Preserve the current platform owners' access. Future ADMIN rows get NONE and
-- must receive an explicit RAG capability before the browser proxy opens.
UPDATE "User"
SET "ragAdminCapability" = 'PLATFORM_ADMIN'
WHERE "role" = 'ADMIN' OR "isAdmin" = true;
