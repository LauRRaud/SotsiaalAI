import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { ingest } from '../lib/rag-v2/ingestion.js';
import { registeredSource } from '../lib/rag-v2/registered-source.js';
import { IngestBatchQueue } from '../lib/rag-v2/ingest-batch-postgres.js';
import { planIngestBatch, prepareNextBatchItem } from '../lib/rag-v2/ingest-batch.js';
import { createBatchReview, publishReviewedBatch } from '../lib/rag-v2/ingest-publication.js';
import { loadSnapshot } from '../lib/rag-v2/search/snapshot.js';
import { indexSnapshot } from '../lib/rag-v2/search/indexing.js';
import { QdrantIndex } from '../lib/rag-v2/search/qdrant.js';
import { MockEmbedding } from '../lib/rag-v2/search/embedding.js';
import { ESTNLTK_LEXICAL } from '../lib/rag-v2/search/morphology.js';
import { retrievalProfile } from '../lib/rag-v2/search/profiles.js';
import { RECORD_RETRIEVAL_VERSION } from '../lib/rag-v2/search/structured-record-source.js';
import { hash } from '../lib/rag-v2/contracts.js';
import { LEGACY_DISCOVERY_SCHEMA } from '../lib/rag-v2/search/discovery.js';
import { runtimeAdapters } from '../lib/rag-v2/pilot/retrieval.js';
import { DIALOGUE_VERSION } from '../lib/rag-v2/pilot/dialogue.js';
import { TYPED_DIALOGUE_STATE_VERSION } from '../lib/rag-v2/pilot/dialogue-state.js';
import { UNIFIED_RETRIEVAL_VERSION } from '../lib/rag-v2/pilot/retrieval-plan.js';
import { PilotService } from '../lib/rag-v2/pilot/service.js';
import { PilotStore } from '../lib/rag-v2/pilot/store.js';

const appUrl = new URL(process.env.M4_TEST_DATABASE_URL || 'postgres://invalid/invalid');
if (!['localhost', '127.0.0.1'].includes(appUrl.hostname) || appUrl.pathname !== '/sotsiaal_ai_m4_dev') throw Error('isolated app database required');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: appUrl.href }), log: [] });
const tenant = `unified-${randomUUID()}`, fetch = globalThis.fetch, connect = net.Socket.prototype.connect;
const embedding = new MockEmbedding(), regions = [{ region: 'harku_vald', names: ['Harku vald', 'Harku'] }, { region: 'kose_vald', names: ['Kose vald', 'Kose'] }];
let root, postgres, qdrant, snapshot, generation, legacyGeneration, connections, hiddenJournal;
const journals = [], savedEnv = { RAG_V2_QDRANT_URL: process.env.RAG_V2_QDRANT_URL, RAG_V2_QDRANT_KEY: process.env.RAG_V2_QDRANT_KEY };

async function journal(name, date) {
  const source_path = `${name}.pdf`;
  await fs.writeFile(path.join(root, source_path), `%PDF-1.4\n% Synthetic ${name}`);
  const result = await ingest({ tenant, inputRoot: root, storeRoot: path.join(root, 'store'),
    metadata: { document_id: name, title: name, source_path, source_type: 'journal_article', language: 'et',
      journalTitle: 'Sünteetiline väljaanne', ...(date ? { publication_date: date } : {}) },
    rights: { access: 'local_private', usage: 'development_only' }, profile: { id: 'generic', version: '1', months: [], categoryLabels: [] } },
  { parsePdf: async () => ({ info: {}, pages: [0, 1].map(i => ({ pdf_page: i + 1, parser_page_index: i, view: [0, 0, 600, 800],
    items: [{ text: `Sotsiaalne tugi ja igapäevane toimetulek. Sünteetiline allikas ${name}, osa ${i + 1}.`, item_index: 0, x: 40, y: 600, height: 12, width: 400 }] })) }) });
  journals.push(result.bundle); return result.bundle;
}

