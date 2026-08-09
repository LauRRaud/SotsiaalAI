/**
 * JTA-V1 (E2) / SOL-CW-18 — sama kasutaja paralleelsete laua-päringute piir.
 *
 * MIKS TA OLEMAS ON. Leiu teine pool ei olnud üksik aeglane päring, vaid
 * KUHJUMINE: „korduvad refresh'id kuhjavad nähtamatu taustakoormuse just tõrke
 * ajal, mil süsteem on juba aeglane". Statement-timeout piirab ÜHE päringu
 * eluea; ilma selle piirita saab sama inimene ikkagi hoida kümmet lauda korraga
 * lennus, sest tõrke ajal vajutab inimene värskendust rohkem, mitte vähem.
 *
 * VÄRAV ON SLOTT, MITTE JÄRJEKORD. Järjekord tähendaks ootamist ja ootamine on
 * täpselt see, mille eest laud kasutajat kaitseb (L13). Üle piiri minev päring
 * saab kohe 429 — aus vastus, mille peale klient teab uuesti proovida.
 */

import { WORKBENCH_MAX_CONCURRENT_PER_USER } from "./workbenchLimits.js";

/** userId → lennus olevate päringute arv. Protsessi-sisene (vt limits-fail). */
const inFlight = new Map();

/**
 * Võtab kasutajale ühe slotti.
 *
 * @returns {(() => void)|null} vabastaja, või `null` kui piir on täis.
 */
export function acquireWorkbenchSlot(
  userId,
  { limit = WORKBENCH_MAX_CONCURRENT_PER_USER, registry = inFlight } = {}
) {
  const key = typeof userId === "string" ? userId.trim() : "";
  /* Kasutajata päringut siin ei ole (värav on eespool), aga tühi võti koondaks
     KÕIK anonüümsed ühe loenduri alla ja üks neist blokeeriks teised. */
  if (!key) return null;

  const current = registry.get(key) || 0;
  if (current >= limit) return null;
  registry.set(key, current + 1);

  let released = false;
  return function release() {
    /* KAKS KORDA VABASTAMINE EI TOHI LOENDURIT RIKKUDA. `finally` võib joosta
       koos mõne tulevase varajase väljapääsuga ja miinusesse läinud loendur
       tõstaks piiri vaikselt üles — värav, mis ei väravata. */
    if (released) return;
    released = true;

    const next = (registry.get(key) || 1) - 1;
    /* NULLI PEAL KUSTUTA, mitte jäta `0` seisma: iga kunagi lauda avanud
       kasutaja jätaks muidu igavesti rea mällu. */
    if (next <= 0) registry.delete(key);
    else registry.set(key, next);
  };
}

/** Ainult testile ja diagnostikale — mitte kutsuda päringuteel. */
export function workbenchInFlightCount(userId, { registry = inFlight } = {}) {
  return registry.get(typeof userId === "string" ? userId.trim() : "") || 0;
}

export function resetWorkbenchSlots({ registry = inFlight } = {}) {
  registry.clear();
}
