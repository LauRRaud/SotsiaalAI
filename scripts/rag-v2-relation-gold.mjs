#!/usr/bin/env node
// ADR-063 (M3): a provision-level gold set of the pointers an act's own text makes, read with no model: to another
// section, to a subsection of the same section ("käesoleva paragrahvi lõikes 2") and to a named other act, each with
// whether its sentence carries an exception phrase, plus the right-denying provisions nothing points at or from. The
// acts are ingested from the registry into a temporary store, so a provision's passage is the one the index holds.
// Beside each stratum: how many of its cross-passage links the model's cards (ADR-054) relate. No network, no model.
//   node --import ./scripts/register-node-source-loader.mjs scripts/rag-v2-relation-gold.mjs \
//     [--acts 130062026065,106072023031,…] [--input-root Andmebaasi] [--out tests/evaluation/graph/relation-gold-1.json]
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { hash, stable } from '../lib/rag-v2/contracts.js';
import { ingest } from '../lib/rag-v2/ingestion.js';
import { registeredSource } from '../lib/rag-v2/registered-source.js';
import { actSections, chunkSection, readReferences, keepsSuperscripts } from '../lib/rag-v2/search/legal-references.js';

// The acts in force on 2026-10-15 that the hard catalogues name: SHS, HMS, SÜS, LasteKS, PKS, the assistive devices
// regulation and Harku's welfare procedure.
export const GOLD_ACTS = Object.freeze(['130062026065', '106072023031', '130062026031', '111072026042', '107052025017', '126092026005', '404072025017']);
// An act named in words, for the acts in scope; any other named act stays unresolved.
const NAMED_ACTS = Object.freeze([[/sotsiaalhoolekande\s+seadus/u, '130062026065'], [/haldusmenetluse\s+seadus/u, '106072023031'],
  [/sotsiaalseadustiku\s+üldosa\s+seadus/u, '130062026031'], [/lastekaitseseadus/u, '111072026042'], [/perekonnaseadus/u, '107052025017']]);
const SUPERSCRIPTS = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };
const SUP = '[⁰¹²³⁴⁵⁶⁷⁸⁹]';
const plain = text => text.replace(new RegExp(`${SUP}+`, 'gu'), found => `^${[...found].map(char => SUPERSCRIPTS[char]).join('')}`);
// A rule that denies a right or a payment, and the phrases that make a sentence an exception.
const DENIAL = /\bei\s+(?:määrata|maksta|ole\s+õigust|osutata|hüvitata|võeta\s+üle|arvata|loeta|kohaldata|laiene|tohi|või(?:\s|$)|anta|rahuldata|jätkata)/iu;
const EXCEPTION = /välja arvatud|erandina|erandjuhul|erandkorras|erinevalt|ei kohaldata|ei laiene|arvestamata/iu;
const NUMBERS = `((?:\\d+${SUP}*)(?:\\s*(?:,|ja|ning|või|[–-])\\s*\\d+${SUP}*)*)`;
const SUBSECTIONS = new RegExp(`(?:lõi\\p{L}*|lg\\.?)\\s*${NUMBERS}`, 'gu');
const OWN_SECTION = new RegExp(`käesoleva\\s+paragrahvi\\s+lõi\\p{L}*\\s*${NUMBERS}`, 'giu');
// "2, 3 ja 5" names each; a range of plain numbers ("2–4") names every number in it, one with a superscript end
// ("2–4²") only its two ends, since the subsections between them are not known from the numbers.
const listed = numbers => numbers.split(/\s*(?:,|ja|ning|või)\s*/u).flatMap(part => {
  const [from, to] = part.split(/\s*[–-]\s*/u);
  if (to === undefined) return [plain(from)];
  return /^\d+$/u.test(from) && /^\d+$/u.test(to) && Number(to) > Number(from) && Number(to) - Number(from) <= 30
    ? Array.from({ length: Number(to) - Number(from) + 1 }, (_, index) => String(Number(from) + index)) : [plain(from), plain(to)];
});
const sentenceBefore = (text, at) => text.slice(Math.max(0, text.lastIndexOf('.', at) + 1), at);
const words = (text, at, end) => text.slice(Math.max(0, at - 60), Math.min(text.length, end + 40)).replace(/\s+/gu, ' ').trim();

