-- KÕNE SALVESTUSE NÕUSOLEK — nõusolekukirje inimese enda keeles.
--
-- Kuvatav nõusolekudialoog oli juba kolmes keeles (calls.recording_consent_*),
-- aga SALVESTATUD tõend ehitati eestikeelsest kõvakodeeritud tekstist. Vene- või
-- ingliskeelne osaleja luges ühte teksti ja tema nõusolekukirjesse jäi teine.
-- Nüüd renderdatakse snapshot vastamise hetkel samadest tõlkevõtmetest, mida
-- liides kuvas, ja keel jääb kirje juurde nähtavaks.
--
-- ADDITIIVNE: mõlemad veerud on NULL-itavad. Olemasolevad read jäävad puutumata
-- ja loetakse eestikeelseks (NULL = enne 04.08.2026), vana voog töötab edasi.
ALTER TABLE "CallRecordingRequest" ADD COLUMN "requesterNameSnapshot" TEXT;
ALTER TABLE "CallRecordingConsent" ADD COLUMN "locale" TEXT;
