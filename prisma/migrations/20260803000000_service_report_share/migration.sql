-- TEENUSPÄEVIK — kuuaruande jagamine osakonna juhatajale.
--
-- Omaniku nõue 02.08: „kui sina oled koduhoolduse või sotsiaaltöötaja
-- kodukülastusel, siis tuleks jagada oma tulemusi ka osakonna juhatajaga või
-- vastutava isikuga".
--
-- ALGATAJA ON TÖÖTAJA. Juht ei võta aruannet ise — ta saab selle. Nii on ka
-- tööheaolu rajal ja põhjus on sama: jagamine on saatmine, mitte ligipääs.
CREATE TYPE "ServiceReportShareStatus" AS ENUM ('SENT', 'OPENED', 'RECALLED');

CREATE TABLE "ServiceReportShare" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "recipientMembershipId" TEXT NOT NULL,
  "month" TEXT NOT NULL,
  -- KÜLMUTATUD KOOPIA, mitte viide omaniku dokumendile. Kaks põhjust:
  -- (1) org-kiht ei tohi omada võõrvõtit privaatobjekti (§D8) ja
  -- (2) omaniku dokumendi kustutamine ei tohi juhile saadetut vaikselt ära võtta.
  "storagePath" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mime" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "kovName" TEXT,
  "entryCount" INTEGER,
  "note" TEXT,
  "status" "ServiceReportShareStatus" NOT NULL DEFAULT 'SENT',
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "openedAt" TIMESTAMP(3),
  "recalledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceReportShare_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ServiceReportShare_ownerUserId_sentAt_idx" ON "ServiceReportShare" ("ownerUserId", "sentAt");
CREATE INDEX "ServiceReportShare_recipientMembershipId_status_sentAt_idx" ON "ServiceReportShare" ("recipientMembershipId", "status", "sentAt");
CREATE INDEX "ServiceReportShare_organizationId_month_idx" ON "ServiceReportShare" ("organizationId", "month");
CREATE INDEX "ServiceReportShare_documentId_idx" ON "ServiceReportShare" ("documentId");

-- OSALINE UNIKAALINDEKS, mitte täisunikaalne paar. Sama aruannet ei saa samale
-- juhile kaks korda KEHTIVALT saata (topeltteade sama asja kohta), aga
-- tagasivõetud jagamise saab uuesti saata — muidu tähendaks üks eksikliki
-- „tagasi võta", et seda aruannet ei saa sellele juhile enam kunagi saata.
CREATE UNIQUE INDEX "ServiceReportShare_active_unique"
  ON "ServiceReportShare" ("documentId", "recipientMembershipId")
  WHERE "recalledAt" IS NULL;

-- `documentId` ON VIIDE ILMA VÕÕRVÕTITA ja see on TEADLIK (sama muster mis
-- `WellbeingSupportShare.sourceRecordId`). Ta on omaniku enda loendi jaoks
-- („millist aruannet ma jagasin") ja saaja päring ei tohi teda kunagi joinida.
ALTER TABLE "ServiceReportShare" ADD CONSTRAINT "ServiceReportShare_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceReportShare" ADD CONSTRAINT "ServiceReportShare_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceReportShare" ADD CONSTRAINT "ServiceReportShare_recipientMembershipId_fkey"
  FOREIGN KEY ("recipientMembershipId") REFERENCES "OrganizationMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
