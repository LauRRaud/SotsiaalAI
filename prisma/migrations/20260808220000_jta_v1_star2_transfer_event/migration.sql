-- JTA-V1 (E6) — STAR2 ülekandeaudit. Migratsioon 4/4, ahela viimane.
--
-- Leping: docs/platvormi arendus/jta-v1-arendusleping.md (v6), etapp E6.
--
-- TÄIESTI ADDITIIVNE: üks uus enum, üks uus tabel. Ühtegi olemasolevat veergu
-- ega rida ei puudutata.
--
-- KÄSITSI KIRJUTATUD, MITTE `migrate diff` VÄLJUND — sama põhjus mis E3/E4/E5-l:
-- arendusbaasi vastu jooksutatud `diff` tõi kaasa võõra triivi ja oleks kokku
-- liidetuna kustutanud tabeli, mida see migratsioon ei puuduta.
--
-- TABEL ON APPEND-ONLY JA SEE ON TÕEND (L8). Just seepärast on siin kolm asja,
-- mida tavaline auditiskeem ei kannaks:
--
--   1. `fieldKeys` on VÕTMETE massiiv, mitte väärtuste oma. Täissnapshot
--      tähendaks, et E7 kustutab mustandi sisu 12 kuu pärast, aga sama sisu
--      elab auditi all kuni juhtumi lõpuni — varju-register, ehitatud selle
--      mehhanismi sisse, mis pidi teda ära hoidma. Vormi jõustab `CHECK`, sest
--      võti, mis on tegelikult lause, oleks sisu vales tabelis.
--
--   2. `@@unique([draftId, clientActionId])` on L22 AINUS jõustaja. Teenuskihi
--      „kas on juba olemas" kontroll oleks sama loe-kontrolli-kirjuta muster,
--      mille L21 äsja maha võttis. `clientActionId` on NULLABLE ja see on
--      tahtlik: Postgres loeb `NULL`-e unikaalses indeksis ERISTUVATEKS, seega
--      kaks `MARKED_AS_TRANSFERRED` rida ei põrka omavahel kokku.
--
--   3. `CHECK`, mis seob `kind`-i ja võtme KAHESUUNALISELT. Skeemitasemel
--      `NOT NULL` oleks vale (nõuaks `MARKED_AS_TRANSFERRED`-ile mõttetut
--      võtit), aga „kopeerimine ilma võtmeta" on puhas väärtuste-invariant ja
--      tema koht ON andmebaasis: ilma temata võiks rakenduse viga kirjutada
--      võtmeta kopeerimisrea, mille peale unikaalne indeks enam ei kehti ja
--      audit hakkaks ühte tegu kaheks lugema.

-- CreateEnum
CREATE TYPE "CaseWorkTransferEventKind" AS ENUM ('COPIED_FOR_STAR2', 'MARKED_AS_TRANSFERRED');

-- CreateTable
CREATE TABLE "CaseWorkTransferEvent" (
    "id" TEXT NOT NULL,
    "caseWorkAssistId" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "kind" "CaseWorkTransferEventKind" NOT NULL,
    "draftType" "CaseWorkDraftType" NOT NULL,
    "transferStateAtEvent" TEXT NOT NULL,
    "fieldKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "clientActionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseWorkTransferEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaseWorkTransferEvent_caseWorkAssistId_createdAt_idx" ON "CaseWorkTransferEvent"("caseWorkAssistId", "createdAt");

-- CreateIndex
CREATE INDEX "CaseWorkTransferEvent_ownerUserId_createdAt_idx" ON "CaseWorkTransferEvent"("ownerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "CaseWorkTransferEvent_draftId_createdAt_idx" ON "CaseWorkTransferEvent"("draftId", "createdAt");

-- CreateIndex — L22 jõustaja.
CREATE UNIQUE INDEX "CaseWorkTransferEvent_draftId_clientActionId_key" ON "CaseWorkTransferEvent"("draftId", "clientActionId");

-- AddForeignKey
ALTER TABLE "CaseWorkTransferEvent" ADD CONSTRAINT "CaseWorkTransferEvent_caseWorkAssistId_fkey" FOREIGN KEY ("caseWorkAssistId") REFERENCES "CaseWorkAssist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseWorkTransferEvent" ADD CONSTRAINT "CaseWorkTransferEvent_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "CaseWorkDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CHECK 1 — teo hetke seis kuulub kuue lubatud väärtuse hulka (ptk 2.2 sõnastik).
-- Sama loend mis `CaseWorkDraft_transferState_known`; siin on ta AJALOOLINE
-- väärtus, mitte elav seis, ja just seepärast ta mustandi reaga kaasa ei muutu.
ALTER TABLE "CaseWorkTransferEvent"
  ADD CONSTRAINT "CaseWorkTransferEvent_transferState_known"
  CHECK ("transferStateAtEvent" IN ('MUSTAND', 'VAJAB_KONTROLLI', 'KONTROLLITUD', 'VALMIS_ULEKANDEKS', 'ULE_KANTUD', 'EI_KANTA'));

-- CHECK 2 — KAHESUUNALINE (L22): kopeerimisel on võti, ülekantuks märkimisel ei ole.
-- Vasak suund hoiab unikaalse indeksi tähenduse (võtmeta kopeerimisrida ei
-- põrkaks millegagi); parem suund hoiab ära teise koha, kus võtit genereeritakse.
ALTER TABLE "CaseWorkTransferEvent"
  ADD CONSTRAINT "CaseWorkTransferEvent_copy_requires_action_key"
  CHECK (("kind" = 'COPIED_FOR_STAR2') = ("clientActionId" IS NOT NULL));

-- CHECK 3 — `clientActionId` on LÄBIPAISTMATU VÕTI, mitte tähendust kandev väli.
-- UUID-kuju on ainus lubatud vorm: vaba string on väli, mille kasutaja saab ise
-- valida, ja sinna mahuks ajatempel, `fieldKey` või muu, millest saaks sisu
-- tuletada.
ALTER TABLE "CaseWorkTransferEvent"
  ADD CONSTRAINT "CaseWorkTransferEvent_clientActionId_shape"
  CHECK ("clientActionId" IS NULL OR "clientActionId" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

-- CHECK 4 — `fieldKeys` kannab MASINVÕTMEID, sama vorm mis `CaseWorkDraftField`-il.
-- Massiivi elemendi vormi ei saa Postgresis alampäringuga kontrollida, aga
-- `array_to_string` + muster teeb sama töö ühe avaldisega ja on deterministlik.
-- Tühi massiiv läbib (kopeerimine ilma väljadeta lükkab tagasi teenuskiht 400-ga,
-- sest see on TOOTEreegel, mitte andmeinvariant).
ALTER TABLE "CaseWorkTransferEvent"
  ADD CONSTRAINT "CaseWorkTransferEvent_fieldKeys_shape"
  CHECK (array_to_string("fieldKeys", ',') ~ '^([A-Z][A-Z0-9_]*(,[A-Z][A-Z0-9_]*)*)?$' AND cardinality("fieldKeys") <= 128);
