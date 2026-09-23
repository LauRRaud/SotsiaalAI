import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ingest } from '../lib/rag-v2/ingestion.js';
import { readJson, writeJson } from '../lib/rag-v2/catalog.js';
import { hash, id, stable } from '../lib/rag-v2/contracts.js';
import { loadSnapshot } from '../lib/rag-v2/search/snapshot.js';
import { indexSnapshot } from '../lib/rag-v2/search/indexing.js';
import { planIndexJob, runIndexJob } from '../lib/rag-v2/search/index-jobs.js';
import { IndexJobStore } from '../lib/rag-v2/search/index-jobs-postgres.js';
import { MockEmbedding, embeddingConfig, tokenCount, OPENAI_EMBEDDING_ENDPOINT } from '../lib/rag-v2/search/embedding.js';
import { StoredEmbedding } from '../lib/rag-v2/search/pilot-runner.js';
import { MORPHOLOGY_LEXICAL } from '../lib/rag-v2/search/morphology.js';
import { QdrantIndex, pointId } from '../lib/rag-v2/search/qdrant.js';
import { retrieve } from '../lib/rag-v2/search/retrieval.js';
import { LocalPolicy } from '../lib/rag-v2/search/policy.js';

let root, postgres, qdrant, connections;
const tenants = [], savedFetch = globalThis.fetch, savedConnect = net.Socket.prototype.connect;
const rights = { access: 'local_private', usage: 'development_only' }, profile = { id: 'generic', version: '1', months: [], categoryLabels: [] };
before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-index-jobs-'));
  connections = await readJson('tmp/rag-v2-services/connections.json');
  postgres = new IndexJobStore(connections.postgresUrl); qdrant = new QdrantIndex(connections.qdrantUrl, connections.qdrantKey);
  globalThis.fetch = (input, options) => {
    assert.equal(new URL(typeof input === 'string' ? input : input.url).origin, connections.qdrantUrl);
    return savedFetch(input, options);
  };
  net.Socket.prototype.connect = function (...args) {
    const normalized = Array.isArray(args[0]) ? args[0] : args;
    const target = typeof normalized[0] === 'object' ? normalized[0] : { port: normalized[0], host: normalized[1] };
    assert.equal(target.host, '127.0.0.1'); assert([55432, 56333].includes(Number(target.port)));
    return savedConnect.apply(this, args);
  };
});
after(async () => {
  try {
    for (const tenant of tenants) {
      const generations = (await postgres.pool.query('SELECT * FROM rag_v2_generation WHERE tenant=$1', [tenant])).rows;
      for (const generation of generations) await qdrant.request(qdrant.route(generation), 'DELETE').catch(error => { if (error.status !== 404) throw error; });
      for (const table of ['rag_v2_index_job', 'rag_v2_unit', 'rag_v2_generation_document', 'rag_v2_head', 'rag_v2_generation',
        'rag_v2_object', 'rag_v2_version', 'rag_v2_document', 'rag_v2_vector_cache']) await postgres.pool.query(`DELETE FROM ${table} WHERE tenant=$1`, [tenant]);
    }
  } finally {
    await postgres?.close(); globalThis.fetch = savedFetch; net.Socket.prototype.connect = savedConnect;
    assert(path.dirname(path.resolve(root)) === path.resolve(os.tmpdir()) && path.basename(root).startsWith('rag-v2-index-jobs-'));
    await fs.rm(root, { recursive: true, force: true });
  }
});
async function fixture(count = 2) {
  const tenant = `index-job-${randomUUID()}`; tenants.push(tenant);
  const inputRoot = path.join(root, tenant), storeRoot = path.join(inputRoot, 'store'); await fs.mkdir(inputRoot);
  const documents = [];
  for (let index = 0; index < count; index++) {
    const source_path = `${index}.html`;
    await fs.writeFile(path.join(inputRoot, source_path), `<article><h1>Guide ${index}</h1>${Array.from({ length: 5 }, (_, n) => `<p>Koduteenus aitab kodus. Synthetic garden guide ${index}, paragraph ${n}, plants need water and sunlight.</p>`).join('')}</article>`);
    const { bundle } = await ingest({ tenant, inputRoot, storeRoot, rights, profile, config: { chunkMaxChars: 140 },
      metadata: { document_id: String(index), title: `Guide ${index}`, source_type: 'fixture', language: 'et', source_format: 'html', source_path } });
    documents.push(bundle.document.id);
  }
  const embedding = new MockEmbedding(), snapshot = await loadSnapshot(storeRoot, tenant, documents);
  const old = await indexSnapshot({ snapshot, postgres, qdrant, embedding });
  const plan = await planIndexJob({ storeRoot, tenant, documents, embedding: embedding.config, lexical: MORPHOLOGY_LEXICAL });
  assert(plan.total_units > count);
  return { tenant, inputRoot, storeRoot, documents, snapshot, old, plan, postgres, qdrant, embedding, batchSize: 2 };
}
const generation = async options => (await postgres.pool.query('SELECT * FROM rag_v2_generation WHERE tenant=$1 AND id=$2', [options.tenant, options.plan.generation_id])).rows[0];
const expire = claim => postgres.pool.query("UPDATE rag_v2_index_job SET lease_until=clock_timestamp()-interval '1 second' WHERE tenant=$1 AND generation_id=$2", [claim.tenant, claim.generation_id]);