/** Ingests registered act XMLs into a temporary store and returns their bundles by act ID. */
export async function actBundles(acts, inputRoot) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-relation-gold-'));
  try {
    await fs.mkdir(path.join(root, 'oigusaktid')); await fs.mkdir(path.join(root, 'register'));
    const entries = [];
    for (const act of acts) {
      const bytes = await fs.readFile(path.join(inputRoot, 'oigusaktid', `${act}.xml`));
      await fs.writeFile(path.join(root, 'oigusaktid', `${act}.xml`), bytes);
      entries.push({ role: 'source', path: `oigusaktid/${act}.xml`, sha256: hash(bytes) });
    }
    const register = JSON.stringify({ entries: [] });
    await fs.writeFile(path.join(root, 'register', 'kov.json'), register);
    await fs.writeFile(path.join(root, 'REGISTER.json'), JSON.stringify({ entries: [{ role: 'source_register', path: 'register/kov.json', sha256: hash(register) }, ...entries] }));
    const bundles = new Map();
    for (const entry of entries) {
      const { bundle } = await ingest({ tenant: 'relation-gold', inputRoot: root, metadataJson: stable(await registeredSource(root, entry)), storeRoot: path.join(root, 'store'),
        rights: { access: 'local_private', usage: 'development_only' }, profile: { id: 'generic-fixtures', version: '1', months: [], categoryLabels: [] } });
      bundles.set(path.basename(entry.path, '.xml'), bundle);
    }
    return bundles;
  } finally { await fs.rm(root, { recursive: true, force: true }); }
}

/** An act's provisions (every numbered subsection of every section; a section without them is one provision), each with
 *  the passage (chunk ordinal) that holds its start. */
export function actProvisions(bundle) {
  const sectionOf = bundle.chunks.map(chunkSection), spans = new Map(bundle.spans.map(span => [span.id, span]));
  const passageAt = (unit, position) => bundle.chunks.findIndex(chunk => chunk.span_ids.some(key => { const span = spans.get(key); return span.source_unit_index === unit && span.start <= position && position < span.end; }));
  const units = new Map();
  bundle.chunks.forEach((chunk, index) => { if (sectionOf[index] && !units.has(sectionOf[index])) units.set(sectionOf[index], spans.get(chunk.span_ids[0]).source_unit_index); });
  const provisions = [];
  for (const [section, unit] of units) {
    const raw = bundle.source_units[unit].raw_text, marks = [...raw.matchAll(new RegExp(`(?:^|\\n)\\((\\d+${SUP}*)\\)\\s*(?=\\n|$)`, 'gu'))];
    if (!marks.length) { provisions.push({ section, subsection: null, unit, start: 0, end: raw.length, text: raw }); continue; }
    marks.forEach((mark, index) => {
      const start = mark.index + mark[0].length, end = index + 1 < marks.length ? marks[index + 1].index : raw.length;
      provisions.push({ section, subsection: plain(mark[1]), unit, start, end, text: raw.slice(start, end) });
    });
  }
  for (const provision of provisions) {
    provision.id = `${provision.section}/${provision.subsection}`;
    provision.passage = passageAt(provision.unit, Math.min(provision.end - 1, provision.start + 3));
  }
  return provisions;
}

