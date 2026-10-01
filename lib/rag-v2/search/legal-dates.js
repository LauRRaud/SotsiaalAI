// A Riigi Teataja act's dates beside its text, as the answer model reads them (ADR-062, stage 2). The reader
// (source-structure-v30) keeps the amendment notes on the source units and the act's own dates in legal_text; here they
// become an excerpt's `amendments` and a source card's `act_dates`. Both depend only on the bundle and the chunk, never on
// the query, and take no part in choosing evidence. A bundle without the data (an earlier reader, a PDF, a JSON record,
// a derived annex) gives neither.

// A note's words and an act's sentence are shown whole. Cut at 160 characters, a court ruling's note stopped before the
// words that say what it struck (the state fees act's § 59: its note is the ruling's operative part and names no court,
// so no wording tells a ruling apart) and a scoped rule before its day. The reader keeps at most 2000 characters of a
// note and 400 of a sentence (the longest registered are 551 and 331); the cap over the whole context
// (LEGAL_DATES_TOKENS) bounds what they add.
export const LEGAL_DATES_LIMITS = Object.freeze({ groups: 8, provisions: 12, changed: 12, entry: 3, scoped: 3 });

// A part, chapter or division's note says nothing on whether the division was added or only its heading amended, except
// where its number carries a superscript ("10¹. jagu"): that one was added by the note, which so dates every section in
// it. Any other division's note is about the heading and is not shown with the sections under it, but for an added
// section that carries no note of its own ("§ 88¹."): an amendment added it, and the only note that amendment left is
// on the nearest division above (Märjamaa 421032026022 §§ 88¹ and 88² under "15. jagu Vaimse tervise teenus", whose
// note § 88³ repeats; Harku 404072025017 §§ 22¹ and 24¹; no other registered section is so).
const ADDED_NUMBER = /[⁰¹²³⁴-⁹]$/u, ADDED_DIVISION = /^\d+[⁰¹²³⁴-⁹]+\./u, ADDED_SECTION = /^§ \d+[⁰¹²³⁴-⁹]+$/u, ADDED_SECTION_TEXT = /^§ \d+[⁰¹²³⁴-⁹]+\./u;
// A repeal whose word is one letter off ("Kehetu", one registered note): the reader marks only the word itself.
const oneEdit = (a, b) => {
  if (Math.abs(a.length - b.length) > 1) return false;
  let at = 0;
  while (at < a.length && at < b.length && a[at] === b[at]) at++;
  return [[1, 1], [1, 0], [0, 1]].some(([x, y]) => a.slice(at + x) === b.slice(at + y));
};
const REPEAL_WORDS = ['kehtetu', 'kehtetud'];
const misspeltRepeal = words => { const first = words?.match(/^\p{L}+/u)?.[0].toLowerCase(); return Boolean(first) && REPEAL_WORDS.some(word => oneEdit(first, word)); };

