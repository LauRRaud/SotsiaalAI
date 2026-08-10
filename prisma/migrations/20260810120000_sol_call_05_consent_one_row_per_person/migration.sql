-- SOL-CALL-05 — sama osaleja nõusolekurida võib paralleelselt dubleeruda.
--
-- Audit: docs/audits/sotsiaalai-sol-suvaaudit.md, SOL-CALL-05.
--
-- MIS KATKI OLI. Nõusolekurida loodi kahes kohas mustriga `findFirst → create` ilma
-- tehingu ja ilma unikaalsuspiirita: `ensureConsentRowsForActiveParticipants()`
-- (liitumine, taotluse loomine) ja `respondToRecordingConsent()` (vastamine ilma
-- eelneva reata). Kaks paralleelset toimingut said mõlemad „ei ole rida" ja lõid
-- mõlemad oma rea.
--
-- MIKS SEE ON ROHKEM KUI KOSMEETIKA. Readiness loeb KÕIKI ridu: üks REQUESTED-
-- duplikaat hoidis salvestust lukus ka siis, kui inimene oli juba nõustunud, ja
-- `allRequiredConsentsPresent()` ehitas massiivist Map'i, kus otsustas JUHUSLIK
-- viimane rida — sama inimene võis korraga olla nõustunud ja mitte-nõustunud.
-- Nõusolek ei ole loend, ta on üks tahteavaldus; audititõend „üks inimene, üks
-- viimane otsus" ei kehtinud.
--
-- DUPLIKAATE EI KUSTUTATA VAIKIDES. Kui neid leidub, kukub see migratsioon
-- nimelise teatega. See on teadlik: nõusolek on õiguslik tõend ja masin ei tohi
-- valida, KUMB kahest vastuolulisest tahteavaldusest ellu jääb — seda peab tegema
-- inimene, kes teab, mis kõnes päriselt juhtus. Toodangus mõõdetud 10.08.2026:
-- 13 rida, 13 unikaalset paari, seega duplikaate ei ole ja indeks tekib puhtalt.

DO $$
DECLARE
  duplicate_count integer;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT "recordingRequestId", "userId"
    FROM "CallRecordingConsent"
    GROUP BY 1, 2
    HAVING COUNT(*) > 1
  ) AS duplicates;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION
      'SOL-CALL-05: CallRecordingConsent kannab % dubleeritud (recordingRequestId, userId) paari. Nousolek on oiguslik toend -- migratsioon EI vali voitjat. Lahenda need read kasitsi ja korda.',
      duplicate_count;
  END IF;
END $$;

CREATE UNIQUE INDEX "CallRecordingConsent_recordingRequestId_userId_key"
  ON "CallRecordingConsent" ("recordingRequestId", "userId");
