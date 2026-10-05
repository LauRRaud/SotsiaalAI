#!/usr/bin/env node
// The vector fixture of tests/rag-v2-dialogue-scenarios.integration.test.mjs. That test indexes the real municipal
// packages of its catalogue and takes each unit's vector from tmp/rag-v2-scenarios by the unit's exact embedding input
// text; it buys nothing. When the reader or the packages change, the texts change and the test stops with
// scenario_unit_vector_missing (it had since 27.09.2026). The same units are in the production index with the same
// input text, so their vectors are there already: this script lists what the test needs and rebuilds the fixture from
// vectors exported there. No model call, no embedding call.
//   needs  --out FILE [--fixture tmp/rag-v2-scenarios]
//     Ingests the catalogue's municipalities into a temporary store (as the test does, local services) and writes
//     every unit's input text and its hash; prints how many the fixture has.
//   export --needs FILE --out FILE [--usage DIR ...]   (on the server, from the running release, read-only)
//     For every needed hash that a unit of the active generation has, the unit's vector from the index. A text the
//     index no longer has (a package contact the register's contacts replaced) may still have its vector among the
//     earlier purchases: --usage names their directories, and the vector is read from there, verified as a reuse is.
//   build  --needs FILE --vectors FILE [--fixture tmp/rag-v2-scenarios]
//     Writes kov-unit-inputs.json and kov-unit-vectors.ndjson from the fixture's own vectors and the exported ones;
//     the files it replaces are kept beside them (*.before-<day>). Stops when a needed text has no vector.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { hash } from '../lib/rag-v2/contracts.js';

const { positionals: [mode], values } = parseArgs({ allowPositionals: true, options: { out: { type: 'string' }, needs: { type: 'string' }, vectors: { type: 'string' },
  usage: { type: 'string', multiple: true, default: [] },
  fixture: { type: 'string', default: 'tmp/rag-v2-scenarios' }, catalogue: { type: 'string', default: 'tests/evaluation/dialogue/scenarios-1.json' } } });
const MODEL = 'text-embedding-3-large', DIMENSIONS = 3072;
const encode = vector => Buffer.from(new Float32Array(vector).buffer).toString('base64');
const readFixture = async dir => {
  const inputs = JSON.parse(await fs.readFile(path.join(dir, 'kov-unit-inputs.json'), 'utf8')).input, vectors = new Map();
  for (const line of (await fs.readFile(path.join(dir, 'kov-unit-vectors.ndjson'), 'utf8')).trim().split('\n').map(JSON.parse)) {
    line.embeddings.forEach((b64, index) => vectors.set(hash(inputs[line.offset + index]), b64));
  }
  return vectors;
};

