-- TÖÖHEAOLU ANONÜÜMSES KOONDIS OSALEMISE VALIK (TO-3, I13).
--
-- Seni läks iga Tööheaolu kirje piloodi anonüümsesse koondisse ja töötaja ei saanud seda valida
-- ega teadnud sellest. Veerg hoiab inimese valikut. `NULL` tähendab „ei ole valinud" ja siis
-- kehtib koodi vaikeväärtus (`lib/wellbeing/aggregatePreference.js`), nii et vaikeväärtuse
-- muutmine ei vaja andmete ümberkirjutamist ega kustuta kellegi tehtud valikut.
--
-- Aditiivne: üks nullitav veerg ilma vaikeväärtuseta, olemasolevaid ridu ei kirjutata ümber ja
-- eelmine rakenduse versioon seda veergu ei loe ega kirjuta.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE "User"
  ADD COLUMN "wellbeingAggregateEnabled" BOOLEAN;

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   ALTER TABLE "User" DROP COLUMN "wellbeingAggregateEnabled";
