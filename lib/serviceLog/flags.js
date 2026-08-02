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
  /** UI-pool asukohatemplile (build-time). Ei ava midagi, ainult peidab. */
  PUBLIC_LOCATION_STAMP: "NEXT_PUBLIC_SERVICE_LOG_LOCATION_STAMP",
  /** Kas klient näeb oma kuuaruannet (E7). Omaniku otsus nr 2. */
  CLIENT_VIEW: "SERVICE_LOG_CLIENT_VIEW",
  /** UI-pool kliendivaatele (build-time). Ei ava midagi, ainult peidab. */
  PUBLIC_CLIENT_VIEW: "NEXT_PUBLIC_SERVICE_LOG_CLIENT_VIEW"
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

/**
 * UI VÄRAV kliendipaketis.
 *
 * LOETAKSE LITERAALSELT, mitte `env[võti]` kaudu: Next inline'ib
 * `NEXT_PUBLIC_*` väärtuse ainult siis, kui ligipääs on tekstiliselt
 * `process.env.NEXT_PUBLIC_...`. Dünaamiline indekseerimine jääks
 * kliendipaketis `undefined`-iks ja kaart ei ilmuks kunagi — vaikne viga,
 * mis serveris töötaks ja brauseris mitte.
 *
 * TA AINULT PEIDAB. Tõde on serveri `SERVICE_LOG_ENABLED`: kui see UI lipp
 * on ekslikult sees, näeb kasutaja kaarti, aga API vastab 404-ga.
 */
export function isServiceLogUiEnabled() {
  const raw = String(process.env.NEXT_PUBLIC_SERVICE_LOG_ENABLED ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/**
 * ASUKOHATEMPLI UI-VÄRAV (E2b). Loetakse literaalselt samal põhjusel, mis
 * `isServiceLogUiEnabled` juures.
 *
 * TA AINULT PEIDAB NUPU. Tõde on serveri `SERVICE_LOG_LOCATION_STAMP`: kui see
 * on väljas, EI SALVESTATA punkti ka siis, kui brauser ta kätte sai. Seepärast
 * ütleb UI „salvestatud" alles serveri vastuse põhjal (`locationStampedAt`),
 * mitte selle põhjal, et geolokatsioon õnnestus.
 */
export function isServiceLogLocationStampUiEnabled() {
  const raw = String(process.env.NEXT_PUBLIC_SERVICE_LOG_LOCATION_STAMP ?? "")
    .trim()
    .toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/**
 * KLIENDIVAATE UI-VÄRAV. Loetakse literaalselt samal põhjusel, mis teised
 * `NEXT_PUBLIC_*` lipud. Ainult peidab; tõde on serveri `SERVICE_LOG_CLIENT_VIEW`,
 * mille väljas olek annab kliendi marsruudile 404.
 */
export function isServiceLogClientViewUiEnabled() {
  const raw = String(process.env.NEXT_PUBLIC_SERVICE_LOG_CLIENT_VIEW ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
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
