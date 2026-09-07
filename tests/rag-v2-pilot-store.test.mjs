import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PrismaClient } from '../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { PilotStore } from '../lib/rag-v2/pilot/store.js';
import { PilotService } from '../lib/rag-v2/pilot/service.js';
import { digest, buildQuestion } from '../lib/rag-v2/pilot/contracts.js';
import { embeddingConfig } from '../lib/rag-v2/search/embedding.js';
import { retrievalProfile } from '../lib/rag-v2/search/profiles.js';
import { hash } from '../lib/rag-v2/contracts.js';

const url = new URL(process.env.M4_TEST_DATABASE_URL || 'postgres://invalid/invalid');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/sotsiaal_ai_m4_dev') throw Error('explicit isolated M4_TEST_DATABASE_URL required');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }), log: [] });
test.after(() => db.$disconnect());
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw Error('NETWORK_FORBIDDEN_IN_TEST'); };
test.after(() => { globalThis.fetch = originalFetch; });

async function fixture(t, overrides = {}) {
  const user = await db.user.create({ data: { email: `m4-${randomUUID()}@example.invalid` } });
  const conv = await db.conversation.create({ data: { userId: user.id, role: 'CLIENT', metadata: { m4: true }, expiresAt: new Date(Date.now() + 3600000) } });
  const config = { id: randomUUID(), tenant: 'm4-test', users: [user.id], mode: 'real', configHash: randomUUID(), documents: { doc1: 'v1' }, profile: retrievalProfile('vector-ranked-first-v1'),
    embedding: embeddingConfig({ embedding_mode: 'real', provider: 'openai', model: 'text-embedding-3-large', dimensions: 3072, endpoint: 'https://api.openai.com/v1/embeddings' }),
    model: 'gpt-5.6-luna', maxInputTokens: 60000, maxOutputTokens: 1000, reasoning: 'low', retentionHours: 1, expiresAt: new Date(Date.now() + 3600000).toISOString(),
    prices: { embeddingInput: 1, answerInput: 1, answerOutput: 1 }, budget: { attempts: 20, embeddingAttempts: 8, answerAttempts: 8, tokens: 200000, nanoUsd: 200000 }, ...overrides };
  const store = new PilotStore(db), calls = [];
  let allowed = true;
  const readConfig = async () => { if (!allowed) throw Object.assign(Error('revoked'), { code: 'revoked', status: 403 }); return config; };
  const packet = { tenant: config.tenant, query_id: randomUUID(), reference_map: { S1: { document_id: 'doc1', document_version_id: 'v1', evidence_id: 'e1', pdf_pages: [2] } },
    evidence: [{ evidence_id: 'e1', source_text: 'Allikatekst', bibliography: { title: 'Testallikas' } }], model_context: { evidence: [{ ref: 'S1', text: 'Allikatekst' }] } };
  const adapters = { preflight: async () => {}, search: async () => packet, canonical: async (c, p, ref) => { if (!c.documents[p.reference_map[ref]?.document_id]) throw Error('forbidden'); } };
  const bodies = [];
  const call = async ({ stage, body }) => {
    calls.push(stage); bodies.push({ stage, body });
    return { value: stage === 'embedding' ? Array.from({ length: 3072 }, (_, i) => i === 0 ? 1 : 0) : { kind: 'partial', blocks: [{ text: 'Allikatekst', factual: true, refs: ['S1'] }], limitations: ['Piiratud'], clarification: null },
      usage: { input: 50, output: stage === 'embedding' ? 0 : 100 }, requestId: `fake-${stage}` };
  };
  const service = new PilotService({ store, readConfig, adapters, call });
  const input = { convId: conv.id, clientTurnKey: randomUUID(), question: 'Üldküsimus', contextMode: 'new' };
  t.after(async () => { await db.user.delete({ where: { id: user.id } }); await db.m4PilotLedger.deleteMany({ where: { id: config.id } }); });
  return { user, conv, config, store, service, input, calls, bodies, packet, adapters, revoke: () => { allowed = false; } };
}

