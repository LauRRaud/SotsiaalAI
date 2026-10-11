/**
 * Sammuvormi kirjelduste abid: lühikesed kujud väljade, signaalide ja tekstide jaoks.
 *
 * Tekst on kas sõne või [tõlkevõti, varutekst]; võtmed peavad olema kataloogis
 * (seda kontrollib tests/wellbeing-step-forms.test.mjs).
 */

export const options = (pairs) => pairs.map(([value, label]) => ({ value, label }));

/** Üks valik: vana töövormi `{ key, label, options: [[väärtus, silt]] }` kujust. */
export const enumField = (field) => ({ key: field.key, kind: "enum", label: field.label, options: options(field.options) });

/** Mitu ühe valikuga küsimust nimetatud järjekorras. */
export const enumFields = (fields, keys) =>
  keys.map((key) => {
    const field = fields.find((item) => item.key === key);
    if (!field) throw new Error(`väli puudub: ${key}`);
    return enumField(field);
  });

/** Mitu valikut korraga. */
export const listField = (key, label, pairs, hint) => ({ key, kind: "enum_list", label, hint, options: options(pairs) });
export const multiField = (field) => listField(field.key, field.label, field.options);

export const checkField = (key, label, hint) => ({ key, kind: "boolean", label, hint });
export const textField = (key, label, hint, rows) => ({ key, kind: "text", label, hint, rows });

/** Signaalitekstid koos tooniga (ok, warn, risk). */
export const signals = (copy, tones) =>
  Object.fromEntries(Object.entries(copy).map(([level, text]) => [level, { ...text, tone: tones[level] }]));

/** Ühised juhised sammu alguses. */
export const flowLead = (key) => [`wellbeing.flow.leads.${key}`, ""];

/** Vormi pealkiri ja salvestamise tekstid tema enda nimeruumist. */
export const formText = (namespace) => ({
  title: [`wellbeing.${namespace}.title`, ""],
  save: [`wellbeing.${namespace}.save`, ""],
  saving: [`wellbeing.${namespace}.saving`, ""],
  saved: [`wellbeing.${namespace}.saved`, ""],
  failed: [`wellbeing.${namespace}.save_failed`, ""]
});

export const output = (title, key) => ({ title, value: (record) => record.outputSummary[key] });
