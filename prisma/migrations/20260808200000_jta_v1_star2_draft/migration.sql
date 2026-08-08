-- JTA-V1 (E5) — STAR2 mustandi ahel. CASEWORK-P2 tuum.
--
-- Leping: docs/platvormi arendus/jta-v1-arendusleping.md (v6), etapp E5.
-- Migratsioon 3/4. E6 (ülekandeaudit) tuleb eraldi.
--
-- TÄIESTI ADDITIIVNE: üks uus enum, kaks uut tabelit. Ühtegi olemasolevat
-- veergu ega rida ei puudutata.
--
-- KÄSITSI KIRJUTATUD, MITTE `migrate diff` VÄLJUND — sama põhjus mis E3/E4-l.
--
-- OLEKUMASIN EI SÜNNI SIIN. Kuus seisu, lubatud üleminekud ja
-- `canTransitionStar2()` on `lib/workspaces/provenance.js`-is olemas olnud ja
-- kasutamata; E5 annab neile SALVESTUSE. Just seepärast on `transferState`
-- TEKST + `CHECK`, mitte enum: sõnastik peab jääma üheks tõeks ja teda kasutab
-- ka K1 kiht.
--
-- KOLM `CHECK`-i JÕUSTAVAD VÄÄRTUSI, MITTE ÜLEMINEKUID (L6). Ülemineku
-- seaduslikkust andmebaas kontrollida ei oska — tema jõustaja on tingimuslik
-- `updateMany` teenuskihis (`WHERE transferState = expectedFrom`), mis annab
-- võistluse korral 409. Aga kaks asja ON puhtad väärtuste-invariandid ja nende
-- koht on siin:
--
--   1. `transferState` kuulub kuue lubatud väärtuse hulka. Ilma selleta saaks
--      otse-SQL või rakenduse viga kirjutada sinna mistahes stringi ja lugeja
--      ei teaks, mida temaga teha.
--
--   2. `transferredAt IS NOT NULL` ⟺ `transferState = 'ULE_KANTUD'`. KAHESUUNALINE
--      ja see on tahtlik. Ühes suunas: ülekandmata mustandil ei tohi olla
--      ülekande aega. Teises suunas: **ülekantud mustandil PEAB olema aeg**,
--      sest säilituskell (L7) käib täpselt sellest väljast — ilma temata ei
--      hakkaks kell kunagi käima ja sisu ei kustuks kunagi.
--
--   3. `contentPurgedAt IS NOT NULL` → `transferredAt IS NOT NULL`. Sisu tohib
--      purge'ida ainult sellel, mis on üle kantud. Purge'itud, aga kandmata
--      mustand tähendaks, et töötaja töö kadus ilma et ta kuhugi jõudnuks.
--
-- `fieldKey` VORM ON PIIRATUD (`^[A-Z][A-Z0-9_]*$`, ≤ 64). Ta on masinvõti, mitte
-- sõnastik — kanoonilist väljaloendit kaheksa mustanditüübi jaoks ei ole veel
-- kokku lepitud. Vormipiirang hoiab ära selle, et võtmest saaks vaikselt teine
-- sisuväli, kuhu keegi kirjutab teksti (ja mille E7 purge siis vahele jätaks).

-- CreateEnum
CREATE TYPE "CaseWorkDraftType" AS ENUM ('POORDUMISE_KOKKUVOTE', 'ABIVAJADUSE_HINDAMINE', 'ELUVALDKONNA_KIRJELDUS', 'EESMARGI_SONASTUS', 'TEGEVUS', 'VASTUTAJA_JA_TAHTAEG', 'KOHTUMISE_MARGE', 'TEENUSE_SUUNAMISE_ALUS');

-- CreateTable
CREATE TABLE "CaseWorkDraft" (
    "id" TEXT NOT NULL,
    "caseWorkAssistId" TEXT NOT NULL,
    "draftType" "CaseWorkDraftType" NOT NULL,
    "transferState" TEXT NOT NULL DEFAULT 'MUSTAND',
    "reviewKind" TEXT,
    "transferredAt" TIMESTAMP(3),
    "contentPurgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseWorkDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseWorkDraftField" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "provenance" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseWorkDraftField_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaseWorkDraft_caseWorkAssistId_transferState_idx" ON "CaseWorkDraft"("caseWorkAssistId", "transferState");

-- CreateIndex
CREATE INDEX "CaseWorkDraft_caseWorkAssistId_createdAt_idx" ON "CaseWorkDraft"("caseWorkAssistId", "createdAt");

-- CreateIndex
CREATE INDEX "CaseWorkDraft_transferState_transferredAt_idx" ON "CaseWorkDraft"("transferState", "transferredAt");

-- CreateIndex
CREATE INDEX "CaseWorkDraftField_draftId_idx" ON "CaseWorkDraftField"("draftId");

-- CreateIndex
CREATE UNIQUE INDEX "CaseWorkDraftField_draftId_fieldKey_key" ON "CaseWorkDraftField"("draftId", "fieldKey");

-- AddForeignKey
ALTER TABLE "CaseWorkDraft" ADD CONSTRAINT "CaseWorkDraft_caseWorkAssistId_fkey" FOREIGN KEY ("caseWorkAssistId") REFERENCES "CaseWorkAssist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseWorkDraftField" ADD CONSTRAINT "CaseWorkDraftField_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "CaseWorkDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CHECK 1 — seis kuulub kuue lubatud väärtuse hulka (ptk 2.2 sõnastik).
ALTER TABLE "CaseWorkDraft"
  ADD CONSTRAINT "CaseWorkDraft_transferState_known"
  CHECK ("transferState" IN ('MUSTAND', 'VAJAB_KONTROLLI', 'KONTROLLITUD', 'VALMIS_ULEKANDEKS', 'ULE_KANTUD', 'EI_KANTA'));

-- CHECK 1b — ülevaatuse alamliik, kui ta on määratud.
ALTER TABLE "CaseWorkDraft"
  ADD CONSTRAINT "CaseWorkDraft_reviewKind_known"
  CHECK ("reviewKind" IS NULL OR "reviewKind" IN ('KLIENDIGA', 'DOKUMENDIGA'));

-- CHECK 2 — KAHESUUNALINE: ülekande aeg on täpselt siis, kui seis on ULE_KANTUD.
-- Teine suund kannab säilituskella (L7): ülekantud mustand ILMA ajata ei kustuks
-- kunagi.
ALTER TABLE "CaseWorkDraft"
  ADD CONSTRAINT "CaseWorkDraft_transferredAt_matches_state"
  CHECK (("transferredAt" IS NOT NULL) = ("transferState" = 'ULE_KANTUD'));

-- CHECK 3 — sisu tohib purge'ida ainult ülekantud mustandil.
ALTER TABLE "CaseWorkDraft"
  ADD CONSTRAINT "CaseWorkDraft_purged_requires_transferred"
  CHECK ("contentPurgedAt" IS NULL OR "transferredAt" IS NOT NULL);

-- Välja võti on MASINVÕTI, mitte sisuväli.
ALTER TABLE "CaseWorkDraftField"
  ADD CONSTRAINT "CaseWorkDraftField_fieldKey_shape"
  CHECK ("fieldKey" ~ '^[A-Z][A-Z0-9_]*$' AND length("fieldKey") <= 64);

ALTER TABLE "CaseWorkDraftField"
  ADD CONSTRAINT "CaseWorkDraftField_provenance_not_blank"
  CHECK (length(btrim("provenance")) > 0);
