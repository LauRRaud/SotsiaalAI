import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { IngestBatchQueue } from '../lib/rag-v2/ingest-batch-postgres.js';
import { planIngestBatch, prepareNextBatchItem } from '../lib/rag-v2/ingest-batch.js';
import { createBatchReview, publishReviewedBatch } from '../lib/rag-v2/ingest-publication.js';
import { ingest } from '../lib/rag-v2/ingestion.js';
import { registeredSource } from '../lib/rag-v2/registered-source.js';
import { openCatalog, readActive, readJson, writeJson } from '../lib/rag-v2/catalog.js';
import { hash, id } from '../lib/rag-v2/contracts.js';
import { loadSnapshot } from '../lib/rag-v2/search/snapshot.js';
import { QdrantIndex } from '../lib/rag-v2/search/qdrant.js';
import { MockEmbedding } from '../lib/rag-v2/search/embedding.js';
import { indexSnapshot } from '../lib/rag-v2/search/indexing.js';
import { ESTNLTK_LEXICAL, MORPHOLOGY_LEXICAL } from '../lib/rag-v2/search/morphology.js';
import { retrieve } from '../lib/rag-v2/search/retrieval.js';
import { LocalPolicy } from '../lib/rag-v2/search/policy.js';

let root, queue, connections, qdrant;
const tenants = [], collections = [], fetch = globalThis.fetch, connect = net.Socket.prototype.connect;
const rights = { access: 'local_private', usage: 'development_only' };
const profile = { id: 'generic-fixture', version: '1', months: [], categoryLabels: [] };
before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-publication-'));
  connections = await readJson('tmp/rag-v2-services/connections.json');
  queue = new IngestBatchQueue(connections.postgresUrl);
  qdrant = new QdrantIndex(connections.qdrantUrl, connections.qdrantKey);
  const allowed = new Set([new URL(connections.postgresUrl).port, new URL(connections.qdrantUrl).port]);
  globalThis.fetch = (input, options) => {
    assert.equal(new URL(typeof input === 'string' ? input : input.url).origin, connections.qdrantUrl);
    return fetch(input, options);
  };
  net.Socket.prototype.connect = function (...args) {
    const normalized = Array.isArray(args[0]) ? args[0] : args;
    const target = typeof normalized[0] === 'object' ? normalized[0] : { port: normalized[0], host: normalized[1] };
    assert.equal(target.host, '127.0.0.1'); assert(allowed.has(String(target.port)));
    return connect.apply(this, args);
  };
});
after(async () => {
  try {
    for (const collection of collections) await qdrant.request(`/collections/${collection}`, 'DELETE');
    for (const tenant of tenants) for (const table of ['rag_v2_ingest_item', 'rag_v2_ingest_batch', 'rag_v2_unit',
      'rag_v2_generation_document', 'rag_v2_head', 'rag_v2_generation', 'rag_v2_object', 'rag_v2_version', 'rag_v2_document', 'rag_v2_vector_cache']) {
      await queue.pool.query(`DELETE FROM ${table} WHERE tenant=$1`, [tenant]);
    }
  } finally {
    await queue?.close(); globalThis.fetch = fetch; net.Socket.prototype.connect = connect;
    assert(path.dirname(path.resolve(root)) === path.resolve(os.tmpdir()) && path.basename(root).startsWith('rag-v2-publication-'));
    await fs.rm(root, { recursive: true, force: true });
  }
});
async function fixture(count = 2, change = inputs => inputs) {
  const tenant = `publication-${randomUUID()}`; tenants.push(tenant);
  const inputRoot = path.join(root, tenant); await fs.mkdir(inputRoot);
  const inputs = [];
  for (let i = 0; i < count; i++) {
    const source_path = `${i}.html`;
    await fs.writeFile(path.join(inputRoot, source_path), `<article><h1>Document ${i}</h1><p>Koduteenus aitab kodus. Number ${i}.</p></article>`);
    inputs.push({ document_id: String(i), title: `Document ${i}`, source_type: 'fixture', language: 'et', source_path, source_format: 'html' });
  }
  const plan = await planIngestBatch({ tenant, inputRoot, inputs: change(inputs), profile, rights });
  await queue.enqueue(plan);
  const options = { tenant, inputRoot, storeRoot: path.join(inputRoot, 'store'), queue, batchId: plan.id };
  while (await prepareNextBatchItem(options)) { /* complete only local preparation */ }
  return { ...options, plan };
}
const dir = options => path.join(options.storeRoot, id('tenant', options.tenant));
const active = options => readActive(dir(options));
async function reviewed(options) {
  const review = await createBatchReview(options);
  review.reviewed_by = 'synthetic-test-operator';
  for (const item of review.items) item.decision = 'include';
  return review;
}
async function independent(options, name = 'other', source_path = 'other.html') {
  if (source_path === 'other.html') await fs.writeFile(path.join(options.inputRoot, source_path), '<article><h1>Other</h1><p>Independent evidence.</p></article>');
  return ingest({ ...options, profile, rights,
    metadata: { document_id: name, title: 'Other', source_type: 'fixture', language: 'en', source_path, source_format: 'html' } });
}

