import { parseDocument } from 'htmlparser2';
import { fail, id } from './contracts.js';
import { sourceUnit, textRanges } from './source-locations.js';
import { structuredRecord } from './structured-record.js';
import { splitReferenceLists } from './chunking.js';

const localName = node => node.name?.split(':').at(-1) || '';
const children = node => node.children || [];
const elements = node => children(node).filter(child => ['tag', 'script', 'style'].includes(child.type));
const flat = node => [node, ...children(node).flatMap(flat)];
const clean = value => value.replaceAll('\u0000', '\uFFFD').replace(/[\t \r\n]+/gu, ' ').trim();
// A length cap never ends inside a character: a cut between the halves of a surrogate pair drops the first half too.
const cut = (value, max) => value.slice(0, max).replace(/[\uD800-\uDBFF]$/u, '');
// What the patterns for a note's words and an act's dated provision read at most, and so the most of its words a note
// keeps. Two of them take quadratic time on one long run (a note of dashes, a sentence of keywords without a day); no
// registered act has words this long (the longest note has about 600 characters).
const WORDS = 2000;
// The opening words of a list subsection, as its points' heading (ADR-083).
const LEAD = 240;
const TEXT_BLOCKS = new Set(['p', 'li', 'dt', 'dd', 'tr', 'pre', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const BREAKS = new Set([...TEXT_BLOCKS, 'br', 'loige', 'punkt', 'alampunkt', 'tavatekst', 'kuvatavNr', 'paragrahv', 'pealkiri', 'td', 'th']);

// Riigi Teataja titles are `pealkiri` or `*Pealkiri` (peatykkPealkiri, paragrahvPealkiri, ...).
const isTitle = node => /^(?:pealkiri|\w+Pealkiri)$/u.test(localName(node));
const isBreak = node => BREAKS.has(localName(node)) || isTitle(node);
// `until` is a source position: only what starts before it is read (the text that precedes an amendment note).
function textContent(node, skip = () => false, substitute = () => null, until = Infinity) {
  if (node.type === 'text') return node.data;
  if (skip(node) || node.attribs?.hidden !== undefined || node.attribs?.['aria-hidden'] === 'true') return '';
  if (['script', 'style', 'noscript', 'template', 'svg'].includes(localName(node))) return '';
  const replaced = substitute(node);
  if (replaced !== null) return replaced;
  return children(node).map(child => (child.startIndex >= until ? ''
    : `${isBreak(child) ? '\n' : ''}${textContent(child, skip, substitute, until)}${isBreak(child) ? '\n' : ''}`)).join('');
}

// Riigi Teataja keeps some markup inside CDATA as text: a superscript number (§ 15<sup>1</sup>, 7<sup>1</sup>. jagu),
// a paragraph element and bold. The text gets superscript digits (§ 15¹, as the act is cited) and plain text.
// In the body text the superscript is an XML element ("käesoleva seaduse § 45<sup>9</sup> lõike 1"), read the same way:
// without it the reference reads "§ 459", which names another section (ADR-056).
const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const superscript = digits => [...digits].map(digit => SUPERSCRIPT[digit]).join('');
// A space inside the element ("§ 22<sup>1 </sup>lõikes") is the word's separator and stays. The number may also be in CDATA
// or in an element inside the superscript ("<sup><![CDATA[1]]></sup>", "<sup><b>1</b></sup>"): source-structure-v28 read
// those as plain digits ("§ 131" for § 13¹, Codex R3 30.09), so v29 reads the superscript's whole text.
const subtreeText = node => children(node).map(child => (child.type === 'text' ? child.data
  : child.type === 'cdata' ? children(child).map(part => part.data || '').join('').replace(/<[^>]*>/gu, '')
    : child.type === 'tag' ? subtreeText(child) : '')).join('');
const supElement = node => {
  const found = subtreeText(node).match(/^(\s*)(\d+)(\s*)$/u);
  return found ? `${found[1]}${superscript(found[2])}${found[3]}` : null;
};
// In CDATA: the plain superscript as before, then one with attributes or markup around its number ("<sup class="number">1</sup>").
const rtMarkup = value => value.replace(/<sup>\s*(\d+)\s*<\/sup>/giu, (_, digits) => superscript(digits))
  .replace(/<sup\b[^>]*>((?:\s|<[^>]*>|\d)*)<\/sup>/giu, (whole, inner) => {
    const digits = inner.replace(/<[^>]*>|\s/gu, '');
    return /^\d+$/u.test(digits) ? superscript(digits) : whole;
  })
  .replace(/<\/?p\b[^>]*>|<br\s*\/?>/giu, '\n').replace(/<\/?[a-z][a-z0-9]*\b[^>]*>/giu, '');
// An amendment note (muutmismarge) names the amending act's Riigi Teataja reference and entry into force:
// provenance, not the rule, and as text only a run of numbers. It is left out of the text; a repealed provision
// keeps its number and "Kehtetu." so the numbering still reads right. Since source-structure-v30 the note is kept
// as data beside the unchanged text (ADR-062): a section's notes on its source unit, the act's own dates in legal_text.
const isAmendment = node => localName(node) === 'muutmismarge';
// A link (viide) has its visible words (kuvatavTekst) and its target (viideURID). The target is an address
// ("./dyn=<this version's number>&id=<the linked act's>", "./../vaheleht.html"), not words of the act: until
// source-structure-v30 it stood in the text as a line of its own, 384 times in 21 registered acts, in what the answer
// model reads and in the embedding input, and it carries the version's own number, so two versions of an act differed
// by it alone. Since source-structure-v31 it is left out; the visible words stay where they were.
const isLinkTarget = node => localName(node) === 'viideURID';
const repealNote = node => isAmendment(node) && /^\s*Kehtetu\b/u.test(textContent(elements(node).find(n => localName(n) === 'tavatekst') || {}));

// A date in a note's own words: "01.01.2026", "1. jaanuarist 2026", "14. veebruar 2025", "2026. aasta 1. märtsist".
const MONTHS = ['jaanuar', 'veebruar', 'märts', 'aprill', 'mai', 'juuni', 'juuli', 'august', 'september', 'oktoober', 'november', 'detsember']
  .map(name => { const genitive = name.endsWith('i') ? name : `${name.replace(/er$/u, 'r')}i`; return [name, genitive, `${genitive}st`]; });
const isoDay = (year, month, day) => {
  const value = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return Number(month) > 0 && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value ? value : null;
};
const monthOf = word => MONTHS.findIndex(forms => forms.includes(word.toLowerCase())) + 1;
const NOTE_DATES = [
  [/^(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})$/u, found => isoDay(found[3], found[2], found[1])],
  [/^(\d{1,2})\.\s*(\p{L}+)\s+(\d{4})$/u, found => isoDay(found[3], monthOf(found[2]), found[1])],
  [/^(\d{4})\.\s*aasta\s+(\d{1,2})\.\s*(\p{L}+)$/u, found => isoDay(found[1], monthOf(found[3]), found[2])],
];
// Only a note that is nothing but the clause gives a date ("rakendatakse tagasiulatuvalt alates 01.01.2026. a."). A note
// about some of the provisions or with more to say ("lõikeid 1–3 rakendatakse ...", "rakendatakse osaliselt ...") gives
// none: its words stay the only statement. The verb is also written "rakendatake", "Rakendatatakse" and "rakend."
// (one note each in the registered acts; no other wording begins so).
const APPLIES = /^rakend(?:atakse|atake|atatakse|\.)\s+(?:tagasiulatuvalt\s+)?(?:alates\s+)?(.+?)\.?(?:\s*a\.?)?$/iu;
export function appliesFrom(words) {
  const date = words.match(APPLIES)?.[1];
  if (!date) return null;
  for (const [pattern, read] of NOTE_DATES) { const found = date.match(pattern); if (found) return read(found); }
  return null;
}
// A source date as its calendar day ("2026-09-04+03:00" is 2026-09-04); a day the calendar does not have is none.
const dayOf = raw => { const found = typeof raw === 'string' ? raw.match(/^(\d{4})-(\d{2})-(\d{2})/u) : null; return found ? isoDay(found[1], found[2], found[3]) : null; };
// A provision of the act itself on its application or entry into force that names a day
// ("Määrust rakendatakse alates 01.05.2026.", "Määrus jõustub 1. juulil 2018."). The day may be another act's
// ("kohaldatakse Saaremaa Vallavolikogu 26.04.2019. a määruse nr 7 ... sätteid"): the sentence is kept as it is, since one
// with such a day can also name the act's own ("jõustub ... 15. detsembri 2022 määruse ... jõustumisel, kuid kõige varem
// 1. jaanuaril 2023"); choosing among the kept sentences is the rendering's (ADR-062).
const APPLICATION = /(?:rakendatakse|kohaldatakse|jõustu(?:b|vad))[^.;]*?(?:\d{1,2}\.\s?\d{1,2}\.\s?\d{4}|\d{1,2}\.\s*\p{L}+\s+\d{4}|\d{4}\.\s*aasta\s+\d{1,2}\.\s*\p{L}+)/iu;
// In the data a repeal is the word in any case ("kehtetu -", "Kehtetud -") or "välja jäetud" (omitted). The text keeps
// reading only the capital form as "Kehtetu." (repealNote, ADR-034), so the text stays what source-structure-v29 read.
const REPEAL = /^(?:kehtetud?|välja jäetud)(?![\p{L}\p{N}])/iu;
// A court ruling is in force on the day of the judgment and published after it ("Riigikohtu ... kolleegiumi otsus
// tunnistab ..."). Any other note's entry into force comes on or after its publication day.
const RULING = /riigikoh/iu;

function nodePath(node) {
  if (!node.name) return '';
  const siblings = elements(node.parent || {}).filter(sibling => sibling.name === node.name);
  return `${nodePath(node.parent || {})}/${node.name}[${siblings.indexOf(node) + 1}]`;
}

function markup(text, xml) {
  if (xml && /<!\s*(?:DOCTYPE|ENTITY)/iu.test(text)) fail('xml_external_entities_forbidden');
  const dom = parseDocument(text, { xmlMode: xml, withStartIndices: true, withEndIndices: true });
  let count = 0;
  function check(node, depth = 0) {
    if (++count > 100000 || depth > 128) fail('markup_structure_limit');
    if (xml && node.type === 'tag') {
      const segment = text.slice(node.startIndex, node.endIndex + 1);
      const opening = segment.match(/^<[^>]+>/u)?.[0];
      if (!opening || !opening.endsWith('/>') && segment.match(/<\/([^\s>]+)\s*>$/u)?.[1] !== node.name) fail('invalid_xml_structure');
    }
    children(node).forEach(child => check(child, depth + 1));
  }
  check(dom);
  if (xml && elements(dom).length !== 1) fail('invalid_xml_structure');
  return dom;
}

function htmlRecords(text) {
  const dom = markup(text, false), nodes = flat(dom), warnings = [];
  const candidates = nodes.filter(node => localName(node) === 'article');
  const roots = candidates.length ? candidates.filter(node => !candidates.some(parent => parent !== node && flat(parent).includes(node)))
    : nodes.filter(node => localName(node) === 'main');
  if (roots.length > 1) fail('html_content_region_ambiguous');
  const root = roots[0] || nodes.find(node => localName(node) === 'body') || dom;
  if (!roots.length) warnings.push({ code: 'html_content_region_fallback', detail: 'No article/main element; body text requires content-scope review.' });
  const records = [], headings = [];
  const excluded = node => ['script', 'style', 'noscript', 'template', 'svg', 'nav', 'form'].includes(localName(node))
    || !roots.length && ['header', 'footer', 'aside'].includes(localName(node))
    || node.attribs?.hidden !== undefined || node.attribs?.['aria-hidden'] === 'true';
  function visit(node) {
    if (excluded(node)) return;
    const tag = localName(node), block = TEXT_BLOCKS.has(tag);
    const nested = elements(node).some(child => flat(child).some(descendant => TEXT_BLOCKS.has(localName(descendant))));
    if (block && (!nested || tag === 'tr')) {
      const value = textContent(node).replace(/\r/gu, '').replace(/[ \t]+/gu, ' ').replace(/\n{3,}/gu, '\n\n').trim();
      if (!value) return;
      const heading = /^h[1-6]$/u.test(tag);
      if (heading) { headings.length = Number(tag[1]) - 1; headings.push(clean(value)); }
      records.push({ text: value, kind: heading ? 'heading' : tag === 'tr' ? 'table_row' : tag === 'li' ? 'list_item' : tag === 'blockquote' ? 'quote' : 'paragraph',
        headings: headings.filter(Boolean), locator: { kind: 'html', path: nodePath(node), ...(node.attribs?.id ? { element_id: node.attribs.id } : {}) },
        group: tag === 'tr' ? nodePath(node.parent) : 'article' });
      return;
    }
    for (const child of children(node)) {
      if (child.type === 'text' && child.data.trim()) {
        records.push({ text: clean(child.data), kind: 'paragraph', headings: headings.filter(Boolean),
          locator: { kind: 'html', path: `${nodePath(node)}/text()[${children(node).filter(n => n.type === 'text').indexOf(child) + 1}]` }, group: 'article' });
      } else if (child.name) visit(child);
    }
  }
  visit(root);
  if (flat(root).some(node => ['img', 'video', 'canvas'].includes(localName(node)))) warnings.push({ code: 'non_text_media_not_extracted' });
  return { records, warnings, metadata: {} };
}

// `only`: the sections a registered source selects (ADR-076, "2" for § 2). The rest of the file is then not text of this
// source: other sections, text outside sections and the notes on them are left unread; the act's identity, validity
// and history are the act's own.
function xmlRecords(text, only = null, units = null, aids = null) {
  const dom = markup(text, true), root = elements(dom)[0];
  if (localName(root) !== 'oigusakt') fail('xml_adapter_required');
  const child = (node, name) => elements(node || {}).find(n => localName(n) === name);
  const xmlText = (node, skip, until) => rtMarkup(textContent(node, skip, n => isAmendment(n) ? repealNote(n) ? 'Kehtetu.' : ''
    : isLinkTarget(n) ? '' : localName(n) === 'sup' ? supElement(n) : null, until));
  const value = (node, name) => { const selected = child(node, name); return selected ? clean(xmlText(selected)) || null : null; };
  const meta = child(root, 'metaandmed'), validity = child(meta, 'kehtivus');
  const name = child(child(root, 'aktinimi'), 'nimi'), publication = child(meta, 'avaldamismarge');
  const metadataNodes = { title: child(name, 'pealkiri'), authority: child(meta, 'valjaandja'),
    act_reference: child(meta, 'globaalID') || child(publication, 'aktViide'),
    valid_from: child(validity, 'kehtivuseAlgus'), valid_to: child(validity, 'kehtivuseLopp'),
    publication_date: child(publication, 'avaldamineKuupaev'), act_type: child(meta, 'dokumentLiik') };
  const metadata = Object.fromEntries(Object.entries(metadataNodes).filter(([, node]) => node && clean(xmlText(node)))
    .map(([key, node]) => [key, clean(xmlText(node))]));
  const metadata_paths = Object.fromEntries(Object.entries(metadataNodes).filter(([, node]) => node).map(([key, node]) => [key, nodePath(node)]));
  const body = child(root, 'sisu');
  if (!body) fail('xml_act_body_missing');
  // `sections` names each section's record, so a note inside it finds its source unit.
  // A section read subsection by subsection (ADR-082) is in `split`, and `sections` then names each subsection's record.
  const records = [], sections = new Map(), found = new Set(), split = new Set(), aided = new Set();
  const sectionNumber = number => (number || '').replace(/^§\s*/u, '').replace(/\.$/u, '').trim();
  // Technical numbers (paragrahvNr, loigeNr, ...) repeat the displayed ones (kuvatavNr: "§ 1.", "(1)").
  const technical = node => /Nr$/u.test(localName(node)) && localName(node) !== 'kuvatavNr';
  // Wholly repealed: every element besides numbers and the title is a repeal note, or itself wholly repealed.
  const repealed = node => {
    if (isAmendment(node)) return repealNote(node);
    const content = elements(node).filter(n => !technical(n) && localName(n) !== 'kuvatavNr' && !isTitle(n) && !(isAmendment(n) && !repealNote(n)));
    return content.length > 0 && content.every(repealed);
  };
  // A section's text; with `until`, the part of it before that source position.
  const unitText = (node, until) => xmlText(node, technical, until).replace(/\r/gu, '').replace(/[ \t]+/gu, ' ').replace(/ *\n */gu, '\n').replace(/\n{3,}/gu, '\n\n').trim();
  function visit(node, headings = []) {
    const tag = localName(node);
    // Amendment notes are not text of the act, and a wholly repealed paragraph states no rule.
    if (isAmendment(node) || tag === 'paragrahv' && repealed(node)) return;
    const titleNode = elements(node).find(isTitle), title = titleNode ? clean(xmlText(titleNode)) || null : null;
    // A part, chapter or division adds its displayed number and title ("1. peatükk Üldsätted").
    const label = tag === 'paragrahv' ? null : [value(node, 'kuvatavNr'), title].filter(Boolean).join(' ');
    const nextHeadings = label ? [...headings, label] : headings;
    if (tag === 'paragrahv') {
      const number = value(node, 'kuvatavNr') || value(node, 'paragrahvNr');
      if (only) { if (!only.includes(sectionNumber(number))) return; found.add(sectionNumber(number)); }
      const label = [number ? `§ ${number.replace(/^§\s*/u, '')}` : null, title].filter(Boolean).join(' ');
      // ADR-087: the register's search aid for this section goes with each of its units.
      const aid = aids?.get(sectionNumber(number)) ?? null;
      if (aid) aided.add(sectionNumber(number));
      const unit = (part, lead = null) => ({ text: unitText(part), ...(aid ? { search_aid: aid } : {}),
        kind: 'legal_unit', headings: [...headings, label, lead].filter(Boolean), group: nodePath(part),
        locator: { kind: 'xml', path: nodePath(part), ...(part.attribs?.id ? { element_id: part.attribs.id } : {}), act_reference: metadata.act_reference } });
      // ADR-082: a selected section the register asks to be read by subsection (the State Budget Act's § 2: one subsection
      // per act whose rates it sets). Each subsection is a unit of its own, so a passage is one subsection with its
      // opening words, not a cut by length across two of them. Only where the section's whole text stands in subsections;
      // a wholly repealed subsection states no rule and is left out, as a wholly repealed section is.
      const content = only && units ? elements(node).filter(n => !technical(n) && localName(n) !== 'kuvatavNr' && !isTitle(n) && !isAmendment(n)) : [];
      if (content.length > 1 && content.every(n => localName(n) === 'loige')) {
        split.add(node);
        for (const part of content.filter(n => !repealed(n))) {
          // ADR-083 ("point"): a subsection that is a list ("... määrad on järgmised: 1) ... 2) ...") is read point by
          // point. Each point is a unit under the subsection's opening words as its heading, so a passage is one rate
          // with the act it belongs to, not a list of unrelated rates. Only where the subsection ends in its points
          // and has at least two; a wholly repealed point is left out.
          const inner = units === 'point' ? elements(part).filter(n => !technical(n) && localName(n) !== 'kuvatavNr' && !isAmendment(n)) : [];
          const first = inner.findIndex(n => localName(n) === 'alampunkt'), points = first > 0 ? inner.slice(first) : [];
          const lead = points.length > 1 && points.every(n => localName(n) === 'alampunkt') ? cut(clean(unitText(part, points[0].startIndex)), LEAD) : '';
          if (lead) for (const point of points.filter(n => !repealed(n))) { sections.set(point, records.length); records.push(unit(point, lead)); }
          else { sections.set(part, records.length); records.push(unit(part)); }
        }
        return;
      }
      sections.set(node, records.length);
      records.push(unit(node));
      return;
    }
    if (['tavatekst', 'sisuTekst'].includes(tag)) {
      if (only) return;
      const content = clean(xmlText(node));
      if (content) records.push({ text: content, kind: 'paragraph', headings: nextHeadings, group: nodePath(node), locator: { kind: 'xml', path: nodePath(node), act_reference: metadata.act_reference } });
      return;
    }
    elements(node).forEach(n => visit(n, nextHeadings));
  }
  visit(body);
  // A selected section the file does not have (renumbered in a new version, or wholly repealed) is an error, not an empty source.
  if (only && only.some(number => !found.has(number))) fail('xml_section_not_found');
  // The same for a section the register gives a search aid: an aid that reaches no passage would be lost silently.
  if (aids && [...aids.keys()].some(number => !aided.has(number))) fail('xml_section_not_found');

  // Amendment notes and the act's own dates, as data beside the text read above (source-structure-v30, ADR-062).
  const up = (node, test) => { for (let n = node; n; n = n.parent) if (test(n)) return n; return null; };
  // A text element or a title only wraps the words: a note in it belongs to the provision or part that holds it.
  const wraps = node => ['sisuTekst', 'tavatekst'].includes(localName(node)) || isTitle(node) && localName(node) !== 'lisaPealkiri';
  const holder = node => (wraps(node) && node.parent ? holder(node.parent) : node);
  // A title in a label is read without the notes inside it (a repealed annex's title is not "... Kehtetu.").
  const plain = node => clean(xmlText(node, isAmendment));
  // A provision as it is cited ("§ 15¹ lg 2 p 3"); outside a section the part's number and title ("2. jagu Toetused").
  const part = node => {
    const tag = localName(node), number = value(node, 'kuvatavNr') || '';
    if (tag === 'paragrahv') return `§ ${(number || value(node, 'paragrahvNr') || '').replace(/^§\s*/u, '').replace(/\.$/u, '')}`.trim();
    if (tag === 'loige') return number ? `lg ${number.replace(/^\(|[).]$/gu, '')}` : null;
    if (tag === 'alampunkt') return number ? `p ${number.replace(/[).]$/u, '')}` : null;
    if (wraps(node)) return null;
    if (tag === 'preambul') return 'preambul';
    if (tag === 'nimi' || tag === 'aktinimi') return 'pealkiri';
    if (tag === 'normtehnmarkus') return 'normitehniline märkus';
    if (tag === 'lisaPealkiri') return cut(`lisa ${plain(node)}`.trim(), 120);
    const titleNode = elements(node).find(isTitle), title = titleNode ? plain(titleNode) || null : null;
    return cut([number, title].filter(Boolean).join(' '), 120) || tag;
  };
  const provision = owner => {
    const chain = []; for (let n = owner; n && n !== root; n = n.parent) chain.unshift(n);
    const from = chain.findIndex(n => localName(n) === 'paragrahv');
    return (from < 0 ? [holder(owner)] : chain.slice(from)).map(part).filter(Boolean).join(' ') || localName(owner);
  };
  // A note's own words, without the repeal word and the separators around them:
  // "Kehtetu - , rakendatakse alates 01.01.2026" is a repeal with the words "rakendatakse alates 01.01.2026".
  const said = node => cut(elements(node || {}).filter(n => localName(n) === 'tavatekst').map(n => clean(xmlText(n))).filter(Boolean).join(' '), WORDS);
  const ownWords = text => text.replace(REPEAL, '').replace(/^[\s,;‒–—-]+|[\s‒–—-]+$/gu, '');
  // An entry into force before the note's own publication day is a source error (Haljala 429012022009 § 2 lg 1 p 4:
  // 2020-02-01 for an act published 2022-01-29). Such a day is left out and reported, never passed on or corrected.
  const early = [];
  const amendment = (node, where) => {
    const mark = child(node, 'avaldamismarge'), published = dayOf(value(mark, 'avaldamineKuupaev')), adopted = dayOf(value(node, 'aktikuupaev'));
    const text = said(node), words = ownWords(text), applies = appliesFrom(words), given = dayOf(value(node, 'joustumine'));
    const refused = Boolean(given && published && given < published && !RULING.test(text));
    if (refused) early.push(`${where}: ${given}, published ${published}`);
    // Riigi Teataja is cited by its publication day ("RT IV, 21.03.2026, 7"), before 2010 by year and issue ("RT I 2010, 22, 108").
    const issue = published ? [value(mark, 'RTosa'), published.split('-').reverse().join('.')]
      : [[value(mark, 'RTosa'), value(mark, 'RTaasta')].filter(Boolean).join(' '), value(mark, 'RTnr')];
    return { act_reference: value(mark, 'aktViide'), rt: [...issue, value(mark, 'RTartikkel')].filter(Boolean).join(', '),
      published, in_force: refused ? null : given, ...(adopted ? { adopted } : {}),
      ...(applies ? { applies_from: applies } : {}), ...(words ? { note: words } : {}), ...(REPEAL.test(text) ? { repeal: true } : {}) };
  };
  const history = [], structure = [], changed = [], validFrom = dayOf(metadata.valid_from);
  let unplaced = 0;
  for (const note of flat(root).filter(isAmendment)) {
    const owner = localName(note.parent) === 'sisuTekst' ? note.parent.parent : note.parent;
    // A note of the act itself names one amending act of its history.
    if (owner === root) { history.push(amendment(note, 'history')); continue; }
    // The unit that holds the note: its section, or its subsection where the section is read subsection by subsection.
    const paragraph = up(owner, n => localName(n) === 'paragrahv'), section = up(owner, n => sections.has(n)), index = sections.get(section);
    // Of a selection, only the selected sections' notes are this source's; a note of a split section outside its
    // subsections (on its title, or a wholly repealed subsection) is listed with the notes outside the text.
    if (only && index === undefined && !split.has(paragraph)) continue;
    const label = provision(owner), data = amendment(note, label);
    if (validFrom && data.in_force === validFrom) changed.push({ label: `${label}${data.repeal ? ' (kehtetu)' : ''}`, act_reference: data.act_reference });
    // Outside a section's text: the preamble, a title, a chapter or division, an annex title, a wholly repealed section.
    if (index === undefined) { structure.push({ target: label, path: nodePath(owner), ...data }); continue; }
    // The note's place is the length of the section's text before it, so the note joins the chunk that holds its
    // provision. A place the text does not confirm stays unknown and is reported, never guessed.
    const before = unitText(section, note.startIndex), placed = records[index].text.startsWith(before);
    if (!placed) unplaced++;
    (records[index].amendments ||= []).push({ provision: label, offset: placed ? before.length : null, path: nodePath(note), ...data });
  }
  // The act's own provisions on its application or entry into force, each with its section's source unit.
  const entry_into_force = [];
  for (const [section, unit_index] of sections) {
    for (const item of flat(section).filter(n => localName(n) === 'tavatekst' && !up(n, isAmendment))) {
      const words = clean(xmlText(item));
      if (APPLICATION.test(cut(words, WORDS))) entry_into_force.push({ provision: provision(localName(item.parent) === 'sisuTekst' ? item.parent.parent : item.parent),
        unit_index, path: nodePath(item), text: cut(words, 400) });
    }
  }
  // The amending acts of the version's first day: by the history's day, or named by a note of that day when the history
  // gives the day only in words ("osaliselt 01.01.2027").
  const starting = new Set(changed.map(item => item.act_reference));
  const amending = history.filter(item => validFrom && (item.in_force === validFrom || starting.has(item.act_reference)));
  const adopted = child(meta, 'vastuvoetud'), textKind = value(meta, 'tekstiliik');
  // The adoption carries its own words in some acts ("Rakendatakse alates 01.01.2025"), read as a note's are.
  const adoptionNote = ownWords(said(adopted)), actApplies = appliesFrom(adoptionNote);
  // An original text never amended (algtekst-terviktekst) is in force from its validity start; its adoption's day is read
  // only without one (Otepää 405072022009 keys there the day the act is applied from, 2022-07-01, a week before the start).
  const original = /^algtekst/u.test(textKind || ''), given = dayOf(value(adopted, 'joustumine'));
  // A consolidated text's adoption names its day and a publication. A day before that publication is kept and reported,
  // not left out as a note's is: of the seven such acts registered, four are acts of 2007-2012 put into Riigi Teataja
  // afterwards and three carry a mark published after their first amendments, and the act's own "jõustub" provision,
  // where it has one, names the same day (Ruhnu 417032016009 § 5 lg 2, Saue 402092026040 § 31 lg 2, Tartu 411122015006
  // § 5 lg 3). Whether to show such a day is the rendering's to choose: original_published is the publication day beside it.
  const originalPublished = dayOf(value(child(adopted, 'avaldamismarge'), 'avaldamineKuupaev'));
  const beforePublication = !original && given && originalPublished && given < originalPublished;
  const legal_text = { schema_version: 'rag-v2/legal-text-1', text_kind: textKind,
    adopted: dayOf(value(adopted, 'aktikuupaev')), original_reference: value(child(adopted, 'avaldamismarge'), 'aktViide'), original_published: originalPublished,
    act_in_force_from: original ? validFrom || given : given,
    ...(actApplies ? { act_applies_from: actApplies } : {}), ...(adoptionNote ? { adoption_note: adoptionNote } : {}),
    version_from: validFrom, history,
    // What the amendment that starts this consolidated version changed: valid_from is that amendment's day, not the day of the other provisions.
    ...(amending.length || changed.length ? { version_change: { in_force: validFrom, acts: [...new Set(amending.map(item => item.act_reference))],
      provisions: [...new Set(changed.map(item => item.label))] } } : {}),
    structure, entry_into_force };
  const warnings = [...(unplaced ? [{ code: 'amendment_note_position_unresolved',
    detail: `${unplaced} amendment notes are kept without a place in their section's text; their provisions need review.` }] : []),
  ...(early.length ? [{ code: 'amendment_note_in_force_before_publication',
    detail: `${early.length} amendment notes name an entry into force before their publication day and are kept without it (${cut(early.join('; '), 300)}).` }] : []),
  ...(beforePublication ? [{ code: 'act_in_force_before_publication',
    detail: `The act's entry into force (${given}) is before the publication day its adoption names (${originalPublished}); the day is kept as the source gives it.` }] : [])];
  return { records, metadata: Object.fromEntries(Object.entries(metadata).filter(([, v]) => v !== null)), warnings, metadata_basis: 'riigi_teataja_xml', metadata_paths, legal_text };
}

const POINTER_PART = value => String(value).replaceAll('~', '~0').replaceAll('/', '~1');
const NON_CONTENT = new Set(['id', 'canonical_item_id', 'source_id', 'document_id', 'docId', 'schemaVersion', 'metadata_schema_version', 'content_hash',
  'source_keys', 'sourceKeys', 'source_type', 'collection_id', 'itemType', 'item_type', 'municipality_id', 'municipality_name', 'county', 'country',
  'authority', 'language', 'audience', 'historical', 'source_status', 'checked_at', 'checkedAt', 'last_checked', 'retrieved_at', 'valid_from', 'valid_to',
  'url_canonical', 'officialUrl', 'metadata_status', 'metadata_notes', 'sections_present', 'evidence_allowed', 'lastMetadataUpgradeAt',
  'metadata_schema_version', 'organization_id', 'slug', 'resource_type', 'relatedForms', 'relatedContacts', 'relatedDocuments',
  'related_forms', 'related_contacts', 'related_documents', 'allowed_claim_types', 'disallowed_claim_types', 'status']);

function jsonRecords(text, metadata) {
  let root; try { root = JSON.parse(text); } catch { fail('invalid_source_json'); }
  const selected = metadata.source_selector?.json_pointer;
  let target = root;
  if (selected !== undefined) {
    if (typeof selected !== 'string' || selected !== '' && !selected.startsWith('/')) fail('invalid_source_selector');
    for (const part of selected === '' ? [] : selected.slice(1).split('/')) {
      const key = part.replaceAll('~1', '/').replaceAll('~0', '~');
      if (!target || typeof target !== 'object' || !Object.hasOwn(target, key)) fail('source_selector_not_found');
      target = target[key];
    }
  }
  if (!target || typeof target !== 'object') fail('source_package_required');
  const records = [];
  function addRecord(object, pointer, fallback) {
    if (!object || typeof object !== 'object' || Array.isArray(object)) fail('invalid_source_record');
    const title = object.title || object.name || fallback;
    for (const [key, value] of Object.entries(object)) {
      const linkField = metadata.record_mapping?.links?.some(link => link.field === key);
      const mappedField = Object.values(metadata.record_mapping?.fields || {}).some(keys => keys.includes(key));
      const bindingField = Object.values(metadata.record_mapping?.bindings || {}).some(keys => keys.includes(key));
      if (NON_CONTENT.has(key) && !linkField && !mappedField && !bindingField || value === null || value === '') continue;
      // One record is one section. Link targets and technical fields a mapping needs (a check
      // date, the official URL) stay citable source text but are anchors, not retrieval text.
      // An adapter verification identity (a binding) keeps its own section: structural-role.js
      // withholds any chunk with a binding location from evidence, so it must not share one.
      const anchor = linkField || NON_CONTENT.has(key) && !bindingField;
      if (bindingField) {
        const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
        if (text?.trim()) records.push({ text, kind: 'paragraph', headings: [title, key].filter(Boolean), group: pointer || '/',
          locator: { kind: 'json', path: `${pointer}/${POINTER_PART(key)}`, record_id: object.id || object.organization_id || null,
            source_keys: object.sourceKeys || object.source_keys || [] } });
        continue;
      }
      if (linkField && Array.isArray(value)) {
        for (const [index, target] of value.entries()) {
          if (typeof target !== 'string' || !target.trim()) fail('invalid_record_links');
          records.push({ text: target, kind: 'paragraph', headings: [title].filter(Boolean), group: pointer || '/', anchor,
            locator: { kind: 'json', path: `${pointer}/${POINTER_PART(key)}/${index}`, record_id: object.id || null } });
        }
        continue;
      }
      const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
      if (!text?.trim()) continue;
      records.push({ text, kind: key === 'title' || key === 'name' ? 'heading' : 'paragraph', headings: [title].filter(Boolean), group: pointer || '/', anchor,
        locator: { kind: 'json', path: `${pointer}/${POINTER_PART(key)}`, record_id: object.id || object.organization_id || null,
          source_keys: object.sourceKeys || object.source_keys || [] } });
    }
  }
  if (selected !== undefined) addRecord(target, selected, metadata.title);
  else if (Array.isArray(root.items)) {
    root.items.forEach((item, index) => addRecord(item, `/items/${index}`, metadata.title));
  } else if (root.organization_id) {
    const lists = new Set(['services', 'benefits', 'resources', 'contacts', 'documents']);
    addRecord(Object.fromEntries(Object.entries(root).filter(([key]) => !lists.has(key))), '', metadata.title);
    for (const key of lists) if (Array.isArray(root[key])) root[key].forEach((item, index) => addRecord(item, `/${key}/${index}`, metadata.title));
  } else fail('json_source_selector_required');
  if (metadata.record_mapping && selected === undefined) fail('structured_record_selector_required');
  return { records, metadata: {}, structured_record: structuredRecord(target, selected, metadata.record_mapping),
    warnings: [{ code: 'collected_package_text', detail: 'JSON values preserve collected content; they are not a fresh retrieval of the referenced web pages.' }] };
}

/** The sections a registered XML source selects, as displayed without "§" and the full stop; null reads the whole act. */
export function xmlSections(metadata) {
  const selected = metadata?.source_selector?.xml_sections;
  if (selected === undefined) return null;
  if (!Array.isArray(selected) || !selected.length || selected.some(number => typeof number !== 'string' || !/^\d+[⁰¹²³⁴⁵⁶⁷⁸⁹]*$/u.test(number))
    || new Set(selected).size !== selected.length) fail('invalid_source_selector');
  return selected;
}

/** How a registered XML source's selected sections are cut into units: 'subsection' (ADR-082), 'point' (ADR-083: by
 * subsection, and a subsection that is a list by point), or null for one unit per section. Only with a selection of sections. */
export function xmlUnits(metadata) {
  const units = metadata?.source_selector?.xml_units;
  if (units === undefined) return null;
  if (!['subsection', 'point'].includes(units) || metadata.source_selector.xml_sections === undefined) fail('invalid_source_selector');
  return units;
}

/** The search aids a registered XML source gives its sections (ADR-087): a Map from a section's number, as displayed
 * without "\u00A7" and the full stop, to one line of everyday words for what the section is about; null without any. The
 * line stands in the passage's retrieval text under its heading path, never in its source text: a search finds the
 * passage by it, and no answer can quote it. */
export const SEARCH_AID_MAX = 300;
export function xmlSearchAids(metadata) {
  const aids = metadata?.source_selector?.xml_search_aids;
  if (aids === undefined) return null;
  const entries = aids && typeof aids === 'object' && !Array.isArray(aids) ? Object.entries(aids) : [];
  if (!entries.length || entries.length > 50 || entries.some(([number, text]) => !/^\d+[\u2070\u00B9\u00B2\u00B3\u2074\u2075\u2076\u2077\u2078\u2079]*$/u.test(number)
    || typeof text !== 'string' || text !== text.trim() || text.length < 10 || text.length > SEARCH_AID_MAX || /[\r\n]/u.test(text) || text.includes('\0'))) fail('invalid_source_selector');
  return new Map(entries);
}

export function parseTextSource(bytes, format, metadata, scope, config) {
  let text; try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/u, ''); } catch { fail('source_encoding_invalid'); }
  const result = format === 'html' ? htmlRecords(text) : format === 'xml' ? xmlRecords(text, xmlSections(metadata), xmlUnits(metadata), xmlSearchAids(metadata)) : jsonRecords(text, metadata);
  if (!result.records.length) fail('source_text_empty');
  if (result.records.length > config.maxPdfItems || result.records.reduce((n, r) => n + r.text.length, 0) > config.maxTextChars) fail('text_limit');
  const source_units = [], spans = [], blocks = [], sections = [];
  const rootSection = { ...scope, id: id('section', scope.document_version_id, 'root'), title: null, parent_id: null, span_ids: [] };
  sections.push(rootSection);
  const sectionMap = new Map();
  for (const [index, record] of result.records.entries()) {
    const unit = sourceUnit(record.text.replaceAll('\u0000', '\uFFFD'), record.locator, index, scope.document_version_id);
    // A section's amendment notes stay beside its text; their offsets are positions in raw_text.
    if (record.amendments) unit.amendments = record.amendments;
    source_units.push(unit);
    const sectionKey = JSON.stringify([record.headings, record.group]);
    let section = sectionMap.get(sectionKey);
    if (!section) {
      section = { ...scope, id: id('section', scope.document_version_id, sectionKey), title: record.headings.join(' > ') || null,
        parent_id: rootSection.id, span_ids: [], record_key: record.group, ...(record.search_aid ? { search_aid: record.search_aid } : {}) };
      sections.push(section); sectionMap.set(sectionKey, section);
    }
    const block = { ...scope, id: id('block', unit.id), kind: record.kind, span_ids: [], record_key: record.group };
    blocks.push(block);
    for (const range of textRanges(unit.raw_text, config.chunkMaxChars)) {
      const source_text = unit.raw_text.slice(range.start, range.end);
      if (!source_text.trim()) continue;
      const span = { ...scope, id: id('span', scope.document_version_id, index, range.start, range.end), ...range,
        source_unit_index: index, pdf_page: null, parser_page_index: null, bbox: [], item_indices: [],
        source_text, retrieval_text: source_text.replace(/\s+/gu, ' ').trim(), transformation: 'decoded_source_text',
        parent_section_id: section.id, block_id: block.id, height: record.kind === 'heading' ? 18 : 12, y: -index,
        ...record.anchor ? { anchor_only: true } : {} };
      spans.push(span); block.span_ids.push(span.id); section.span_ids.push(span.id);
    }
  }
  // Text after a reference list leaves the list's section (a heading element always starts one).
  const referenceSplits = splitReferenceLists({ sections, spans, blocks });
  return { parsed: { info: {}, source_format: format, source_metadata: result.metadata, metadata_basis: result.metadata_basis, metadata_paths: result.metadata_paths,
    ...(result.structured_record ? { structured_record: result.structured_record } : {}), ...(result.legal_text ? { legal_text: result.legal_text } : {}) },
    structured: { pages: [], source_units, spans, blocks, sections, removed: [], nulReplacements: 0, warnings: result.warnings, referenceSplits } };
}

export function inspectXmlMetadata(bytes) {
  let text; try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { fail('source_encoding_invalid'); }
  const { metadata, metadata_paths } = xmlRecords(text);
  return { metadata, metadata_paths };
}
