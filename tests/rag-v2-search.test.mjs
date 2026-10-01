import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { getEncodingNameForModel } from 'js-tiktoken/lite';
import { rrf, filtersMatch, validateQuery } from '../lib/rag-v2/search/ranking.js';
import { MockEmbedding, cacheKey, checkedTokens, decode, encode, embeddingConfig, indexUnit, TOKENIZER, validateVector } from '../lib/rag-v2/search/embedding.js';
import { LocalPolicy } from '../lib/rag-v2/search/policy.js';
import { searchConfig, verifySearchConfig } from '../lib/rag-v2/search/indexing.js';
import { localPostgresUrl, localQdrantUrl } from '../lib/rag-v2/search/local-config.js';
import { evidenceHtml } from '../lib/rag-v2/search/export.js';
import { evaluationPlan } from '../lib/rag-v2/search/evaluation-plan.js';
import { generationDifference, sameScores } from '../lib/rag-v2/search/evaluator.js';
const savedFetch = globalThis.fetch, savedConnect = net.Socket.prototype.connect;
let network = 0;
before(() => {
  globalThis.fetch = () => { network++; throw new Error('unexpected_network'); };
  net.Socket.prototype.connect = () => { network++; throw new Error('unexpected_network'); };
});
after(() => { globalThis.fetch = savedFetch; net.Socket.prototype.connect = savedConnect; assert.equal(network, 0); });