// How Riigi Teataja places a section's notes, read from the 519 registered acts and from the pairs of their versions:
// - A note right after the heading (a child of the section itself) is the heading's: 1,516 of 1,707 added sections have
//   none, so it is not how a new section is marked. Only where the same amendment's one other note closes the section
//   and says the same does the pair mark a section reworded as a whole. A heading's note with words of its own is about
//   what they say (lastekaitseseadus 111072026042 § 27²: "muudetud paragrahvi number 27¹ numbriks 27²", and only lg 4
//   carries the other note): it stays the heading's, with its words.
// - The note that closes a section (the last thing in its text) is kept in its last subsection or point. Under a number
//   with a superscript ("§ 13²") it is the note that added the section. Under a plain number it is the last provision's
//   or the whole section's, which one version cannot tell (of five such notes new between two versions, two were the
//   whole section's): the label says both ("§ 9 lg 6 või kogu § 9").
// - A closing note is the last provision's own where another note of the section is older (the section stood before
//   it) or of the same amendment (which then marked its provisions one by one).
// - The same one level down: the note that closes a numbered subsection is kept in its last point (Rakvere 407052026045
//   § 10 lg 8: the note in point 2 reads "§ 10 lg 8 rakendatakse alates 01.01.2027"). It is the subsection's under a
//   superscript ("§ 142⁴⁷ lg 3¹"), the point's or the subsection's under a plain number ("§ 91 lg 2 p 2 või kogu § 91
//   lg 2"), and the point's own where another note of that subsection is older or another point's is of the same
//   amendment.
// - A note after a numbered subsection's opening words, with its points to follow, is about those words, as in an
//   unnumbered one ("§ 70 lg 1 sissejuhatav lauseosa"): of nine such notes new between two versions, the points under
//   five had not changed at all. It does not make the closing note the last point's own (of four subsections marked so
//   at both ends, in three more had changed than the opening words and the last point).
// - An added section's earliest note is the one that added it, also where it stands after the heading: with no older
//   note, no other note of its amendment and no whole-section note beside it, it is the section's, not the heading's
//   (Rapla 405092026058 § 52¹).
// - A note inside an unnumbered subsection that its points follow is about the opening words; the one that closes such a
//   subsection is the reader's "§ N" already.
const DIRECT = /\/paragrahv\[\d+\]\/muutmismarge\[\d+\]$/u;
// The next numbered subsection's number, and what may stand between a subsection's last words and its end: the numbers
// of points left empty.
const NEXT_SUBSECTION = /\n\(\d+[⁰¹²³⁴-⁹]*\)(?:\n|$)/u, EMPTY_POINTS = /^(?:\s*\d+[⁰¹²³⁴-⁹]*\)(?=\n|$))*\s*$/u;
const sameAmendment = (a, b) => a.act_reference === b.act_reference && a.in_force === b.in_force;
const sameWords = (a, b) => (a.note || '') === (b.note || '') && (a.applies_from || '') === (b.applies_from || '');
// Where a provision's text starts in its section's text: the end of its marker ("(2)", "3)"), the last one before `offset`.
function markerEnd(text, offset, kind, number) {
  const before = text.slice(0, offset), marker = `\n${kind === 'lg' ? '(' : ''}${number})`;
  for (let at = before.lastIndexOf(marker); at >= 0; at = at > 0 ? before.lastIndexOf(marker, at - 1) : -1) {
    const end = at + marker.length;
    if (end === before.length || before[end] === '\n') return end;
  }
  return null;
}
const sectionNotes = new WeakMap();
/** A section's notes as they are shown: each with its label, whether it is a repeal, and the part of the section's
 *  text it is about, (from, to]. `as_read` is the reader's label (as version_change names it); a heading's note that
 *  its closing twin tells is `hidden`. A note without a place is not shown. */
