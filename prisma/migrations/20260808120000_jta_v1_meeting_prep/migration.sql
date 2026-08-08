-- JTA-V1 (E3) — kohtumise ettevalmistus.
--
-- Leping: docs/platvormi arendus/jta-v1-arendusleping.md (v6), etapp E3.
-- Migratsioon 1/4. Ülejäänud kolm (E4 märge, E5 mustand, E6 ülekandeaudit)
-- tulevad ERALDI: iga migratsioon lisab isikuandmete kandja ja väärib oma
-- ülevaatust, seega neid ei liideta kokku.
--
-- TÄIESTI ADDITIIVNE: kaks uut enum'i, kolm uut tabelit. Ühtegi olemasolevat
-- veergu ega rida ei puudutata. Ilma `CASEWORK_V1_ENABLED` liputa ei ole nendes
-- tabelites ühtki rida — funktsioon on deploy'tav enne aktiveerimisotsust.
--
-- KÄSITSI KIRJUTATUD, MITTE `migrate diff` VÄLJUND. Diff arendusbaasi vastu tõi
-- kaasa võõra triivi (`DROP TABLE "AnalyzeUsageLegacy"`, mitu `ALTER COLUMN`,
-- kaks `DROP CONSTRAINT`), mis EI OLE selle etapi töö. Kokku liidetuna oleks üks
-- „lisa kolm tabelit" migratsioon kustutanud tabeli ja muutnud veerutüüpe
-- kolmes võõras mudelis.
--
-- NELI ASJA, MIDA HILJEM LÕDVENDADA EI TOHI:
--
--   1. `provenance` on MÕLEMAL lapsel `NOT NULL`. See on L4 kogu mõte:
--      päritoluta sisu ei tohi tekkida. `NULL`-i lubamine tähendaks, et
--      „märgistamata" saab vaikselt tähendada „inimese kirjutatud" — ja AI
--      mustandi märgis kaoks täpselt sealt, kus ta loeb. Vaikeväärtust
--      TEADLIKULT EI OLE: vaikeväärtus oleks sama auk teise nimega.
--
--   2. `provenance` on TEKST, mitte enum — sama põhjendus mis
--      `CaseWorkMissingInfo`-l: sõnastik elab `lib/workspaces/provenance.js`-is
--      (CASEWORK-P0, kaheksa väärtust, jagatud FIELD-iga) ja peab jääma ÜHEKS
--      tõeks. `fieldKey` ja `kind` seevastu ON enum'id: nad on selle mudeli oma
--      suletud hulgad ja uus väärtus tähendab niikuinii koodimuudatust.
--
--   3. `CaseWorkMeetingPrepField` unikaalsus `(meetingPrepId, fieldKey)` — üks
--      rida välja kohta. Vorm on väljade KOGUM, mitte ajalugu; kaks rida sama
--      võtmega tähendaks, et lugeja peab valima, kumb on tõsi.
--
--   4. Kaskaad on kahekihiline ja tahtlik: juhtumi kustutus viib
--      ettevalmistused, ettevalmistuse kustutus viib väljad ja küsimused.
--      L15 järgi peab juhtumi kustutus olema TÄIELIK — säilitusreegli lõpus ei
--      tohi jääda orvuks jäänud sisu, mille kohta keegi ei tea, kelle oma ta oli.
--
-- ENUM'I VÄÄRTUSTE JÄRJEKORD ON SEMANTILINE: Postgres sordib enum'i
-- DEKLARATSIOONI, mitte tähestiku järgi, ja teenuskiht sordib küsimusi `kind`
-- järgi. Ümberjärjestamine muudaks vaikselt loendi järjekorda; uued väärtused
-- käivad LÕPPU.

-- CreateEnum
CREATE TYPE "CaseWorkPrepFieldKey" AS ENUM ('GOAL', 'REQUIRED_DOCUMENTS', 'LIFE_DOMAINS', 'AGENDA', 'PLAIN_LANGUAGE_NOTES');

-- CreateEnum
CREATE TYPE "CaseWorkQuestionKind" AS ENUM ('CLARIFYING_QUESTION', 'CLAIM_TO_VERIFY');

-- CreateTable
CREATE TABLE "CaseWorkMeetingPrep" (
    "id" TEXT NOT NULL,
    "caseWorkAssistId" TEXT NOT NULL,
    "meetingAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseWorkMeetingPrep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseWorkMeetingPrepField" (
    "id" TEXT NOT NULL,
    "meetingPrepId" TEXT NOT NULL,
    "fieldKey" "CaseWorkPrepFieldKey" NOT NULL,
    "text" TEXT NOT NULL,
    "provenance" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseWorkMeetingPrepField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseWorkQuestion" (
    "id" TEXT NOT NULL,
    "meetingPrepId" TEXT NOT NULL,
    "kind" "CaseWorkQuestionKind" NOT NULL,
    "text" TEXT NOT NULL,
    "provenance" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseWorkQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaseWorkMeetingPrep_caseWorkAssistId_meetingAt_idx" ON "CaseWorkMeetingPrep"("caseWorkAssistId", "meetingAt");

-- CreateIndex
CREATE INDEX "CaseWorkMeetingPrep_caseWorkAssistId_createdAt_idx" ON "CaseWorkMeetingPrep"("caseWorkAssistId", "createdAt");

-- CreateIndex
CREATE INDEX "CaseWorkMeetingPrepField_meetingPrepId_idx" ON "CaseWorkMeetingPrepField"("meetingPrepId");

-- CreateIndex
CREATE UNIQUE INDEX "CaseWorkMeetingPrepField_meetingPrepId_fieldKey_key" ON "CaseWorkMeetingPrepField"("meetingPrepId", "fieldKey");

-- CreateIndex
CREATE INDEX "CaseWorkQuestion_meetingPrepId_kind_ordinal_idx" ON "CaseWorkQuestion"("meetingPrepId", "kind", "ordinal");

-- CreateIndex
CREATE INDEX "CaseWorkQuestion_meetingPrepId_ordinal_idx" ON "CaseWorkQuestion"("meetingPrepId", "ordinal");

-- AddForeignKey
ALTER TABLE "CaseWorkMeetingPrep" ADD CONSTRAINT "CaseWorkMeetingPrep_caseWorkAssistId_fkey" FOREIGN KEY ("caseWorkAssistId") REFERENCES "CaseWorkAssist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseWorkMeetingPrepField" ADD CONSTRAINT "CaseWorkMeetingPrepField_meetingPrepId_fkey" FOREIGN KEY ("meetingPrepId") REFERENCES "CaseWorkMeetingPrep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseWorkQuestion" ADD CONSTRAINT "CaseWorkQuestion_meetingPrepId_fkey" FOREIGN KEY ("meetingPrepId") REFERENCES "CaseWorkMeetingPrep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Päritolu ei tohi olla tühi string. `NOT NULL` üksi lubaks `''`, mis on
-- „märgistatud tühjaga" — täpselt see auk, mille NOT NULL pidi sulgema.
-- Sõnastiku SISU jõustab teenuskiht (`isProvenance`); andmebaas jõustab seda,
-- et midagi seal ON.
ALTER TABLE "CaseWorkMeetingPrepField"
  ADD CONSTRAINT "CaseWorkMeetingPrepField_provenance_not_blank"
  CHECK (length(btrim("provenance")) > 0);

ALTER TABLE "CaseWorkQuestion"
  ADD CONSTRAINT "CaseWorkQuestion_provenance_not_blank"
  CHECK (length(btrim("provenance")) > 0);
