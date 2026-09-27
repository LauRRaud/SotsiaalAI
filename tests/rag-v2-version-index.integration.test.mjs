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
import { planIndexJob, runIndexJob, verifyIndexJob } from '../lib/rag-v2/search/index-jobs.js';
import { IndexJobStore } from '../lib/rag-v2/search/index-jobs-postgres.js';
import { MockEmbedding } from '../lib/rag-v2/search/embedding.js';
import { MORPHOLOGY_LEXICAL } from '../lib/rag-v2/search/morphology.js';
import { QdrantIndex, pointId } from '../lib/rag-v2/search/qdrant.js';
import { VERSION_LAYOUT } from '../lib/rag-v2/search/layout.js';
import { retrieve } from '../lib/rag-v2/search/retrieval.js';
import { LocalPolicy } from '../lib/rag-v2/search/policy.js';

// ADR-036: a version's rows and points are written once per search config; a generation lists versions.
let root, postgres, qdrant, connections;
const tenants = [], savedFetch = globalThis.fetch, savedConnect = net.Socket.prototype.connect;
const rights = { access: 'local_private', usage: 'development_only' }, profile = { id: 'generic', version: '1', months: [], categoryLabels: [] };
before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-version-index-'));
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
      for (const table of ['rag_v2_index_job', 'rag_v2_unit', 'rag_v2_version_unit', 'rag_v2_version_index', 'rag_v2_generation_document', 'rag_v2_head', 'rag_v2_generation',
        'rag_v2_object', 'rag_v2_version', 'rag_v2_document', 'rag_v2_vector_cache']) await postgres.pool.query(`DELETE FROM ${table} WHERE tenant=$1`, [tenant]);
    }
  } finally {
    await postgres?.close(); globalThis.fetch = savedFetch; net.Socket.prototype.connect = savedConnect;
    assert(path.dirname(path.resolve(root)) === path.resolve(os.tmpdir()) && path.basename(root).startsWith('rag-v2-version-index-'));
    await fs.rm(root, { recursive: true, force: true });
  }
});

async function addDocument(options, name, paragraphs) {
  const source_path = `${name}.html`;
  await fs.writeFile(path.join(options.inputRoot, source_path), `<article><h1>${name}</h1>${paragraphs.map(text => `<p>${text}</p>`).join('')}</article>`);
  const { bundle } = await ingest({ tenant: options.tenant, inputRoot: options.inputRoot, storeRoot: options.storeRoot, rights, profile, config: { chunkMaxChars: 140 },
    metadata: { document_id: name, title: name, source_type: 'fixture', language: 'et', source_format: 'html', source_path } });
  return bundle.document.id;
}
const guide = index => Array.from({ length: 5 }, (_, n) => `Koduteenus aitab kodus. Synthetic garden guide ${index}, paragraph ${n}, plants need water and sunlight.`);
async function fixture(count) {
  const tenant = `version-index-${randomUUID()}`; tenants.push(tenant);
  const inputRoot = path.join(root, tenant), storeRoot = path.join(inputRoot, 'store'); await fs.mkdir(inputRoot);
  const options = { tenant, inputRoot, storeRoot, postgres, qdrant, embedding: new MockEmbedding(), documents: [] };
  for (let index = 0; index < count; index++) options.documents.push(await addDocument(options, `guide-${index}`, guide(index)));
  return options;
}
const sealedItems = tenant => (configId, versions) => postgres.sealedItems(tenant, configId, versions);
const plan = (options, documents, lookup = true) => planIndexJob({ storeRoot: options.storeRoot, tenant: options.tenant, documents,
  embedding: options.embedding.config, lexical: MORPHOLOGY_LEXICAL, layout: VERSION_LAYOUT, ...(lookup ? { sealedItems: sealedItems(options.tenant) } : {}) });
const run = (options, indexPlan, extra = {}) => runIndexJob({ plan: indexPlan, storeRoot: options.storeRoot, postgres, qdrant,
  embedding: options.embedding, batchSize: 2, maxBatches: 10000, ...extra });
const unitRows = async tenant => (await postgres.pool.query('SELECT id,xmin::text AS row_version FROM rag_v2_version_unit WHERE tenant=$1 ORDER BY id', [tenant])).rows;
async function points(generation) {
  const all = new Map(); let offset;
  do {
    const page = await qdrant.request(`${qdrant.route(generation)}/points/scroll`, 'POST', { limit: 100, with_payload: true, with_vector: false, ...(offset ? { offset } : {}) });
    for (const point of page.points) all.set(point.id, point.payload);
    offset = page.next_page_offset;
  } while (offset);
  return all;
}
const units = indexPlan => documents => indexPlan.items.filter(item => documents.includes(item.document_id)).reduce((sum, item) => sum + item.units, 0);

