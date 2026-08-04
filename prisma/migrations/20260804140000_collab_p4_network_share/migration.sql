-- COLLAB-P4 — võrgustikujagamise kitsas esimene vertikaal.
--
-- Töötaja jagab ühe eelpöördumise põhjal koostatud KÜLMUTATUD kokkuvõtte ühele
-- teenuseosutajale, ja klient kinnitab enne saatmist, mida jagatakse.
--
-- Kaks väljajäetust kannavad kogu lõigu õiguslikku väravat:
--   1. "recipientUserId" on NOT NULL viide User-ile. E-posti kutset ega
--      userId=NULL rada siin EI OLE -> lõik jääb O-CO-6-st välja.
--      Mittekasutajate rada on COLLAB-P5, koos raamlepingu väravaga.
--   2. Vaba võrgustikukaarti kolmandate isikute kirjetega ei ole.
--
-- "participationEndsOn" on NOT NULL: kaardistamise lõpp on kohustuslik väli,
-- "igavesti vaikimisi" on keelatud.
--
-- ADDITIIVNE: uus tabel ja uus enum, olemasolevaid ridu ei puudutata.

CREATE TYPE "NetworkShareStatus" AS ENUM (
  'DRAFT',
  'AWAITING_CLIENT',
  'CONFIRMED',
  'DECLINED',
  'SENT',
  'OPENED',
  'RESPONDED',
  'RECALLED',
  'ENDED'
);

CREATE TABLE "NetworkShare" (
  "id"                  TEXT NOT NULL,
  "sourcePreInquiryId"  TEXT NOT NULL,
  "workerId"            TEXT NOT NULL,
  "clientUserId"        TEXT NOT NULL,
  "recipientUserId"     TEXT NOT NULL,
  "summaryText"         TEXT NOT NULL,
  "purpose"             TEXT NOT NULL,
  "sharingBoundary"     TEXT NOT NULL,
  "participationEndsOn" DATE NOT NULL,
  "status"              "NetworkShareStatus" NOT NULL DEFAULT 'DRAFT',
  "clientConfirmedAt"   TIMESTAMP(3),
  "clientDeclinedAt"    TIMESTAMP(3),
  "clientDecisionNote"  TEXT,
  "sentAt"              TIMESTAMP(3),
  "openedAt"            TIMESTAMP(3),
  "recalledAt"          TIMESTAMP(3),
  "respondedAt"         TIMESTAMP(3),
  "roomId"              TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NetworkShare_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NetworkShare_roomId_key" ON "NetworkShare"("roomId");
CREATE INDEX "NetworkShare_workerId_status_idx" ON "NetworkShare"("workerId", "status");
CREATE INDEX "NetworkShare_clientUserId_status_idx" ON "NetworkShare"("clientUserId", "status");
CREATE INDEX "NetworkShare_recipientUserId_status_idx" ON "NetworkShare"("recipientUserId", "status");
CREATE INDEX "NetworkShare_sourcePreInquiryId_idx" ON "NetworkShare"("sourcePreInquiryId");

ALTER TABLE "NetworkShare" ADD CONSTRAINT "NetworkShare_sourcePreInquiryId_fkey"
  FOREIGN KEY ("sourcePreInquiryId") REFERENCES "PreInquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NetworkShare" ADD CONSTRAINT "NetworkShare_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NetworkShare" ADD CONSTRAINT "NetworkShare_clientUserId_fkey"
  FOREIGN KEY ("clientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NetworkShare" ADD CONSTRAINT "NetworkShare_recipientUserId_fkey"
  FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NetworkShare" ADD CONSTRAINT "NetworkShare_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
