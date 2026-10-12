/**
 * „Kui uks ei avane" reeglid ilma joonistamiseta: mis seisab sammu real, kes mida
 * teha tohib ja mis lause on pärast märkimist.
 *
 * Olek ja päringud on konksus ./useNoAnswer.js, vaated failis
 * ./NoAnswerViews.jsx, kokku paneb need ./ClientNoAnswer.jsx.
 */

/** Mida inimene sammudega teha tohib: muudab sammude loendit see, kellel on kaardi muutmise õigus; märgib see, kes tohib kirje teha. */
export function noAnswerRights({ canEdit, canRecord }) {
  return { edit: Boolean(canEdit), record: Boolean(canRecord) };
}

/** Sammud loendi ridadena: `[{ key, title }]`; „1. Helista kliendile". */
export function stepRows(steps) {
  return (steps || []).map((step) => ({ key: step.id, title: `${step.position}. ${step.text}` }));
}

/**
 * Sammud märkimise vaates: `[{ key, title, done }]`; `done` on `{ text, tone }`, kui samm on märgitud
 * (märk käib sammu juurde: „tehtud kell 09:41"), muidu null.
 */
export function tapRows(steps, taps, { t }) {
  return stepRows(steps).map((row) => ({
    ...row,
    done: taps[row.key] ? { text: t("home_care.no_answer.done_at", { time: taps[row.key] }), tone: "ok" } : null
  }));
}

/** Lause pärast märkimist: salvestatud või seadme järjekorras; tühi, kui midagi ei ole märgitud. */
export function doneLine(done, { t }) {
  if (done === "queued") return t("home_care.entry.queued");
  if (done === "saved") return t("home_care.no_answer.recorded");
  return "";
}
