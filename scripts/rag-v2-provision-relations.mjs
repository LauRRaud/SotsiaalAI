#!/usr/bin/env node
// ADR-145 (11.10.2026): how many passages of the corpus name a provision of a law the corpus holds, counted with the
// same rules the search follows them by (lib/rag-v2/search/provision-relations.js). The relations are read from the
// text and stored nowhere, so this count is how the corpus's relations are seen: after an increment it tells how many
// of the new documents point at a law, by which written form, and what was left out and why.
//   node scripts/rag-v2-provision-relations.mjs --store tmp/rag-v2-corpus-store-v25 --policy <policy.json> [--tenant sotsiaalai-corpus] [--date YYYY-MM-DD] [--out report.json]
// Local and free: it reads the store's bundles and writes nothing but --out; model calls 0, embedding calls 0. It prints
// counts, the laws' titles and the written forms of their names: no passage's text and no document's title.
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { id } from '../lib/rag-v2/contracts.js';
import { readJson } from '../lib/rag-v2/catalog.js';
import { actGenitive, actSections, keepsSuperscripts, provisionMentions, sectionSubsections } from '../lib/rag-v2/search/legal-references.js';
import { declaredValidity, estonianDate, validityState } from '../lib/rag-v2/search/legal-validity.js';
import { LEFT_OUT, RELATION_VERSION, dayRefusal, followableNames, passageRelations, relationSection } from '../lib/rag-v2/search/provision-relations.js';
import ACT_ABBREVIATIONS from '../lib/rag-v2/search/act-abbreviations.json' with { type: 'json' };

const spaced = text => String(text ?? '').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('et');
const value = (fields, name) => fields?.[name]?.value ?? null;
// A national legal text has a validity start and no region (as the search's named-acts rule reads the scope).
const national = fields => Boolean(value(fields, 'valid_from')) && !(Array.isArray(value(fields, 'regions')) && value(fields, 'regions').length);
/** The group a document is counted in: an indexed law, another national or a municipal act, or its declared source type. */
export function documentGroup(fields) {
  if (national(fields) && Object.hasOwn(ACT_ABBREVIATIONS.abbreviations, value(fields, 'title'))) return 'law';
  return value(fields, 'valid_from') ? (national(fields) ? 'national_act' : 'municipal_act') : String(value(fields, 'source_type') ?? 'unknown');
}
// How a law was named: its title in the genitive (the one form the search read before ADR-145), that genitive joined
// or split otherwise, the title as it stands, or the abbreviation.
function writtenForm(named, title) {
  return named === actGenitive(title) ? 'genitive' : named === spaced(title) ? 'title' : named === ACT_ABBREVIATIONS.abbreviations[title] ? 'abbreviation' : 'genitive_other_spelling';
}

/**
 * The count. bundles: an iterable (sync or async) of a source's { document: { fields }, version, chunks }; date: the
 * day whose versions in force are the acts a reference leads to. A law is one of the table (act-abbreviations.json);
 * a title with no version, or two, in force that day is followed by none, as in a search.
 */
