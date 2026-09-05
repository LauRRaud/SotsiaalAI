import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { readJson, readActive } from '../lib/rag-v2/catalog.js';
import { ingest } from '../lib/rag-v2/ingestion.js';
import { hash, id, stable } from '../lib/rag-v2/contracts.js';
import { PostgresCatalog } from '../lib/rag-v2/search/postgres.js';
import { QdrantIndex, pointId } from '../lib/rag-v2/search/qdrant.js';
import { MockEmbedding, tokenCount } from '../lib/rag-v2/search/embedding.js';
import { LocalPolicy } from '../lib/rag-v2/search/policy.js';
import { loadSnapshot } from '../lib/rag-v2/search/snapshot.js';
import { indexSnapshot } from '../lib/rag-v2/search/indexing.js';
import { retrieve } from '../lib/rag-v2/search/retrieval.js';

// Intentional real-service suite: missing connections/services/source data fail; nothing is skipped.
const connections = await readJson('tmp/rag-v2-services/connections.json');
const postgres = new PostgresCatalog(connections.postgresUrl), qdrant = new QdrantIndex(connections.qdrantUrl, connections.qdrantKey);
const suffix = randomUUID().slice(0, 8), tenantA = `m2-test-a-${suffix}`, tenantB = `m2-test-b-${suffix}`;
const tenants = [tenantA, tenantB], embedding = new MockEmbedding();
const policy = new LocalPolicy({ tenants: {} });
const context = tenant => ({ tenant, subject: 'operator', usage: 'development_only' });
let tmp, sample, a, b, aOptions, deniedDocument, networkAttempts = 0;
const savedFetch = globalThis.fetch, savedConnect = net.Socket.prototype.connect;

