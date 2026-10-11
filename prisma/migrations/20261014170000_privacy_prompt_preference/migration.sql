-- ISIKUANDMETE HOIATUSE LÜLITI KONTO SEADETES.
--
-- Enne saatmist küsib platvorm, kui tekstis on telefoninumber, isikukood, e-posti aadress või
-- aadress: muuda, saada varjatult või saada siiski. Omaniku soov 11.10.2026: seda küsimist peab
-- saama konto seadetest välja lülitada. Veerg hoiab inimese valikut; vaikimisi on hoiatus sees.
--
-- Aditiivne: üks vaikeväärtusega veerg, olemasolevaid ridu ei kirjutata ümber (PostgreSQL hoiab
-- konstantset vaikeväärtust kataloogis) ja eelmine rakenduse versioon seda veergu ei loe ega kirjuta.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE "User"
  ADD COLUMN "privacyPromptEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   ALTER TABLE "User" DROP COLUMN "privacyPromptEnabled";
