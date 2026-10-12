/**
 * Püsikaardi „Enne kui lähed" reeglid ilma joonistamiseta: mis seisab rea peal,
 * kes mida teha tohib ja mis takistab salvestamist.
 *
 * Kaardil on kuni viis rida, mida asendaja peab teadma enne ukse taha jõudmist.
 * Rea muutmine ei kirjuta vana üle: server lõpetab vana rea ja lisab uue samale
 * kohale, nii et kaardi ajalugu jääb alles. Olek ja päringud on konksus
 * ./useClientCard.js, vaated failis ./CardViews.jsx, kokku paneb need
 * ./ClientCard.jsx.
 */

import { CARE_CARD_LINE_KINDS, CareCardLineKind, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

/** Rea liigi nimi. */
export function kindLabel(t, kind) {
  return t(`home_care.card.kinds.${kind}`);
}

/** Liigid valikuna: `[{ value, label }]`. */
export function kindOptions(t) {
  return CARE_CARD_LINE_KINDS.map((value) => ({ value, label: kindLabel(t, value) }));
}

/** Rea märk: `{ text, tone }` või null. Autojuhile nähtav rida läheb transpordikaardile. */
export function lineChip(line, { t }) {
  return line.forDriver ? { text: t("home_care.card.for_driver_badge"), tone: "" } : null;
}

/** Kaart loendi ridadena: `[{ key, kind, risk, text, chip }]`; oht on tugevam. */
export function cardRows(lines, { t }) {
  return (lines || []).map((line) => ({
    key: line.id,
    kind: kindLabel(t, line.kind),
    risk: line.kind === CareCardLineKind.RISK,
    text: line.text,
    chip: lineChip(line, { t })
  }));
}

/** Mida inimene kaardiga teha tohib: muudab, lisab ja eemaldab see, kellel on kaardi muutmise õigus. */
export function cardRights({ canEdit }) {
  return { edit: Boolean(canEdit) };
}

/** Kaardil on viis rida: rohkem ei saa lisada. */
export function cardFull(lines) {
  return (lines || []).length >= HOME_CARE_LIMITS.CARD_LINES_MAX;
}

/** Mis takistab salvestamist: tekst on kohustuslik. */
export function lineReady(form) {
  return Boolean(String(form.text || "").trim());
}