before(async () => {
  connections = JSON.parse(await fs.readFile('tmp/rag-v2-services/connections.json', 'utf8'));
  const pgUrl = new URL(connections.postgresUrl);
  assert.equal(pgUrl.hostname, '127.0.0.1'); assert.equal(pgUrl.pathname, '/rag_v2_dev');
  process.env.RAG_V2_QDRANT_URL = connections.qdrantUrl; process.env.RAG_V2_QDRANT_KEY = connections.qdrantKey || '';
  const ports = new Set([pgUrl.port, new URL(connections.qdrantUrl).port, appUrl.port || '5432']);
  globalThis.fetch = (input, options) => { assert.equal(new URL(typeof input === 'string' ? input : input.url).origin, connections.qdrantUrl); return fetch(input, options); };
  net.Socket.prototype.connect = function (...args) {
    const normalized = Array.isArray(args[0]) ? args[0] : args;
    const target = typeof normalized[0] === 'object' ? normalized[0] : { port: normalized[0], host: normalized[1] };
    assert(['localhost', '127.0.0.1'].includes(target.host)); assert(ports.has(String(target.port)));
    return connect.apply(this, args);
  };
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-unified-'));
  postgres = new IngestBatchQueue(connections.postgresUrl); qdrant = new QdrantIndex(connections.qdrantUrl, connections.qdrantKey);
  const inputs = [];
  for (const region of regions) {
    const items = [{ id: 'service', itemType: 'service', title: 'Koduse toe näidisteenus', summary: 'Sünteetiline abi igapäevastes toimingutes.',
      conditions: ['Näidistingimus'], relatedContacts: ['contact', 'hidden_contact'] },
    { id: 'contact', itemType: 'contact', name: 'Näidiskontakt', phone: '+372 0000000', email: 'contact@example.invalid' },
    { id: 'hidden_contact', itemType: 'contact', name: 'DO_NOT_EXPOSE_NAME', phone: 'DO_NOT_EXPOSE_PHONE' }]
      .map(item => ({ ...item, municipality_id: region.region, municipality_name: region.names[0],
        source_type: `municipal_${item.itemType}`, language: 'et', canonical_item_id: `${region.region}:${item.id}` }));
    const filename = `${region.region}.json`, bytes = JSON.stringify({ items }); await fs.writeFile(path.join(root, filename), bytes);
    for (const item of items) inputs.push(await registeredSource(root, { role: 'source', path: filename, sha256: hash(bytes) }, { itemId: item.id }));
  }
  const plan = await planIngestBatch({ tenant, inputRoot: root, inputs, rights: { access: 'local_private', usage: 'development_only' },
    profile: { id: 'generic', version: '1', months: [], categoryLabels: [] } });
  await postgres.enqueue(plan);
  const options = { tenant, inputRoot: root, storeRoot: path.join(root, 'store'), queue: postgres, batchId: plan.id };
  while (await prepareNextBatchItem(options)) { /* bounded synthetic corpus */ }
  const review = await createBatchReview(options); assert(review.items.every(item => !item.blockers.length));
  review.reviewed_by = 'synthetic-reviewer';
  for (const item of review.items) { item.decision = 'include'; item.note = 'Fictional local software fixture.'; }
  await publishReviewedBatch({ ...options, review });
  for (const year of [2010, 2014, 2020, 2024, 1990, 1991, 1992, 1993, 1994]) await journal(`journal-${year}`, `${year}-06-01`);
  await journal('undated', null); hiddenJournal = await journal('private-journal', '2012-06-01');
  snapshot = await loadSnapshot(options.storeRoot, tenant, [...review.items.map(item => item.document_id), ...journals.map(bundle => bundle.document.id)]);
  await indexSnapshot({ snapshot, postgres, qdrant, embedding, lexical: ESTNLTK_LEXICAL, directory: LEGACY_DISCOVERY_SCHEMA });
  legacyGeneration = await postgres.active(tenant);
  const calls = embedding.calls;
  const reindexed = await indexSnapshot({ snapshot, postgres, qdrant, embedding, lexical: ESTNLTK_LEXICAL }); generation = await postgres.active(tenant);
  assert.notEqual(generation.id, legacyGeneration.id); assert.equal(reindexed.mock_vectors_created, 0); assert.equal(embedding.calls, calls);
  assert.equal((await postgres.bundles(tenant, legacyGeneration.id, [journals[0].document.id]))[0].version.id, journals[0].version.id);
});