test('adding two documents indexes only them; earlier rows and points stay untouched and search reads both', async () => {
  const options = await fixture(3);
  const first = await plan(options, options.documents);
  assert.equal(first.layout, VERSION_LAYOUT);
  const base = await run(options, first);
  assert.equal(base.state, 'ready'); assert.equal(base.sealed_documents, 3); assert.equal(base.reused_documents, 0);
  const baseGeneration = await postgres.active(options.tenant), before = await unitRows(options.tenant), beforePoints = await points(baseGeneration);
  assert.equal(before.length, first.total_units); assert.equal(beforePoints.size, first.total_units);

  const added = [await addDocument(options, 'new-a', ['Kaminahoidja nõustab eakaid kodus.', 'Kaminahoidja tuleb kord nädalas.']),
    await addDocument(options, 'new-b', ['Päevakeskus pakub eakatele lõunat.', 'Päevakeskus on avatud tööpäeviti.'])];
  const second = await plan(options, [...options.documents, ...added]), written = [];
  const result = await run(options, second, { hooks: { afterBatchWrite: ({ units: batch }) => written.push(...batch) } });
  const addedUnits = units(second)(added);
  assert.equal(result.state, 'ready'); assert.equal(result.reused_documents, 3); assert.equal(result.reused_units, first.total_units);
  assert.equal(result.sealed_documents, 2); assert.equal(result.mock_vectors_created, addedUnits); assert.equal(result.external_embedding_calls, 0);
  assert(written.length === addedUnits && written.every(unit => added.includes(unit.document_id)));

  // Earlier rows keep their row versions: nothing rewrote them. Earlier points keep their payloads.
  const after = await unitRows(options.tenant), earlier = new Map(before.map(row => [row.id, row.row_version]));
  assert.equal(after.length, before.length + addedUnits);
  assert.deepEqual(after.filter(row => earlier.has(row.id)), before);
  const generation = await postgres.active(options.tenant), afterPoints = await points(generation);
  assert.equal(generation.id, second.generation_id); assert.equal(generation.collection, baseGeneration.collection);
  assert.equal(afterPoints.size, beforePoints.size + addedUnits);
  for (const [id, payload] of beforePoints) assert.deepEqual(afterPoints.get(id), payload);

  // Each generation searches its own list: the earlier one does not see the new documents.
  const vector = await options.embedding.embed('Kaminahoidja');
  assert.equal((await qdrant.query(baseGeneration, added, vector, 10)).length, 0);
  assert((await qdrant.query(generation, added, vector, 10)).length > 0);
  assert.equal((await postgres.lexical(options.tenant, baseGeneration.id, added, 'kaminahoidja', 10)).length, 0);
  const packet = await retrieve({ ...options, policy: new LocalPolicy({ tenants: { [options.tenant]: { reader: [...options.documents, ...added] } } }),
    context: { tenant: options.tenant, subject: 'reader', usage: 'development_only' },
    query: { text: 'kaminahoidja', language: 'et', method: 'hybrid', semanticGraph: true, contextMode: 'compact' } });
  assert.equal(packet.state, 'ok', packet.error); assert.equal(packet.generation_id, generation.id);
  assert(packet.evidence.some(row => row.document_id === added[0] && row.source_locations.length));
  assert(packet.evidence.every(row => generation.snapshot.documents[row.document_id]?.version_id === row.document_version_id));
});

test('removing a document needs no indexing and the new generation no longer finds it', async () => {
  const options = await fixture(3);
  await run(options, await plan(options, options.documents));
  const baseGeneration = await postgres.active(options.tenant), [removed, ...kept] = options.documents;
  const result = await run(options, await plan(options, kept));
  assert.equal(result.state, 'ready'); assert.equal(result.reused_documents, 2); assert.equal(result.sealed_documents, 0);
  assert.equal(result.mock_vectors_created, 0); assert.equal(result.batches_completed, 1);
  const generation = await postgres.active(options.tenant), vector = await options.embedding.embed('Koduteenus');
  assert.equal((await qdrant.query(generation, [removed], vector, 10)).length, 0);
  assert.equal((await postgres.lexical(options.tenant, generation.id, [removed], 'koduteenus', 10)).length, 0);
  assert.equal((await postgres.units(options.tenant, generation.id, [removed])).length, 0);
  assert((await postgres.lexical(options.tenant, generation.id, kept, 'koduteenus', 10)).length > 0);
  // The earlier generation still has it until its rows are cleaned up.
  assert((await postgres.lexical(options.tenant, baseGeneration.id, [removed], 'koduteenus', 10)).length > 0);
  assert((await qdrant.query(baseGeneration, [removed], vector, 10)).length > 0);
});

