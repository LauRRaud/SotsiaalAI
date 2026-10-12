/**
 * Kõnede loenduri reeglid ilma joonistamiseta: mis seisab kuu ja teema- ning
 * helistajarea peal.
 *
 * Loendur näitab ARVE. Üksikud kõned on kliendi päevikus kõnemärkena; siin ei ole
 * ühtegi nime ega teksti. Võrdlus eelmise kuuga on iga rea juures. Olek ja päring
 * on konksus ./useCalls.js, vaated on ühised (../client/PartViews.jsx), kokku
 * paneb need ./Calls.jsx.
 */

import { CARE_CALL_CALLERS, CARE_CALL_TOPICS } from "@/lib/homeCare/constants";

/** Selles ega eelmises kuus ei ole ühtegi kõnemärget. */
export function callsEmpty(data) {
  return data.counts.total === 0 && data.previous.total === 0;
}

/** Kõned kokku ja võrdlus eelmise kuuga ühe lausena. */
export function totalLine(t, data) {
  return t("home_care.calls.total", { count: data.counts.total, before: data.previous.total });
}

/** Rida: nimi, arv ja arv eelmisel kuul; loetav, mitte avatav. */
function countRow(t, key, label, count, before) {
  return { key, title: t("home_care.calls.row", { label, count, before }), open: false };
}

/** Kõned teema järgi ridadena: `[{ key, title, open }]`. */
export function topicRows(t, data) {
  return CARE_CALL_TOPICS.map((topic) => countRow(t, topic, t(`home_care.call.topics.${topic}`), data.counts.byTopic[topic], data.previous.byTopic[topic]));
}

/** Kõned helistaja järgi ridadena: `[{ key, title, open }]`. */
export function callerRows(t, data) {
  return CARE_CALL_CALLERS.map((caller) => countRow(t, caller, t(`home_care.call.callers.${caller}`), data.counts.byCaller[caller], data.previous.byCaller[caller]));
}