test('real DB: concurrent same-key requests share one turn; repeat and refresh restore; changed input conflicts', async t => {
  const f = await fixture(t);
  const result = await Promise.all([f.service.run(f.user.id, f.input), f.service.run(f.user.id, f.input)]);
  assert.equal(result[0].id, result[1].id);
  assert.deepEqual(f.calls, ['embedding', 'answer']);
  assert.equal((await f.service.run(f.user.id, f.input)).state, 'completed');
  await assert.rejects(f.service.run(f.user.id, { ...f.input, question: 'Teine' }), { code: 'idempotency_conflict' });
  assert.equal(await db.conversationMessage.count({ where: { conversationId: f.conv.id } }), 2);
  const messages = await db.conversationMessage.findMany({ where: { conversationId: f.conv.id } });
  assert.ok(messages.every(m => !m.content.includes('Allikatekst') && !m.content.includes('Üldküsimus')));
});
test('real DB: permitted cache hit makes zero new embeddings; another user/archived conversation is excluded', async t => {
  const f = await fixture(t);
  await f.service.run(f.user.id, f.input);
  await f.service.run(f.user.id, { ...f.input, clientTurnKey: randomUUID() });
  assert.deepEqual(f.calls, ['embedding', 'answer', 'answer']);
  const queryHash = digest('not the actual hash');
  assert.equal(await f.store.cache(f.config, 'other-user', queryHash), undefined);
  await db.conversation.update({ where: { id: f.conv.id }, data: { archivedAt: new Date() } });
  const row = await db.m4PilotTurn.findFirst({ where: { pilotId: f.config.id } });
  assert.equal(await f.store.cache(f.config, f.user.id, row.payload.query.hash), undefined);
  await assert.rejects(f.service.restore(row));
  await f.store.purge();
  assert.equal(await db.m4PilotTurn.count({ where: { pilotId: f.config.id } }), 0);
  assert.ok(await db.m4PilotLedger.findUnique({ where: { id: f.config.id } }));
});
test('real DB: timeout/restarted service never resends unknown work and retains full reservation', async t => {
  const f = await fixture(t);
  f.service.call = async () => { f.calls.push('timeout'); throw Error('timeout'); };
  await assert.rejects(f.service.run(f.user.id, f.input));
  const before = await db.m4PilotLedger.findUnique({ where: { id: f.config.id } });
  const restarted = new PilotService({ ...f.service, store: new PilotStore(db) });
  assert.equal((await restarted.run(f.user.id, f.input)).state, 'unknown');
  assert.deepEqual(f.calls, ['timeout']);
  assert.deepEqual((await db.m4PilotLedger.findUnique({ where: { id: f.config.id } })).totals, before.totals);
  const child = execFileSync(process.execPath, ['--import', './scripts/register-node-source-loader.mjs', '--input-type=module', '-e', `
    import { PrismaClient } from './generated/prisma/client.ts';
    import { PrismaPg } from '@prisma/adapter-pg';
    import { PilotStore } from './lib/rag-v2/pilot/store.js';
    import { PilotService } from './lib/rag-v2/pilot/service.js';
    globalThis.fetch = () => { throw Error('network forbidden in restart test'); };
    const data = JSON.parse(process.env.M4_RESTART_CASE);
    const db = new PrismaClient({adapter:new PrismaPg({connectionString:process.env.M4_TEST_DATABASE_URL}),log:[]});
    try {
      const service = new PilotService({store:new PilotStore(db),readConfig:async()=>data.config,adapters:{},call:async()=>{throw Error('unexpected retry');}});
      console.log(JSON.stringify(await service.run(data.userId,data.input)));
    } finally { await db.$disconnect(); }
  `], { encoding: 'utf8', windowsHide: true, env: { ...process.env, M4_RESTART_CASE: JSON.stringify({ config: f.config, userId: f.user.id, input: f.input }) } });
  assert.equal(JSON.parse(child.trim()).state, 'unknown');
  await assert.rejects(restarted.run(f.user.id, { ...f.input, clientTurnKey: randomUUID() }), { code: 'pilot_busy_or_unknown' });
});
test('real DB: budget reservation is locked across concurrent claimers and survives conversation deletion', async t => {
  const f = await fixture(t, { budget: { attempts: 1, embeddingAttempts: 8, answerAttempts: 8, tokens: 200000, nanoUsd: 200000 } });
  await assert.rejects(f.service.run(f.user.id, f.input), { code: 'pilot_budget_exhausted' });
  assert.deepEqual(f.calls, ['embedding']);
  await db.conversation.delete({ where: { id: f.conv.id } });
  assert.equal((await db.m4PilotLedger.findUnique({ where: { id: f.config.id } })).totals.attempts, 1);
});
test('real DB: revocation between retrieval and generation blocks egress and later restoration', async t => {
  const f = await fixture(t);
  f.adapters.search = async () => { f.revoke(); return f.packet; };
  await assert.rejects(f.service.run(f.user.id, f.input), { code: 'revoked' });
  assert.deepEqual(f.calls, ['embedding']);
  assert.equal(await db.conversationMessage.count({ where: { conversationId: f.conv.id } }), 0);
});
test('real DB: deletion during provider response prevents late save and any resurrection', async t => {
  const f = await fixture(t), call = f.service.call;
  f.service.call = async input => { const result = await call(input); if (input.stage === 'answer') await db.conversation.delete({ where: { id: f.conv.id } }); return result; };
  await assert.rejects(f.service.run(f.user.id, f.input), { code: 'conversation_unavailable' });
  assert.equal(await db.m4PilotTurn.count({ where: { pilotId: f.config.id } }), 0);
  assert.equal(await db.conversationMessage.count({ where: { conversationId: f.conv.id } }), 0);
  assert.equal((await db.m4PilotLedger.findUnique({ where: { id: f.config.id } })).totals.attempts, 2);
});
test('real DB: publication transaction rollback preserves validated draft; recovery saves once without calls', async t => {
  const f = await fixture(t), locked = f.store.locked.bind(f.store);
  f.store.locked = (config, fn) => locked(config, async tx => {
    const result = await fn(tx);
    if (result?.state === 'completed') throw Error('simulated failure after message writes before COMMIT');
    return result;
  });
  await assert.rejects(f.service.run(f.user.id, f.input));
  const row = await db.m4PilotTurn.findFirst({ where: { pilotId: f.config.id } });
  assert.equal(row.state, 'needs_recovery');
  assert.equal(await db.conversationMessage.count({ where: { conversationId: f.conv.id } }), 0);
  f.store.locked = locked;
  assert.equal((await f.service.recover(row)).state, 'completed');
  assert.deepEqual(f.calls, ['embedding', 'answer']);
  await f.service.recover(row);
  assert.equal(await db.conversationMessage.count({ where: { conversationId: f.conv.id } }), 2);
});
test('real DB: bad reference withholds whole draft; no hidden repair call', async t => {
  const f = await fixture(t), call = f.service.call;
  f.service.call = async input => { const result = await call(input); if (input.stage === 'answer') result.value.blocks[0].refs = ['S99']; return result; };
  await assert.rejects(f.service.run(f.user.id, f.input), { code: 'invalid_answer_reference' });
  assert.deepEqual(f.calls, ['embedding', 'answer']);
  assert.equal(await db.conversationMessage.count({ where: { conversationId: f.conv.id } }), 0);
});
test('real DB: foreign conversation and client-owned role/history cannot reach transport', async t => {
  const f = await fixture(t);
  await assert.rejects(f.service.run(f.user.id, { ...f.input, role: 'ADMIN' }), { code: 'invalid_shape' });
  await assert.rejects(f.service.run(f.user.id, { ...f.input, history: ['forged'] }), { code: 'invalid_shape' });
  await assert.rejects(f.service.run('other-user', f.input), { code: 'conversation_unavailable' });
  assert.deepEqual(f.calls, []);
});
test('real DB: preflight index mismatch blocks embedding before reservation', async t => {
  const f = await fixture(t);
  f.adapters.preflight = async () => { throw Object.assign(Error('active_index_mismatch'), { code: 'active_index_mismatch' }); };
  await assert.rejects(f.service.run(f.user.id, f.input), { code: 'active_index_mismatch' });
  assert.deepEqual(f.calls, []);
  assert.equal(await db.m4PilotLedger.findUnique({ where: { id: f.config.id } }), null);
});
test('real DB: post-commit restore failure cannot downgrade the persisted validated answer', async t => {
  const f = await fixture(t), canonical = f.adapters.canonical;
  let checks = 0;
  f.adapters.canonical = async (...args) => { if (++checks === 3) throw Error('read service temporarily unavailable'); return canonical(...args); };
  await assert.rejects(f.service.run(f.user.id, f.input));
  const row = await db.m4PilotTurn.findFirst({ where: { pilotId: f.config.id } });
  assert.equal(row.state, 'completed');
  f.adapters.canonical = canonical;
  assert.equal((await f.service.restore(row)).state, 'completed');
  assert.deepEqual(f.calls, ['embedding', 'answer']);
});
test('M4-B: cached embeddings never permit a ninth answer; persistent counters survive deletion', async t => {
  const f = await fixture(t);
  for (let i = 0; i < 8; i++) await f.service.run(f.user.id, { ...f.input, clientTurnKey: randomUUID() });
  assert.equal(f.calls.filter(s => s === 'embedding').length, 1);
  assert.equal(f.calls.filter(s => s === 'answer').length, 8);
  const before = await db.m4PilotLedger.findUnique({ where: { id: f.config.id } });
  await assert.rejects(f.service.run(f.user.id, { ...f.input, clientTurnKey: randomUUID() }), { code: 'pilot_stage_budget_exhausted' });
  await assert.rejects(f.service.run(f.user.id, { ...f.input, clientTurnKey: randomUUID(), question: 'Üheksas täiesti uus küsimus' }), { code: 'pilot_stage_budget_exhausted' });
  assert.equal(f.calls.filter(s => s === 'embedding').length, 1);
  assert.deepEqual((await db.m4PilotLedger.findUnique({ where: { id: f.config.id } })).totals, before.totals);
  await db.conversation.delete({ where: { id: f.conv.id } });
  const totals = (await db.m4PilotLedger.findUnique({ where: { id: f.config.id } })).totals;
  assert.equal(totals.embeddingAttempts, 1); assert.equal(totals.answerAttempts, 8); assert.equal(totals.attempts, 9);
});
test('M4-B: embedding stage cap stops a new question independently of the shared budget', async t => {
  const f = await fixture(t, { budget: { attempts: 16, embeddingAttempts: 1, answerAttempts: 8, tokens: 200000, nanoUsd: 200000 } });
  await f.service.run(f.user.id, f.input);
  await assert.rejects(f.service.run(f.user.id, { ...f.input, clientTurnKey: randomUUID(), question: 'Teine uus küsimus' }), { code: 'pilot_stage_budget_exhausted' });
  assert.deepEqual(f.calls, ['embedding', 'answer']);
});