test('bounded runs persist exact progress; restart skips completed batches and preserves evidence/permissions', async () => {
  const options = await fixture(), written = [];
  const partial = await runIndexJob({ ...options, maxBatches: 1, hooks: { afterBatchWrite: ({ units }) => written.push(...units.map(unit => unit.id)) } });
  assert.equal(partial.state, 'pending'); assert.equal(partial.completed_units, 2);
  assert.equal((await postgres.active(options.tenant)).id, options.old.generation_id);
  const restarted = new IndexJobStore(connections.postgresUrl), nextIds = [];
  try {
    const complete = await runIndexJob({ ...options, postgres: restarted, hooks: { afterBatchWrite: ({ units }) => nextIds.push(...units.map(unit => unit.id)) } });
    assert.equal(complete.state, 'ready'); assert.equal(complete.completed_units, options.plan.total_units);
    assert(!nextIds.some(unit => written.includes(unit)));
    assert.equal(complete.mock_vectors_created, options.plan.total_units - partial.completed_units);
    assert.equal((await runIndexJob({ ...options, postgres: restarted })).reused, true);
  } finally { await restarted.close(); }
  const packet = await retrieve({ ...options, policy: new LocalPolicy({ tenants: { [options.tenant]: { reader: [options.documents[0]] } } }),
    context: { tenant: options.tenant, subject: 'reader', usage: 'development_only' },
    query: { text: 'koduteenust', language: 'et', method: 'lexical', semanticGraph: true, contextMode: 'compact' } });
  assert.equal(packet.state, 'ok', packet.error);
  assert(packet.evidence.length > 0 && packet.evidence.every(row => row.document_id === options.documents[0] && row.source_locations.length));
});

test('write before lost acknowledgement repeats only that batch and reuses its cached vectors', async () => {
  const options = await fixture(1);
  await assert.rejects(runIndexJob({ ...options, hooks: { afterBatchWrite: () => { throw Error('lost_ack'); } } }), /lost_ack/);
  assert.equal((await postgres.indexStatus(options.tenant, options.plan.generation_id)).completed_units, 0);
  const resumed = await runIndexJob(options);
  assert.equal(resumed.state, 'ready'); assert.equal(resumed.cache_hits, 2);
  assert.equal(resumed.mock_vectors_created, options.plan.total_units - 2);
  assert.equal(resumed.external_embedding_calls, 0);
});

