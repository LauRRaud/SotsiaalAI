/**
 * JUHTUM-V1 (CASEWORK-P7) — aktiveerimisväravad.
 *
 * VAIKIMISI VÄLJAS. Kogu väravaloogika käib SIIT läbi, et lepingu L19 oleks
 * kontrollitav ühest kohast, mitte laiali `readFlag`/`envEnabled` variatsioonidena.
 * Sama muster mis `lib/serviceLog/flags.js`-il ja sama põhjus.
 *
 * MIKS SEE VÄRAV ÜLDSE OLEMAS ON. Juhtumi objekt kannab isikuandmeid ja tema
 * aktiveerimine peab olema eraldi kontrollitud väljalaskesamm. Omaniku kinnitatud
 * säilituspoliitika on 12 kalendrikuud arhiveerimisest, hoiatus 30 päeva enne ja
 * üleantud mustandi sisule sama ülempiir; organisatsioon võib valida ainult
 * lühema tähtaja. Ilma väravata tähendaks deploy automaatselt aktiveerimist.
 * Värav lahutab koodi paigaldamise ja tootmises sisselülitamise.
 *
 * KAKS LIPPU, ERI ELUIGA:
 *
 *   CASEWORK_V1_ENABLED              — server. Loetakse PÄRINGU ajal.
 *   NEXT_PUBLIC_CASEWORK_V1_ENABLED  — UI. **KÜPSETATAKSE BUILD'i.**
 *
 * Lippude lahknemine tekitab ebajärjekindla kogemuse KUMMASKI suunas: UI sees +
 * server väljas = nupp on nähtav ja API keeldub; UI väljas + server sees = nupp
 * on peidus, aga API on lahti. **Turvalisuse ainus tõde on serverilipp**, ja
 * just teine suund on põhjus, miks UI lipp tohib ainult PEITA, mitte avada.
 */

function readFlag(rawValue) {
  const value = String(rawValue ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

export const CASEWORK_FLAG_KEYS = Object.freeze({
  /** Serveri värav: teenuskiht, API-d, marsruudid. AINUS TÕDE. */
  ENABLED: "CASEWORK_V1_ENABLED",
  /** UI värav (build-time). Ei ava midagi, ainult peidab. */
  PUBLIC_ENABLED: "NEXT_PUBLIC_CASEWORK_V1_ENABLED"
});

/**
 * SERVERI VÄRAV. Kõik kirjutavad ja lugevad teenusoperatsioonid käivad siit
 * läbi; väljas oleku korral käitub funktsioon nii, nagu teda ei oleks olemas.
 */
export function isCaseWorkEnabled(env = process.env) {
  return readFlag(env?.[CASEWORK_FLAG_KEYS.ENABLED]);
}

/**
 * UI VÄRAV kliendipaketis.
 *
 * LOETAKSE LITERAALSELT, mitte `env[võti]` kaudu: Next inline'ib `NEXT_PUBLIC_*`
 * väärtuse ainult siis, kui ligipääs on tekstiliselt
 * `process.env.NEXT_PUBLIC_...`. Dünaamiline indekseerimine jääks kliendipaketis
 * `undefined`-iks ja pind ei ilmuks kunagi — vaikne viga, mis serveris töötaks
 * ja brauseris mitte. (Sama lõks, mille `lib/serviceLog/flags.js` juba kirja paneb.)
 */
export function isCaseWorkUiEnabled() {
  const raw = String(process.env.NEXT_PUBLIC_CASEWORK_V1_ENABLED ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}