test('F01: failed pre-send packet persistence prevents any answer reservation or call', async t => {
  const f = await fixture(t), save = f.store.save.bind(f.store);
  f.store.save = async (config, row, state, values) => { if (values.requestAudit) throw Error('synthetic disk failure'); return save(config, row, state, values); };
  await assert.rejects(f.service.run(f.user.id, f.input));
  assert.deepEqual(f.calls, ['embedding']);
  const row = await db.m4PilotTurn.findFirst({ where: { pilotId: f.config.id } });
  assert.equal(row.state, 'stopped'); assert.equal(row.payload.packet, undefined);
  assert.equal((await db.m4PilotLedger.findUnique({ where: { id: f.config.id } })).totals.answerAttempts, 0);
});

test('F02/F04/F06/F09: invalid reference keeps exact bounded audit and terminal state across concurrency and a fresh process', async t => {
  const f = await fixture(t, { budget: { attempts: 16, embeddingAttempts: 8, answerAttempts: 1, tokens: 200000, nanoUsd: 200000 } }), call = f.service.call;
  f.service.call = async input => {
    const result = await call(input);
    if (input.stage === 'answer') {
      const before = await db.m4PilotTurn.findFirst({ where: { pilotId: f.config.id } });
      assert.deepEqual(before.payload.requestAudit.body, input.body);
      assert.deepEqual(before.payload.packet.model_context, f.packet.model_context);
      result.value.blocks[0].refs = ['S99'];
    }
    return result;
  };
  const results = await Promise.allSettled([f.service.run(f.user.id, f.input), f.service.run(f.user.id, f.input)]);
  assert.ok(results.some(r => r.status === 'rejected' && r.reason.code === 'invalid_answer_reference'));
  assert.deepEqual(f.calls, ['embedding', 'answer']);
  const row = await db.m4PilotTurn.findFirst({ where: { pilotId: f.config.id } });
  assert.equal(row.state, 'answer_rejected');
  assert.equal(row.payload.responseAudit.validation.path, '$.blocks[0].refs[0]');
  assert.equal(row.payload.responseAudit.validation.received.text, 'S99');
  assert.deepEqual(row.payload.responseAudit.validation.allowedReferences, ['S1']);
  assert.deepEqual(JSON.parse(row.payload.responseAudit.draft.text).blocks[0].refs, ['S99']);
  assert.equal(row.payload.responseAudit.requestId, 'fake-answer');
  assert.equal(row.payload.responseAudit.usage.output, 100);
  assert.equal(row.payload.events.at(-1).state, 'response_received');
  assert.equal(await db.conversationMessage.count({ where: { conversationId: f.conv.id } }), 0);
  const restored = await f.service.run(f.user.id, f.input);
  assert.equal(restored.state, 'answer_rejected'); assert.equal(restored.question, f.input.question);
  assert.equal(restored.failureKind, 'references');
  assert.ok(!JSON.stringify(restored).includes('S99')); assert.equal(restored.answer, undefined);
  const before = await db.m4PilotLedger.findUnique({ where: { id: f.config.id } });
  assert.equal(before.totals.answerAttempts, 1);
  await assert.rejects(f.service.run(f.user.id, { ...f.input, clientTurnKey: randomUUID(), question: 'Another question' }), { code: 'pilot_stage_budget_exhausted' });
  const child = execFileSync(process.execPath, ['--import', './scripts/register-node-source-loader.mjs', '--input-type=module', '-e', `
    import { PrismaClient } from './generated/prisma/client.ts';
    import { PrismaPg } from '@prisma/adapter-pg';
    import { PilotStore } from './lib/rag-v2/pilot/store.js';
    import { PilotService } from './lib/rag-v2/pilot/service.js';
    globalThis.fetch = () => { throw Error('network forbidden'); };
    const data = JSON.parse(process.env.M4_RESTART_CASE);
    const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.M4_TEST_DATABASE_URL }), log: [] });
    try {
      const service = new PilotService({ store: new PilotStore(db), readConfig: async () => data.config, adapters: {}, call: async () => { throw Error('unexpected retry'); } });
      console.log(JSON.stringify(await service.run(data.userId, data.input)));
    } finally { await db.$disconnect(); }
  `], { encoding: 'utf8', windowsHide: true, env: { ...process.env, M4_RESTART_CASE: JSON.stringify({ config: f.config, userId: f.user.id, input: f.input }) } });
  assert.equal(JSON.parse(child.trim()).state, 'answer_rejected');
  assert.deepEqual((await db.m4PilotLedger.findUnique({ where: { id: f.config.id } })).totals, before.totals);
});

