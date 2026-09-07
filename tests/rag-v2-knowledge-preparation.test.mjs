import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { hash, id, validateBundle } from '../lib/rag-v2/contracts.js';
import { knowledgePreparationDraft, knowledgePreparationPlan, validateKnowledgePreparationConfig } from '../lib/rag-v2/knowledge-preparation.js';
import { IntakeService } from '../lib/rag-v2/admin/intake.js';
import { validateAdminConfig } from '../lib/rag-v2/admin/config.js';
import { LocalPolicy } from '../lib/rag-v2/search/policy.js';
import { loadSnapshot } from '../lib/rag-v2/search/snapshot.js';

let root, count = 0;
const savedFetch = globalThis.fetch, savedConnect = net.Socket.prototype.connect;
const tenant = 'knowledge-preparation-fixture', documentId = id('document', tenant, 'reference', 'fictional-library');
const pages = [
  'In this fictional library guide, the reading session requires a booking and a room key. This is a source fixture, not a real library policy.',
  'A booking is one condition for the fictional reading session. No particular reader is known to have a booking; this text describes only the source rule.',
  'A room key is another condition for the fictional reading session. No particular reader is known to possess the room key described by this source fixture.',
  'The session is also subject to conditions in a separate handbook. Those conditions are not reproduced in this fictional document and cannot be established from it.',
];
const preparationConfig = changes => ({ enabled: true, model: 'fixture-model', accountProject: 'proj_fixture', reasoning: 'low', timeoutMs: 5000,
  maxOutputTokens: 2048, maxDocumentInputTokens: 50000, maxSpendUsd: '1.00', maxApiAttempts: 4, maxInputTokens: 150000,
  prices: { input: 1, output: 2 }, ...changes });
function responseValue(body) {
  const sources = JSON.parse(body.input).sources;
  const anchor = page => ({ source_id: sources.find(source => source.pdf_page === page).source_id, quote: pages[page - 1] });
  const card = (key, page, kind) => ({ key, kind, statement: pages[page - 1], subject: null, predicate: null, object: null,
    scope: 'Fictional document example only', anchors: [anchor(page)] });
  return { cards: [card('session', 1, 'assertion'), card('booking', 2, 'condition'), card('key', 3, 'condition')],
    dependencies: [{ key: 'session-requires', type: 'REQUIRES', from: 'session', targets: [{ key: 'booking' }, { key: 'key' }],
      operator: 'all', scope: 'Fictional document example only', anchors: [anchor(1)] }],
    unresolved: [{ from: 'session', statement: 'The fictional session has additional unspecified conditions.',
      reason: 'The referenced handbook is absent from the supplied document.', anchors: [anchor(4)] }] };
}
before(async () => {
  globalThis.fetch = () => { throw Error('unexpected_network'); };
  net.Socket.prototype.connect = () => { throw Error('unexpected_network'); };
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-knowledge-preparation-'));
});
after(async () => {
  globalThis.fetch = savedFetch; net.Socket.prototype.connect = savedConnect;
  const resolved = path.resolve(root);
  assert(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('rag-knowledge-preparation-'));
  await fs.rm(resolved, { recursive: true, force: true });
});

