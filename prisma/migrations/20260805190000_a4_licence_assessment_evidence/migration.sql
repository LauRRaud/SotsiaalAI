-- A4 — sõltumatu ülevaatuse järgne karastus.
--
-- See migratsioon EI eelda enam, et eelmise skeemiversiooni tabelid on tühjad.
-- Vana `result` kirjeldas ainult loapäringut ning vana `reason` eelistas
-- loapäringu põhjust identiteedipõhjusele. Backfill säilitab selle teadaoleva
-- tähenduse enne vana veeru eemaldamist; teadmata põhjust ei mõelda juurde.
--
-- MIS OLI KATKI JA MIDA SEE ANDMETES TÄHENDAS:
--
--   1. Hinnang salvestas ainult seisu ja kaetuse. `reason` ja
--      `publicStatusValidUntil` arvutati, aga visati ära — seega ei saanud
--      lugemisrada teada, MILLAL positiivne seis aegub. Tähtajalise loa märgis
--      oleks jäänud rippuma üle loa lõpu.
--   2. `checkId` oli üks väli kahe eri asja jaoks. Kui uus kontroll luba ei
--      leidnud, aga märgis püsis vanema tõendi najal, oleks liides kuvanud
--      „kontrollitud [uue kontrolli kuupäev]" — kuupäev, mille kontroll seda
--      luba EI leidnud.
--   3. `LicenceCheck.result` peegeldas ainult lubade päringut. Kirje võis
--      kanda `result = OK` ja `entityResolved = false` korraga.
--   4. `checksumValid` oli NOT NULL DEFAULT false — „ei saanud hinnata" ja
--      „ei klapi" olid eristamatud.
--   5. Loa kuupäevad olid TIMESTAMP: Eesti suveajal nihkus kehtivus kolm tundi.
--   6. `VERIFIED` kandis nii täpset kui jämedat vastet, seega liides oleks
--      saanud renderdada täpse märgise ainult `publicStatus` põhjal.

ALTER TYPE "LicencePublicStatus" ADD VALUE 'ACTIVITY_VERIFIED' BEFORE 'NO_SHS_LICENCE_REQUIRED';

-- 3, 4 ja 5: kontrolli kirje räägib nüüd MÕLEMAST allikast eraldi.
ALTER TABLE "LicenceCheck"
  ADD COLUMN "licenceSourceResult" "LicenceCheckResult",
  ADD COLUMN "entitySourceResult" "LicenceCheckResult",
  ADD COLUMN "licenceReason" TEXT,
  ADD COLUMN "entityReason" TEXT,
  ADD COLUMN "licenceSourceCheckedAt" TIMESTAMP(3),
  ADD COLUMN "consecutiveFailureCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "LicenceCheck"
SET
  "licenceSourceResult" = "result",
  "entitySourceResult" = CASE
    WHEN "entityResolved" THEN 'OK'::"LicenceCheckResult"
    ELSE 'UNCONFIRMED'::"LicenceCheckResult"
  END,
  "licenceReason" = CASE
    WHEN "result" = 'UNCONFIRMED'::"LicenceCheckResult" THEN "reason"
    ELSE NULL
  END,
  "entityReason" = CASE
    WHEN "result" = 'OK'::"LicenceCheckResult" AND NOT "entityResolved" THEN "reason"
    ELSE NULL
  END,
  "result" = CASE
    WHEN "result" = 'OK'::"LicenceCheckResult" AND "entityResolved" THEN 'OK'::"LicenceCheckResult"
    ELSE 'UNCONFIRMED'::"LicenceCheckResult"
  END,
  "verifiedAt" = CASE
    WHEN "result" = 'OK'::"LicenceCheckResult" AND "entityResolved" THEN "verifiedAt"
    ELSE NULL
  END;

ALTER TABLE "LicenceCheck"
  ALTER COLUMN "licenceSourceResult" SET NOT NULL,
  ALTER COLUMN "entitySourceResult" SET NOT NULL;

ALTER TABLE "LicenceCheck" DROP COLUMN "reason";

ALTER TABLE "LicenceCheck" ALTER COLUMN "checksumValid" DROP DEFAULT;
ALTER TABLE "LicenceCheck" ALTER COLUMN "checksumValid" DROP NOT NULL;

ALTER TABLE "LicenceRecord"
  ALTER COLUMN "validFrom" TYPE DATE,
  ALTER COLUMN "validUntil" TYPE DATE;

-- 1 ja 2: hinnang kannab nüüd tõendit, põhjust ja aegumist.
ALTER TABLE "ServiceLicenceAssessment" DROP CONSTRAINT "ServiceLicenceAssessment_checkId_fkey";
ALTER TABLE "ServiceLicenceAssessment" RENAME COLUMN "checkId" TO "lastAttemptCheckId";
ALTER TABLE "ServiceLicenceAssessment" RENAME COLUMN "consecutiveMissCount" TO "confirmedMissCount";

ALTER TABLE "ServiceLicenceAssessment"
  ADD COLUMN "statusSourceCheckId" TEXT,
  ADD COLUMN "assessmentReason" TEXT,
  ADD COLUMN "publicStatusValidUntil" TIMESTAMP(3),
  ADD COLUMN "coveringLicenceNumber" TEXT,
  ADD COLUMN "coverageScope" TEXT NOT NULL DEFAULT 'ORGANISATION';

CREATE INDEX "ServiceLicenceAssessment_publicStatusValidUntil_idx" ON "ServiceLicenceAssessment"("publicStatusValidUntil");

ALTER TABLE "ServiceLicenceAssessment" ADD CONSTRAINT "ServiceLicenceAssessment_lastAttemptCheckId_fkey"
  FOREIGN KEY ("lastAttemptCheckId") REFERENCES "LicenceCheck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ServiceLicenceAssessment" ADD CONSTRAINT "ServiceLicenceAssessment_statusSourceCheckId_fkey"
  FOREIGN KEY ("statusSourceCheckId") REFERENCES "LicenceCheck"("id") ON DELETE SET NULL ON UPDATE CASCADE;