test('F08: failed audit expires with its turn, cannot be restored after revocation, and cannot be recreated late', async t => {
  const f = await fixture(t), call = f.service.call;
  f.service.call = async input => { const result = await call(input); if (input.stage === 'answer') result.value.blocks[0].refs = ['S99']; return result; };
  await assert.rejects(f.service.run(f.user.id, f.input));
  const row = await db.m4PilotTurn.findFirst({ where: { pilotId: f.config.id } });
  assert.ok(row.payload.responseAudit.draft);
  f.revoke(); await assert.rejects(f.service.restore(row), { code: 'revoked' });
  await db.m4PilotTurn.update({ where: { id: row.id }, data: { expiresAt: new Date(0) } });
  await f.store.purge();
  assert.equal(await db.m4PilotTurn.findUnique({ where: { id: row.id } }), null);
  await assert.rejects(f.store.save(f.config, row, 'answer_rejected', { responseAudit: row.payload.responseAudit }), { code: 'turn_expired' });
  assert.equal((await db.m4PilotLedger.findUnique({ where: { id: f.config.id } })).totals.answerAttempts, 1);
});

test('F03/F08: source permission lost after response blocks publication while retaining the protected failed audit', async t => {
  const f = await fixture(t), call = f.service.call;
  f.service.call = async input => { const result = await call(input); if (input.stage === 'answer') f.config.documents = {}; return result; };
  await assert.rejects(f.service.run(f.user.id, f.input));
  const row = await db.m4PilotTurn.findFirst({ where: { pilotId: f.config.id } });
  assert.equal(row.state, 'answer_rejected'); assert.ok(row.payload.responseAudit.draft);
  assert.equal(await db.conversationMessage.count({ where: { conversationId: f.conv.id } }), 0);
  assert.equal((await f.service.restore(row)).answer, undefined);
});


