/**
 * Sammuvormi oleku puhtad abid (ilma Reactita, et neid saaks testida).
 */

import { cleanLines } from "../../stage/lines.js";

/** Vormi algseis: valikud vastamata, märkeruudud tühjad, tekstid ja loendid tühjad. */
export function emptyFields(definition) {
  const fields = {};
  for (const step of definition.steps) {
    for (const field of step.fields) {
      fields[field.key] =
        field.kind === "enum" ? null : field.kind === "boolean" ? false : field.kind === "text" ? "" : [];
    }
  }
  return fields;
}

/** Salvestatav kuju: loenditest tühjad read välja, tekstid kärbitud. */
export function cleanFields(definition, fields) {
  const cleaned = { ...fields };
  for (const step of definition.steps) {
    for (const field of step.fields) {
      if (field.kind === "text_list") cleaned[field.key] = cleanLines(fields[field.key]);
      if (field.kind === "text") cleaned[field.key] = String(fields[field.key] || "").trim();
    }
  }
  return cleaned;
}

/** Mitu ühe valikuga küsimust on sammus vastamata. */
export function missingInStep(step, fields) {
  return step.fields.filter((field) => field.kind === "enum" && !fields[field.key]).length;
}

/** Kas väljal on sisu (laia vaate kokkuvõtte jaoks). */
export function hasValue(field, value) {
  if (field.kind === "boolean") return value === true;
  if (field.kind === "enum") return Boolean(value);
  if (field.kind === "text") return Boolean(String(value || "").trim());
  return cleanLines(value).length > 0;
}
