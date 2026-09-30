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
import { readJson } from '../lib/rag-v2/catalog.js';
import { planIndexJob, runIndexJob, verifyIndexJob } from '../lib/rag-v2/search/index-jobs.js';
import { IndexJobStore } from '../lib/rag-v2/search/index-jobs-postgres.js';
import { MockEmbedding } from '../lib/rag-v2/search/embedding.js';
import { MORPHOLOGY_LEXICAL } from '../lib/rag-v2/search/morphology.js';
import { QdrantIndex } from '../lib/rag-v2/search/qdrant.js';
import { VERSION_LAYOUT } from '../lib/rag-v2/search/layout.js';
import { pruneUnreferencedVersions } from '../lib/rag-v2/search/prune-versions.js';

// ADR-060 against the local Postgres and Qdrant (node scripts/rag-v2-local.mjs up): the index of a version no generation
// lists goes; the listed versions, their rows and points stay; a stopped run is completed; a version listed again is
// indexed anew.
let root, postgres, qdrant, connections;
const tenants = [], savedFetch = globalThis.fetch, savedConnect = net.Socket.prototype.connect;
const rights = { access: 'local_private', usage: 'development_only' }, profile = { id: 'generic', version: '1', months: [], categoryLabels: [] };
before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-prune-versions-'));
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
      for (const generation of generations) {
        await qdrant.request(`${qdrant.route(generation)}/points/delete?wait=true`, 'POST', { filter: { must: [{ key: 'tenant', match: { value: tenant } }] } })
          .catch(error => { if (error.status !== 404) throw error; });
      }
      for (const table of ['rag_v2_index_job', 'rag_v2_unit', 'rag_v2_version_unit', 'rag_v2_version_index', 'rag_v2_generation_document', 'rag_v2_head', 'rag_v2_generation',
        'rag_v2_object', 'rag_v2_version', 'rag_v2_document', 'rag_v2_vector_cache']) await postgres.pool.query(`DELETE FROM ${table} WHERE tenant=$1`, [tenant]);
    }
  } finally {
    await postgres?.close(); globalThis.fetch = savedFetch; net.Socket.prototype.connect = savedConnect;
    assert(path.dirname(path.resolve(root)) === path.resolve(os.tmpdir()) && path.basename(root).startsWith('rag-v2-prune-versions-'));
    await fs.rm(root, { recursive: true, force: true });
  }
});

const guide = index => Array.from({ length: 5 }, (_, n) => `Koduteenus aitab kodus. Synthetic garden guide ${index}, paragraph ${n}, plants need water and sunlight.`);
async function addDocument(options, name, paragraphs) {
  const source_path = `${name}.html`;
  await fs.writeFile(path.join(options.inputRoot, source_path), `<article><h1>${name}</h1>${paragraphs.map(text => `<p>${text}</p>`).join('')}</article>`);
  const { bundle } = await ingest({ tenant: options.tenant, inputRoot: options.inputRoot, storeRoot: options.storeRoot, rights, profile, config: { chunkMaxChars: 140 },
    metadata: { document_id: name, title: name, source_type: 'fixture', language: 'et', source_format: 'html', source_path } });
  return bundle;
}
async function fixture() {
  const tenant = `prune-versions-${randomUUID()}`; tenants.push(tenant);
  const inputRoot = path.join(root, tenant), storeRoot = path.join(inputRoot, 'store'); await fs.mkdir(inputRoot);
  const options = { tenant, inputRoot, storeRoot, embedding: new MockEmbedding(), documents: [] };
  for (let index = 0; index < 2; index++) options.documents.push((await addDocument(options, `guide-${index}`, guide(index))).document.id);
  return options;
}
const plan = (options, documents) => planIndexJob({ storeRoot: options.storeRoot, tenant: options.tenant, documents, embedding: options.embedding.config,
  lexical: MORPHOLOGY_LEXICAL, layout: VERSION_LAYOUT, sealedItems: (configId, versions) => postgres.sealedItems(options.tenant, configId, versions) });
const run = (options, indexPlan) => runIndexJob({ plan: indexPlan, storeRoot: options.storeRoot, postgres, qdrant, embedding: options.embedding, batchSize: 2, maxBatches: 10000 });
// What drop-version-generations removes of a generation: its listing, its job and its row (ADR-036).
async function dropGeneration(tenant, generationId) {
  for (const table of ['rag_v2_generation_document', 'rag_v2_index_job']) await postgres.pool.query(`DELETE FROM ${table} WHERE tenant=$1 AND generation_id=$2`, [tenant, generationId]);
  await postgres.pool.query('DELETE FROM rag_v2_generation WHERE tenant=$1 AND id=$2', [tenant, generationId]);
}
async function versionState(generation, tenant, versionId) {
  const count = async table => (await postgres.pool.query(`SELECT count(*)::integer AS n FROM ${table} WHERE tenant=$1 AND version_id=$2`, [tenant, versionId])).rows[0].n;
  const points = (await qdrant.request(`${qdrant.route(generation)}/points/count`, 'POST', { exact: true,
    filter: { must: [{ key: 'tenant', match: { value: tenant } }, { key: 'version_id', match: { value: versionId } }] } })).count;
  const seal = (await postgres.pool.query('SELECT state FROM rag_v2_version_index WHERE tenant=$1 AND version_id=$2', [tenant, versionId])).rows[0]?.state ?? null;
  return { units: await count('rag_v2_version_unit'), seal, points };
}

