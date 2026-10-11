import { tokenCount } from './embedding.js';
import { declaredValidity } from './legal-validity.js';

// The same provision in two versions of one act, compared on the server (ADR-088). Passages are cut by length, so a
// provision stands in different passages of two versions: the fifth subsection of a section was in the second passage
// of the old version and in the first of the new one, and an answer called it new although its wording had not
// changed (ADR-077, finding F1). Here each version is read provision by provision from its sections' own text, the
// provisions are matched by their wording and their numbers, and the model is told which of them changed, which were
// added or removed and which read the same, with the evidence passages that hold each. The wording itself stays in
// those passages: this block adds no text of the act and no claim about it beyond "the same" and "not the same".
// Checked on the index of 05.10.2026 against Riigi Teataja's own amendment notes: in the 41 acts held in two versions
// every provision a note names as changed on the newer version's first day (191) is among the differences found here.
// comparison-2: a section that was one text and now is a heading with subsections (or the other way round) keeps its
// words under their new number instead of reading as changed and added.
export const VERSION_COMPARISON_VERSION = 'rag-v2/version-comparison-2';
// The provisions of the evidence are all listed; of the others that differ only this many names, and their count.
const OTHER_LISTED = 40;
// The block's own cap, in tokens of its JSON. Like the legal dates (ADR-062) it is outside every context budget, so it
// costs a turn no excerpt and no token limit fails a turn over it; the context can pass a measured limit by this much.
export const VERSION_CHANGES_TOKENS = 1500;
// A section as Riigi Teataja's XML is read (text-source.js): "§ 5." on a line of its own, then its title and its
// subsections, each number ("(1)", "(2¹)") on a line of its own; blocks are separated by an empty line.
const SECTION = /^§\s*(\d+[⁰¹²³⁴⁵⁶⁷⁸⁹]*)\.?$/u, SUBSECTION = /^\((\d+[⁰¹²³⁴⁵⁶⁷⁸⁹]*)\)$/u;
// A national law's text carries the target of each link to an implementing act as a block of its own
// ("./dyn=<this version's number>&id=<the linked act's>"). It names the version it stands in, so it differs in every
// version without a word of the provision changing: of the 46 subsections of the Social Welfare Act that differed
// between its versions of 01.02.2027 and 01.04.2027, 38 differed in this alone. It is no wording.
const LINK_TARGET = /\.\/dyn=\d+&id=\d+(?:;\d+)*/gu;
const wording = text => text.replace(LINK_TARGET, ' ').replace(/\s+/gu, ' ').trim();

/** The provisions of an act's bundle: every section, and every subsection of a section that has them. Each provision
 *  keeps its label as an act is cited ("§ 5 lg 2", "§ 12"), the source unit it stands in, its place there (UTF-16
 *  offsets, as a passage's source locations count them) and its wording. A section's title and any text before its
 *  first subsection are the provision "§ N" itself. */
export function actProvisions(bundle) {
  const provisions = [];
  for (const unit of bundle.source_units || []) {
    if (unit.locator?.kind !== 'xml' || typeof unit.raw_text !== 'string') continue;
    const blocks = [];
    for (const match of unit.raw_text.matchAll(/[^\n](?:[^\n]|\n(?!\n))*/gu)) blocks.push({ text: match[0].trim(), start: match.index, end: match.index + match[0].length });
    const number = SECTION.exec(blocks[0]?.text || '')?.[1];
    if (!number) continue;
    const marks = blocks.map((block, at) => ({ at, number: SUBSECTION.exec(block.text)?.[1] })).filter(mark => mark.number);
    const part = (label, from, to) => {
      const own = blocks.slice(from, to);
      if (own.length) provisions.push({ label, section: number, path: unit.locator.path, start: own[0].start, end: own.at(-1).end, text: wording(own.map(block => block.text).join('\n')) });
    };
    // Subsection numbers that repeat inside a section are not subsections of it (a quoted provision): read it whole.
    if (!marks.length || new Set(marks.map(mark => mark.number)).size !== marks.length) { part(`§ ${number}`, 0, blocks.length); continue; }
    part(`§ ${number}`, 0, marks[0].at);
    for (const [index, mark] of marks.entries()) part(`§ ${number} lg ${mark.number}`, mark.at, marks[index + 1]?.at ?? blocks.length);
  }
  return provisions;
}

// A subsection's words without its own number: a subsection put in before it changes the number, not the words.
const body = item => item.text.replace(/^\(\d+[⁰¹²³⁴⁵⁶⁷⁸⁹]*\)\s*/u, '');
// A repealed subsection keeps its number and loses its words: the text reads "Kehtetu." there, or nothing where the
// whole section was repealed.
const repealed = item => /^(?:kehtetu\.?)?$/iu.test(body(item));

