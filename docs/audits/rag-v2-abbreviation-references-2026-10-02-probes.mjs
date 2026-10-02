// M3 measurement, free and read-only: acts named by abbreviation before a section ("SHS § 25 lg 2").
// 1. Census: how often such references stand in the index, by abbreviation and by kind of source, and which of them
//    name an act the index holds.
// 2. Simulation on the three hard catalogues: in the passages profile v6 selected (saved rows of the search experiment),
//    which abbreviation references name a section of an act in the index, whether that section's passage is already
//    selected, and whether adding it would bring a deciding passage that is missing now.
// No model call, no write except the report file. Run on the server from the app's scripts directory (the imports are
// relative to it): copy this file there as a temporary script, then
//   node --env-file=/etc/sotsiaalai/frontend.env --env-file=/etc/sotsiaalai/rag.env --import ./scripts/register-node-source-loader.mjs \n//     scripts/<copy>.mjs <report.json> <eval-files directory with graph-v6b-hard-{1,2,3}>
// and remove the copy.
import fs from 'node:fs/promises';
import pg from 'pg';
import { PostgresCatalog } from '../lib/rag-v2/search/postgres.js';
import { actSections, provisionChunks, resolveSection, keepsSuperscripts } from '../lib/rag-v2/search/legal-references.js';
import { tokenCount } from '../lib/rag-v2/search/embedding.js';

const tenant = 'sotsiaalai-corpus', out = process.argv[2], evalFiles = process.argv[3];
// The national acts the index holds, by the abbreviations texts use for them.
const KNOWN = { SHS: 'Sotsiaalhoolekande seadus', LasteKS: 'Lastekaitseseadus', LaKS: 'Lastekaitseseadus', LKS: 'Lastekaitseseadus', PKS: 'Perekonnaseadus',
  HMS: 'Haldusmenetluse seadus', SÜS: 'Sotsiaalseadustiku üldosa seadus', RLS: 'Riigilõivuseadus' };
const FULL = { 'Sotsiaalhoolekande seadus': /sotsiaalhoolekande\s+seaduse/iu, Lastekaitseseadus: /lastekaitseseaduse/iu, Perekonnaseadus: /perekonnaseaduse/iu,
  'Haldusmenetluse seadus': /haldusmenetluse\s+seaduse/iu, 'Sotsiaalseadustiku üldosa seadus': /sotsiaalseadustiku\s+üldosa\s+seaduse/iu, Riigilõivuseadus: /riigilõivuseaduse/iu };
// An abbreviation (at least two capitals, 2-10 letters, an optional case ending) directly before a section mark and number.
const ABBR = /(?<![\p{L}\p{N}])((?=\p{L}*\p{Lu}\p{L}*\p{Lu})\p{Lu}\p{L}{1,9})(?:-?(?:i|s|is|st|le|ga))?\s*§{1,2}\s*-?(?:des|de|s|i)?\s*(\d{1,3})([¹²³⁴⁵⁶⁷⁸⁹⁰]*)(?:\s*(?:lg|lõige|lõike|lõikes|lõiget|lõigete|lõigetes)\.?\s*(\d{1,2})([¹²³⁴⁵⁶⁷⁸⁹⁰]*))?/gu;
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const plainSup = text => [...text].map(char => SUP.indexOf(char)).join('');
const references = text => [...text.matchAll(ABBR)].map(found => ({ abbreviation: found[1], base: found[2], superscript: found[3] || '',
  subsection: found[4] ? found[4] + (found[5] ? `^${plainSup(found[5])}` : '') : null, at: found.index, text: found[0] }));

