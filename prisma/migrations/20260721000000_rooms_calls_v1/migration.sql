-- T12 ROOMS-CALLS-V1 — E2 race-migratsioon: tingimuslikud kirjutused vajavad
-- andmebaasitasandi väravaid, et TOCTOU-aknad ei tekitaks topeltridu. Teenus
-- (lib/calls/service.js) püüab tekkiva P2002 kinni ja tagastab olemasoleva rea,
-- nii et indeks on race-lukk, mitte kasutajale nähtav viga.
--
-- Puhtalt additiivne (ainult uued osalised unikaalindeksid + kaitsev pärand-dedupe).
-- CallSession „üks aktiivne kõne ruumi kohta" partial-unique on JUBA olemas
-- (20260524102000_add_call_sessions: CallSession_one_active_room_call_idx) — EI korrata.

-- --------------------------------------------------------------------------
-- Kaitse enne unikaalindekseid: kui pärandandmed juba rikuvad invarianti
-- (fantoom-osaleja bug, audit ptk 16 K3 / topelt-taotlus ptk 5 K3), sulge/kustuta
-- kõik peale varaseima, muidu CREATE UNIQUE INDEX kukuks olemasolevatel ridadel.
-- Sünteetilises DB-s on need UPDATE'id no-op; toodangus (T27) teevad nad ridu
-- turvaliseks enne indeksi jõustumist.
-- --------------------------------------------------------------------------

-- Topelt-aktiivsed osalused (leftAt IS NULL) sama kasutaja + kõne kohta: hoia
-- varaseim (joinedAt, siis id), sulge ülejäänud.
UPDATE "public"."CallParticipant" cp
SET "leftAt" = NOW(), "updatedAt" = NOW()
WHERE cp."leftAt" IS NULL
  AND EXISTS (
    SELECT 1 FROM "public"."CallParticipant" other
    WHERE other."callSessionId" = cp."callSessionId"
      AND other."userId" = cp."userId"
      AND other."leftAt" IS NULL
      AND (other."joinedAt" < cp."joinedAt"
           OR (other."joinedAt" = cp."joinedAt" AND other."id" < cp."id"))
  );

-- Topelt-avatud salvestustaotlused sama kõne kohta: hoia varaseim, märgi
-- ülejäänud DELETED (avatud hulgast väljas, ei jäta orvustatud egress'i).
UPDATE "public"."CallRecordingRequest" rr
SET "status" = 'DELETED', "updatedAt" = NOW()
WHERE rr."status" IN ('REQUESTED', 'READY_TO_RECORD', 'ACTIVE')
  AND EXISTS (
    SELECT 1 FROM "public"."CallRecordingRequest" other
    WHERE other."callSessionId" = rr."callSessionId"
      AND other."status" IN ('REQUESTED', 'READY_TO_RECORD', 'ACTIVE')
      AND (other."requestedAt" < rr."requestedAt"
           OR (other."requestedAt" = rr."requestedAt" AND other."id" < rr."id"))
  );

-- --------------------------------------------------------------------------
-- Osalised unikaalindeksid (race-lukud)
-- --------------------------------------------------------------------------

-- Üks aktiivne (leftAt IS NULL) osalusrida kasutaja + kõne kohta.
-- Blokeerib topelt-join'i race'i (audit ptk 4 K3, ptk 16 K3 fantoom-osaleja).
CREATE UNIQUE INDEX "CallParticipant_one_active_per_user_idx"
  ON "public"."CallParticipant"("callSessionId", "userId")
  WHERE "leftAt" IS NULL;

-- Üks avatud salvestustaotlus kõne kohta (REQUESTED/READY_TO_RECORD/ACTIVE).
-- Blokeerib topelt-taotluse / topelt-start'i race'i (audit ptk 5 K3, ptk 19 K1/K2).
CREATE UNIQUE INDEX "CallRecordingRequest_one_open_per_call_idx"
  ON "public"."CallRecordingRequest"("callSessionId")
  WHERE "status" IN ('REQUESTED', 'READY_TO_RECORD', 'ACTIVE');

-- --------------------------------------------------------------------------
-- E4 voo-ruumi kustutuskaitse: soft-arhiiv. Voo-põhist ruumi (HELP_MATCH,
-- PRE_INQUIRY, SERVICE_PROVIDER_INQUIRY) ei tohi omanik ühepoolselt kustutada
-- (audit 16 K2) — pakutakse „arhiveeri", mis säilitab ühise ajaloo. Additiivne,
-- NULL = aktiivne ruum (senine käitumine muutumatu).
-- --------------------------------------------------------------------------
ALTER TABLE "public"."Room" ADD COLUMN "archivedAt" TIMESTAMP(3);
CREATE INDEX "Room_archivedAt_idx" ON "public"."Room"("archivedAt");