test('one catalog switch publishes the selected set, preserves existing documents and reaches lexical search', async () => {
  const options = await fixture();
  const previous = await independent(options);
  const review = await reviewed(options), result = await publishReviewedBatch({ ...options, review });
  assert.equal(result.included, 2); assert.equal(result.model_calls, 0); assert.equal(result.search_index, 'not_run');
  const catalog = await active(options);
  assert.equal(Object.keys(catalog.documents).length, 3);
  assert.equal(catalog.documents[previous.bundle.document.id].version_id, previous.bundle.version.id);
  const documents = review.items.map(item => item.document_id);
  const snapshot = await loadSnapshot(options.storeRoot, options.tenant, documents);
  const embedding = new MockEmbedding();
  const indexed = await indexSnapshot({ snapshot, postgres: queue, qdrant, embedding, lexical: MORPHOLOGY_LEXICAL });
  collections.push((await queue.active(options.tenant)).collection);
  assert.equal(indexed.external_embedding_calls, 0);
  const calls = embedding.calls;
  const packet = await retrieve({ postgres: queue, qdrant, embedding,
    policy: new LocalPolicy({ tenants: { [options.tenant]: { reader: [documents[0]] } } }),
    context: { tenant: options.tenant, subject: 'reader', usage: 'development_only' },
    query: { text: 'koduteenust', language: 'et', method: 'lexical', semanticGraph: true, contextMode: 'compact' } });
  assert.equal(packet.state, 'ok', packet.error);
  assert(packet.evidence.length > 0);
  assert(packet.evidence.every(item => item.document_id === documents[0] && item.source_locations.length > 0));
  assert.equal(embedding.calls, calls);
  assert.equal((await queue.status(options.tenant, options.batchId)).publication, 'not_checked');
});

test('pending decisions and unacknowledged warnings stop publication; review evidence is not editable', async () => {
  const options = await fixture(1, inputs => inputs.map(item => ({ ...item, description: 'An imported search aid.' })));
  const review = await createBatchReview(options); review.reviewed_by = 'synthetic-test-operator';
  await assert.rejects(publishReviewedBatch({ ...options, review }), { code: 'batch_review_incomplete' });
  review.items[0].decision = 'include';
  await assert.rejects(publishReviewedBatch({ ...options, review }), { code: 'batch_review_reason_required' });
  review.items[0].note = 'Description retained only as an unverified search aid.';
  const tampered = structuredClone(review); tampered.items[0].warnings = [];
  await assert.rejects(publishReviewedBatch({ ...options, review: tampered }), { code: 'batch_review_changed' });
  const edited = structuredClone(review); edited.items[0].fields.title.value = 'Replacement title';
  await assert.rejects(publishReviewedBatch({ ...options, review: edited }), { code: 'batch_review_changed' });
  assert.equal((await active(options)).generation, null);
  assert.equal((await publishReviewedBatch({ ...options, review })).included, 1);
});

test('conflicting metadata cannot be approved away; exclusion permits independent sources', async () => {
  const options = await fixture(2, inputs => inputs.map((item, index) => index ? item : { ...item, metadata_variants: [{ metadata: { title: 'Conflicting title' } }] }));
  const review = await reviewed(options), conflict = review.items.find(item => item.blockers.length);
  assert(conflict.blockers.includes('metadata_candidate_conflict'));
  conflict.note = 'Attempt to bypass the conflict.';
  await assert.rejects(publishReviewedBatch({ ...options, review }), { code: 'batch_review_blocked' });
  conflict.decision = 'exclude'; conflict.note = 'Correct the conflicting title in a new immutable source version.';
  const result = await publishReviewedBatch({ ...options, review });
  assert.equal(result.included, 1); assert.equal(result.excluded, 1);
  assert.equal((await active(options)).documents[conflict.document_id], undefined);
});

