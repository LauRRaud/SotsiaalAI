-- TÖÖHEAOLU TUGEVUSED KOONDIS (ideed 21.2; tööheaolu arendusettepanek ptk 8.19).
--
-- Koond loeb kirje salvestatud tegureid, mitte vastuseid. Tugevused („Mis toimib") tuletati seni ainult
-- töötaja Ülevaates tema vastustest. Veerg hoiab salvestamisel arvutatud tugevusi, et koond saaks neid
-- lugeda ilma vastusteta.
--
-- `NULL` tähendab „ei ole arvutatud" (selle migratsiooni eelne kirje või eelmise rakenduse versiooni
-- kirjutatud kirje); koond jätab sellise kirje tugevuste perest välja. `[]` tähendab „arvutatud, tugevusi ei
-- ole". Seepärast ei ole vaikeväärtust: `[]` vaikeväärtus teeks paigalduse ajal kirjutatud kirjetest vale
-- „tugevusi ei ole". Vanu ridu ei täideta.
--
-- Aditiivne: üks nullitav veerg ilma vaikeväärtuseta (PostgreSQL-is ainult kataloogi muudatus, tabelit ümber
-- ei kirjutata), olemasolevaid ridu ei muudeta ja eelmine rakenduse versioon seda veergu ei loe ega kirjuta.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE "WellbeingRecord"
  ADD COLUMN "strengthFactors" JSONB;

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   ALTER TABLE "WellbeingRecord" DROP COLUMN "strengthFactors";
