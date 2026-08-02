/**
 * T25 — KES ON TEENUSEPROFIILI ADRESSAAT.
 *
 * `ServiceProviderProfile.ownerId` tähendab kahes omandirežiimis KAHTE ERI ASJA:
 *
 *   SOLO          — omanik on profiili eest vastutav inimene. Tema on adressaat.
 *   ORGANIZATION  — `ownerId` on AINULT PÄRITOLU: kes profiili kunagi lõi või
 *                   organisatsioonile üle andis. `convertProfileToOrganization`
 *                   jätab ta teadlikult alles auditi faktina
 *                   (`lib/org/serviceProfile.js`, „ownerId JÄÄB ALLES
 *                   päritoluna"). Ta EI ole õigus ega adressaat.
 *
 * Ilma selle vaheta juhtub kolm asja, mis kõik on vaiksed:
 *   1. kliendi pöördumine organisatsioonile maandub eraisiku isiklikku loendisse;
 *   2. teavitused ja meeldetuletused lähevad inimesele, kes võib olla
 *      organisatsioonist ammu lahkunud (offboarding EI tühjenda `ownerId`-d,
 *      sest päritolu ei tohi kaduda);
 *   3. looja konto kustutamisel muutub `ownerId` NULL-iks ja adressaat kaob
 *      päris vaikselt — profiil jääb avalikult nähtavaks, aga keegi ei saa
 *      enam midagi kätte.
 *
 * Seepärast läheb KOGU „kes saab kätte" loogika siit läbi. Moodul on
 * sõltuvusevaba (ei prismat, ei server-only't), et teda tohiks importida nii
 * serveri kuumadelt radadelt, klientkoodist kui node:test'ist.
 */

export const PROVIDER_OWNERSHIP_MODE = Object.freeze({
  SOLO: "SOLO",
  ORGANIZATION: "ORGANIZATION"
});

/** Profiili valik, mida iga kutsuja peab Prismast küsima, et need fn-id töötaks. */
export const PROVIDER_RECIPIENT_SELECT = Object.freeze({
  ownerId: true,
  ownershipMode: true,
  organizationId: true
});

export function isOrganizationOwnedProfile(profile) {
  return profile?.ownershipMode === PROVIDER_OWNERSHIP_MODE.ORGANIZATION;
}

/**
 * Kasutaja-ID, kellele tohib SAATA (pöördumine, teavitus, meeldetuletus).
 *
 * ORGANIZATION-režiimis on vastus ALATI `null` — organisatsiooni postkast ei
 * kuulu ühelegi inimesele ja loojale ei saadeta kunagi midagi. Kutsuja peab
 * `null`-i korral valima organisatsiooni raja või välise e-posti, MITTE
 * kukkuma tagasi `profile.ownerId` peale.
 */
export function resolveProviderRecipientUserId(profile) {
  if (!profile) return null;
  if (isOrganizationOwnedProfile(profile)) return null;
  return profile.ownerId || null;
}

/**
 * Organisatsiooni ID, kui profiil kuulub organisatsioonile. Kutsuja otsustab
 * ise, kas org-rada on tema kontekstis lahti (moodul, väravad, seis).
 */
export function resolveProviderRecipientOrganizationId(profile) {
  if (!isOrganizationOwnedProfile(profile)) return null;
  return profile?.organizationId || null;
}

/**
 * E-posti aadress, kuhu tohib kirjutada.
 *
 * ORGANIZATION-režiimis AINULT profiili enda avalik aadress — looja isiklikku
 * e-posti ei kasutata kunagi, ka mitte varuvariandina. SOLO-režiimis jääb
 * senine järjekord: omaniku aadress, siis profiili oma.
 */
export function resolveProviderRecipientEmail(profile) {
  if (!profile) return null;
  if (isOrganizationOwnedProfile(profile)) return profile.email || null;
  return profile.owner?.email || profile.email || null;
}

/**
 * Auditi `targetUserId`. Organisatsiooni profiili toiming ei ole ühegi
 * eraisiku kohta käiv kirje — veerg on nullable just selleks.
 */
export function resolveProviderAuditTargetUserId(profile) {
  return resolveProviderRecipientUserId(profile);
}
