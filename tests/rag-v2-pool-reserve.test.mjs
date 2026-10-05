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

function fixture({ lawFirst = false, first = null, nearest = null } = {}) {
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
  const order = (first || (lawFirst ? ['law', 'act', 'municipal', 'guide'] : ranked)).flatMap(byDoc);
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
  const qdrant = { query: async (_g, docs, vector, limit, ids) => {
    calls.vector.push(docs);
    const list = rows(docs, limit, ids), lead = nearest ? list.find(row => row.chunk_id === nearest(vector, docs)) : null;
    return lead ? [lead, ...list.filter(row => row !== lead)].map((row, i) => ({ ...row, score: 100 - i })) : list;
  } };
  const policy = new LocalPolicy({ tenants: { [tenant]: { operator: bundles.map(b => b.document.id) } } });
  const context = { tenant, subject: 'operator', usage: 'development_only' };
  const query = extra => ({ text: 'How do I contest a decision?', language: 'en', includeDocumentLabels: false,
    limits: { topK: 5, perDocument: 5, candidates: 40, contextTokens: 6000 }, ...extra });
  const run = (extra, hooks) => retrieve({ postgres, qdrant, embedding, policy, context, query: query(extra), allowLexicalFallback: false, hooks });
  return { bundles, units, calls, run, postgres, qdrant };
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

test('ADR-042: a legal act\'s passages tell the reranker their version\'s validity; other sources carry none', async () => {
  const seen = [], rerank = async passages => { seen.push(passages); return ['P1']; };
  await fixture({ first: ['guide', 'law', 'act', 'municipal'] }).run({}, { rerank });
  const byTitle = Object.fromEntries(seen[0].map(p => [p.title, p]));
  assert.deepEqual([byTitle['Title law'].valid_from, byTitle['Title law'].valid_to], ['2024-01-01', '2026-12-31']);
  assert.deepEqual([byTitle['Title act'].valid_from, byTitle['Title act'].valid_to], ['2025-01-01', null], 'an open end is null');
  assert.deepEqual([byTitle['Title municipal'].valid_from, byTitle['Title municipal'].valid_to], ['2024-01-01', null], 'a municipal regulation is a legal act too');
  assert(!('valid_from' in byTitle['Title guide']) && !('valid_to' in byTitle['Title guide']));
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

test('ADR-079: a planned query\'s own nearest reserved passage comes first; the fused order fills the rest', async () => {
  const embedding = new MockEmbedding(), variant = 'the second act on benefits', target = JSON.stringify(await embedding.embed(variant));
  // The variant's vector is nearest to the second act's last section; every other list ranks the first law's sections first.
  const nearest = (vector, docs) => (JSON.stringify(vector) === target && docs.includes('act') && !docs.includes('municipal') ? 'act-c2' : null);
  const seen = [], rerank = async passages => { seen.push(passages); return [passages.at(-1).id]; };
  const plain = await fixture({ nearest }).run({ variants: [variant], poolReserve: { documents: ['law', 'act'], size: 2, perDocument: 2 } }, { rerank });
  assert.deepEqual(plain.rerank.reserved.map(unit => plain.rerank.candidates.includes(unit) && seen[0].at(plain.rerank.candidates.indexOf(unit)).title), ['Title law', 'Title law']);
  const first = await fixture({ nearest }).run({ variants: [variant], poolReserve: { documents: ['law', 'act'], size: 2, perDocument: 2, perQuery: 1 } }, { rerank });
  assert.equal(first.state, 'ok', first.error);
  assert.deepEqual(seen[1].slice(RERANK_POOL).map(passage => passage.title), ['Title act', 'Title law']);
  assert.deepEqual(first.selection_config.pool_reserve, { documents: 2, size: 2, per_document: 2, per_query: 1 });
  // The limits still hold: the size, and one document's share.
  const one = await fixture({ nearest }).run({ variants: [variant], poolReserve: { documents: ['law', 'act'], size: 1, perDocument: 1, perQuery: 1 } }, { rerank });
  assert.deepEqual(seen[2].slice(RERANK_POOL).map(passage => passage.title), ['Title act']);
  assert.equal(one.rerank.reserved.length, 1);
  // Without a variant there is no query of the plan's: the fused order alone, as before.
  const bare = await fixture({ nearest }).run({ poolReserve: { documents: ['law', 'act'], size: 2, perDocument: 2, perQuery: 1 } }, { rerank });
  assert.deepEqual(seen[3].slice(RERANK_POOL).map(passage => passage.title), ['Title law', 'Title law']);
  assert.equal(bare.rerank.reserved.length, 2);
  // The query's validation: a whole number from one to three, kept only when given.
  const base = { text: 'q', language: 'et', limits: { topK: 5, perDocument: 5, candidates: 40, contextTokens: 6000 } };
  assert.deepEqual(validateQuery({ ...base, poolReserve: { documents: ['a'], size: 6, perDocument: 2, perQuery: 1 } }).poolReserve, { documents: ['a'], size: 6, perDocument: 2, perQuery: 1 });
  for (const perQuery of [0, 4, 1.5, '1']) assert.throws(() => validateQuery({ ...base, poolReserve: { documents: ['a'], size: 6, perQuery } }), { code: 'invalid_pool_reserve' }, String(perQuery));
});

// ADR-091: the passages that hold the provisions which differ between two versions of an act come to the reranker in
// groups (one provision's passages of both versions), a group whole or not at all.
test('ADR-091: the passages of the provisions that differ join the pool in whole groups, in the order they rank for the request', async () => {
  const f = fixture(), unit = chunk => f.units.find(u => u.chunk_id === chunk).id, seen = [];
  const rerank = async passages => { seen.push(passages); return passages.slice(RERANK_POOL).map(p => p.id).slice(0, 5); };
  // Three provisions that differ: one stands in a passage of each act, one in three passages of the law, one in the second act alone.
  const groups = [[unit('law-c3'), unit('act-c2')], [unit('law-c0'), unit('law-c1'), unit('law-c2')], [unit('act-c0')]];
  const packet = await f.run({ changeReserve: { groups, size: 4 } }, { rerank });
  assert.equal(packet.state, 'ok', packet.error);
  // law-c0 ranks first among these passages, so its group comes whole. The group of two no longer fits and is passed
  // over; the single passage after it still does.
  assert.deepEqual(packet.rerank.change_reserved, ['law-c0', 'law-c1', 'law-c2', 'act-c0'].map(unit));
  assert.deepEqual(packet.rerank.candidates.slice(RERANK_POOL), packet.rerank.change_reserved);
  assert.deepEqual(seen[0].slice(RERANK_POOL).map(p => [p.id, p.title]), [['P31', 'Title law'], ['P32', 'Title law'], ['P33', 'Title law'], ['P34', 'Title act']]);
  assert.deepEqual(packet.evidence.map(e => e.chunk_id), ['law-c0', 'law-c1', 'law-c2', 'act-c0']);
  assert.deepEqual(Object.keys(packet.evidence[0].selection.ranks).sort(), ['change_lexical', 'change_vector']);
  assert.deepEqual(packet.selection_config.change_reserve, { groups: 3, units: 6, documents: 2, size: 4 });
  assert(packet.channels.includes('change_reserve') && !packet.channels.includes('pool_reserve'));
  assert.equal(packet.measurements.candidate_counts.change_lexical, 6);
  assert.deepEqual(packet.raw_rankings.change.map(rank => rank.id), ['law-c0', 'law-c1', 'law-c2', 'law-c3', 'act-c0', 'act-c2'].map(unit));
  // Only the differing passages are searched, with the question's own vector.
  assert.deepEqual(f.calls.lexical.at(-1), ['law', 'act']);
  assert.equal(packet.measurements.mock_embedding_calls, 1);

  // With room for all, every group comes, each together.
  const all = await f.run({ changeReserve: { groups, size: 8 } }, { rerank });
  assert.deepEqual(all.rerank.change_reserved, ['law-c0', 'law-c1', 'law-c2', 'law-c3', 'act-c2', 'act-c0'].map(unit));
  // Beside the national reserve: a passage that already has a reserved place takes no second one.
  const both = await f.run({ poolReserve: { documents: ['law'], size: 1 }, changeReserve: { groups, size: 8 } }, { rerank });
  assert.deepEqual(both.rerank.reserved, [unit('law-c0')]);
  assert.deepEqual(both.rerank.change_reserved, ['law-c1', 'law-c2', 'law-c3', 'act-c2', 'act-c0'].map(unit));
  assert.equal(new Set(both.rerank.candidates).size, both.rerank.candidates.length);
  assert.deepEqual(both.rerank.candidates.slice(RERANK_POOL), [...both.rerank.reserved, ...both.rerank.change_reserved]);
  // A unit the search's scope does not hold is left out of its group; a query whose groups are all outside adds nothing.
  const partial = await f.run({ changeReserve: { groups: [[unit('act-c1'), 'unit-outside'], ['another-outside']], size: 4 } }, { rerank });
  assert.deepEqual(partial.rerank.change_reserved, [unit('act-c1')]);
  assert.deepEqual(partial.selection_config.change_reserve, { groups: 1, units: 1, documents: 1, size: 4 });
  const outside = await f.run({ changeReserve: { groups: [['unit-outside']], size: 4 } }, { rerank });
  assert.equal(outside.rerank.change_reserved, undefined); assert.equal(outside.selection_config.change_reserve, undefined);
  assert.equal(seen.at(-1).length, RERANK_POOL);
});

test('ADR-091: a passage of a group that the search did not rank comes with its group; one the pool already has is not added twice', async () => {
  const f = fixture(), unit = chunk => f.units.find(u => u.chunk_id === chunk).id, lexical = f.postgres.lexical, vector = f.qdrant.query;
  // The search among the differing passages returns its first hit only.
  f.postgres.lexical = async (t, g, docs, text, limit, ids) => (await lexical(t, g, docs, text, limit, ids)).slice(0, docs.length === 1 ? 1 : limit);
  f.qdrant.query = async (g, docs, v, limit, ids) => (await vector(g, docs, v, limit, ids)).slice(0, docs.length === 1 ? 1 : limit);
  const packet = await f.run({ changeReserve: { groups: [[unit('law-c2'), unit('law-c0'), unit('law-c3')]], size: 4 } }, { rerank: async passages => passages.slice(RERANK_POOL).map(p => p.id) });
  assert.equal(packet.state, 'ok', packet.error);
  assert.deepEqual(packet.rerank.change_reserved, ['law-c2', 'law-c0', 'law-c3'].map(unit), 'in the group\'s own order');
  const byChunk = Object.fromEntries(packet.evidence.map(e => [e.chunk_id, e.selection]));
  assert.deepEqual(Object.keys(byChunk['law-c0'].ranks).sort(), ['change_lexical', 'change_vector']);
  assert.deepEqual([byChunk['law-c2'].ranks, byChunk['law-c2'].rrf_score], [{}, 0]);

  // The corpus-wide order already has the law and the second act in the pool: nothing is added.
  const seen = [], leading = await fixture({ lawFirst: true }).run({ changeReserve: { groups: [[unit('law-c0'), unit('act-c0')], [unit('law-c3')]], size: 4 } },
    { rerank: async passages => { seen.push(passages); return ['P1']; } });
  assert.equal(leading.state, 'ok', leading.error);
  assert.deepEqual(leading.rerank.change_reserved, []);
  assert.equal(seen[0].length, RERANK_POOL); assert.equal(new Set(seen[0].map(p => p.text)).size, RERANK_POOL);
});

test('ADR-091: without a reranker the change reserve is unused, and a result outside the differing passages stops the search', async () => {
  const f = fixture(), unit = chunk => f.units.find(u => u.chunk_id === chunk).id, changeReserve = { groups: [[unit('law-c0'), unit('act-c0')]], size: 4 };
  const calls = f.calls.lexical.length;
  const without = await f.run({ changeReserve }), baseline = await f.run({});
  assert.equal(f.calls.lexical.length, calls + 2, 'no search among the differing passages without a reranker');
  assert.deepEqual(without.evidence, baseline.evidence);
  assert.equal(without.selection_config.change_reserve, undefined);
  const lexical = f.postgres.lexical;
  f.postgres.lexical = async (t, g, docs, text, limit, ids) => (docs.length === 2 ? (await lexical(t, g, ['law', 'act'], text, limit)).slice(0, 3) : lexical(t, g, docs, text, limit, ids));
  const packet = await f.run({ changeReserve }, { rerank: async () => ['P1'] });
  assert.equal(packet.state, 'error'); assert.equal(packet.error, 'channel_result_outside_scope');
});

// ADR-091, places-3: the selection kept the newer version's passages of a rewritten section without the older one's,
// although both were among its candidates (measured 05.10.2026). The search adds the rest of a kept passage's group
// after the selection's own passages, which all stay.
test('ADR-091: a section the selection kept in one version comes in the other too, after the passages the selection kept', async () => {
  const f = fixture(), unit = chunk => f.units.find(u => u.chunk_id === chunk).id;
  // One section in three passages: two of the law (the newer version) and one of the second act (the older one).
  const groups = [[unit('law-c0'), unit('law-c1'), unit('act-c0')], [unit('law-c3'), unit('act-c2')]];
  // The selection keeps one municipal passage and the section's first passage of the newer version only.
  const keep = wanted => async passages => wanted.map(at => passages.at(at).id);
  const packet = await f.run({ changeReserve: { groups, size: 8 } }, { rerank: keep([0, RERANK_POOL]) });
  assert.equal(packet.state, 'ok', packet.error);
  assert.deepEqual(packet.rerank.change_reserved, ['law-c0', 'law-c1', 'act-c0', 'law-c3', 'act-c2'].map(unit));
  // The record keeps what the selection chose and what the server added, apart.
  assert.deepEqual(packet.rerank.selected, ['municipal-c0', 'law-c0'].map(unit));
  assert.deepEqual(packet.rerank.change_completed, ['law-c1', 'act-c0'].map(unit));
  assert.deepEqual(packet.evidence.map(e => e.chunk_id), ['municipal-c0', 'law-c0', 'law-c1', 'act-c0']);
  // An added passage says which kept passage brought it.
  assert.deepEqual(packet.evidence.map(e => e.selection.reason), ['ranked_seed', 'ranked_seed',
    ...[1, 1].map(at => ({ type: 'version_counterpart', seed_evidence_id: packet.evidence[at].evidence_id }))]);
  // A group the selection kept nothing of is not added, and a whole kept group adds nothing.
  const whole = await f.run({ changeReserve: { groups, size: 8 } }, { rerank: keep([RERANK_POOL + 3, RERANK_POOL + 4]) });
  assert.deepEqual(whole.rerank.change_completed, []);
  assert.deepEqual(whole.evidence.map(e => e.chunk_id), ['law-c3', 'act-c2']);
  const none = await f.run({ changeReserve: { groups, size: 8 } }, { rerank: keep([0, 1]) });
  assert.deepEqual(none.rerank.change_completed, []);
  assert.deepEqual(none.evidence.map(e => e.chunk_id), ['municipal-c0', 'municipal-c1']);

  // Every passage the selection kept stays a seed (five, the seed limit); the other version follows where the final
  // limit leaves room (seven here), and no further.
  const many = await f.run({ changeReserve: { groups, size: 8 } }, { rerank: keep([RERANK_POOL, 0, 1, 2, 3]) });
  assert.deepEqual(many.rerank.selected, ['law-c0', 'municipal-c0', 'municipal-c1', 'municipal-c2', 'municipal-c3'].map(unit));
  assert.deepEqual(many.evidence.map(e => e.chunk_id), ['law-c0', 'municipal-c0', 'municipal-c1', 'municipal-c2', 'municipal-c3', 'law-c1', 'act-c0']);
  const tight = await f.run({ changeReserve: { groups, size: 8 }, finalLimit: 6 }, { rerank: keep([RERANK_POOL, 0, 1, 2, 3]) });
  assert.deepEqual(tight.evidence.map(e => e.chunk_id), ['law-c0', 'municipal-c0', 'municipal-c1', 'municipal-c2', 'municipal-c3', 'law-c1']);
  assert.deepEqual(tight.rerank.change_completed, [unit('law-c1')]);
  assert.deepEqual(tight.selection_trace.filter(row => row.reason === 'final_limit').map(row => row.unit_id), [unit('act-c0')]);
});

test('ADR-091: the other version is added also when it had no place among the candidates; an unavailable selection adds nothing', async () => {
  const f = fixture(), unit = chunk => f.units.find(u => u.chunk_id === chunk).id;
  // Three places and two sections. The first section's two passages outside the pool take two; the second section's
  // two no longer fit, so the selection sees of that section only the passage the corpus-wide order brought.
  const groups = [[unit('municipal-c0'), unit('law-c2'), unit('law-c3')], [unit('municipal-c5'), unit('law-c0'), unit('act-c0')]];
  const packet = await f.run({ changeReserve: { groups, size: 3 } }, { rerank: async passages => [passages[5].id, passages[1].id] });
  assert.equal(packet.state, 'ok', packet.error);
  assert.deepEqual(packet.rerank.change_reserved, ['law-c2', 'law-c3'].map(unit));
  assert.equal(packet.rerank.candidates.length, RERANK_POOL + 2);
  assert.deepEqual(packet.rerank.selected, ['municipal-c5', 'municipal-c1'].map(unit));
  assert.deepEqual(packet.rerank.change_completed, ['law-c0', 'act-c0'].map(unit));
  assert.deepEqual(packet.evidence.map(e => e.chunk_id), ['municipal-c5', 'municipal-c1', 'law-c0', 'act-c0']);
  // How the added passage was found is in its record: the search among the differing passages ranked it.
  assert.deepEqual(Object.keys(packet.evidence[2].selection.ranks).sort(), ['change_lexical', 'change_vector']);
  // The selection was unavailable: the fused order stands as it is.
  const fused = await f.run({ changeReserve: { groups, size: 3 } }, { rerank: async () => null });
  assert.equal(fused.rerank.selected, null);
  assert.deepEqual(fused.rerank.change_completed, []);
  assert.deepEqual(fused.evidence.map(e => e.chunk_id), ['municipal-c0', 'municipal-c1', 'municipal-c2', 'municipal-c3', 'municipal-c4']);
});
