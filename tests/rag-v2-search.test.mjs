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