test('registered municipal packages and zoned XML pass review/publication and stay in the requested municipality', async () => {
  const tenant = `publication-kov-${randomUUID()}`; tenants.push(tenant);
  const inputRoot = path.join(root, tenant); await fs.mkdir(inputRoot);
  const inputs = [];
  for (const municipality of ['example_a', 'example_b']) {
    const item = { id: `${municipality}_home`, document_id: `${municipality}_home`, title: 'Koduteenus',
      municipality_id: municipality, municipality_name: `Näidisvald ${municipality}`, source_type: 'municipal_service', language: 'et',
      summary: 'Koduteenus toetab igapäevast toimetulekut kodus.', application: `Pöördu ${municipality} nõustaja poole.` };
    const bytes = JSON.stringify({ items: [item] }), file = `${municipality}.json`;
    await fs.writeFile(path.join(inputRoot, file), bytes);
    inputs.push(await registeredSource(inputRoot, { role: 'source', path: file, sha256: hash(bytes) }, { itemId: item.id }));
  }
  const xml = '<oigusakt><metaandmed><globaalID>fixture-publication-act</globaalID><kehtivus><kehtivuseAlgus>2025-01-01+02:00</kehtivuseAlgus><kehtivuseLopp>2026-12-31Z</kehtivuseLopp></kehtivus></metaandmed><aktinimi><nimi><pealkiri>Näidiseeskiri</pealkiri></nimi></aktinimi><sisu><paragrahv id="p1"><kuvatavNr>1</kuvatavNr><loige><tavatekst>See on üksnes testandmetes kasutatav näidis.</tavatekst></loige></paragrahv></sisu></oigusakt>';
  await fs.writeFile(path.join(inputRoot, 'example.xml'), xml);
  inputs.push(await registeredSource(inputRoot, { role: 'source', path: 'example.xml', sha256: hash(xml) }));
  const plan = await planIngestBatch({ tenant, inputRoot, inputs, profile, rights }); await queue.enqueue(plan);
  const options = { queue, tenant, batchId: plan.id, inputRoot, storeRoot: path.join(inputRoot, 'store') };
  while (await prepareNextBatchItem(options)) { /* isolated local fixture */ }
  const review = await createBatchReview(options);
  assert.equal(review.items.length, 3); assert(review.items.every(item => item.state === 'prepared' && !item.blockers.length));
  review.reviewed_by = 'synthetic-test-operator';
  for (const item of review.items) {
    item.decision = 'include';
    item.note = 'Fictional fixture: collected package/title warnings acknowledged; no real-world eligibility or freshness claimed.';
  }
  assert.equal((await publishReviewedBatch({ ...options, review })).included, 3);
  const documents = review.items.map(item => item.document_id), snapshot = await loadSnapshot(options.storeRoot, tenant, documents);
  const legal = snapshot.bundles.find(b => b.document.fields.source_type.value === 'legal_act');
  assert.equal(legal.document.fields.valid_from.value, '2025-01-01');
  assert.equal(legal.document.fields.valid_from.provenance[0].raw, '2025-01-01+02:00');
  const embedding = new MockEmbedding();
  await indexSnapshot({ snapshot, postgres: queue, qdrant, embedding, lexical: ESTNLTK_LEXICAL });
  collections.push((await queue.active(tenant)).collection);
  const policy = new LocalPolicy({ tenants: { [tenant]: { operator: documents } } }), callsBefore = embedding.calls;
  for (const municipality of ['example_a', 'example_b']) {
    const packet = await retrieve({ postgres: queue, qdrant, embedding, policy, context: { tenant, subject: 'operator', usage: 'development_only' },
      query: { text: 'koduteenuseid', language: 'et', method: 'lexical', semanticGraph: true, contextMode: 'compact', filters: { region: municipality } } });
    assert.equal(packet.state, 'ok', packet.error); assert(packet.evidence.length);
    assert(packet.evidence.every(e => e.source_metadata.municipality_id.value === municipality));
    assert(Object.values(packet.model_context.sources).every(s => s.municipality_id.value === municipality));
    assert(packet.evidence.every(e => e.source_locations.some(location => location.kind === 'json')));
  }
  assert.equal(embedding.calls, callsBefore);
});

