-- T20 COLLAB-V1 — P1 auditiausus + P2 kokkuvõtte kinnitusring.
--
-- Puhtalt additiivne: üks enum-väärtus, üks veerg, üks enum, üks tabel.
-- Olemasolevaid ridu ei muudeta.
--
-- P1 (RUUM-A0 8 K2): U10 jagamine saab artefakti auditijälge sama
-- DocumentAudit süsteemi sisse — DataAuditLog string-action oleks killustanud
-- artefakti auditi kahte süsteemi.
ALTER TYPE "public"."DocumentAuditAction" ADD VALUE 'ARTIFACT_SHARE';

-- P2 (O-CO-2 = a): kinnitusring on valikuline — jagaja otsustab. Null = ringi
-- ei küsitud. Ümberjagamine uue sisuga nullib vastused (vt lib/rooms/summaryApproval.js).
ALTER TABLE "public"."RoomSharedSummary" ADD COLUMN "approvalRequestedAt" TIMESTAMP(3);

-- P2: osaleja vastus — kinnitus või eriarvamus (eriarvamus SÄILIB, klass 9
-- leping). Unikaalindeks: üks kehtiv vastus osaleja kohta; vastuse muutmine on
-- update, mitte teine rida.
CREATE TYPE "public"."RoomSummaryApprovalStatus" AS ENUM ('APPROVED', 'CORRECTION');

CREATE TABLE "public"."RoomSummaryApproval" (
    "id" TEXT NOT NULL,
    "roomSharedSummaryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "public"."RoomSummaryApprovalStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomSummaryApproval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoomSummaryApproval_roomSharedSummaryId_userId_key"
  ON "public"."RoomSummaryApproval"("roomSharedSummaryId", "userId");
CREATE INDEX "RoomSummaryApproval_userId_createdAt_idx"
  ON "public"."RoomSummaryApproval"("userId", "createdAt");

ALTER TABLE "public"."RoomSummaryApproval"
  ADD CONSTRAINT "RoomSummaryApproval_roomSharedSummaryId_fkey"
  FOREIGN KEY ("roomSharedSummaryId") REFERENCES "public"."RoomSharedSummary"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."RoomSummaryApproval"
  ADD CONSTRAINT "RoomSummaryApproval_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
