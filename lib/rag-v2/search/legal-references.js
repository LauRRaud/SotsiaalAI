// A legal act's references between its own sections, read from its text (ADR-054 follow-up): "käesoleva seaduse § 133
// lõikes 1", "§-s 9", "§-des 105–107". The act's structure says which sections exist; a reference names one of them or
// nothing. No model and no guess: an ambiguous number or a reference to another act ("lastekaitseseaduse § 3") is left out.
const SUPERSCRIPTS = Object.freeze({ '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' });
const SUP = `[${Object.keys(SUPERSCRIPTS).join('')}]`;
// A section's own number: "§ 133." or "§ 15¹." in the chunk's heading path.
const HEADING = new RegExp(`§\\s*(\\d+)(${SUP}*)\\.`, 'u');
// A reference: the words before it tell whose section it is; the number may lose its superscript in the source text
// ("§ 45<sup>9</sup>" becomes "§ 459"); a range names its first and last section.
const REFERENCE = new RegExp(`((?:\\p{L}+[\\s-]+){0,2})§(?:-\\p{L}+)?\\s*(\\d+)(${SUP}*)(?:\\s*[–-]\\s*(\\d+)(${SUP}*))?`, 'gu');
const FOREIGN = /(?:seaduse|seadustiku|määruse|koodeksi|konventsiooni)\s*$/u;

/** A section's key: its number with the superscript as digits after a caret ("15^1"), or the plain number. */
export const sectionKey = (base, superscript = '') => (superscript ? `${base}^${[...superscript].map(char => SUPERSCRIPTS[char]).join('')}` : String(base));

/** The section a chunk belongs to, from the heading path its retrieval text starts with; null outside a section. */
export function chunkSection(chunk) {
  const prefix = chunk.retrieval_text.slice(0, chunk.retrieval_mapping?.prefix_length ?? 0);
  const found = prefix.match(HEADING);
  return found ? sectionKey(found[1], found[2]) : null;
}

// A number as the text has it: with its superscript, it names that section; without one, the section whose digits it is,
// when exactly one section of the act has them (459 is § 45⁹ when there is no § 459 and no § 4⁵⁹).
function resolve(base, superscript, known) {
  if (superscript) { const key = sectionKey(base, superscript); return known.has(key) ? key : null; }
  const matches = [...known].filter(key => key.replace('^', '') === base);
  return matches.length === 1 ? matches[0] : null;
}

/** The act's own sections a text refers to, in order, without repeats. known: the act's section keys. */
export function internalReferences(text, known) {
  const found = [];
  for (const match of text.matchAll(REFERENCE)) {
    const before = match[1].trim().toLocaleLowerCase('et');
    // "käesoleva seaduse § 9" is the act's own; "lastekaitseseaduse § 3" or "... seaduse § 3" of another act is not.
    if (FOREIGN.test(before) && !/käesoleva\s+(?:seaduse|määruse)\s*$/u.test(before)) continue;
    for (const [base, superscript] of [[match[2], match[3]], ...(match[4] ? [[match[4], match[5]]] : [])]) {
      const key = resolve(base, superscript, known);
      if (key && !found.includes(key)) found.push(key);
    }
  }
  return found;
}
