/**
 * KODUTEENUS K1 — globaalne värav.
 *
 * KAKS TASANDIT, mõlemad peavad kehtima (sama reegel mis `lib/org/flags.js`):
 *   1. see lipp (`HOME_CARE_ENABLED`), mis sõltub organisatsiooni tööruumi lipust;
 *   2. organisatsiooni aktiivne moodul `HOME_CARE`.
 *
 * MIKS LIPP ON VAJA, kuigi moodul on vaikimisi väljas: niipea kui moodulivõti on
 * enumis, pakuks seadete leht selle sisselülitamist igale asutuse omanikule.
 * Lipp hoiab poolvalmis pinna kinni, kuni see on valmis.
 */

import { isOrgWorkspaceEnabled } from "../org/flags.js";

function readFlag(rawValue) {
  const value = String(rawValue ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

export const HOME_CARE_FLAG_KEY = "HOME_CARE_ENABLED";

/** Loetakse päringu ajal, et test saaks väravat ümber lülitada. */
export function isHomeCareEnabled(env = process.env) {
  return isOrgWorkspaceEnabled(env) && readFlag(env[HOME_CARE_FLAG_KEY]);
}

/**
 * UI värav. Loetakse LITERAALSELT: Next küpsetab `NEXT_PUBLIC_*` väärtuse
 * build'i ainult tekstilise ligipääsu korral. See ainult peidab; tõde on
 * serveri lipp.
 */
export function isHomeCareUiEnabled() {
  return readFlag(process.env.NEXT_PUBLIC_HOME_CARE_ENABLED);
}

/** Väravaviga on eristamatu puuduvast ressursist (404). */
export class HomeCareDisabledError extends Error {
  constructor() {
    super("Home care is not available");
    this.name = "HomeCareDisabledError";
    this.code = "HOME_CARE_DISABLED";
    this.status = 404;
  }
}

export function assertHomeCareEnabled(env = process.env) {
  if (!isHomeCareEnabled(env)) throw new HomeCareDisabledError();
}
