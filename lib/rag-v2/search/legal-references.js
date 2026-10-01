// A legal act's references between its own sections, read from its text (ADR-054 follow-up): "käesoleva seaduse § 133
// lõikes 1", "§-s 9", "§-des 105–107". The act's structure says which sections exist and in what order; a reference names
// one of them or nothing. No model and no guess: an ambiguous number or a reference to another act ("lastekaitseseaduse § 3")
// is left out, and every left-out reference of the act's own says why.
// Codex follow-up review 29.09 (J5): a list keeps its act ("Teise seaduse § 131 ja § 133" are both the other act's),
// "käesoleva seadustiku/koodeksi" is the act's own, a range names every section between its ends in the act's order and
// "§-des 105, 106 ja 107" names all three. The reader only finds candidates; linking them is a separate step (REFERS_TO).
const SUPERSCRIPTS = Object.freeze({ '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' });
const SUP = `[${Object.keys(SUPERSCRIPTS).join('')}]`;
// A section's own number: "§ 133." or "§ 15¹." in the chunk's heading path.
const HEADING = new RegExp(`§\\s*(\\d+)(${SUP}*)\\.`, 'u');
// Output bounds: a longer range or list is left unresolved and named, never cut to look complete.
export const REFERENCE_LIMITS = Object.freeze({ range: 30, references: 60 });

/** A section's key: its number with the superscript as digits after a caret ("15^1"), or the plain number. */
export const sectionKey = (base, superscript = '') => (superscript ? `${base}^${[...superscript].map(char => SUPERSCRIPTS[char]).join('')}` : String(base));

/** The section a chunk belongs to, from the heading path its retrieval text starts with; null outside a section. */
export function chunkSection(chunk) {
  const prefix = chunk.retrieval_text.slice(0, chunk.retrieval_mapping?.prefix_length ?? 0);
  const found = prefix.match(HEADING);
  return found ? sectionKey(found[1], found[2]) : null;
}

/** The act's sections in the act's order, from its chunks in document order; one section spans consecutive chunks. */
export function actSections(chunks) {
  const sections = [];
  for (const chunk of chunks) {
    const key = chunkSection(chunk);
    if (key && sections.at(-1) !== key) sections.push(key);
  }
  if (new Set(sections).size !== sections.length) throw Error('act_sections_out_of_order');
  return sections;
}

// The list grammar, read at a position (sticky). A mark: "§", "§§" or "§" with a case ending; a plural one ("§-des",
// "§-de", "§§") may be followed by more numbers without their own mark.
const MARK = /§§|§(?:-(\p{L}+))?/uy;
// An ordinal ("6. peatükis", "2015. aasta") is not a section number.
const NUMBER = new RegExp(`\\s*(\\d+)(${SUP}*)(?![\\d\\p{L}])(?!\\.\\s*\\p{Ll})`, 'uy');
const RANGE = /\s*(?:[–—-]|kuni\s)\s*/uy;
const CONNECTOR = /\s*(?:,\s*(?:(?:ja\/või|ja|ning|või)\s+)?|(?:ja\/või|ja|ning|või)\s+)/uy;
const NEXT_MARK = /\s*(?=§)/uy;
// A smaller unit of the section: "lõikes 1", "lõike 2 punktis 3", "lg 1", "teises lauses".
const UNIT = /\s*(?:(?:esimes|teis|kolmand|neljand|viiend|kuuend|seitsmend|kaheksand|üheksand|kümnend|viimas)\p{L}*\s+)?(?:lõi\p{L}*|lg\.?|alapunkt\p{L}*|punkt\p{L}*|p\.|p(?=\s)|lause\p{L}*|taand\p{L}*)(?!\p{L})/uy;
const SUB_NUMBER = new RegExp(`\\s*\\d+${SUP}*(?:\\s*[–—-]\\s*\\d+${SUP}*)?(?![\\d\\p{L}])`, 'uy');
const at = (pattern, text, position) => { pattern.lastIndex = position; const found = pattern.exec(text); return found ? { found, end: pattern.lastIndex } : null; };
const plural = mark => mark === '§§' || /^i?d/u.test(mark.slice(2));
// After a number: a range, a smaller unit, or another number or mark of the list.
const continues = (text, position) => {
  const range = at(RANGE, text, position), joined = at(CONNECTOR, text, position);
  return Boolean(range && at(NUMBER, text, range.end) || at(UNIT, text, position) || joined && (at(NUMBER, text, joined.end) || at(NEXT_MARK, text, joined.end)));
};
// A section's own heading at the start of a line ("§ 12. Teenuse kulutuste tagasinõudmine") is not a reference.
const HEADING_LINE = new RegExp(`(?:^|\\n)[ \\t]*§\\s*\\d+${SUP}*\\.(?=\\s|$)`, 'uy');

