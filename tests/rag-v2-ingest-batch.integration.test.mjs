import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { IngestBatchQueue } from '../lib/rag-v2/ingest-batch-postgres.js';
import { planIngestBatch, prepareNextBatchItem, verifyPreparedBatch } from '../lib/rag-v2/ingest-batch.js';
import { readActive } from '../lib/rag-v2/catalog.js';
import { id } from '../lib/rag-v2/contracts.js';

let root, queue, url, rejectedNetwork = 0;
const tenants = [], fetch = globalThis.fetch, connect = net.Socket.prototype.connect;
const rights = { access: 'local_private', usage: 'development_only' };
const profile = { id: 'generic-fixture', version: '1', months: [], categoryLabels: [] };
before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-batch-db-'));
  globalThis.fetch = () => { rejectedNetwork++; throw Error('unexpected_network'); };
  net.Socket.prototype.connect = function (...args) {
    const normalized = Array.isArray(args[0]) ? args[0] : args;
    const target = typeof normalized[0] === 'object' ? normalized[0] : { port: normalized[0], host: normalized[1] };
    if (!target || target.host !== '127.0.0.1' || Number(target.port) !== 55432) { rejectedNetwork++; throw Error('unexpected_network'); }
    return connect.apply(this, args);
  };
  const config = JSON.parse(await fs.readFile('tmp/rag-v2-services/connections.json', 'utf8'));
  url = config.postgresUrl; queue = new IngestBatchQueue(url);
});
after(async () => {
  if (queue) {
    for (const tenant of tenants) {
      await queue.pool.query('DELETE FROM rag_v2_ingest_item WHERE tenant=$1', [tenant]);
      await queue.pool.query('DELETE FROM rag_v2_ingest_batch WHERE tenant=$1', [tenant]);
    }
    await queue.close();
  }
  globalThis.fetch = fetch; net.Socket.prototype.connect = connect;
  assert(path.dirname(path.resolve(root)) === path.resolve(os.tmpdir()) && path.basename(root).startsWith('rag-v2-batch-db-'));
  await fs.rm(root, { recursive: true, force: true });
  assert.equal(rejectedNetwork, 0);
});
async function fixture(count = 1, format = 'html') {
  const tenant = 'batch-test-' + randomUUID(); tenants.push(tenant);
  const inputRoot = path.join(root, tenant); await fs.mkdir(inputRoot);
  const inputs = [];
  for (let i = 0; i < count; i++) {
    const source_path = `${i}.${format}`;
    await fs.writeFile(path.join(inputRoot, source_path), format === 'pdf' ? `%PDF-1.4 fixture ${i}` : `<article><h1>Document ${i}</h1><p>Seedlings need water every morning.</p></article>`);
    inputs.push({ document_id: `${i}`, source_type: 'fixture', title: `Document ${i}`, language: 'en', source_path, source_format: format });
  }
  const plan = await planIngestBatch({ tenant, inputRoot, inputs, profile, rights });
  await queue.enqueue(plan);
  return { tenant, inputRoot, plan, batchId: plan.id, storeRoot: path.join(inputRoot, 'store'), queue };
}
const expire = claim => queue.pool.query('UPDATE rag_v2_ingest_item SET lease_until=clock_timestamp()-interval \'1 second\' WHERE tenant=$1 AND batch_id=$2 AND id=$3', [claim.tenant, claim.batch_id, claim.id]);

test('PostgreSQL restart and idempotent enqueue preserve preparation, counts and unpublished state', async () => {
  const options = await fixture(3);
  assert.equal((await prepareNextBatchItem(options)).state, 'prepared');
  const before = await queue.status(options.tenant, options.batchId);
  assert.deepEqual(before.counts, { queued: 2, processing: 0, prepared: 1, needs_review: 0 });
  const restarted = new IngestBatchQueue(url);
  try {
    assert.deepEqual(await restarted.enqueue(options.plan), before);
    while (await prepareNextBatchItem({ ...options, queue: restarted })) { /* resume until drained */ }
    const status = await restarted.status(options.tenant, options.batchId);
    assert.equal(status.state, 'prepared');
    assert(status.items.every(item => item.attempts === 1 && item.result.embedding_input_tokens > 0));
    assert.equal(await prepareNextBatchItem({ ...options, queue: restarted }), null);
    await assert.rejects(prepareNextBatchItem({ ...options, queue: restarted, storeRoot: path.join(root, 'wrong-store') }), { code: 'batch_storage_mismatch' });
  } finally { await restarted.close(); }
  assert.deepEqual((await readActive(path.join(options.storeRoot, id('tenant', options.tenant)))).documents, {});
});