test('F16: a separately approved regression reuses only its pinned live query vector and never resets the original ledger', async t => {
  const f = await fixture(t);
  await f.service.run(f.user.id, f.input);
  const original = await db.m4PilotTurn.findFirst({ where: { pilotId: f.config.id } });
  const oldLedger = await db.m4PilotLedger.findUnique({ where: { id: f.config.id } });
  const entry = { turnId: original.id, queryHash: original.payload.query.hash, vectorHash: digest(original.payload.vector),
    embeddingBodyHash: original.payload.events.find(e => e.stage === 'embedding').bodyHash };
  const config = { ...f.config, id: randomUUID(), configHash: randomUUID(), budget: { ...f.config.budget, embeddingAttempts: 0 },
    queryReuse: { pilotId: f.config.id, configHash: f.config.configHash, expiresAt: original.expiresAt.toISOString(), entries: [entry] } };
  t.after(() => db.m4PilotLedger.deleteMany({ where: { id: config.id } }));
  const service = new PilotService({ ...f.service, readConfig: async () => config });
  const repeated = { ...f.input, clientTurnKey: randomUUID() };
  const restored = await service.run(f.user.id, repeated);
  assert.equal(restored.state, 'completed'); assert.deepEqual(f.calls, ['embedding', 'answer', 'answer']);
  const row = await db.m4PilotTurn.findFirst({ where: { pilotId: config.id } });
  assert.equal(row.payload.queryReuse.turnId, original.id);
  assert.equal(row.payload.events.length, 1); assert.equal(row.payload.events[0].stage, 'answer');
  assert.ok(row.expiresAt <= original.expiresAt);
  assert.equal((await db.m4PilotLedger.findUnique({ where: { id: config.id } })).totals.embeddingAttempts, 0);
  assert.deepEqual((await db.m4PilotLedger.findUnique({ where: { id: f.config.id } })).totals, oldLedger.totals);
  const query = original.payload.query;
  assert.equal(await f.store.reuse(config, 'other-user', query), null);
  assert.equal(await f.store.reuse({ ...config, tenant: 'foreign' }, f.user.id, query), null);
  await assert.rejects(f.store.reuse({ ...config, queryReuse: { ...config.queryReuse, entries: [{ ...entry, vectorHash: 'bad' }] } }, f.user.id, query), { code: 'query_reuse_integrity_failed' });
  await db.conversation.update({ where: { id: f.conv.id }, data: { archivedAt: new Date() } });
  assert.equal(await f.store.reuse(config, f.user.id, query), null);
});


