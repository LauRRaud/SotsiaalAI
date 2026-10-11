/**
 * Organisatsioonide lehtede ühised väikesed reeglid ilma joonistamiseta: teist
 * vajutust küsiv tegevus ja kuupäeva kuju. Lehe enda reeglid on lehe kaustas
 * (nt ./home/orgBoard.js, ./join/joinRules.js); siin on ainult see, mida
 * kasutab mitu lehte.
 */

/* Teine vajutus samal nupul ei tule topeltklõpsust; kinnituse ootus aegub. */
export const PRESS_GAP_MS = 400;
export const CONFIRM_MS = 8000;

export function pressTooSoon(since, now = Date.now()) {
  return Boolean(since) && now - since < PRESS_GAP_MS;
}

/**
 * Mida teeb vajutus tegevusel, mis küsib teist vajutust samal nupul:
 *  - "arm":  esimene vajutus (või vajutus teisele tegevusele): nupp küsib kinnitust;
 *  - "wait": teine vajutus tuli liiga ruttu (topeltklõps): midagi ei juhtu;
 *  - "go":   teine vajutus: tegevus tehakse.
 */
export function secondPress(armedKey, key, armedAt, now = Date.now()) {
  if (!key || armedKey !== key) return "arm";
  return pressTooSoon(armedAt, now) ? "wait" : "go";
}

/** ISO hetk → `15.10.2026` inimese enda ajavööndis. Vigane väärtus annab tühja sõne. */
export function dayOf(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const two = (value) => String(value).padStart(2, "0");
  return `${two(date.getDate())}.${two(date.getMonth() + 1)}.${date.getFullYear()}`;
}