const client = new pg.Client({ connectionString: process.env.RAG_V2_POSTGRES_URL });
await client.connect();
const postgres = new PostgresCatalog(process.env.RAG_V2_POSTGRES_URL);
const report = {};
try {
  await postgres.inheritVerified({ keep: false }).catch(() => 0);
  const generation = await postgres.active(tenant);
  const directory = (await client.query(`SELECT document_id, version_id, retrieval_directory->'fields' AS fields, retrieval_directory->'source' AS source
    FROM rag_v2_generation_document WHERE tenant=$1 AND generation_id=$2`, [tenant, generation.id])).rows;
  const value = field => field && typeof field === 'object' && 'value' in field ? field.value : field;
  const kindOf = row => row.source?.record_kind ? `record_${row.source.record_kind}` : row.source?.journal ? 'journal'
    : value(row.fields?.valid_from) ? ((value(row.fields?.regions) || []).length ? 'law_municipal' : 'law_national') : 'guidance_or_report';
  const docs = new Map(directory.map(row => [row.document_id, { kind: kindOf(row), version: row.version_id, from: value(row.fields?.valid_from) ?? null, to: value(row.fields?.valid_to) ?? null }]));
  const units = (await client.query(`SELECT u.document_id, u.chunk_id, u.title, u.body FROM rag_v2_version_unit u
    JOIN rag_v2_generation_document d ON d.tenant=u.tenant AND d.version_id=u.version_id AND d.document_id=u.document_id
    WHERE u.tenant=$1 AND d.generation_id=$2 AND u.config_id=(SELECT config->>'id' FROM rag_v2_generation WHERE tenant=$1 AND id=$2)`, [tenant, generation.id])).rows;
  for (const unit of units) if (docs.has(unit.document_id)) docs.get(unit.document_id).title = unit.title;
  const byChunk = new Map(units.map(unit => [unit.chunk_id, unit]));

  // ---- 1. Census ----
  const kinds = {}, abbreviations = new Map(), known = {}, full = {}, examples = [], defined = new Map();
  for (const doc of docs.values()) { kinds[doc.kind] ??= { documents: 0, units: 0, references: 0, documents_with: new Set(), known_references: 0, known_documents: new Set() }; kinds[doc.kind].documents++; }
  for (const unit of units) {
    const doc = docs.get(unit.document_id); if (!doc) continue;
    const kind = kinds[doc.kind]; kind.units++;
    for (const [title, pattern] of Object.entries(FULL)) {
      const count = [...unit.body.matchAll(new RegExp(`${pattern.source}(?:\\s*\\([^)]{0,80}\\))?\\s*§`, 'giu'))].length;
      if (count) { full[title] ??= {}; full[title][doc.kind] = (full[title][doc.kind] || 0) + count; }
    }
    for (const found of unit.body.matchAll(/\(edaspidi(?:\s+ka)?\s*[:–-]?\s*((?=\p{L}*\p{Lu}\p{L}*\p{Lu})\p{Lu}\p{L}{1,9})\)/gu)) {
      if (KNOWN[found[1]]) { if (!defined.has(found[1])) defined.set(found[1], new Set()); defined.get(found[1]).add(unit.document_id); }
    }
    for (const reference of references(unit.body)) {
      kind.references++; kind.documents_with.add(unit.document_id);
      const entry = abbreviations.get(reference.abbreviation) || { count: 0, documents: new Set(), kinds: {} };
      entry.count++; entry.documents.add(unit.document_id); entry.kinds[doc.kind] = (entry.kinds[doc.kind] || 0) + 1; abbreviations.set(reference.abbreviation, entry);
      const act = KNOWN[reference.abbreviation];
      if (!act) continue;
      // The act itself naming its own abbreviation is not a reference to another document.
      const own = doc.title === act;
      known[act] ??= { references: 0, own_act: 0, by_kind: {}, documents: new Set() };
      if (own) { known[act].own_act++; continue; }
      kind.known_references++; kind.known_documents.add(unit.document_id);
      known[act].references++; known[act].documents.add(unit.document_id); known[act].by_kind[doc.kind] = (known[act].by_kind[doc.kind] || 0) + 1;
      if (examples.filter(item => item.kind === doc.kind).length < 4) examples.push({ kind: doc.kind, title: doc.title, reference: reference.text,
        context: unit.body.slice(Math.max(0, reference.at - 70), reference.at + reference.text.length + 50).replace(/\s+/gu, ' ') });
    }
  }
  report.census = { generation: generation.id, documents: docs.size, units: units.length,
    by_kind: Object.fromEntries(Object.entries(kinds).map(([kind, row]) => [kind, { documents: row.documents, units: row.units, abbreviation_references: row.references,
      documents_with_any: row.documents_with.size, references_to_acts_in_index: row.known_references, documents_with_those: row.known_documents.size }])),
    abbreviations: [...abbreviations].sort((a, b) => b[1].count - a[1].count).slice(0, 40).map(([abbreviation, row]) => ({ abbreviation, count: row.count, documents: row.documents.size,
      in_index: KNOWN[abbreviation] || null, kinds: row.kinds })),
    distinct_abbreviations: abbreviations.size, total_references: [...abbreviations.values()].reduce((sum, row) => sum + row.count, 0),
    acts_in_index: Object.fromEntries(Object.entries(known).map(([act, row]) => [act, { references: row.references, documents: row.documents.size, in_the_act_itself: row.own_act, by_kind: row.by_kind,
      documents_that_define_the_abbreviation: [...defined].filter(([abbreviation]) => KNOWN[abbreviation] === act).reduce((sum, [, set]) => sum + [...set].filter(doc => row.documents.has(doc)).length, 0),
      full_name_references_by_kind: full[act] || {} }])),
    examples };

  // ---- 2. Simulation on the hard catalogues ----
  const versionOn = (title, date) => [...docs].filter(([, doc]) => doc.kind === 'law_national' && doc.title === title && doc.from && doc.from <= date && (!doc.to || doc.to >= date)).map(([id]) => id);
  const acts = new Map();
  const actOf = async documentId => {
    if (!acts.has(documentId)) {
      const [bundle] = await postgres.bundles(tenant, generation.id, [documentId]);
      const chunks = [...bundle.chunks].sort((a, b) => a.ordinal - b.ordinal);
      acts.set(documentId, { bundle, chunks, sections: actSections(chunks) });
    }
    return acts.get(documentId);
  };
  const versions = new Map();
  const exactOf = async documentId => {
    if (!versions.has(documentId)) versions.set(documentId, keepsSuperscripts((await postgres.bundles(tenant, generation.id, [documentId]))[0].version));
    return versions.get(documentId);
  };
  report.simulation = { arm: 'O (chat profile v6, no reranker)', catalogues: [] };
  for (const n of [1, 2, 3]) {
    const catalogue = JSON.parse(await fs.readFile(`tests/evaluation/graph/hard-conditions-${n}.json`, 'utf8'));
    const saved = JSON.parse(await fs.readFile(`${evalFiles}/graph-v6b-hard-${n}/graph-experiment.json`, 'utf8'));
    const rows = [];
    for (const question of catalogue.questions) {
      const row = saved.rows.find(item => item.arm === 'O' && item.question === question.id);
      if (!row) continue;
      const selected = new Set(row.selected), found = [];
      const missing = question.evidence_text.filter(phrase => !row.selected.some(chunk => (byChunk.get(chunk)?.body || '').replace(/\s+/gu, ' ').includes(phrase.replace(/\s+/gu, ' '))));
      for (const chunkId of row.selected) {
        const unit = byChunk.get(chunkId); if (!unit) continue;
        const pointing = docs.get(unit.document_id);
        for (const reference of references(unit.body)) {
          const act = KNOWN[reference.abbreviation];
          const item = { from: pointing?.title, from_kind: pointing?.kind, reference: reference.text, act: act || null };
          if (!act) { found.push({ ...item, outcome: 'act_not_in_index' }); continue; }
          if (pointing?.title === act) { found.push({ ...item, outcome: 'own_act' }); continue; }
          const inForce = versionOn(act, catalogue.date);
          if (inForce.length !== 1) { found.push({ ...item, outcome: `versions_in_force_${inForce.length}` }); continue; }
          const target = await actOf(inForce[0]), exact = await exactOf(unit.document_id);
          const key = resolveSection(reference.base, reference.superscript, target.sections, exact);
          if (!key) { found.push({ ...item, outcome: 'section_not_resolved', exact_numbers: exact }); continue; }
          const passages = provisionChunks(target.bundle, target.chunks, key, reference.subsection, { exactNumbers: exact });
          const added = passages.filter(chunk => !selected.has(chunk.id));
          const texts = added.map(chunk => (byChunk.get(chunk.id)?.body || chunk.source_text || '').replace(/\s+/gu, ' '));
          found.push({ ...item, section: key, subsection: reference.subsection, outcome: added.length ? 'would_add' : 'already_selected', passages: passages.length, added: added.length,
            added_tokens: texts.reduce((sum, text) => sum + tokenCount(text), 0),
            brings_missing: missing.filter(phrase => texts.some(text => text.includes(phrase.replace(/\s+/gu, ' ')))).length });
          for (const chunk of added) selected.add(chunk.id);
        }
      }
      rows.push({ question: question.id, kind: question.kind, found_all: row.found_all, missing_phrases: missing.length, selected: row.selected.length, references: found });
    }
    report.simulation.catalogues.push({ catalogue: `hard-conditions-${n}`, date: catalogue.date, questions: rows.length, rows });
  }
  const all = report.simulation.catalogues.flatMap(item => item.rows), refs = all.flatMap(row => row.references);
  const count = outcome => refs.filter(item => item.outcome === outcome).length;
  report.simulation.summary = { questions: all.length, found_all_now: all.filter(row => row.found_all).length, questions_with_any_abbreviation_reference: all.filter(row => row.references.length).length,
    references: refs.length, act_not_in_index: count('act_not_in_index'), own_act: count('own_act'), section_not_resolved: count('section_not_resolved'),
    already_selected: count('already_selected'), would_add: count('would_add'), questions_with_an_addition: all.filter(row => row.references.some(item => item.outcome === 'would_add')).length,
    added_tokens: refs.reduce((sum, item) => sum + (item.added_tokens || 0), 0), additions_that_bring_a_missing_phrase: refs.filter(item => item.brings_missing > 0).length,
    questions_not_found_now: all.filter(row => !row.found_all).map(row => ({ question: row.question, references: row.references.map(item => `${item.reference} → ${item.outcome}`) })) };
  await fs.writeFile(out, JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ census: { units: report.census.units, total_references: report.census.total_references, distinct: report.census.distinct_abbreviations, by_kind: report.census.by_kind,
    top: report.census.abbreviations.slice(0, 25).map(row => `${row.abbreviation}:${row.count}/${row.documents}${row.in_index ? '*' : ''}`), acts_in_index: report.census.acts_in_index },
  simulation: report.simulation.summary }, null, 1));
} finally { await client.end(); await postgres.close(); }
