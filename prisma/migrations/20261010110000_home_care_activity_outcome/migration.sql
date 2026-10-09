-- KODUTEENUS kiht 2, K2-f — käigu lõpetamine erandite kaudu: tegemata jäänud toiming põhjusega.
--
-- Käigu kirjel sai seni märkida ainult tehtud toiminguid. Kava II.6.6 järgi on
-- oluline just see, mis jäi tegemata ja miks: „keeldus pesemisest" on muutuse märk,
-- mida vaba tekst ei tee loendatavaks. Kava toimingu rida saab nüüd tulemuse:
-- tehtud, keeldus, polnud vaja või ei saanud teha.
--
-- Tegemata toimingu real jääb `mode` kava rea omaks (kuidas oli kokku lepitud);
-- vaade seda tegemata real ei näita.
--
-- Aditiivne: üks vaikeväärtusega veerg ja üks CHECK. Eelmine rakenduse versioon
-- veergu ei kirjuta ja tema read on vaikimisi „tehtud", nagu need seni olid.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE "CareEntryActivity" ADD COLUMN "outcome" TEXT NOT NULL DEFAULT 'DONE';

ALTER TABLE "CareEntryActivity"
  ADD CONSTRAINT "CareEntryActivity_outcome_check" CHECK ("outcome" IN ('DONE', 'REFUSED', 'NOT_NEEDED', 'COULD_NOT'));
-- Tegemata saab jääda ainult kavas olnud toiming: kavaväline toiming on kirjel sellepärast, et see tehti.
ALTER TABLE "CareEntryActivity"
  ADD CONSTRAINT "CareEntryActivity_outcome_plan_check" CHECK ("outcome" = 'DONE' OR NOT "outsidePlan");

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   ALTER TABLE "CareEntryActivity" DROP CONSTRAINT IF EXISTS "CareEntryActivity_outcome_plan_check";
--   ALTER TABLE "CareEntryActivity" DROP CONSTRAINT IF EXISTS "CareEntryActivity_outcome_check";
--   ALTER TABLE "CareEntryActivity" DROP COLUMN IF EXISTS "outcome";