test('failed input can be excluded without resetting its queue state or blocking a ready sibling', async () => {
  const options = await fixture();
  // Simulate a separate failed source with the same valid queue terminal-state contract.
  const failed = options.plan.items[0];
  await queue.pool.query("UPDATE rag_v2_ingest_item SET state='needs_review',result=NULL,error_code='batch_source_changed' WHERE tenant=$1 AND batch_id=$2 AND id=$3",
    [options.tenant, options.batchId, failed.id]);
  const review = await reviewed(options), excluded = review.items.find(item => item.item_id === failed.id);
  excluded.decision = 'exclude'; excluded.note = 'Source changed after planning; prepare a new plan.';
  assert.equal((await publishReviewedBatch({ ...options, review })).included, 1);
  assert.equal((await queue.status(options.tenant, options.batchId)).state, 'needs_review');
});

test('failure before the catalog switch exposes no subset and resumes the exact saved decision', async () => {
  const options = await fixture(), review = await reviewed(options);
  await assert.rejects(publishReviewedBatch({ ...options, review }, { beforePublish: async () => {
    assert.equal((await active(options)).generation, null); throw Error('simulated_interruption');
  } }), /simulated_interruption/);
  assert.deepEqual((await active(options)).documents, {});
  const restarted = new IngestBatchQueue(connections.postgresUrl);
  try {
    assert.equal((await publishReviewedBatch({ ...options, queue: restarted, review })).included, 2);
    const reused = await publishReviewedBatch({ ...options, queue: restarted, review });
    assert.equal(reused.reused, true);
    assert.equal((await fs.readdir(path.join(dir(options), 'publications'))).filter(name => name.endsWith('.json')).length, 1);
  } finally { await restarted.close(); }
});

test('failure after the switch is recovered as already published without reapplying or rolling back', async () => {
  const options = await fixture(), review = await reviewed(options);
  await assert.rejects(publishReviewedBatch({ ...options, review }, { afterPublish: () => { throw Error('lost_acknowledgement'); } }), /lost_acknowledgement/);
  const published = await active(options);
  assert.equal((await publishReviewedBatch({ ...options, review })).reused, true);
  assert.deepEqual(await active(options), published);
  await independent(options);
  const newer = await active(options);
  await assert.rejects(publishReviewedBatch({ ...options, review }), { code: 'batch_review_stale_generation' });
  assert.deepEqual(await active(options), newer);
});

test('a stale base and an occupied writer lock cannot overwrite another publication', async () => {
  const options = await fixture(), review = await reviewed(options);
  const lock = await openCatalog(options.storeRoot, options.tenant);
  try { await assert.rejects(publishReviewedBatch({ ...options, review }), { code: 'catalog_busy' }); }
  finally { await lock.close(); }
  await independent(options);
  const newer = await active(options);
  await assert.rejects(publishReviewedBatch({ ...options, review }), { code: 'batch_review_stale_generation' });
  assert.deepEqual(await active(options), newer);
});

test('tenant/store substitution, corrupt assets and rewritten source manifests fail before publication', async () => {
  const options = await fixture(), review = await reviewed(options);
  await assert.rejects(publishReviewedBatch({ ...options, tenant: 'wrong-tenant', review }), { code: 'batch_not_found' });
  await assert.rejects(publishReviewedBatch({ ...options, storeRoot: options.inputRoot, review }), { code: 'batch_storage_mismatch' });
  const folder = path.join(dir(options), 'versions', review.items[0].version_id), file = path.join(folder, 'original.html');
  await fs.appendFile(file, '<p>Corrupt replacement</p>');
  await assert.rejects(publishReviewedBatch({ ...options, review }), { code: 'version_integrity_failed' });
  // Even a self-consistent rewritten manifest cannot alter the batch's frozen source hash.
  const manifest = await readJson(path.join(folder, 'manifest.json'));
  manifest.files['original.html'] = hash(await fs.readFile(file));
  await fs.writeFile(path.join(folder, 'manifest.json'), JSON.stringify(manifest));
  await assert.rejects(publishReviewedBatch({ ...options, review }), { code: 'source_asset_hash_mismatch' });
  assert.deepEqual((await active(options)).documents, {});
});

