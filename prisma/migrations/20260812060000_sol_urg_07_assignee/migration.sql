-- SOL-URG-07: „Võtan" ei salvestanud vastutajat.
--
-- TAKE-route'i leping ütleb, et vastutus läheb NIMELISELT töötajale, aga mudelis ei
-- olnud ühtegi välja, kuhu see nimi mahuks: actor jäi ainult sündmusreale. Aktiivse
-- pöördumise praegust vastutajat ei saanud seetõttu üheselt pärida ega järjekorras
-- kuvada, ja kahe TAKE-sündmuse või liikuvate liikmesuste korral ei olnud ta
-- sündmuslogist turvaliselt tuletatav.
--
-- `ON DELETE SET NULL` on sama valik nagu `authorId`-l: konto kustutus ei hävita
-- pöördumist ega selle ajalugu, aga ka ei jäta seisma vastutajat, keda enam ei ole.
-- Sündmusrida ütleb endiselt, KES tookord võttis; see veerg ütleb, kes vastutab NÜÜD.
--
-- Olemasolevaid ridu ei puudutata: pärandpöördumistel jääb väärtus NULL. Vana TAKEN
-- rida ilma vastutajata on aus seis („me ei tea, kes"), mitte tagasiulatuv oletus —
-- sündmusreast tuletatud backfill oleks täpselt see turvamatu tuletus, mille pärast
-- see veerg üldse tekkis.
ALTER TABLE "UrgentRequest" ADD COLUMN IF NOT EXISTS "takenByUserId" TEXT;

DO $$
BEGIN
  ALTER TABLE "UrgentRequest"
    ADD CONSTRAINT "UrgentRequest_takenByUserId_fkey"
    FOREIGN KEY ("takenByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- „Mis on MINU laual praegu?" on vastutaja päring, mitte laua oma.
CREATE INDEX IF NOT EXISTS "UrgentRequest_takenByUserId_status_idx"
  ON "UrgentRequest"("takenByUserId", "status");
