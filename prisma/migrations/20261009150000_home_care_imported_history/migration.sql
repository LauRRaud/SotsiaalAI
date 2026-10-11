-- KODUTEENUS K1-f — imporditud ajalugu: kliendi senine päevik ühe tekstina.
--
-- Aditiivne: kaks uut tabelit. Olemasolevaid tabeleid ei muudeta; eelmine
-- rakenduse versioon neid tabeleid ei loe.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "CareImportedHistory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "charCount" INTEGER NOT NULL,
    "blockCount" INTEGER NOT NULL,
    "contentSha256" TEXT NOT NULL,
    "importedByMembershipId" TEXT NOT NULL,
    "importedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareImportedHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CareImportedHistoryBlock" (
    "id" TEXT NOT NULL,
    "historyId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "searchText" TEXT,
    "searchVersion" TEXT,

    CONSTRAINT "CareImportedHistoryBlock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CareImportedHistory_clientId_contentSha256_key" ON "CareImportedHistory"("clientId", "contentSha256");

CREATE INDEX "CareImportedHistory_clientId_createdAt_idx" ON "CareImportedHistory"("clientId", "createdAt");

CREATE UNIQUE INDEX "CareImportedHistoryBlock_historyId_position_key" ON "CareImportedHistoryBlock"("historyId", "position");

CREATE INDEX "CareImportedHistoryBlock_clientId_idx" ON "CareImportedHistoryBlock"("clientId");

ALTER TABLE "CareImportedHistory" ADD CONSTRAINT "CareImportedHistory_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "CareClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CareImportedHistoryBlock" ADD CONSTRAINT "CareImportedHistoryBlock_historyId_fkey" FOREIGN KEY ("historyId") REFERENCES "CareImportedHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reeglid, mida Prisma skeem ei väljenda: pealkiri ei ole tühi, lõikeid on vähemalt üks.
ALTER TABLE "CareImportedHistory"
  ADD CONSTRAINT "CareImportedHistory_title_not_blank" CHECK (length(btrim("title")) > 0);

ALTER TABLE "CareImportedHistory"
  ADD CONSTRAINT "CareImportedHistory_block_count_positive" CHECK ("blockCount" >= 1);

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE IF EXISTS "CareImportedHistoryBlock" CASCADE;
--   DROP TABLE IF EXISTS "CareImportedHistory"      CASCADE;
