/**
 * TEENUSPÄEVIK-V1 — feature-gate'id.
 *
 * VAIKIMISI VÄLJAS. Kogu teenuspäeviku väravaloogika käib SIIT läbi, et
 * lepingu DoD punkt 7 („kõik lipu taga kuni omanik avab") oleks kontrollitav
 * ühest kohast, mitte laiali `readFlag`/`envEnabled`/`readBooleanEnv`
 * variatsioonidena (sama õppetund, mis T25 E0 leid L6).
 *
 * KAKS LIPPU, ERI ELUIGA:
 *
 *   SERVICE_LOG_ENABLED              — server. Loetakse PÄRINGU ajal.
 *   NEXT_PUBLIC_SERVICE_LOG_ENABLED  — UI. **KÜPSETATAKSE BUILD'i.**
 *
 * See vahe on lõks, mille projekt on juba korra kinni maksnud (27.07,
 * hinnakonstandid): `NEXT_PUBLIC_*` väärtus asendatakse bundle'is ehitamise
 * hetkel, seega tema muutmine serveris EI MÕJU enne uut build'i. Kui UI ja
 * server lähevad lahku, on tagajärg alati sama suund: nupp on nähtav, API
 * ütleb 404. Serveripoolne lipp on ainus tõde — UI lipp tohib pinda ainult
 * PEITA, mitte avada.
 */

function readFlag(rawValue) {
  const value = String(rawValue ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

export const SERVICE_LOG_FLAG_KEYS = Object.freeze({
  /** Serveri värav: API-d, teenuskiht, marsruudid. */
  ENABLED: "SERVICE_LOG_ENABLED",
  /** UI värav (build-time). Ei ava midagi, ainult peidab. */
  PUBLIC_ENABLED: "NEXT_PUBLIC_SERVICE_LOG_ENABLED",
  /**
   * Ühekordne asukohatempel kinnituse hetkel. Omaniku otsus nr 5 (leping 8.8),
   * vaikimisi VÄLJAS. Pidevat asukohajada ei koguta ka siis, kui see on sees.
   */
  LOCATION_STAMP: "SERVICE_LOG_LOCATION_STAMP",
  /** Kas klient näeb oma kuuaruannet (E7). Omaniku otsus nr 2. */
  CLIENT_VIEW: "SERVICE_LOG_CLIENT_VIEW"
});

/**
 * Loeb lipud PÄRINGU ajal, mitte mooduli laadimise hetkel — muidu külmuks
 * väärtus esimese impordi juures ja test ei saaks väravat enam ümber lülitada
 * („test möödus, sest lipp jäi sisse").
 */
export function readServiceLogFlags(env = process.env) {
  const enabled = readFlag(env[SERVICE_LOG_FLAG_KEYS.ENABLED]);
  return {
    enabled,
    /* Alamlipud SÕLTUVAD peavärava'st: asukohatemplit ega kliendivaadet ei ole
       mõtet avada, kui teenuskirjet ennast ei saa luua. */
    locationStampEnabled: enabled && readFlag(env[SERVICE_LOG_FLAG_KEYS.LOCATION_STAMP]),
    clientViewEnabled: enabled && readFlag(env[SERVICE_LOG_FLAG_KEYS.CLIENT_VIEW])
  };
}

export function isServiceLogEnabled(env = process.env) {
  return readServiceLogFlags(env).enabled;
}

export function isServiceLogLocationStampEnabled(env = process.env) {
  return readServiceLogFlags(env).locationStampEnabled;
}

export function isServiceLogClientViewEnabled(env = process.env) {
  return readServiceLogFlags(env).clientViewEnabled;
}

/**
 * Väravaviga on TEADLIKULT eristamatu puuduvast ressursist: väljas väravaga ei
 * tohi vastus paljastada, et selline pind üldse olemas on.
 */
export class ServiceLogDisabledError extends Error {
  constructor() {
    super("Service log is not available");
    this.name = "ServiceLogDisabledError";
    this.status = 404;
    this.messageKey = "service_log.errors.not_found";
  }
}

export function assertServiceLogEnabled(env = process.env) {
  if (!isServiceLogEnabled(env)) throw new ServiceLogDisabledError();
}