test('a changed source generation and another storage root cannot silently redirect a job', async () => {
  const options = await fixture(1);
  await runIndexJob({ ...options, maxBatches: 1 });
  const copied = path.join(options.inputRoot, 'copied-store');
  await fs.cp(options.storeRoot, copied, { recursive: true });
  await assert.rejects(runIndexJob({ ...options, storeRoot: copied }), { code: 'index_job_plan_mismatch' });
  await ingest({ ...options, profile, rights, metadata: { document_id: 'new', title: 'Another identity', source_type: 'other', language: 'en',
    source_path: '0.html', source_format: 'html' } }).catch(error => assert.equal(error.code, 'duplicate_asset_identity_conflict'));
  await fs.writeFile(path.join(options.inputRoot, 'new.html'), '<article><p>A new source.</p></article>');
  await ingest({ ...options, profile, rights, metadata: { document_id: 'new', title: 'New', source_type: 'fixture', language: 'en', source_path: 'new.html', source_format: 'html' } });
  await assert.rejects(runIndexJob(options), { code: 'index_source_generation_changed' });
  assert.equal((await postgres.active(options.tenant)).id, options.old.generation_id);
});

test('final validation detects corruption in a completed vector batch without activating the partial index', async () => {
  const options = await fixture(1); let unit;
  await runIndexJob({ ...options, maxBatches: 1, hooks: { afterBatchWrite: value => { unit = value.units[0]; } } });
  const gen = await generation(options);
  await qdrant.request(`${qdrant.route(gen)}/points/payload?wait=true`, 'POST', { points: [pointId(unit.id)], payload: { version_id: 'forged' } });
  await assert.rejects(runIndexJob(options), { code: 'qdrant_point_integrity_failed' });
  assert.equal((await postgres.active(options.tenant)).id, options.old.generation_id);
  assert.equal((await postgres.indexStatus(options.tenant, options.plan.generation_id)).state, 'pending');
  await qdrant.request(`${qdrant.route(gen)}/points/payload?wait=true`, 'POST', { points: [pointId(unit.id)], payload: { version_id: unit.version_id } });
  const finished = await runIndexJob(options);
  assert.equal(finished.state, 'ready'); assert.equal(finished.batches_completed, 0);
});

test('final validation checks stored text columns and rejects extra vectors', async () => {
  const options = await fixture(1); let unit;
  await runIndexJob({ ...options, maxBatches: 1, hooks: { afterBatchWrite: value => { unit = value.units[0]; } } });
  await postgres.pool.query("UPDATE rag_v2_unit SET body='forged' WHERE tenant=$1 AND generation_id=$2 AND id=$3", [options.tenant, options.plan.generation_id, unit.id]);
  await assert.rejects(runIndexJob(options), { code: 'index_unit_integrity_failed' });
  await postgres.pool.query('UPDATE rag_v2_unit SET body=$4 WHERE tenant=$1 AND generation_id=$2 AND id=$3', [options.tenant, options.plan.generation_id, unit.id, unit.body]);
  const gen = await generation(options), extraId = randomUUID();
  await qdrant.request(`${qdrant.route(gen)}/points?wait=true`, 'PUT', { points: [{ id: extraId, vector: Array.from({ length: 32 }, (_, i) => i === 0 ? 1 : 0), payload: {} }] });
  await assert.rejects(runIndexJob(options), { code: 'qdrant_count_mismatch' });
  assert.equal((await postgres.active(options.tenant)).id, options.old.generation_id);
  await qdrant.request(`${qdrant.route(gen)}/points/delete?wait=true`, 'POST', { points: [extraId] });
  assert.equal((await runIndexJob(options)).state, 'ready');
});

test('leases fence concurrent and expired workers; late release cannot unlock a replacement', async () => {
  const options = await fixture(1);
  await postgres.enqueueIndex(options.plan, await fs.realpath(options.storeRoot));
  const first = await postgres.claimIndex(options.tenant, options.plan.generation_id);
  await assert.rejects(runIndexJob(options), { code: 'index_job_busy_or_ready' });
  await expire(first);
  const second = await postgres.claimIndex(options.tenant, options.plan.generation_id);
  await assert.rejects(postgres.renewIndex(first, 120), { code: 'index_lease_lost' });
  await assert.rejects(postgres.advanceIndex(first, { document_offset: 0, unit_offset: 1, completed_units: 1 }), { code: 'index_lease_lost' });
  await postgres.releaseIndex(first);
  assert.equal((await postgres.indexJob(options.tenant, options.plan.generation_id)).lease_token, second.lease_token);
  await postgres.releaseIndex(second);
  assert.equal((await runIndexJob(options)).state, 'ready');
});