/** What differs between two versions' provisions: `unchanged` (the same label and wording), `renumbered` (the same
 *  wording under another number of the same section: the provision moved, its words did not), `changed` (the same
 *  label, another wording), `added` (only in the newer) and `removed` (only in the older, or repealed in the newer:
 *  its number stands there without its words). The wording is matched before the number, so a subsection put into the
 *  middle of a section does not make the ones after it "changed", and a section's one text that became its first
 *  subsection is that subsection, not a changed section and an added subsection. */
export function compareProvisions(older, newer) {
  const result = { changed: [], added: [], removed: [], renumbered: [], unchanged: [] };
  const left = new Map(older.map(item => [item.label, item])), open = new Map(newer.map(item => [item.label, item]));
  for (const [label, item] of open) if (left.has(label) && left.get(label).text === item.text) { result.unchanged.push(label); left.delete(label); open.delete(label); }
  // A section that was one text and now stands as a heading with subsections, or the other way round: where the one
  // text reads as the heading followed by one subsection's words, those words only got (or lost) a number. In the
  // Child Protection Act's version of 01.01.2027 the one sentence of section 11 became its subsection 1.
  const sectionsOf = list => { const sections = new Map(); for (const item of list) sections.set(item.section, [...(sections.get(item.section) || []), item]); return sections; };
  const before = sectionsOf(older), after = sectionsOf(newer), joined = (heading, part) => `${heading.text} ${body(part)}`;
  for (const [section, parts] of after) {
    const old = before.get(section);
    if (!old || !left.has(old[0].label) || !open.has(parts[0].label)) continue;
    if (old.length === 1 && parts.length > 1) {
      const part = parts.slice(1).find(item => open.has(item.label) && !repealed(item) && old[0].text === joined(parts[0], item));
      if (!part) continue;
      result.unchanged.push(parts[0].label); result.renumbered.push({ label: part.label, was: old[0].label });
      left.delete(old[0].label); open.delete(parts[0].label); open.delete(part.label);
    } else if (parts.length === 1 && old.length > 1) {
      const part = old.slice(1).find(item => left.has(item.label) && !repealed(item) && parts[0].text === joined(old[0], item));
      if (!part) continue;
      result.renumbered.push({ label: parts[0].label, was: part.label });
      open.delete(parts[0].label); left.delete(old[0].label); left.delete(part.label);
    }
  }
  // Only the wording of a whole provision counts, and only inside one section: the same sentence in two sections is two provisions.
  for (const [label, item] of open) {
    const was = repealed(item) ? null : [...left.values()].find(other => other.section === item.section && body(other) === body(item));
    if (!was) continue;
    result.renumbered.push({ label, was: was.label }); left.delete(was.label); open.delete(label);
  }
  for (const [label, item] of open) {
    if (!left.has(label)) { result.added.push(label); continue; }
    result[repealed(item) && !repealed(left.get(label)) ? 'removed' : 'changed'].push(label);
    left.delete(label);
  }
  result.removed.push(...left.keys());
  return result;
}

/** One act: its title, issuer and municipality. The versions of an act share them; two municipalities' regulations of
 *  one title do not (60 of the 286 municipal titles in the index were shared on 10.10.2026). The provision check
 *  (ADR-129, pilot/provision-check.js) tells acts apart by the same key. */
export const actKey = entry => JSON.stringify([entry.bibliography?.title ?? null, entry.source_metadata?.authority?.value ?? null, entry.source_metadata?.municipality_id?.value ?? null]);
const adopted = bundle => bundle.document.fields?.legal_text?.value?.adopted ?? null;
// The passages that hold a provision: those whose place in the provision's source unit overlaps it (evidence entries
// and a bundle's chunks carry the same source locations).
const holding = (provision, passages) => passages.filter(passage => (passage.source_locations || []).some(location => location.path === provision.path
  && Number.isInteger(location.start) && Number.isInteger(location.end) && location.start < provision.end && location.end > provision.start));
const holders = (provision, entries) => holding(provision, entries).map(entry => entry.evidence_id);

