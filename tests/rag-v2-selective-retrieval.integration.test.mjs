import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { ingest } from '../lib/rag-v2/ingestion.js';
import { KNOWLEDGE_SCHEMA } from '../lib/rag-v2/knowledge.js';
import { PostgresCatalog } from '../lib/rag-v2/search/postgres.js';
import { QdrantIndex } from '../lib/rag-v2/search/qdrant.js';
import { MockEmbedding } from '../lib/rag-v2/search/embedding.js';
import { loadSnapshot } from '../lib/rag-v2/search/snapshot.js';
import { indexSnapshot } from '../lib/rag-v2/search/indexing.js';
import { retrieve } from '../lib/rag-v2/search/retrieval.js';
import { LocalPolicy } from '../lib/rag-v2/search/policy.js';
import { hash, stable } from '../lib/rag-v2/contracts.js';

const tenant = `selective-${randomUUID()}`, embedding = new MockEmbedding(), log = [];
let root, postgres, qdrant, generation, policy, base, guide, exception, unrelated, snapshot;
const savedFetch = globalThis.fetch;
const anchor = (quote, page) => ({ quote, pdf_page: page });
const card = (key, quote, page, kind = 'assertion') => ({ key, kind, statement: quote,
  scope: 'Synthetic software fixture', anchors: [anchor(quote, page)] });
const texts = { seed: 'Orchidmarker identifies a fictional gardening activity for this software fixture.',
  link: 'The activity requires the separate condition described in a different document.',
  condition: 'This is a fictional dry condition. No real eligibility decision is made here.',
  exception: 'A separate fictional exception qualifies the activity under circumstances that are not known.' };
async function source(name, pages, knowledge, metadata = {}) {
  const source_path = `${name}.pdf`;
  await fs.writeFile(path.join(root, source_path), `%PDF-1.4\n% ${name}`);
  return (await ingest({ tenant, inputRoot: root, storeRoot: path.join(root, 'store'),
    metadata: { document_id: name, title: name, source_type: 'synthetic', source_path, language: 'en',
      publication_date: '2025-05-01', ...(knowledge ? { knowledge } : {}), ...metadata },
    rights: { access: 'local_private', usage: 'development_only' },
    profile: { id: 'synthetic', version: '1', months: [], categoryLabels: [] }, config: { chunkMaxChars: 160 } },
  { parsePdf: async () => ({ info: {}, pages: pages.map((text, i) => ({ pdf_page: i + 1, parser_page_index: i,
    view: [0, 0, 600, 800], items: [{ text, item_index: 0, x: 50, y: 700, height: 12, width: 400 }] })) }) })).bundle;
}
before(async () => {
  const connections = JSON.parse(await fs.readFile('tmp/rag-v2-services/connections.json', 'utf8'));
  postgres = new PostgresCatalog(connections.postgresUrl); qdrant = new QdrantIndex(connections.qdrantUrl, connections.qdrantKey);
  globalThis.fetch = (input, options) => {
    assert.equal(new URL(typeof input === 'string' ? input : input.url).origin, connections.qdrantUrl, 'Local Qdrant only');
    return savedFetch(input, options);
  };
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-selective-'));
  guide = await source('guide', [texts.condition], { schema_version: KNOWLEDGE_SCHEMA,
    cards: [card('condition', texts.condition, 1, 'condition')], dependencies: [] });
  base = await source('base', [texts.seed, texts.link], { schema_version: KNOWLEDGE_SCHEMA,
    cards: [card('activity', texts.seed, 1)], dependencies: [{ key: 'requires', type: 'REQUIRES', from: 'activity', operator: 'all',
      scope: 'Synthetic software fixture', anchors: [anchor(texts.link, 2)],
      targets: [{ key: 'condition', document_id: guide.document.id, version_id: guide.version.id }] }] });
  exception = await source('exception', [texts.exception], { schema_version: KNOWLEDGE_SCHEMA,
    cards: [card('exception', texts.exception, 1, 'exception')], dependencies: [{ key: 'exception', type: 'EXCEPTION_TO', from: 'exception', operator: 'all',
      scope: 'Synthetic software fixture', anchors: [anchor(texts.exception, 1)],
      targets: [{ key: 'activity', document_id: base.document.id, version_id: base.version.id }] }] });
  const bundles = [base, guide, exception];
  for (let i = 0; i < 9; i++) bundles.push(await source(`unrelated${i}`, [`Astronomymarker${i} discusses an unrelated fictional planet.`], undefined,
    { publication_date: '2010-01-01' }));
  unrelated = bundles.at(-1);
  const documents = bundles.map(bundle => bundle.document.id);
  snapshot = await loadSnapshot(path.join(root, 'store'), tenant, documents);
  await indexSnapshot({ snapshot, postgres, qdrant, embedding }); generation = await postgres.active(tenant);
  policy = new LocalPolicy({ tenants: { [tenant]: { operator: documents } } });
  for (const method of ['bundles', 'units']) {
    const original = postgres[method].bind(postgres);
    postgres[method] = async (...args) => { log.push({ method, documents: args[2] }); return original(...args); };
  }
});
after(async () => {
  if (generation) await qdrant.request(`/collections/${generation.collection}`, 'DELETE');
  if (postgres) {
    for (const table of ['rag_v2_unit', 'rag_v2_generation_document', 'rag_v2_head', 'rag_v2_generation', 'rag_v2_object', 'rag_v2_version', 'rag_v2_document', 'rag_v2_vector_cache']) {
      await postgres.pool.query(`DELETE FROM ${table} WHERE tenant=$1`, [tenant]);
    }
    await postgres.close();
  }
  globalThis.fetch = savedFetch;
  if (root) {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir())); assert(path.basename(root).startsWith('rag-v2-selective-'));
    await fs.rm(root, { recursive: true, force: true });
  }
});
function run(query = {}, deps = {}) {
  log.length = 0;
  return retrieve({ postgres, qdrant, embedding, policy, context: { tenant, subject: 'operator', usage: 'development_only' },
    query: { text: 'orchidmarker', language: 'en', method: 'lexical', contextMode: 'compact', semanticGraph: true,
      finalLimit: 9, limits: { topK: 1, candidates: 1, perDocument: 9, contextTokens: 6000, dependencyAdditions: 8 }, ...query }, ...deps });
}

