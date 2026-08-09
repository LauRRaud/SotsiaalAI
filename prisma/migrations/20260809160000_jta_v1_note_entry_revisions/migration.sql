-- JTA-V1 / SOL-CW-15 — kohtumise märkme parandus ja tühistus jätavad jälje.
--
-- Audit: docs/audits/sotsiaalai-sol-suvaaudit.md, SOL-CW-15.
--
-- MIKS SEE MIGRATSIOON OLEMAS ON. Märkme konteineril ei ole `DELETE`-i
-- põhjendusega, et märge on toimunud kohtumise jälg. Samal ajal lubasid
-- `updateEntry()` ja `removeEntry()` teksti muuta või rea KÕVASTI kustutada
-- ilma versiooni-, paranduse- ega auditireata. Kõik sisuread sai ükshaaval
-- eemaldada ja alles jäi tühi konteiner, mis näis endiselt kohtumise tõendina.
-- Hilisema vaidluse või järelevalve korral ei eristanud miski algset märget,
-- parandust ja kustutamist.

-- AlterTable
ALTER TABLE "CaseWorkMeetingNoteEntry"
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "retractedAt" TIMESTAMP(3);

-- Versioon algab ühest ja ei lähe tagasi.
ALTER TABLE "CaseWorkMeetingNoteEntry"
  ADD CONSTRAINT "CaseWorkMeetingNoteEntry_revision_positive" CHECK ("revision" >= 1);

-- CreateEnum
CREATE TYPE "CaseWorkNoteRevisionKind" AS ENUM ('CORRECTION', 'RETRACTION');

-- CreateTable
CREATE TABLE "CaseWorkMeetingNoteEntryRevision" (
  "id" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "meetingNoteId" TEXT NOT NULL,
  "kind" "CaseWorkNoteRevisionKind" NOT NULL,
  "layer" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "provenance" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "revision" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CaseWorkMeetingNoteEntryRevision_pkey" PRIMARY KEY ("id")
);

-- PÕHJUS EI TOHI OLLA TÜHI. Ilma selleta oleks „kohustuslik põhjus" ainult
-- teenuskihi lubadus ja tühi string läheks vaikselt läbi — parandus ilma
-- põhjuseta on sama, mis parandus ilma jäljeta.
ALTER TABLE "CaseWorkMeetingNoteEntryRevision"
  ADD CONSTRAINT "CaseWorkMeetingNoteEntryRevision_reason_not_blank" CHECK (btrim("reason") <> '');

ALTER TABLE "CaseWorkMeetingNoteEntryRevision"
  ADD CONSTRAINT "CaseWorkMeetingNoteEntryRevision_revision_positive" CHECK ("revision" >= 1);

-- CreateIndex
CREATE INDEX "CaseWorkMeetingNoteEntryRevision_entryId_revision_idx"
  ON "CaseWorkMeetingNoteEntryRevision"("entryId", "revision");

CREATE INDEX "CaseWorkMeetingNoteEntryRevision_meetingNoteId_createdAt_idx"
  ON "CaseWorkMeetingNoteEntryRevision"("meetingNoteId", "createdAt");

CREATE INDEX "CaseWorkMeetingNoteEntry_meetingNoteId_retractedAt_ordinal_idx"
  ON "CaseWorkMeetingNoteEntry"("meetingNoteId", "retractedAt", "ordinal");

-- AddForeignKey
ALTER TABLE "CaseWorkMeetingNoteEntryRevision"
  ADD CONSTRAINT "CaseWorkMeetingNoteEntryRevision_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "CaseWorkMeetingNoteEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- MUUTUMATUS ON ANDMEBAASI OMA, MITTE TEENUSKIHI LUBADUS.
--
-- Sama muster mis `UsageEvent`-il (migratsioon 20260711120000). `UPDATE` on
-- keelatud; `DELETE` EI OLE — konto kustutus ja säilituse purge peavad kaskaadi
-- kaudu läbi minema ja nemad viivad kaasa terve juhtumi, mitte üksiku tõendi.
-- Piir on aus: parandusrida ei saa MUUTA, ta saab kaduda ainult koos juhtumiga.
CREATE FUNCTION "prevent_note_revision_update"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'CaseWorkMeetingNoteEntryRevision rows are immutable; append a new revision instead';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "CaseWorkMeetingNoteEntryRevision_prevent_update"
  BEFORE UPDATE ON "CaseWorkMeetingNoteEntryRevision"
  FOR EACH ROW EXECUTE FUNCTION "prevent_note_revision_update"();