function unitNotes(unit) {
  if (!unit) return [];
  if (sectionNotes.has(unit)) return sectionNotes.get(unit);
  const text = unit.raw_text || '', length = text.length, placed = (unit.amendments || []).filter(note => Number.isInteger(note.offset));
  const direct = note => DIRECT.test(note.path), heading = note => direct(note) && !note.repeal && note.offset < length, closes = note => note.offset === length && !note.repeal;
  // A part (the section, or the notes of one subsection) stood before a note when another of its notes is older, and
  // was marked piece by piece when another is of the same amendment.
  const stood = (note, among = placed) => !note.in_force || among.some(other => Boolean(other.in_force) && other.in_force < note.in_force);
  const marked = (note, among = placed) => among.some(other => other !== note && sameAmendment(other, note));
  // A section reworded as a whole: the amendment's only two notes in it stand after the heading and at the end, and say the same.
  const paired = note => { const same = placed.filter(other => sameAmendment(other, note)); return same.length === 2 && heading(same[0]) && closes(same[1]) && sameWords(same[0], same[1]) && !stood(note); };
  // Where a note's numbered subsection ends, and whether the note stands after that subsection's last words.
  const until = note => { const next = text.slice(note.offset).search(NEXT_SUBSECTION); return next < 0 ? length : note.offset + next; };
  const ends = note => EMPTY_POINTS.test(text.slice(note.offset, until(note)));
  // The numbered subsection a point's note closes: its label, where its text starts, its notes, and whether its number is an added one.
  const closed = note => {
    const [, label, number] = note.provision.match(/^(§ \S+ lg (\S+)) p \S+$/u) || [];
    const from = label && ends(note) ? markerEnd(text, note.offset, 'lg', number) : null;
    return from === null ? null : { label, from, added: ADDED_NUMBER.test(number), notes: placed.filter(other => other.offset > from && other.offset <= until(note)) };
  };
  const first = placed.map(note => {
    const section = note.provision.match(/^§ \S+/u)?.[0] || note.provision, [, kind, number] = note.provision.match(/ (lg|p) (\S+)$/u) || [];
    const start = kind ? markerEnd(text, note.offset, kind, number) : null;
    const misspelt = !note.repeal && misspeltRepeal(note.note), words = misspelt ? note.note.replace(/^\p{L}+[\s,;‒–—-]*/u, '') : note.note;
    // Only a note that says so is a repeal. A provision without text under a note without the word is shown as the reader
    // gives it: Tallinn 411062026102 § 13¹ lg 1–3 stand empty under the note of the act that added them, and read as
    // repealed they got the day they entered into force as the day they ended.
    const repeal = note.repeal === true || misspelt;
    const as = (provision, from, more = {}) => ({ ...note, note: words, repeal, as_read: `${note.provision}${note.repeal ? ' (kehtetu)' : ''}`, provision, from, to: note.offset, ...more });
    const own = (provision, more) => as(provision, Math.min(start ?? note.offset, note.offset - 1), more), whole = provision => as(provision, 0, { to: length, whole: true });
    // A note that does not tell the whole section: its subsection's opening words', the provision's own, or its
    // subsection's when it closes that one.
    const part = () => {
      if (kind === 'lg' && !ends(note)) return own(`${note.provision} sissejuhatav lauseosa`);
      const subsection = closed(note);
      if (!subsection || stood(note, subsection.notes) || marked(note, subsection.notes.filter(other => other.provision !== subsection.label))) return own(note.provision);
      return as(subsection.added ? subsection.label : `${note.provision} või kogu ${subsection.label}`, subsection.from);
    };
    if (heading(note)) return paired(note) ? as(section, 0, { hidden: true }) : own(`${section} pealkiri`, { adds: ADDED_SECTION.test(section) && !stood(note) && !marked(note) ? section : null });
    if (direct(note)) return whole(section);
    if (repeal) return own(note.provision);
    if (!closes(note)) return note.provision === section ? own(`${section} sissejuhatav lauseosa`) : part();
    if (note.provision === section || paired(note)) return whole(section);
    if (stood(note) || marked(note)) return part();
    return whole(ADDED_SECTION.test(section) ? section : `${note.provision} või kogu ${section}`);
  });
  const told = first.some(note => note.whole), shown = first.map(note => (note.adds && !told ? { ...note, provision: note.adds, from: 0, to: length, whole: true } : note));
  sectionNotes.set(unit, shown);
  return shown;
}

const unitLookups = new WeakMap();
const unitLookup = bundle => {
  if (!unitLookups.has(bundle)) unitLookups.set(bundle, new Map((bundle.source_units || []).map(unit => [unit.id, unit])));
  return unitLookups.get(bundle);
};

/** Notes as the model reads them: those with the same days and words share one entry ({ provisions, in_force |
 *  repealed_from, applies_from?, note? }); the amending act's reference stays in the bundle. A note without its day (a
 *  source error the reader left out) keeps its words and names no day. Past the limits the rest is counted. */
function entries(notes) {
  const groups = new Map();
  for (const note of notes) {
    const repeal = note.repeal === true, said = note.note || null;
    const key = JSON.stringify([note.in_force ?? null, note.applies_from ?? null, repeal, said]);
    if (!groups.has(key)) groups.set(key, { provisions: [], ...(repeal ? { repealed_from: note.in_force ?? null } : note.in_force ? { in_force: note.in_force } : {}),
      ...(note.applies_from ? { applies_from: note.applies_from } : {}), ...(said ? { note: said } : {}) });
    const group = groups.get(key);
    if (!group.provisions.includes(note.provision)) group.provisions.push(note.provision);
  }
  const { groups: most, provisions } = LEGAL_DATES_LIMITS;
  const list = [...groups.values()].map(group => (group.provisions.length > provisions
    ? { ...group, provisions: group.provisions.slice(0, provisions), more_provisions: group.provisions.length - provisions } : group));
  return list.length > most ? [...list.slice(0, most), { more: list.length - most }] : list;
}

/** The amendment notes of the provisions in a chunk. A note is about its provision's text up to the note, so it belongs
 *  to every source range that holds a part of it (a provision split over two chunks is dated in both; the range that
 *  only ends where the provision starts is not one). A whole section's note belongs to every range of its section, a
 *  whole subsection's to every range of that subsection, the note of an added division to the sections under it, the
 *  note of the nearest division to an added section that has none of its own. Null without notes. */
