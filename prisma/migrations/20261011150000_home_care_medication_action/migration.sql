-- KODUTEENUS K5-d — ravimitoimingu märge käigu kirjel (kava II.3.2, otsus 20).
--
-- Koduteenust laiendatakse õhtutele ja nädalavahetustele sageli just selleks, et inimene
-- saaks ravimid võetud. Käigu kirjel märgitakse ravimitoimingu juures, MIDA hooldaja tegi:
-- tuletas meelde, nägi võtmas või andis. Need on eri toimingud eri vastutusega.
--
-- Annuseid, ravimite nimesid ega raviskeemi siin EI HOITA: selleks on vaja usaldusväärset
-- skeemi allikat ja õe vastutust. Märge on ainult rühma MEDICATION tehtud toimingul.
--
-- Aditiivne: üks uus NULL-i lubav veerg, vanadel ridadel märget ei ole.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE "CareEntryActivity" ADD COLUMN "medicationAction" TEXT;

-- Võrdlus on IS NOT DISTINCT FROM, sest tavaline võrdlus annaks puuduva väärtuse korral
-- NULL-i ja CHECK laseks rea läbi.
ALTER TABLE "CareEntryActivity"
  ADD CONSTRAINT "CareEntryActivity_medicationAction_check"
  CHECK (
    "medicationAction" IS NULL
    OR (
      "medicationAction" IN ('REMINDED', 'SAW_TAKEN', 'GAVE')
      AND "activityGroup" IS NOT DISTINCT FROM 'MEDICATION'
      AND "outcome" IS NOT DISTINCT FROM 'DONE'
    )
  );

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   ALTER TABLE "CareEntryActivity" DROP COLUMN IF EXISTS "medicationAction";
