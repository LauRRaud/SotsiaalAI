-- SOL-CALL-01 — salvestuse lõppseis vajab PROVIDERI KINNITUST, mitte kavatsust.
--
-- Audit: docs/audits/sotsiaalai-sol-suvaaudit.md, SOL-CALL-01.
--
-- MIKS SEE MIGRATSIOON OLEMAS ON. Nõusoleku tagasivõtul kutsus `discardActiveRecording()`
-- providerilt stoppi, NEELAS tõrke alla (`.catch(() => null)`) ja kirjutas taotlusele
-- sellegipoolest `STOPPED` ning failile `DELETED`. Mõlemad on VÄITED maailma kohta:
-- „ei salvestata enam" ja „faili ei ole". Kui stop tõrkus, olid mõlemad valed ja
-- LiveKit Egress võis kõiki osalejaid edasi lindistada — samal ajal kui UI ei pakkunud
-- enam peatamist, sest taotlus ei olnud enam ACTIVE.
--
-- Vana kood valis teadlikult `STOPPED` selle asemel, et jätta rida `ACTIVE`-ks (vt
-- kommentaar service.js-is: „Egress-tõrge ei tohi jätta taotlust ACTIVE-ks"). Kavatsus
-- oli õige — ummikusse jäänud ACTIVE on halb —, aga vahetus tehti valesse suunda: ta
-- vahetas nähtava ummiku NÄHTAMATU valeväite vastu. Puudu ei olnud otsustavus, vaid
-- kolmas seis: „käskisin, aga ei tea".
--
-- MIDA VÄÄRTUSED TÄHENDAVAD.
--   · `STOPPING`    — stop on providerile saadetud, kinnitust ei ole veel. Ajutine.
--   · `STOP_FAILED` — stop tõrkus või aegus; püsiv taasproov on järjekorras
--     (`DataDeletionJob`, action `CALL_EGRESS_STOP`). Kumbki EI OLE terminaalne ja
--     kumbki EI väida, et salvestamine lõppes.
--   · `QUARANTINED` — artefakt on või võib olla kettal, teda EI TOHI väljastada ja
--     tema kustutus ei ole kinnitatud. `DELETED` on väide faili PUUDUMISE kohta;
--     seda ei tohi kirjutada enne, kui kustutus tõesti õnnestus.
--
-- MIKS UUS VEERG, MITTE LIPP. `providerStopConfirmedAt` kannab HETKE, mil provider ise
-- ütles terminaalse seisu. Boolean vastaks küsimusele „kas lõppes", aeg vastab ka
-- küsimusele „millal ja kui ammu" — seda on vaja reconcile'il, mis peab eristama äsja
-- saadetud stoppi vanast egress'ist, mille LiveKit on ajaloost juba välja koristanud.
-- NULL tähendab „EI OLE TÕENDATUD", mitte „ei ole lõppenud".
--
-- BACKFILL ON TAHTLIKULT KITSAS. Täidetakse ainult `COMPLETED` taotluste failid. Vana
-- `stopRecording()` viskas provider-tõrke korral erindi ja märkis rea `FAILED`-iks,
-- seega `COMPLETED` tõendab, et stop-kutse tuli VEATA tagasi. See on nõrgem tõend kui
-- uus bar (kutse õnnestus ≠ provider raporteeris terminaalse seisu), kuid see on
-- tugevaim fakt, mis ajaloolistel ridadel üldse olemas on.
--
-- `STOPPED` read jäävad TEADLIKULT NULL-iks. Just nemad on need, mille kohta SOL-CALL-01
-- ütleb, et nad võivad valetada. Väljamõeldud kinnitusaeg peidaks leiu ära. Migratsioon
-- EI pane neile ka taasproovi järjekorda: LiveKit on nende egress'id ammu ajaloost
-- koristanud ja järjekord, mis ei saa kunagi tühjeneda, on järelevalve, mis näeb välja
-- nagu töötav.

-- AlterEnum
ALTER TYPE "CallRecordingRequestStatus" ADD VALUE IF NOT EXISTS 'STOPPING';
ALTER TYPE "CallRecordingRequestStatus" ADD VALUE IF NOT EXISTS 'STOP_FAILED';

-- AlterEnum
ALTER TYPE "CallRecordingFileStatus" ADD VALUE IF NOT EXISTS 'QUARANTINED';

-- AlterTable
ALTER TABLE "CallRecordingFile"
  ADD COLUMN "providerStopConfirmedAt" TIMESTAMP(3);

-- Backfill: ainult tõendatud lõppenud salvestused, vt selgitust ülal.
UPDATE "CallRecordingFile" f
   SET "providerStopConfirmedAt" = r."stoppedAt"
  FROM "CallRecordingRequest" r
 WHERE f."recordingRequestId" = r."id"
   AND r."status" = 'COMPLETED'
   AND r."stoppedAt" IS NOT NULL
   AND f."providerStopConfirmedAt" IS NULL;
