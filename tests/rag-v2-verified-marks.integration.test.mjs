import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ingest } from '../lib/rag-v2/ingestion.js';
import { readJson } from '../lib/rag-v2/catalog.js';
import { planIndexJob, runIndexJob } from '../lib/rag-v2/search/index-jobs.js';
import { IndexJobStore } from '../lib/rag-v2/search/index-jobs-postgres.js';
import { MockEmbedding } from '../lib/rag-v2/search/embedding.js';
import { ESTNLTK_LEXICAL } from '../lib/rag-v2/search/morphology.js';
import { QdrantIndex } from '../lib/rag-v2/search/qdrant.js';
import { VERSION_LAYOUT } from '../lib/rag-v2/search/layout.js';

// ADR-069 against the local Postgres and Qdrant (node scripts/rag-v2-local.mjs up): the server keeps marks of its full
// checks; a measurement script reads them and writes none. Two indexed documents of a test tenant; the marks table is in
// a schema of its own, so no other process's marks are read or changed. The analyzer is a stand-in that counts its calls.
let root, postgres, qdrant, connections, schema;
const tenants = [], catalogs = [];
const rights = { access: 'local_private', usage: 'development_only' }, profile = { id: 'generic', version: '1', months: [], categoryLabels: [] };
const analyzer = { calls: 0, async analyze(texts) { this.calls++; return texts.map(() => 'vmetmark'); } };
before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-verified-marks-'));
  connections = await readJson('tmp/rag-v2-services/connections.json');
  assert.equal(new URL(connections.postgresUrl).hostname, '127.0.0.1');
  postgres = new IndexJobStore(connections.postgresUrl, { analyzer }); qdrant = new QdrantIndex(connections.qdrantUrl, connections.qdrantKey);
  schema = `verified_marks_${randomUUID().replaceAll('-', '')}`;
  await postgres.pool.query(`CREATE SCHEMA ${schema}`);
  await postgres.pool.query(`CREATE TABLE ${schema}.rag_v2_verified_read(mark text PRIMARY KEY, verified_at timestamptz NOT NULL DEFAULT clock_timestamp())`);
});
after(async () => {
  try {
    for (const catalog of catalogs) await catalog.close();
    for (const tenant of tenants) {
      for (const generation of (await postgres.pool.query('SELECT * FROM rag_v2_generation WHERE tenant=$1', [tenant])).rows) {
        await qdrant.request(`${qdrant.route(generation)}/points/delete?wait=true`, 'POST', { filter: { must: [{ key: 'tenant', match: { value: tenant } }] } })
          .catch(error => { if (error.status !== 404) throw error; });
      }
      for (const table of ['rag_v2_prune_run', 'rag_v2_index_job', 'rag_v2_unit', 'rag_v2_version_unit', 'rag_v2_version_index', 'rag_v2_generation_document', 'rag_v2_head', 'rag_v2_generation',
        'rag_v2_object', 'rag_v2_version', 'rag_v2_document', 'rag_v2_vector_cache']) await postgres.pool.query(`DELETE FROM ${table} WHERE tenant=$1`, [tenant]);
    }
    assert.match(schema, /^verified_marks_[a-f0-9]{32}$/u);
    await postgres.pool.query(`DROP SCHEMA ${schema} CASCADE`);
  } finally {
    await postgres?.close();
    assert(path.dirname(path.resolve(root)) === path.resolve(os.tmpdir()) && path.basename(root).startsWith('rag-v2-verified-marks-'));
    await fs.rm(root, { recursive: true, force: true });
  }
});

