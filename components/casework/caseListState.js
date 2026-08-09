/**
 * JUHTUM-V1 (E6) — juhtumiloendi URL-i ja lehitsemise otsused ILMA JSX-ita.
 *
 * MIKS OMA FAIL. Sama põhjus mis `transferFlow.js`-il: JSX-failis elavat
 * otsust ei saa selle projekti testijooksjaga tõendada ja alles jääks
 * regex-test, mis kontrollib koodi KUJU, mitte käitumist.
 *
 * Kaks otsust elab siin:
 *
 *   SOL-CW-09  juhtumi avamine on NAVIGATSIOON (`pushState`), mitte oleku
 *              vaikne ümberkirjutus (`replaceState`). `replaceState` kirjutas
 *              loendi ajalookirje üle, nii et Back viis eelmisele LEHELE, mitte
 *              juhtumiloendisse — ja komponent ei kuulanud `popstate` sündmust,
 *              seega edasi-/tagasinavigatsioon ei sünkroniseerinud valikut.
 *
 *   SOL-CW-10  „Näita rohkem" tulemus liidetakse olemasolevale loendile. Kaks
 *              sama kursoriga päringut lisaksid samad read kaks korda.
 */

export const CASE_PARAM = "juhtum";

/** Valitud juhtum URL-i päringustringist. Tühi väärtus = loend. */
export function readCaseIdFromSearch(search) {
  const params = new URLSearchParams(String(search || ""));
  const value = params.get(CASE_PARAM);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** `href` koos valitud juhtumiga või ilma. */
export function caseUrlWithCase(href, caseId) {
  const url = new URL(String(href));
  if (caseId) url.searchParams.set(CASE_PARAM, caseId);
  else url.searchParams.delete(CASE_PARAM);
  return url.toString();
}

/**
 * Mida ajalooga teha, kui valik muutub.
 *
 * SULGEMINE KASUTAB `back`-i, kui me ise oleme kirje lisanud: `pushState`
 * sulgemisel tekitaks kolmanda kirje ja Forward viiks juhtumisse, millest
 * kasutaja just väljus. Kui kirjet ei ole (kasutaja tuli otselingiga
 * `?juhtum=<id>`), ei tohi `back` teda platvormilt välja viia — siis
 * kirjutatakse parameeter lihtsalt üle.
 *
 * @returns {{ action: "none"|"push"|"back"|"replace", url: string|null }}
 */
export function planCaseNavigation({ href, currentId = null, nextId = null, pushedDepth = 0 }) {
  const from = currentId || null;
  const to = nextId || null;
  if (from === to) return { action: "none", url: null };
  if (to) return { action: "push", url: caseUrlWithCase(href, to) };
  if (pushedDepth > 0) return { action: "back", url: null };
  return { action: "replace", url: caseUrlWithCase(href, null) };
}

/**
 * Lehe liitmine olemasolevale loendile ID järgi (SOL-CW-10).
 *
 * DEDUPLIKATSIOON ON TEINE KAITSE, mitte esimene: nupp on laadimise ajal
 * keelatud. Aga kursoripõhine loend võib sama rea uuesti tuua ka siis, kui
 * kirje vahepeal muutus ja lehe piirile nihkus — ja siis ei ole topeltklõpsu
 * süüd kuskilt otsida.
 *
 * UUEM VÕIDAB: sama ID kordumisel jääb alles hiljem saabunud versioon, aga
 * rea ASUKOHT loendis ei muutu — muidu hüppaks rida kasutaja silme all.
 */
export function mergeCaseRows(previous, incoming) {
  const base = Array.isArray(previous) ? previous : [];
  const rows = Array.isArray(incoming) ? incoming : [];
  if (!rows.length) return base;

  const merged = [...base];
  const indexById = new Map();
  merged.forEach((row, index) => {
    if (row?.id) indexById.set(row.id, index);
  });

  for (const row of rows) {
    if (!row?.id) continue;
    const existing = indexById.get(row.id);
    if (existing === undefined) {
      indexById.set(row.id, merged.length);
      merged.push(row);
    } else {
      merged[existing] = row;
    }
  }
  return merged;
}
