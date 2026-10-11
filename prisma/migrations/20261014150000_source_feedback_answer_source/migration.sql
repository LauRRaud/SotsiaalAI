-- ALLIKA VEATEADE PRAEGUSE VESTLUSE ALLIKATELE.
--
-- „Teata allika veast" tehti vana teadmussüsteemi allikate jaoks: teade leidis allika vastuse sõnumi
-- metaandmete loendist tunnuse järgi, mida praeguse vestluse (RAG v2) allikatel ei ole. Nuppu ei
-- ilmunud ühegi vastuse juures ja tabelisse ei tekkinud ühtegi rida (mõõdetud päris lehel 11.10.2026).
--
-- Praeguse vestluse allikas on vastuse viide (S3) ühes pöördes. Kolm uut veergu hoiavad pöörde tunnust,
-- viidet ja allika pealkirja teate hetkel; "sourceId" on edaspidi allika dokumendi tunnus korpuses.
-- Pealkiri on korpuse avalik sisu: selle ja dokumendi tunnuse järgi leiab haldur dokumendi ka siis,
-- kui vestlus on kustutatud.
--
-- Aditiivne: kolm tühjaks lubatud veergu, olemasolevaid ridu ei muudeta ja eelmine rakenduse versioon
-- neid veerge ei loe ega kirjuta.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE "SourceFeedback"
  ADD COLUMN "turnId" TEXT,
  ADD COLUMN "sourceRef" TEXT,
  ADD COLUMN "sourceTitle" VARCHAR(300);

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   ALTER TABLE "SourceFeedback" DROP COLUMN "turnId", DROP COLUMN "sourceRef", DROP COLUMN "sourceTitle";