if (mode === 'needs') {
  const { registeredSource } = await import('../lib/rag-v2/registered-source.js');
  const { IngestBatchQueue } = await import('../lib/rag-v2/ingest-batch-postgres.js');
  const { planIngestBatch, prepareNextBatchItem } = await import('../lib/rag-v2/ingest-batch.js');
  const { createBatchReview, publishReviewedBatch } = await import('../lib/rag-v2/ingest-publication.js');
  const { loadSnapshot } = await import('../lib/rag-v2/search/snapshot.js');
  const { embeddingConfig, indexUnit, OPENAI_EMBEDDING_ENDPOINT } = await import('../lib/rag-v2/search/embedding.js');
  const scenarios = JSON.parse(await fs.readFile(values.catalogue, 'utf8')), tenant = `scenario-fixture-${randomUUID()}`;
  const connections = JSON.parse(await fs.readFile('tmp/rag-v2-services/connections.json', 'utf8'));
  const embedding = embeddingConfig({ embedding_mode: 'real', provider: 'openai', model: MODEL, dimensions: DIMENSIONS, endpoint: OPENAI_EMBEDDING_ENDPOINT });
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-scenario-fixture-')), postgres = new IngestBatchQueue(connections.postgresUrl);
  try {
    // The same ingest as the test's: every item of each municipality's package, a record with a blocker left out.
    const register = JSON.parse(await fs.readFile('Andmebaasi/REGISTER.json', 'utf8')), sources = [];
    for (const kov of scenarios.municipalities) {
      const entry = register.entries.find(item => item.path === `KOV/${kov}/${kov}.json` && item.role === 'source');
      for (const item of JSON.parse(await fs.readFile(`Andmebaasi/${entry.path}`, 'utf8')).items) sources.push(await registeredSource('Andmebaasi', entry, { itemId: item.id }));
    }
    const profile = JSON.parse(await fs.readFile('lib/rag-v2/domain-profiles/sotsiaalai.json', 'utf8'));
    const plan = await planIngestBatch({ tenant, inputRoot: 'Andmebaasi', inputs: sources, rights: { access: 'local_private', usage: 'development_only' }, profile });
    await postgres.enqueue(plan);
    const options = { tenant, inputRoot: 'Andmebaasi', storeRoot: path.join(root, 'store'), queue: postgres, batchId: plan.id };
    while (await prepareNextBatchItem(options)) { /* one item at a time */ }
    const review = await createBatchReview(options);
    review.reviewed_by = 'scenario-fixture';
    for (const item of review.items) Object.assign(item, item.blockers.length ? { decision: 'exclude', note: 'Blocked in review.' } : { decision: 'include', note: 'Scenario fixture: the texts only.' });
    await publishReviewedBatch({ ...options, review });
    const snapshot = await loadSnapshot(options.storeRoot, tenant, review.items.filter(item => item.decision === 'include').map(item => item.document_id));
    const units = new Map();
    for (const bundle of snapshot.bundles) for (const chunk of bundle.chunks) { const unit = indexUnit(chunk, bundle, embedding); units.set(unit.input_hash, unit.input_text); }
    const have = await readFixture(values.fixture).catch(() => new Map());
    await fs.writeFile(values.out, JSON.stringify({ model: MODEL, dimensions: DIMENSIONS, municipalities: scenarios.municipalities, units: [...units].map(([sha256, text]) => ({ sha256, text })) }));
    console.log(JSON.stringify({ municipalities: scenarios.municipalities, documents: snapshot.bundles.length, units: units.size, in_fixture: [...units.keys()].filter(key => have.has(key)).length,
      missing: [...units.keys()].filter(key => !have.has(key)).length, fixture_vectors: have.size }));
  } finally {
    for (const table of ['rag_v2_ingest_item', 'rag_v2_ingest_batch', 'rag_v2_object', 'rag_v2_version', 'rag_v2_document']) await postgres.pool.query(`DELETE FROM ${table} WHERE tenant=$1`, [tenant]).catch(() => {});
    await postgres.close();
    await fs.rm(root, { recursive: true, force: true });
  }
} else if (mode === 'export') {
  const { readPilotConfig } = await import('../lib/rag-v2/pilot/config.js');
  const { processCatalog } = await import('../lib/rag-v2/search/postgres.js');
  const { QdrantIndex, pointId } = await import('../lib/rag-v2/search/qdrant.js');
  const { indexUnit } = await import('../lib/rag-v2/search/embedding.js');
  const { filtersMatch } = await import('../lib/rag-v2/search/ranking.js');
  const needs = JSON.parse(await fs.readFile(values.needs, 'utf8')), wanted = new Set(needs.units.map(unit => unit.sha256));
  const plan = JSON.parse(await fs.readFile(process.env.M4_PILOT_CONFIG, 'utf8')), config = await readPilotConfig(plan.users[0], { purpose: 'read' });
  const postgres = processCatalog(process.env.RAG_V2_POSTGRES_URL), generation = await postgres.active(config.tenant);
  const embedding = generation.config.embedding;
  if (embedding.model !== needs.model || embedding.dimensions !== needs.dimensions) throw new Error('the index has another embedding model than the fixture');
  const qdrant = new QdrantIndex(process.env.RAG_V2_QDRANT_URL, process.env.RAG_V2_QDRANT_KEY);
  const directories = await postgres.retrievalDirectory(config.tenant, generation, Object.keys(generation.snapshot.documents));
  const regions = needs.municipalities.map(name => name.replace(/-/gu, '_'));
  const ids = directories.filter(item => regions.some(region => filtersMatch({ document: { fields: item.fields } }, { region }))).map(item => item.document_id);
  // The units of those municipalities' documents whose input text the test asks for, each once.
  const found = new Map();
  for (let at = 0; at < ids.length; at += 200) for (const bundle of await postgres.bundles(config.tenant, generation.id, ids.slice(at, at + 200))) {
    for (const chunk of bundle.chunks) { const unit = indexUnit(chunk, bundle, embedding); if (wanted.has(unit.input_hash) && !found.has(unit.input_hash)) found.set(unit.input_hash, unit.id); }
  }
  const vectors = {}, list = [...found];
  for (let at = 0; at < list.length; at += 100) {
    const batch = list.slice(at, at + 100), byPoint = new Map(batch.map(([sha256, unitId]) => [pointId(unitId), sha256]));
    const points = await qdrant.request(`${qdrant.route(generation)}/points`, 'POST', { ids: [...byPoint.keys()], with_payload: false, with_vector: true });
    for (const point of points) if (Array.isArray(point.vector) && point.vector.length === needs.dimensions) vectors[byPoint.get(point.id)] = encode(point.vector);
  }
  // What the index does not have, from the purchases made for earlier corpus versions.
  const indexed = Object.keys(vectors).length;
  if (values.usage.length) {
    const { reusableEmbeddingCatalog } = await import('../lib/rag-v2/search/pilot-runner.js');
    const catalog = await reusableEmbeddingCatalog(values.usage.map(directory => path.resolve(directory)), config.tenant);
    if (catalog.config.model !== needs.model || catalog.config.dimensions !== needs.dimensions) throw new Error('the purchases have another embedding model than the fixture');
    for (const sha256 of wanted) if (!vectors[sha256] && catalog.embedding.owners.has(sha256)) {
      const vector = await catalog.embedding.owners.get(sha256).vector(sha256);
      if (Array.isArray(vector) && vector.length === needs.dimensions) vectors[sha256] = encode(vector);
    }
  }
  await fs.writeFile(values.out, JSON.stringify({ model: needs.model, dimensions: needs.dimensions, generation: generation.id, vectors }));
  console.log(JSON.stringify({ generation: generation.id.slice(-8), documents_read: ids.length, needed: wanted.size, units_with_the_same_text: found.size, vectors_from_the_index: indexed,
    vectors_from_earlier_purchases: Object.keys(vectors).length - indexed, without_a_vector: wanted.size - Object.keys(vectors).length }));
  process.exit(0);
} else if (mode === 'build') {
  const needs = JSON.parse(await fs.readFile(values.needs, 'utf8')), exported = JSON.parse(await fs.readFile(values.vectors, 'utf8'));
  if (exported.model !== MODEL || exported.dimensions !== DIMENSIONS || needs.model !== MODEL) throw new Error('another embedding model');
  const have = await readFixture(values.fixture).catch(() => new Map());
  const rows = needs.units.map(unit => ({ text: unit.text, vector: exported.vectors[unit.sha256] ?? have.get(unit.sha256) ?? null, from: exported.vectors[unit.sha256] ? 'export' : 'fixture' }));
  const missing = rows.filter(row => !row.vector);
  if (missing.length) { console.log(JSON.stringify({ ok: false, needed: rows.length, without_a_vector: missing.length })); process.exit(1); }
  if (rows.some(row => Buffer.from(row.vector, 'base64').length !== DIMENSIONS * 4)) throw new Error('a vector of another size');
  const day = new Date().toISOString().slice(0, 10);
  for (const name of ['kov-unit-inputs.json', 'kov-unit-vectors.ndjson']) await fs.rename(path.join(values.fixture, name), path.join(values.fixture, `${name}.before-${day}`)).catch(error => { if (error.code !== 'ENOENT') throw error; });
  await fs.writeFile(path.join(values.fixture, 'kov-unit-inputs.json'), JSON.stringify({ model: MODEL, dimensions: DIMENSIONS, input: rows.map(row => row.text) }));
  const lines = [];
  for (let offset = 0; offset < rows.length; offset += 100) lines.push(JSON.stringify({ offset, embeddings: rows.slice(offset, offset + 100).map(row => row.vector) }));
  await fs.writeFile(path.join(values.fixture, 'kov-unit-vectors.ndjson'), `${lines.join('\n')}\n`);
  console.log(JSON.stringify({ ok: true, units: rows.length, from_the_export: rows.filter(row => row.from === 'export').length, from_the_old_fixture: rows.filter(row => row.from === 'fixture').length }));
} else {
  console.error('usage: rag-v2-scenario-fixture.mjs needs|export|build (see the head of the file)');
  process.exit(2);
}
