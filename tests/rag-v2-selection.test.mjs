import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { id, hash, stable } from '../lib/rag-v2/contracts.js';
import { MockEmbedding, indexUnit, tokenCount, embeddingConfig, OPENAI_EMBEDDING_ENDPOINT } from '../lib/rag-v2/search/embedding.js';
import { LocalPolicy } from '../lib/rag-v2/search/policy.js';
import { searchConfig } from '../lib/rag-v2/search/indexing.js';
import { retrieve } from '../lib/rag-v2/search/retrieval.js';
import { retrievalProfile, queryForProfile, assertProfileGeneration } from '../lib/rag-v2/search/profiles.js';
import { CombinedStoredEmbedding } from '../lib/rag-v2/search/pilot-runner.js';
import { assessContext, canonicalContext, contextId } from '../lib/rag-v2/evaluation/rubric-v2.js';

const savedFetch = globalThis.fetch, savedConnect = net.Socket.prototype.connect;
let network = 0;
before(() => {
  globalThis.fetch = () => { network++; throw Error('unexpected_network'); };
  net.Socket.prototype.connect = () => { network++; throw Error('unexpected_network'); };
});
after(() => { globalThis.fetch = savedFetch; net.Socket.prototype.connect = savedConnect; assert.equal(network, 0); });

function fixture(order = [0, 2, 4, 6, 8]) {
  const tenant = 'selection-synthetic', doc = 'garden', version = 'garden-v1';
  const embedding = new MockEmbedding(), config = searchConfig(embedding.config);
  const spans = Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, tenant_id: tenant, document_version_id: version,
    pdf_page: 1, start: i * 50, source_text: `Synthetic gardening fact ${i}: water and daylight.` }));
  const chunks = spans.map((s, i) => ({ id: `c${i}`, ordinal: i, parent_section_id: 'section', span_ids: [s.id], pdf_pages: [1],
    source_text: s.source_text, retrieval_text: s.source_text, retrieval_mapping: { prefix_length: 0 } }));
  const bundle = { tenant_id: tenant, version: { id: version, pdf_hash: 'a'.repeat(64) },
    document: { id: doc, rights: { access: 'local_private', usage: 'development_only' }, search_aids: {}, fields: {
      title: { value: 'Synthetic gardening' }, authors: { value: ['Test Author'] }, publication_date: { value: null },
    } }, spans, chunks, report: { warnings: [] }, sections: [{ id: 'section', parent_id: null, title: 'Synthetic gardening', span_ids: ['s0'] }],
    relations: chunks.flatMap(c => [{ id: `belongs-${c.id}`, type: 'BELONGS_TO', from_id: c.id, to_id: doc },
      { id: `parent-${c.id}`, type: 'PARENT_SECTION', from_id: c.id, to_id: 'section' }]) };
  const documents = { [doc]: { version_id: version } }, snapshot = { source_generation: 'source-v1', documents, snapshot_hash: hash(stable(documents)) };
  const generation = { id: id('search_generation', tenant, snapshot, config), config, snapshot };
  const units = chunks.map(c => indexUnit(c, bundle, embedding.config));
  const rows = order.map(i => ({ ...units[i], score: 100 - i }));
  const context = { tenant, subject: 'operator', usage: 'development_only' };
  const policy = new LocalPolicy({ tenants: { [tenant]: { operator: [doc] } } });
  const postgres = { active: async () => generation, bundles: async (_t, _g, docs) => docs.includes(doc) ? [bundle] : [],
    units: async (_t, _g, docs) => docs.includes(doc) ? units : [], lexical: async () => rows };
  const qdrant = { query: async () => rows };
  const run = (profileId = 'hybrid-ranked-first-neighbors-v1', extra = {}) => {
    const profile = retrievalProfile(profileId); assertProfileGeneration(profile, generation);
    return retrieve({ postgres, qdrant, embedding, policy, context,
      query: queryForProfile(profile, { text: 'gardening', language: 'en' }), allowLexicalFallback: profile.allow_lexical_fallback, ...extra });
  };
  return { bundle, generation, units, rows, context, policy, embedding, postgres, qdrant, run };
}

