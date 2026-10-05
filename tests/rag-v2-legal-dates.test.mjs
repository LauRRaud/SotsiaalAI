import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { DEFAULT_CONFIG, hash, id, stable } from '../lib/rag-v2/contracts.js';
import { ingest } from '../lib/rag-v2/ingestion.js';
import { registeredSource } from '../lib/rag-v2/registered-source.js';
import { embeddingConfig, indexUnit, tokenCount, MockEmbedding } from '../lib/rag-v2/search/embedding.js';
import { sourceEntry, retrieve } from '../lib/rag-v2/search/retrieval.js';
import { modelProjection, auditPacketBytes, LEGAL_DATES_TOKENS, AUDIT_PACKET_BYTES } from '../lib/rag-v2/search/model-context.js';
import { searchConfig } from '../lib/rag-v2/search/indexing.js';
import { LocalPolicy } from '../lib/rag-v2/search/policy.js';
import { replayContext, withoutLegalDates } from '../lib/rag-v2/search/context-replay.js';
import { retrievalDirectory } from '../lib/rag-v2/search/discovery.js';

// ADR-062: the two acts of the 30.09 live check, read from Andmebaasi as committed; no network.
// Stage 1: the reader keeps their amendment notes and their own dates as data, and everything else is what reader
// source-structure-v29 made of the same two files: the fixture holds its chunks' hashes and the whole model context,
// made with the committed v29 code and ingested as below (the embedding input hashes are the stored corpus versions').
// Stage 2: the model context (json-3) shows those dates, outside every budget and selection measure.
const MARJAMAA = '401092026014', KUUSALU = '412092026022', tenant = 'legal-dates-test';
const v29 = JSON.parse(await fs.readFile(new URL('./fixtures/rag-v2-legal-dates-v29.json', import.meta.url), 'utf8'));
const rights = { access: 'local_private', usage: 'development_only' }, profile = { id: 'generic-fixtures', version: '1', months: [], categoryLabels: [] };
let root; const bundles = {};
const ACTS = [[MARJAMAA, 'marjamaa_vald', 'Märjamaa vald'], [KUUSALU, 'kuusalu_vald', 'Kuusalu vald']];
// A registry as the corpus has it: REGISTER.json names each act's file with its hash, and a source register it declares
// gives the act's municipality by that hash.
async function registry(dir, acts = ACTS, { sources = true } = {}) {
  await fs.mkdir(path.join(dir, 'oigusaktid'), { recursive: true }); await fs.mkdir(path.join(dir, 'register'), { recursive: true });
  const entries = [], listed = [];
  for (const [act, municipality_id, municipality_name] of acts) {
    const bytes = await fs.readFile(path.join('Andmebaasi', 'oigusaktid', `${act}.xml`));
    await fs.writeFile(path.join(dir, 'oigusaktid', `${act}.xml`), bytes);
    entries.push({ sha256: hash(bytes), municipality_id, municipality_name });
    listed.push({ role: 'source', path: `oigusaktid/${act}.xml`, sha256: hash(bytes) });
  }
  const register = JSON.stringify({ entries });
  await fs.writeFile(path.join(dir, 'register', 'kov.json'), register);
  await fs.writeFile(path.join(dir, 'REGISTER.json'), JSON.stringify({ entries: [{ role: 'source_register', path: 'register/kov.json', sha256: hash(register) }, ...(sources ? listed : [])] }));
  return listed;
}
before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-legal-dates-'));
  // Ingested as the batch plan does: the registry's metadata for the entry, in canonical form.
  for (const entry of await registry(root)) {
    const metadata = await registeredSource(root, entry);
    bundles[path.basename(entry.path, '.xml')] = (await ingest({ tenant, inputRoot: root, metadataJson: stable(metadata), storeRoot: path.join(root, 'store'), rights, profile })).bundle;
  }
});
after(async () => {
  const target = path.resolve(root);
  assert(target.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(target).startsWith('rag-v2-legal-dates-'));
  await fs.rm(target, { recursive: true, force: true });
});
const section = (bundle, number) => bundle.source_units.find(unit => unit.locator.path === `/oigusakt[1]/sisu[1]/paragrahv[${number}]`);
const legal = bundle => bundle.document.fields.legal_text.value;