/** The gold links and denials of one act, the reader's report, and where the model's cards stand on each stratum. */
export function actGold(act, bundle, knowledge = { cards: [], dependencies: [] }) {
  const provisions = actProvisions(bundle), byId = new Map(provisions.map(provision => [provision.id, provision]));
  const sections = actSections(bundle.chunks), exactNumbers = keepsSuperscripts(bundle.version);
  const links = [], report = { marks: 0, own: 0, other_act: 0, own_section: 0, unresolved: {} };
  for (const provision of provisions) {
    const { text } = provision, read = readReferences(text, sections, { exactNumbers });
    report.marks += (text.match(/§/gu) || []).length;
    for (const miss of read.unresolved) report.unresolved[miss.reason] = (report.unresolved[miss.reason] || 0) + 1;
    for (const reference of read.references) {
      if (reference.key === provision.section) continue;
      report.own++;
      const subsections = reference.unit ? [...reference.unit.matchAll(SUBSECTIONS)].flatMap(found => listed(found[1])) : [];
      for (const subsection of subsections.length ? subsections : [null]) {
        links.push({ class: 'other_section', from: provision.id, to: `${reference.key}/${subsection}`, to_section: reference.key,
          exception: EXCEPTION.test(sentenceBefore(text, reference.at)), words: words(text, reference.at, reference.at + 12) });
      }
    }
    for (const found of text.matchAll(OWN_SECTION)) {
      report.own_section++;
      for (const subsection of listed(found[1])) {
        links.push({ class: 'own_section', from: provision.id, to: `${provision.section}/${subsection}`, to_section: provision.section,
          exception: EXCEPTION.test(sentenceBefore(text, found.index)), words: words(text, found.index, found.index + found[0].length) });
      }
    }
    for (const list of read.other) {
      report.other_act++;
      const named = sentenceBefore(text, list.at).toLocaleLowerCase('et'), target = NAMED_ACTS.findLast(([pattern]) => pattern.test(named));
      links.push({ class: 'other_act', from: provision.id, to_act: target && target[1] !== act ? target[1] : null, list: text.slice(list.at, list.end).replace(/\s+/gu, ' '),
        exception: EXCEPTION.test(sentenceBefore(text, list.at)), words: words(text, list.at, list.end) });
    }
  }
  const unique = [...new Map(links.map(link => [`${link.class}>${link.from}>${link.to ?? `${link.to_act}:${link.list}`}`, link])).values()];
  for (const link of unique) {
    link.from_passage = byId.get(link.from).passage;
    if (link.class === 'other_act') continue;
    const target = byId.get(link.to) || (link.to.endsWith('/null') ? provisions.find(provision => provision.section === link.to_section) : null);
    link.to_passage = target ? target.passage : null;
    link.cross_passage = target ? target.passage !== link.from_passage : null;
    // The live reader adds the first passage of a referenced section (retrieval.js): a subsection further on is missed.
    link.in_first_passage = target ? target.passage === provisions.find(provision => provision.section === link.to_section).passage : null;
  }
  // Right-denying provisions nothing points at or from, at subsection level.
  const pointedAt = new Set(unique.filter(link => link.to_passage != null).map(link => (byId.has(link.to) ? link.to : byId.get(`${link.to_section}/null`)?.id ?? link.to)));
  const pointsFrom = new Set(unique.map(link => link.from));
  const denials = provisions.filter(provision => DENIAL.test(provision.text.slice(0, 400)) && !pointsFrom.has(provision.id) && !pointedAt.has(provision.id))
    .map(provision => ({ provision: provision.id, passage: provision.passage, words: provision.text.replace(/\s+/gu, ' ').trim().slice(0, 110) }));
  // The model's cards: the provision each card is anchored in, and the provision pairs its relations join (either way).
  const cardProvision = new Map();
  for (const card of knowledge.cards) {
    const anchor = card.anchors[0], start = anchor.start ?? bundle.source_units[anchor.source_unit_index].raw_text.indexOf(anchor.quote);
    const provision = provisions.find(item => item.unit === anchor.source_unit_index && item.start <= start && start < item.end) || provisions.find(item => item.unit === anchor.source_unit_index);
    cardProvision.set(card.key, provision?.id ?? null);
  }
  const related = new Set(), inRelation = new Set();
  for (const dependency of knowledge.dependencies) for (const target of dependency.targets) {
    const [from, to] = [cardProvision.get(dependency.from), cardProvision.get(target.key)];
    related.add(`${from}>${to}`); related.add(`${to}>${from}`); inRelation.add(from); inRelation.add(to);
  }
  const stratum = selected => {
    const located = selected.filter(link => link.to_passage != null), cross = located.filter(link => link.cross_passage);
    return { links: selected.length, located: located.length, cross_passage: cross.length, outside_first_passage: located.filter(link => !link.in_first_passage).length,
      cross_passage_with_card_relation: cross.filter(link => related.has(`${link.from}>${byId.has(link.to) ? link.to : byId.get(`${link.to_section}/null`)?.id ?? link.to}`)).length };
  };
  const of = (kind, exception) => unique.filter(link => link.class === kind && (!exception || link.exception));
  return { act, title: bundle.document.fields.title.value, normalization: bundle.version.processing_config.normalization, provisions: provisions.length, passages: bundle.chunks.length,
    cards: knowledge.cards.length, card_relations: knowledge.dependencies.reduce((sum, dependency) => sum + dependency.targets.length, 0), reader: report,
    counts: { other_section: stratum(of('other_section')), other_section_exception: stratum(of('other_section', true)), own_section: stratum(of('own_section')),
      own_section_exception: stratum(of('own_section', true)), other_act: { links: of('other_act').length, resolved: of('other_act').filter(link => link.to_act).length },
      denials: { provisions: denials.length, with_card_relation: denials.filter(denial => inRelation.has(denial.provision)).length } },
    links: unique, denials };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { acts: { type: 'string' }, 'input-root': { type: 'string', default: 'Andmebaasi' }, out: { type: 'string', default: 'tests/evaluation/graph/relation-gold-1.json' } } });
  const acts = values.acts ? values.acts.split(',') : GOLD_ACTS, bundles = await actBundles(acts, values['input-root']), gold = [];
  for (const act of acts) {
    const file = path.join(values['input-root'], 'teadmised', `${act}.knowledge.json`);
    const knowledge = JSON.parse(await fs.readFile(file, 'utf8').catch(() => '{"knowledge":{"cards":[],"dependencies":[]}}')).knowledge;
    gold.push(actGold(act, bundles.get(act), knowledge));
  }
  await fs.writeFile(values.out, `${JSON.stringify({ schema_version: 'rag-v2/relation-gold-1', purpose: 'Pointers the acts make in their own words, at subsection level, read with no model (ADR-063).', acts: gold }, null, 1)}\n`);
  for (const item of gold) console.log(JSON.stringify({ act: item.act, title: item.title.slice(0, 40), provisions: item.provisions, reader: item.reader, counts: item.counts }));
}