test('ranked-first profile preserves the fifth seed, full unit cap and historical 3+2 behavior', async () => {
  const f = fixture(), historical = await f.run(undefined, { query: {
    ...queryForProfile(retrievalProfile('hybrid-ranked-first-neighbors-v1'), { text: 'gardening', language: 'en' }),
    limits: { ...retrievalProfile().query.limits, topK: 3 },
  } });
  const plain = await f.run('hybrid-ranked-first-v1'), candidate = await f.run();
  assert.equal(candidate.state, 'ok'); assert.equal(historical.state, 'ok');
  assert.equal(historical.evidence.filter(e => e.selection.reason === 'ranked_seed').length, 3);
  assert.equal(historical.measurements.graph_additions, 2);
  assert(!historical.evidence.some(e => e.chunk_id === 'c8'));
  assert.deepEqual(candidate.evidence.map(e => e.chunk_id), ['c0', 'c2', 'c4', 'c6', 'c8']);
  assert.deepEqual(candidate.model_context, plain.model_context);
  assert.equal(candidate.evidence.length, 5); assert.equal(candidate.measurements.graph_additions, 0);
  assert(candidate.selection_trace.some(r => r.reason === 'final_limit'));
  assert(candidate.measurements.context_tokens < 6000);
  assert.equal(candidate.measurements.context_tokens, tokenCount(JSON.stringify(candidate.model_context)));
});

test('explicit neighbors use remaining slots without displacing seeds and selection is repeatable', async () => {
  const f = fixture([0]), plain = await f.run('hybrid-ranked-first-v1'), a = await f.run(), b = await f.run();
  assert.equal(plain.evidence.length, 1); assert.equal(a.evidence.length, 3);
  assert.deepEqual(a.evidence.slice(0, plain.evidence.length), plain.evidence);
  assert.deepEqual(a.evidence, b.evidence); assert.deepEqual(a.model_context, b.model_context);
  assert.equal(a.measurements.graph_additions, 2); assert(a.measurements.graph_steps <= 8);
  assert(a.evidence.slice(1).every(e => e.selection.reason.edge_ids.length && e.selection.reason.seed_evidence_id));
  const limited = await f.run(undefined, { query: { ...queryForProfile(retrievalProfile('hybrid-ranked-first-neighbors-v1'),
    { text: 'gardening', language: 'en' }), limits: { ...retrievalProfile().query.limits, contextTokens: plain.measurements.context_tokens } } });
  assert.deepEqual(limited.model_context, plain.model_context);
  assert(limited.selection_trace.some(r => r.reason === 'context_budget'));
});

test('expanded profiles use indexed structural relations after all five seeds within the same token bound', async () => {
  for (const profile of ['hybrid-ranked-first-neighbors-v2', 'vector-ranked-first-neighbors-v1']) {
    const f = fixture(), packet = await f.run(profile);
    assert.equal(packet.state, 'ok');
    assert.deepEqual(packet.evidence.slice(0, 5).map(e => e.chunk_id), ['c0', 'c2', 'c4', 'c6', 'c8']);
    assert.equal(packet.evidence.length, 7);
    assert.equal(packet.graph_audit.free_final_slots_at_start, 2);
    assert.equal(packet.measurements.graph_additions, 2);
    assert(packet.measurements.context_tokens <= 6000);
    const edgeIds = new Set(f.bundle.relations.map(edge => edge.id));
    assert(packet.evidence.slice(5).every(e => e.selection.reason.edge_ids.every(edge => edgeIds.has(edge))));
    f.bundle.relations = [];
    assert.equal((await f.run(profile)).evidence.length, 5);
  }
});

test('neighbors retain relation, duplicate, document cap and version protections', async () => {
  const disconnected = fixture([0]); disconnected.bundle.relations = [];
  assert.equal((await disconnected.run()).evidence.length, 1);
  const duplicate = fixture([0, 0]);
  duplicate.bundle.chunks[1].source_text = duplicate.bundle.chunks[0].source_text;
  duplicate.bundle.chunks[1].retrieval_text = duplicate.bundle.chunks[0].source_text;
  duplicate.bundle.spans[1].source_text = duplicate.bundle.spans[0].source_text;
  duplicate.units[1] = indexUnit(duplicate.bundle.chunks[1], duplicate.bundle, duplicate.embedding.config);
  const dup = await duplicate.run();
  assert.equal(dup.state, 'ok'); assert(dup.selection_trace.some(r => r.reason === 'duplicate_text'));
  assert.equal(new Set(dup.evidence.map(e => e.chunk_id)).size, dup.evidence.length);
  const wrongVersion = fixture([0]); wrongVersion.units[1].version_id = 'foreign';
  assert.equal((await wrongVersion.run()).error, 'search_unit_source_mismatch');
  const missing = fixture([0]); missing.units.pop();
  assert.equal((await missing.run()).error, 'missing_generation_units');
  const capped = fixture([0]);
  const capResult = await capped.run(undefined, { query: { ...queryForProfile(retrievalProfile('hybrid-ranked-first-neighbors-v1'),
    { text: 'gardening', language: 'en' }), limits: { ...retrievalProfile().query.limits, perDocument: 1 } } });
  assert.equal(capResult.evidence.length, 1); assert(capResult.selection_trace.some(r => r.reason === 'document_cap'));
});

