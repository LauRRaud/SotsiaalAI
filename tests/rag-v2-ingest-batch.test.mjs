import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { id } from '../lib/rag-v2/contracts.js';
import { planIngestBatch, validateIngestBatch } from '../lib/rag-v2/ingest-batch.js';
import { prepareIngest, ingest } from '../lib/rag-v2/ingestion.js';
import { readActive, loadVersion } from '../lib/rag-v2/catalog.js';

const rights = { access: 'local_private', usage: 'development_only' };
const profile = { id: 'generic-fixture', version: '1', months: [], categoryLabels: [] };
let root, networkCalls = 0;
const fetch = globalThis.fetch, connect = net.Socket.prototype.connect;
before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-batch-unit-'));
  globalThis.fetch = net.Socket.prototype.connect = () => { networkCalls++; throw Error('unexpected_network'); };
});
after(async () => {
  globalThis.fetch = fetch; net.Socket.prototype.connect = connect;
  assert(path.dirname(path.resolve(root)) === path.resolve(os.tmpdir()) && path.basename(root).startsWith('rag-v2-batch-unit-'));
  await fs.rm(root, { recursive: true, force: true });
  assert.equal(networkCalls, 0);
});
async function fixture(name, format = 'html') {
  const inputRoot = path.join(root, name); await fs.mkdir(inputRoot);
  await fs.writeFile(path.join(inputRoot, `source.${format}`), format === 'pdf' ? '%PDF-1.4 fixture' : `<article><h1>${name}</h1><p>Seedlings need water every morning.</p></article>`);
  const metadata = { document_id: name, source_type: 'fixture', title: name, language: 'en', source_path: `source.${format}`, source_format: format };
  return { tenant: name, inputRoot, storeRoot: path.join(inputRoot, 'store'), metadata, profile, rights };
}
const parsed = { info: {}, pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 600, 800], items: [
  { text: 'Seedlings need water every morning.', item_index: 0, x: 50, y: 700, height: 12, width: 400 },
] }] };

test('canonical plan survives selection/key order and JSON round trips; changes fail closed', async () => {
  const options = await fixture('canonical');
  await fs.writeFile(path.join(options.inputRoot, 'second.html'), '<article><p>Another independent document.</p></article>');
  const second = { ...options.metadata, document_id: 'second', source_path: 'second.html' };
  const a = await planIngestBatch({ ...options, inputs: [options.metadata, second] });
  const b = await planIngestBatch({ ...options, inputs: [Object.fromEntries(Object.entries(second).reverse()), options.metadata] });
  assert.deepEqual(a, b);
  assert.deepEqual(validateIngestBatch(JSON.parse(JSON.stringify(a))), a);
  assert.throws(() => validateIngestBatch({ ...a, tenant: 'other' }), { code: 'invalid_batch_item' });
  assert.throws(() => validateIngestBatch({ ...a, extra: true }), { code: 'batch_manifest_changed' });
  await assert.rejects(planIngestBatch({ ...options, inputs: [options.metadata, options.metadata] }), { code: 'batch_document_conflict' });
  await assert.rejects(planIngestBatch({ ...options, inputs: [options.metadata, { ...options.metadata, document_id: 'alias' }] }), { code: 'batch_duplicate_source' });
});

test('a frozen source hash prevents accepting changed bytes and never publishes', async () => {
  const options = await fixture('drift');
  const plan = await planIngestBatch({ ...options, inputs: [options.metadata] });
  await fs.appendFile(path.join(options.inputRoot, 'source.html'), '<p>Changed.</p>');
  await assert.rejects(prepareIngest({ ...options, metadataJson: plan.items[0].metadata_json, expectedSourceHash: plan.items[0].source_sha256 }), { code: 'batch_source_changed' });
  assert.deepEqual((await readActive(path.join(options.storeRoot, id('tenant', options.tenant)))).documents, {});
});

test('a durable checkpoint resumes without parsing and can later use the existing publication API', async () => {
  const options = await fixture('checkpoint', 'pdf');
  const first = await prepareIngest(options, { parsePdf: async () => parsed });
  const tenantDir = path.join(options.storeRoot, id('tenant', options.tenant));
  assert.deepEqual((await readActive(tenantDir)).documents, {});
  const resumed = await prepareIngest(options, { parsePdf: () => { throw Error('must_not_parse'); } });
  assert.equal(resumed.reused, true);
  assert.deepEqual(resumed.bundle, first.bundle);
  const published = await ingest(options, { parsePdf: () => { throw Error('must_not_parse'); } });
  assert.equal((await readActive(tenantDir)).documents[published.bundle.document.id].version_id, first.bundle.version.id);
});

test('corrupt or incomplete immutable checkpoints are rejected, never silently rebuilt', async () => {
  const options = await fixture('corrupt', 'pdf');
  const first = await prepareIngest(options, { parsePdf: async () => parsed });
  await fs.unlink(path.join(first.output, 'chunks.json'));
  let parses = 0;
  await assert.rejects(prepareIngest(options, { parsePdf: () => { parses++; return parsed; } }), { code: 'ENOENT' });
  assert.equal(parses, 0);
});

test('concurrent immutable preparation preserves one verified version without publication', async () => {
  const options = await fixture('concurrent', 'pdf');
  let count = 0, release;
  const bothReady = new Promise(resolve => { release = resolve; });
  const parsePdf = async () => { if (++count === 2) release(); await bothReady; return parsed; };
  const results = await Promise.all([prepareIngest(options, { parsePdf }), prepareIngest(options, { parsePdf })]);
  assert.deepEqual(results[0].bundle, results[1].bundle);
  const dir = path.join(options.storeRoot, id('tenant', options.tenant));
  assert.deepEqual(await loadVersion(dir, results[0].bundle.version.id), results[0].bundle);
  assert.deepEqual((await readActive(dir)).documents, {});
  assert(!(await fs.readdir(dir)).some(name => name.startsWith('staging-')));
});