test('a changed document is indexed as its new version; each generation reads only its own version', async () => {
  const options = await fixture(2), [changed] = options.documents;
  await run(options, await plan(options, options.documents));
  const earlier = await postgres.active(options.tenant);
  assert.equal(await addDocument(options, 'guide-0', ['Päevahoiukeskus avab uksed hommikul.', 'Päevahoiukeskus pakub tegevusi.']), changed);
  const next = await plan(options, options.documents);
  assert.notEqual(next.source.documents[changed].version_id, earlier.snapshot.documents[changed].version_id);
  const result = await run(options, next);
  assert.equal(result.reused_documents, 1); assert.equal(result.sealed_documents, 1);
  const generation = await postgres.active(options.tenant), vector = await options.embedding.embed('Päevahoiukeskus');
  const oldHits = await qdrant.query(earlier, [changed], vector, 50), newHits = await qdrant.query(generation, [changed], vector, 50);
  assert(oldHits.length && oldHits.every(hit => hit.version_id === earlier.snapshot.documents[changed].version_id));
  assert(newHits.length && newHits.every(hit => hit.version_id === generation.snapshot.documents[changed].version_id));
  assert.equal((await postgres.lexical(options.tenant, earlier.id, [changed], 'päevahoiukeskus', 10)).length, 0);
  assert((await postgres.lexical(options.tenant, generation.id, [changed], 'päevahoiukeskus', 10)).length > 0);
  assert((await postgres.units(options.tenant, generation.id, [changed])).every(unit => unit.version_id === generation.snapshot.documents[changed].version_id));
});

test('a restart checks earlier points before sealing; a differing seal fails closed; verify analyses morphology again', async () => {
  const options = await fixture(1), first = await plan(options, options.documents); let unit;
  await run(options, first, { maxBatches: 1, hooks: { afterBatchWrite: value => { unit = value.units[0]; } } });
  const staged = (await postgres.pool.query('SELECT * FROM rag_v2_generation WHERE tenant=$1 AND id=$2', [options.tenant, first.generation_id])).rows[0];
  await qdrant.request(`${qdrant.route(staged)}/points/payload?wait=true`, 'POST', { points: [pointId(unit.id)], payload: { version_id: 'forged' } });
  await assert.rejects(run(options, first), { code: 'qdrant_point_integrity_failed' });
  assert.equal((await postgres.sealedItems(options.tenant, first.config.id, [unit.version_id])).size, 0);
  await assert.rejects(postgres.active(options.tenant), { code: 'no_active_search_generation' });
  await qdrant.request(`${qdrant.route(staged)}/points/payload?wait=true`, 'POST', { points: [pointId(unit.id)], payload: { version_id: unit.version_id } });
  assert.equal((await run(options, first)).state, 'ready');

  // A seal is trusted only with the item the plan measured for the version.
  await postgres.pool.query(`UPDATE rag_v2_version_index SET item=jsonb_set(item,'{embedding_input_tokens}','1') WHERE tenant=$1`, [options.tenant]);
  const added = await addDocument(options, 'new-a', ['Kaminahoidja nõustab eakaid kodus.']);
  await assert.rejects(run(options, await plan(options, [...options.documents, added], false)), { code: 'version_index_item_mismatch' });
  await postgres.pool.query(`UPDATE rag_v2_version_index SET item=jsonb_set(item,'{embedding_input_tokens}',$2::jsonb) WHERE tenant=$1`,
    [options.tenant, JSON.stringify(first.items[0].embedding_input_tokens)]);

  // The maintenance check analyses the stored morphology again and finds a changed one.
  const verify = () => verifyIndexJob({ plan: first, storeRoot: options.storeRoot, postgres, qdrant, embedding: options.embedding });
  assert.equal((await verify()).verified_documents, 1);
  await postgres.pool.query(`UPDATE rag_v2_version_unit SET morphology=jsonb_set(morphology,'{body}','"forged"') WHERE tenant=$1 AND id=$2`, [options.tenant, unit.id]);
  await assert.rejects(verify(), { code: 'index_morphology_integrity_failed' });
});

test('CLI plan reports only the documents still to index and a second run lists the rest', async () => {
  const options = await fixture(2), policyFile = path.join(options.inputRoot, 'policy.json');
  await writeJson(policyFile, { tenants: { [options.tenant]: { operator: options.documents } } });
  const args = ['scripts/rag-v2-index-batch.mjs', '--store', options.storeRoot, '--lexical', MORPHOLOGY_LEXICAL,
    '--policy', policyFile, '--tenant', options.tenant, '--subject', 'operator', '--batch-size', '2', '--development-only'];
  // Each plan is a new manifest file; a plan file is never overwritten.
  let manifest = path.join(options.inputRoot, 'index-1.json');
  const cli = async mode => JSON.parse((await promisify(execFile)(process.execPath, [...args, '--manifest', manifest, '--mode', mode],
    { timeout: 30000, env: { ...process.env, TZ: 'UTC' } })).stdout);
  const first = await cli('plan');
  assert.equal(first.layout, VERSION_LAYOUT); assert.equal(first.documents_to_index, 2); assert.equal(first.units_to_index, first.units);
  assert.equal((await cli('run')).sealed_documents, 2);
  const added = await addDocument(options, 'new-a', ['Kaminahoidja nõustab eakaid kodus.']);
  await fs.writeFile(policyFile, JSON.stringify({ tenants: { [options.tenant]: { operator: [...options.documents, added] } } }));
  manifest = path.join(options.inputRoot, 'index-2.json');
  const second = await cli('plan');
  assert.equal(second.documents, 3); assert.equal(second.documents_to_index, 1);
  const result = await cli('run');
  assert.equal(result.state, 'ready'); assert.equal(result.reused_documents, 2); assert.equal(result.sealed_documents, 1);
  assert.equal((await cli('verify')).verified_documents, 3);
});