test('the index of a version no generation lists goes; the listed versions stay searchable and verified', async () => {
  const options = await fixture(), [changed, kept] = options.documents;
  const first = await plan(options, options.documents);
  await run(options, first);
  const oldVersion = first.source.documents[changed].version_id, oldUnits = first.items.find(item => item.document_id === changed).units;
  await addDocument(options, 'guide-0', ['Päevahoiukeskus avab uksed hommikul.', 'Päevahoiukeskus pakub tegevusi.']);
  const second = await plan(options, options.documents);
  await run(options, second);
  const generation = await postgres.active(options.tenant), keptVersion = second.source.documents[kept].version_id;
  const prune = extra => pruneUnreferencedVersions({ postgres, qdrant, tenant: options.tenant, ...extra });

  // While the first generation lists the old version, nothing is unreferenced.
  assert.equal((await prune({ execute: true })).versions, 0);
  await dropGeneration(options.tenant, first.generation_id);

  // Counting changes nothing.
  const counted = await prune();
  assert.deepEqual([counted.versions, counted.units, counted.points, counted.execute], [1, oldUnits, oldUnits, false]);
  assert.deepEqual(await versionState(generation, options.tenant, oldVersion), { units: oldUnits, seal: 'ready', points: oldUnits });

  // Nothing runs while an index job is not ready.
  await postgres.pool.query("UPDATE rag_v2_index_job SET state='pending' WHERE tenant=$1 AND generation_id=$2", [options.tenant, second.generation_id]);
  await assert.rejects(prune({ execute: true }), { code: 'prune_index_work_pending' });
  await postgres.pool.query("UPDATE rag_v2_index_job SET state='ready' WHERE tenant=$1 AND generation_id=$2", [options.tenant, second.generation_id]);
  assert.equal((await versionState(generation, options.tenant, oldVersion)).seal, 'ready');

  // A stop after the seal went back to staged, before the points were deleted: the next run completes it.
  const failing = { request: (route, method, body) => (route.endsWith('/points/delete?wait=true')
    ? Promise.reject(Object.assign(new Error('stopped'), { code: 'qdrant_request_failed' })) : qdrant.request(route, method, body)) };
  await assert.rejects(pruneUnreferencedVersions({ postgres, qdrant: failing, tenant: options.tenant, execute: true }), { code: 'qdrant_request_failed' });
  assert.deepEqual(await versionState(generation, options.tenant, oldVersion), { units: oldUnits, seal: 'staged', points: oldUnits });
  const done = await prune({ execute: true });
  assert.deepEqual(done.deleted, { points: oldUnits, units: oldUnits, versions: 1 });
  assert.deepEqual(await versionState(generation, options.tenant, oldVersion), { units: 0, seal: null, points: 0 });
  assert.equal((await prune({ execute: true })).versions, 0);

  // The listed versions keep their rows, seals and points, and the full maintenance check passes.
  assert.equal((await versionState(generation, options.tenant, keptVersion)).seal, 'ready');
  assert.equal((await verifyIndexJob({ plan: second, storeRoot: options.storeRoot, postgres, qdrant, embedding: options.embedding })).verified_documents, 2);
  const vector = await options.embedding.embed('Päevahoiukeskus');
  assert((await qdrant.query(await postgres.active(options.tenant), [changed], vector, 10)).length > 0);
  // The catalog keeps the version: only its index went.
  assert.equal((await postgres.pool.query('SELECT count(*)::integer AS n FROM rag_v2_version WHERE tenant=$1 AND id=$2', [options.tenant, oldVersion])).rows[0].n, 1);

  // Listed again (the old text back), the version is indexed anew and verified.
  const restored = await addDocument(options, 'guide-0', guide(0));
  assert.equal(restored.version.id, oldVersion);
  const third = await plan(options, options.documents), result = await run(options, third);
  assert.equal(result.state, 'ready'); assert.equal(result.sealed_documents, 1); assert.equal(result.reused_documents, 1);
  assert.deepEqual(await versionState(await postgres.active(options.tenant), options.tenant, oldVersion), { units: oldUnits, seal: 'ready', points: oldUnits });
  assert.equal((await verifyIndexJob({ plan: third, storeRoot: options.storeRoot, postgres, qdrant, embedding: options.embedding })).verified_documents, 2);
});

test('the CLI counts without --execute and names its errors', async () => {
  const options = await fixture();
  await run(options, await plan(options, options.documents));
  const cli = async (...extra) => promisify(execFile)(process.execPath, ['scripts/rag-v2-prune-versions.mjs', '--tenant', options.tenant, ...extra],
    { timeout: 30000, env: { ...process.env, TZ: 'UTC' } });
  const counted = JSON.parse((await cli()).stdout);
  assert.deepEqual([counted.versions, counted.execute], [0, false]);
  await assert.rejects(promisify(execFile)(process.execPath, ['scripts/rag-v2-prune-versions.mjs'], { timeout: 30000 }), error => /prune_usage/u.test(error.stderr));
});
