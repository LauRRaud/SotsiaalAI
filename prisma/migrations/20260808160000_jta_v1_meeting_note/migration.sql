-- JTA-V1 (E4) — kohtumise märge kaheksa kihiga.
--
-- Leping: docs/platvormi arendus/jta-v1-arendusleping.md (v6), etapp E4.
-- Migratsioon 2/4. E5 (mustand) ja E6 (ülekandeaudit) tulevad eraldi: iga
-- migratsioon lisab isikuandmete kandja ja väärib oma ülevaatust.
--
-- TÄIESTI ADDITIIVNE: kaks uut tabelit, ühtegi uut enum'i. Ühtegi olemasolevat
-- veergu ega rida ei puudutata. Ilma `CASEWORK_V1_ENABLED` liputa ei ole nendes
-- tabelites ühtki rida.
--
-- KÄSITSI KIRJUTATUD, MITTE `migrate diff` VÄLJUND — sama põhjus mis E3-l: diff
-- arendusbaasi vastu kannab kaasa võõra triivi, mis ei ole selle etapi töö.
--
-- NELI ASJA, MIDA HILJEM LÕDVENDADA EI TOHI:
--
--   1. `layer` on TEKST, mitte enum, ja see on lepingus nimeliselt lukus (L5).
--      Kaheksa kihti on ptk 4.4 VALDKONNASÕNASTIK — sama liiki asi mis
--      `provenance` —, mitte selle tabeli vorminupud. Erinevus E3
--      `fieldKey`/`kind`-ist, mis ON enum'id: nemad kirjeldavad ühe vormi kuju
--      ja uus väärtus tähendab uut vormirida.
--
--   2. `meetingPrepId` on `SetNull`, MITTE `Cascade`. Ettevalmistus on
--      tulevikuplaan ja teda tohib kustutada; märge on kohtumise JÄLG ja ta ei
--      tohi kaduda koos plaaniga, mille põhjal kohtumine toimus. `Cascade`
--      tähendaks, et plaani kustutus võtab kaasa tõendi selle kohta, mis
--      päriselt räägiti.
--
--   3. `provenance` ja `layer` on MÕLEMAD `NOT NULL` ja mõlemal on `CHECK`
--      tühja stringi vastu. `NOT NULL` üksi lubaks `''` ehk „märgistatud
--      tühjaga" — täpselt see auk, mille `NOT NULL` pidi sulgema. Sõnastiku
--      SISU jõustab teenuskiht; andmebaas jõustab seda, et midagi seal ON.
--
--   4. Märkmel EI OLE kustutusrada ja seda ei tohi hiljem „sümmeetria pärast"
--      juurde kirjutada. Üksik kirje on eemaldatav (`removeEntry`), märge
--      tervikuna mitte. Juhtumi kustutus viib ta kaskaadis — ja just see teeb
--      säilitusreegli lõpus kustutuse päris kustutuseks.

-- CreateTable
CREATE TABLE "CaseWorkMeetingNote" (
    "id" TEXT NOT NULL,
    "caseWorkAssistId" TEXT NOT NULL,
    "meetingPrepId" TEXT,
    "meetingAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseWorkMeetingNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseWorkMeetingNoteEntry" (
    "id" TEXT NOT NULL,
    "meetingNoteId" TEXT NOT NULL,
    "layer" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "provenance" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseWorkMeetingNoteEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaseWorkMeetingNote_caseWorkAssistId_meetingAt_idx" ON "CaseWorkMeetingNote"("caseWorkAssistId", "meetingAt");

-- CreateIndex
CREATE INDEX "CaseWorkMeetingNote_caseWorkAssistId_createdAt_idx" ON "CaseWorkMeetingNote"("caseWorkAssistId", "createdAt");

-- CreateIndex
CREATE INDEX "CaseWorkMeetingNote_meetingPrepId_idx" ON "CaseWorkMeetingNote"("meetingPrepId");

-- CreateIndex
CREATE INDEX "CaseWorkMeetingNoteEntry_meetingNoteId_layer_ordinal_idx" ON "CaseWorkMeetingNoteEntry"("meetingNoteId", "layer", "ordinal");

-- CreateIndex
CREATE INDEX "CaseWorkMeetingNoteEntry_meetingNoteId_ordinal_idx" ON "CaseWorkMeetingNoteEntry"("meetingNoteId", "ordinal");

-- AddForeignKey
ALTER TABLE "CaseWorkMeetingNote" ADD CONSTRAINT "CaseWorkMeetingNote_caseWorkAssistId_fkey" FOREIGN KEY ("caseWorkAssistId") REFERENCES "CaseWorkAssist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseWorkMeetingNote" ADD CONSTRAINT "CaseWorkMeetingNote_meetingPrepId_fkey" FOREIGN KEY ("meetingPrepId") REFERENCES "CaseWorkMeetingPrep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseWorkMeetingNoteEntry" ADD CONSTRAINT "CaseWorkMeetingNoteEntry_meetingNoteId_fkey" FOREIGN KEY ("meetingNoteId") REFERENCES "CaseWorkMeetingNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Kiht ja päritolu ei tohi olla tühjad stringid — vt punkt 3 päises.
ALTER TABLE "CaseWorkMeetingNoteEntry"
  ADD CONSTRAINT "CaseWorkMeetingNoteEntry_layer_not_blank"
  CHECK (length(btrim("layer")) > 0);

ALTER TABLE "CaseWorkMeetingNoteEntry"
  ADD CONSTRAINT "CaseWorkMeetingNoteEntry_provenance_not_blank"
  CHECK (length(btrim("provenance")) > 0);