export async function relationReport(bundles, { date }) {
  const titles = Object.keys(ACT_ABBREVIATIONS.abbreviations), known = followableNames(titles.map(title => [title, title]));
  const versions = new Map(titles.map(title => [title, []])), groups = {}, read = [];
  const group = name => (groups[name] ??= { documents: 0, passages: 0, passages_with_a_list: 0, lists: 0 });
  let index = 0;
  for await (const bundle of bundles) {
    const fields = bundle.document.fields, name = documentGroup(fields), row = group(name), title = value(fields, 'title'), document = index++;
    const chunks = [...bundle.chunks].sort((a, b) => a.ordinal - b.ordinal);
    row.documents++; row.passages += chunks.length;
    if (name === 'law') {
      let sections = []; try { sections = actSections(chunks); } catch { sections = []; }
      versions.get(title).push({ fields, sections, state: validityState(declaredValidity(fields) ?? {}, date), subsectionsOf: key => sectionSubsections(bundle, chunks, key) });
    }
    const exact = keepsSuperscripts(bundle.version);
    for (const [passage, chunk] of chunks.entries()) {
      if (!chunk.source_text.includes('§')) continue;
      const lists = new Set(provisionMentions(chunk.source_text, { headings: false }).map(item => item.start)).size;
      if (!lists) continue;
      row.passages_with_a_list++; row.lists += lists;
      const relations = passageRelations(chunk.source_text, known).filter(relation => !(name === 'law' && relation.act === title));
      for (const relation of relations) read.push({ group: name, document, passage, fields, exact, title: relation.act, form: writtenForm(relation.named, relation.act), relation });
    }
  }
  const current = new Map([...versions].map(([title, list]) => [title, list.filter(version => version.state === 'in_force')]));
  const count = (object, key) => { object[key] = (object[key] || 0) + 1; };
  const result = {};
  for (const item of read) {
    const row = (result[item.group] ??= { references: 0, followed: 0, followed_by_form: {}, left_out: {}, passages: new Map(), targets: {} });
    const act = current.get(item.title);
    row.references++;
    const reason = act.length !== 1 ? 'act_not_one_in_force' : dayRefusal(item.fields, act[0].fields) ?? relationSection(item.relation, act[0].sections, item.exact, act[0].subsectionsOf).reason ?? null;
    if (reason) { count(row.left_out, reason); continue; }
    row.followed++; count(row.followed_by_form, item.form); count(row.targets, item.title);
    const key = `${item.document}:${item.passage}`;
    row.passages.set(key, (row.passages.get(key) ?? true) && item.form !== 'genitive');
  }
  const sorted = object => Object.fromEntries(Object.entries(object).sort((a, b) => b[1] - a[1]));
  for (const [name, row] of Object.entries(groups)) {
    const found = result[name];
    if (!found) continue;
    const documents = new Set([...found.passages.keys()].map(key => key.split(':')[0])), genitive = new Set([...found.passages].filter(([, other]) => !other).map(([key]) => key.split(':')[0]));
    Object.assign(row, { references: found.references, followed: found.followed, followed_by_form: sorted(found.followed_by_form), left_out: sorted(found.left_out),
      passages_with_a_relation: found.passages.size, passages_without_the_genitive_form: [...found.passages.values()].filter(Boolean).length,
      documents_with_a_relation: documents.size, documents_without_the_genitive_form: documents.size - genitive.size, laws_pointed_at: sorted(found.targets) });
  }
  return { schema_version: RELATION_VERSION, date, left_out_reasons: [...LEFT_OUT, 'act_not_one_in_force'],
    laws: { in_table: titles.length, one_version_in_force: [...current.values()].filter(list => list.length === 1).length, without_sections: [...current].filter(([, list]) => list.length === 1 && !list[0].sections.length).map(([title]) => title) },
    groups: Object.fromEntries(Object.entries(groups).sort((a, b) => (b[1].followed ?? 0) - (a[1].followed ?? 0))) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { store: { type: 'string' }, policy: { type: 'string' }, tenant: { type: 'string', default: 'sotsiaalai-corpus' }, date: { type: 'string' }, out: { type: 'string' } } });
  if (!values.store || !values.policy) { console.error('usage: --store <dir> --policy <policy.json> [--tenant <id>] [--date YYYY-MM-DD] [--out report.json]'); process.exit(2); }
  const dir = path.resolve(values.store, id('tenant', values.tenant)), active = await readJson(path.join(dir, 'active.json'));
  const documents = (await readJson(values.policy)).tenants?.[values.tenant]?.operator ?? [];
  // The bundle file as it is stored: this count reads text and fields, and verifies no hash (a search does).
  async function* bundles() { for (const document of documents) if (active.documents[document]) yield await readJson(path.join(dir, 'versions', active.documents[document].version_id, 'bundle.json')); }
  const report = { ...await relationReport(bundles(), { date: values.date ?? estonianDate() }), policy_documents: documents.length, missing_in_store: documents.filter(document => !active.documents[document]).length };
  if (values.out) await fs.writeFile(values.out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}