test('only hit and dependency documents are loaded; forward condition and incoming exception match the eager result', async () => {
  const packet = await run(); assert.equal(packet.state, 'ok', packet.error);
  assert.equal(packet.measurements.loading.strategy, 'candidate_documents');
  assert.equal(packet.selection_config.version, 'selection-v4-lazy-dependencies');
  assert.equal(packet.selection_config.dependency_document_limit, 16);
  assert.equal(packet.measurements.loading.directory_documents, 12); assert.equal(packet.measurements.loading.loaded_documents, 3);
  assert.equal(packet.measurements.loading.loaded_units, 4);
  assert.deepEqual(new Set(log.flatMap(row => row.documents)), new Set([base.document.id, guide.document.id, exception.document.id]));
  assert.equal(packet.model_context.dependencies.known_context, 'included');
  assert.deepEqual(new Set(packet.model_context.dependencies.relations.map(edge => edge.type)), new Set(['REQUIRES', 'EXCEPTION_TO']));
  assert(packet.model_context.dependencies.relations.every(edge => edge.applicability === 'unknown'));
  const eager = Object.create(postgres); eager.retrievalDirectory = undefined;
  const reference = await run({}, { postgres: eager });
  assert.equal(reference.state, 'ok', reference.error);
  assert.equal(reference.selection_config.version, 'selection-v3-dependencies');
  assert.deepEqual(packet.model_context, reference.model_context); assert.deepEqual(packet.evidence, reference.evidence);
  assert.deepEqual(packet.raw_rankings, reference.raw_rankings);
  assert.equal(reference.measurements.loading.loaded_documents, 12);
});
test('empty search and document filters avoid full source reads; filters apply before candidate limits', async () => {
  for (const query of [{ text: 'missinguniquephrase' }, { filters: { publication_to: '2000-01-01' } }, { filters: { region: 'unknown' } }, { filters: { valid_at: '2025-01-01' } }]) {
    const packet = await run(query); assert.equal(packet.state, 'empty', packet.error); assert.equal(log.length, 0);
  }
  const packet = await run({ filters: { publication_from: '2025-01-01', publication_to: '2025-12-31' } });
  assert.equal(packet.state, 'ok', packet.error); assert.equal(packet.measurements.loading.loaded_documents, 3);
  assert.equal(Object.keys(packet.corpus.documents).length, 3);
});
test('unrelated source text is not read, but a corrupt selected source fails closed', async () => {
  await postgres.pool.query("UPDATE rag_v2_version SET bundle=jsonb_set(bundle,'{chunks,0,source_text}','\"Corrupted unrelated content\"') WHERE tenant=$1 AND id=$2", [tenant, unrelated.version.id]);
  try {
    const packet = await run(); assert.equal(packet.state, 'ok', packet.error);
    const broken = await run({ text: 'astronomymarker8', semanticGraph: false });
    assert.equal(broken.error, 'source_integrity_failed'); assert.deepEqual(broken.evidence, []); assert.equal(broken.model_context, null);
  } finally { await postgres.pool.query('UPDATE rag_v2_version SET bundle=$3 WHERE tenant=$1 AND id=$2', [tenant, unrelated.version.id, unrelated]); }
});
test('directory corruption is detected, including a rehashed false filter when the document is selected', async () => {
  const saved = (await postgres.pool.query('SELECT retrieval_directory,retrieval_hash FROM rag_v2_generation_document WHERE tenant=$1 AND generation_id=$2 AND document_id=$3', [tenant, generation.id, base.document.id])).rows[0];
  const changed = structuredClone(saved.retrieval_directory); changed.fields.publication_date.value = '2099-01-01';
  try {
    await postgres.pool.query('UPDATE rag_v2_generation_document SET retrieval_directory=$4 WHERE tenant=$1 AND generation_id=$2 AND document_id=$3', [tenant, generation.id, base.document.id, changed]);
    assert.equal((await run()).error, 'retrieval_directory_integrity_failed');
    await postgres.pool.query('UPDATE rag_v2_generation_document SET retrieval_hash=$4 WHERE tenant=$1 AND generation_id=$2 AND document_id=$3', [tenant, generation.id, base.document.id, hash(stable(changed))]);
    assert.equal((await run()).error, 'retrieval_directory_integrity_failed');
  } finally { await postgres.pool.query('UPDATE rag_v2_generation_document SET retrieval_directory=$4,retrieval_hash=$5 WHERE tenant=$1 AND generation_id=$2 AND document_id=$3', [tenant, generation.id, base.document.id, saved.retrieval_directory, saved.retrieval_hash]); }
});
test('missing selected units, object tampering and forged channel scope cannot produce evidence', async () => {
  const rows = await postgres.units(tenant, generation.id, [base.document.id]), unit = rows[1];
  await postgres.pool.query("UPDATE rag_v2_unit SET body='changed' WHERE tenant=$1 AND generation_id=$2 AND id=$3", [tenant, generation.id, unit.id]);
  try { assert.equal((await run()).error, 'index_unit_integrity_failed'); }
  finally { await postgres.pool.query('UPDATE rag_v2_unit SET body=$4 WHERE tenant=$1 AND generation_id=$2 AND id=$3', [tenant, generation.id, unit.id, unit.body]); }
  const object = base.spans[0];
  await postgres.pool.query("UPDATE rag_v2_object SET data=jsonb_set(data,'{source_text}','\"changed\"') WHERE tenant=$1 AND version_id=$2 AND id=$3", [tenant, base.version.id, object.id]);
  try { assert.equal((await run()).error, 'source_object_integrity_failed'); }
  finally { await postgres.pool.query('UPDATE rag_v2_object SET data=$4 WHERE tenant=$1 AND version_id=$2 AND id=$3', [tenant, base.version.id, object.id, object]); }
  const incomplete = Object.create(postgres); incomplete.units = async (...args) => (await postgres.units(...args)).filter(row => row.id !== unit.id);
  assert.equal((await run({}, { postgres: incomplete })).error, 'missing_generation_units');
  const forged = Object.create(postgres); forged.lexical = async () => [{ id: 'unit-not-in-generation', score: 1 }];
  assert.equal((await run({}, { postgres: forged })).error, 'channel_result_outside_scope'); assert.equal(log.length, 0);
});
test('hybrid, vector and structural expansion keep the same ranking and evidence with actual local Qdrant', async () => {
  const eager = Object.create(postgres); eager.retrievalDirectory = undefined;
  for (const method of ['vector', 'hybrid', 'lexical']) {
    const query = { method, semanticGraph: false, graph: true };
    const selective = await run(query), old = await run(query, { postgres: eager });
    assert.equal(selective.state, 'ok', selective.error); assert.equal(old.state, 'ok', old.error);
    assert.deepEqual(selective.raw_rankings, old.raw_rankings); assert.deepEqual(selective.evidence, old.evidence);
    assert(selective.measurements.loading.loaded_documents < old.measurements.loading.loaded_documents);
  }
});
test('generation pin survives an active-pointer change and directory reads cannot cross tenants', async () => {
  try {
    const packet = await run({}, { hooks: { afterPin: async () => {
      await postgres.pool.query('UPDATE rag_v2_head SET active_id=NULL WHERE tenant=$1', [tenant]);
    } } });
    assert.equal(packet.state, 'ok', packet.error); assert.equal(packet.generation_id, generation.id);
    assert.deepEqual(await postgres.retrievalDirectory('other-tenant', generation, []), []);
    await assert.rejects(postgres.retrievalDirectory('other-tenant', generation, [base.document.id]), { code: 'missing_generation_source' });
  } finally { await postgres.pool.query('UPDATE rag_v2_head SET active_id=$2 WHERE tenant=$1', [tenant, generation.id]); }
});
test('denied dependency documents are never hydrated; mid-query revocation removes text, references and relation IDs', async () => {
  const original = policy.value.tenants[tenant].operator;
  try {
    policy.value.tenants[tenant].operator = [base.document.id];
    const denied = await run(); assert.equal(denied.state, 'ok', denied.error);
    assert.equal(denied.measurements.loading.loaded_documents, 1); assert.equal(denied.model_context.dependencies.known_context, 'incomplete');
    assert(!JSON.stringify(denied).includes(texts.condition)); assert(!JSON.stringify(denied).includes(texts.exception));
    policy.value.tenants[tenant].operator = original;
    const revoked = await run({}, { hooks: { beforePolicyCheck: async () => { policy.value.tenants[tenant].operator = [base.document.id]; } } });
    for (const hidden of [texts.condition, texts.exception, exception.dependencies[0].id]) assert(!JSON.stringify(revoked).includes(hidden));
    assert.equal(revoked.model_context.dependencies.known_context, 'incomplete');
  } finally { policy.value.tenants[tenant].operator = original; }
});
test('dependency loading respects its budget and reports an incomplete context', async () => {
  const packet = await run({ limits: { topK: 1, candidates: 1, perDocument: 9, contextTokens: 6000, dependencySteps: 1, dependencyAdditions: 8 } });
  assert.equal(packet.state, 'ok', packet.error); assert(packet.measurements.loading.loaded_documents <= 2);
  assert.equal(packet.model_context.dependencies.known_context, 'incomplete');
  assert(packet.model_context.dependencies.unresolved.some(item => item.reason === 'dependency_document_limit'));
});
test('legacy directories fall back safely and reindexing upgrades them without generating new vectors', async () => {
  await postgres.pool.query('UPDATE rag_v2_generation_document SET retrieval_directory=NULL,retrieval_hash=NULL WHERE tenant=$1 AND generation_id=$2', [tenant, generation.id]);
  const old = await run(); assert.equal(old.state, 'ok', old.error); assert.equal(old.measurements.loading.strategy, 'legacy_eager');
  const calls = embedding.calls;
  const indexed = await indexSnapshot({ snapshot, postgres, qdrant, embedding });
  assert.equal(indexed.mock_vectors_created, 0); assert.equal(embedding.calls, calls);
  const next = await run(); assert.equal(next.state, 'ok', next.error); assert.equal(next.measurements.loading.loaded_documents, 3);
  assert.deepEqual(next.model_context, old.model_context);
});
