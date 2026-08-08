-- JTA-V1 (O-JTA-6) — kohtumise ettevalmistuse purge-marker. KUUES migratsioon.
--
-- Leping: docs/platvormi arendus/jta-v1-arendusleping.md, O-JTA-6.
-- Omaniku otsus 08.08: „laiendada + purge-marker ettevalmistusel".
--
-- MIKS SEE MIGRATSIOON OLEMAS ON. Rada C (O-JTA-5) andis töötajale teo
-- „arhiveeri töömaterjal", aga tema ulatus oli AINULT mustandid — samal ajal kui
-- otsuse enda põhjendus nimetas näitena kaks aastat vana kohtumise
-- ettevalmistust. Tegu, mis ei kata seda, mida ta lubab, on halvem kui puuduv
-- tegu: töötaja arvab, et kliendi sisu on läinud, ja ta ei ole.
--
-- MIKS MARKER, MITTE ETTEVALMISTUSE KUSTUTAMINE. Terve rea kustutamine annaks
-- mustandiga võrreldes vastuolulise elutsükli: mustandi rida jääb ja tema tõend
-- elab, ettevalmistus kaoks jäljetult. Lisaks viitab talle märge
-- (`CaseWorkMeetingNote.meetingPrepId`) — E4 tõendas, et see seos NULLITAKSE,
-- mitte ei võta märget kaasa, ja seda ei tohi ära kaotada: plaani kustutamine ei
-- tohi viia tõendit selle kohta, mis päriselt räägiti.
--
-- KAKS `CHECK`-i, ÜKS NEIST KITSAM KUI MUSTANDIL:
--
--   1. aeg ⟺ põhjus. Sama invariant mis mustandil (E7 CHECK 3a) ja sama
--      põhjendus: kuupäev ilma põhjuseta on eristamatu andmeveast.
--
--   2. AINUS lubatud põhjus on `WORKER_ARCHIVED_WORKING_MATERIAL`.
--      Ettevalmistusel EI OLE kella — ta ei lähe kuhugi üle ja `transferredAt`-i
--      tal ei eksisteeri, seega „säilitustähtaeg möödus" ei saa tema kohta
--      kunagi tõsi olla. See `CHECK` hoiab ära, et tulevane taustatöö kirjutaks
--      siia automaatse purge'i ja tekitaks vaikse kustutuse rajale, mille kogu
--      mõte on, et inimene teeb teo.

-- AlterTable
ALTER TABLE "CaseWorkMeetingPrep" ADD COLUMN "contentPurgedAt" TIMESTAMP(3);
ALTER TABLE "CaseWorkMeetingPrep" ADD COLUMN "contentPurgeReason" "CaseWorkPurgeReason";

-- CHECK 1 — aeg ja põhjus käivad koos, mõlemas suunas.
ALTER TABLE "CaseWorkMeetingPrep"
  ADD CONSTRAINT "CaseWorkMeetingPrep_purge_reason_matches_time"
  CHECK (("contentPurgedAt" IS NOT NULL) = ("contentPurgeReason" IS NOT NULL));

-- CHECK 2 — ettevalmistuse sisu kustutab AINULT inimene.
ALTER TABLE "CaseWorkMeetingPrep"
  ADD CONSTRAINT "CaseWorkMeetingPrep_purge_reason_is_worker_act"
  CHECK ("contentPurgeReason" IS NULL OR "contentPurgeReason" = 'WORKER_ARCHIVED_WORKING_MATERIAL');
