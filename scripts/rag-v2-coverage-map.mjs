// The coverage map of the RAG corpus on the server: for typical life situations of help-seekers and work themes of a
// social work specialist (rows) against the kinds of help a person needs (columns), how much the active corpus holds,
// counted by the text of its passages and told apart by the kind of source. Read-only: no model call, no embedding
// request, nothing is written to a database. Grid and counting rules: scripts/lib/rag-v2-coverage-grid.json and
// scripts/lib/rag-v2-coverage-map.mjs; the report of 08.10.2026: docs/audits/rag-v2-coverage-map-2026-10-08.md.
//
// Run on the server against the live release (the free runner replaces nothing when its directory is empty):
//   sh /home/ubuntu/rag-v2-work/ov2-run.sh w4-empty scripts/rag-v2-coverage-map.mjs --out <directory> [--probe]
//     [--turns [--turns-until <ISO time>]] [--grid <grid.json>] [--titles 8] [--tenant sotsiaalai-corpus]
// --probe  for every row's opening sentence, what the word search alone (no vector search, no search plan) puts first
//          among the documents that are not a municipality's own.
// --turns  for the stored turns of the test account: in how many turns on a row's subject a guidance document about
//          the row was among the candidates, kept by the selection, in the evidence and cited. Counts only: no
//          question, answer or passage text is printed or written. Turns are read only while the application has
//          one account (the test account); with more accounts --turns-until <ISO time> must name a moment up to
//          which it had one, and later turns are left unread.
// Writes <out>/coverage-map.json (numbers and document titles; a contact's or a form's title is never read) and
// <out>/coverage-map.md (the tables, numbers only). Contacts and forms are not counted.
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { PostgresCatalog } from '../lib/rag-v2/search/postgres.js';
import { VERSION_LAYOUT } from '../lib/rag-v2/search/layout.js';
import { withoutStopwords } from '../lib/rag-v2/search/query-stopwords.js';
import { LEXICAL_RANK_PLAIN } from '../lib/rag-v2/search/ranking.js';
import { compileGrid, documentKind, documentTally, passageMarks, addPassage, tallyGrid, isAbout, countsForCell, markdownTable, normalise, publishedBy, KINDS, NOT_COUNTED } from './lib/rag-v2-coverage-map.mjs';

const { values } = parseArgs({ options: { out: { type: 'string' }, grid: { type: 'string' }, titles: { type: 'string', default: '8' }, tenant: { type: 'string', default: 'sotsiaalai-corpus' },
  probe: { type: 'boolean', default: false }, turns: { type: 'boolean', default: false }, 'turns-until': { type: 'string' } } });
if (!values.out || (values['turns-until'] && Number.isNaN(Date.parse(values['turns-until'])))) throw Error('usage: --out <directory> [--probe] [--turns [--turns-until <ISO time>]] [--grid <grid.json>] [--titles 8] [--tenant <name>]');
const grid = JSON.parse(await fs.readFile(values.grid ? path.resolve(values.grid) : new URL('./lib/rag-v2-coverage-grid.json', import.meta.url), 'utf8'));
const compiled = compileGrid(grid), tenant = values.tenant, titleCount = Number(values.titles) || 8, width = compiled.columns.length;
// Practical guidance for a row's group, as the grid's first column names it.
const plainKinds = group => new Set((plain => (Array.isArray(plain) ? plain : plain?.[group] || []))(compiled.columns[0].plain));
const GUIDANCE = ['official_page', 'guide'], LOCAL = ['municipal_record', 'municipal_act', 'registry'];
const median = list => { const sorted = [...list].sort((a, b) => a - b); return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0; };

