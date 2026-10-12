/**
 * Kliendi kronoloogia koostamise reeglid ilma joonistamiseta: mis kirjed on
 * valitud, mis seisab kirje real, mis takistab edasi minekut ja mis on päringu
 * sisu.
 *
 * Kronoloogia koostamine hooldusjuhile: ajavahemik, kirjete ülevaatus,
 * dokumendi andmed. Dokumenti lähevad AINULT valitud kirjed. Piiratud
 * nähtavusega kirjed (mure, kahtlus) on vaikimisi välja jäetud: nende
 * väljastamine peab olema teadlik valik. Teksti muutmine siin päeviku kirjet ei
 * muuda; dokumendis on märge, et koostaja on teksti lühendanud. Olek ja päringud
 * on konksus ./useChronology.js, vaated on ühised (../client/PartViews.jsx),
 * kokku paneb need ./Chronology.jsx.
 */

import { CareEntryKind } from "@/lib/homeCare/constants";

/** Mitu kirjet on loendis vaates enne nuppu „Näita veel". */
export const ENTRIES_PAGE = 4;

/** Uus valik kirjetele: piiratud nähtavusega kirjed on välja jäetud, tekst on päeviku oma. */
export function initialChoices(items) {
  const next = {};
  for (const item of items) next[item.entryId] = { included: !item.coordinatorOnly, text: null, editing: false };
  return next;
}

/** Kirje valik; kirje, mille valik puudub, ei ole dokumendis. */
export function choiceOf(choices, entryId) {
  return choices[entryId] || { included: false, text: null, editing: false };
}

/** Tekst, mis dokumenti läheb: päeviku tekst või koostaja lühendatud tekst. */
export function shownText(item, choice) {
  return choice.text === null ? item.text : choice.text;
}

/** Koostaja on teksti muutnud. */
export function isEdited(item, choice) {
  return choice.text !== null && choice.text !== item.text;
}

/** Dokumenti valitud kirjed. */
export function selectedItems(items, choices) {
  return items.filter((item) => choices[item.entryId]?.included);
}

/** Kirje märgid: valitud, liik, erijuhtumi liik, ainult hooldusjuhile ja tekst muudetud; `[{ text, tone }]`. */
export function entryChips(item, choice, { t }) {
  return [
    choice.included ? { text: t("home_care.parts.picked"), tone: "ok" } : null,
    item.kind !== CareEntryKind.NOTE ? { text: t(`home_care.entry.kinds.${item.kind}`), tone: "" } : null,
    item.incidentType ? { text: t(`home_care.incident.types.${item.incidentType}`), tone: "" } : null,
    item.coordinatorOnly ? { text: t("home_care.chronology.restricted"), tone: "wait" } : null,
    isEdited(item, choice) ? { text: t("home_care.chronology.edited"), tone: "" } : null
  ].filter(Boolean);
}

/** Kirjed loendi ridadena: `[{ key, title, chips, line }]`; real on aeg ja autor ning tekst täies pikkuses. */
export function entryRows(items, choices, { t, moment }) {
  return items.map((item) => {
    const choice = choiceOf(choices, item.entryId);
    return { key: item.entryId, title: `${moment(item.occurredAt)} · ${item.authorName}`, chips: entryChips(item, choice, { t }), line: shownText(item, choice) };
  });
}

/** Päringu sisu: ajavahemik, dokumendi andmed ja valitud kirjed (kirje versiooniga, mida koostaja nägi). */
export function createBody(draft, selected, choices, details) {
  return {
    from: draft.from,
    to: draft.to,
    requester: details.requester,
    basis: details.basis,
    registryRef: details.registryRef,
    summary: details.summary,
    items: selected.map((item) => {
      const choice = choices[item.entryId];
      /* `revision`: versioon, mida koostaja siin nägi. Kui kirjet on vahepeal
         parandatud, keeldub server ja kirjed tuleb uuesti üle vaadata. */
      return choice.text === null || choice.text === item.text
        ? { entryId: item.entryId, revision: item.revision }
        : { entryId: item.entryId, revision: item.revision, text: choice.text };
    })
  };
}

/** Dokumendi andmete esimene vaade on valmis, kui kes küsis ja mis alusel on kirjas. */
export function detailsReady(details) {
  return Boolean(String(details.requester || "").trim()) && Boolean(String(details.basis || "").trim());
}

/** Dokumendi koostamine: vähemalt üks kirje on valitud, dokumenti ei ole veel koostatud ja asutus on kirjutatav. */
export function createReady({ selected, release, writable }) {
  return selected.length > 0 && !release && Boolean(writable);
}