after(async () => {
  try {
    if (generation) await qdrant.request(`/collections/${generation.collection}`, 'DELETE');
    if (legacyGeneration) await qdrant.request(`/collections/${legacyGeneration.collection}`, 'DELETE');
    for (const table of ['rag_v2_ingest_item', 'rag_v2_ingest_batch', 'rag_v2_unit', 'rag_v2_generation_document', 'rag_v2_head',
      'rag_v2_generation', 'rag_v2_object', 'rag_v2_version', 'rag_v2_document', 'rag_v2_vector_cache']) await postgres?.pool.query(`DELETE FROM ${table} WHERE tenant=$1`, [tenant]);
  } finally {
    await db.$disconnect(); await postgres?.close(); globalThis.fetch = fetch; net.Socket.prototype.connect = connect;
    for (const [key, value] of Object.entries(savedEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    if (root) {
      assert(path.dirname(path.resolve(root)) === path.resolve(os.tmpdir()) && path.basename(root).startsWith('rag-unified-'));
      await fs.rm(root, { recursive: true, force: true });
    }
  }
});

async function fixture(t) {
  const user = await db.user.create({ data: { email: `unified-${randomUUID()}@example.invalid` } });
  const conv = await db.conversation.create({ data: { userId: user.id, role: 'CLIENT', metadata: { m4: true }, expiresAt: null } });
  const config = { id: randomUUID(), configHash: randomUUID(), tenant, mode: 'real', users: [user.id], generationId: generation.id,
    documents: Object.fromEntries(snapshot.bundles.filter(bundle => bundle.document.id !== hiddenJournal.document.id).map(bundle => [bundle.document.id, bundle.version.id])),
    profile: retrievalProfile(), recordCatalogue: RECORD_RETRIEVAL_VERSION, dialogueVersion: DIALOGUE_VERSION,
    dialogueStateVersion: TYPED_DIALOGUE_STATE_VERSION, retrievalRouting: UNIFIED_RETRIEVAL_VERSION,
    embedding: embedding.config, model: 'synthetic-transport', reasoning: 'medium', maxInputTokens: 128000, maxOutputTokens: 4096,
    retentionHours: null, expiresAt: null, prices: { embeddingInput: 1, answerInput: 1, answerOutput: 1 },
    budget: { attempts: 16, embeddingAttempts: 8, answerAttempts: 8, tokens: 3000000, nanoUsd: 3000000 } };
  t.after(async () => { await db.user.delete({ where: { id: user.id } }); await db.m4PilotLedger.deleteMany({ where: { id: config.id } }); });
  class Catalog extends IngestBatchQueue { constructor() { super(connections.postgresUrl); } }
  const adapters = runtimeAdapters(async () => config, user.id, { Catalog, loadRegions: async () => regions,
    authorizeContact: async ({ record }) => record.aliases.includes('contact') });
  const calls = [], inputs = [];
  let state = { facts: [], needs: [], unknowns: [], region: { id: null, status: 'unknown', support: [] }, periods: [], language_hint: 'et' };
  const service = new PilotService({ store: new PilotStore(db), readConfig: async () => config, adapters, call: async ({ stage, body }) => {
    calls.push(stage);
    if (stage === 'embedding') return { value: await embedding.embed(body.input), usage: { input: 20, output: 0 } };
    const input = JSON.parse(body.input[0].content); inputs.push(input);
    const periods = input.evidence.retrieval.lanes.filter(lane => lane.kind === 'publication_period');
    const refs = periods.length ? periods.flatMap(lane => lane.refs.slice(0, 1))
      : state.region.id ? input.evidence.records.entries.find(entry => entry.kind === 'service').fields.summary.refs
        : input.evidence.retrieval.lanes.find(lane => lane.kind === 'knowledge').refs.slice(0, 1);
    return { value: { kind: refs.length ? 'grounded' : 'clarification', blocks: refs.length ? [{ text: 'Sünteetiline transpordivastus.', factual: true, refs }] : [],
      limitations: [], clarification: refs.length ? null : 'Millist ajavahemikku silmas pead?', dialogue_state: structuredClone(state) },
    usage: { input: 20, output: 40 }, requestId: 'synthetic-unified-answer' };
  } });
  return { config, service, adapters, calls, inputs, setState: value => { state = value; },
    run: (question, contextMode = 'same') => service.run(user.id, { question, contextMode, convId: conv.id, clientTurnKey: randomUUID(), language: 'et' }),
    row: id => db.m4PilotTurn.findUnique({ where: { id } }), empty: () => ({ ...state, region: { id: null, status: 'unknown', support: [] }, periods: [] }) };
}

test('one dialogue moves from journals to local support to two publication periods; one embedding and answer per turn, canonical links stay valid', async t => {
  const f = await fixture(t);
  await f.run('Mida kirjeldavad allikad sotsiaalse toe kohta?', 'new');
  f.setState({ ...f.empty(), region: { id: 'harku_vald', status: 'reported', support: [{ turn: 2, quote: 'Elan Harkus' }] } });
  await f.run('Elan Harkus ja vajan kodus abi.');
  f.setState({ ...f.empty(), region: { id: 'kose_vald', status: 'reported', support: [{ turn: 3, quote: 'Kose vallas' }] } });
  await f.run('Nüüd Kose vallas.', 'correction');
  const periods = [{ basis: 'publication', from: '2010-01-01', to: '2014-12-31', support: [{ turn: 4, quote: '2010–2014' }] },
    { basis: 'publication', from: '2020-01-01', to: '2024-12-31', support: [{ turn: 4, quote: '2020–2024' }] }];
  f.setState({ ...f.empty(), periods });
  const comparison = await f.run('Võrdle sotsiaalset tuge 2010–2014 ja 2020–2024.');
  await f.run('Selgita nende perioodide erinevust lihtsamalt.');
  f.setState(f.empty());
  await f.run('Ära piira ilmumisaega.', 'correction');
  await f.run('Mida veel kirjeldatakse?');
  assert.deepEqual(f.calls, Array.from({ length: 7 }, () => ['embedding', 'answer']).flat());
  assert(f.inputs.every(input => /^\d{4}-\d{2}-\d{2}$/.test(input.dialogue.stateContext.asOfDateUTC)));
  assert(f.inputs[0].evidence.retrieval.lanes[0].refs.length > 0);
  assert(f.inputs[1].evidence.records.entries.every(entry => entry.region === 'harku_vald'));
  assert(f.inputs[2].evidence.records.entries.every(entry => entry.region === 'kose_vald'));
  assert(f.inputs[3].evidence.retrieval.lanes.filter(lane => lane.kind === 'publication_period').every(lane => lane.refs.length > 0));
  const compared = f.inputs[3].evidence.retrieval.lanes.filter(lane => lane.kind === 'publication_period');
  assert.deepEqual(compared.map(lane => lane.coverage.indexed_documents), [2, 2]);
  assert(compared.every(lane => lane.coverage.missing_publication_date_documents === 1));
  assert(f.inputs[4].evidence.retrieval.lanes.filter(lane => lane.kind === 'publication_period').every(lane => lane.period.basis === 'publication'));
  assert.equal(f.inputs[4].evidence.records.scope.region, null);
  for (const input of f.inputs.slice(5)) assert.equal(input.evidence.retrieval.lanes.filter(lane => lane.kind === 'publication_period').length, 0);
  assert.doesNotMatch(JSON.stringify(f.inputs), /DO_NOT_EXPOSE|private-journal/);
  const row = await f.row(comparison.id);
  for (const block of row.payload.answer.blocks) for (const ref of block.refs) {
    assert.equal((await f.adapters.canonical(f.config, row.payload.packet, ref)).evidence_id, row.payload.packet.reference_map[ref].evidence_id);
  }
  assert.equal((await f.service.restore(row)).state, 'completed');
});

test('empty period stays explicit and revoking an unselected counted document blocks stored coverage before reuse', async t => {
  const f = await fixture(t);
  const result = await f.run('Võrdle 1800–1801 ja 2010–2014.', 'new'), row = await f.row(result.id);
  const periods = row.payload.packet.retrieval_context.lanes.filter(lane => lane.kind === 'publication_period');
  assert.equal(periods[0].coverage.indexed_documents, 0); assert.deepEqual(periods[0].refs, []);
  const selected = new Set(row.payload.packet.evidence.map(entry => entry.document_id));
  const unseen = journals.find(bundle => f.config.documents[bundle.document.id] && !selected.has(bundle.document.id));
  assert(unseen, 'fixture must include a counted document that was not selected as evidence');
  delete f.config.documents[unseen.document.id];
  await assert.rejects(f.service.restore(row), { code: 'unified_scope_changed' });
  assert.deepEqual(f.calls, ['embedding', 'answer']);
});