function query(tenant, text = 'seedlings', extra = {}, deps = {}) {
  return retrieve({ postgres, qdrant, embedding, policy, context: context(tenant), query: { text, language: 'en', ...extra }, ...deps });
}
function parsed(text) {
  const lines = ['Synthetic gardening guide', ...Array.from({ length: 10 }, (_, i) => `${text} paragraph ${i + 1}. Give seedlings water and daylight.`)];
  return { info: {}, pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 600, 850], items: lines.map((text, i) => ({ text, item_index: i, x: 50, y: 760 - 35 * i, height: i === 0 ? 20 : 12, width: 450, font: 'synthetic', transform: [12, 0, 0, 12, 50, 760 - 35 * i] })) }] };
}
async function fixture(tenant, name, text) {
  const root = path.join(tmp, tenant, name); await fs.mkdir(root, { recursive: true });
  await fs.writeFile(path.join(root, 'source.pdf'), `%PDF-1.4\n% synthetic ${name} ${text}`);
  await fs.writeFile(path.join(root, 'meta.json'), JSON.stringify({ document_id: name, title: 'Synthetic gardening', authors: ['Test Author'], source_type: 'guide', language: 'en', source_path: 'source.pdf' }));
  const options = { tenant, inputRoot: root, metadataFile: 'meta.json', storeRoot: path.join(tmp, 'store'),
    profile: { id: 'synthetic-gardening', version: '1', months: [], categoryLabels: [] }, rights: { access: 'local_private', usage: 'development_only' }, config: { chunkMaxChars: 160 } };
  const result = await ingest(options, { parsePdf: async () => parsed(text) });
  return { ...result, options };
}
async function snapshot(tenant) { return loadSnapshot(path.join(tmp, 'store'), tenant, policy.value.tenants[tenant].operator); }
before(async () => {
  const inputRoot = process.env.RAG_V2_INPUT_ROOT;
  assert.ok(inputRoot, 'RAG_V2_INPUT_ROOT required; real article tests must not be skipped');
  globalThis.fetch = function (input, options) {
    const url = new URL(typeof input === 'string' ? input : input.url);
    if (url.origin !== connections.qdrantUrl) { networkAttempts++; throw new Error('unexpected_network'); }
    return savedFetch(input, options);
  };
  net.Socket.prototype.connect = function (...args) {
    let opts = args[0]; if (Array.isArray(opts)) opts = opts[0];
    const host = opts?.host ?? args[1], port = Number(opts?.port ?? args[0]);
    if (host !== '127.0.0.1' || ![55432, 56333].includes(port)) { networkAttempts++; throw new Error('unexpected_network'); }
    return savedConnect.apply(this, args);
  };
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'sotsiaalai-rag-v2-integration-'));
  await postgres.pool.query('SELECT 1'); await qdrant.request('/');
  for (const tenant of tenants) policy.value.tenants[tenant] = { operator: [] };
  const first = await fixture(tenantA, 'garden', 'Seedlings grow slowly');
  aOptions = first.options; policy.value.tenants[tenantA].operator.push(first.bundle.document.id);
  const distractor = await fixture(tenantA, 'distractor', 'A synthetic unrelated astronomy discussion');
  deniedDocument = distractor.bundle.document.id;
  policy.value.tenants[tenantA].operator.push(deniedDocument);
  const second = await fixture(tenantB, 'garden', 'Seedlings grow slowly');
  policy.value.tenants[tenantB].operator.push(second.bundle.document.id);
  a = await snapshot(tenantA); b = await snapshot(tenantB);
  await indexSnapshot({ snapshot: a, postgres, qdrant, embedding });
  await indexSnapshot({ snapshot: b, postgres, qdrant, embedding });
  const sampleTenant = `m2-article-${suffix}`; tenants.push(sampleTenant);
  const profile = await readJson('lib/rag-v2/domain-profiles/sotsiaalai.json');
  const result = await ingest({ tenant: sampleTenant, inputRoot, metadataFile: 'sotsiaaltoo-2-2025-artikkel-12-tehisintellekt-sotsiaaltoos.json',
    storeRoot: path.join(tmp, 'store'), profile, rights: { access: 'local_private', usage: 'development_only' } });
  policy.value.tenants[sampleTenant] = { operator: [result.bundle.document.id] };
  sample = await snapshot(sampleTenant); await indexSnapshot({ snapshot: sample, postgres, qdrant, embedding });
});
after(async () => {
  // Remove only these UUID-labelled fixtures. Keep the separate operator sample and services.
  try {
    const generations = (await postgres.pool.query('SELECT * FROM rag_v2_generation WHERE tenant=ANY($1::text[])', [tenants])).rows;
    for (const g of generations) await qdrant.request(qdrant.route(g), 'DELETE').catch(e => { if (e.status !== 404) throw e; });
    for (const table of ['rag_v2_head', 'rag_v2_unit', 'rag_v2_generation_document', 'rag_v2_generation', 'rag_v2_vector_cache']) await postgres.pool.query(`DELETE FROM ${table} WHERE tenant=ANY($1::text[])`, [tenants]);
    await postgres.pool.query("DELETE FROM rag_v2_object WHERE tenant=ANY($1::text[]) AND kind='relation'", [tenants]);
    for (const table of ['rag_v2_object', 'rag_v2_version', 'rag_v2_document']) await postgres.pool.query(`DELETE FROM ${table} WHERE tenant=ANY($1::text[])`, [tenants]);
  } finally {
    await postgres.close(); globalThis.fetch = savedFetch; net.Socket.prototype.connect = savedConnect;
    if (tmp) { assert.ok(path.resolve(tmp).startsWith(path.resolve(os.tmpdir()) + path.sep)); await fs.rm(tmp, { recursive: true, force: true }); }
    assert.equal(networkAttempts, 0);
  }
});

