-- SOL-AUTH-15: paralleelsed paroolitaaste päringud tühistasid teineteise lingid.
--
-- Iga POST mintis uue `VerificationToken` rea, saatis lingi ja kustutas alles seejärel kõik
-- ülejäänud sama identifikaatori tokenid. Kahe paralleelse päringu jadas
-- A:create → B:create → A:send → B:send → A:delete-not-A → B:delete-not-B
-- kustutas A tokeni B ja B tokeni A. Mõlemad marsruudid vastasid `ok:true`, kasutaja sai kaks
-- näiliselt edukat kirja ja kumbki link ei töötanud.
--
-- Rida on korraga kaks asja:
--   1. LIISUNG — `claimedAt` koos tühja `sentAt`-iga tähendab „selle identifikaatori saatmine
--      käib parajasti"; teine päring ei mindi ega saada midagi. Liisungil ON vananemisaken,
--      sest surnud protsess ei tohi konto taastamist igaveseks lukku panna.
--   2. PÜSIV SEOS saatmise ja aktiivse tokeni vahel — `tokenValue` ütleb, MILLINE token teele
--      läks. Rotatsioon tohib kustutada ainult neid, mille peale see rida ei näita.
--
-- `tokenValue` on rea salvestuskuju (`v2:` + sha256, SOL-AUTH-03), MITTE toorlink: andmebaasi
-- lugemisõigus ei tohi anda töötavat linki. Võti on sama nimeruumiga string, mis `VerificationToken`
-- `identifier`-il (`password-reset:<email>`), seega tabel katab kõiki lingiliike ja võõrvõtit
-- `User`-i peale ei ole.
--
-- Uus tabel; olemasolevaid ridu ei puudutata.
CREATE TABLE IF NOT EXISTS "VerificationLinkDispatch" (
  "identifier" TEXT NOT NULL,
  "tokenValue" TEXT NOT NULL,
  "claimedAt"  TIMESTAMP(3) NOT NULL,
  "sentAt"     TIMESTAMP(3),
  CONSTRAINT "VerificationLinkDispatch_pkey" PRIMARY KEY ("identifier")
);

-- Aegunud liisungite koristuseks ja liisungiakna päringuks.
CREATE INDEX IF NOT EXISTS "VerificationLinkDispatch_claimedAt_idx"
  ON "VerificationLinkDispatch"("claimedAt");
