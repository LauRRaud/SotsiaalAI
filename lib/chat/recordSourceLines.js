/* The source view of a structured record (a municipality's service, benefit or contact), field by field. The cited
   excerpt is its fields' values one to a line, and each line's JSON path (source_locations) says which field it is.
   Owner 22.10.2026, on a Harku record that showed its contacts as "harku_vald_contact_meeli_vaarpuu" and two bare dates:
   "seal imelik kontakt jne". Identifiers of linked records are the records' own navigation, not text for a reader (the
   record catalogue never shows them either, structured-record-source.js); a reader finds the linked contact among the
   answer's sources. A line that cannot be placed leaves the whole excerpt to the plain view, without the identifiers. */

const IDENTIFIER = /^[\p{Ll}\p{N}]+(?:[_:.-][\p{Ll}\p{N}]+)+$/u;
const DAY = /^(\d{4})-(\d{2})-(\d{2})(?:[T ][\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/u;
const EMPTY = /^\s*(?:\[\s*\]|\{\s*\}|null)\s*$/u;

const pointerPart = part => part.replaceAll("~1", "/").replaceAll("~0", "~");
function identifierList(text) {
  let value; try { value = JSON.parse(text); } catch { return false; }
  return Array.isArray(value) && value.length > 0 && value.every(item => typeof item === "string" && IDENTIFIER.test(item));
}
// A value that is another record's identifier, or a list of them. A day ("2026-04-11") has the same shape and stays.
export const hiddenValue = text => {
  const value = text.trim();
  return !value || EMPTY.test(value) || identifierList(value) || IDENTIFIER.test(value) && !DAY.test(value);
};
export const dayText = text => {
  const day = DAY.exec(text.trim());
  return day ? `${day[3]}.${day[2]}.${day[1]}` : text;
};

/** The excerpt's lines with their fields ({ field, value }), the hidden ones left out; null when a line's place cannot be
 *  read (not a JSON record, or a value whose length does not match its place). */
export function recordSourceLines(text, locations) {
  if (typeof text !== "string" || !Array.isArray(locations) || !locations.length
    || locations.some(location => location?.kind !== "json" || typeof location.path !== "string"
      || !Number.isSafeInteger(location.start) || !Number.isSafeInteger(location.end) || location.end < location.start)) return null;
  const lines = [];
  let at = 0;
  for (const [index, location] of locations.entries()) {
    const value = text.slice(at, at + location.end - location.start);
    if (value.length !== location.end - location.start) return null;
    at += value.length;
    if (index < locations.length - 1) {
      if (text[at] !== "\n") return null;
      at += 1;
    }
    // "/items/12/summary" is the field summary; "/items/12/relatedContacts/0" an item of the list relatedContacts.
    const parts = location.path.split("/").map(pointerPart);
    const field = /^\d+$/.test(parts.at(-1)) ? parts.at(-2) : parts.at(-1);
    if (!hiddenValue(value)) lines.push({ field: field || null, value });
  }
  return at === text.length ? lines : null;
}

/** The plain view of an excerpt whose lines cannot be placed: its text without identifier lines. */
export const plainRecordText = text => String(text || "").split("\n").filter(line => !hiddenValue(line)).join("\n");
