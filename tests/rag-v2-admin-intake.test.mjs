import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { validateAdminConfig } from '../lib/rag-v2/admin/config.js';
import { readBoundedBody, sameOrigin } from '../lib/rag-v2/admin/http-body.js';
import { IntakeService, canonicalMetadata, validateBudget } from '../lib/rag-v2/admin/intake.js';
import { assertIntakePrincipal } from '../lib/rag-v2/admin/auth.js';
import { intakeFormFromMetadata, intakeMetadataFromForm } from '../components/admin/rag/ragV2Metadata.js';
import { id, stable } from '../lib/rag-v2/contracts.js';
import { LocalPolicy } from '../lib/rag-v2/search/policy.js';
import { runPilot, reusableEmbeddingCatalog } from '../lib/rag-v2/search/pilot-runner.js';
import { tokenCount } from '../lib/rag-v2/search/embedding.js';

let root, counter = 0;
const savedFetch = globalThis.fetch;
const documentId = id('document', 'intake-test', 'guide', 'test-guide');
const price = { input_per_million: '0.13', currency: 'USD', version: 'test-price',
  source: 'https://developers.openai.com/api/docs/models/text-embedding-3-large', checked_at: new Date().toISOString() };
before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-intake-test-'));
  globalThis.fetch = () => { throw new Error('Unexpected network call'); };
});
after(async () => {
  globalThis.fetch = savedFetch;
  assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
  await fs.rm(root, { recursive: true, force: true });
});
function configFor(dir, changes = {}) {
  return validateAdminConfig({ enabled: true, id: 'test-intake', users: ['admin', 'other-admin'], tenant: 'intake-test', subject: 'operator',
    storeRoot: path.join(dir, 'store'), workRoot: path.join(dir, 'work'), policyFile: path.join(dir, 'policy.json'),
    connectionsFile: path.join(dir, 'connections.json'), embeddingReuseDirs: [], priceFile: path.join(dir, 'price.json'),
    documentIds: [documentId], maxSpendUsd: '0.05', maxApiAttempts: 8, maxInputTokens: 100000,
    expiresAt: new Date(Date.now() + 3600000).toISOString(), ...changes });
}
async function fixture(changes = {}) {
  const dir = path.join(root, String(++counter)); await fs.mkdir(dir);
  const config = configFor(dir, changes);
  await fs.writeFile(config.priceFile, JSON.stringify(price));
  const policy = new LocalPolicy({ tenants: { 'intake-test': { operator: [documentId] } } });
  const state = { calls: 0, indexCalls: 0, closed: 0, accessChecks: 0, denied: false, failEmbedding: false, failIndex: false, revokeAtActivation: false, active: null };
  const assertAccess = async () => { state.accessChecks++; if (state.denied) throw Object.assign(new Error('revoked'), { code: 'forbidden', status: 403 }); };
  const postgres = { async active() { if (!state.active) throw Object.assign(new Error('empty'), { code: 'no_active_search_generation' }); return state.active; } };
  const dependencies = {
    policy, ingestDependencies: { parsePdf: async () => ({ info: {}, pages: [{ pdf_page: 1, parser_page_index: 0, view: [0, 0, 600, 800],
      items: [{ text: 'Example source: the programme supports development and testing of welfare technology.', item_index: 0, x: 50, y: 700, height: 12, width: 450 }] }] }) },
    openIndex: async () => ({ postgres, qdrant: {}, close: async () => { state.closed++; } }),
    runPilot: options => runPilot({ ...options, transport: async ({ text, config: embedding }) => {
      state.calls++;
      if (state.failEmbedding) throw Object.assign(new Error('Unknown provider result'), { code: 'provider_failed' });
      return { body: { model: embedding.model, data: [{ index: 0, object: 'embedding', embedding: Array.from({ length: embedding.dimensions }, (_, i) => i === 0 ? 1 : 0) }],
        usage: { prompt_tokens: tokenCount(text), total_tokens: tokenCount(text) } }, request_id: 'test-request', duration_ms: 1 };
    } }),
    // Only the transport-origin assertion is injected. Disk records, hashes and vector shape are still verified.
    reuseCatalog: async (dirs, tenant) => ({ ...await reusableEmbeddingCatalog(dirs, tenant), provenance: 'openai_https' }),
    indexSnapshot: async ({ snapshot, hooks, embedding }) => {
      state.indexCalls++;
      assert.equal(embedding.source, 'persisted_vectors');
      if (state.revokeAtActivation) state.denied = true;
      await hooks.beforeActivate();
      if (state.failIndex) throw Object.assign(new Error('Index unavailable'), { code: 'qdrant_request_failed' });
      state.active = { id: 'search-generation-' + snapshot.snapshot_hash, state: 'ready', snapshot: { documents: snapshot.documents } };
      return { generation_id: state.active.id, units: snapshot.bundles.reduce((n, b) => n + b.chunks.length, 0) };
    }
  };
  const service = new IntakeService({ config, userId: 'admin', assertAccess, dependencies });
  const prepare = title => service.prepare({ pdfBytes: Buffer.from('%PDF-1.4 test input'), sourceUse: true,
    metadataBytes: Buffer.from(JSON.stringify({ document_id: 'test-guide', title: title || 'Example source', source_type: 'guide', language: 'en',
      source_path: '../../secrets', authority: 'publisher', historical: true })) });
  return { config, service, prepare, state, assertAccess, dependencies };
}