test('a newer indexing request wins and failed activation rolls back the ready checkpoint', async () => {
  const options = await fixture(1); let newer;
  await assert.rejects(runIndexJob({ ...options, hooks: { beforeActivate: async () => {
    newer = await indexSnapshot({ ...options, embedding: new MockEmbedding({ model: 'mock-newer-index' }) });
  } } }), { code: 'superseded_index_job' });
  assert.equal((await postgres.active(options.tenant)).id, newer.generation_id);
  assert.equal((await postgres.indexStatus(options.tenant, options.plan.generation_id)).state, 'pending');
});

test('real-mode indexing accepts persisted vectors, never a live provider; cache mismatch fails closed', async () => {
  const options = await fixture(1);
  const config = embeddingConfig({ embedding_mode: 'real', provider: 'openai', model: 'text-embedding-3-large', dimensions: 3072, endpoint: OPENAI_EMBEDDING_ENDPOINT });
  const plan = await planIndexJob({ ...options, embedding: config, lexical: MORPHOLOGY_LEXICAL });
  let calls = 0;
  await assert.rejects(runIndexJob({ ...options, plan, embedding: { config, embed: () => { calls++; } } }), { code: 'persisted_real_vectors_required' });
  assert.equal(calls, 0);
  const vectors = new Map(options.snapshot.bundles.flatMap(bundle => bundle.chunks.map(chunk => [hash(chunk.retrieval_text), Array.from({ length: 3072 }, (_, index) => index === 0 ? 1 : 0)])));
  const stored = new StoredEmbedding('synthetic-local-fixture', { config, transport: 'synthetic' }, vectors);
  await runIndexJob({ ...options, plan, embedding: stored, maxBatches: 1 });
  const replacement = Array.from({ length: 3072 }, (_, index) => index === 1 ? 1 : 0);
  await postgres.pool.query('UPDATE rag_v2_vector_cache SET vector=$2::jsonb WHERE tenant=$1 AND config_id=$3', [options.tenant, JSON.stringify(replacement), plan.config.id]);
  await assert.rejects(runIndexJob({ ...options, plan, embedding: stored }), { code: 'embedding_cache_integrity_failed' });
  assert.equal((await postgres.active(options.tenant)).id, options.old.generation_id);
  await postgres.pool.query('UPDATE rag_v2_vector_cache SET vector=$2::jsonb WHERE tenant=$1 AND config_id=$3',
    [options.tenant, JSON.stringify(vectors.values().next().value), plan.config.id]);
  const complete = await runIndexJob({ ...options, plan, embedding: stored });
  assert.equal(complete.state, 'ready'); assert.equal(complete.external_embedding_calls, 0);
  assert((await postgres.active(options.tenant)).collection.startsWith('ragv2_real_'));
});

test('forged job progress, plan content and tenant scope cannot be resumed', async () => {
  const options = await fixture(1);
  await runIndexJob({ ...options, maxBatches: 1 });
  await assert.rejects(postgres.indexJob('another-tenant', options.plan.generation_id), { code: 'index_job_not_found' });
  await postgres.pool.query('UPDATE rag_v2_index_job SET completed_units=completed_units+1 WHERE tenant=$1', [options.tenant]);
  await assert.rejects(runIndexJob(options), { code: 'invalid_index_progress' });
  await postgres.pool.query('UPDATE rag_v2_index_job SET completed_units=completed_units-1,plan_hash=$2 WHERE tenant=$1', [options.tenant, 'tampered']);
  await assert.rejects(runIndexJob(options), { code: 'index_job_plan_mismatch' });
});