// Whose sections a list is: the words just before its first mark. A sentence ends at . ! ? before a capital, at ; : or a
// line break; a comma alone does not end it.
const BOUNDARY = /[.!?](?=\s+[\p{Lu}„"])|[;:\n]/gu;
const sentenceFrom = (text, start) => { let from = 0; for (const found of text.slice(0, start).matchAll(BOUNDARY)) from = found.index + found[0].length; return from; };
const ACT = '(?:seaduse|seadustiku|koodeksi|määruse|korra|eeskirja|konventsiooni|direktiivi|lepingu|otsuse|käskkirja)';
const OWN_ACT = new RegExp(`(?:^|\\s)käesoleva\\s+${ACT}$`, 'u');
const SAME_ACT = new RegExp(`(?:^|\\s)(?:sama|nimetatud|eelnimetatud|viidatud|selle)\\s+${ACT}$`, 'u');
const OTHER_ACT = new RegExp(`\\p{L}*(?:${ACT}(?:\\s+nr\\s*[\\p{L}\\d./-]+)?|seadus|seadustik|koodeks|määrus)$`, 'u');
// An act's abbreviation ("SHS", "KOKS-i", "TsMS"): an act of unknown identity, never the act's own.
const ABBREVIATION = /(?:^|\s)(?=\p{L}*\p{Lu}\p{L}*\p{Lu})\p{L}+(?:-\p{L}+)?$/u;
// An earlier version of an act ("kuni 2015. aasta 31. detsembrini kehtinud redaktsiooni § 114"): not today's section.
const VERSION = /redaktsiooni(?:s|st|le|ga)?$/u;
// An act the sentence names anywhere before a list ("võlaõigusseaduses ... sätestatut § 272"); "käesolevas seaduses" is the
// act itself. "seaduslik esindaja" names no act.
const MENTION = /(\p{L}+\s+)?\p{L}*(?:seadus(?:e|es|est|ele|ega|t)?|seadustik(?:u|us|ust|ule|uga)?|koodeks(?:i|is|ist|ile|iga)?|määrus(?:e|es|est|ele|ega|t)?)(?!\p{L})/gu;
const mentionsOther = text => [...text.toLocaleLowerCase('et').matchAll(MENTION)].some(found => !/^käesolev/u.test(found[1] || ''));
// The words of the sentence that stand directly before a list's first mark, without what may come between an act's name
// and the list: "lastekaitseseaduse (RT I, 06.12.2014, 1) § 3", "määruse nr 5 „Abi andmise kord“ § 3", "käesoleva seaduse
// 3. peatüki 2. jao § 5".
function wordsBefore(text, start) {
  let before = text.slice(sentenceFrom(text, start), start).trimEnd(), previous;
  do {
    previous = before;
    before = before.replace(/\([^()]*\)$/u, '').replace(/[„"“][^„"“”]*[“”"]$/u, '').replace(/\d+\.\s*(?:peatüki|jao|osa|jaotise|alajao)$/u, '').trimEnd();
  } while (before !== previous);
  return before;
}
function designation(text, start) {
  const before = wordsBefore(text, start), tail = before.toLocaleLowerCase('et');
  if (VERSION.test(tail)) return 'version';
  if (OWN_ACT.test(tail)) return 'own';
  if (SAME_ACT.test(tail)) return 'same';
  if (OTHER_ACT.test(tail) || ABBREVIATION.test(before)) return 'other';
  return null;
}

/**
 * The normalizations whose Riigi Teataja XML text keeps every numeric superscript of a section number (ADR-056), named one
 * by one: a later normalization is added here only when it is known to keep them (Codex R3, 30.09). v29 reads a
 * superscript's whole text (CDATA, an element inside it, attributes). v28 read those forms as plain digits; it stays
 * because no registered XML source has them: all 134 read the same under v28 and v29 (ADR-056, 30.09). v30 reads the
 * text exactly as v29 and adds the amendment notes as data beside it (ADR-062).
 */
export const SUPERSCRIPT_NORMALIZATIONS = Object.freeze(['source-structure-v28', 'source-structure-v29', 'source-structure-v30']);
/** Whether a document version's text keeps its superscripts, so that its plain "§ 131" is § 131 and not § 13¹. */
export function keepsSuperscripts(version) {
  return version?.source_format === 'xml' && SUPERSCRIPT_NORMALIZATIONS.includes(version?.processing_config?.normalization);
}

// A number as the text has it: with its superscript, it names that section. Without one, in a text that keeps its
// superscripts (exact), the section of exactly those digits; otherwise the section whose digits it is when exactly one
// section of the act has them (459 is § 45⁹ when there is no § 459 and no § 4⁵⁹), as an older text may have lost it.
function resolve(base, superscript, sections, exact) {
  if (superscript) { const key = sectionKey(base, superscript); return sections.includes(key) ? { key } : { reason: 'section_not_in_act' }; }
  if (exact) return sections.includes(base) ? { key: base } : { reason: 'section_not_in_act' };
  const matches = sections.filter(key => key.replace('^', '') === base);
  return matches.length === 1 ? { key: matches[0] } : { reason: matches.length ? 'section_ambiguous' : 'section_not_in_act' };
}

// One list from its first mark: the numbers, ranges and marks it joins, each with the smaller unit that follows it.
function readList(text, start) {
  const items = [];
  let position = start, many = false;
  for (;;) {
    const mark = at(MARK, text, position);
    if (!mark) break;
    many = plural(mark.found[0]); position = mark.end;
    let number = at(NUMBER, text, position);
    if (!number) break;
    for (;;) {
      const item = { at: number.found.index + number.found[0].length - number.found[1].length - number.found[2].length,
        from: [number.found[1], number.found[2]], to: null, unit: null };
      position = number.end;
      const range = at(RANGE, text, position), last = range && at(NUMBER, text, range.end);
      if (last) { item.to = [last.found[1], last.found[2]]; position = last.end; }
      item.end = position;
      // Smaller units belong to this section: "lõike 1 punktides 2 ja 3", "lõike 2 teises lauses", "lõikes 1 ja lõikes 3".
      for (;;) {
        const joined = at(CONNECTOR, text, position), unit = at(UNIT, text, position) || (joined && at(UNIT, text, joined.end));
        if (!unit) break;
        position = unit.end;
        for (let sub = at(SUB_NUMBER, text, position); sub; sub = at(SUB_NUMBER, text, position)) {
          position = sub.end;
          const next = at(CONNECTOR, text, position);
          if (!next || !at(SUB_NUMBER, text, next.end)) break;
          position = next.end;
        }
        item.unit = text.slice(item.end, position).trim();
      }
      items.push(item);
      const joined = at(CONNECTOR, text, position);
      if (!joined) return { items, end: position };
      // Another number of a plural mark ("§-des 105, 106 ja 107"), or of a singular one when the list goes on after it
      // ("§-s 200, 214, § 215"): "§ 9 ja 16 kuu jooksul" names one section.
      number = !item.unit ? at(NUMBER, text, joined.end) : null;
      if (number && (many || continues(text, number.end))) continue;
      if (at(NEXT_MARK, text, joined.end)) { position = at(NEXT_MARK, text, joined.end).end; break; }
      return { items, end: position };
    }
  }
  return { items, end: position };
}

/**
 * The references of a text, read against the act's ordered sections.
 * Returns { references: [{ key, at, unit }], other: [{ at, end }], unresolved: [{ at, end, reason }] }: own sections in
 * text order (a range gives each section in it), another act's lists as places in the text, and the act's own references
 * that name no section with why. exactNumbers: the text keeps its superscripts (keepsSuperscripts), so a plain number
 * names exactly that section.
 */
export function readReferences(text, sections, { exactNumbers = false } = {}) {
  if (!Array.isArray(sections) || new Set(sections).size !== sections.length) throw Error('ordered_sections_required');
  const references = [], other = [], unresolved = [];
  let position = 0, sentence = -1, sentenceAct = null, lastAct = null, since = 0;
  for (;;) {
    const start = text.indexOf('§', position);
    if (start < 0) break;
    const line = Math.max(0, text.lastIndexOf('\n', start));
    if (at(HEADING_LINE, text, line)?.end > start) { position = start + 1; continue; }
    const { items, end } = readList(text, start);
    position = Math.max(end, start + 1);
    if (!items.length) continue;
    // The act of the list: named just before it ("sama seaduse" is the act named last in the text), else the nearest one
    // before it in the sentence: a bare list is the act's own unless another act or version was named since the sentence's
    // last list of the act's own.
    const from = sentenceFrom(text, start);
    if (from !== sentence) { sentence = from; sentenceAct = null; since = from; }
    const named = designation(text, start);
    const act = named === 'same' ? lastAct : named || (sentenceAct && sentenceAct !== 'own' || mentionsOther(text.slice(since, start)) ? 'unclear' : 'own');
    if (named && act) { lastAct = act; sentenceAct = act; since = end; }
    if (act === 'other') { other.push({ at: start, end }); continue; }
    for (const item of items) {
      const place = { at: item.at, end: item.end };
      if (act !== 'own') { unresolved.push({ ...place, reason: { unclear: 'act_scope_unclear', version: 'other_version' }[act] || 'same_act_unknown' }); continue; }
      const first = resolve(item.from[0], item.from[1], sections, exactNumbers);
      if (!item.to) {
        if (first.key) references.push({ key: first.key, at: item.at, unit: item.unit }); else unresolved.push({ ...place, reason: first.reason });
        continue;
      }
      const last = resolve(item.to[0], item.to[1], sections, exactNumbers);
      if (!first.key || !last.key) { unresolved.push({ ...place, reason: 'range_bound_unknown' }); continue; }
      const [a, b] = [sections.indexOf(first.key), sections.indexOf(last.key)];
      if (a > b) { unresolved.push({ ...place, reason: 'range_reversed' }); continue; }
      if (b - a + 1 > REFERENCE_LIMITS.range) { unresolved.push({ ...place, reason: 'range_too_long' }); continue; }
      for (const key of sections.slice(a, b + 1)) references.push({ key, at: item.at, unit: item.unit });
    }
  }
  if (references.length > REFERENCE_LIMITS.references) {
    for (const reference of references.splice(REFERENCE_LIMITS.references)) unresolved.push({ at: reference.at, end: reference.at, reason: 'reference_limit' });
  }
  return { references, other, unresolved };
}

/** The act's own sections a text refers to, in order, without repeats. sections: the act's section keys in the act's order. */
export function internalReferences(text, sections, options = {}) {
  return [...new Set(readReferences(text, sections, options).references.map(reference => reference.key))];
}

// ADR-063: a list of another act's sections whose act is named in full directly before it ("sotsiaalhoolekande seaduse
// § 25 lõikes 2", "perekonnaseaduse § 97 punkti 1 või 2"). Only a law, code or codex is named this way: its title in the
// genitive is the name. An abbreviation, "sama seaduse" or an act named elsewhere in the sentence gives nothing.
const GENITIVES = Object.freeze([[/seadus$/u, 'seaduse'], [/seadustik$/u, 'seadustiku'], [/koodeks$/u, 'koodeksi']]);
/** An act's title as a text names it before a list: "Sotsiaalhoolekande seadus" is "sotsiaalhoolekande seaduse"; null for
 *  a title that is no law, code or codex. */
export function actGenitive(title) {
  const name = String(title ?? '').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('et');
  const ending = GENITIVES.find(([nominative]) => nominative.test(name));
  return ending ? name.replace(ending[0], ending[1]) : null;
}
const SUBSECTION_LIST = new RegExp(`(?:lõi\\p{L}*|lg\\.?)\\s*((?:\\d+${SUP}*)(?:\\s*(?:,|ja|ning|või|[–-])\\s*\\d+${SUP}*)*)`, 'u');
const NUMBERED = new RegExp(`^(\\d+)(${SUP}*)$`, 'u');
// The subsections a list item names after its section ("lõikes 2", "lõigetes 5 ja 6", "lõike 1 punktis 3"), as section
// keys; none for an item that names only points or nothing. A range names its two ends.
function namedSubsections(unit) {
  const found = unit?.match(SUBSECTION_LIST);
  return found ? [...new Set(found[1].split(/\s*(?:,|ja|ning|või|[–-])\s*/u).map(part => part.match(NUMBERED)).filter(Boolean).map(part => sectionKey(part[1], part[2])))] : [];
}
/**
 * The sections of named other acts a text points at, in reading order: [{ act, base, superscript, subsections, at }].
 * names: Map from an act's name in the genitive (actGenitive) to the act, for the acts that can be followed. The act is
 * the one whose name ends the words directly before the list; of two names that both end them, the longer. The number is
 * as written (base and superscript): which section of the other act it is, that act's own sections say (resolveSection).
 * A range of sections is left out.
 */
export function namedActReferences(text, names) {
  const found = [];
  let position = 0;
  for (;;) {
    const start = text.indexOf('§', position);
    if (start < 0) break;
    const line = Math.max(0, text.lastIndexOf('\n', start));
    if (at(HEADING_LINE, text, line)?.end > start) { position = start + 1; continue; }
    const { items, end } = readList(text, start);
    position = Math.max(end, start + 1);
    if (!items.length || designation(text, start) !== 'other') continue;
    const before = wordsBefore(text, start).replace(/\s+/gu, ' ').toLocaleLowerCase('et');
    const name = [...names.keys()].filter(key => before.endsWith(key) && !/\p{L}/u.test(before.at(-key.length - 1) ?? ' '))
      .sort((a, b) => b.length - a.length)[0];
    if (!name) continue;
    for (const item of items) {
      if (item.to) continue;
      found.push({ act: names.get(name), base: item.from[0], superscript: item.from[1], subsections: namedSubsections(item.unit), at: item.at });
    }
  }
  return found;
}
/** The section of `sections` a number names, as readReferences resolves the act's own: its key, or null. */
export const resolveSection = (base, superscript, sections, exactNumbers = false) => resolve(base, superscript, sections, exactNumbers).key ?? null;

// A numbered subsection's own line: "(2)" or "(2¹)".
const SUBSECTION_MARK = new RegExp(`(?:^|\\n)\\((\\d+)(${SUP}*)\\)\\s*(?=\\n|$)`, 'gu');
/**
 * The passages of a section that hold one of its subsections, in reading order, at most `limit`: a long subsection runs
 * on into the next passage, and a pointer to it means its text, not the section's start. chunks: the act's chunks in
 * document order. Without a named subsection, or when the section has no such subsection, the section's first passage.
 */
export function provisionChunks(bundle, chunks, section, subsection = null, limit = 2) {
  const own = chunks.filter(chunk => chunkSection(chunk) === section);
  if (!own.length || subsection == null) return own.slice(0, 1);
  const spans = new Map((bundle.spans || []).map(span => [span.id, span])), unit = spans.get(own[0].span_ids[0])?.source_unit_index;
  const raw = bundle.source_units?.[unit]?.raw_text;
  if (typeof raw !== 'string') return own.slice(0, 1);
  const marks = [...raw.matchAll(SUBSECTION_MARK)], index = marks.findIndex(mark => sectionKey(mark[1], mark[2]) === subsection);
  if (index < 0) return own.slice(0, 1);
  const start = marks[index].index + marks[index][0].length, end = index + 1 < marks.length ? marks[index + 1].index : raw.length;
  // The subsection's text begins a few characters after its mark (the mark's own line may close the passage before).
  const from = Math.min(end - 1, start + 3);
  const holding = own.filter(chunk => chunk.span_ids.some(key => {
    const span = spans.get(key);
    return span?.source_unit_index === unit && span.start < end && from < span.end;
  }));
  return holding.length ? holding.slice(0, limit) : own.slice(0, 1);
}
