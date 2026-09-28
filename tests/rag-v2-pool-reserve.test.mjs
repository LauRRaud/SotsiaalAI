import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { id, hash, stable } from '../lib/rag-v2/contracts.js';
import { MockEmbedding, indexUnit } from '../lib/rag-v2/search/embedding.js';
import { LocalPolicy } from '../lib/rag-v2/search/policy.js';
import { searchConfig } from '../lib/rag-v2/search/indexing.js';
import { retrieve, RERANK_POOL } from '../lib/rag-v2/search/retrieval.js';
import { retrievalDirectory } from '../lib/rag-v2/search/discovery.js';
import { validateQuery } from '../lib/rag-v2/search/ranking.js';
import { unifiedDirectory, nationalLegalText } from '../lib/rag-v2/search/unified.js';

// ADR-032: a national legal text's candidates get reserved places in the rerank pool when many
// municipal texts outrank them. Synthetic sources only; no network.
const savedFetch = globalThis.fetch, savedConnect = net.Socket.prototype.connect;
let network = 0;
before(() => {
  globalThis.fetch = () => { network++; throw Error('unexpected_network'); };
  net.Socket.prototype.connect = () => { network++; throw Error('unexpected_network'); };
});
after(() => { globalThis.fetch = savedFetch; net.Socket.prototype.connect = savedConnect; assert.equal(network, 0); });

const tenant = 'reserve-synthetic';
function source(doc, count, text, fields = {}) {
  const version = `${doc}-v1`;
  const spans = Array.from({ length: count }, (_, i) => ({ id: `${doc}-s${i}`, tenant_id: tenant, document_version_id: version,
    pdf_page: 1, start: i * 80, source_text: `${text} ${i}.` }));
  const chunks = spans.map((span, i) => ({ id: `${doc}-c${i}`, ordinal: i, parent_section_id: `${doc}-section`, span_ids: [span.id], pdf_pages: [1],
    source_text: span.source_text, retrieval_text: span.source_text, retrieval_mapping: { prefix_length: 0 } }));
  return { tenant_id: tenant, version: { id: version, pdf_hash: 'a'.repeat(64) },
    document: { id: doc, rights: { access: 'local_private', usage: 'development_only' }, search_aids: {}, fields: {
      title: { value: `Title ${doc}` }, authors: { value: [] }, publication_date: { value: null }, ...fields } },
    spans, chunks, report: { warnings: [] }, sections: [{ id: `${doc}-section`, parent_id: null, title: `Title ${doc}`, span_ids: [spans[0].id] }],
    relations: chunks.flatMap(c => [{ id: `belongs-${c.id}`, type: 'BELONGS_TO', from_id: c.id, to_id: doc },
      { id: `parent-${c.id}`, type: 'PARENT_SECTION', from_id: c.id, to_id: `${doc}-section` }]) };
}

function fixture({ lawFirst = false } = {}) {
  const embedding = new MockEmbedding(), config = searchConfig(embedding.config);
  // Forty municipal passages on appeals outrank every passage of the national law in both channels.
  const municipal = source('municipal', 40, 'A municipal regulation on contesting a benefit decision, paragraph',
    { regions: { value: ['synthetic_parish'] }, valid_from: { value: '2024-01-01' }, valid_to: { value: null, open_end: true } });
  const law = source('law', 4, 'The national act on administrative procedure: a challenge is filed within thirty days, section',
    { regions: { value: [] }, valid_from: { value: '2024-01-01' }, valid_to: { value: '2026-12-31' } });
  const act = source('act', 3, 'A second national act on social benefits, section',
    { regions: { value: [] }, valid_from: { value: '2025-01-01' }, valid_to: { value: null, open_end: true } });
  const guide = source('guide', 2, 'A guide without validity dates, page');
  const bundles = [municipal, law, act, guide];
  const documents = Object.fromEntries(bundles.map(b => [b.document.id, { version_id: b.version.id }]));
  const snapshot = { source_generation: 'source-v1', documents, snapshot_hash: hash(stable(documents)) };
  const generation = { id: id('search_generation', tenant, snapshot, config), config, snapshot };
  const units = bundles.flatMap(b => b.chunks.map(c => indexUnit(c, b, embedding.config)));
  const ranked = ['municipal', 'guide', 'law', 'act'], byDoc = doc => units.filter(u => u.document_id === doc);
  const order = (lawFirst ? ['law', 'act', 'municipal', 'guide'] : ranked).flatMap(byDoc);
  const calls = { lexical: [], vector: [] };
  const rows = (docs, limit, ids) => order.filter(u => docs.includes(u.document_id) && (!ids || ids.includes(u.id))).slice(0, limit)
    .map((u, i) => ({ ...u, score: 100 - i }));
  const postgres = {
    active: async () => generation,
    retrievalDirectory: async () => bundles.map(b => retrievalDirectory(b, embedding.config)),
    bundles: async (_t, _g, docs) => bundles.filter(b => docs.includes(b.document.id)),
    units: async (_t, _g, docs) => units.filter(u => docs.includes(u.document_id)),
    lexical: async (_t, _g, docs, _text, limit, ids) => { calls.lexical.push(docs); return rows(docs, limit, ids); },
  };
  const qdrant = { query: async (_g, docs, _v, limit, ids) => { calls.vector.push(docs); return rows(docs, limit, ids); } };
  const policy = new LocalPolicy({ tenants: { [tenant]: { operator: bundles.map(b => b.document.id) } } });
  const context = { tenant, subject: 'operator', usage: 'development_only' };
  const query = extra => ({ text: 'How do I contest a decision?', language: 'en', includeDocumentLabels: false,
    limits: { topK: 5, perDocument: 5, candidates: 40, contextTokens: 6000 }, ...extra });
  const run = (extra, hooks) => retrieve({ postgres, qdrant, embedding, policy, context, query: query(extra), allowLexicalFallback: false, hooks });
  return { bundles, units, calls, run, postgres };
}