test('Märjamaa: the birth grant\'s own note dates it, and the amendment that starts the version changed only the preamble', () => {
  const bundle = bundles[MARJAMAA], unit = section(bundle, 1), [birth, school, third] = unit.amendments;
  assert.equal(bundle.version.processing_config.normalization, DEFAULT_CONFIG.normalization);
  // § 1 p 1 (sünnitoetus 500 + 300): in force 24.03.2026, applied from 01.01.2026; not 04.09.2026, the version's start.
  assert.deepEqual(birth, { provision: '§ 1 p 1', offset: unit.raw_text.indexOf('lapse aastaseks saamisel;') + 'lapse aastaseks saamisel;'.length,
    path: '/oigusakt[1]/sisu[1]/paragrahv[1]/loige[1]/alampunkt[1]/muutmismarge[1]', act_reference: '421022026007', rt: 'RT IV, 21.03.2026, 7',
    published: '2026-03-21', in_force: '2026-03-24', applies_from: '2026-01-01', note: 'rakendatakse alates 01.01.2026' });
  assert.match(unit.raw_text.slice(0, birth.offset), /sünnitoetus – esimene osa 500 eurot lapse kohta sünni registreerimisel ja teine osa 300 eurot lapse kohta lapse aastaseks saamisel;$/u);
  assert.deepEqual([school.provision, school.in_force, school.applies_from], ['§ 1 p 2', '2026-03-24', '2026-01-01']);
  assert.deepEqual([third.provision, third.act_reference, third.in_force, third.applies_from, third.note], ['§ 1 p 3', '428122024039', '2025-01-01', undefined, undefined]);
  // Every note lies inside its section's text, in the text's order.
  for (const item of bundle.source_units) {
    const offsets = (item.amendments || []).map(note => note.offset);
    assert(offsets.every((offset, index) => Number.isInteger(offset) && offset > 0 && offset <= item.raw_text.length && (index === 0 || offset >= offsets[index - 1])));
  }
  assert.equal(bundle.document.fields.valid_from.value, '2026-09-04');
  const text = legal(bundle);
  assert.deepEqual({ ...text, history: text.history.length, structure: text.structure.map(note => [note.target, note.in_force]) }, {
    schema_version: 'rag-v2/legal-text-1', text_kind: 'terviktekst', adopted: '2018-05-15', original_reference: '418052018022', original_published: '2018-05-18',
    act_in_force_from: '2018-07-01', version_from: '2026-09-04', history: 4,
    version_change: { in_force: '2026-09-04', acts: ['401092026001'], provisions: ['preambul'] },
    structure: [['pealkiri', '2024-09-23'], ['preambul', '2026-09-04']],
    entry_into_force: [{ provision: '§ 4', unit_index: 4, path: '/oigusakt[1]/sisu[1]/paragrahv[4]/loige[1]/sisuTekst[1]/tavatekst[1]', text: 'Määrus jõustub 1. juulil 2018.' }] });
  assert.deepEqual(text.history.at(-2), { act_reference: '421022026007', rt: 'RT IV, 21.03.2026, 7', published: '2026-03-21', in_force: '2026-03-24',
    adopted: '2026-03-17', applies_from: '2026-01-01', note: 'rakendatakse alates 01.01.2026' });
  assert.deepEqual(bundle.document.fields.legal_text.provenance, [{ kind: 'riigi_teataja_xml', asset_hash: bundle.version.source_hash, path: '/oigusakt[1]' }]);
  assert.deepEqual(bundle.report.field_provenance.legal_text, bundle.document.fields.legal_text.provenance);
  assert(!bundle.report.warnings.some(warning => warning.code === 'amendment_note_position_unresolved'));
});

test('Kuusalu: the limits in § 3 carry no note; the act\'s own provision says from when it is applied', () => {
  const bundle = bundles[KUUSALU], text = legal(bundle);
  assert.match(section(bundle, 3).raw_text, /Üür – kuni 12 eurot 1 m² kohta kuus\./u);
  assert(bundle.source_units.every(unit => unit.amendments === undefined), 'no section of the act has a note');
  // 15.09.2026 starts the version because the preamble changed; the regulation is applied from 01.05.2026 (§ 5 lg 1).
  assert.equal(bundle.document.fields.valid_from.value, '2026-09-15');
  assert.deepEqual({ ...text, history: text.history.map(note => note.act_reference), structure: text.structure.map(note => [note.target, note.in_force]) }, {
    schema_version: 'rag-v2/legal-text-1', text_kind: 'terviktekst', adopted: '2026-04-23', original_reference: '428042026001', original_published: '2026-04-28',
    act_in_force_from: '2026-05-01', version_from: '2026-09-15', history: ['410092026016'],
    version_change: { in_force: '2026-09-15', acts: ['410092026016'], provisions: ['preambul'] },
    structure: [['preambul', '2026-09-15']],
    entry_into_force: [{ provision: '§ 5 lg 1', unit_index: 5, path: '/oigusakt[1]/sisu[1]/paragrahv[5]/loige[1]/sisuTekst[1]/tavatekst[1]', text: 'Määrust rakendatakse alates 01.05.2026.' }] });
  assert.equal(bundle.source_units[text.entry_into_force[0].unit_index], section(bundle, 5));
});

const scope = { tenant, query_id: 'query-fixture', generation_id: 'generation-fixture' };
const entriesOf = (bundle, chunks = bundle.chunks) => chunks.map(chunk => sourceEntry(indexUnit(chunk, bundle, embeddingConfig()), bundle, 'ranked_seed', null));
// The same version as an earlier reader left it: no notes on its source units, no legal_text. PDFs, JSON records and
// derived annexes have this shape too.
const withoutData = bundle => {
  const copy = structuredClone(bundle);
  for (const unit of copy.source_units) delete unit.amendments;
  delete copy.document.fields.legal_text;
  return copy;
};

