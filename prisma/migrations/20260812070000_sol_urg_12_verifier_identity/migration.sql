-- SOL-URG-12: „partner kinnitas tingimused" ei olnud tõendatav.
--
-- `verifyUrgentDesk()` kirjutas AINULT `lastVerifiedAt` aja. Andmebaas ütles seega
-- „keegi kinnitas millalgi" — mitte kes, mitte millise tekstiversiooni. Marsruut
-- nõudis platvormiadmini õigust, aga ei andnud `authz.userId` funktsioonile edasi,
-- seega isegi kutsuja identiteet ei jõudnud kunagi andmeteni.
--
-- Kaks veergu vastavad kahele küsimusele, mida hiljem päriselt küsitakse:
--   `lastVerifiedByUserId` — KES seisab selle lubaduse taga;
--   `verifiedConditionsHash` — MILLIST teksti ta kinnitas.
--
-- Räsi on vajalik ka siis, kui `updateUrgentDesk` juba nullib kinnituse iga
-- tingimusemuutuse peale: see reegel elab koodis ja võib muutuda, räsi aga on
-- kinnituse enda juures ja vastab tagantjärele ka siis, kui reegel oli katki.
--
-- `ON DELETE SET NULL`: kinnitaja konto kustutus ei tohi lauda kustutada ega
-- valetada, et keegi teine kinnitas. NULL tähendab „me ei tea enam, kes" ja see on
-- aus vastus. Olemasolevaid ridu ei puudutata — pärandkinnitustel jääb mõlemad
-- NULL, sest tagantjärele oletada, kes kinnitas, oleks täpselt see tõendamatus,
-- mille pärast veerud tekkisid.
ALTER TABLE "UrgentDesk" ADD COLUMN IF NOT EXISTS "lastVerifiedByUserId" TEXT;
ALTER TABLE "UrgentDesk" ADD COLUMN IF NOT EXISTS "verifiedConditionsHash" TEXT;

DO $$
BEGIN
  ALTER TABLE "UrgentDesk"
    ADD CONSTRAINT "UrgentDesk_lastVerifiedByUserId_fkey"
    FOREIGN KEY ("lastVerifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "UrgentDesk_lastVerifiedByUserId_idx"
  ON "UrgentDesk"("lastVerifiedByUserId");
