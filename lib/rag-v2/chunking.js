import { hash, id, stable } from './contracts.js';
import { chunkSourceLocations } from './source-locations.js';

// Reference lists stay in the bundle as cited source text but are not retrieval units: their
// author names and titles would match queries without answering them. A list needs its whole
// (innermost) heading to be a reference-list name and entries (see referenceExtents). Bibliographic
// lines have a year in parentheses or before a capital ("2016. aastal" is running text), a URL or a
// DOI, a numbered entry ("[12] ", not a web footnote "[2] (#_ftnref2)"), "et al.", a volume,
// Vancouver marks ("[Internet]", "[cited …]", "2020;6(1):17", "Tallinn: Kirjastus; 2021") or a
// dated newspaper article ("Tartu teated. 7.11.1936.").
const REFERENCE_LIST_TITLE = /^(?:(?:viidatud|kasutatud)\s+(?:allikad|kirjandus|materjalid)|allikad|kirjandus|viited|references|bibliography|literature|список литературы|литература|источники)$/iu;
const BIBLIOGRAPHIC = /\((?:19|20)\d{2}[a-z]?\)|\b(?:19|20)\d{2}[a-z]?[.,]\s+[„“"]?\p{Lu}|https?:\/\/|\bwww\.|\b(?:doi|DOI)\b|^\s*\[\d{1,3}\]\s(?!\(#)|\bet al\.|\b[Vv]ol\.\s?\d|\[(?:Internet|cited\s)|;\s?\d+\(\d+\):\s?\d|:\s[^:;]{2,80};\s?(?:19|20)\d{2}\b|^[^.]{1,120}\.\s\d{1,2}\.\s?\d{1,2}\.\s?(?:18|19|20)\d{2}\.?\s*$/u;
export const referenceListTitle = title => REFERENCE_LIST_TITLE.test((title || '').split(' > ').at(-1).replace(/\s+/gu, ' ').replace(/[\s:.]+$/u, '').trim());
// Lines that belong to a reference list even without a year or link: volume and pages, series
// marks, Riigi Teataja, editors, file and access notes, "Surname, I." starts (also numbered,
// "117. Butcher, H. K."), Vancouver authors ("Abel-Ollo K, Riikoja A,"), a year with pages
// ("(2018: 187)"), a journal's volume and pages at the end ("Social Work Journal, 31, 189–203."),
// publisher lines, URL fragments broken across lines, and web addresses and access dates whose dots
// the PDF lost ("www just ee/…", "(26 08 2019)").
const BIB_LIKE = new RegExp([BIBLIOGRAPHIC.source, String.raw`\b\d+\s?\(\d+\)[,:]\s?\d+`, String.raw`\b(?:Vol|No|pp|lk|nr)\.?\s?\d`,
  String.raw`\bRT\s?I{1,3}\b`, String.raw`\((?:toim|koost|ed|eds)\.?\)`, String.raw`\.pdf\b|\[www\]|K\u00E4ttesaadav|Available at`,
  String.raw`\(\d{1,2}\.\s?\d{1,2}\.\s?\d{4}\)`,
  String.raw`^(?:\d{1,3}\.\s+)?\p{Lu}[\p{L}'\u2019-]+,\s(?:\p{Lu}\.\s?){1,3}`, String.raw`\((?:19|20)\d{2}\s?:\s?\d`,
  String.raw`^(?:\d{1,3}\.\s+)?\p{Lu}[\p{L}'\u2019-]+,?\s\p{Lu}{1,3},\s\p{Lu}[\p{L}'\u2019-]+,?\s\p{Lu}{1,3}[,.]`,
  String.raw`\bwww\s\p{L}[\p{L}-]*\s(?:ee|com|org|net|eu|gov|int)\b|\(\d{1,2}\s\d{1,2}\s(?:\d{2}|\d{4})\)`, String.raw`,\s\d{1,4},\s\d{1,5}[\u2013\u2212-]\d{1,5}\.?\s*$`,
  String.raw`:\s[\p{Lu}][\p{L}\s-]*(?:Kirjastus|Press|Publishing|Publishers|Verlag|\u00DClikool|University)\b`,
  String.raw`\S+\/\S+\/\S+|%[0-9A-Fa-f]{2}|\.\s?pdf\b|\w_\w+_\w`].join('|'), 'u');
export const referenceEntryLike = text => BIB_LIKE.test(text);
// The first line of an entry: "Surname, I.", an author or title with its year in parentheses
// ("Kiusamisvaba haridustee kontseptsioon (2017)", "KiVa International (i.a)"), a numbered entry
// ("[12] Author", "12. Surname AB,") or an act in Riigi Teataja.
const ENTRY_START = new RegExp([String.raw`^\p{Lu}[\p{L}'’-]+,\s(?:\p{Lu}\.\s?){1,3}`, String.raw`^[^()]{1,160}\((?:(?:19|20)\d{2}[a-z]?|i\.\s?a\.?)\)\s?[.,:]`,
  String.raw`^\[\d{1,3}\]\s(?!\(#)`, String.raw`^\d{1,3}\.\s+\S+(?:\s\S+)?\s\p{Lu}{1,3}(?:-\p{Lu}{1,2})?[,.]`, String.raw`^\p{Lu}.{0,120}\bRT\s?I{1,3}\b`].join('|'), 'u');
// A web footnote ("[2] (#_ftnref2) Sellist teenust osutati aastatel 2022 ja 2023. …") explains
// the text: all its lines, up to the next note or entry, are prose unless the note starts like an entry.
const FOOTNOTE = /\(#_ftnref\d+\)/u;
// An entry's own access line ("Kättesaadav: www.volinik.ee", a bare link): the list goes on.
const ACCESS_LINE = /^(?:Kättesaadav|Available|Retrieved|URL)\b|^(?:https?:\/\/|www\.)\S+$/iu;
// A contact line (a helpline "Politsei 112", "116006 (24/7)", "660 7320", "tel", "+372") is never
// bibliography: after the last entry it starts a contact block, which ends the list. The word
// stands on its own: "tulekustu�tele" (a lost "ti" ligature) is no "tel".
const CONTACT = /(?<![\p{L}\uFFFD])(?:tel\b|telefon|nõuandeliin|kriisiabitelefon|infotelefon|abitelefon|infoliin)|\+372|\(24\/7\)|\b\d{3,4}\s\d{3,4}\b|^\S+(?:\s\S+){0,3}\s1\d{2}$/iu;
/** Reference lists and where each ends inside its section. It ends where prose starts after its
 *  first entry: three or more lines in a row, with 150 characters, that are not list-like and hold
 *  no entry start, after which under 40% of the lines of the section are, and where no new entry,
 *  numbered item or access line starts within six lines after that prose; a run of eight lines or
 *  600 characters is prose whatever follows (a comment or an information box whose last line gives
 *  a web address). So a citation in the next chapter ("nr 5", "2016. Uuring") does not carry the
 *  list on, and an entry's unmarked continuation lines followed by the next entry do not end it. It
 *  also ends at an explanatory note after its last entry (a web footnote or a printed "7 …"
 *  footnote), at a contact block, before one or two closing lines of prose (which may end with
 *  their own web address), and at its first display line (1.3 times the body size) that is not
 *  followed by more entries: the title of what comes next, such as the next article in a
 *  collection where no heading started a section. Only the list's own lines count for its shares.
 *  A section that splitReferenceLists marked as a list stays one. `lines` are the section's lines
 *  below its heading; `end` indexes them. */
export function referenceExtents({ sections, spans, blocks }) {
  const headingBlocks = new Set(blocks.filter(block => block.kind === 'heading').map(block => block.id));
  const heights = spans.map(span => span.height).filter(height => height > 0).sort((a, b) => a - b), body = heights[Math.floor(heights.length / 2)] || 0;
  const listLike = span => BIB_LIKE.test(span.retrieval_text), entryStart = span => ENTRY_START.test(span.retrieval_text);
  // Prose wraps: at least half of its printed lines end inside a sentence, while list items end with
  // a full stop. A text source line is a whole paragraph and counts as prose.
  const wrapped = span => !Number.isInteger(span.pdf_page) || !/[.!?)]["'”»’]?\s*$/u.test(span.retrieval_text);
  // The number of a numbered entry: "12. ", "12.Jose" or "[12] " (not a web footnote "[2] (#_ftnref2)").
  const number = span => { const match = span.retrieval_text.match(/^(?:\[(\d{1,3})\]\s(?!\(#)|(\d{1,3})\.(?:\s+(?=\S)|(?=\p{Lu})))/u); return match ? Number(match[1] || match[2]) : 0; };
  return sections.filter(section => referenceListTitle(section.title)).map(section => {
    const lines = spans.filter(span => span.parent_section_id === section.id && !headingBlocks.has(span.block_id));
    const note = new Array(lines.length).fill(false);
    // A printed footnote ("7 Võimalikke tulevikustrateegiaid on kirjeldatud …", "2 „It's the economy,
    // stupid” on fraas …") is an explanatory note as well: after a line that ends ("COVID-" / "19
    // Cardiovascular …" goes on an entry), its number, a capitalised word, no link on its first line, no
    // entry after the number ("1 AS Turu-uuringud (2018). …" is a cited source), six words or more with
    // the lines that continue its sentence, which may end with a web address but hold no other marks.
    for (let k = 0; k < lines.length; k++) {
      const text = lines[k].retrieval_text;
      if (!/^\d{1,2}\s+[„“"«]?\p{Lu}\p{Ll}/u.test(text) || /https?:\/\/|\bwww[.\s]/u.test(text) || ENTRY_START.test(text.replace(/^\d{1,2}\s+/u, ''))
        || k > 0 && wrapped(lines[k - 1])) continue;
      let j = k + 1;
      while (j < lines.length && !endsSentence(lines[j - 1]) && !/^\d{1,2}\s+\S/u.test(lines[j].retrieval_text) && !entryStart(lines[j])
        && (!listLike(lines[j]) || /https?:\/\/|\bwww\b/u.test(lines[j].retrieval_text))) j++;
      if (lines.slice(k, j).map(span => span.retrieval_text).join(' ').split(/\s+/u).length >= 6) note.fill(true, k, j);
    }
    for (let k = 0; k < lines.length; k++) if (FOOTNOTE.test(lines[k].retrieval_text)) {
      let j = k + 1;
      while (j < lines.length && !FOOTNOTE.test(lines[j].retrieval_text) && !entryStart(lines[j])) j++;
      if (!ENTRY_START.test(lines[k].retrieval_text.replace(/^.*?\(#_ftnref\d+\)\s*/u, ''))) note.fill(true, k, j);
      k = j - 1;
    }
    const like = lines.map((span, k) => !note[k] && listLike(span)), after = new Array(lines.length + 1).fill(0);
    for (let k = lines.length - 1; k >= 0; k--) after[k] = after[k + 1] + (like[k] ? 1 : 0);
    // Prose before the first entry, three or more lines with 150 characters of which at most a fifth
    // look like references (the other column of a page, read after a heading set at the foot of the
    // first; a year in parentheses in a sentence is no entry), or explanatory notes, is not part of the list.
    const firstLike = like.indexOf(true), firstEntry = lines.findIndex((span, k) => !note[k] && entryStart(span));
    const head = firstEntry >= 0 ? firstEntry : firstLike, lead = lines.slice(0, Math.max(head, 0));
    const prose = lead.length >= 3 && lead.reduce((sum, span) => sum + span.retrieval_text.length, 0) >= 150 && like.slice(0, head).filter(Boolean).length <= head * 0.2
      && lead.filter(wrapped).length >= lead.length * 0.5;
    const start = head > 0 && (prose || note.slice(0, head).every(Boolean)) ? head : 0, first = start || firstLike;
    let end = lines.length;
    // Notes after the last entry end the list; a note between entries stays inside it. So does a
    // contact block after the last entry, with the unmarked title line just above it.
    const noteAfter = note.findIndex((flag, k) => flag && k > first && !like.slice(k).some(Boolean));
    if (first >= 0 && noteAfter > first) end = noteAfter;
    const contact = lines.findIndex((span, k) => k > first && CONTACT.test(span.retrieval_text) && !lines.slice(k).some(entryStart));
    if (first >= 0 && contact > first) end = Math.min(end, contact - 1 > first && !like[contact - 1] ? contact - 1 : contact);
    for (let k = first + 1; first >= 0 && k < end; k++) {
      if (like[k] || !like[k - 1]) continue;
      // Notes inside the run do not count towards it; they have their own rule.
      let j = k, characters = 0, count = 0;
      while (j < lines.length && !like[j]) { if (!note[j]) { characters += lines[j].retrieval_text.length; count++; } j++; }
      // A numbered line ("113. Perearstiabi. Eesti Haigekassa.") continues a numbered list, and an
      // access line the entries before it. An entry start inside the run (an entry without reference
      // marks) or the list's next number within the run or six lines after it makes the run part of
      // the list, however long.
      const long = count >= 8 || characters >= 600, entryInside = lines.slice(k, j).some(entryStart);
      const previous = lines.slice(start, k).map(number).filter(Boolean).at(-1) || 0;
      const nextNumber = previous > 0 && lines.slice(k, j + 6).some(span => number(span) === previous + 1);
      const entryNext = lines.slice(j, j + 6).some(span => entryStart(span) || ACCESS_LINE.test(span.retrieval_text) || /^\d{1,3}\.\s+\p{Lu}/u.test(span.retrieval_text));
      if (count >= 3 && characters >= 150 && after[k] < (lines.length - k) * 0.4 && !entryInside && !nextNumber && (long || !entryNext)) { end = k; break; }
    }
    // One or two lines of prose closing the section after a finished entry (an author's note, a
    // thank-you, where to find the material): a capital first, six words and 60 characters, no
    // reference marks, and it may end with its own web address, the end of its sentence ("… leiate
    // kodulehelt" / "www.balticamericanfreedomfoundation.org.", "… leiate Eesti Perelepitajate" /
    // "Ühingu kodulehel www.lepitus.ee."): a last line that only a web address makes list-like. A
    // publisher line ("Oxford University Press.") is too short for that.
    const n = lines.length, linkOnly = span => !entryStart(span) && !BIB_LIKE.test(span.retrieval_text.replace(/(?:https?:\/\/|www\.)\S+/giu, ''));
    const ownLink = n >= 2 && like[n - 1] && linkOnly(lines[n - 1]) && !like[n - 2] && wrapped(lines[n - 2]);
    const last = like.lastIndexOf(true, ownLink ? n - 2 : n - 1), closing = lines.slice(last + 1, ownLink ? n - 1 : n);
    if (end === n && last >= 0 && last >= first && closing.length >= 1 && closing.length <= 2 && /^\p{Lu}/u.test(closing[0].retrieval_text)
      && /[.)]\s*$/u.test(lines[last].retrieval_text)
      && closing.reduce((sum, span) => sum + span.retrieval_text.length, 0) >= 60 && closing.map(span => span.retrieval_text).join(' ').split(/\s+/u).length >= 6) end = last + 1;
    const display = lines.findIndex((span, index) => span.height >= body * 1.3 && lines.slice(index + 1, index + 7).filter(listLike).length <= 1);
    if (display >= 0 && display < end) end = display;
    // A running head or page mark (small or short) right before the next display title stays with
    // the list, so that the title starts the text after it.
    const title = lines.findIndex((span, index) => index > end && index <= end + 2 && span.height >= body * 1.3);
    if (title > end && lines.slice(end, title).every(span => span.height < body * 1.3 && (span.height < body || span.retrieval_text.length <= 40))) end = title;
    const bibliographic = lines.slice(start, end).filter((span, k) => !note[start + k] && BIBLIOGRAPHIC.test(span.retrieval_text)).length;
    // Shares are judged up to the last list-like line: a publication note or keywords after the
    // last entry do not thin the list. A list qualifies by 30% bibliographic lines, by 60% list-like
    // lines (acts and court decisions carry no year in parentheses), or by entries numbered from 1
    // ("1. Tuleohutuse seadus.", "[1] ") with two list-like lines. A single entry makes a list when
    // it is short and prose follows it or it starts like an entry.
    const likeCount = like.slice(start, end).filter(Boolean).length, lastLike = like.lastIndexOf(true, end - 1);
    const judged = lastLike >= start ? lastLike + 1 - start : end - start;
    const numbers = lines.slice(start, end).filter((span, k) => !note[start + k]).map(number).filter(Boolean);
    const numberedFromOne = numbers[0] === 1 && numbers.includes(2);
    // Explanatory notes set between entries (a page's footnotes printed under the list) stay text.
    const notes = lines.slice(start, end).filter((span, k) => note[start + k]).map(span => span.id);
    return { id: section.id, lines, start, end, notes, list: section.role === 'reference_list' || bibliographic >= 2 && bibliographic >= judged * 0.3
      || likeCount >= 2 && likeCount >= judged * 0.6 || numberedFromOne && likeCount >= 2
      || bibliographic >= 1 && end - start <= 3 && (end < lines.length || lines.slice(start, end).some(entryStart)) };
  }).filter(extent => extent.list);
}
export const referenceSections = structure => new Set(referenceExtents(structure).map(extent => extent.id));

/** Text before and after a reference list is not part of it and leaves the list's section before
 *  chunking, so the list's name never heads it. Prose before the first entry goes back to the
 *  section the list's heading interrupted. The text after the list becomes its own section:
 *  `titleRun(rest)` returns the lines that begin `rest` as a proven title (the next article or
 *  chapter), which become its heading; without one the section keeps the list section's parent path
 *  and drops the list's name. Changes the structure in place and returns what it split. */
export function splitReferenceLists({ sections, spans, blocks, titleRun = () => [] }) {
  const pairs = hyphenatedPairs(spans), splits = [];
  const parentPath = section => (section.title || '').split(' > ').slice(0, -1).join(' > ') || null;
  for (const { id: listId, lines, start, end } of referenceExtents({ sections, spans, blocks })) {
    // The list keeps its role after the text around it leaves: a single short entry, once alone,
    // would no longer show that it was followed by prose.
    const list = sections.find(section => section.id === listId);
    if (start === 0 && end >= lines.length) { list.role = 'reference_list'; continue; }
    const cuts = new Set(), split = { list_section_id: listId, titled: false };
    let titled = new Set();
    if (start > 0) {
      // The section of the line before the list's heading, unless that is a list too.
      const lead = lines.slice(0, start), leadIds = new Set(lead.map(span => span.id));
      const heading = spans.findIndex(span => span.id === list.span_ids[0]), previous = sections.find(section => section.id === spans[heading - 1]?.parent_section_id);
      let target = previous && !referenceListTitle(previous.title) ? previous : null;
      if (!target) {
        target = { ...list, id: id('section', lead[0].id), title: parentPath(list), span_ids: [] };
        sections.splice(sections.indexOf(list), 0, target);
      }
      if (!target.span_ids.length || list.span_ids.some(key => leadIds.has(key))) target.span_ids.push(...lead.map(span => span.id));
      list.span_ids = list.span_ids.filter(key => !leadIds.has(key));
      for (const span of lead) span.parent_section_id = target.id;
      cuts.add(lines[start].id);
      split.lead_section_id = target.id;
    }
    if (end < lines.length) {
      const rest = lines.slice(end), moved = new Set(rest.map(span => span.id)), title = titleRun(rest);
      titled = new Set(title.map(span => span.id));
      // A titled section is evidenced by its heading lines, an untitled one by its text.
      const section = { ...list, id: id('section', rest[0].id), parent_id: list.parent_id,
        title: title.length ? title.reduce((text, span) => joinLine(text, span.retrieval_text, pairs), '') : parentPath(list),
        span_ids: title.length ? [...titled] : [...moved] };
      list.span_ids = list.span_ids.filter(key => !moved.has(key));
      sections.splice(sections.indexOf(list) + 1, 0, section);
      for (const span of rest) span.parent_section_id = section.id;
      cuts.add(rest[0].id);
      Object.assign(split, { section_id: section.id, titled: title.length > 0 });
    }
    // Blocks break where the list starts and ends and around the title, whose lines become a heading block.
    for (let index = 0; index < blocks.length; index++) {
      const block = blocks[index], parts = [];
      for (const key of block.span_ids) {
        const kind = titled.has(key) ? 'heading' : block.kind, last = parts.at(-1);
        if (!last || last.kind !== kind || cuts.has(key)) parts.push({ kind, span_ids: [key] }); else last.span_ids.push(key);
      }
      if (parts.length === 1 && parts[0].kind === block.kind) continue;
      const replacements = parts.map((part, i) => i === 0 ? Object.assign(block, part) : { ...block, ...part, id: id('block', part.span_ids[0]) });
      blocks.splice(index, 1, ...replacements);
      for (const replacement of replacements) for (const key of replacement.span_ids) spans.find(span => span.id === key).block_id = replacement.id;
      index += replacements.length - 1;
    }
    list.role = 'reference_list';
    splits.push(split);
  }
  return splits;
}

/** Spans of reference lists that stay out of chunks: every line of a reference-list section but
 *  its explanatory notes. Text before and after a list left its section before (splitReferenceLists). */
export function referenceSpans({ sections, spans, blocks }) {
  const extents = referenceExtents({ sections, spans, blocks }), lists = new Set(extents.map(extent => extent.id)), notes = new Set(extents.flatMap(extent => extent.notes));
  return new Set(spans.filter(span => lists.has(span.parent_section_id) && !notes.has(span.id)).map(span => span.id));
}
const HYPHEN = /[-\u00AD\u2010]$/u;
const CONJUNCTION = /^(?:ja|ning|või|ega|ehk|and|or|nor)\b/u;
// A line ending a sentence; common Estonian and English abbreviations and initials do not.
const SENTENCE_END = /[.!?…][)"'”»’]*$/u;
const ABBREVIATION = /(?:^|[\s(])(?:nt|vt|sh|nn|st|lk|nr|ca|dr|prof|mr|ms|mrs|vrd|lüh|ingl|pr|jt|e\.g|i\.e|\p{Lu})\.$/iu;
export const endsSentence = span => SENTENCE_END.test(span.retrieval_text) && !ABBREVIATION.test(span.retrieval_text);

/** Hyphenated words written inside a line ("järk-järgult", "step-by-step") as adjacent pairs; a
 *  line that breaks at such a hyphen keeps it when the lines are joined. */
export function hyphenatedPairs(spans) {
  const pairs = new Set();
  for (const span of spans) for (const [word] of span.retrieval_text.toLowerCase().matchAll(/\p{L}+(?:-\p{L}+)+/gu)) {
    const parts = word.split('-');
    for (let i = 1; i < parts.length; i++) pairs.add(`${parts[i - 1]}-${parts[i]}`);
  }
  return pairs;
}

/** Joins the next line of a PDF paragraph onto running text. A word hyphenated across the lines
 *  is rejoined ("sot-" + "siaalse"); a soft hyphen always goes. The hyphen stays for a suspended
 *  compound ("sotsiaal- ja", with a space), before a capital or digit ("COVID-19"), after a
 *  single letter ("e-teenus"), and in a hyphenated word the document writes elsewhere. */
export function joinLine(text, next, pairs) {
  if (!text) return next;
  if (text.endsWith('\u00AD')) return text.slice(0, -1) + next;
  if (!HYPHEN.test(text) || /\s[-\u2010]$/u.test(text) || CONJUNCTION.test(next)) return `${text} ${next}`;
  const left = text.match(/(\p{L}+)[-\u2010]$/u)?.[1] ?? '', right = next.match(/^\p{L}+/u)?.[0] ?? '';
  // A reduplicated compound repeats its first syllable ("järk-järgult", "samm-sammult").
  const reduplicated = left.length >= 3 && right.toLowerCase().startsWith(left.slice(0, 3).toLowerCase());
  const lexical = /^\p{L}+-/u.test(next) || pairs.has(`${left}-${right}`.toLowerCase()) || reduplicated;
  return !lexical && /\p{Ll}{2}$/u.test(left) && /^\p{Ll}/u.test(next) ? text.slice(0, -1) + next : text + next;
}

// A paragraph that runs on into the next column or page: no sentence end, a lower-case start
// and the same text size (a smaller caption in between does not continue the sentence).
const continues = (previous, span) => Number.isInteger(span.pdf_page) && !endsSentence(previous)
  && /^\p{Ll}/u.test(span.retrieval_text) && Math.abs(previous.height - span.height) <= span.height * 0.15;

/** Retrieval body: blocks apart by a blank line, generic source units line by line, and the
 *  lines of a PDF paragraph as running text. */
function retrievalBody(group, pairs) {
  let body = '';
  group.forEach((span, i) => {
    const previous = group[i - 1];
    if (!previous) body = span.retrieval_text;
    else if (previous.block_id !== span.block_id && !continues(previous, span)) body += `\n\n${span.retrieval_text}`;
    else if (!Number.isInteger(span.pdf_page)) body += `\n${span.retrieval_text}`;
    else body = joinLine(body, span.retrieval_text, pairs);
  });
  return body;
}

/** Cut quality after span k: a paragraph break after a finished sentence (or before a capital)
 *  is best, then a sentence end inside a paragraph, then a paragraph that runs on into the next
 *  column or page, then any line. */
function cutQuality(spans, k) {
  const span = spans[k], next = spans[k + 1];
  if (span.block_id !== next.block_id) return continues(span, next) ? 1 : 3;
  return endsSentence(span) ? 2 : 0;
}

/** Each section (and record) splits into pieces of even size, cut at the best boundary near the
 *  target, so a section never ends in a small remainder and cuts fall between sentences. */
export function makeChunks({ spans, blocks, sections, source_units, metadata, versionId, scope, config }) {
  const spanMap = new Map(spans.map(span => [span.id, span])), sectionMap = new Map(sections.map(section => [section.id, section]));
  const headingBlocks = new Set(blocks.filter(block => block.kind === 'heading').map(block => block.id));
  const references = referenceSpans({ sections, spans, blocks });
  const pairs = hyphenatedPairs(spans);
  const chunks = [];
  function emit(group, recordKey) {
    const section = sectionMap.get(group[0].parent_section_id);
    const sectionPath = [metadata.title, section.title].filter(Boolean);
    const sourceText = group.map(span => span.source_text).join('\n');
    // The prefix already names the section, so its heading lines are left out of the body, and an
    // article heading equal to the document title is named once.
    const same = (a, b) => a.replace(/\s+/gu, ' ').trim().toLowerCase() === b.replace(/\s+/gu, ' ').trim().toLowerCase();
    const parts = section.title ? section.title.split(' > ') : [];
    if (parts.length && metadata.title && same(parts[0], metadata.title)) parts.shift();
    // A region or issuer names the document's jurisdiction first ("Alutaguse vald > Asendushooldusteenus").
    const prefixPath = [metadata.retrieval_context, metadata.title, parts.join(' > ')].filter(Boolean);
    const title = (section.title || '').replace(/\s+/gu, ' ').toLowerCase();
    const heading = span => headingBlocks.has(span.block_id) && title.includes(span.retrieval_text.toLowerCase());
    // Anchor spans (link targets, check dates, URLs) stay in the chunk's source text and locations.
    const content = group.filter(span => !span.anchor_only);
    const body = content.some(span => !heading(span)) ? content.filter(span => !heading(span)) : content.length ? content : group;
    const prefix = `${prefixPath.join(' > ')}\n\n`, retrievalText = prefix + retrievalBody(body, pairs);
    const chunk = { ...scope, id: id('chunk', versionId, chunks.length), ordinal: chunks.length,
      record_key: recordKey, parent_section_id: section.id, section_path: sectionPath, span_ids: group.map(span => span.id),
      pdf_pages: [...new Set(group.map(span => span.pdf_page).filter(Number.isInteger))], source_text: sourceText, retrieval_text: retrievalText,
      retrieval_mapping: { prefix_length: prefix.length, body_span_ids: body.map(span => span.id), operation: 'join_dehyphenated_lines_with_block_breaks' },
      embedding_input_hash: hash(stable([config.embeddingInputVersion, retrievalText])), index_version: config.embeddingInputVersion };
    chunk.source_locations = chunkSourceLocations({ spans, source_units }, chunk, spanMap);
    chunks.push(chunk);
  }
  function split(segment, recordKey) {
    let start = 0;
    while (start < segment.length) {
      let remaining = -1;
      for (let k = start; k < segment.length; k++) remaining += segment[k].source_text.length + 1;
      if (remaining <= config.chunkMaxChars) { emit(segment.slice(start), recordKey); return; }
      const target = remaining / Math.ceil(remaining / config.chunkMaxChars);
      let best = start, bestScore = -Infinity;
      for (let k = start, size = -1; k < segment.length - 1; k++) {
        size += segment[k].source_text.length + 1;
        if (size > config.chunkMaxChars) break;
        const score = size < target * 0.6 ? -Infinity : cutQuality(segment, k) * config.chunkMaxChars - Math.abs(size - target);
        if (score > bestScore || bestScore === -Infinity && k > best) { best = k; bestScore = score; }
      }
      emit(segment.slice(start, best + 1), recordKey);
      start = best + 1;
    }
  }
  let segment = [], recordKey = null;
  for (const block of blocks) {
    const members = block.span_ids.map(key => spanMap.get(key));
    if (!members.length) continue;
    for (const span of members) {
      if (references.has(span.id)) continue;
      if (segment.length && (segment[0].parent_section_id !== span.parent_section_id || recordKey !== (block.record_key ?? null))) {
        split(segment, recordKey); segment = [];
      }
      recordKey = block.record_key ?? null;
      segment.push(span);
    }
  }
  if (segment.length) split(segment, recordKey);
  chunks.forEach((chunk, index) => {
    chunk.previous_id = chunks[index - 1]?.record_key === chunk.record_key ? chunks[index - 1].id : null;
    chunk.next_id = chunks[index + 1]?.record_key === chunk.record_key ? chunks[index + 1].id : null;
  });
  return chunks;
}