test('CLI plan/run/status resumes in separate processes and current policy revocation prevents a run', async () => {
  const options = await fixture(1), manifest = path.join(options.inputRoot, 'index.json'), policyFile = path.join(options.inputRoot, 'policy.json');
  const policy = { tenants: { [options.tenant]: { operator: options.documents } } }; await writeJson(policyFile, policy);
  const args = ['scripts/rag-v2-index-batch.mjs', '--manifest', manifest, '--store', options.storeRoot,
    '--policy', policyFile, '--tenant', options.tenant, '--subject', 'operator', '--batch-size', '2', '--development-only'];
  const run = async (mode, extra = []) => JSON.parse((await promisify(execFile)(process.execPath, [...args, '--mode', mode, ...extra],
    { timeout: 30000, env: { ...process.env, TZ: 'UTC' } })).stdout);
  assert.equal((await run('plan')).embedding_mode, 'mock');
  assert.equal((await run('run', ['--max-batches', '1'])).completed_units, 2);
  assert.equal((await run('status')).state, 'pending');
  policy.tenants[options.tenant].operator = []; await fs.writeFile(policyFile, JSON.stringify(policy));
  await assert.rejects(run('run'), error => /index_plan_not_allowed/.test(error.stderr));
  policy.tenants[options.tenant].operator = options.documents; await fs.writeFile(policyFile, JSON.stringify(policy));
  assert.equal((await run('run')).state, 'ready');
});

test('CLI reads a persisted synthetic real-mode ledger without provider credentials or new embeddings', async () => {
  const options = await fixture(1), vectorRoot = path.join(options.inputRoot, 'stored-fixture'); await fs.mkdir(vectorRoot);
  const config = embeddingConfig({ embedding_mode: 'real', provider: 'openai', model: 'text-embedding-3-large', dimensions: 3072, endpoint: OPENAI_EMBEDDING_ENDPOINT });
  const inputs = [], entries = [];
  for (const text of new Set(options.snapshot.bundles.flatMap(bundle => bundle.chunks.map(chunk => chunk.retrieval_text)))) {
    const inputHash = hash(text), inputId = id('pilot_input', options.tenant, inputHash), tokens = tokenCount(text);
    const record = { tenant: options.tenant, config, input_hash: inputHash, vector: Array.from({ length: 3072 }, (_, i) => i === 0 ? 1 : 0) };
    const file = `vector-${inputId}.json`; await writeJson(path.join(vectorRoot, file), record);
    inputs.push({ id: inputId, input_hash: inputHash, tokens });
    entries.push({ input_id: inputId, input_hash: inputHash, reserved_tokens: tokens, status: 'succeeded', vector_file: file, vector_record_hash: hash(stable(record)) });
  }
  const vectorManifest = { tenant: options.tenant, config, inputs };
  await writeJson(path.join(vectorRoot, 'ledger.json'), { state: 'complete', tenant: options.tenant, config, transport: 'synthetic_test_fixture',
    manifest: vectorManifest, manifest_sha256: hash(stable(vectorManifest)), reserved_attempts: entries.length, entries });
  const policyFile = path.join(options.inputRoot, 'stored-policy.json'), manifest = path.join(options.inputRoot, 'stored-plan.json');
  await writeJson(policyFile, { tenants: { [options.tenant]: { operator: options.documents } } });
  const args = ['scripts/rag-v2-index-batch.mjs', '--manifest', manifest, '--store', options.storeRoot, '--vectors', vectorRoot,
    '--policy', policyFile, '--tenant', options.tenant, '--subject', 'operator', '--development-only'];
  const run = async mode => JSON.parse((await promisify(execFile)(process.execPath, [...args, '--mode', mode],
    { timeout: 30000, env: { ...process.env, OPENAI_API_KEY: '', TZ: 'UTC' } })).stdout);
  assert.equal((await run('plan')).embedding_mode, 'real');
  const result = await run('run');
  assert.equal(result.state, 'ready'); assert.equal(result.external_embedding_calls, 0); assert.equal(result.mock_vectors_created, 0);
});