test('F07: an unknown answer outcome retains its pre-send packet and cannot become a known validation failure or retry', async t => {
  const f = await fixture(t), call = f.service.call;
  f.service.call = async input => { if (input.stage === 'answer') { f.calls.push('answer_unknown'); throw Error('connection lost'); } return call(input); };
  await assert.rejects(f.service.run(f.user.id, f.input));
  const row = await db.m4PilotTurn.findFirst({ where: { pilotId: f.config.id } });
  assert.equal(row.state, 'unknown'); assert.ok(row.payload.packet.model_context); assert.ok(row.payload.requestAudit.body);
  assert.equal(row.payload.events.at(-1).state, 'sent_unknown'); assert.equal(row.payload.responseAudit, undefined);
  const totals = (await db.m4PilotLedger.findUnique({ where: { id: f.config.id } })).totals;
  assert.equal((await f.service.run(f.user.id, f.input)).state, 'unknown');
  assert.deepEqual(f.calls, ['embedding', 'answer_unknown']);
  assert.deepEqual((await db.m4PilotLedger.findUnique({ where: { id: f.config.id } })).totals, totals);
});

test('v3 real DB: citation-free clarification and unsupported answers publish and restore without extra attempts', async t => {
  const f = await fixture(t), call = f.service.call;
  const answers = [
    { kind: 'partial', blocks: [{ text: 'Source-backed part.', factual: true, refs: ['S1'] }], limitations: ['These excerpts do not support the whole comparison.'], clarification: null },
    { kind: 'clarification', blocks: [], limitations: [], clarification: 'Which municipality do you mean?' },
    { kind: 'unsupported', blocks: [], limitations: ['These excerpts do not establish a price.'], clarification: null },
  ];
  for (const [index, answer] of answers.entries()) {
    f.service.call = async input => { const result = await call(input); if (input.stage === 'answer') result.value = answer; return result; };
    const input = { ...f.input, question: 'Synthetic branch ' + index, clientTurnKey: randomUUID() };
    const result = await f.service.run(f.user.id, input);
    assert.equal(result.state, 'completed'); assert.equal(result.answerVersion, 'm4-text-refs-3');
    assert.deepEqual(result.answer, answer);
    const calls = f.calls.length;
    assert.deepEqual((await f.service.run(f.user.id, input)).answer, answer);
    assert.equal(f.calls.length, calls);
    if (!answer.blocks.length) assert.ok(result.sources.every(source => source.used === false));
  }
  assert.equal(await db.conversationMessage.count({ where: { conversationId: f.conv.id } }), 6);
});