test('text, retrieval text and embedding inputs are the v29 reader\'s; without the legal dates the model context is the v29 one under its new label', () => {
  assert.equal(v29.reader, 'source-structure-v29');
  for (const [act, bundle] of Object.entries(bundles)) {
    const before = v29.acts[act];
    assert.deepEqual(bundle.chunks.map(chunk => ({ embedding_input_hash: chunk.embedding_input_hash, source_text_sha256: hash(chunk.source_text),
      retrieval_text_sha256: hash(chunk.retrieval_text) })), before.chunks, act);
    for (const chunk of bundle.chunks) assert.equal(chunk.embedding_input_hash, hash(stable([DEFAULT_CONFIG.embeddingInputVersion, chunk.retrieval_text])));
    // Every chunk as evidence. What a budget, a selection step or a reference check reads is the v29 bundle's context
    // (model-context-json-2) with the label alone changed: the source card and each excerpt are byte for byte the same.
    assert.equal(before.model_context.schema_version, 'rag-v2/model-context-json-2');
    const expected = { ...before.model_context, schema_version: 'rag-v2/model-context-json-4' }, evidence = entriesOf(bundle);
    for (const options of [{ annotations: false }, { measure: 'budget' }, { measure: 'none' }]) assert.deepEqual(modelProjection(evidence, scope, options).context, expected, `${act} ${JSON.stringify(options)}`);
    // A bundle without the data projects so in the context a turn sends too, and its entries carry nothing new.
    const earlier = entriesOf(withoutData(bundle)), plain = modelProjection(earlier, scope);
    assert.deepEqual(earlier, evidence.map(({ legal_dates: _dates, ...entry }) => entry));
    assert.deepEqual(plain.context, expected, act);
    assert.equal(plain.measurements.budget_context_tokens, plain.measurements.model_context_tokens);
    assert.equal(plain.measurements.legal_dates, undefined);
    // With the data the context a turn sends is the same apart from the dates, and the reference map is the same map.
    const sent = modelProjection(evidence, scope);
    assert.deepEqual(withoutLegalDates(sent.context), withoutLegalDates(expected), act);
    assert.notDeepEqual(sent.context, expected);
    assert.equal(sent.measurements.budget_context_tokens, plain.measurements.model_context_tokens);
    assert.deepEqual(sent.references, plain.references);
    assert.deepEqual(Object.keys(sent.references.S1), ['tenant', 'query_id', 'generation_id', 'evidence_id', 'document_id', 'document_version_id', 'unit_id', 'chunk_id', 'span_ids', 'pdf_pages', 'source_locations', 'source_text_sha256']);
    // The amending act's reference, its Riigi Teataja citation and the notes' places stay in the bundle.
    const seen = JSON.stringify(sent.context);
    for (const hidden of ['legal_text', '421022026007', '428122024039', 'RT IV', '"offset"', '"history"', '"structure"', '"published"', '"adopted"']) assert(!seen.includes(hidden), `${act} ${hidden}`);
  }
});

test('what the model reads of the two acts: the card\'s act_dates and the excerpt\'s amendments, exactly', () => {
  const one = (act, pattern) => {
    const bundle = bundles[act], chunk = bundle.chunks.find(item => pattern.test(item.source_text)), evidence = entriesOf(bundle, [chunk]);
    const sent = modelProjection(evidence, scope), plain = modelProjection(evidence, scope, { annotations: false });
    return { chunk, sent, plain, card: sent.context.sources.D1, excerpt: sent.context.evidence[0], dates: evidence[0].legal_dates };
  };
  // Märjamaa: the birth grant (500 + 300) is in § 1 p 1, in force 24.03.2026 and applied from 01.01.2026. The version's
  // start, 04.09.2026, changed the preamble only.
  const marjamaa = one(MARJAMAA, /sünnitoetus – esimene osa 500 eurot/u);
  assert.equal(JSON.stringify(marjamaa.card), '{"title":"Sotsiaaltoetuste määrad ja piirmäärad","publication_date":"2026-09-01","source_type":"legal_act","authority":"Märjamaa Vallavolikogu","language":"et",'
    + '"valid_from":"2026-09-04","municipality_id":"marjamaa_vald","municipality_name":"Märjamaa vald","country":"EE","regions":["marjamaa_vald"],"jurisdiction_level":"municipal",'
    + '"act_dates":{"act_in_force_from":"2018-07-01","changed_on_valid_from":["preambul"],"entry_into_force":[{"provision":"§ 4","text":"Määrus jõustub 1. juulil 2018."}]}}');
  const { text, ...head } = marjamaa.excerpt;
  assert.equal(JSON.stringify(head), '{"ref":"S1","source":"D1","pdf_pages":[],"source_locations":[{"kind":"xml","path":"/oigusakt[1]/sisu[1]/paragrahv[1]","act_reference":"401092026014"}],'
    + '"amendments":[{"provisions":["§ 1 p 1","§ 1 p 2"],"in_force":"2026-03-24","applies_from":"2026-01-01","note":"rakendatakse alates 01.01.2026"},{"provisions":["§ 1 p 3"],"in_force":"2025-01-01"}]}');
  assert.equal(text, marjamaa.chunk.source_text); assert.equal(Object.keys(marjamaa.excerpt).at(-1), 'text');
  assert.deepEqual(marjamaa.dates, { act: marjamaa.card.act_dates, amendments: marjamaa.excerpt.amendments });
  assert.deepEqual([tokenCount(JSON.stringify(marjamaa.plain.context.sources.D1)), tokenCount(JSON.stringify(marjamaa.card)), tokenCount(JSON.stringify(marjamaa.excerpt.amendments))], [108, 165, 78]);
  assert.deepEqual(marjamaa.sent.measurements.legal_dates, { tokens: 139, limit: LEGAL_DATES_TOKENS, shown: 2, omitted: 0 });
  // Kuusalu: § 3 (rent up to 12 euros a square metre) has no note; the card carries the act's own provision, § 5 lg 1.
  const kuusalu = one(KUUSALU, /Üür – kuni 12 eurot 1 m² kohta kuus\./u);
  assert.equal(JSON.stringify(kuusalu.card), '{"title":"Eluasemekulude piirmäärade kehtestamine toimetulekutoetuse määramisel","publication_date":"2026-09-12","source_type":"legal_act","authority":"Kuusalu Vallavalitsus","language":"et",'
    + '"valid_from":"2026-09-15","municipality_id":"kuusalu_vald","municipality_name":"Kuusalu vald","country":"EE","regions":["kuusalu_vald"],"jurisdiction_level":"municipal",'
    + '"act_dates":{"act_in_force_from":"2026-05-01","changed_on_valid_from":["preambul"],"entry_into_force":[{"provision":"§ 5 lg 1","text":"Määrust rakendatakse alates 01.05.2026."}]}}');
  assert.deepEqual(kuusalu.excerpt, kuusalu.plain.context.evidence[0]);
  assert.deepEqual(Object.keys(kuusalu.excerpt), ['ref', 'source', 'pdf_pages', 'source_locations', 'text']);
  assert.deepEqual(kuusalu.dates, { act: kuusalu.card.act_dates });
  assert.deepEqual([tokenCount(JSON.stringify(kuusalu.plain.context.sources.D1)), tokenCount(JSON.stringify(kuusalu.card))], [115, 175]);
  assert.deepEqual(kuusalu.sent.measurements.legal_dates, { tokens: 61, limit: LEGAL_DATES_TOKENS, shown: 1, omitted: 0 });
  // Each note of Märjamaa's act is in one excerpt; the act's other sections carry none. § 3's one note closes the
  // section under a plain number: it is the last point's or the whole section's, and the label says both.
  const all = modelProjection(entriesOf(bundles[MARJAMAA]), scope).context.evidence.map(excerpt => (excerpt.amendments || []).flatMap(entry => entry.provisions));
  assert.deepEqual(all.filter(list => list.length), [['§ 1 p 1', '§ 1 p 2', '§ 1 p 3'], ['§ 3 lg 3 p 3 või kogu § 3']]);
});