export function chunkAmendments(bundle, chunk) {
  const units = unitLookup(bundle), structure = bundle.document.fields.legal_text?.value?.structure || [], seen = new Set(), found = [];
  const take = (note, fields = note) => { if (!seen.has(note)) { seen.add(note); found.push(fields); } };
  for (const location of chunk.source_locations || []) {
    const unit = units.get(location.source_unit_id), above = structure.filter(note => !note.repeal && location.path?.startsWith(`${note.path}/`));
    // The divisions above are told by their paths, each the start of the section's: the longest is the nearest.
    const nearest = ADDED_SECTION_TEXT.test(unit?.raw_text || '') && !unit.amendments?.length ? Math.max(0, ...above.map(note => note.path.length)) : 0;
    for (const note of above) if (ADDED_DIVISION.test(note.target) || note.path.length === nearest) take(note, { ...note, provision: note.target });
    const notes = unitNotes(unit).filter(note => !note.hidden && location.start < note.to && location.end > note.from);
    for (const note of [...notes.filter(item => item.whole), ...notes.filter(item => !item.whole)]) take(note);
  }
  return found.length ? entries(found) : null;
}

// The act itself as the subject, right before the verb: "Määrus jõustub ...", "Käesolevat määrust rakendatakse ...",
// "... ja käesolev seadus jõustuvad ...". A provision, part or amount as the subject ("Määruse § 5 jõustub ...",
// "Piirmäärasid rakendatakse ...", "Käesoleva seaduse § 13¹ lõikeid 3–5 rakendatakse ...") is a scoped or transitional
// rule: it is shown apart (scoped_rules), not as the act's own (in the social welfare act the act's own sentence is the third).
const WHOLE_ACT = /(?:^|[\s,;])(?:määrus|määrust|seadus|seadust|kord|korda|eeskiri|eeskirja)\s+(?:jõustu(?:b|vad)|rakendatakse|kohaldatakse)(?![\p{L}\p{N}])/iu;
// A day in the act's sentence. One that only dates another act ("... Vallavolikogu 26.04.2019. a määruse nr 7 ... sätteid")
// is not this act's day; a sentence with such a day and the act's own ("... 15. detsembri 2022 määruse ... jõustumisel,
// kuid kõige varem 1. jaanuaril 2023") keeps its own.
const DAY = String.raw`(?:\d{1,2}\.\s?\d{1,2}\.\s?\d{4}|\d{1,2}\.\s*\p{L}+\s+\d{4}|\d{4}\.\s*a(?:asta|\.)?\s+\d{1,2}\.\s*\p{L}+)`;
const OTHER_ACT_DAY = new RegExp(String.raw`${DAY}(?:\.?\s*a\.?)?\s+(?:määrus|seadus|otsus|korraldus|käskkir)\p{L}*`, 'giu'), ANY_DAY = new RegExp(DAY, 'iu');
const ownDay = text => ANY_DAY.test(text.replace(OTHER_ACT_DAY, ' '));
// The day a "jõustub" sentence states right after the verb ("Määrus jõustub 1. juulil 2018."), to tell when it is not the
// record's day. A sentence that states it otherwise ("kolmandal päeval pärast ...") states none here.
const MONTHS = ['jaanuar', 'veebruar', 'märts', 'aprill', 'mai', 'juun', 'juul', 'august', 'septemb', 'oktoob', 'novemb', 'detsemb'];
const monthOf = word => MONTHS.findIndex(stem => word.toLowerCase().startsWith(stem)) + 1;
const iso = (year, month, day) => (month >= 1 && month <= 12 && day >= 1 && day <= 31 ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null);
const STATED = [
  [/^(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})/u, found => iso(found[3], Number(found[2]), Number(found[1]))],
  [/^(\d{1,2})\.\s*(\p{L}+)\s+(\d{4})/u, found => iso(found[3], monthOf(found[2]), Number(found[1]))],
  [/^(\d{4})\.\s*a(?:asta|\.)?\s+(\d{1,2})\.\s*(\p{L}+)/u, found => iso(found[1], monthOf(found[3]), Number(found[2]))],
];
function statedDay(text) {
  const after = text.match(/jõustu(?:b|vad)\s+(.+)$/isu)?.[1];
  if (!after) return null;
  for (const [pattern, read] of STATED) { const found = after.match(pattern); if (found) return read(found); }
  return null;
}

