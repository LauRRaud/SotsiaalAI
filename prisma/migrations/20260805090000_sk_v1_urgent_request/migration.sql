-- SOTSIAALKIIRABI-V1 (SK-V1) — pöörduja-poolne kiireloomulise abi kanal.
-- Avalik nimi „Kiireloomuline abipalve" (O-SK-7).
--
-- Kaks asja kannavad siin kogu ohutuslukku ja neid ei tohi hiljem lõdvendada:
--
--   1. "UrgentRequest"."deskId" on NOT NULL viide "UrgentDesk"-ile. Pöördumist
--      ILMA vastuvõtva lauata ei saa andmebaasis eksisteerida. Lüliti ei ole
--      funktsioonilipp ega UI-peitmine — ta on see FK. Lekkinud lipp, vana
--      vahemälu, otse-URL ega rolli väärseadistus ei suuda toota nuppu, mis ei
--      vii kuhugi.
--   2. "UrgentDesk"."readingTimePromise" ja "emergencyBoundary" on NOT NULL.
--      Laud, mis ei ütle, MILLAL keegi loeb ja MILLAL tuleb helistada 112,
--      ei ole laud. Reageerimisaega platvorm ei luba kunagi.
--
-- "UrgentDesk"."isActive" ja "directContactAllowed" on vaikimisi FALSE: laud ei
-- teki kogemata ja Estkeeri õppetund („öisel teenusel oli päevane värav") on
-- kirjas veeruna, mitte kommentaarina.
--
-- ADDITIIVNE: neli uut enum'i, kolm uut tabelit. Olemasolevaid ridu ei
-- puudutata, ühtegi veergu ei muudeta. Ilma seadistatud lauata on kogu
-- funktsioon peidus ja päris isikuandmeteta.

CREATE TYPE "UrgentRequestRecipientType" AS ENUM (
  'KOV_CONTACT',
  'SERVICE_PROVIDER'
);

CREATE TYPE "UrgentRequestStatus" AS ENUM (
  'SENT',
  'READ',
  'TAKEN',
  'DECLINED',
  'RESOLVED',
  'EXPIRED',
  'RECALLED'
);

CREATE TYPE "UrgentRequestEventKind" AS ENUM (
  'CREATED',
  'VIEWED',
  'READ_MARKED',
  'TAKEN',
  'DECLINED',
  'RESOLVED',
  'RECALLED',
  'EXPIRED',
  'HANDED_OVER',
  'HANDOVER_ACCEPTED',
  'CONVERTED'
);

CREATE TABLE "UrgentDesk" (
  "id"                    TEXT NOT NULL,
  "municipalityId"        TEXT NOT NULL,
  "recipientType"         "UrgentRequestRecipientType" NOT NULL DEFAULT 'KOV_CONTACT',
  "publicName"            TEXT NOT NULL,
  "ownerUserId"           TEXT,
  "serviceEntryId"        TEXT,
  "openingHours"          TEXT NOT NULL,
  "whoMayContact"         TEXT NOT NULL,
  "preAssessmentRequired" BOOLEAN NOT NULL DEFAULT false,
  "costToPerson"          TEXT NOT NULL,
  "readingTimePromise"    TEXT NOT NULL,
  "contactChannel"        TEXT NOT NULL,
  "emergencyBoundary"     TEXT NOT NULL,
  -- Aegumisaken on LAUA oma, mitte globaalne konstant: 30-minutise lubadusega
  -- laud ei tohi lasta inimesel ööpäeva rippuda.
  "requestLifetimeHours"  INTEGER NOT NULL DEFAULT 24,
  "directContactAllowed"  BOOLEAN NOT NULL DEFAULT false,
  "isActive"              BOOLEAN NOT NULL DEFAULT false,
  "lastVerifiedAt"        TIMESTAMP(3),
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UrgentDesk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UrgentDeskMember" (
  "id"       TEXT NOT NULL,
  "deskId"   TEXT NOT NULL,
  "userId"   TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "addedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UrgentDeskMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UrgentRequest" (
  "id"                    TEXT NOT NULL,
  "authorId"              TEXT,
  "authorErasedAt"        TIMESTAMP(3),
  "deskId"                TEXT NOT NULL,
  "municipalityId"        TEXT NOT NULL,
  "recipientType"         "UrgentRequestRecipientType" NOT NULL,
  "situationVerbatim"     TEXT NOT NULL,
  "assistantStructured"   TEXT,
  "contactName"           TEXT NOT NULL,
  "contactPhone"          TEXT NOT NULL,
  "safetyAnswer"          BOOLEAN NOT NULL DEFAULT false,
  "status"                "UrgentRequestStatus" NOT NULL DEFAULT 'SENT',
  "readingTimePromise"    TEXT NOT NULL,
  "sentAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt"                TIMESTAMP(3),
  "takenAt"               TIMESTAMP(3),
  "declinedAt"            TIMESTAMP(3),
  "declineReason"         TEXT,
  "resolvedAt"            TIMESTAMP(3),
  "expiresAt"             TIMESTAMP(3) NOT NULL,
  "recalledAt"            TIMESTAMP(3),
  "handoverDeskId"        TEXT,
  "handedOverAt"          TIMESTAMP(3),
  "handoverAcceptedAt"    TIMESTAMP(3),
  "handoverNote"          TEXT,
  "convertedPreInquiryId" TEXT,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UrgentRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UrgentRequestEvent" (
  "id"        TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "kind"      "UrgentRequestEventKind" NOT NULL,
  "actorId"   TEXT,
  "note"      TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UrgentRequestEvent_pkey" PRIMARY KEY ("id")
);

-- Üks laud piirkonna ja saajatüübi kohta: kaks aktiivset KOV-lauda samas vallas
-- tähendaks, et pöördumine läheb sinna, kus keegi teda ei oota.
CREATE UNIQUE INDEX "UrgentDesk_municipalityId_recipientType_key" ON "UrgentDesk"("municipalityId", "recipientType");
CREATE INDEX "UrgentDesk_isActive_idx" ON "UrgentDesk"("isActive");
CREATE INDEX "UrgentDesk_ownerUserId_idx" ON "UrgentDesk"("ownerUserId");
CREATE INDEX "UrgentDesk_serviceEntryId_idx" ON "UrgentDesk"("serviceEntryId");

CREATE UNIQUE INDEX "UrgentDeskMember_deskId_userId_key" ON "UrgentDeskMember"("deskId", "userId");
CREATE INDEX "UrgentDeskMember_userId_isActive_idx" ON "UrgentDeskMember"("userId", "isActive");

CREATE UNIQUE INDEX "UrgentRequest_convertedPreInquiryId_key" ON "UrgentRequest"("convertedPreInquiryId");
CREATE INDEX "UrgentRequest_deskId_status_sentAt_idx" ON "UrgentRequest"("deskId", "status", "sentAt");
CREATE INDEX "UrgentRequest_authorId_sentAt_idx" ON "UrgentRequest"("authorId", "sentAt");
-- Aegumise korje käib selle indeksi pealt: ükski kirje ei tohi jääda rippuma.
CREATE INDEX "UrgentRequest_status_expiresAt_idx" ON "UrgentRequest"("status", "expiresAt");
CREATE INDEX "UrgentRequest_municipalityId_sentAt_idx" ON "UrgentRequest"("municipalityId", "sentAt");
CREATE INDEX "UrgentRequest_handoverDeskId_handoverAcceptedAt_idx" ON "UrgentRequest"("handoverDeskId", "handoverAcceptedAt");

CREATE INDEX "UrgentRequestEvent_requestId_createdAt_idx" ON "UrgentRequestEvent"("requestId", "createdAt");
CREATE INDEX "UrgentRequestEvent_actorId_createdAt_idx" ON "UrgentRequestEvent"("actorId", "createdAt");

ALTER TABLE "UrgentDesk" ADD CONSTRAINT "UrgentDesk_municipalityId_fkey"
  FOREIGN KEY ("municipalityId") REFERENCES "Municipality"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UrgentDesk" ADD CONSTRAINT "UrgentDesk_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UrgentDesk" ADD CONSTRAINT "UrgentDesk_serviceEntryId_fkey"
  FOREIGN KEY ("serviceEntryId") REFERENCES "ServiceMapEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UrgentDeskMember" ADD CONSTRAINT "UrgentDeskMember_deskId_fkey"
  FOREIGN KEY ("deskId") REFERENCES "UrgentDesk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UrgentDeskMember" ADD CONSTRAINT "UrgentDeskMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UrgentRequest" ADD CONSTRAINT "UrgentRequest_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- RESTRICT, mitte CASCADE: laua kustutamine ei tohi vaikselt kaasa võtta
-- pöördumisi, mille kohta inimesele lubati, et keegi need läbi loeb.
ALTER TABLE "UrgentRequest" ADD CONSTRAINT "UrgentRequest_deskId_fkey"
  FOREIGN KEY ("deskId") REFERENCES "UrgentDesk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UrgentRequest" ADD CONSTRAINT "UrgentRequest_handoverDeskId_fkey"
  FOREIGN KEY ("handoverDeskId") REFERENCES "UrgentDesk"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UrgentRequest" ADD CONSTRAINT "UrgentRequest_municipalityId_fkey"
  FOREIGN KEY ("municipalityId") REFERENCES "Municipality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UrgentRequest" ADD CONSTRAINT "UrgentRequest_convertedPreInquiryId_fkey"
  FOREIGN KEY ("convertedPreInquiryId") REFERENCES "PreInquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UrgentRequestEvent" ADD CONSTRAINT "UrgentRequestEvent_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "UrgentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UrgentRequestEvent" ADD CONSTRAINT "UrgentRequestEvent_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