// The search over both acts with stand-in services: every chunk is a lexical hit, in the acts' order. With `directory`
// the catalogue has a retrieval directory, as the chat's has: candidates come from it and a document loads when chosen.
function searchOver(list, { directory = false } = {}) {
  const embedding = new MockEmbedding(), config = searchConfig(embedding.config), byDocument = new Map(list.map(bundle => [bundle.document.id, bundle]));
  const documents = Object.fromEntries(list.map(bundle => [bundle.document.id, { version_id: bundle.version.id }]));
  const snapshot = { source_generation: 'source-v1', documents, snapshot_hash: hash(stable(documents)) }, generation = { id: id('search_generation', tenant, snapshot, config), config, snapshot };
  const units = list.flatMap(bundle => bundle.chunks.map(chunk => indexUnit(chunk, bundle, embedding.config)));
  const postgres = { active: async () => generation, bundles: async (_tenant, _generation, docs) => docs.map(doc => byDocument.get(doc)),
    ...(directory ? { retrievalDirectory: async (_tenant, _generation, docs) => list.filter(bundle => docs.includes(bundle.document.id)).map(bundle => retrievalDirectory(bundle, config.embedding)) } : {}),
    units: async (_tenant, _generation, docs) => units.filter(unit => docs.includes(unit.document_id)),
    lexical: async (_tenant, _generation, _docs, _text, _limit, eligible) => units.filter(unit => eligible.includes(unit.id)).map((unit, at) => ({ ...unit, score: 100 - at })) };
  const policy = new LocalPolicy({ tenants: { [tenant]: { operator: [...byDocument.keys()] } } });
  return (contextTokens, { hooks, limits, ...options } = {}) => retrieve({ postgres, qdrant: { query: async () => [] }, embedding, policy, context: { tenant, subject: 'operator', usage: 'development_only' }, allowLexicalFallback: false, ...(hooks ? { hooks } : {}),
    query: { text: 'toetus', language: 'et', method: 'lexical', contextMode: 'compact', includeDocumentLabels: false, finalLimit: 20, limits: { topK: 20, perDocument: 20, candidates: 40, contextTokens, ...limits }, ...options } });
}
// What must not differ between a search over the bundles with the legal dates and one over the same without them: the
// evidence and why each unit was taken or left, the reranker's pool and choice, the references, what was loaded and
// measured for a budget, the context apart from the dates.
const chosen = packet => ({ state: packet.state, error: packet.error ?? null, warnings: packet.warnings, evidence: packet.evidence.map(({ legal_dates: _dates, ...entry }) => entry),
  trace: packet.selection_trace, rankings: packet.raw_rankings, dependencies: packet.dependency_context ?? null, context: withoutLegalDates(packet.model_context),
  rerank: packet.rerank ?? null, selection: packet.selection_config, loading: packet.measurements.loading, cross_references: packet.measurements.cross_references ?? null,
  counted: [packet.measurements.context_tokens, packet.measurements.budget_context_tokens],
  references: Object.fromEntries(Object.entries(packet.reference_map).map(([ref, { query_id: _query, ...value }]) => [ref, value])) });