test('the national-law group is the legal acts with a validity start and no municipality', () => {
  const f = fixture(), directories = f.bundles.map(b => retrievalDirectory(b, new MockEmbedding().config));
  assert.deepEqual(unifiedDirectory(directories).nationalLaw.map(row => row.document_id), ['law', 'act']);
  assert.deepEqual(directories.filter(nationalLegalText).map(row => row.document_id), ['law', 'act']);
});

test('reserved places put the national law before the reranker when municipal passages fill the pool', async () => {
  const f = fixture(), seen = [];
  const rerank = async passages => { seen.push(passages); return passages.filter(p => p.title === 'Title law').map(p => p.id).slice(0, 2); };
  const plain = await f.run({}, { rerank });
  assert.equal(plain.state, 'empty', plain.error);
  assert.equal(seen[0].length, RERANK_POOL); assert(!seen[0].some(p => p.title === 'Title law'));
  assert.equal(plain.evidence.length, 0, 'without the reserve the reranker never sees the law');

  const reserved = await f.run({ poolReserve: { documents: ['law', 'law', 'unknown'], size: 3 } }, { rerank });
  assert.equal(reserved.state, 'ok', reserved.error);
  const passages = seen[1];
  assert.equal(passages.length, RERANK_POOL + 3);
  assert.deepEqual(passages.slice(RERANK_POOL).map(p => [p.id, p.title]), [['P31', 'Title law'], ['P32', 'Title law'], ['P33', 'Title law']]);
  assert.deepEqual(reserved.evidence.map(e => e.chunk_id), ['law-c0', 'law-c1']);
  assert.deepEqual(reserved.rerank.reserved, reserved.rerank.candidates.slice(RERANK_POOL));
  assert.deepEqual(Object.keys(reserved.evidence[0].selection.ranks).sort(), ['reserve_lexical', 'reserve_vector']);
  assert.deepEqual(reserved.selection_config.pool_reserve, { documents: 1, size: 3, per_document: 3 });
  assert(reserved.channels.includes('pool_reserve'));
  assert.equal(reserved.measurements.candidate_counts.reserve_lexical, 4);
  assert.deepEqual(f.calls.lexical.at(-1), ['law']);
  assert.equal(reserved.measurements.mock_embedding_calls, 1, 'the reserve reuses the question vector');

  // At most perDocument places per act: the second act gets the places the first cannot take.
  const spread = await f.run({ poolReserve: { documents: ['law', 'act'], size: 4, perDocument: 2 } }, { rerank });
  assert.deepEqual(seen[2].slice(RERANK_POOL).map(p => p.title), ['Title law', 'Title law', 'Title act', 'Title act']);
  assert.deepEqual(spread.rerank.reserved.length, 4);
});

test('the reserve adds only candidates outside the pool and is unused without a reranker', async () => {
  const seen = [], rerank = async passages => { seen.push(passages); return ['P1']; };
  // The corpus-wide order already has the law in the pool: nothing is added twice.
  const leading = await fixture({ lawFirst: true }).run({ poolReserve: { documents: ['law', 'act'], size: 3 } }, { rerank });
  assert.equal(leading.state, 'ok', leading.error);
  assert.deepEqual(leading.rerank.reserved, []);
  assert.equal(seen[0].length, RERANK_POOL); assert.equal(new Set(seen[0].map(p => p.text)).size, RERANK_POOL);
  const f = fixture();

  const calls = f.calls.lexical.length;
  const without = await f.run({ poolReserve: { documents: ['law'], size: 3 } });
  const baseline = await f.run({});
  assert.equal(f.calls.lexical.length, calls + 2, 'no reserve search without a reranker');
  assert.deepEqual(without.evidence, baseline.evidence);
  assert.equal(without.selection_config.pool_reserve, undefined);
});