async function fixture(changes = {}) {
  const dir = path.join(root, String(++count)); await fs.mkdir(dir);
  const config = validateAdminConfig({ enabled: true, id: 'preparation-fixture', tenant, subject: 'operator', users: ['admin', 'other'], documentIds: [documentId],
    storeRoot: path.join(dir, 'store'), workRoot: path.join(dir, 'work'), policyFile: path.join(dir, 'policy.json'), connectionsFile: path.join(dir, 'connections.json'),
    embeddingReuseDirs: [], priceFile: path.join(dir, 'price.json'), maxSpendUsd: '0.00', maxApiAttempts: 0, maxInputTokens: 0,
    expiresAt: new Date(Date.now() + 3600000).toISOString(), knowledgePreparation: preparationConfig(changes) });
  const state = { calls: 0, body: null, denied: false, providerError: false, revokeAfterCall: false, pauseParse: null };
  const assertAccess = async () => { if (state.denied) throw Object.assign(Error('forbidden'), { code: 'forbidden', status: 403 }); };
  const policy = new LocalPolicy({ tenants: { [tenant]: { operator: [documentId] } } });
  const dependencies = { policy, knowledgeApiKey: 'fixture-key', profile: { id: 'fictional-library', version: '1', months: [], categoryLabels: [] },
    ingestDependencies: { parsePdf: async () => {
      if (state.pauseParse) await state.pauseParse();
      return { info: {}, pages: pages.map((text, index) => ({ pdf_page: index + 1, parser_page_index: index, view: [0, 0, 600, 800],
        items: [{ text, item_index: 0, x: 50, y: 700, height: 12, width: 450 }] })) };
    } },
    knowledgeCall: async ({ body }) => {
      state.calls++; state.body = body;
      if (state.providerError) throw Object.assign(Error('transport'), { code: 'provider_http_error' });
      if (state.revokeAfterCall) state.denied = true;
      return { value: responseValue(body), usage: { input: 100, output: 200 }, requestId: 'fixture-response', timings: { completeResponseMs: 1 } };
    } };
  const service = new IntakeService({ config, userId: 'admin', assertAccess, dependencies });
  const metadata = title => ({ document_id: 'fictional-library', source_type: 'reference', title: title || 'Fictional library source',
    language: 'en', source_path: 'source.pdf', custom: 'metadata-only-private-sentinel' });
  const prepare = title => service.prepare({ pdfBytes: Buffer.from('%PDF-1.4 synthetic-library-fixture'), metadataBytes: Buffer.from(JSON.stringify(metadata(title))), sourceUse: true });
  const bundle = async () => (await loadSnapshot(config.storeRoot, tenant, [documentId])).bundles[0];
  const work = path.join(config.workRoot, id('intake', config.id));
  return { config, service, state, prepare, bundle, work, assertAccess, dependencies };
}

test('source preparation is explicit, source-only, version-bound and capped before any call', async () => {
  const f = await fixture(), receipt = await f.prepare(), bundle = await f.bundle();
  assert.equal(f.state.calls, 0); assert.equal(receipt.knowledge_preparation.state, 'not_started');
  const plan = knowledgePreparationPlan(bundle, f.config.knowledgePreparation);
  assert.equal(plan.hash, receipt.knowledge_preparation.plan.hash);
  assert.equal(plan.body.store, false); assert.equal(plan.body.text.format.strict, true);
  assert(!JSON.stringify(plan.body).includes('metadata-only-private-sentinel'));
  assert.equal(plan.manifest.version_id, bundle.version.id);
  assert.equal(plan.sources.length, 4);
  assert.throws(() => knowledgePreparationPlan(bundle, preparationConfig({ maxSpendUsd: '0.00' })), { code: 'knowledge_preparation_document_cap' });
  assert.throws(() => validateKnowledgePreparationConfig(preparationConfig({ maxApiAttempts: -1 })), { code: 'knowledge_preparation_cap_invalid' });
  const newer = { ...bundle, version: { ...bundle.version, id: id('version', 'different') } };
  assert.throws(() => knowledgePreparationDraft(responseValue(plan.body), plan, newer), { code: 'knowledge_preparation_scope_changed' });
});