const sameSearch = (dated, earlier) => async (contextTokens, options) => {
  const [withDates, without] = [await dated(contextTokens, options), await earlier(contextTokens, options)];
  assert.deepEqual(chosen(withDates), chosen(without), `${contextTokens} ${JSON.stringify(options ?? {})}`);
  assert.equal(without.evidence.some(entry => 'legal_dates' in entry), false);
  return { withDates, without };
};

test('retrieve() selects the same evidence with and without the legal dates in the bundles, in every budget measure', async () => {
  const dated = searchOver(Object.values(bundles)), earlier = searchOver(Object.values(bundles).map(withoutData)), same = sameSearch(dated, earlier);
  // With room for everything: every eligible chunk of both acts, and the dates in the context that is sent.
  const roomy = await same(32000);
  assert.equal(roomy.without.state, 'ok'); assert(roomy.without.evidence.length >= 8);
  assert(roomy.withDates.evidence.some(entry => entry.legal_dates?.amendments) && roomy.withDates.model_context.sources.D1.act_dates);
  const exact = modelProjection(roomy.without.evidence, {}, { measure: 'budget' }).measurements.model_context_tokens;
  assert.equal(roomy.without.measurements.model_context_tokens, exact);
  // A budget of exactly the context without the dates: everything still fits, though the context sent is larger.
  const tight = await same(exact);
  assert.equal(tight.withDates.evidence.length, roomy.without.evidence.length);
  assert.deepEqual(tight.withDates.warnings, []);
  assert.equal(tight.withDates.measurements.budget_context_tokens, exact);
  assert(tight.withDates.measurements.model_context_tokens > exact + 150, 'the dates are in the context sent and outside its budget');
  // context_tokens is what the budget counted, with the dates or without; the context as sent is model_context_tokens.
  assert.deepEqual([tight.withDates.measurements.context_tokens, tight.without.measurements.context_tokens], [exact, exact]);
  // The audit packet's size limit counts the packet without the dates: the stored packet is larger by them (each entry
  // carries its act's card and its notes), and what the limit reads is what it reads of the bundles without the data.
  const stored = packet => { const { tenant, query_id, generation_id, model_context, reference_map, evidence } = JSON.parse(JSON.stringify(packet).replaceAll(packet.query_id, 'query')); return { tenant, query_id, generation_id, model_context, reference_map, evidence }; };
  const [withDates, without] = [stored(roomy.withDates), stored(roomy.without)], bytes = value => Buffer.byteLength(JSON.stringify(value), 'utf8');
  assert.equal(AUDIT_PACKET_BYTES, 512000);
  assert.deepEqual([auditPacketBytes(withDates), auditPacketBytes(without)], [bytes(without), bytes(without)]);
  assert(bytes(withDates) > bytes(without) + 1000, `${bytes(withDates)} > ${bytes(without)}`);
  assert.equal(auditPacketBytes({ tenant, model_context: null, evidence: [] }), bytes({ tenant, model_context: null, evidence: [] }));
  // One token less: the same last excerpt is left out of both.
  const short = await same(exact - 1);
  assert.equal(short.withDates.evidence.length, roomy.without.evidence.length - 1);
  assert(short.withDates.warnings.includes('context_budget_limited'));
  // The semantic graph's two checks (the dependency context's fit, the turn's limit) read the same measure: a limit the
  // context with its dates passes neither clips the dependency context nor fails the turn.
  const graph = await same(exact + 256, { semanticGraph: true });
  assert.deepEqual([graph.withDates.state, graph.withDates.dependency_context.known_context, graph.withDates.evidence.length], ['ok', 'included', roomy.without.evidence.length]);
  assert(graph.withDates.measurements.budget_context_tokens <= exact + 256 && graph.withDates.measurements.model_context_tokens > exact + 256,
    `${graph.withDates.measurements.budget_context_tokens} <= ${exact + 256} < ${graph.withDates.measurements.model_context_tokens}`);
  // The audit measure counts whole entries: never their legal dates.
  const audit = roomy.without.evidence.reduce((sum, entry) => sum + tokenCount(JSON.stringify(entry)), 0);
  const whole = await same(audit, { contextMode: 'audit' }), less = await same(audit - 1, { contextMode: 'audit' });
  assert.deepEqual([whole.withDates.evidence.length, less.withDates.evidence.length], [roomy.without.evidence.length, roomy.without.evidence.length - 1]);
  assert.deepEqual([whole.withDates.measurements.context_tokens, whole.without.measurements.context_tokens], [audit, audit]);
});

