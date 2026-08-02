/**
 * T25 ORG-FOUNDATION-V1 — organisatsioonikihi feature-gate'id.
 *
 * MIKS ERALDI MOODUL (E0 leid L6): lipud loetakse koodibaasis vähemalt neljal
 * eri viisil (`readFlag` chat/settings.js-is, `enabled()` events-is, `envEnabled`
 * calls-is, `readBooleanEnv` documents-is). Viies muster teeks arenduskava §11.8
 * nõude „iga gate väljas: UI puudub, API suletud, DB kõrvalmõju 0" kontrollimatuks.
 * Kogu org-kihi väravaloogika käib SIIT läbi.
 *
 * VAIKIMISI VÄLJAS. Väravat ei avata koodimuudatusega, vaid keskkonnamuutujaga.
 *
 * Kahe tasandi reegel (arenduskava §10):
 *   1. globaalne gate — siin;
 *   2. organisatsiooni aktiivne moodul/grant — `lib/org/accessContext.js`.
 * Mõlemad peavad kehtima. Globaalne lipp üksi ei ava kellelegi midagi.
 */

/**
 * Tõeseks loetakse ainult selge sisselülitus. Kõik muu — puuduv, tühi, "0",
 * "false", "no", suvaline sodi — on VÄLJAS. Fail-closed on siin vaikimisi
 * käitumine, mitte eriharu.
 */
function readFlag(rawValue) {
  const value = String(rawValue ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

/**
 * Viilu A väravad. Viilude B ja C omad (`ORG_SEATS_ENABLED`, `ORG_INBOX_ENABLED`,
 * `ORG_PROVIDER_PROFILE_ENABLED`, `ORG_SUPPORT_SHARE_ENABLED`) lisab see viil,
 * mis nad kasutusele võtab — arenduskava §9.2 keelab tulevaste viilude
 * „igaks juhuks" ettevalmistuse.
 */
export const ORG_FLAG_KEYS = Object.freeze({
  WORKSPACE: "ORG_WORKSPACE_ENABLED",
  CREATION: "ORG_CREATION_ENABLED",
  // T25 viil B
  SEATS: "ORG_SEATS_ENABLED",
  INBOX: "ORG_INBOX_ENABLED"
});

/**
 * Loeb lipud päringu ajal, mitte mooduli laadimise ajal. Mooduli-tasemel
 * konstant külmutaks väärtuse esimese impordi hetkel ja test ei saaks väravat
 * enam ümber lülitada — sellest tekiks „test möödus, sest lipp jäi sisse".
 */
export function readOrgFlags(env = process.env) {
  const workspace = readFlag(env[ORG_FLAG_KEYS.WORKSPACE]);
  return {
    /** Avab kogu /org pinna: route'id, navigatsiooni, tööruumivahetaja. */
    workspaceEnabled: workspace,
    /**
     * Organisatsiooni loomine on eraldi värav JA nõuab tööruumi väravat.
     * Ilma selleta saaks luua organisatsioone, mida keegi avada ei saa.
     */
    creationEnabled: workspace && readFlag(env[ORG_FLAG_KEYS.CREATION]),
    /* Viilu B väravad SÕLTUVAD tööruumi väravast: kohti ja postkasti ei ole
       mõtet avada, kui organisatsiooni ennast avada ei saa. Iga alamvärav on
       siiski eraldi — rahastuse võib avada ilma vastuvõtuta ja vastupidi. */
    seatsEnabled: workspace && readFlag(env[ORG_FLAG_KEYS.SEATS]),
    inboxEnabled: workspace && readFlag(env[ORG_FLAG_KEYS.INBOX])
  };
}

export function isOrgWorkspaceEnabled(env = process.env) {
  return readOrgFlags(env).workspaceEnabled;
}

export function isOrgCreationEnabled(env = process.env) {
  return readOrgFlags(env).creationEnabled;
}

/**
 * Väravaviga on TEADLIKULT eristamatu puuduvast ressursist: kui gate on väljas,
 * ei tohi vastus paljastada, et selline pind üldse olemas on (arenduskava §10
 * „UI ei reklaami funktsiooni; route failib suletult").
 */
export class OrgFeatureDisabledError extends Error {
  constructor(flagKey) {
    super("Organization workspace is not available");
    this.name = "OrgFeatureDisabledError";
    this.code = "ORG_FEATURE_DISABLED";
    this.status = 404;
    this.flagKey = flagKey;
  }
}

export function assertOrgWorkspaceEnabled(env = process.env) {
  if (!isOrgWorkspaceEnabled(env)) throw new OrgFeatureDisabledError(ORG_FLAG_KEYS.WORKSPACE);
}

export function assertOrgCreationEnabled(env = process.env) {
  assertOrgWorkspaceEnabled(env);
  if (!isOrgCreationEnabled(env)) throw new OrgFeatureDisabledError(ORG_FLAG_KEYS.CREATION);
}

export function isOrgSeatsEnabled(env = process.env) {
  return readOrgFlags(env).seatsEnabled;
}

export function isOrgInboxEnabled(env = process.env) {
  return readOrgFlags(env).inboxEnabled;
}

export function assertOrgSeatsEnabled(env = process.env) {
  assertOrgWorkspaceEnabled(env);
  if (!isOrgSeatsEnabled(env)) throw new OrgFeatureDisabledError(ORG_FLAG_KEYS.SEATS);
}

export function assertOrgInboxEnabled(env = process.env) {
  assertOrgWorkspaceEnabled(env);
  if (!isOrgInboxEnabled(env)) throw new OrgFeatureDisabledError(ORG_FLAG_KEYS.INBOX);
}
