/**
 * Asutuse tugimeetmete reeglid ilma joonistamiseta: loendi rühmad, muutmise
 * sammud, mustand ja mis serverisse läheb.
 *
 * Meetmed ja nende sildid tulevad samast kataloogist, mida töötaja „Minu
 * tugivõimalused" kasutab (`lib/wellbeing/supportMeasureCatalog.js`): asutuse
 * märge eeltäidab töötaja loendi otse. Teenusekiht: `lib/org/supportMeasures.js`.
 */

import { SUPPORT_MEASURE_GROUPS, SUPPORT_MEASURE_LABELS, SUPPORT_MEASURE_VALUES } from "@/lib/wellbeing/supportMeasureCatalog";

/** Sama piir mis serveris (`SUPPORT_MEASURE_DETAILS_LIMIT`). */
export const MEASURE_DETAILS_LIMIT = 200;

export const MEASURE_GROUPS = Object.freeze(Object.keys(SUPPORT_MEASURE_GROUPS));

/** Muutmise sammud: kolm rühma ja juhised. */
export const MEASURE_STEPS = Object.freeze([...MEASURE_GROUPS, "details"]);

export const measureLabel = (measureKey) => SUPPORT_MEASURE_LABELS[measureKey] || measureKey;

/** Meetme nimi lehe keeles (sama võti mis töötaja vormil); `measureLabel` on varutekst. */
export const measureText = (t, measureKey) => t(`wellbeing.support_measures.measures.${measureKey}`, measureLabel(measureKey));

const groupOf = (measureKey) => MEASURE_GROUPS.find((group) => SUPPORT_MEASURE_GROUPS[group].some(([value]) => value === measureKey));

/** Serveri loend mustandiks: `{ [measureKey]: details }`. */
export function measureDraft(measures) {
  const draft = {};
  for (const measure of Array.isArray(measures) ? measures : []) {
    if (SUPPORT_MEASURE_VALUES.includes(measure?.measureKey)) draft[measure.measureKey] = measure.details || "";
  }
  return draft;
}

export function toggleMeasure(draft, measureKey) {
  const next = { ...draft };
  if (measureKey in next) delete next[measureKey];
  else next[measureKey] = "";
  return next;
}

/** Märgitud meetmed kataloogi järjekorras. */
export const draftKeys = (draft) => SUPPORT_MEASURE_VALUES.filter((value) => value in (draft || {}));

/** Mis serverisse läheb: `[{ measureKey, details }]`, juhis kärbitud. */
export function measurePayload(draft) {
  return draftKeys(draft).map((measureKey) => ({ measureKey, details: String(draft[measureKey] || "").trim() }));
}

/** Kas mustand erineb salvestatust (loobumine küsib siis teist vajutust). */
export function measuresDirty(draft, measures) {
  return JSON.stringify(measurePayload(draft)) !== JSON.stringify(measurePayload(measureDraft(measures)));
}

/** Rühma valikud lahtritena. */
export const groupOptions = (group) => SUPPORT_MEASURE_GROUPS[group].map(([value, label]) => ({ value, label }));

/** Sammu heledus kiirmenüüs: rühmas on midagi märgitud või juhis on kirjas. */
export function measureStepStates(draft) {
  const keys = draftKeys(draft);
  const states = {};
  for (const group of MEASURE_GROUPS) states[group] = keys.some((key) => groupOf(key) === group) ? "done" : "empty";
  const described = keys.filter((key) => String(draft[key] || "").trim());
  states.details = !keys.length || !described.length ? "empty" : described.length === keys.length ? "done" : "partial";
  return states;
}

/** Loetav loend rühmade kaupa: `[{ group, rows: [{ key, title, sub }] }]`, tühjad rühmad välja. */
export function measureGroupsOf(measures) {
  const draft = measureDraft(measures);
  return MEASURE_GROUPS.map((group) => ({
    group,
    rows: SUPPORT_MEASURE_GROUPS[group]
      .filter(([value]) => value in draft)
      .map(([value, label]) => ({ key: value, title: label, sub: String(draft[value] || "").trim() }))
  })).filter((entry) => entry.rows.length);
}