test('config requires private paths, explicit aggregate caps, document identity and expiry', () => {
  const config = configFor(path.join(root, 'config'));
  assert.throws(() => configFor(path.resolve('public', 'bad')), /private_path/);
  assert.throws(() => validateAdminConfig({ ...config, maxApiAttempts: undefined }), /cap_invalid/);
  assert.throws(() => validateAdminConfig({ ...config, documentIds: ['arbitrary'] }), /documents_invalid/);
  assert.throws(() => validateAdminConfig({ ...config, expiresAt: '2020-01-01' }), /config_expired/);
  assert.throws(() => validateAdminConfig({ ...config, workRoot: config.storeRoot }), /storage_overlap/);
});
test('actual streamed bytes are bounded and an overrun cancels the reader; origin is server-owned', async () => {
  let cancelled = false;
  const req = new Request('https://untrusted-host.test/upload', { method: 'POST', body: new ReadableStream({ start(c) {
    c.enqueue(new Uint8Array(4)); c.enqueue(new Uint8Array(4));
  }, cancel() { cancelled = true; } }), duplex: 'half', headers: { 'content-length': '1' } });
  await assert.rejects(readBoundedBody(req, 7), /request_body_too_large/);
  assert.equal(cancelled, true);
  const trusted = new Request('http://internal:3000/path', { headers: { origin: 'https://app.test', 'sec-fetch-site': 'same-origin' } });
  assert.doesNotThrow(() => sameOrigin(trusted, 'https://app.test'));
  assert.throws(() => sameOrigin(new Request('https://evil.test', { headers: { origin: 'https://evil.test' } }), 'https://app.test'), /same_origin_required/);
});
test('both current DB authorization and the refreshed session must allow the admin', () => {
  const session = { user: { id: 'admin', role: 'ADMIN' } }, user = { id: 'admin', role: 'ADMIN', accessSuspendedAt: null };
  assert.equal(assertIntakePrincipal(session, user).id, 'admin');
  for (const changed of [{ ...user, role: 'CLIENT' }, { ...user, accessSuspendedAt: new Date() }, { ...user, id: 'other' }]) {
    assert.throws(() => assertIntakePrincipal(session, changed), /forbidden/);
  }
  assert.throws(() => assertIntakePrincipal({ ...session, authDegraded: true }, user), /unauthorized/);
  assert.throws(() => assertIntakePrincipal({ user: { id: 'admin', role: 'CLIENT' } }, user), /forbidden/);
});
test('metadata import retains source semantics; prepare canonicalizes paths and performs no provider call', async () => {
  const original = { document_id: 'test-guide', title: 'Example source', source_type: 'guide', language: 'en', source_path: '/etc/private',
    authority: 'publisher', source_status: 'archived_snapshot', historical: true, collection_id: 'approved', custom: { note: 'retained' } };
  const form = intakeFormFromMetadata(original), metadata = intakeMetadataFromForm(form.fields, form.extra);
  for (const key of ['authority', 'source_status', 'historical', 'collection_id', 'custom']) assert.deepEqual(metadata[key], original[key]);
  assert.equal(canonicalMetadata(Buffer.from(JSON.stringify(original)), 10000).source_path, 'source.pdf');
  assert.throws(() => canonicalMetadata(Buffer.from([0xff]), 10000), /invalid_metadata_json/);
  assert.throws(() => canonicalMetadata(Buffer.from('[]'), 10000), /invalid_metadata/);
  const f = await fixture(), receipt = await f.prepare();
  assert.equal(receipt.state, 'prepared'); assert.equal(receipt.metadata.authority, 'publisher');
  assert.equal(receipt.metadata.source_path, 'source.pdf'); assert.equal(f.state.calls, 0);
  assert.ok(receipt.plan.hash); assert.equal(receipt.plan.external_inputs, 1);
  const downloaded = await f.service.get(receipt.job_id, 'metadata');
  assert.equal(JSON.parse(downloaded.bytes).historical, true);
  assert.ok(f.state.accessChecks >= 3);
});
test('another actor, changed config and revoked document access cannot read the job', async () => {
  const f = await fixture(), receipt = await f.prepare();
  const other = new IntakeService({ config: f.config, userId: 'other-admin', assertAccess: f.assertAccess, dependencies: f.dependencies });
  await assert.rejects(other.get(receipt.job_id), /job_scope_mismatch/);
  const changed = new IntakeService({ config: { ...f.config, maxSpendUsd: '0.06' }, userId: 'admin', assertAccess: f.assertAccess, dependencies: f.dependencies });
  await assert.rejects(changed.get(receipt.job_id), /job_scope_mismatch/);
  f.dependencies.policy.value.tenants['intake-test'].operator = [];
  await assert.rejects(f.service.get(receipt.job_id, 'pdf'), /document_not_allowed/);
  await assert.rejects(f.prepare(), /document_not_approved/);
  assert.equal(f.state.calls, 0);
});
test('a superseded source version or wrong reviewed plan is rejected before provider calls', async () => {
  const f = await fixture(), first = await f.prepare();
  await f.prepare('Changed title');
  await assert.rejects(f.service.publish(first.job_id, first.plan.hash), /source_changed/);
  await assert.rejects(f.service.publish(first.job_id, 'a'.repeat(64)), /plan_changed/);
  assert.equal(f.state.calls, 0); assert.equal(f.state.indexCalls, 0);
});
test('an unknown provider outcome stays stopped across a repeated publish and refresh', async () => {
  const f = await fixture(), receipt = await f.prepare();
  f.state.failEmbedding = true;
  await assert.rejects(f.service.publish(receipt.job_id, receipt.plan.hash), /embedding_outcome_unknown/);
  await assert.rejects(f.service.publish(receipt.job_id, receipt.plan.hash), /publication_incomplete/);
  const restored = await f.service.get(receipt.job_id);
  assert.equal(restored.state, 'stopped'); assert.equal(restored.published, false);
  assert.equal(f.state.calls, 1); assert.equal(f.state.indexCalls, 0); assert.equal(f.state.closed, 1);
  const budget = await f.service.budget(); assert.equal(budget.reserved_attempts, 1);
  assert.throws(() => validateBudget({ ...budget, reserved_attempts: 0 }, f.config), /budget_corrupt/);
});
test('index failure resumes with stored vectors; repeated success neither pays nor indexes again', async () => {
  const f = await fixture(), receipt = await f.prepare();
  f.state.failIndex = true;
  await assert.rejects(f.service.publish(receipt.job_id, receipt.plan.hash), { code: 'qdrant_request_failed' });
  assert.equal((await f.service.get(receipt.job_id)).state, 'vectors_ready');
  f.state.failIndex = false;
  const published = await f.service.publish(receipt.job_id, receipt.plan.hash);
  assert.equal(published.published, true);
  const repeated = await f.service.publish(receipt.job_id, receipt.plan.hash);
  assert.deepEqual(repeated.publication, published.publication);
  assert.equal(f.state.calls, 1); assert.equal(f.state.indexCalls, 2); assert.equal(f.state.closed, 3);
});
test('revocation at activation blocks publication even after vectors were obtained', async () => {
  const f = await fixture(), receipt = await f.prepare();
  f.state.revokeAtActivation = true;
  await assert.rejects(f.service.publish(receipt.job_id, receipt.plan.hash), { code: 'forbidden' });
  assert.equal(f.state.active, null);
  assert.equal(f.state.calls, 1);
  await assert.rejects(f.service.get(receipt.job_id), { code: 'forbidden' });
});
test('the aggregate request cap survives a new document version and plan', async () => {
  const f = await fixture({ maxApiAttempts: 1 }), receipt = await f.prepare();
  await f.service.publish(receipt.job_id, receipt.plan.hash);
  const second = await f.prepare('Different source label');
  assert.notEqual(second.plan.hash, receipt.plan.hash);
  await assert.rejects(f.service.publish(second.job_id, second.plan.hash), /aggregate_cap_exceeded/);
  assert.equal(f.state.calls, 1);
  const budget = await f.service.budget(); assert.equal(budget.reserved_attempts, 1);
  assert.equal(Object.keys(budget.plans).length, 1);
  assert.equal(stable((await f.service.get(second.job_id)).metadata.title), stable('Different source label'));
});