test('retrieve() on the chat\'s path selects the same with and without the legal dates: candidates from the retrieval directory, a reranker with reserved places, cross-references', async () => {
  // A third, longer act (Harku 404072025017: sections that refer to each other, notes of every kind), so that the
  // reranker's pool does not hold every passage and a reserved place and a cross-reference are really taken.
  const dir = path.join(root, 'longer'), [entry] = await registry(dir, [['404072025017', 'harku_vald', 'Harku vald']]);
  const harku = (await ingest({ tenant, inputRoot: dir, metadataJson: stable(await registeredSource(dir, entry)), storeRoot: path.join(dir, 'store'), rights, profile })).bundle;
  const list = [...Object.values(bundles), harku], same = sameSearch(searchOver(list, { directory: true }), searchOver(list.map(withoutData), { directory: true }));
  // The directory rows of the two catalogues differ by the bundle's hash alone: nothing a search reads of a row knows the dates.
  const rows = bundle => { const { bundle_hash: _hash, ...row } = retrievalDirectory(bundle, embeddingConfig()); return row; };
  assert.deepEqual(list.map(withoutData).map(rows), list.map(rows));
  // The reranker keeps the passages on the birth grant and on the home service, in the pool's order.
  const read = [], rerank = async passages => { read.push(JSON.stringify(passages)); return passages.filter(passage => /sünnitoetus|[Kk]oduteenus/u.test(passage.text)).map(passage => passage.id); };
  const options = { hooks: { rerank }, references: true, finalLimit: 13, poolReserve: { documents: [harku.document.id], size: 4, perDocument: 2 }, limits: { topK: 9, perDocument: 9, expansionContextTokens: 2000 } };
  const { withDates } = await same(10000, options), reasons = packet => packet.evidence.map(entry => entry.selection.reason.type ?? entry.selection.reason), { loading, cross_references: followed } = withDates.measurements;
  // The chat's path was taken: candidates came from the directory and an act loaded only when chosen, the reranker read
  // a pool with reserved places and chose among it, and cross-references added excerpts.
  assert.deepEqual([withDates.state, loading.strategy, loading.directory_documents, loading.loaded_documents < 3], ['ok', 'candidate_documents', 3, true]);
  assert(withDates.rerank.reserved.length > 0 && withDates.rerank.selected.length > 0 && withDates.rerank.candidates.length > withDates.rerank.selected.length, JSON.stringify(withDates.rerank));
  assert(followed.additions > 0 && reasons(withDates).includes('ranked_seed') && reasons(withDates).includes('cross_reference'), JSON.stringify([followed, reasons(withDates)]));
  // The reranker read the same passages of both catalogues, and no date among them; the dates are in the context sent alone.
  assert.equal(read.length, 2); assert.equal(read[0], read[1]);
  assert(!/act_dates|amendments|in_force|applies_from|legal_dates/u.test(read[0]));
  assert(withDates.evidence.some(entry => entry.legal_dates?.amendments) && withDates.model_context.sources.D1.act_dates
    && withDates.measurements.model_context_tokens > withDates.measurements.budget_context_tokens);
  // The same under a budget that leaves excerpts out, with the semantic graph's dependencies, and with structural expansion.
  const short = (await same(1500, options)).withDates;
  assert(short.warnings.includes('context_budget_limited') && short.evidence.length < withDates.evidence.length);
  await same(3000, options);
  assert.equal((await same(10000, { ...options, semanticGraph: true })).withDates.state, 'ok');
  assert(reasons((await same(10000, { ...options, graph: true })).withDates).includes('structural_expansion'));
});

