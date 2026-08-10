-- SOL-CALL-02 + SOL-CALL-03 — salvestuse start saab claim'i, lease'i ja fencing-loendi.
--
-- Audit: docs/audits/sotsiaalai-sol-suvaaudit.md, SOL-CALL-02 ja SOL-CALL-03.
--
-- MIKS KAKS LEIDU ÜHE MIGRATSIOONIGA. Nad kirjeldavad sama auku kahest otsast.
-- CALL-02 ütleb, et start võib võita hilise liituja või nõusoleku tagasivõtu;
-- CALL-03 ütleb, et provider võib salvestada ilma taastatava ACTIVE-seisuta. Mõlema
-- ravim on üks: püsiv seis, mis ütleb „start KÄIB", ja tingimuslikud üleminekud
-- tingimusteta `update`-ide asemel. Kaks eraldi parandust ehitaksid sama mehhanismi
-- kaks korda ja lahkneksid esimese muudatusega.
--
-- MIS TÄPSELT KATKI OLI. `startRecording()` kontrollis kõigi osalejate nõusolekut ja
-- jättis taotluse `READY_TO_RECORD`-iks kogu välise providerikutse ajaks; `ACTIVE`
-- kirjutati alles pärast egress'i starti, TINGIMUSETA `update`-iga. Selles aknas:
--   · paralleelne `joinCall()` otsis peatamiseks ainult juba `ACTIVE` taotlust, ei
--     leidnud midagi ja andis uuele osalejale tokeni — tema hääl läks salvestisse,
--     ilma et ta oleks nõusolekut näinud;
--   · nõusoleku tagasivõtt viis sama rea `DECLINED`-iks, aga start kirjutas hiljem
--     tingimusteta `ACTIVE` peale — tagasivõtt kaotas võidujooksu;
--   · kahe DB-kirjutuse ümber (egressId failile, seis taotlusele) ei olnud
--     kompensatsiooni: kummagi tõrke korral jäi provider salvestama, kuid platvorm
--     näitas starti ebaõnnestununa ja Stop ei osanud egress'i üles leida.
--
-- MIDA VEERUD TEEVAD.
--   · `CallSession.rosterVersion` — FENCING-LOEND. Kasvab iga kord, kui koosseis või
--     nõusolekupilt muutub. Tema mõte on see, et liituja EI PEA starti „püüdma":
--     tal piisab numbri kasvatamisest ja start avastab ise, et tema plaan on aegunud.
--     Püüdmisel oleks alati aken, kasvatamisel ei ole.
--   · `startClaimId` — ühe katse töö-ID. Lõpp-seisu tohib kirjutada ainult rida, mis
--     kannab endiselt SEDA id-d.
--   · `startClaimedAt` — lease'i algus. Aegunud claim on varastatav, seega surnud
--     protsess ei jäta luku igaveseks kinni. Sama muster nagu SOL-RAGADMIN-03.
--   · `rosterVersionAtStart` — `rosterVersion` claim'i hetkel; enne `ACTIVE`-ks
--     minekut võrreldakse uuesti.
--
-- MIKS `rosterVersion` ALGAB NULLIST JA MIKS BACKFILL'I EI OLE. Loend on suhteline:
-- tähtis ei ole tema väärtus, vaid see, kas ta MUUTUS claim'i ja lõpetamise vahel.
-- Käimasoleval kõnel algab ta nullist ja esimene liitumine teeb temast ühe — täpselt
-- nii, nagu vaja. Väljamõeldud algväärtus ei annaks midagi juurde.
--
-- MIKS CHECK ON AINULT PAARI PEALE. `startClaimId` ja `startClaimedAt` peavad käima
-- koos: pool-lease (id ilma ajata) oleks lukk, mille tähtaega ei saa arvutada. CHECK-i
-- „claim tohib olla ainult STARTING seisus" EI OLE — UUID-it ei kasutata kunagi teist
-- korda ja claim-värav laseb iga mitte-STARTING rea läbi, seega terminaalsele reale
-- jäänud claim on müra, mitte viga. CHECK selle peale muudaks iga sõltumatu
-- seisukirjutaja potentsiaalseks 500-ks — kaitse, mis lõhub rohkem kui hoiab.

-- AlterEnum
ALTER TYPE "CallRecordingRequestStatus" ADD VALUE IF NOT EXISTS 'STARTING';

-- AlterTable
ALTER TABLE "CallSession"
  ADD COLUMN "rosterVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "CallRecordingRequest"
  ADD COLUMN "startClaimId"         TEXT,
  ADD COLUMN "startClaimedAt"       TIMESTAMP(3),
  ADD COLUMN "rosterVersionAtStart" INTEGER;

-- CHECK — lease käib paarina.
ALTER TABLE "CallRecordingRequest"
  ADD CONSTRAINT "CallRecordingRequest_start_claim_pair"
  CHECK (("startClaimId" IS NULL) = ("startClaimedAt" IS NULL));
