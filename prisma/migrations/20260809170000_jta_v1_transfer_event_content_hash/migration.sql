-- JTA-V1 / SOL-CW-16 — kopeerimisaudit seotakse kopeeritud tekstiversiooniga.
--
-- Audit: docs/audits/sotsiaalai-sol-suvaaudit.md, SOL-CW-16.
--
-- MIKS SEE MIGRATSIOON OLEMAS ON. Auditirida kandis teo aega ja väljanimesid,
-- aga mitte seda, MILLINE TEKST tegelikult lõikelauale läks. `recordCopyEvent()`
-- kontrollis ainult, et samanimelised väljad praegu eksisteerivad. Negatiiv-
-- kontrollis kopeeriti „VERSIOON A", andmebaasis asendati see enne auditit
-- „VERSIOON B"-ga ja audit võeti vastu väljaloendiga ['SISU']. Paralleelne
-- muutmine või hilisem vaidlus võis siduda auditi vale sisuseisuga.
--
-- MIKS RÄSI, MITTE SNAPSHOT. L8 keelab väljade VÄÄRTUSTE salvestamise:
-- täissnapshot elaks üle E7 sisu-purge'i ja oleks varju-register, ehitatud
-- selle mehhanismi sisse, mis pidi teda ära hoidma. Räsi tõendab identsust
-- ilma sisu hoidmata ja purge'i üle ta midagi ei kanna.

-- AlterTable
ALTER TABLE "CaseWorkTransferEvent" ADD COLUMN "contentHash" TEXT;

-- VÄRAV ENNE CHECK-i. Olemasolev `COPIED_FOR_STAR2` rida ilma räsita ei saa
-- tagantjärele õiget väärtust — sisu, mille pealt ta arvutataks, võib olla
-- vahepeal muutunud, ja väljamõeldud räsi oleks halvem kui puuduv. Tõrge ütleb,
-- MITU rida on ja andmeid EI MUUDETA automaatselt.
DO $$
DECLARE
  legacy INTEGER;
BEGIN
  SELECT COUNT(*) INTO legacy
  FROM "CaseWorkTransferEvent"
  WHERE "kind" = 'COPIED_FOR_STAR2' AND "contentHash" IS NULL;

  IF legacy > 0 THEN
    RAISE EXCEPTION
      'SOL-CW-16: % kopeerimisauditi rida on ilma sisu sõrmejäljeta. Neid ei saa tagantjärele arvutada (sisu võib olla muutunud) ja migratsioon ei mõtle väärtust välja. Otsusta enne edasiminekut, mis nende ridadega saab.',
      legacy;
  END IF;
END $$;

-- CHECK — KAHESUUNALINE, sama muster mis `clientActionId`-l: kopeerimisel on
-- sõrmejälg, ülekantuks märkimisel ei ole (seal ei ole plokki, mida siduda).
ALTER TABLE "CaseWorkTransferEvent"
  ADD CONSTRAINT "CaseWorkTransferEvent_content_hash_by_kind"
  CHECK (("kind" = 'COPIED_FOR_STAR2') = ("contentHash" IS NOT NULL));

-- CHECK — räsi on sha256 hex, mitte suvaline string. Kontrollimata väli oleks
-- koht, kuhu kutsuja saab panna midagi tähendust kandvat; sõrmejälg on
-- sõrmejälg ainult siis, kui tema kuju on jõustatud.
ALTER TABLE "CaseWorkTransferEvent"
  ADD CONSTRAINT "CaseWorkTransferEvent_content_hash_shape"
  CHECK ("contentHash" IS NULL OR "contentHash" ~ '^[0-9a-f]{64}$');