test('a reserve search result outside the reserved documents stops the search', async () => {
  const f = fixture(), lexical = f.postgres.lexical;
  f.postgres.lexical = async (t, g, docs, text, limit, ids) => docs.length === 1 ? (await lexical(t, g, ['municipal', 'guide', 'law', 'act'], text, limit)).slice(0, 2) : lexical(t, g, docs, text, limit, ids);
  const packet = await f.run({ poolReserve: { documents: ['law'], size: 3 } }, { rerank: async () => ['P1'] });
  assert.equal(packet.state, 'error'); assert.equal(packet.error, 'channel_result_outside_scope');
});

test('pool reserve input is bounded', () => {
  const base = { text: 'x', language: 'et' };
  for (const poolReserve of [null, [], { documents: 'law', size: 2 }, { documents: [''], size: 2 }, { documents: ['law'], size: 0 },
    { documents: ['law'], size: 11 }, { documents: ['law'], size: 2, perDocument: 0 }, { documents: ['law'], size: 2, perDocument: 1.5 }, { documents: ['law'], size: 2, extra: true }, { documents: Array.from({ length: 101 }, (_, i) => `d${i}`), size: 2 }]) {
    assert.throws(() => validateQuery({ ...base, poolReserve }), { code: 'invalid_pool_reserve' }, JSON.stringify(poolReserve));
  }
  assert.deepEqual(validateQuery({ ...base, poolReserve: { documents: ['b', 'a', 'b'], size: 2 } }).poolReserve, { documents: ['a', 'b'], size: 2, perDocument: 2 });
  assert.deepEqual(validateQuery({ ...base, poolReserve: { documents: ['a'], size: 6, perDocument: 2 } }).poolReserve, { documents: ['a'], size: 6, perDocument: 2 });
});

test('ADR-033: the warm-up verifies national legal texts first, once per generation, and the start warm-up needs an enabled real plan', async () => {
  const { warmKnowledgeSources, warmPilotAtStart } = await import('../lib/rag-v2/pilot/retrieval.js');
  const f = fixture(), directories = await f.postgres.retrievalDirectory(), warmed = [];
  const postgres = { warm: async (tenant, generationId, ids) => { warmed.push({ tenant, generationId, ids }); } };
  const generationId = `warm-test-${Date.now()}`;
  assert.equal(warmKnowledgeSources(postgres, tenant, generationId, directories), true);
  assert.equal(warmKnowledgeSources(postgres, tenant, generationId, directories), false, 'a second call in the same process does not warm again');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(warmed, [{ tenant, generationId, ids: ['law', 'act', 'municipal', 'guide'] }]);
  // `then` (the start warm-up's vectors) runs after the sources, and only once they are warmed.
  const order = [], later = `${generationId}-then`;
  const slow = { warm: async () => { await new Promise(resolve => setTimeout(resolve, 20)); order.push('sources'); } };
  assert.equal(warmKnowledgeSources(slow, tenant, later, directories, { then: async () => { order.push('vectors'); } }), true);
  await new Promise(resolve => setTimeout(resolve, 60));
  assert.deepEqual(order, ['sources', 'vectors']);
  const failed = [], broken = `${generationId}-failed`;
  assert.equal(warmKnowledgeSources({ warm: async () => { throw Object.assign(new Error('x'), { code: 'boom' }); } }, tenant, broken, directories,
    { then: async () => { failed.push('vectors'); } }), true);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.deepEqual(failed, [], 'no vector warm-up after failed sources');
  for (const env of [{}, { M4_PILOT_ENABLED: '0', M4_PILOT_CONFIG: 'x', RAG_V2_POSTGRES_URL: 'x' }, { M4_PILOT_ENABLED: '1', RAG_V2_POSTGRES_URL: 'x' }]) {
    assert.equal(await warmPilotAtStart({ env }), false);
  }
  // A test-mode plan is not warmed; nothing connects to a database.
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises'), os = await import('node:os'), path = await import('node:path');
  const dir = await mkdtemp(path.join(os.tmpdir(), 'rag-v2-warm-')), file = path.join(dir, 'plan.json');
  try {
    await writeFile(file, JSON.stringify({ mode: 'test', tenant, documents: { law: 'law-v1' } }));
    assert.equal(await warmPilotAtStart({ env: { M4_PILOT_ENABLED: '1', M4_PILOT_CONFIG: file, RAG_V2_POSTGRES_URL: 'postgres://127.0.0.1:1/none' } }), false);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