test('revocation outranks seed preservation; an ungranted channel result is rejected', async () => {
  const revoked = fixture();
  const result = await revoked.run(undefined, { hooks: { beforePolicyCheck: async () => { revoked.policy.value.tenants[revoked.context.tenant].operator = []; } } });
  assert.equal(result.state, 'empty'); assert.deepEqual(result.evidence, []); assert.deepEqual(result.reference_map, {});
  const forbidden = fixture(); forbidden.rows.push({ ...forbidden.rows[0], id: 'foreign-unit', document_id: 'ungranted' });
  assert.equal((await forbidden.run()).error, 'channel_result_outside_scope');
});

test('versioned profile defaults to graph off and rejects silent budget/ranking overrides', () => {
  const profile = retrievalProfile(); assert.equal(profile.query.graph, false);
  assert.equal(profile.query.limits.perDocument, 5); assert.equal(profile.query.finalLimit, 5);
  assert.equal(profile.query.limits.topK, profile.query.finalLimit);
  assert.throws(() => queryForProfile(profile, { text: 'x', language: 'en', limits: { topK: 3 } }), /profile_query_override/);
  assert.throws(() => queryForProfile({ ...profile, query: { ...profile.query, graph: true } }, { text: 'x', language: 'en' }), /retrieval_profile_mismatch/);
  assert.throws(() => assertProfileGeneration(profile, { config: { ...profile.generation_requirements, rrf_constant: 5 } }), /profile_generation_mismatch/);
});

test('missing persisted vector fails closed without a provider fallback', async () => {
  const config = embeddingConfig({ embedding_mode: 'real', provider: 'openai', model: 'text-embedding-3-large', dimensions: 3072, endpoint: OPENAI_EMBEDDING_ENDPOINT });
  const stored = new CombinedStoredEmbedding(config, new Map(), 'synthetic-test-only', []);
  await assert.rejects(stored.embed('never embedded question'), /stored_embedding_missing/);
  assert.equal(stored.reads, 0); assert.equal(network, 0);
});

test('changed context cannot inherit an old semantic receipt; runtime imports exclude evaluator data', async () => {
  const f = fixture([0]), packet = await f.run('hybrid-ranked-first-v1'), expanded = await f.run();
  const snapshot = { bundles: [f.bundle] }, family = 'synthetic';
  const oldId = contextId(family, canonicalContext(packet.evidence, snapshot));
  const newId = contextId(family, canonicalContext(expanded.evidence, snapshot));
  assert.notEqual(newId, oldId);
  const stamp = { state: 'approved', reviewed_by: { role: 'human_reviewer', name: 'SYNTHETIC TEST ONLY' },
    reviewed_at: '2026-09-05T00:00:00Z', reason: 'Synthetic contract fixture', basis: 'Not a real approval' };
  const rubric = { families: { [family]: { requirements: [{ id: 'fact', mandatory: true, meaning: 'Synthetic fact', evidence_sets: [] }] } } };
  const review = { decisions: { [`definition:${family}`]: stamp, [oldId]: { ...stamp, exhaustive: true, contradiction: 'none', no_other_support_for: ['fact'] } } };
  assert.equal(assessContext(family, expanded.evidence, newId, rubric, review).status, 'needs_review');
  const visited = new Set();
  async function visit(file) {
    if (visited.has(file)) return; visited.add(file);
    assert(!file.includes(`${path.sep}evaluation${path.sep}`) && !file.endsWith(`${path.sep}evaluator.js`));
    const code = await fs.readFile(file, 'utf8');
    for (const match of code.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) await visit(path.resolve(path.dirname(file), match[1]));
  }
  await visit(path.resolve('lib/rag-v2/search/profiles.js')); await visit(path.resolve('lib/rag-v2/search/retrieval.js'));
});