test('context replay: a turn stored before the re-ingest gets its context back with nothing but the legal dates added', async () => {
  // The turn's packet as stored: entries of the earlier version (other IDs, no notes), the context under its label then.
  const earlierEntry = entry => ({ ...entry, document_version_id: `version_${'0'.repeat(64)}`, evidence_id: `earlier-${entry.evidence_id}`, unit_id: `earlier-${entry.unit_id}`,
    chunk_id: `earlier-${entry.chunk_id}`, span_ids: entry.span_ids.map(span => `earlier-${span}`), source_locations: entry.source_locations.map(location => ({ ...location, source_unit_id: `earlier-${location.source_unit_id}` })) });
  const pick = (act, pattern) => entriesOf(withoutData(bundles[act])).filter(entry => pattern.test(entry.source_text)).map(earlierEntry);
  const evidence = [...pick(MARJAMAA, /sünnitoetus – esimene osa 500 eurot/u), ...pick(KUUSALU, /Üür – kuni 12 eurot/u), ...pick(MARJAMAA, /Määrus jõustub 1\. juulil 2018/u)];
  assert.equal(evidence.length, 3);
  const stored = modelProjection(evidence, scope, { annotations: false });
  const packet = { ...scope, evidence, model_context: { ...stored.context, schema_version: 'rag-v2/model-context-json-2' }, reference_map: stored.references };
  const now = new Map(Object.values(bundles).map(bundle => [bundle.document.id, bundle]));
  const replay = replayContext(packet, now, embeddingConfig());
  assert.deepEqual([replay.equal_without_legal_dates, replay.differences], [true, []]);
  assert.deepEqual(replay.evidence, [
    { ref: 'S1', source: 'D1', read: 'version_ingested_again', places: ['/oigusakt[1]/sisu[1]/paragrahv[1]'], amendments: [
      { provisions: ['§ 1 p 1', '§ 1 p 2'], in_force: '2026-03-24', applies_from: '2026-01-01', note: 'rakendatakse alates 01.01.2026' }, { provisions: ['§ 1 p 3'], in_force: '2025-01-01' }] },
    { ref: 'S2', source: 'D2', read: 'version_ingested_again', places: ['/oigusakt[1]/sisu[1]/paragrahv[3]'] },
    { ref: 'S3', source: 'D1', read: 'version_ingested_again', places: ['/oigusakt[1]/sisu[1]/paragrahv[4]'] }]);
  assert.deepEqual(replay.sources, {
    D1: { title: 'Sotsiaaltoetuste määrad ja piirmäärad', valid_from: '2026-09-04', act_dates: { act_in_force_from: '2018-07-01', changed_on_valid_from: ['preambul'], entry_into_force: [{ provision: '§ 4', text: 'Määrus jõustub 1. juulil 2018.' }] } },
    D2: { title: 'Eluasemekulude piirmäärade kehtestamine toimetulekutoetuse määramisel', valid_from: '2026-09-15',
      act_dates: { act_in_force_from: '2026-05-01', changed_on_valid_from: ['preambul'], entry_into_force: [{ provision: '§ 5 lg 1', text: 'Määrust rakendatakse alates 01.05.2026.' }] } } });
  assert.deepEqual(replay.tokens.legal_dates, { tokens: replay.tokens.legal_dates.tokens, limit: LEGAL_DATES_TOKENS, shown: 3, omitted: 0 });
  assert.equal(replay.tokens.without_legal_dates, stored.measurements.model_context_tokens);
  assert(replay.tokens.context > replay.tokens.without_legal_dates && Math.abs(replay.tokens.stored_context - replay.tokens.without_legal_dates) <= 1);
  // The audit packet's bytes: as stored, as the turn would store it now with the dates, and as the size limit counts it (without them).
  // The same versions without the data give the bytes the limit counts, as their whole packet.
  const plainBytes = replayContext(packet, new Map(Object.values(bundles).map(bundle => [bundle.document.id, withoutData(bundle)])), embeddingConfig()).packet_bytes;
  assert.deepEqual(replay.packet_bytes, { stored: Buffer.byteLength(JSON.stringify(packet), 'utf8'), now: replay.packet_bytes.now, counted: plainBytes.now, limit: AUDIT_PACKET_BYTES });
  assert.equal(plainBytes.counted, plainBytes.now);
  assert(replay.packet_bytes.now > replay.packet_bytes.counted + 500 && replay.packet_bytes.counted < AUDIT_PACKET_BYTES, JSON.stringify(replay.packet_bytes));
  // A turn stored on the present version is read by its chunk; a source the index no longer holds stays as stored.
  const present = entriesOf(bundles[KUUSALU]).slice(0, 2), presentPacket = { ...scope, evidence: present, model_context: modelProjection(present, scope).context };
  assert.deepEqual(replayContext(presentPacket, now, embeddingConfig()).evidence.map(item => item.read), ['same_version', 'same_version']);
  const gone = replayContext(packet, new Map([[bundles[MARJAMAA].document.id, bundles[MARJAMAA]]]), embeddingConfig());
  assert.deepEqual([gone.equal_without_legal_dates, gone.evidence[1].read, Object.keys(gone.sources)], [true, 'source_not_in_index', ['D1']]);
  // A context that is not the stored one apart from the dates is named by its place; a text the document no longer has stops the replay.
  const edited = structuredClone(packet); edited.model_context.evidence[1].text += ' Lisatud lause.'; edited.model_context.sources.D1.valid_from = '2026-09-01';
  const differs = replayContext(edited, now, embeddingConfig());
  assert.deepEqual([differs.equal_without_legal_dates, differs.differences], [false, ['sources.D1', 'evidence.S2']]);
  const lost = structuredClone(packet); lost.evidence[2].source_text = 'Määrus jõustub 1. juulil 2019.';
  assert.throws(() => replayContext(lost, now, embeddingConfig()), { code: 'replay_chunk_not_found', ref: 'S3' });
  // The script, offline: the packet file against the store. Exit 0 when every context is the stored one apart from the dates.
  const run = (...args) => spawnSync(process.execPath, ['--import', './scripts/register-node-source-loader.mjs', 'scripts/rag-v2-context-replay.mjs', ...args], { encoding: 'utf8' });
  await fs.writeFile(path.join(root, 'packet.json'), JSON.stringify({ packet })); await fs.writeFile(path.join(root, 'edited.json'), JSON.stringify(edited));
  const ok = run('--packet', path.join(root, 'packet.json'), '--store', path.join(root, 'store'));
  assert.equal(ok.status, 0, ok.stderr);
  const [turn] = JSON.parse(ok.stdout).turns;
  assert.deepEqual({ ...turn, turn: undefined, read_from: undefined }, { turn: undefined, read_from: undefined, stored_generation: 'generation-fixture', equal_without_legal_dates: true, differences: [],
    packet_bytes: replay.packet_bytes, tokens: replay.tokens, sources: replay.sources, evidence: replay.evidence });
  const bad = run('--packet', path.join(root, 'packet.json'), '--packet', path.join(root, 'edited.json'), '--store', path.join(root, 'store')), report = JSON.parse(bad.stdout);
  assert.equal(bad.status, 1); assert.deepEqual([report.ok, report.turns.map(item => item.equal_without_legal_dates)], [false, [true, false]]);
  for (const args of [[], ['--packet', path.join(root, 'packet.json')], ['--turn', 'a-turn', '--packet', path.join(root, 'packet.json'), '--store', path.join(root, 'store')]]) {
    const usage = run(...args);
    assert.equal(usage.status, 1); assert.deepEqual(JSON.parse(usage.stderr), { ok: false, code: 'context_replay_usage' });
  }
});