test('v2 real DB: recovery of a synthetic historical nonfactual answer keeps its original contract', async t => {
  const f = await fixture(t);
  const claimed = await f.store.claim(f.config, f.user.id, f.input);
  const answer = { kind: 'unsupported', blocks: [{ text: 'Historical v2 response.', factual: false, refs: [] }], limitations: [], clarification: null };
  const row = await f.store.save(f.config, claimed.row, 'needs_recovery', { answer, answerVersion: 'm4-text-refs-2', packet: f.packet,
    query: { ...buildQuestion({ question: f.input.question, contextMode: f.input.contextMode }), language: 'et' } });
  const result = await f.service.recover(row);
  assert.equal(result.state, 'completed'); assert.equal(result.answerVersion, 'm4-text-refs-2');
  assert.deepEqual(result.answer, answer); assert.deepEqual(f.calls, []);
});

test('evidence candidate: one call persists private quote bindings and exposes only the v3 projection', async t => {
  const f = await fixture(t, { evidenceDraftVersion: 'm4-evidence-draft-1' }), call = f.service.call;
  f.packet.generation_id = 'generation';
  Object.assign(f.packet.reference_map.S1, { tenant: f.config.tenant, query_id: f.packet.query_id, generation_id: 'generation', source_text_sha256: hash('Allikatekst') });
  f.service.call = async input => {
    const result = await call(input);
    if (input.stage === 'answer') result.value.blocks[0].evidence = [{ ref: 'S1', quote: 'Allikatekst' }];
    return result;
  };
  const result = await f.service.run(f.user.id, f.input);
  assert.equal(result.state, 'completed');
  assert.equal(result.answerVersion, 'm4-text-refs-3');
  assert.equal(result.answer.blocks[0].evidence, undefined);
  const row = await db.m4PilotTurn.findFirst({ where: { pilotId: f.config.id } });
  assert.equal(row.payload.evidenceDraftAudit.sourceBinding, 'pass');
  assert.equal(row.payload.evidenceDraftAudit.semanticSupport, 'not_evaluated');
  assert.equal(row.payload.evidenceDraftAudit.bindings[0].quotes[0].start, 0);
  assert.equal(row.payload.evidenceDraftAudit.bindings[0].quotes[0].end, 11);
  assert.ok(row.payload.responseAudit.draft.text.includes('"quote":"Allikatekst"'));
  assert.equal(row.payload.requestAudit.evidenceDraftVersion, 'm4-evidence-draft-1');
  assert.equal((await f.service.run(f.user.id, f.input)).state, 'completed');
  assert.deepEqual(f.calls, ['embedding', 'answer']);
  assert.equal(JSON.stringify(result).includes('quote'), false);
  await db.m4PilotTurn.update({ where: { id: row.id }, data: { payload: { ...row.payload, answer: { ...row.payload.answer, blocks: [{ ...row.payload.answer.blocks[0], text: 'Tampered' }] } } } });
  const tampered = await db.m4PilotTurn.findUnique({ where: { id: row.id } });
  await assert.rejects(f.service.restore(tampered), { code: 'evidence_projection_mismatch' });
  f.revoke(); await assert.rejects(f.service.restore(row), { code: 'revoked' });
});

