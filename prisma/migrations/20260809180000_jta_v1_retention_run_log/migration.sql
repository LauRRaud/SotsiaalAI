-- JTA-V1 / SOL-CW-14 — säilitustöö jooksu logi.
--
-- Audit: docs/audits/sotsiaalai-sol-suvaaudit.md, SOL-CW-14.
--
-- MIKS SEE TABEL OLEMAS ON. `runRetention()` oli olemas ja testitud, aga teda
-- kutsus ainult käsitsi käivitatav skript; cron oli NÄIDE skripti päises, mitte
-- repositooriumi hallatav ajastus. Ilma püsiva jooksuseisuta ei saa vastata
-- kolmele küsimusele: millal töö viimati õnnestus, millal ta järgmine kord käib
-- ja kas keegi märkab, kui ta lakkab käimast. Logifail ei vasta neist ühelegi
-- masinloetavalt ja kaob koos hostiga.
--
-- ISIKUANDMEID SIIN EI OLE: rida on JOOKSU, mitte juhtumi kohta.

-- CreateTable
CREATE TABLE "CaseWorkRetentionRun" (
  "id" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "ok" BOOLEAN NOT NULL DEFAULT false,
  "dryRun" BOOLEAN NOT NULL DEFAULT false,
  "disabled" BOOLEAN NOT NULL DEFAULT false,
  "draftsPurged" INTEGER NOT NULL DEFAULT 0,
  "draftFieldsDeleted" INTEGER NOT NULL DEFAULT 0,
  "warningsSent" INTEGER NOT NULL DEFAULT 0,
  "casesDeleted" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0,
  "errorName" TEXT,
  "errorCode" TEXT,

  CONSTRAINT "CaseWorkRetentionRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaseWorkRetentionRun_startedAt_idx" ON "CaseWorkRetentionRun"("startedAt");
CREATE INDEX "CaseWorkRetentionRun_ok_startedAt_idx" ON "CaseWorkRetentionRun"("ok", "startedAt");

-- LOENDURID EI OLE NEGATIIVSED. Vigane loendur teeks alarmist müra ja müra
-- lülitatakse välja — see on täpselt see tee, mille lõpus järelevalvet ei ole.
ALTER TABLE "CaseWorkRetentionRun"
  ADD CONSTRAINT "CaseWorkRetentionRun_counters_non_negative"
  CHECK (
    "draftsPurged" >= 0 AND "draftFieldsDeleted" >= 0 AND
    "warningsSent" >= 0 AND "casesDeleted" >= 0 AND "failed" >= 0
  );

-- LÕPETAMATA JOOKS EI SAA OLLA `ok`. Ilma selleta märgiks pooleli jäänud rida
-- end edukaks ja alarm vaikiks just siis, kui töö suri keset partiid.
ALTER TABLE "CaseWorkRetentionRun"
  ADD CONSTRAINT "CaseWorkRetentionRun_ok_requires_finish"
  CHECK ("ok" = false OR "finishedAt" IS NOT NULL);