/** The act's own dates for its source card: the day the act first entered into force, what the amendment that starts
 *  this consolidated version (valid_from) changed, and the act's own sentences on its entry into force or application.
 *  - Sentences about the whole act are shown as entry_into_force, three at most. Those about a provision, an amount or
 *    a transition are shown apart as scoped_rules when the act has at most three (a rate act's "Piirmäärasid
 *    rakendatakse tagasiulatuvalt alates ..." dates all its content); a law's longer run of transitional rules is not
 *    shown in part. What is not shown is counted (entry_into_force_more). A sentence whose only day is another act's
 *    is none of these.
 *  - Where the act's own "jõustub <day>" sentence names another day than the record (17 registered acts), one of the
 *    two is shown, never both. A stated day before the record's is not the day the act took effect (it was published
 *    later; 13 acts), nor is a later one when the history has an amendment in force before it (Kiili, three versions):
 *    the record's day is shown and the sentence only counted. A later stated day that nothing contradicts is shown
 *    without the record's (one act).
 *  - The record's day is left out where it is before the publication its adoption names (seven registered acts); the
 *    act's sentences are then shown as they are. No day is corrected.
 *  - What the first day of the version changed is named as the excerpts name it (`units`: the act's source units), so
 *    a section's or subsection's closing note reads as there. A version change without provisions means none is recorded for the day,
 *    not that nothing changed: it shows nothing.
 *  - Outside the sections (the preamble, an annex, a division) no excerpt carries the note of that day, so where it
 *    names a day it is applied from or has words, the card gives it as an excerpt would (changed_on_valid_from_notes:
 *    Saku 429012026051 changed its rates annex on 01.02.2026, "rakendatakse alates 01.01.2026").
 *  Null when the act gives none of these. */
export function actDates(legal, units = []) {
  if (legal?.schema_version !== 'rag-v2/legal-text-1') return null;
  const sentences = (legal.entry_into_force || []).filter(item => ownDay(item.text)), from = legal.act_in_force_from;
  const early = Boolean(from) && Boolean(legal.original_published) && from < legal.original_published;
  const stated = item => (from && !early && WHOLE_ACT.test(item.text) ? statedDay(item.text) : null);
  const refuted = item => { const day = stated(item); return day !== null && (day < from || day > from && (legal.history || []).some(entry => Boolean(entry.in_force) && entry.in_force < day)); };
  const kept = sentences.filter(item => !refuted(item)), own = kept.filter(item => WHOLE_ACT.test(item.text));
  const later = own.some(item => { const day = stated(item); return day !== null && day > from; });
  const shown = own.slice(0, LEGAL_DATES_LIMITS.entry), parts = kept.filter(item => !WHOLE_ACT.test(item.text)), scoped = parts.length > LEGAL_DATES_LIMITS.scoped ? [] : parts;
  const relabel = new Map(), day = legal.version_change?.in_force;
  for (const unit of units || []) for (const note of unitNotes(unit)) if (day && note.in_force === day) relabel.set(note.as_read, [...(relabel.get(note.as_read) || []), `${note.provision}${note.repeal ? ' (kehtetu)' : ''}`]);
  const changed = [...new Set((legal.version_change?.provisions || []).flatMap(label => relabel.get(label) || [label]))];
  const outside = day ? (legal.structure || []).filter(note => note.in_force === day && (note.applies_from || note.note)).map(note => ({ ...note, provision: note.target })) : [];
  const text = item => ({ provision: item.provision, text: item.text });
  const card = { ...(from && !early && !later ? { act_in_force_from: from } : {}),
    ...(changed.length > LEGAL_DATES_LIMITS.changed ? { changed_on_valid_from_count: changed.length } : changed.length ? { changed_on_valid_from: changed } : {}),
    ...(outside.length ? { changed_on_valid_from_notes: entries(outside) } : {}),
    ...(shown.length ? { entry_into_force: shown.map(text) } : {}), ...(scoped.length ? { scoped_rules: scoped.map(text) } : {}),
    ...(sentences.length > shown.length + scoped.length ? { entry_into_force_more: sentences.length - shown.length - scoped.length } : {}) };
  return Object.keys(card).length ? card : null;
}

const actLookups = new WeakMap();
/** What an evidence entry carries for the model's projection: { act?, amendments? }, or null without either. */
export function legalDates(bundle, chunk) {
  if (!actLookups.has(bundle)) actLookups.set(bundle, actDates(bundle.document.fields.legal_text?.value, bundle.source_units));
  const act = actLookups.get(bundle), amendments = chunkAmendments(bundle, chunk);
  return act || amendments ? { ...(act ? { act } : {}), ...(amendments ? { amendments } : {}) } : null;
}