test('the final catalog rejects duplicate asset identities across batches', async () => {
  const options = await fixture(1);
  await independent(options, 'alias-for-existing-source', '0.html');
  const review = await reviewed(options), before = await active(options);
  await assert.rejects(publishReviewedBatch({ ...options, review }), { code: 'duplicate_asset_identity_conflict' });
  assert.deepEqual(await active(options), before);
});

test('disjoint JSON records publish together while a later overlapping package is rejected', async () => {
  const options = await fixture(1), source_path = 'package.json';
  await fs.writeFile(path.join(options.inputRoot, source_path), JSON.stringify({ items: [
    { title: 'Garden service', summary: 'A fictional garden service.' },
    { title: 'Garden support', summary: 'A fictional garden support.' },
  ] }));
  const inputs = ['Garden service', 'Garden support'].map((title, index) => ({ document_id: `record-${index}`,
    title, source_type: 'fixture', language: 'en', source_path, source_format: 'json', source_selector: { json_pointer: `/items/${index}` } }));
  const plan = await planIngestBatch({ ...options, inputs, profile, rights });
  await queue.enqueue(plan);
  const recordOptions = { ...options, batchId: plan.id };
  while (await prepareNextBatchItem(recordOptions)) { /* prepare disjoint records */ }
  const review = await reviewed(recordOptions);
  for (const item of review.items) {
    assert(item.warnings.some(warning => warning.code === 'collected_package_text'));
    item.note = 'Synthetic collected package; review does not assert website freshness.';
  }
  assert.equal((await publishReviewedBatch({ ...recordOptions, review })).included, 2);
  const whole = { ...inputs[0], document_id: 'entire-package' }; delete whole.source_selector;
  const overlap = await planIngestBatch({ ...options, inputs: [whole], profile, rights });
  await queue.enqueue(overlap);
  const overlapOptions = { ...options, batchId: overlap.id };
  await prepareNextBatchItem(overlapOptions);
  const overlapReview = await reviewed(overlapOptions);
  for (const item of overlapReview.items) item.note = 'Synthetic package overlap check.';
  await assert.rejects(publishReviewedBatch({ ...overlapOptions, review: overlapReview }), { code: 'duplicate_asset_identity_conflict' });
});

test('publication requires settled preparation and rejects a changed recovery receipt', async () => {
  const options = await fixture(), review = await reviewed(options);
  await assert.rejects(publishReviewedBatch({ ...options, review }, { beforePublish: () => { throw Error('pause_before_switch'); } }), /pause_before_switch/);
  const file = path.join(dir(options), 'publications', `${id('ingest_publication', review)}.json`);
  const receipt = await readJson(file); receipt.target.documents = {};
  await fs.writeFile(file, JSON.stringify(receipt));
  await assert.rejects(publishReviewedBatch({ ...options, review }), { code: 'publication_receipt_changed' });
  await fs.writeFile(file, 'null');
  await assert.rejects(publishReviewedBatch({ ...options, review }), { code: 'publication_receipt_changed' });
  await queue.pool.query("UPDATE rag_v2_ingest_item SET state='queued',result=NULL WHERE tenant=$1 AND batch_id=$2 AND id=$3",
    [options.tenant, options.batchId, options.plan.items[0].id]);
  await assert.rejects(createBatchReview(options), { code: 'batch_preparation_incomplete' });
  assert.deepEqual((await active(options)).documents, {});
});

test('CLI creates a draft and publishes/repeats the reviewed file through the same local boundary', async () => {
  const options = await fixture(1);
  const manifest = path.join(options.inputRoot, 'manifest.json'), reviewFile = path.join(options.inputRoot, 'review.json');
  await writeJson(manifest, options.plan);
  const base = ['scripts/rag-v2-ingest-batch.mjs', '--manifest', manifest, '--store', options.storeRoot, '--review', reviewFile, '--development-only'];
  const run = async mode => JSON.parse((await promisify(execFile)(process.execPath, [...base, '--mode', mode],
    { env: { ...process.env, TZ: 'UTC' }, timeout: 30000 })).stdout);
  assert.equal((await run('review')).review, 'pending');
  const draft = await readJson(reviewFile);
  assert.equal(draft.items[0].decision, 'pending');
  draft.reviewed_by = 'synthetic-cli-operator'; draft.items[0].decision = 'include';
  await fs.writeFile(reviewFile, JSON.stringify(draft));
  assert.equal((await run('publish')).publication, 'published');
  assert.equal((await run('publish')).reused, true);
});