test('evidence candidate: forged quote stays private, terminal and counted; expiry prevents audit resurrection', async t => {
  const f = await fixture(t, { evidenceDraftVersion: 'm4-evidence-draft-1' }), call = f.service.call;
  f.packet.generation_id = 'generation';
  Object.assign(f.packet.reference_map.S1, { tenant: f.config.tenant, query_id: f.packet.query_id, generation_id: 'generation', source_text_sha256: hash('Allikatekst') });
  f.service.call = async input => { const result = await call(input); if (input.stage === 'answer') result.value.blocks[0].evidence = [{ ref: 'S1', quote: 'PRIVATE_FORGED_QUOTE' }]; return result; };
  await assert.rejects(f.service.run(f.user.id, f.input), { code: 'evidence_excerpt_not_found' });
  const row = await db.m4PilotTurn.findFirst({ where: { pilotId: f.config.id } });
  assert.equal(row.state, 'answer_rejected'); assert.ok(row.payload.responseAudit.draft.text.includes('PRIVATE_FORGED_QUOTE'));
  const restored = await f.service.run(f.user.id, f.input); assert.equal(restored.state, 'answer_rejected');
  assert.ok(!JSON.stringify(restored).includes('PRIVATE_FORGED_QUOTE')); assert.deepEqual(f.calls, ['embedding', 'answer']);
  assert.equal((await db.m4PilotLedger.findUnique({ where: { id: f.config.id } })).totals.answerAttempts, 1);
  await db.m4PilotTurn.update({ where: { id: row.id }, data: { expiresAt: new Date(0) } }); await f.store.purge();
  await assert.rejects(f.store.save(f.config, row, 'completed', { evidenceDraftAudit: {} }), { code: 'turn_expired' });
});

test('explicit no-expiry pilot persists a null deadline and still enforces ownership and deletion', async t => {
  const f = await fixture(t, { expiresAt: null, retentionHours: null });
  await db.conversation.update({ where: { id: f.conv.id }, data: { expiresAt: null } });
  const answer = await f.service.run(f.user.id, f.input);
  const row = await db.m4PilotTurn.findUnique({ where: { id: answer.id } });
  assert.equal(row.expiresAt, null);
  await db.conversation.update({ where: { id: f.conv.id }, data: { lastActivityAt: new Date(0) } });
  assert.equal(await db.conversation.count({ where: { id: f.conv.id, lastActivityAt: { lt: new Date() }, turns: { none: { m4Pilot: { is: { expiresAt: null } } } } } }), 0);
  await f.store.purge(); assert.equal((await f.service.restore(row)).state, 'completed');
  await assert.rejects(f.service.run('foreign-user', f.input), { code: 'conversation_unavailable' });
  await db.conversation.delete({ where: { id: f.conv.id } });
  await assert.rejects(f.service.restore(row), { code: 'conversation_unavailable' });
  assert.equal((await db.m4PilotLedger.findUnique({ where: { id: f.config.id } })).totals.answerAttempts, 1);
});

test('fixed packet comparison skips embedding/search, binds the packet and preserves one-call idempotency', async t => {
  const f = await fixture(t, { expiresAt: null, retentionHours: null, generationId: 'fixed-gen', budget: { attempts: 7, answerAttempts: 7, embeddingAttempts: 0, tokens: 200000, nanoUsd: 200000 } });
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'm4-fixed-'));
  f.config.fixedPacketFile = path.join(directory, 'packets.json');
  const manifest = { tenant: f.config.tenant, cases: [{ question: f.input.question, language: 'et', packet: { ...f.packet, generation_id: 'fixed-gen' } }] };
  manifest.cases[0].packetHash = digest(manifest.cases[0].packet); f.config.fixedPacketHash = digest(manifest);
  await fs.writeFile(f.config.fixedPacketFile, JSON.stringify(manifest));
  t.after(async () => { await fs.unlink(f.config.fixedPacketFile); await fs.rmdir(directory); });
  f.adapters.search = async () => { throw Error('search must not run'); };
  assert.equal((await f.service.run(f.user.id, f.input)).state, 'completed');
  assert.deepEqual(f.calls, ['answer']);
  assert.equal((await f.service.run(f.user.id, f.input)).state, 'completed'); assert.deepEqual(f.calls, ['answer']);
  await fs.writeFile(f.config.fixedPacketFile, JSON.stringify({ ...manifest, tenant: 'forged' }));
  await assert.rejects(f.service.run(f.user.id, { ...f.input, clientTurnKey: randomUUID() }), { code: 'fixed_packet_manifest_mismatch' });
  assert.deepEqual(f.calls, ['answer']);
});