async function fixture() {
  const tenant = `verified-marks-${randomUUID()}`; tenants.push(tenant);
  const inputRoot = path.join(root, tenant), storeRoot = path.join(inputRoot, 'store'); await fs.mkdir(inputRoot);
  const options = { tenant, inputRoot, storeRoot, embedding: new MockEmbedding(), documents: [] };
  for (let index = 0; index < 2; index++) {
    const name = `guide-${index}`, source_path = `${name}.html`;
    const paragraphs = Array.from({ length: 5 }, (_, n) => `Koduteenus aitab kodus. Synthetic guide ${index}, paragraph ${n}, plants need water and sunlight.`);
    await fs.writeFile(path.join(inputRoot, source_path), `<article><h1>${name}</h1>${paragraphs.map(text => `<p>${text}</p>`).join('')}</article>`);
    const { bundle } = await ingest({ tenant, inputRoot, storeRoot, rights, profile, config: { chunkMaxChars: 140 },
      metadata: { document_id: name, title: name, source_type: 'fixture', language: 'et', source_format: 'html', source_path } });
    options.documents.push(bundle.document.id);
  }
  const plan = await planIndexJob({ storeRoot, tenant, documents: options.documents, embedding: options.embedding.config, lexical: ESTNLTK_LEXICAL, layout: VERSION_LAYOUT,
    sealedItems: (configId, versions) => postgres.sealedItems(tenant, configId, versions) });
  await runIndexJob({ plan, storeRoot, postgres, qdrant, embedding: options.embedding, batchSize: 2, maxBatches: 10000 });
  return { ...options, generation: plan.generation_id };
}
// A catalog as a new process has it: its own verified cache, the marks table of this test, its SQL recorded.
function process_() {
  const catalog = new IndexJobStore(connections.postgresUrl, { analyzer });
  catalog.pool.options.options = `-c search_path=${schema},public`;
  const query = catalog.pool.query.bind(catalog.pool);
  catalog.sql = [];
  catalog.pool.query = (text, ...values) => { catalog.sql.push(String(text)); return query(text, ...values); };
  catalogs.push(catalog);
  return catalog;
}
const marks = async () => (await postgres.pool.query(`SELECT count(*)::int AS n FROM ${schema}.rag_v2_verified_read`)).rows[0].n;
const objectsRead = catalog => catalog.sql.some(text => text.includes('SELECT version_id,id,data'));
const read = async (catalog, f, documents) => { analyzer.calls = 0; catalog.sql.length = 0; await catalog.bundles(f.tenant, f.generation, documents); await catalog.units(f.tenant, f.generation, documents); };

test('a measurement script reads the server\'s marks, verifies what has none itself and writes nothing', async () => {
  const f = await fixture(), [checked, unchecked] = f.documents;
  // The server has verified one document in full and saved its three marks (bundle, objects, unit morphology).
  const server = process_();
  assert.equal(await server.inheritVerified(), 0);
  await read(server, f, [checked]);
  assert.ok(analyzer.calls > 0 && objectsRead(server));
  assert.equal(await server.saveVerified(), 3);

  const script = process_();
  assert.equal(await script.inheritVerified({ keep: false }), 3);
  assert.ok(!script.sql.some(text => /^\s*(DELETE|INSERT)/u.test(text)), 'reading the marks changes nothing');
  // The checked document: no morphology analysis, no object comparison. The other one: verified in full here.
  await read(script, f, [checked]);
  assert.deepEqual([analyzer.calls, objectsRead(script)], [0, false]);
  await read(script, f, [unchecked]);
  assert.ok(analyzer.calls > 0 && objectsRead(script));
  // Its own check is its own knowledge: the next read is quick, and the table is as the server left it.
  await read(script, f, [unchecked]);
  assert.deepEqual([analyzer.calls, objectsRead(script), await script.saveVerified(), await marks()], [0, false, 0, 3]);
  assert.ok(!script.sql.some(text => /^\s*(DELETE|INSERT)/u.test(text)));

  // Without the marks (--cold) the same read verifies in full, as before.
  const cold = process_();
  await read(cold, f, [checked]);
  assert.ok(analyzer.calls > 0 && objectsRead(cold));
});

test('a row changed after the server\'s check is verified again and refused; the script\'s lost trust leaves the table alone', async () => {
  const f = await fixture(), [first, second] = f.documents;
  const server = process_();
  await server.inheritVerified();
  await read(server, f, f.documents);
  assert.equal(await server.saveVerified(), 6);
  const before = await marks();
  await postgres.pool.query("UPDATE rag_v2_version_unit SET morphology='{}'::jsonb WHERE tenant=$1 AND document_id=$2", [f.tenant, first]);

  const script = process_();
  await script.inheritVerified({ keep: false });
  // The changed rows have other row versions than the mark names: the full check runs and fails before use.
  await assert.rejects(script.units(f.tenant, f.generation, [first]), { code: 'index_morphology_integrity_failed' });
  // The unchanged document is still read by its mark.
  await read(script, f, [second]);
  assert.deepEqual([analyzer.calls, objectsRead(script)], [0, false]);
  // A warm-up of its own (--warm) checks everything itself; when it fails, the script's trust ends and the server's marks stay.
  await assert.rejects(script.warm(f.tenant, f.generation, f.documents), { code: 'index_morphology_integrity_failed' });
  assert.deepEqual([script.inherited.size, await marks()], [0, before]);
  assert.ok(!script.sql.some(text => /^\s*(DELETE|INSERT)/u.test(text)));
});
