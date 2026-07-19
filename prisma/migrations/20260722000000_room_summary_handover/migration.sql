-- T12 ROOMS-CALLS-V1 — E7 osa 1: kohtumise kokkuvõtte üleandmine osalejatele.
--
-- Omaniku otsus 3 (T12 otsustering 18.07): iga osaleja saab kokkuvõttest
-- privaatse koopia, mis elab üle ruumi kustutuse. Kokkuvõte = spetsialisti
-- kinnitatud (FINAL) MEETING_SUMMARY, mille ta U10 vooga ruumi postitas —
-- seega sisu, mida kõik ruumis olijad on niikuinii näinud (privaatsusdelta 0).
--
-- Puhtalt additiivne: kaks uut tabelit, olemasolevaid ei muudeta.
-- Koopia ise on `SavedAnalysis` (owner-scoped, ilma ruumi-võtmeta) — seetõttu
-- ei kaota ruumi kustutus koopiat.

-- --------------------------------------------------------------------------
-- Jagamise fakt + sisu-snapshot. Snapshot on tahtlik (sama põhimõte mis
-- CallRecordingConsent.consentTextSnapshot'il): artefakti hilisem muutmine või
-- kustutamine ei tohi ümber kirjutada seda, mida osalejad ruumis nägid.
-- @@unique(roomId, artifactId) = sama kokkuvõtte kordusjagamine ei paljunda ridu.
-- --------------------------------------------------------------------------
CREATE TABLE "public"."RoomSharedSummary" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "messageId" TEXT,
    "sharedByUserId" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "sharedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomSharedSummary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoomSharedSummary_roomId_artifactId_key"
  ON "public"."RoomSharedSummary"("roomId", "artifactId");
CREATE INDEX "RoomSharedSummary_roomId_sharedAt_idx"
  ON "public"."RoomSharedSummary"("roomId", "sharedAt");

ALTER TABLE "public"."RoomSharedSummary"
  ADD CONSTRAINT "RoomSharedSummary_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."RoomSharedSummary"
  ADD CONSTRAINT "RoomSharedSummary_sharedByUserId_fkey"
  FOREIGN KEY ("sharedByUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- --------------------------------------------------------------------------
-- Üleandmise pearaamat: kes millise kokkuvõtte koopia sai. Unikaalindeks teeb
-- üleandmise idempotentseks — arhiveerimine ja hilisem kustutus (või korduv
-- päring) ei tekita teist koopiat. savedAnalysisId on SET NULL: kasutaja võib
-- oma koopia kustutada, ilma et üleandmise jälg kaoks.
-- --------------------------------------------------------------------------
CREATE TABLE "public"."RoomSummaryCopy" (
    "id" TEXT NOT NULL,
    "roomSharedSummaryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "savedAnalysisId" TEXT,
    "copiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomSummaryCopy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoomSummaryCopy_roomSharedSummaryId_userId_key"
  ON "public"."RoomSummaryCopy"("roomSharedSummaryId", "userId");
CREATE INDEX "RoomSummaryCopy_userId_copiedAt_idx"
  ON "public"."RoomSummaryCopy"("userId", "copiedAt");

ALTER TABLE "public"."RoomSummaryCopy"
  ADD CONSTRAINT "RoomSummaryCopy_roomSharedSummaryId_fkey"
  FOREIGN KEY ("roomSharedSummaryId") REFERENCES "public"."RoomSharedSummary"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."RoomSummaryCopy"
  ADD CONSTRAINT "RoomSummaryCopy_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."RoomSummaryCopy"
  ADD CONSTRAINT "RoomSummaryCopy_savedAnalysisId_fkey"
  FOREIGN KEY ("savedAnalysisId") REFERENCES "public"."SavedAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;