test('M2.1-09/10: deterministic mock configuration and scoped vector cache', async () => {
  const model = new MockEmbedding(), a = await model.embed('Hello world'), b = await model.embed('Hello world');
  assert.deepEqual(a, b); assert.equal(a.length, 32); assert.equal(model.config.tokenizer, TOKENIZER);
  const base = cacheKey('one', { usage: 'development_only' }, model.config, 'same');
  for (const variant of [
    cacheKey('two', { usage: 'development_only' }, model.config, 'same'),
    cacheKey('one', { usage: 'other' }, model.config, 'same'),
    cacheKey('one', { usage: 'development_only' }, embeddingConfig({ model: 'mock-sha256-v2' }), 'same'),
    cacheKey('one', { usage: 'development_only' }, embeddingConfig({ dimensions: 16 }), 'same'),
    cacheKey('one', { usage: 'development_only' }, embeddingConfig({ input_version: 'title-section-text-v2' }), 'same'),
    cacheKey('one', { usage: 'development_only' }, model.config, 'changed'),
  ]) assert.notEqual(base, variant);
  for (const bad of [a.slice(1), a.map(() => 0), a.map(() => NaN), a.map(() => Infinity), a.map(() => '1')]) assert.throws(() => validateVector(bad, model.config), /invalid_embedding_vector/);
  assert.throws(() => embeddingConfig({ embedding_mode: 'real' }), /invalid_embedding_config/);
  assert.throws(() => embeddingConfig({ model: 'text-embedding-3-large' }), /invalid_embedding_config/);
  assert.throws(() => verifySearchConfig({ ...searchConfig(model.config), id: 'another' }), /search_config_mismatch/);
});
test('M2.1-11: cl100k known vectors, Unicode roundtrip and full prefix token boundary', () => {
  assert.equal(getEncodingNameForModel('text-embedding-3-large'), 'cl100k_base');
  assert.deepEqual(encode('hello world'), [15339, 1917]);
  assert.deepEqual(encode('Hello, world!'), [9906, 11, 1917, 0]);
  for (const text of ['Sotsiaaltöö 🧑🏽‍💻', 'Привет, мир!', 'A😀B', '<|endoftext|>']) assert.equal(decode(encode(text)), text);
  const text = 'A😀B'; assert.ok(text.length > [...text].length);
  assert.equal(checkedTokens(text, embeddingConfig({ max_input_tokens: encode(text).length })), encode(text).length);
  assert.throws(() => checkedTokens(text, embeddingConfig({ max_input_tokens: encode(text).length - 1 })), /embedding_input_too_long/);
  assert.throws(() => checkedTokens('\ud800', embeddingConfig()), /invalid_embedding_input/);
  const chunk = { id: 'c', ordinal: 0, source_text: 'hello', retrieval_text: 'Long title\n\nhello' };
  const bundle = { version: { id: 'v' }, document: { id: 'd', fields: { title: { value: 'Long title' }, authors: { value: [] } }, search_aids: {} } };
  assert.throws(() => indexUnit(chunk, bundle, embeddingConfig({ max_input_tokens: 1 })), /embedding_input_too_long/);
  assert.equal(chunk.source_text, 'hello');
});
test('M2.1-12: RRF uses ranks, de-duplicates channels and orders ties by ID', () => {
  const result = rrf({ lexical: [{ id: 'b', score: 999 }, { id: 'b' }, { id: 'a', score: 1 }], vector: [{ id: 'a', score: -500 }, { id: 'b' }] });
  assert.deepEqual(result.map(x => x.id), ['a', 'b']);
  assert.equal(result[0].score, 1 / 61 + 1 / 62);
  assert.deepEqual(result[0].ranks, { lexical: 2, vector: 1 });
  assert.deepEqual(rrf({ lexical: [], vector: [] }), []);
  assert.equal(rrf({ lexical: [{ id: 'a' }], vector: [] })[0].score, 1 / 61);
});
test('ADR-022: query-time channel weights scale contributions without changing the unweighted default', () => {
  const channels = { lexical: [{ id: 'noise' }, { id: 'relevant' }], vector: [{ id: 'relevant' }, { id: 'other' }, { id: 'noise' }] };
  assert.deepEqual(rrf(channels).map(x => x.id), rrf(channels, 60, {}).map(x => x.id));
  const weighted = rrf({ lexical: [{ id: 'noise' }], vector: [{ id: 'relevant' }] }, 60, { vector: 2 });
  assert.deepEqual(weighted.map(x => x.id), ['relevant', 'noise']);
  assert.equal(weighted[0].contributions.vector, 2 / 61);
  for (const weights of [{ graph: 2 }, { vector: 0 }, { vector: 5 }, { vector: Number.NaN }, [2]])
    assert.throws(() => rrf(channels, 60, weights), { code: 'invalid_channel_weights' });
  assert.throws(() => validateQuery({ text: 'abi', language: 'et', channelWeights: { vector: -1 } }), { code: 'invalid_channel_weights' });
  assert.deepEqual(validateQuery({ text: 'abi', language: 'et', channelWeights: { lexical: 1, vector: 2 } }).channelWeights, { lexical: 1, vector: 2 });
});
test('ADR-062: a version ingested again has new unit IDs, so equal scores may swap; the same passages and scores tell that from a real difference', () => {
  // One passage first in each of two variant vector channels at the chat profile's weight: equal fused scores, ordered by unit ID.
  const fused = (marjamaa, kuusalu) => rrf({ vector_1: [{ id: marjamaa }], vector_2: [{ id: kuusalu }] }, 60, { vector_1: 2, vector_2: 2 });
  const stored = fused('unit_a', 'unit_b'), again = fused('unit_z', 'unit_c');
  assert.deepEqual([stored.map(x => x.id), again.map(x => x.id), stored.map(x => x.score), again.map(x => x.score)],
    [['unit_a', 'unit_b'], ['unit_c', 'unit_z'], [2 / 61, 2 / 61], [2 / 61, 2 / 61]]);
  // The channel reads name a passage by its document and place, which a re-ingest keeps.
  const read = (limit, ...rows) => ({ limit, rows });
  const before = [read(50, ['m#1', 0.5], ['k#0', 0.5], ['law#0', 0.2]), read(50, ['m#1', 0.71]), read(50, ['k#0', 0.69])];
  assert(sameScores(before, before));
  assert(sameScores(before, [read(50, ['k#0', 0.5], ['m#1', 0.5], ['law#0', 0.2]), before[1], before[2]]), 'equal scores in another order');
  // The limit cut a run of equal scores at another passage: both reads are full and the passages are at the lowest score.
  assert(sameScores([read(2, ['m#1', 0.5], ['k#0', 0.2])], [read(2, ['m#1', 0.5], ['law#0', 0.2])]));
  for (const [other, why] of [[[read(50, ['m#1', 0.6], ['k#0', 0.5], ['law#0', 0.2]), before[1], before[2]], 'a score changed'],
    [[read(50, ['m#1', 0.5], ['k#0', 0.5], ['m#0', 0.2]), before[1], before[2]], 'another passage below the limit'],
    [[read(50, ['m#1', 0.5], ['k#0', 0.5]), before[1], before[2]], 'a passage is missing'], [[read(30, ...before[0].rows), before[1], before[2]], 'another limit'],
    [[before[0], before[1]], 'a read is missing'], [[before[0], before[1], null], 'a read failed']]) assert(!sameScores(before, other) && !sameScores(other, before), why);
  assert(!sameScores([read(2, ['m#1', 0.5], ['k#0', 0.2])], [read(2, ['m#1', 0.5], ['law#0', 0.3])]), 'the cut passages have other scores');
  assert(!sameScores([read(2, ['m#1', 0.5], ['k#0', 0.5])], [read(2, ['m#1', 0.5], ['law#0', 0.2])]), 'only one of the cut passages is at the lowest score of both');
});
test('ADR-062: two generations differ by order only when the reads are equal and the evidence is the same passages in another order', () => {
  const read = (limit, ...rows) => ({ limit, rows });
  const reads = [read(50, ['m#1', 0.5], ['k#0', 0.5], ['law#0', 0.2]), read(50, ['m#1', 0.71])], swapped = [read(50, ['k#0', 0.5], ['m#1', 0.5], ['law#0', 0.2]), reads[1]];
  const row = { pool_all: true, fused_all: true, anchor_ranks: [1], evidence: ['m#1', 'k#0'], context_tokens: 4200 };
  const kind = (other, otherReads = swapped, first = row) => [generationDifference(first, other, reads, otherReads), generationDifference(other, first, otherReads, reads)];
  assert.deepEqual(kind({ ...row }, reads), ['same', 'same']);
  // Equal scores swapped: the same passages in another order, with the anchor at another place in the pool.
  assert.deepEqual(kind({ ...row, evidence: ['k#0', 'm#1'], anchor_ranks: [2], context_tokens: 4201 }), ['equal_score_order_only', 'equal_score_order_only']);
  // Equal reads do not explain the rest. The same evidence with a larger context is what data leaked into the source
  // card would look like; so is a lost anchor under the same evidence, and one passage more.
  for (const [other, why] of [[{ ...row, context_tokens: 4580 }, 'the same evidence, more context tokens'],
    [{ ...row, fused_all: false, anchor_ranks: [null] }, 'the same evidence, the anchor lost'],
    [{ ...row, anchor_ranks: [2] }, 'the same evidence, the anchor at another place'],
    [{ ...row, evidence: ['m#1', 'k#0', 'law#0'] }, 'one passage more'], [{ ...row, evidence: ['m#1', 'law#0'] }, 'another passage'],
    [{ ...row, evidence: ['m#1', 'm#1'] }, 'a passage twice instead of the other'],
    [{ ...row, evidence: ['k#0', 'm#1'], fused_all: false }, 'another order, and the same passages no longer cover the anchor'],
    [{ ...row, evidence: ['k#0', 'm#1'], context_tokens: 4580 }, 'another order, and a context larger by more than a token']]) {
    assert.deepEqual(kind(other, reads), ['different', 'different'], why);
    assert.deepEqual(kind(other), ['different', 'different'], `${why}, equal scores swapped`);
  }
  // Another order under reads that differ, or with no reads to compare, is a real difference; so is a missing row.
  const reordered = { ...row, evidence: ['k#0', 'm#1'] };
  assert.deepEqual(kind(reordered, [read(50, ['k#0', 0.6], ['m#1', 0.5], ['law#0', 0.2]), reads[1]]), ['different', 'different']);
  assert.deepEqual([generationDifference(row, reordered, [], []), generationDifference(row, reordered, undefined, undefined), generationDifference(row, undefined, reads, reads)],
    ['different', 'different', 'different']);
  // A question without anchors or a stored vector has nothing to differ in.
  assert.deepEqual([generationDifference({ id: 'q', error: 'no_stored_question_vector' }, { id: 'q', error: 'no_stored_question_vector' }, [], []),
    generationDifference({ ...row, pool_all: null, fused_all: null, anchor_ranks: [] }, { ...row, pool_all: null, fused_all: null, anchor_ranks: [], evidence: ['k#0', 'm#1'] }, reads, swapped)],
  ['same', 'equal_score_order_only']);
});
test('M2.1-05/08: explicit local context, tenant and live revocation', async () => {
  const policy = new LocalPolicy({ tenants: { a: { worker: ['doc'] }, b: { worker: ['other'] } } });
  const ctx = { tenant: 'a', subject: 'worker', usage: 'development_only' };
  assert.deepEqual((await policy.allowed(ctx)).documents, ['doc']);
  policy.value.tenants.a.worker = [];
  assert.deepEqual((await policy.allowed(ctx)).documents, []);
  await assert.rejects(policy.allowed({ ...ctx, tenant: '' }), /tenant_required/);
  await assert.rejects(policy.allowed({ ...ctx, tenant: 'nonexistent' }), /local_access_denied/);
  await assert.rejects(policy.allowed({ ...ctx, usage: 'public' }), /trusted_local_context_required/);
});
test('M2.1-15: explicit filters exclude unknowns; language alone never filters the source', () => {
  const b = { document: { fields: { language: { value: 'et' }, publication_date: { value: '2025-06-06' }, valid_from: { value: null }, valid_to: { value: null } } } };
  assert.equal(filtersMatch(b), true);
  assert.equal(filtersMatch(b, { region: 'Tallinn' }), false);
  assert.equal(filtersMatch(b, { publication_from: '2025-01-01', publication_to: '2025-12-31' }), true);
  assert.equal(filtersMatch(b, { valid_at: '2025-06-06' }), false);
  b.document.fields.publication_date.value = null;
  assert.equal(filtersMatch(b, { publication_from: '2025-01-01' }), false);
  assert.equal(validateQuery({ text: '  ', language: 'ru' }).text, '');
  assert.throws(() => validateQuery({ text: 'x', language: 'et', filters: { publication_from: '2025-02-30' } }), /invalid_filter/);
  assert.throws(() => validateQuery({ text: null, language: 'et' }), /invalid_query/);
  assert.throws(() => validateQuery({ text: 'x', language: 'et', limits: { topK: 99999 } }), /invalid_query_limit/);
});
test('M2.1-16/18: local endpoints only and escaped private HTML', () => {
  for (const url of ['postgresql://x:y@localhost:5432/production', 'postgresql://rag_v2_dev:x@127.0.0.1:55432/production']) assert.throws(() => localPostgresUrl(url), /local_postgres_required/);
  assert.throws(() => localQdrantUrl('https://example.com'), /local_qdrant_required/);
  const html = evidenceHtml({ state: 'ok', query_id: 'q', generation_id: 'g', warnings: [], measurements: {}, evidence: [{ bibliography: { title: '<script>bad()</script>', authors: [] }, pdf_pages: [1], selection: {}, source_text: '<img src=x onerror=bad()>', span_ids: [] }] });
  assert.ok(!html.includes('<script>')); assert.ok(!html.includes('<img src=x')); assert.ok(html.includes('&lt;img'));
});
test('M2.2 preparation has source anchors, bounded tokens, unknown price and no authorization', () => {
  const snapshot = { documents: {}, bundles: [{ version: { id: 'v', pdf_hash: 'pdf', metadata_hash: 'meta' }, document: { id: 'd' },
    chunks: [{ id: 'c', retrieval_text: 'hello world' }], spans: [{ id: 's', pdf_page: 1, source_text: 'hello world' }] }] };
  const questions = { source_pdf_sha256: 'pdf', cases: [{ id: 'q', query: 'hello', expected_anchors: [{ pdf_page: 1, contains: 'hello' }] }] };
  const plan = evaluationPlan(snapshot, questions);
  assert.equal(plan.max_total_input_tokens, 3); assert.equal(plan.max_api_attempts, 2);
  assert.equal(plan.estimated_cost, null); assert.equal(plan.material_egress_approved, false); assert.equal(plan.spend_cap_approved, false);
  assert.deepEqual(plan.queries[0].expected_anchors[0].span_ids, ['s']);
  assert.throws(() => evaluationPlan(snapshot, { ...questions, source_pdf_sha256: 'wrong' }), /evaluation_asset_missing/);
  assert.throws(() => evaluationPlan(snapshot, questions, { input_per_million: Infinity }), /invalid_pricing_configuration/);
});