test('model candidates use exact source anchors; invented sources, incomplete triples and foreign keys are rejected', async () => {
  const f = await fixture(); await f.prepare();
  const bundle = await f.bundle(), plan = knowledgePreparationPlan(bundle, f.config.knowledgePreparation), value = responseValue(plan.body);
  const draft = knowledgePreparationDraft(value, plan, bundle);
  assert.equal(draft.verification_state, 'source_anchored_unreviewed');
  assert.equal(draft.knowledge.cards.length, 3); assert.equal(draft.unresolved[0].from, 'session');
  for (const item of [...draft.knowledge.cards, ...draft.knowledge.dependencies, ...draft.unresolved]) for (const anchor of item.anchors) {
    assert.equal(bundle.pages[anchor.pdf_page - 1].raw_text.slice(anchor.start, anchor.start + anchor.quote.length), anchor.quote);
  }
  const bad = structuredClone(value); bad.cards[0].anchors[0].source_id = 'T999';
  assert.throws(() => knowledgePreparationDraft(bad, plan, bundle), { code: 'knowledge_preparation_anchor_mismatch' });
  bad.cards[0] = { ...value.cards[0], subject: 'session' };
  assert.throws(() => knowledgePreparationDraft(bad, plan, bundle), { code: 'knowledge_preparation_text' });
  const foreign = structuredClone(value); foreign.dependencies[0].targets[0].document_id = documentId;
  assert.throws(() => knowledgePreparationDraft(foreign, plan, bundle), { code: 'knowledge_preparation_shape' });
  const forged = structuredClone(value); forged.cards[0].verification_state = 'verified';
  assert.throws(() => knowledgePreparationDraft(forged, plan, bundle), { code: 'knowledge_preparation_shape' });
});

test('one prepared draft survives repeated clicks and reloads without another provider call', async () => {
  const f = await fixture(), receipt = await f.prepare(), planHash = receipt.knowledge_preparation.plan.hash;
  const ready = await f.service.prepareKnowledge(receipt.job_id, planHash);
  assert.equal(f.state.calls, 1); assert.equal(ready.knowledge_preparation.state, 'draft_ready');
  const repeated = await f.service.prepareKnowledge(receipt.job_id, planHash);
  assert.equal(f.state.calls, 1);
  assert.equal(repeated.knowledge_preparation.draft.hash, ready.knowledge_preparation.draft.hash);
  const freshService = new IntakeService({ config: f.config, userId: 'admin', assertAccess: f.assertAccess, dependencies: f.dependencies });
  assert.deepEqual((await freshService.get(receipt.job_id)).knowledge_preparation.draft, ready.knowledge_preparation.draft);
  const status = await freshService.status();
  assert.equal(status.knowledge_preparation.reserved_attempts, 1);
  assert.equal(status.reserved_usd, '0.000000000');
  const other = new IntakeService({ config: f.config, userId: 'other', assertAccess: f.assertAccess, dependencies: f.dependencies });
  await assert.rejects(other.prepareKnowledge(receipt.job_id, planHash), { code: 'rag_v2_job_scope_mismatch' });
});

test('reviewed selection creates an immutable version, drops relations to excluded claims and retains anchored gaps', async () => {
  const f = await fixture(), receipt = await f.prepare(), original = await f.bundle();
  const ready = await f.service.prepareKnowledge(receipt.job_id, receipt.knowledge_preparation.plan.hash);
  let parsing, resume;
  const entered = new Promise(resolve => { parsing = resolve; }), blocked = new Promise(resolve => { resume = resolve; });
  f.state.pauseParse = async () => { parsing(); await blocked; };
  const applying = f.service.applyKnowledge(receipt.job_id, ready.knowledge_preparation.draft.hash, { cards: ['session', 'booking'], dependencies: ['session-requires'] });
  await entered;
  await assert.rejects(f.prepare('Competing operation'), { code: 'rag_v2_publication_busy' });
  resume(); const applied = await applying, current = await f.bundle();
  assert.equal(f.state.calls, 1); assert.notEqual(applied.job_id, receipt.job_id); assert.notEqual(current.version.id, original.version.id);
  assert.equal(current.version.pdf_hash, original.version.pdf_hash);
  assert.equal(current.knowledge_cards.length, 2); assert.equal(current.dependencies.length, 0);
  assert.equal(current.knowledge_gaps.length, 1); assert.equal(current.knowledge_gaps[0].verification_state, 'source_anchored_unreviewed');
  assert.equal(current.knowledge_gaps[0].from_card_id, current.knowledge_cards.find(card => card.key === 'session').id);
  const forged = structuredClone(current); forged.knowledge_gaps[0].reason = 'forged';
  assert.throws(() => validateBundle(forged), { code: 'knowledge_provenance_mismatch' });
  const originalFile = JSON.parse(await fs.readFile(path.join(f.work, 'jobs', receipt.job_id, 'metadata.json'), 'utf8'));
  assert.equal(originalFile.knowledge, undefined);
  await assert.rejects(f.service.applyKnowledge(receipt.job_id, ready.knowledge_preparation.draft.hash, { cards: ['session'], dependencies: [] }), { code: 'rag_v2_source_changed' });
});

