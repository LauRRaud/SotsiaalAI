-- SOL-SLOG-22 — väliskliendi nimi ei ole kuunarratiivi identiteet.
ALTER TABLE "ServiceMonthlyNarrative"
  ADD COLUMN "clientExternalRef" TEXT,
  ADD COLUMN "clientIdentityNeedsReview" BOOLEAN NOT NULL DEFAULT false;

-- Vana nimepõhist rida ei saa automaatselt päris välisviitega siduda. Iga rida
-- saab ajutise unikaalse legacy-võtme ja nähtava review-lipu; nii ei ühendata
-- teda ühegi uue kliendiga vaikides ning inimene saab seose käsitsi lahendada.
UPDATE "ServiceMonthlyNarrative"
SET
  "clientExternalRef" = 'legacy:' || "id",
  "clientIdentityNeedsReview" = true
WHERE "referralId" IS NULL
  AND "clientUserId" IS NULL
  AND "clientDisplayName" IS NOT NULL;

DROP INDEX IF EXISTS "ServiceMonthlyNarrative_noreferral_clientname_key";

CREATE UNIQUE INDEX "ServiceMonthlyNarrative_noreferral_externalref_key"
  ON "ServiceMonthlyNarrative" ("providerProfileId", "clientExternalRef", "periodYear", "periodMonth")
  WHERE "referralId" IS NULL
    AND "clientUserId" IS NULL
    AND "clientExternalRef" IS NOT NULL;