test('concurrent workers claim distinct jobs; expired owners cannot acknowledge replacement work', async () => {
  const options = await fixture(2), other = new IngestBatchQueue(url);
  try {
    const [a, b] = await Promise.all([queue.claim(options.tenant, options.batchId), other.claim(options.tenant, options.batchId)]);
    assert.notEqual(a.id, b.id);
    assert.equal(await queue.claim(options.tenant, options.batchId), null);
    await expire(a);
    const replacement = await other.claim(options.tenant, options.batchId);
    assert.equal(replacement.id, a.id); assert.equal(replacement.attempts, 2);
    await assert.rejects(queue.finish(a, { error: 'late_worker' }), { code: 'batch_lease_lost' });
    await other.finish(replacement, { error: 'controlled_failure' });
    await assert.rejects(queue.manifest('other-tenant', options.batchId), { code: 'batch_not_found' });
    await assert.rejects(queue.finish({ ...b, tenant: 'other-tenant' }, { error: 'cross_tenant' }), { code: 'batch_lease_lost' });
  } finally { await other.close(); }
});

test('death after durable preparation resumes without a second parse or an active writer lock', async () => {
  const options = await fixture(1, 'pdf'); let claim, parses = 0;
  const parsePdf = async () => { parses++; return { info: {}, pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 600, 800], items: [
    { text: 'Seedlings need water every morning.', item_index: 0, x: 50, y: 700, height: 12, width: 400 },
  ] }] }; };
  await assert.rejects(prepareNextBatchItem(options, { parsePdf, afterClaim: value => { claim = value; }, afterPrepared: () => { throw Error('simulated_process_death'); } }), /simulated_process_death/);
  assert.equal((await queue.status(options.tenant, options.batchId)).counts.processing, 1);
  await expire(claim);
  const resumed = await prepareNextBatchItem(options, { parsePdf });
  assert.equal(resumed.state, 'prepared'); assert.equal(parses, 1);
  assert.equal((await queue.status(options.tenant, options.batchId)).items[0].attempts, 2);
  assert(!((await fs.readdir(path.join(options.storeRoot, id('tenant', options.tenant)))).includes('writer.lock')));
});

test('source drift is isolated for review while independent jobs complete', async () => {
  const options = await fixture(2);
  await fs.appendFile(path.join(options.inputRoot, '0.html'), '<p>Changed since plan.</p>');
  while (await prepareNextBatchItem(options)) { /* one source failure must not halt siblings */ }
  const status = await queue.status(options.tenant, options.batchId);
  assert.deepEqual(status.counts, { queued: 0, processing: 0, prepared: 1, needs_review: 1 });
  assert.equal(status.items.find(item => item.state === 'needs_review').error_code, 'batch_source_changed');
  assert.deepEqual(await queue.enqueue(options.plan), status);
});

test('a prepared queue receipt is not proof of files still being intact', async () => {
  const options = await fixture();
  await assert.rejects(verifyPreparedBatch({ ...options, storeRoot: options.inputRoot }), { code: 'batch_not_prepared' });
  const result = await prepareNextBatchItem(options);
  assert.equal((await verifyPreparedBatch(options)).verified, 1);
  const file = path.join(options.storeRoot, id('tenant', options.tenant), 'versions', result.result.version_id, 'chunks.json');
  await fs.appendFile(file, 'corrupt');
  await assert.rejects(verifyPreparedBatch(options), { code: 'version_integrity_failed' });
});

test('three abandoned leases require review; database constraints reject impossible terminal states', async () => {
  const options = await fixture();
  for (let i = 0; i < 3; i++) await expire(await queue.claim(options.tenant, options.batchId));
  assert.equal(await queue.claim(options.tenant, options.batchId), null);
  const status = await queue.status(options.tenant, options.batchId);
  assert.equal(status.items[0].error_code, 'batch_attempt_limit');
  await assert.rejects(queue.pool.query("UPDATE rag_v2_ingest_item SET state='prepared' WHERE tenant=$1", [options.tenant]), { code: '23514' });
  await queue.pool.query("UPDATE rag_v2_ingest_batch SET manifest_hash='tampered' WHERE tenant=$1", [options.tenant]);
  await assert.rejects(queue.enqueue(options.plan), { code: 'batch_manifest_changed' });
});