test('provider errors reserve the attempt, never retry automatically and an aggregate cap blocks the next job', async () => {
  const f = await fixture({ maxApiAttempts: 1 }), receipt = await f.prepare();
  f.state.providerError = true;
  await assert.rejects(f.service.prepareKnowledge(receipt.job_id, receipt.knowledge_preparation.plan.hash), { code: 'provider_http_error' });
  await assert.rejects(f.service.prepareKnowledge(receipt.job_id, receipt.knowledge_preparation.plan.hash), { code: 'provider_http_error' });
  assert.equal(f.state.calls, 1); assert.equal((await f.service.get(receipt.job_id)).knowledge_preparation.state, 'failed');
  f.state.providerError = false;
  const second = await f.prepare();
  await assert.rejects(f.service.prepareKnowledge(second.job_id, second.knowledge_preparation.plan.hash), { code: 'knowledge_preparation_aggregate_cap' });
  assert.equal(f.state.calls, 1); assert.equal((await f.service.status()).knowledge_preparation.reserved_attempts, 1);
});

test('a saved response recovers locally after an interrupted receipt update; corruption cannot trigger a new call', async () => {
  const f = await fixture(), receipt = await f.prepare(), planHash = receipt.knowledge_preparation.plan.hash;
  const ready = await f.service.prepareKnowledge(receipt.job_id, planHash);
  const file = path.join(f.work, 'knowledge-budget.json'), ledger = JSON.parse(await fs.readFile(file, 'utf8'));
  const entry = Object.values(ledger.entries)[0]; entry.state = 'sent_unknown'; delete entry.response_hash;
  await fs.writeFile(file, JSON.stringify(ledger));
  const recovered = await f.service.prepareKnowledge(receipt.job_id, planHash);
  assert.equal(recovered.knowledge_preparation.draft.hash, ready.knowledge_preparation.draft.hash); assert.equal(f.state.calls, 1);
  entry.response_hash = hash('corrupt'); await fs.writeFile(file, JSON.stringify(ledger));
  await assert.rejects(f.service.prepareKnowledge(receipt.job_id, planHash), { code: 'knowledge_response_integrity_failed' });
  assert.equal(f.state.calls, 1);
});

test('source replacement and live access revocation prevent stale preparation or result disclosure', async () => {
  const f = await fixture(), receipt = await f.prepare();
  await f.prepare('Changed metadata');
  await assert.rejects(f.service.prepareKnowledge(receipt.job_id, receipt.knowledge_preparation.plan.hash), { code: 'rag_v2_source_changed' });
  assert.equal(f.state.calls, 0);
  const revoked = await fixture(), active = await revoked.prepare(); revoked.state.revokeAfterCall = true;
  await assert.rejects(revoked.service.prepareKnowledge(active.job_id, active.knowledge_preparation.plan.hash), { code: 'forbidden' });
  await assert.rejects(revoked.service.get(active.job_id), { code: 'forbidden' });
  assert.equal(revoked.state.calls, 1);
});