test('reader-compare: a stored version read again gives the same units, chunks, fields and metadata; a registry that is not the stored input fails', async () => {
  const manifest = path.join(root, 'manifest.json');
  await fs.writeFile(manifest, JSON.stringify({ tenant, acts: Object.entries(bundles).map(([act, bundle]) => ({ globaal_id: act, version_id: bundle.version.id, source_path: `oigusaktid/${act}.xml` })) }));
  const run = (...args) => spawnSync(process.execPath, ['scripts/rag-v2-reader-compare.mjs', ...args], { encoding: 'utf8' });
  const result = run('--store', path.join(root, 'store'), '--manifest', manifest, '--registry', root);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout), chunks = Object.values(bundles).reduce((sum, bundle) => sum + bundle.chunks.length, 0);
  assert.deepEqual({ ...report, notes: undefined }, { reader: DEFAULT_CONFIG.normalization, stored_normalizations: { [DEFAULT_CONFIG.normalization]: 2 }, acts: 2, identical_acts: 2,
    stored_chunks: chunks, embedding_inputs_already_stored: chunks, embedding_inputs_new: 0, registry_xml_differs_from_stored: 0, different: [], notes: undefined, position_unresolved_acts: [],
    in_force_before_publication_acts: [], act_in_force_before_publication_acts: [] });
  assert.deepEqual(report.notes, { unit_notes: 4, with_applies_from: 2, with_own_words: 2, repeals: 0, position_unresolved: 0, structure_notes: 3, history_entries: 5,
    acts_with_version_change: 2, acts_with_entry_into_force: 2, acts_with_adoption_note: 0, acts_without_act_in_force_from: 0 });
  // The re-ingest reads the registry. A register that names another municipality changes every chunk's retrieval text,
  // and so every embedding input, and the metadata the version is made from.
  const against = async (name, acts, options) => {
    await registry(path.join(root, name), acts, options);
    const result = run('--store', path.join(root, 'store'), '--manifest', manifest, '--registry', path.join(root, name)), report = JSON.parse(result.stdout);
    return [result.status, report.identical_acts, report.embedding_inputs_new, report.registry_xml_differs_from_stored, report.different.map(act => act.reasons)];
  };
  assert.deepEqual(await against('other', ACTS.map(([act]) => [act, 'teine_vald', 'Teine vald'])), [1, 0, chunks, 0, [['chunks', 'metadata'], ['chunks', 'metadata']]]);
  // The same name under another municipality ID leaves every chunk and embedding input the same and changes the act's
  // regions (the region filter, the source card): only the metadata tells, by its hash in the version ID.
  assert.deepEqual(await against('renamed', ACTS.map(([act, , name]) => [act, 'rapla_vald', name])), [1, 0, 0, 0, [['metadata'], ['metadata']]]);
  // A registry that does not name the act's file, or does not have it, proves nothing: the plan would not find the source.
  assert.deepEqual(await against('unlisted', ACTS, { sources: false }), [1, 2, 0, 2, []]);
  const absent = run('--store', path.join(root, 'store'), '--manifest', manifest, '--registry', path.join(root, 'store')), absentReport = JSON.parse(absent.stdout);
  assert.equal(absent.status, 1);
  assert.deepEqual([absentReport.identical_acts, absentReport.embedding_inputs_new, absentReport.registry_xml_differs_from_stored], [2, 0, 2]);
  // A field the reader reads differently from the stored version leaves the text and every chunk the same. Here the stored
  // ones are changed: Märjamaa's start is its publication day, and Kuusalu's validity has lost its open end, without which
  // the validity filter no longer takes the act as in force. Both are on the source card or in the validity filters.
  const altered = path.join(root, 'altered');
  await fs.cp(path.join(root, 'store'), altered, { recursive: true });
  const change = async (act, edit) => {
    const folder = path.join(altered, id('tenant', tenant), 'versions', bundles[act].version.id);
    const kept = JSON.parse(await fs.readFile(path.join(folder, 'bundle.json'), 'utf8')), files = JSON.parse(await fs.readFile(path.join(folder, 'manifest.json'), 'utf8'));
    edit(kept.document.fields);
    await fs.writeFile(path.join(folder, 'bundle.json'), JSON.stringify(kept));
    await fs.writeFile(path.join(folder, 'manifest.json'), JSON.stringify({ ...files, files: { ...files.files, 'bundle.json': hash(JSON.stringify(kept)) } }));
  };
  assert.equal(bundles[KUUSALU].document.fields.valid_to.open_end, true);
  await change(MARJAMAA, fields => { fields.valid_from.value = fields.publication_date.value; });
  await change(KUUSALU, fields => { fields.valid_to = { value: null, provenance: fields.valid_to.provenance.filter(source => source.basis !== 'validity_without_end') }; });
  const field = run('--store', altered, '--manifest', manifest, '--registry', root), fieldReport = JSON.parse(field.stdout);
  assert.equal(field.status, 1);
  assert.deepEqual([fieldReport.identical_acts, fieldReport.embedding_inputs_new, fieldReport.different.map(act => [act.act, act.reasons])],
    [0, 0, [[MARJAMAA, ['fields']], [KUUSALU, ['fields']]]]);
  const usage = run();
  assert.equal(usage.status, 1); assert.deepEqual(JSON.parse(usage.stderr), { ok: false, code: 'reader_compare_usage' });
});
