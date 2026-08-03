/* Avalike õigusdokumentide versioonid ja nõustumise tõendikirje konstandid (T10 E4).
   Tõendikirje kasutab olemasolevat FrameworkAcceptance mudelit (frameworkKey on
   vaba string) — eraldi tabelit ega migratsiooni ei vajata. Versioon = teksti
   jõustumiskuupäev; teksti sisulisel muutmisel tõsta versiooni SIIN ja lehel
   kuvatav väärtus järgneb automaatselt. */

export const TERMS_DOCUMENT_KEY = "TERMS_OF_USE";
export const PRIVACY_DOCUMENT_KEY = "PRIVACY_POLICY";
export const GUIDE_DOCUMENT_KEY = "USER_GUIDE";

/* 2026-07-20: T10 faktiparandused (teenuseosutaja paketi hind §5,
   süvauuringu limiidi periood §6). Ei ole juristi lõplik sisukinnitus.
   2026-08-03: privaatsuspoliitika §5 — TartuNLP lisatud volitatud töötlejana
   (eestikeelne ettelugemine). Ainult privaatsus, tingimused ei muutunud. */
export const TERMS_VERSION = "2026-07-20";
export const PRIVACY_VERSION = "2026-08-03";
export const GUIDE_VERSION = "2026-07-20";

export const GENERAL_ACCEPTANCE_TYPE = "GENERAL_CONSENT";
export const GUIDE_ACCEPTANCE_TYPE = "GUIDE_ACK";
export const REGISTER_ACCEPTANCE_SOURCE = "REGISTER_FLOW";

/* Registreerimisel loodavad üldnõustumiste tõendikirjed (terms+privacy on
   kohustuslikud; juhendi kinnitus salvestatakse, kui kasutaja selle andis).
   Read lähevad FrameworkAcceptance tabelisse SAMAS transaktsioonis kasutaja
   loomisega — katkine nõustumine ei loo kontot. */
export function buildRegistrationAcceptanceRows({
  userId,
  role,
  locale = null,
  ipAddress = null,
  userAgent = null,
  guideAck = false,
  acceptedAt = new Date()
}) {
  if (!userId) throw new Error("buildRegistrationAcceptanceRows: userId puudub");
  if (!role) throw new Error("buildRegistrationAcceptanceRows: role puudub");

  const shared = {
    userId,
    acceptanceSource: REGISTER_ACCEPTANCE_SOURCE,
    roleAtAcceptance: role,
    locale,
    ipAddress,
    userAgent,
    acceptedAt
  };

  const rows = [
    {
      ...shared,
      frameworkKey: TERMS_DOCUMENT_KEY,
      frameworkVersion: TERMS_VERSION,
      acceptanceType: GENERAL_ACCEPTANCE_TYPE
    },
    {
      ...shared,
      frameworkKey: PRIVACY_DOCUMENT_KEY,
      frameworkVersion: PRIVACY_VERSION,
      acceptanceType: GENERAL_ACCEPTANCE_TYPE
    }
  ];

  if (guideAck === true) {
    rows.push({
      ...shared,
      frameworkKey: GUIDE_DOCUMENT_KEY,
      frameworkVersion: GUIDE_VERSION,
      acceptanceType: GUIDE_ACCEPTANCE_TYPE
    });
  }

  return rows;
}