// Version-change places (ADR-091). A question about what changes in an act on a day is answered from the provisions
// that differ between the version the day starts and the one it ends, and the search did not bring them: for
// "Mis muutub lastekaitseseaduses 1. jaanuaril 2027?" the candidates of the act were its final provisions, the changed
// section 29 was not among them and the selection kept an article about the bill (measured 05.10.2026, ADR-088). The
// question names no subject, so nothing in it resembles the changed provisions more than the rest of the act; which
// provisions differ is known only from comparing the versions. So the server compares them before the search and gives
// the passages that hold the differing provisions places of their own among the reranker's candidates.
// size: eight places, so two to four sections in both versions; perSide: of each version a section brings its first
// two passages that hold a differing provision; pairs: at most this many acts are compared for one turn.
// groups: an act rewritten throughout brings no more than this many groups to the search.
// places-3: when the selection keeps a passage of a group, the search adds the group's other passages (retrieval.js).
export const VERSION_CHANGE_RESERVE = Object.freeze({ version: 'rag-v2/version-change-places-3', size: 8, perSide: 2, pairs: 8, groups: 1000 });
const dayBefore = day => new Date(Date.parse(`${day}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
const bundleActKey = bundle => JSON.stringify([bundle.document.fields?.title?.value ?? null, bundle.document.fields?.authority?.value ?? null,
  bundle.document.fields?.municipality_id?.value ?? null, adopted(bundle)]);

/** The passages of two versions' differing provisions, as groups of chunk ids, one group per section: the passages
 *  that hold the section's changed provisions in the newer version and in the older one, its added provisions in the
 *  newer and its removed ones in the older (and in the newer where the number still stands there, repealed). A
 *  provision that only moved to another number is no difference. Of each version a section brings its first perSide
 *  such passages; sections held by the same passages are one group.
 *  places-2: a group was one provision's passages, and the subsections of one section overlapped. In the turn measured
 *  on 05.10.2026 an added subsection that ran over two passages of the newer version brought the section's first
 *  passage in alone; the changed subsections in it then had no place left for the older version's passage, the
 *  selection kept the newer one and nothing was compared. */
export function changedPassages(olderBundle, newerBundle, perSide = VERSION_CHANGE_RESERVE.perSide) {
  const before = actProvisions(olderBundle), after = actProvisions(newerBundle);
  if (!before.length || !after.length) return [];
  const difference = compareProvisions(before, after), byLabel = [new Map(before.map(item => [item.label, item])), new Map(after.map(item => [item.label, item]))];
  // In the newer version's reading order; a removed provision after them, in the older version's.
  const order = new Map([...before.map((item, at) => [item.label, after.length + at]), ...after.map((item, at) => [item.label, at])]);
  const sections = new Map();
  for (const label of [...difference.changed, ...difference.added, ...difference.removed].sort((a, b) => order.get(a) - order.get(b))) {
    const section = (byLabel[1].get(label) ?? byLabel[0].get(label)).section;
    if (!sections.has(section)) sections.set(section, { provisions: [], sides: [new Set(), new Set()] });
    const group = sections.get(section);
    group.provisions.push(label);
    for (const side of [0, 1]) if (byLabel[side].has(label)) for (const chunk of holding(byLabel[side].get(label), (side ? newerBundle : olderBundle).chunks)) group.sides[side].add(chunk);
  }
  const first = chunks => [...chunks].sort((a, b) => a.ordinal - b.ordinal).slice(0, perSide).map(chunk => chunk.id);
  const groups = new Map();
  for (const { provisions, sides } of sections.values()) {
    const group = { newer: first(sides[1]), older: first(sides[0]) }, key = JSON.stringify(group);
    if (!group.newer.length && !group.older.length) continue;
    if (!groups.has(key)) groups.set(key, { ...group, provisions: [] });
    groups.get(key).provisions.push(...provisions);
  }
  return [...groups.values()].sort((a, b) => order.get(a.provisions[0]) - order.get(b.provisions[0]));
}

/**
 * The version-change places of a turn: for every asked day, the acts of which the knowledge lane's kept documents hold
 * a version that starts on that day and the version that ended the day before (the same title, issuer, municipality
 * and adoption day), and the passages of the provisions that differ between the two. Nothing is loaded unless a kept
 * version starts on an asked day.
 * @param {Array<object>} rows the knowledge lane's kept directory rows (their validity and their units)
 * @param {string[]} days the single days the question asks about (YYYY-MM-DD)
 * @param {(documentIds: string[]) => Promise<Array<object>>} loadBundles the bundles of those documents, as indexed
 * @returns {Promise<{ acts: Array<object>, groups: string[][] }>} per compared act its two versions and what differs;
 *   the groups as unit ids, each the newer version's passages first
 */
export async function versionChangePlaces(rows, days, loadBundles) {
  const none = { acts: [], groups: [] }, asked = new Set(days), ends = new Set(days.map(dayBefore));
  if (!asked.size) return none;
  const validity = new Map(rows.map(row => [row.document_id, declaredValidity(row.fields)]));
  const starting = rows.filter(row => asked.has(validity.get(row.document_id)?.from)), ending = rows.filter(row => ends.has(validity.get(row.document_id)?.to));
  if (!starting.length || !ending.length) return none;
  const byDocument = new Map(rows.map(row => [row.document_id, row]));
  const bundles = (await loadBundles([...new Set([...starting, ...ending].map(row => row.document_id))].sort()))
    .filter(bundle => byDocument.get(bundle.document.id)?.version_id === bundle.version.id && adopted(bundle));
  const olderOf = new Map(bundles.filter(bundle => ends.has(validity.get(bundle.document.id).to)).map(bundle => [`${bundleActKey(bundle)}/${validity.get(bundle.document.id).to}`, bundle]));
  const acts = [], groups = [];
  for (const newer of bundles.filter(bundle => asked.has(validity.get(bundle.document.id).from)).sort((a, b) => a.document.id.localeCompare(b.document.id, 'en'))) {
    const day = validity.get(newer.document.id).from, older = olderOf.get(`${bundleActKey(newer)}/${dayBefore(day)}`);
    if (!older || older.document.id === newer.document.id || acts.length >= VERSION_CHANGE_RESERVE.pairs) continue;
    const places = changedPassages(older, newer);
    if (!places.length) continue;
    const unitOf = bundle => new Map(byDocument.get(bundle.document.id).units.map(unit => [unit.chunk_id, unit.id]));
    const [olderUnits, newerUnits] = [unitOf(older), unitOf(newer)];
    acts.push({ act: newer.document.fields.title.value, day, older: older.document.id, newer: newer.document.id, groups: places.length,
      provisions: places.reduce((count, group) => count + group.provisions.length, 0) });
    for (const place of places) {
      const group = [...place.newer.map(chunk => newerUnits.get(chunk)), ...place.older.map(chunk => olderUnits.get(chunk))].filter(Boolean);
      if (group.length && groups.length < VERSION_CHANGE_RESERVE.groups) groups.push(group);
    }
  }
  return { acts, groups };
}

/**
 * The comparisons a turn's evidence calls for: every act of which the evidence holds passages of two versions (the
 * same title, issuer, municipality and adoption day, each with its own declared start). Of more than two versions the
 * oldest and the newest in the evidence are compared.
 * @param {Array<object>} evidence the knowledge lane's evidence entries
 * @param {(documentIds: string[]) => Promise<Array<object>>} loadBundles the bundles of those documents, as indexed
 * @returns {Promise<Array<object>>} per act: its title, the two versions with their validity and evidence ids, the
 *   provisions the evidence holds with their state, and the names of the other provisions that differ
 */
export async function versionComparisons(evidence, loadBundles) {
  const acts = new Map();
  for (const entry of evidence) {
    if (entry.selection?.reason === 'structured_record') continue;
    const validity = declaredValidity(Object.fromEntries(['valid_from', 'valid_to'].map(key => [key, entry.source_metadata?.[key]])));
    if (!validity?.from || !entry.bibliography?.title) continue;
    const key = actKey(entry);
    if (!acts.has(key)) acts.set(key, new Map());
    const versions = acts.get(key);
    if (!versions.has(entry.document_id)) versions.set(entry.document_id, { document_id: entry.document_id, version_id: entry.document_version_id, valid_from: validity.from, valid_to: validity.to, entries: [] });
    versions.get(entry.document_id).entries.push(entry);
  }
  const pairs = [...acts.values()].filter(versions => versions.size > 1).map(versions => {
    const sorted = [...versions.values()].sort((a, b) => a.valid_from.localeCompare(b.valid_from) || a.document_id.localeCompare(b.document_id, 'en'));
    return { older: sorted[0], newer: sorted.at(-1) };
  }).filter(pair => pair.older.valid_from !== pair.newer.valid_from);
  if (!pairs.length) return [];
  const bundles = new Map((await loadBundles([...new Set(pairs.flatMap(pair => [pair.older.document_id, pair.newer.document_id]))])).map(bundle => [bundle.document.id, bundle]));
  const comparisons = [];
  for (const { older, newer } of pairs) {
    const [oldBundle, newBundle] = [bundles.get(older.document_id), bundles.get(newer.document_id)];
    if (oldBundle?.version.id !== older.version_id || newBundle?.version.id !== newer.version_id) continue;
    // The versions of one act share the day it was adopted. A new act that replaced an old one under the same title
    // has its own numbering: there the same number does not name the same provision, and nothing is compared.
    if (!adopted(oldBundle) || adopted(oldBundle) !== adopted(newBundle)) continue;
    const before = actProvisions(oldBundle), after = actProvisions(newBundle);
    // An act that is not read section by section (an annex, a text without sections) is not compared.
    if (!before.length || !after.length) continue;
    const difference = compareProvisions(before, after), byLabel = [new Map(before.map(item => [item.label, item])), new Map(after.map(item => [item.label, item]))];
    const held = (label, side) => (label && byLabel[side].has(label) ? holders(byLabel[side].get(label), (side ? newer : older).entries) : []);
    const states = [...difference.changed.map(label => ({ label, state: 'changed', was: label })), ...difference.added.map(label => ({ label, state: 'added', was: null })),
      ...difference.removed.map(label => ({ label, state: 'removed', was: label })), ...difference.renumbered.map(({ label, was }) => ({ label, state: 'renumbered', was })),
      ...difference.unchanged.map(label => ({ label, state: 'unchanged', was: label }))];
    const provisions = [], other = { changed: [], added: [], removed: [], renumbered: [] };
    for (const item of states) {
      // A removed provision has passages of the newer version only where its number still stands there, repealed.
      const olderIds = held(item.was, 0), newerIds = held(item.label, 1);
      if (olderIds.length || newerIds.length) provisions.push({ provision: item.label, state: item.state, ...(item.state === 'renumbered' ? { was: item.was } : {}), older: olderIds, newer: newerIds });
      else if (item.state !== 'unchanged') other[item.state].push(item.label);
    }
    // In the newer version's order; a removed provision after them, in the older version's.
    const order = new Map([...before.map((item, at) => [item.label, after.length + at]), ...after.map((item, at) => [item.label, at])]);
    provisions.sort((a, b) => order.get(a.provision) - order.get(b.provision));
    comparisons.push({ act: newer.entries[0].bibliography.title,
      older: { document_id: older.document_id, valid_from: older.valid_from, valid_to: older.valid_to, evidence: older.entries.map(entry => entry.evidence_id) },
      newer: { document_id: newer.document_id, valid_from: newer.valid_from, valid_to: newer.valid_to, evidence: newer.entries.map(entry => entry.evidence_id) },
      compared: { older: before.length, newer: after.length }, provisions,
      other: Object.fromEntries(Object.entries(other).map(([state, labels]) => [state, { count: labels.length, provisions: labels.slice(0, OTHER_LISTED) }])) });
  }
  return comparisons;
}

/** The block the model reads, with the packet's own S references in place of evidence ids: per act the two versions,
 *  the provisions of the evidence that differ (with the passages that hold each wording), the provisions of the
 *  evidence that read the same in both, and the names of the provisions that differ outside the evidence. A block over
 *  its cap first names fewer of the provisions outside the evidence, then only counts them; one still over the cap is
 *  not sent, and the turn is answered from the passages as without it. */
export function versionChangesContext(comparisons, refOf) {
  for (const named of [OTHER_LISTED, 10, 0]) {
    const block = changesBlock(comparisons, refOf, named);
    if (!block || tokenCount(JSON.stringify(block)) <= VERSION_CHANGES_TOKENS) return block;
  }
  return null;
}
function changesBlock(comparisons, refOf, named) {
  const refs = ids => [...new Set(ids.map(refOf).filter(Boolean))];
  const outside = value => { const first = value.provisions.slice(0, named); return value.count > first.length ? { count: value.count, ...(first.length ? { first } : {}) } : first; };
  const blocks = comparisons.map(item => ({ act: item.act,
    older: { valid_from: item.older.valid_from, valid_to: item.older.valid_to, refs: refs(item.older.evidence) },
    newer: { valid_from: item.newer.valid_from, valid_to: item.newer.valid_to, refs: refs(item.newer.evidence) },
    differences: item.provisions.filter(entry => entry.state !== 'unchanged').map(({ provision, state, was, older, newer }) => ({ provision, state, ...(was ? { was } : {}),
      ...(older.length ? { older: refs(older) } : {}), ...(newer.length ? { newer: refs(newer) } : {}) })),
    same_wording: item.provisions.filter(entry => entry.state === 'unchanged').map(entry => entry.provision),
    not_in_evidence: Object.fromEntries(Object.entries(item.other).filter(([, value]) => value.count).map(([state, value]) => [state, outside(value)])) }))
    .filter(block => block.older.refs.length && block.newer.refs.length);
  return blocks.length ? { version: VERSION_COMPARISON_VERSION, basis: 'the wording of each section and subsection of the two versions, compared on the server', acts: blocks } : null;
}