test('M2.1-02/03: actual PostgreSQL/Qdrant import, source equivalence, repeat idempotency', async () => {
  const first = await postgres.active(tenantA);
  const again = await indexSnapshot({ snapshot: a, postgres, qdrant, embedding });
  assert.equal(again.generation_id, first.id); assert.equal(again.cache_hits, again.units);
  const loaded = await postgres.bundles(tenantA, first.id, Object.keys(a.documents));
  assert.deepEqual(loaded.sort((x, y) => x.document.id.localeCompare(y.document.id)), [...a.bundles].sort((x, y) => x.document.id.localeCompare(y.document.id)));
  const count = await postgres.pool.query("SELECT count(*)::integer n FROM rag_v2_object WHERE tenant=$1 AND kind='span'", [tenantA]);
  assert.equal(count.rows[0].n, a.bundles.reduce((n, x) => n + x.spans.length, 0));
  const answer = await query(tenantA); assert.equal(answer.state, 'ok'); assert.ok(answer.evidence.length);
  assert.deepEqual(answer.channels, ['postgres_lexical', 'qdrant_mock_vector']);
});
test('M2.1-04/05: real channel prefilters exclude another tenant and unauthorized document', async () => {
  const allowed = a.bundles.find(x => x.document.id !== deniedDocument).document.id;
  policy.value.tenants[tenantA].operator = [allowed];
  const answer = await query(tenantA, 'seedlings');
  assert.ok(answer.evidence.every(e => e.document_id === allowed));
  assert.ok(!JSON.stringify(answer).includes(tenantB)); assert.ok(!JSON.stringify(answer).includes(deniedDocument));
  const gen = await postgres.active(tenantA), foreign = Object.keys(b.documents);
  assert.deepEqual(await postgres.lexical(tenantA, gen.id, foreign, 'seedlings', 10), []);
  assert.deepEqual(await qdrant.query(gen, foreign, await embedding.embed('seedlings'), 10), []);
  assert.equal((await query(tenantA, 'seedlings', { generation_id: 'bad' })).state, 'error');
  await assert.rejects(query('', 'seedlings'), /tenant_required/);
});
test('M2.1-06: failed staging keeps old active generation and restart completes without duplicate units', async () => {
  const old = await postgres.active(tenantA);
  const meta = await readJson(path.join(aOptions.inputRoot, 'meta.json')); meta.last_checked = '2026-09-05';
  await fs.writeFile(path.join(aOptions.inputRoot, 'meta.json'), JSON.stringify(meta));
  await ingest(aOptions, { parsePdf: async () => parsed('Seedlings grow slowly') });
  const updated = await snapshot(tenantA);
  await assert.rejects(indexSnapshot({ snapshot: updated, postgres, qdrant, embedding, hooks: { afterPostgres: () => { throw new Error('injected interruption'); } } }), /injected/);
  assert.equal((await postgres.active(tenantA)).id, old.id);
  const result = await indexSnapshot({ snapshot: updated, postgres, qdrant, embedding });
  assert.notEqual(result.generation_id, old.id); assert.equal(result.cache_hits, result.units);
  a = updated;
});
test('M2.1-07: concurrent older index cannot overwrite newer pointer, pinned query stays coherent', async () => {
  const old = await postgres.active(tenantA);
  const newEmbedding = new MockEmbedding({ model: 'mock-sha256-v2' });
  await assert.rejects(indexSnapshot({ snapshot: a, postgres, qdrant, embedding, hooks: { beforeActivate: async () => {
    await indexSnapshot({ snapshot: a, postgres, qdrant, embedding: newEmbedding });
  } } }), /superseded_index_job/);
  const newer = await postgres.active(tenantA); assert.notEqual(newer.id, old.id);
  const newestEmbedding = new MockEmbedding({ model: 'mock-sha256-v3' });
  const pinnedDocuments = a.documents;
  const pinned = await query(tenantA, 'seedlings', {}, { embedding: newEmbedding, hooks: { afterPin: async () => {
    await fs.writeFile(path.join(aOptions.inputRoot, 'source.pdf'), '%PDF-1.4\n% distinct updated synthetic document');
    await ingest(aOptions, { parsePdf: async () => parsed('Updated exclusive chapter') });
    a = await snapshot(tenantA);
    await indexSnapshot({ snapshot: a, postgres, qdrant, embedding: newestEmbedding });
  } } });
  assert.equal(pinned.state, 'ok'); assert.equal(pinned.generation_id, newer.id);
  assert.ok(pinned.evidence.every(e => Object.values(pinnedDocuments).some(d => d.version_id === e.document_version_id)));
  assert.ok(pinned.evidence.every(e => !e.source_text.includes('Updated exclusive chapter')));
  assert.equal((await query(tenantA)).error, 'query_embedding_space_mismatch');
});
test('M2.1-08: revocation before return removes evidence and references even from pinned generation', async () => {
  const saved = policy.value.tenants[tenantB].operator;
  const answer = await query(tenantB, 'seedlings', {}, { hooks: { beforePolicyCheck: async () => { policy.value.tenants[tenantB].operator = []; } } });
  assert.equal(answer.state, 'empty'); assert.deepEqual(answer.evidence, []); assert.deepEqual(answer.corpus.documents, {});
  assert.ok(answer.warnings.includes('access_policy_changed_rechecked'));
  policy.value.tenants[tenantB].operator = saved;
});
test('M2.1-09/10/11: cache scopes, real Qdrant space checks and overlong input block activation', async () => {
  const gen = await postgres.active(tenantB);
  const rows = await postgres.pool.query('SELECT key FROM rag_v2_vector_cache WHERE tenant=$1', [tenantB]); assert.ok(rows.rows.length);
  await assert.rejects(qdrant.query(gen, Object.keys(b.documents), [1, 2], 10), /invalid_embedding_vector/);
  await assert.rejects(qdrant.ensure({ ...gen, config: { ...gen.config, embedding: { ...gen.config.embedding, dimensions: 16 } } }), /qdrant_vector_space_mismatch/);
  const tiny = new MockEmbedding({ max_input_tokens: 1 });
  await assert.rejects(indexSnapshot({ snapshot: b, postgres, qdrant, embedding: tiny }), /embedding_input_too_long/);
  assert.equal((await postgres.active(tenantB)).id, gen.id);
});
test('M2.1-13, R-01/R-04: real article lexical evidence preserves exact page 3 and bibliography fields', async () => {
  const tenant = sample.tenant, gen = await postgres.active(tenant);
  const lex = await postgres.lexical(tenant, gen.id, Object.keys(sample.documents), 'OTT', 3);
  assert.equal(lex.length, 1);
  const answer = await query(tenant, 'OTT', { language: 'et' });
  assert.equal(answer.state, 'ok');
  const item = answer.evidence.find(e => e.unit_id === lex[0].id); assert.ok(item); assert.deepEqual(item.pdf_pages, [3]);
  assert.ok(item.source_text.includes('OTT-süsteem')); assert.ok(item.source_text.includes('läbipaistmatus'));
  const bundle = sample.bundles[0];
  assert.equal(item.source_text, item.span_ids.map(s => bundle.spans.find(x => x.id === s).source_text).join('\n'));
  assert.ok(!item.source_text.startsWith(item.search_aids.heading_prefix));
  assert.equal(item.search_aids.legacy_description.role, 'search_aid_only');
  const byAuthor = await postgres.lexical(tenant, gen.id, Object.keys(sample.documents), 'Laur Raudsoo', 3); assert.ok(byAuthor.length);
  assert.equal(item.bibliography.authors[0], 'Laur Raudsoo');
});
test('M2.1-14: graph on/off honors edge provenance, version, document cap and exact context budget', async () => {
  const off = await query(tenantB, 'seedlings', { limits: { topK: 1, perDocument: 4, contextTokens: 6000 } });
  const on = await query(tenantB, 'seedlings', { graph: true, limits: { topK: 1, perDocument: 4, graphAdditions: 2, graphSteps: 3, contextTokens: 6000 } });
  assert.equal(off.measurements.graph_additions, 0); assert.ok(on.measurements.graph_additions > 0 && on.measurements.graph_additions <= 2);
  assert.ok(on.measurements.graph_steps <= 3); assert.ok(on.evidence.length <= 3);
  assert.equal(on.measurements.context_tokens, on.evidence.reduce((n, e) => n + tokenCount(JSON.stringify(e)), 0));
  assert.ok(on.measurements.context_tokens <= 6000);
  assert.ok(on.evidence.every(e => e.document_id === b.bundles[0].document.id && e.document_version_id === b.bundles[0].version.id));
  const tiny = await query(tenantB, 'seedlings', { graph: true, limits: { contextTokens: 1 } }); assert.equal(tiny.evidence.length, 0); assert.ok(tiny.warnings.includes('context_budget_limited'));
});
test('M2.1-15: real simple tokenizer ET/EN/RU and parameterized filters', async () => {
  const samples = ['Sotsiaaltöö OTT-süsteem', 'Running seedlings', 'Социальная работа'];
  const tokenization = [];
  for (const text of samples) {
    const row = (await postgres.pool.query("SELECT to_tsvector('simple',$1)::text AS vector, plainto_tsquery('simple',$1)::text AS query", [text])).rows[0];
    const debug = (await postgres.pool.query("SELECT token,lexemes FROM ts_debug('simple',$1)", [text])).rows;
    assert.ok(debug.some(d => d.lexemes?.length)); tokenization.push({ text, ...row, debug });
  }
  assert.ok(tokenization[0].vector.includes('sotsiaaltöö')); assert.ok(tokenization[1].vector.includes('running'));
  assert.ok(tokenization[2].vector.includes('социальная'));
  await fs.mkdir('tmp/rag-v2-query', { recursive: true });
  await fs.writeFile('tmp/rag-v2-query/tokenizer-examples.json', JSON.stringify(tokenization, null, 2));
  assert.equal((await query(sample.tenant, 'OTT', { language: 'ru' })).state, 'ok');
  assert.equal((await query(sample.tenant, 'OTT', { filters: { region: 'Tallinn' } })).state, 'empty');
  assert.equal((await query(sample.tenant, 'OTT', { filters: { valid_at: '2025-06-06' } })).state, 'empty');
  assert.equal((await query(sample.tenant, 'OTT', { filters: { publication_from: '2025-01-01', publication_to: '2025-12-31' } })).state, 'ok');
  await postgres.lexical(tenantB, (await postgres.active(tenantB)).id, Object.keys(b.documents), "'); DROP TABLE rag_v2_unit; --", 1);
  assert.ok((await postgres.pool.query('SELECT count(*) FROM rag_v2_unit')).rows.length);
});
test('M2.1-16: empty result, actual Qdrant service error and allowed lexical fallback are distinct', async () => {
  assert.equal((await query(tenantB, '')).state, 'empty');
  const unavailable = Object.create(qdrant);
  unavailable.query = async () => qdrant.request('/collections/ragv2_missing_fixture/points/query', 'POST', { query: [1, 2] });
  const answer = await query(tenantB, 'seedlings', {}, { qdrant: unavailable });
  assert.equal(answer.state, 'degraded'); assert.deepEqual(answer.channels, ['postgres_lexical']); assert.ok(answer.evidence.length);
  assert.equal((await query(tenantB, 'seedlings', {}, { qdrant: unavailable, allowLexicalFallback: false })).state, 'error');
  const brokenPg = Object.create(postgres); brokenPg.lexical = async () => { throw new Error('failure'); };
  assert.equal((await query(tenantB, 'seedlings', {}, { postgres: brokenPg })).state, 'error');
  assert.equal(answer.measurements.external_embedding_calls, 0); assert.equal(answer.measurements.generation_calls, 0);
  // An API key in the process environment must not enable a provider or new channel.
  const priorKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'synthetic-not-a-real-api-key';
  try { assert.equal((await query(tenantB)).measurements.external_embedding_calls, 0); }
  finally { if (priorKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = priorKey; }
});
test('M2.1-02/05/13: corrupted source and cross-version relational endpoints fail visibly', async () => {
  const version = b.bundles[0].version.id, original = stable(b.bundles[0]);
  await postgres.pool.query("UPDATE rag_v2_version SET bundle=jsonb_set(bundle,'{document,fields,title,provenance}','[]') WHERE tenant=$1 AND id=$2", [tenantB, version]);
  assert.equal((await query(tenantB)).state, 'error');
  await postgres.pool.query('UPDATE rag_v2_version SET bundle=$3::jsonb WHERE tenant=$1 AND id=$2', [tenantB, version, original]);
  const span = b.bundles[0].spans[0];
  await postgres.pool.query("UPDATE rag_v2_object SET data='{}' WHERE tenant=$1 AND version_id=$2 AND id=$3", [tenantB, version, span.id]);
  assert.equal((await query(tenantB)).error, 'source_object_integrity_failed');
  await postgres.pool.query('UPDATE rag_v2_object SET data=$4 WHERE tenant=$1 AND version_id=$2 AND id=$3', [tenantB, version, span.id, span]);
  const gen = await postgres.active(tenantB), units = await postgres.units(tenantB, gen.id, Object.keys(b.documents));
  const target = units[0];
  await qdrant.request(`${qdrant.route(gen)}/points/payload?wait=true`, 'POST', { points: [pointId(target.id)], payload: { version_id: 'invalid-version' } });
  assert.equal((await query(tenantB)).error, 'vector_source_mismatch');
  await qdrant.request(`${qdrant.route(gen)}/points/payload?wait=true`, 'POST', { points: [pointId(target.id)], payload: { version_id: target.version_id } });
  await assert.rejects(postgres.pool.query("INSERT INTO rag_v2_object(tenant,version_id,id,kind,data,from_id,to_id) VALUES($1,$2,'bad','relation','{}',$3,$3)", [tenantB, version, a.bundles[0].document.id]), e => e.code === '23503');
  const active = await readActive(path.join(tmp, 'store', id('tenant', tenantB))); assert.ok(active.generation);
  assert.equal(hash(stable(b.bundles[0])), hash(original));
  await postgres.pool.query("UPDATE rag_v2_generation SET snapshot=jsonb_set(snapshot,'{snapshot_hash}','\"invalid\"') WHERE tenant=$1 AND id=$2", [tenantB, gen.id]);
  assert.equal((await query(tenantB)).error, 'search_generation_integrity_failed');
  await postgres.pool.query('UPDATE rag_v2_generation SET snapshot=$3 WHERE tenant=$1 AND id=$2', [tenantB, gen.id, gen.snapshot]);
});