const postgres = new PostgresCatalog(process.env.RAG_V2_POSTGRES_URL);
const query = (sql, parameters) => postgres.pool.query(sql, parameters).then(result => result.rows);
let prisma = null;
try {
  await postgres.inheritVerified({ keep: false }).catch(() => 0);
  const generation = await postgres.active(tenant), ids = Object.keys(generation.snapshot.documents);

  // What every document is. The fields are read once per row; a contact's and a form's title stays in the database.
  const documents = [], byId = new Map(), notCounted = {};
  for (let start = 0; start < ids.length; start += 250) {
    for (const row of await query(`WITH f AS MATERIALIZED (SELECT d.document_id, v.bundle->'document'->'fields' AS f FROM rag_v2_generation_document d
        JOIN rag_v2_version v ON v.tenant=d.tenant AND v.id=d.version_id AND v.document_id=d.document_id WHERE d.tenant=$1 AND d.generation_id=$2 AND d.document_id=ANY($3::text[]))
      SELECT document_id, f->'source_type'->>'value' AS type, f->'jurisdiction_level'->>'value' AS level, f->'authority'->>'value' AS publisher, f->'municipality_name'->>'value' AS municipality,
        CASE WHEN f->'source_type'->>'value'=ANY($4::text[]) THEN NULL ELSE f->'title'->>'value' END AS title FROM f`, [tenant, generation.id, ids.slice(start, start + 250), NOT_COUNTED])) {
      const kind = NOT_COUNTED.includes(row.type) ? null : documentKind(row);
      if (!kind) { const key = row.type || 'unknown'; notCounted[key] = (notCounted[key] || 0) + 1; continue; }
      const document = { id: row.document_id, type: row.type, kind, title: row.title || '', publisher: row.publisher || '', municipality: row.municipality || '', tally: documentTally(compiled) };
      byId.set(document.id, document); documents.push(document);
    }
  }

  // Every passage of the counted documents, by the text the search channels read: title, heading path and body.
  const { layout } = await postgres.layoutOf(tenant, generation.id);
  const scope = layout === VERSION_LAYOUT
    ? { from: 'rag_v2_version_unit u', where: `u.tenant=$1 AND u.config_id=(SELECT config->>'id' FROM rag_v2_generation WHERE tenant=$1 AND id=$2)
        AND u.version_id IN (SELECT version_id FROM rag_v2_generation_document WHERE tenant=$1 AND generation_id=$2 AND document_id=ANY($3::text[]))` }
    : { from: 'rag_v2_unit u', where: 'u.tenant=$1 AND u.generation_id=$2 AND u.document_id=ANY($3::text[])' };
  const unitDocument = new Map(), counted = documents.map(document => document.id);
  let passages = 0;
  for (let start = 0; start < counted.length; start += 200) {
    for (const unit of await query(`SELECT u.id,u.document_id,u.data->>'input_text' AS text FROM ${scope.from} WHERE ${scope.where}`, [tenant, generation.id, counted.slice(start, start + 200)])) {
      const document = byId.get(unit.document_id);
      addPassage(compiled, document.tally, passageMarks(compiled, unit.text)); unitDocument.set(unit.id, document); passages++;
    }
  }

  const rows = tallyGrid(compiled, documents);
  const about = compiled.rows.map((_, index) => documents.filter(document => isAbout(compiled.rules, document.tally, index)));
  const plainAbout = about.map((list, index) => { const kinds = plainKinds(compiled.rows[index].group); return new Set(list.filter(document => kinds.has(document.kind))); });
  const byTitle = new Map();
  for (const document of documents) { if (!byTitle.has(document.title)) byTitle.set(document.title, []); byTitle.get(document.title).push(document); }
  const lawTitles = documents.filter(document => document.kind === 'law').map(document => normalise(document.title));

  for (const [index, row] of rows.entries()) {
    // Which of the national laws the situation rests on are in the corpus, and what its responsible publishers give.
    row.acts = (compiled.rows[index].acts || []).map(name => ({ name, in_corpus: lawTitles.some(title => title.includes(normalise(name))) }));
    const owned = about[index].filter(document => GUIDANCE.includes(document.kind) && publishedBy(compiled.rows[index].owners, document.publisher));
    row.owners = { names: compiled.rows[index].owners || [], official_page: owned.filter(document => document.kind === 'official_page').length, guide: owned.filter(document => document.kind === 'guide').length };
    // Titles for reading the counts: per row and kind the documents the row's terms fill most. A municipality's own
    // documents are shown by title with the number of municipalities that have one.
    row.titles = {};
    for (const kind of KINDS) {
      const list = about[index].filter(document => document.kind === kind).sort((a, b) => b.tally.rows[index] - a.tally.rows[index] || (a.title < b.title ? -1 : 1));
      if (!list.length) continue;
      if (LOCAL.includes(kind)) {
        const names = new Map();
        for (const document of list) { const key = document.title.replace(/:\s.*$/u, '').slice(0, 90); if (!names.has(key)) names.set(key, new Set()); names.get(key).add(document.municipality || document.id); }
        row.titles[kind] = [...names].map(([title, set]) => ({ title, municipalities: set.size })).sort((a, b) => b.municipalities - a.municipalities).slice(0, titleCount);
      } else row.titles[kind] = list.slice(0, titleCount).map(document => ({ title: document.title.slice(0, 140), publisher: document.publisher, passages: document.tally.rows[index], of: document.tally.passages }));
    }
    for (const [column, cell] of row.cells.entries()) {
      if (compiled.columns[column].match === null) continue;
      cell.titles = documents.filter(document => plainKinds(row.group).has(document.kind) && countsForCell(compiled, document, index, column))
        .sort((a, b) => b.tally.cells[index * width + column] - a.tally.cells[index * width + column]).slice(0, 5)
        .map(document => ({ title: document.title.slice(0, 120), publisher: document.publisher, passages: document.tally.cells[index * width + column] }));
    }
  }

  // The corpus by kind, and how many passages a document of each source type takes (for the room an addition needs).
  const kinds = Object.fromEntries(KINDS.map(kind => [kind, { documents: 0, passages: 0 }])), types = {};
  for (const document of documents) {
    kinds[document.kind].documents++; kinds[document.kind].passages += document.tally.passages;
    (types[document.type] ||= []).push(document.tally.passages);
  }
  const report = { written_by: grid.version, read_at: new Date().toISOString().slice(0, 10), generation: generation.id.replace(/^search_generation_/u, '').slice(0, 8), documents_in_corpus: ids.length,
    documents_counted: documents.length, passages_counted: passages, not_counted: notCounted, rules: grid.rules, kinds,
    source_types: Object.fromEntries(Object.entries(types).map(([type, list]) => [type, { documents: list.length, passages: list.reduce((sum, n) => sum + n, 0), median_passages: median(list) }])),
    laws_in_corpus: [...new Set(documents.filter(document => document.kind === 'law').map(document => document.title.slice(0, 90)))].sort(),
    owners_in_corpus: Object.fromEntries([...new Set(compiled.rows.flatMap(row => row.owners || []))].sort().map(name => [name, Object.fromEntries(['official_page', 'guide', 'study'].map(kind =>
      [kind, documents.filter(document => document.kind === kind && publishedBy([name], document.publisher)).length]))])),
    columns: compiled.columns.map(column => ({ id: column.id, name: column.name, long: column.long })), rows };

  if (values.probe) {
    // The word channel alone, with the opening sentence as a person would write it: which kinds of documents come
    // first, and where the first guidance document about the row stands. The vector channel and the search plan,
    // which the chat also uses, are not run here: this shows whether the person's words meet the documents' words.
    const national = documents.filter(document => !document.municipality && document.kind !== 'municipal_record' && document.kind !== 'municipal_act').map(document => document.id);
    for (const [index, row] of rows.entries()) {
      const opening = compiled.rows[index].opening;
      if (!opening) continue;
      try {
        const hits = (await postgres.lexical(tenant, generation.id, national, withoutStopwords(opening), 40, null, { rank: LEXICAL_RANK_PLAIN })).map(hit => unitDocument.get(hit.id)).filter(Boolean);
        const rank = set => { const at = hits.findIndex(document => set.has(document)); return at < 0 ? null : at + 1; }, top = {};
        for (const document of hits.slice(0, 10)) top[document.kind] = (top[document.kind] || 0) + 1;
        row.probe = { hits: hits.length, top10_kinds: top, first_guidance_about: rank(plainAbout[index]), guidance_about_in_top10: hits.slice(0, 10).filter(document => plainAbout[index].has(document)).length,
          guidance_about_in_top40: hits.filter(document => plainAbout[index].has(document)).length, first_any_about: rank(new Set(about[index])) };
      } catch (error) { row.probe = { error: error.code || error.message.slice(0, 80) }; }
    }
  }

  const until = values['turns-until'] ? new Date(values['turns-until']) : null;
  const accounts = values.turns ? await (async () => { ({ default: prisma } = await import('../lib/prisma.js')); return prisma.user.count(); })() : null;
  if (values.turns && accounts !== 1 && !until) report.turns = { accounts, skipped: 'more than one account and no --turns-until' };
  else if (values.turns) {
    // Stored turns of the test account. A turn belongs to a row when its question or its search plan's queries hold
    // the row's terms. A candidate carries its document's title, not its id: it is taken for a document of that
    // title. Only documents that were in the corpus generation the turn ran on are asked of it. Only counts leave
    // this block.
    const { openTurn } = await import('../lib/rag-v2/pilot/packed-json.js');
    const listed = await prisma.m4PilotTurn.findMany({ where: until ? { createdAt: { lte: until } } : {}, orderBy: { createdAt: 'desc' }, select: { id: true }, take: 2000 });
    const tally = rows.map(() => ({ turns: 0, no_guidance_then: 0, guidance_candidate: 0, guidance_kept: 0, guidance_evidence: 0, guidance_cited: 0, any_evidence: 0, any_cited: 0 }));
    const seen = { accounts, until: until ? until.toISOString() : null, stored: listed.length, read: 0, generation_gone: 0, on_active_generation: 0, with_candidates: 0, on_some_row: 0, candidates: 0, candidates_resolved: 0 };
    const generations = new Map([[generation.id, new Set(ids)]]);
    const documentsOf = async id => {
      if (!generations.has(id)) {
        const stored = (await query(`SELECT ARRAY(SELECT jsonb_object_keys(snapshot->'documents')) AS ids FROM rag_v2_generation WHERE tenant=$1 AND id=$2`, [tenant, id]))[0];
        generations.set(id, stored ? new Set(stored.ids) : null);
      }
      return generations.get(id);
    };
    for (let start = 0; start < listed.length; start += 20) {
      for (const raw of await prisma.m4PilotTurn.findMany({ where: { id: { in: listed.slice(start, start + 20).map(row => row.id) } } })) {
        const payload = openTurn(raw).payload || {}, packet = payload.packet || {}, rerank = payload.searchAssist?.rerank || {};
        if (raw.state !== 'completed' || !Array.isArray(packet.evidence)) continue;
        const present = await documentsOf(payload.generationId);
        if (!present) { seen.generation_gone++; continue; }
        seen.read++; if (payload.generationId === generation.id) seen.on_active_generation++;
        const candidates = rerank.candidates || [], selected = rerank.selected || rerank.kept || [];
        if (candidates.length) seen.with_candidates++;
        const titled = candidate => byTitle.get(candidate.title || '') || [];
        const candidateDocuments = candidates.flatMap(titled);
        seen.candidates += candidates.length; seen.candidates_resolved += candidates.filter(candidate => titled(candidate).length).length;
        const keptIds = new Set(selected.map(item => (typeof item === 'number' ? candidates[item]?.id : item?.id ?? item)));
        const keptDocuments = candidates.filter(candidate => keptIds.has(candidate.id)).flatMap(titled);
        const evidenceDocuments = packet.evidence.map(entry => byId.get(entry.document_id)).filter(Boolean);
        const citedIds = new Set((payload.answer?.blocks || []).flatMap(block => block.refs || []).map(ref => packet.reference_map?.[ref]?.evidence_id).filter(Boolean));
        const citedDocuments = packet.evidence.filter(entry => citedIds.has(entry.evidence_id)).map(entry => byId.get(entry.document_id)).filter(Boolean);
        const marks = passageMarks(compiled, `${payload.question || ''} ${(payload.searchAssist?.queries || []).map(item => (typeof item === 'string' ? item : item?.text || '')).join(' ')}`);
        if (marks.rows.length) seen.on_some_row++;
        for (const index of marks.rows) {
          const guidance = new Set([...plainAbout[index]].filter(document => present.has(document.id))), any = new Set(about[index].filter(document => present.has(document.id)));
          const has = (list, set) => list.some(document => set.has(document)), row = tally[index];
          row.turns++;
          if (!guidance.size) { row.no_guidance_then++; continue; }
          if (has(candidateDocuments, guidance)) row.guidance_candidate++;
          if (has(keptDocuments, guidance)) row.guidance_kept++;
          if (has(evidenceDocuments, guidance)) row.guidance_evidence++;
          if (has(citedDocuments, guidance)) row.guidance_cited++;
          if (has(evidenceDocuments, any)) row.any_evidence++;
          if (has(citedDocuments, any)) row.any_cited++;
        }
      }
    }
    report.turns = seen;
    for (const [index, row] of rows.entries()) row.turns = tally[index];
  }

  const extra = [
    { name: 'Seadus', text: row => (row.acts.length ? `${row.acts.filter(act => act.in_corpus).length}/${row.acts.length}` : '') },
    { name: 'Vastutaja juhis', text: row => String(row.owners.official_page + row.owners.guide) },
    ...(values.probe ? [{ name: 'Sõnaotsing', text: row => (!row.probe ? '' : row.probe.error ? 'viga' : row.probe.first_guidance_about ? `${row.probe.first_guidance_about}. koht` : 'ei leia') }] : []),
    ...(values.turns && rows[0].turns ? [{ name: 'Testpöörded', text: row => (row.turns?.turns - row.turns?.no_guidance_then > 0 ? `${row.turns.guidance_evidence}/${row.turns.turns - row.turns.no_guidance_then}` : 'mõõtmata') }] : []),
  ];
  await fs.mkdir(values.out, { recursive: true });
  await fs.writeFile(path.join(values.out, 'coverage-map.json'), JSON.stringify(report, null, 1));
  await fs.writeFile(path.join(values.out, 'coverage-map.md'), [`Korpus ${report.generation}: ${report.documents_in_corpus} dokumenti, loetud ${report.documents_counted} dokumenti ja ${report.passages_counted} lõiku.`, '',
    markdownTable(compiled, rows, 'A', extra), '', markdownTable(compiled, rows, 'B', extra), ''].join('\n'));
  console.log(JSON.stringify({ generation: report.generation, documents_in_corpus: report.documents_in_corpus, documents_counted: report.documents_counted, passages_counted: passages, not_counted: notCounted, kinds, turns: report.turns ?? null }));
  const states = {};
  for (const row of rows) for (const cell of row.cells) states[cell.state] = (states[cell.state] || 0) + 1;
  console.log(JSON.stringify({ cells: rows.length * width, states }));
} finally {
  await postgres.pool.end().catch(() => 0);
  await prisma?.$disconnect().catch(() => 0);
}
process.exit(0);
