-- JTA-V1 (E7) — säilituse jõustamine. VIIES migratsioon neljast.
--
-- Leping: docs/platvormi arendus/jta-v1-arendusleping.md, etapp E7 + O-JTA-5.
--
-- MIKS TEDA LEPINGUS EI OLE. Leping ütleb O-JTA-5 juures: „Migratsioonide arv ei
-- muutu ÜHESKI rajas — `contentPurgedAt` on mustandil juba olemas." See on
-- koodist mõõtes VALE, ja vea koht on täpselt üks rida E5 migratsioonis:
--
--     CHECK ("contentPurgedAt" IS NULL OR "transferredAt" IS NOT NULL)
--
-- E5 kirjutas selle `CHECK`-i ajal, mil L7 tundis AINULT üht purge-rada
-- (12 kuud pärast ülekannet), ja ta on seal õigel põhjusel: purge'itud aga
-- kandmata mustand tähendaks, et töötaja töö kadus, ilma et ta kuhugi jõudnuks.
--
-- RADA C ON TÄPSELT SEE JUHT — ainult et teadlik. Töötaja ütleb „arhiveeri
-- töömaterjal" ja sisu kustub ilma ülekandeta. Vana `CHECK` lükkab selle rea
-- tagasi ANDMEBAASIS, ükskõik mida teenuskiht teeb.
--
-- LAHENDUS EI OLE `CHECK`-i KUSTUTAMINE. See jätaks kaitseta ka automaatse raja
-- ja purge'itud kandmata mustand muutuks eristamatuks andmeveast. Selle asemel
-- saab purge PÕHJUSE ja garantii kitseneb sinna, kuhu ta kuulub: automaatne kell
-- nõuab endiselt ülekannet, teadlik tegu ei nõua.

-- CreateEnum
CREATE TYPE "CaseWorkPurgeReason" AS ENUM ('RETENTION_AFTER_TRANSFER', 'WORKER_ARCHIVED_WORKING_MATERIAL');

-- AlterTable
ALTER TABLE "CaseWorkDraft" ADD COLUMN "contentPurgeReason" "CaseWorkPurgeReason";

-- BACKFILL. Täna ei ole ühtegi purge'itud rida (E7 on esimene, kes neid teeb),
-- aga seda EI EELDATA: kirjutamata backfill on täpselt see, mis kukub alles
-- tootmises, kus ajalugu on pikem kui arendusbaasis.
UPDATE "CaseWorkDraft"
  SET "contentPurgeReason" = 'RETENTION_AFTER_TRANSFER'
  WHERE "contentPurgedAt" IS NOT NULL AND "contentPurgeReason" IS NULL;

-- Vana `CHECK` maha — tema garantii elab edasi kitsamana, vt CHECK 3b.
ALTER TABLE "CaseWorkDraft" DROP CONSTRAINT "CaseWorkDraft_purged_requires_transferred";

-- CHECK 3a — KAHESUUNALINE: aeg ja põhjus käivad koos.
-- Kuupäev ilma põhjuseta ei ütle, kas sisu kustutati teadlikult või kadus;
-- põhjus ilma kuupäevata väidab kustutust, mida ei toimunud.
ALTER TABLE "CaseWorkDraft"
  ADD CONSTRAINT "CaseWorkDraft_purge_reason_matches_time"
  CHECK (("contentPurgedAt" IS NOT NULL) = ("contentPurgeReason" IS NOT NULL));

-- CHECK 3b — E5 garantii, kitsendatud AUTOMAATSELE rajale.
-- L7 kell käib `transferredAt`-ist; ilma ülekandeta ei ole kella, millest 12
-- kuud lugeda, seega „säilitustähtaeg möödus" ei saa olla põhjus.
ALTER TABLE "CaseWorkDraft"
  ADD CONSTRAINT "CaseWorkDraft_retention_purge_requires_transferred"
  CHECK ("contentPurgeReason" IS DISTINCT FROM 'RETENTION_AFTER_TRANSFER' OR "transferredAt" IS NOT NULL);
