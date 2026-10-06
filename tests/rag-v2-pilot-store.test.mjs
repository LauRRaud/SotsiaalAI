import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PrismaClient, Prisma } from '../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { PilotStore, PILOT_TURN_LIMITS, openTurn } from '../lib/rag-v2/pilot/store.js';
import { isPackedJson, packJson } from '../lib/rag-v2/pilot/packed-json.js';
import { auditPacketBytes, isLeanPacket, AUDIT_PACKET_BYTES } from '../lib/rag-v2/search/model-context.js';
import { isLeanTurn } from '../lib/rag-v2/pilot/lean-turn.js';
import { conversationTurns, historySourceView, isHistoryMessage } from '../lib/rag-v2/pilot/history.js';
import { recordStoredTurns, PLACEHOLDERS } from '../lib/rag-v2/pilot/history-backfill.js';
import { pilotChatMessages } from '../lib/chat/m4PilotClientContract.js';
import { municipalPacket } from './fixtures/rag-v2-municipal-packet.mjs';
import { PilotService } from '../lib/rag-v2/pilot/service.js';
import { digest, buildQuestion, ANSWER_VERSION } from '../lib/rag-v2/pilot/contracts.js';
import { embeddingConfig } from '../lib/rag-v2/search/embedding.js';
import { retrievalProfile } from '../lib/rag-v2/search/profiles.js';
import { hash, stable } from '../lib/rag-v2/contracts.js';

const url = new URL(process.env.M4_TEST_DATABASE_URL || 'postgres://invalid/invalid');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/sotsiaal_ai_m4_dev') throw Error('explicit isolated M4_TEST_DATABASE_URL required');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }), log: [] });
test.after(() => db.$disconnect());
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw Error('NETWORK_FORBIDDEN_IN_TEST'); };
test.after(() => { globalThis.fetch = originalFetch; });
// A turn's row as every reader gets it: its large parts read back from their own columns (ADR-094, step 4). A test that
// checks what a column holds, or writes a payload back, reads the row as it is stored (asStored.find…).
const asStored = { findFirst: args => db.m4PilotTurn['findFirst'](args), findUnique: args => db.m4PilotTurn['findUnique'](args) };
const turnRows = { findFirst: async args => openTurn(await asStored.findFirst(args)), findUnique: async args => openTurn(await asStored.findUnique(args)) };

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
  // ADR-094: the turn's two messages are the question and the answer themselves (until then they were placeholders).
  const messages = await db.conversationMessage.findMany({ where: { conversationId: f.conv.id }, orderBy: { createdAt: 'asc' } });
  assert.deepEqual(messages.map(m => [m.role, m.content]), [['USER', 'Üldküsimus'], ['ASSISTANT', 'Allikatekst [S1]\n\nPiiratud']]);
});
test('real DB: permitted cache hit makes zero new embeddings; another user/archived conversation is excluded', async t => {
  const f = await fixture(t);
  await f.service.run(f.user.id, f.input);
  await f.service.run(f.user.id, { ...f.input, clientTurnKey: randomUUID() });
  assert.deepEqual(f.calls, ['embedding', 'answer', 'answer']);
  const queryHash = digest('not the actual hash');
  assert.equal(await f.store.cache(f.config, 'other-user', queryHash), undefined);
  await db.conversation.update({ where: { id: f.conv.id }, data: { archivedAt: new Date() } });
  const row = await turnRows.findFirst({ where: { pilotId: f.config.id } });
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
  // ADR-052: the unknown turn blocks no one. A new turn runs its own call (here the same timeout); the unknown turn's
  // work is never sent again and its reservation stays in the ledger.
  await assert.rejects(restarted.run(f.user.id, { ...f.input, clientTurnKey: randomUUID() }), /timeout/);
  assert.deepEqual(f.calls, ['timeout', 'timeout']);
  assert.equal((await turnRows.findFirst({ where: { pilotId: f.config.id, inputHash: digest({ tenant: f.config.tenant, userId: f.user.id, ...f.input }) } })).state, 'unknown');
  assert.ok((await db.m4PilotLedger.findUnique({ where: { id: f.config.id } })).totals.nanoUsd > before.totals.nanoUsd);
});
test('ADR-052 real DB: a turn orders its own conversation, the pilot runs a few at once, and a lost turn closes without a resend', async t => {
  const f = await fixture(t);
  const conversation = () => db.conversation.create({ data: { userId: f.user.id, role: 'CLIENT', metadata: { m4: true }, expiresAt: new Date(Date.now() + 3600000) } });
  const claim = convId => f.store.claim(f.config, f.user.id, { ...f.input, convId, clientTurnKey: randomUUID() });
  // A turn in progress: the same conversation waits, another conversation goes on, up to the pilot's limit.
  const first = (await claim(f.conv.id)).row;
  await assert.rejects(claim(f.conv.id), { code: 'conversation_busy' });
  for (let i = 1; i < PILOT_TURN_LIMITS.concurrent; i++) await claim((await conversation()).id);
  await assert.rejects(claim((await conversation()).id), { code: 'pilot_busy' });
  // Lost processes: no write for longer than the limit. A turn that sent a call becomes unknown, one that sent none stops.
  const sent = await f.store.reserve(f.config, first, 'embedding', { tokens: 10, nanoUsd: 10 }, {});
  await f.store.sent(f.config, sent, 'embedding');
  const ledger = (await db.m4PilotLedger.findUnique({ where: { id: f.config.id } })).totals;
  await db.$executeRaw`UPDATE "M4PilotTurn" SET "updatedAt" = now() - interval '6 minutes' WHERE "pilotId" = ${f.config.id}`;
  const next = await claim(f.conv.id);
  assert.equal(next.fresh, true);
  const rows = await db.m4PilotTurn.findMany({ where: { pilotId: f.config.id, id: { not: next.row.id } } });
  assert.deepEqual(rows.map(row => row.state).sort(), ['stopped', 'stopped', 'unknown']);
  assert.ok(rows.every(row => row.payload.error === 'turn_abandoned'));
  assert.equal(rows.find(row => row.id === first.id).payload.abandoned.state, 'embedding_sent');
  // The unknown call's reservation stays spent; nothing was sent again.
  assert.deepEqual((await db.m4PilotLedger.findUnique({ where: { id: f.config.id } })).totals, ledger);
  assert.deepEqual(f.calls, []);
});
test('real DB: budget reservation is locked across concurrent claimers and survives conversation deletion', async t => {
  const f = await fixture(t, { budget: { attempts: 1, embeddingAttempts: 8, answerAttempts: 8, tokens: 200000, nanoUsd: 200000 } });
  await assert.rejects(f.service.run(f.user.id, f.input), { code: 'pilot_budget_exhausted' });
  assert.deepEqual(f.calls, ['embedding']);
  await db.conversation.delete({ where: { id: f.conv.id } });
  assert.equal((await db.m4PilotLedger.findUnique({ where: { id: f.config.id } })).totals.attempts, 1);
});
// Codex 30.09: the search starts while the turn's embedding request runs; the request stays one batch, its usage is
// recorded before the turn ends on any failure, and a failed request is the turn's error.
const deferred = () => { let resolve, reject; const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; }); return { promise, resolve, reject }; };
const until = async (condition, rounds = 500) => { for (let i = 0; i < rounds && !condition(); i++) await new Promise(resolve => setTimeout(resolve, 2)); return condition(); };
const unit = Array.from({ length: 3072 }, (_, i) => i === 1 ? 1 : 0);
function gatedEmbedding(f) {
  const gate = deferred(), original = f.service.call;
  f.service.call = async args => { if (args.stage !== 'embedding') return original(args); f.calls.push('embedding'); f.bodies.push({ stage: 'embedding', body: args.body }); return gate.promise; };
  return gate;
}
const embeddingEvent = async f => (await turnRows.findFirst({ where: { pilotId: f.config.id } })).payload.events.find(event => event.stage === 'embedding');

test('Codex 30.09 real DB: the search starts before the embedding request ends and reads the same vector from one request', async t => {
  const f = await fixture(t), gate = gatedEmbedding(f);
  let started = false, seen = null;
  f.adapters.search = async (c, query, vector) => { started = true; seen = await vector; return f.packet; };
  const running = f.service.run(f.user.id, f.input);
  assert.ok(await until(() => started), 'the search started while the embedding request was still open');
  assert.equal(seen, null);
  gate.resolve({ value: unit, usage: { input: 50, output: 0 }, requestId: 'fake-embedding' });
  assert.equal((await running).state, 'completed');
  assert.deepEqual(seen, unit);
  assert.deepEqual(f.calls, ['embedding', 'answer']);
  assert.equal(f.bodies.filter(entry => entry.stage === 'embedding').length, 1);
  assert.equal((await embeddingEvent(f)).state, 'response_received');
  // A cached question makes no request and the search reads the cached vector.
  let cached = null;
  f.adapters.search = async (c, query, vector) => { cached = await vector; return f.packet; };
  await f.service.run(f.user.id, { ...f.input, clientTurnKey: randomUUID() });
  assert.deepEqual(cached, unit);
  assert.deepEqual(f.calls, ['embedding', 'answer', 'answer']);
});

test('Codex 30.09 real DB: an early search failure ends the turn only after the embedding usage is recorded', async t => {
  const f = await fixture(t), gate = gatedEmbedding(f);
  let failed = false;
  f.adapters.search = async () => { failed = true; throw Object.assign(Error('lexical down'), { code: 'lexical_service_failed' }); };
  let settled = false;
  const running = f.service.run(f.user.id, f.input).finally(() => { settled = true; });
  assert.ok(await until(() => failed));
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(settled, false, 'the turn waits for the embedding request');
  gate.resolve({ value: unit, usage: { input: 50, output: 0 }, requestId: 'fake-embedding' });
  await assert.rejects(running, { code: 'lexical_service_failed' });
  const event = await embeddingEvent(f);
  assert.equal(event.state, 'response_received');
  assert.deepEqual(event.usage, { input: 50, output: 0 });
  assert.equal((await turnRows.findFirst({ where: { pilotId: f.config.id } })).state, 'stopped');
});

test('Codex 30.09 real DB: a failed embedding request is the error of the turn though the search failed because of it', async t => {
  const f = await fixture(t), gate = gatedEmbedding(f);
  let searchSettled = false;
  f.adapters.search = async (c, query, vector) => { try { await vector; return f.packet; } finally { searchSettled = true; } };
  const running = f.service.run(f.user.id, f.input);
  assert.ok(await until(() => f.calls.includes('embedding')));
  gate.reject(Object.assign(Error('provider refused'), { code: 'provider_http_error', usage: { input: 50, output: 0 } }));
  await assert.rejects(running, { code: 'provider_http_error' });
  assert.equal(searchSettled, true);
  assert.deepEqual(f.calls, ['embedding']);
  assert.deepEqual((await embeddingEvent(f)).usage, { input: 50, output: 0 });
});

test('Codex 30.09 real DB: access withdrawn while the embedding request runs stops the turn before any answer', async t => {
  const f = await fixture(t), gate = gatedEmbedding(f);
  f.adapters.search = async (c, query, vector) => { await vector; return f.packet; };
  const running = f.service.run(f.user.id, f.input);
  assert.ok(await until(() => f.calls.includes('embedding')));
  f.revoke();
  gate.resolve({ value: unit, usage: { input: 50, output: 0 }, requestId: 'fake-embedding' });
  await assert.rejects(running, { code: 'revoked' });
  assert.deepEqual(f.calls, ['embedding']);
  assert.equal(await db.conversationMessage.count({ where: { conversationId: f.conv.id } }), 0);
});

test('real DB: revocation between retrieval and generation blocks egress and later restoration', async t => {
  const f = await fixture(t);
  // The search waits for the turn's vector (the embedding request runs meanwhile), then access is withdrawn.
  f.adapters.search = async (c, query, vector) => { await vector; f.revoke(); return f.packet; };
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
  const row = await turnRows.findFirst({ where: { pilotId: f.config.id } });
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
  const row = await turnRows.findFirst({ where: { pilotId: f.config.id } });
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
  const row = await turnRows.findFirst({ where: { pilotId: f.config.id } });
  assert.equal(row.state, 'stopped'); assert.equal(row.payload.packet, undefined);
  assert.equal((await db.m4PilotLedger.findUnique({ where: { id: f.config.id } })).totals.answerAttempts, 0);
});

test('F02/F04/F06/F09: invalid reference keeps exact bounded audit and terminal state across concurrency and a fresh process', async t => {
  const f = await fixture(t, { budget: { attempts: 16, embeddingAttempts: 8, answerAttempts: 1, tokens: 200000, nanoUsd: 200000 } }), call = f.service.call;
  f.service.call = async input => {
    const result = await call(input);
    if (input.stage === 'answer') {
      const before = await turnRows.findFirst({ where: { pilotId: f.config.id } });
      assert.deepEqual(before.payload.requestAudit.body, input.body);
      assert.deepEqual(before.payload.packet.model_context, f.packet.model_context);
      result.value.blocks[0].refs = ['S99'];
    }
    return result;
  };
  const results = await Promise.allSettled([f.service.run(f.user.id, f.input), f.service.run(f.user.id, f.input)]);
  assert.ok(results.some(r => r.status === 'rejected' && r.reason.code === 'invalid_answer_reference'));
  assert.deepEqual(f.calls, ['embedding', 'answer']);
  const row = await turnRows.findFirst({ where: { pilotId: f.config.id } });
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
  const row = await turnRows.findFirst({ where: { pilotId: f.config.id } });
  assert.ok(row.payload.responseAudit.draft);
  f.revoke(); await assert.rejects(f.service.restore(row), { code: 'revoked' });
  await db.m4PilotTurn.update({ where: { id: row.id }, data: { expiresAt: new Date(0) } });
  await f.store.purge();
  assert.equal(await turnRows.findUnique({ where: { id: row.id } }), null);
  await assert.rejects(f.store.save(f.config, row, 'answer_rejected', { responseAudit: row.payload.responseAudit }), { code: 'turn_expired' });
  assert.equal((await db.m4PilotLedger.findUnique({ where: { id: f.config.id } })).totals.answerAttempts, 1);
});

test('F03/F08: source permission lost after response blocks publication while retaining the protected failed audit', async t => {
  const f = await fixture(t), call = f.service.call;
  f.service.call = async input => { const result = await call(input); if (input.stage === 'answer') f.config.documents = {}; return result; };
  await assert.rejects(f.service.run(f.user.id, f.input));
  const row = await turnRows.findFirst({ where: { pilotId: f.config.id } });
  assert.equal(row.state, 'answer_rejected'); assert.ok(row.payload.responseAudit.draft);
  assert.equal(await db.conversationMessage.count({ where: { conversationId: f.conv.id } }), 0);
  assert.equal((await f.service.restore(row)).answer, undefined);
});


test('F16: a separately approved regression reuses only its pinned live query vector and never resets the original ledger', async t => {
  const f = await fixture(t);
  await f.service.run(f.user.id, f.input);
  const original = await turnRows.findFirst({ where: { pilotId: f.config.id } });
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
  const row = await turnRows.findFirst({ where: { pilotId: config.id } });
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
  const row = await turnRows.findFirst({ where: { pilotId: f.config.id } });
  assert.equal(row.state, 'unknown'); assert.ok(row.payload.packet.model_context); assert.ok(row.payload.requestAudit.body);
  assert.equal(row.payload.events.at(-1).state, 'sent_unknown'); assert.equal(row.payload.responseAudit, undefined);
  const totals = (await db.m4PilotLedger.findUnique({ where: { id: f.config.id } })).totals;
  assert.equal((await f.service.run(f.user.id, f.input)).state, 'unknown');
  assert.deepEqual(f.calls, ['embedding', 'answer_unknown']);
  assert.deepEqual((await db.m4PilotLedger.findUnique({ where: { id: f.config.id } })).totals, totals);
});

test('v4 real DB: bare citation rejection preserves exact audit and never retries on restore', async t => {
  const f = await fixture(t), call = f.service.call;
  const text = 'S1 supports this claim.';
  f.service.call = async input => {
    const result = await call(input);
    if (input.stage === 'answer') result.value.blocks[0].text = text;
    return result;
  };
  await assert.rejects(f.service.run(f.user.id, f.input), { code: 'inline_answer_reference' });
  const row = await turnRows.findFirst({ where: { pilotId: f.config.id } });
  assert.equal(row.state, 'answer_rejected');
  assert.equal(row.payload.answerVersion, ANSWER_VERSION);
  assert.equal(row.payload.responseAudit.validation.path, '$.blocks[0].text');
  assert.equal(row.payload.responseAudit.validation.received.text, text);
  assert.equal(JSON.parse(row.payload.responseAudit.draft.text).blocks[0].text, text);
  assert.equal(await db.conversationMessage.count({ where: { conversationId: f.conv.id } }), 0);
  const restored = await f.service.run(f.user.id, f.input);
  assert.equal(restored.state, 'answer_rejected');
  assert.equal(restored.answer, undefined);
  assert.deepEqual(f.calls, ['embedding', 'answer']);
  const ledger = await db.m4PilotLedger.findUnique({ where: { id: f.config.id } });
  assert.equal(ledger.totals.answerAttempts, 1);
});

test('current answer real DB: citation-free clarification and unsupported answers publish and restore without extra attempts', async t => {
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
    assert.equal(result.state, 'completed'); assert.equal(result.answerVersion, ANSWER_VERSION);
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
  const saved = await f.store.save(f.config, claimed.row, 'needs_recovery', { answer, answerVersion: 'm4-text-refs-2', packet: f.packet,
    query: { ...buildQuestion({ question: f.input.question, contextMode: f.input.contextMode }), language: 'et' } });
  // A step's own result is the row without its large parts (ADR-094, step 4); a recovery reads the row whole.
  assert.equal('packet' in saved.payload, false);
  const row = await turnRows.findUnique({ where: { id: saved.id } });
  const result = await f.service.recover(row);
  assert.equal(result.state, 'completed'); assert.equal(result.answerVersion, 'm4-text-refs-2');
  assert.deepEqual(result.answer, answer); assert.deepEqual(f.calls, []);
});

test('evidence candidate: one call persists private quote bindings and exposes only the current answer projection', async t => {
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
  assert.equal(result.answerVersion, ANSWER_VERSION);
  assert.equal(result.answer.blocks[0].evidence, undefined);
  const row = await turnRows.findFirst({ where: { pilotId: f.config.id } });
  assert.equal(row.payload.evidenceDraftAudit.sourceBinding, 'pass');
  assert.equal(row.payload.evidenceDraftAudit.semanticSupport, 'not_evaluated');
  assert.equal(row.payload.evidenceDraftAudit.bindings[0].quotes[0].start, 0);
  assert.equal(row.payload.evidenceDraftAudit.bindings[0].quotes[0].end, 11);
  assert.ok(row.payload.responseAudit.draft.text.includes('"quote":"Allikatekst"'));
  assert.equal(row.payload.requestAudit.evidenceDraftVersion, 'm4-evidence-draft-1');
  assert.equal((await f.service.run(f.user.id, f.input)).state, 'completed');
  assert.deepEqual(f.calls, ['embedding', 'answer']);
  assert.equal(JSON.stringify(result).includes('quote'), false);
  const kept = (await asStored.findUnique({ where: { id: row.id } })).payload;
  await db.m4PilotTurn.update({ where: { id: row.id }, data: { payload: { ...kept, answer: { ...kept.answer, blocks: [{ ...kept.answer.blocks[0], text: 'Tampered' }] } } } });
  const tampered = await turnRows.findUnique({ where: { id: row.id } });
  await assert.rejects(f.service.restore(tampered), { code: 'evidence_projection_mismatch' });
  f.revoke(); await assert.rejects(f.service.restore(row), { code: 'revoked' });
});

test('evidence candidate: forged quote stays private, terminal and counted; expiry prevents audit resurrection', async t => {
  const f = await fixture(t, { evidenceDraftVersion: 'm4-evidence-draft-1' }), call = f.service.call;
  f.packet.generation_id = 'generation';
  Object.assign(f.packet.reference_map.S1, { tenant: f.config.tenant, query_id: f.packet.query_id, generation_id: 'generation', source_text_sha256: hash('Allikatekst') });
  f.service.call = async input => { const result = await call(input); if (input.stage === 'answer') result.value.blocks[0].evidence = [{ ref: 'S1', quote: 'PRIVATE_FORGED_QUOTE' }]; return result; };
  await assert.rejects(f.service.run(f.user.id, f.input), { code: 'evidence_excerpt_not_found' });
  const row = await turnRows.findFirst({ where: { pilotId: f.config.id } });
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
  const row = await turnRows.findUnique({ where: { id: answer.id } });
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

// ADR-040: the fake answer arrives as a stream (its JSON in small pieces to onText) before the complete result.
const streamedCall = (f, change = value => value) => {
  const call = f.service.call;
  return async input => {
    const result = await call(input);
    if (input.stage !== 'answer') return result;
    result.value = change(result.value);
    const json = JSON.stringify(result.value);
    for (let i = 0; i < json.length; i += 9) { input.onText?.(json.slice(i, i + 9)); await new Promise(resolve => setImmediate(resolve)); }
    return result;
  };
};
test('ADR-040 real DB: a streamed answer shows its text first and is published after the same checks and accounting', async t => {
  const f = await fixture(t), shown = [];
  f.service.call = streamedCall(f);
  const turn = await f.service.run(f.user.id, f.input, { onAnswerText: text => shown.push(text) });
  assert.equal(turn.state, 'completed');
  assert.equal(shown.join(''), 'Allikatekst\n\nPiiratud', 'the provisional text is the visible text without references');
  assert.match(turn.answer.blocks[0].text, /Allikatekst/);
  const row = await turnRows.findUnique({ where: { id: turn.id } });
  assert.equal(row.payload.requestAudit.body.stream, true, 'the audited request says it was streamed');
  const phases = row.payload.timings.phases;
  assert(Number.isInteger(phases.first_text) && phases.first_text <= phases.answered && row.payload.timings.validatedDraftMs >= phases.answered);
  assert.deepEqual(row.payload.events.map(e => [e.stage, e.state, e.usage?.output]), [['embedding', 'response_received', 0], ['answer', 'response_received', 100]]);
  assert.deepEqual(f.calls, ['embedding', 'answer'], 'one answer call');
  // A reader that went away changes nothing: the turn is checked and published.
  const g = await fixture(t);
  g.service.call = streamedCall(g);
  assert.equal((await g.service.run(g.user.id, g.input, { onAnswerText: () => { throw new Error('reader gone'); } })).state, 'completed');
});
test('ADR-040 real DB: a streamed answer that fails validation is withheld whole after its text was shown', async t => {
  const f = await fixture(t), shown = [];
  f.service.call = streamedCall(f, value => ({ ...value, blocks: [{ ...value.blocks[0], refs: ['S99'] }] }));
  await assert.rejects(f.service.run(f.user.id, f.input, { onAnswerText: text => shown.push(text) }), { code: 'invalid_answer_reference' });
  assert.equal(shown.join(''), 'Allikatekst\n\nPiiratud');
  const row = await turnRows.findFirst({ where: { chatTurn: { conversationId: f.conv.id } } });
  assert.equal(row.state, 'answer_rejected');
  assert.equal(row.payload.answer, undefined);
  assert.equal(await db.conversationMessage.count({ where: { conversationId: f.conv.id } }), 0);
  assert.deepEqual(f.calls, ['embedding', 'answer'], 'no repair call');
});

test('Codex J4 real DB: a validated answer waiting for publication keeps its conversation\'s order, with no model call to publish it', async t => {
  const f = await fixture(t);
  const store = new PilotStore(db), publish = store.publish.bind(store);
  let down = true;
  store.publish = async (...args) => { if (down) { down = false; throw Object.assign(Error('publication down'), { code: 'publish_failed' }); } return publish(...args); };
  const service = new PilotService({ ...f.service, store });
  await assert.rejects(service.run(f.user.id, f.input));
  const first = await turnRows.findFirst({ where: { pilotId: f.config.id } });
  assert.equal(first.state, 'needs_recovery');
  // The same conversation waits for it; nothing else does.
  await assert.rejects(store.claim(f.config, f.user.id, { ...f.input, clientTurnKey: randomUUID() }), { code: 'conversation_recovery_pending' });
  // The next turn publishes it first and asks the model only for itself.
  const calls = f.calls.length;
  const second = await service.run(f.user.id, { ...f.input, clientTurnKey: randomUUID(), question: 'Teine küsimus' });
  assert.equal(second.state, 'completed');
  assert.equal((await turnRows.findUnique({ where: { id: first.id } })).state, 'completed');
  assert.deepEqual(f.calls.slice(calls), ['embedding', 'answer']);
  const messages = await db.conversationMessage.findMany({ where: { conversationId: f.conv.id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  assert.deepEqual(messages.map(message => message.metadata.m4TurnId), [first.id, first.id, second.id, second.id]);
});

test('Codex J4 real DB: a failed publication keeps the next question from the model; a late answer never lands after a younger one', async t => {
  const f = await fixture(t);
  const store = new PilotStore(db), publish = store.publish.bind(store);
  let down = true;
  store.publish = async (...args) => { if (down) throw Object.assign(Error('publication down'), { code: 'publish_failed' }); return publish(...args); };
  const service = new PilotService({ ...f.service, store });
  await assert.rejects(service.run(f.user.id, f.input));
  const first = await turnRows.findFirst({ where: { pilotId: f.config.id } });
  const calls = f.calls.length;
  await assert.rejects(service.run(f.user.id, { ...f.input, clientTurnKey: randomUUID(), question: 'Teine küsimus' }), { code: 'conversation_recovery_failed' });
  assert.equal(f.calls.length, calls);
  // A turn left waiting from before this rule: a younger turn of the conversation was published, so the old one is not.
  down = false;
  await db.m4PilotTurn.update({ where: { id: first.id }, data: { state: 'stopped' } });
  const second = await service.run(f.user.id, { ...f.input, clientTurnKey: randomUUID(), question: 'Kolmas küsimus' });
  assert.equal(second.state, 'completed');
  const late = openTurn(await db.m4PilotTurn.update({ where: { id: first.id }, data: { state: 'needs_recovery' } }));
  await assert.rejects(service.recover(late), { code: 'turn_superseded' });
  assert.equal(await db.conversationMessage.count({ where: { conversationId: f.conv.id, metadata: { path: ['m4TurnId'], equals: first.id } } }), 0);
});

test('Codex J4 real DB: two recoveries at once publish a waiting answer once', async t => {
  const f = await fixture(t);
  const store = new PilotStore(db), publish = store.publish.bind(store);
  let down = true;
  store.publish = async (...args) => { if (down) { down = false; throw Object.assign(Error('publication down'), { code: 'publish_failed' }); } return publish(...args); };
  const service = new PilotService({ ...f.service, store });
  await assert.rejects(service.run(f.user.id, f.input));
  const waiting = await turnRows.findFirst({ where: { pilotId: f.config.id } });
  const [a, b] = await Promise.all([service.recover(waiting), service.recover(waiting)]);
  assert.deepEqual([a.state, b.state], ['completed', 'completed']);
  assert.equal(await db.conversationMessage.count({ where: { conversationId: f.conv.id } }), 2);
});

test('real DB, ADR-092: the answer is written with the effort the user chose among the plan\'s choices and the turn keeps it', async t => {
  const f = await fixture(t, { reasoning: 'medium', reasoningChoices: ['low', 'medium'] });
  const answerBodies = () => f.bodies.filter(item => item.stage === 'answer').map(item => item.body);
  const chosen = await f.service.run(f.user.id, { ...f.input, reasoning: 'low' });
  assert.equal(chosen.state, 'completed');
  assert.equal(answerBodies().at(-1).reasoning.effort, 'low');
  const row = await turnRows.findUnique({ where: { id: chosen.id } });
  assert.equal(row.payload.reasoning, 'low');
  assert.equal(row.payload.requestAudit.body.reasoning.effort, 'low');
  // The same key with another choice is another input; the stored turn is read back only for the same one.
  await assert.rejects(f.service.run(f.user.id, { ...f.input, reasoning: 'medium' }), { code: 'idempotency_conflict' });
  await assert.rejects(f.service.run(f.user.id, f.input), { code: 'idempotency_conflict' });
  assert.equal((await f.service.run(f.user.id, { ...f.input, reasoning: 'low' })).id, chosen.id);
  // Without a choice the plan's own effort is used and the turn records none.
  const plain = await f.service.run(f.user.id, { ...f.input, clientTurnKey: randomUUID() });
  assert.equal(answerBodies().at(-1).reasoning.effort, 'medium');
  assert.equal('reasoning' in (await turnRows.findUnique({ where: { id: plain.id } })).payload, false);
  // The plan's own effort named outright gives the same request.
  await f.service.run(f.user.id, { ...f.input, clientTurnKey: randomUUID(), reasoning: 'medium' });
  assert.equal(answerBodies().at(-1).reasoning.effort, 'medium');
  // An effort the plan does not offer is refused before a turn is claimed or a call made.
  const calls = f.calls.length, turns = await db.m4PilotTurn.count({ where: { pilotId: f.config.id } });
  await assert.rejects(f.service.run(f.user.id, { ...f.input, clientTurnKey: randomUUID(), reasoning: 'high' }), { code: 'reasoning_not_offered' });
  assert.deepEqual([f.calls.length, await db.m4PilotTurn.count({ where: { pilotId: f.config.id } })], [calls, turns]);
});

// ADR-089, "Auditipaketi piir": on 06.10.2026 a turn about Tallinn stopped with audit_packet_too_large at the limit of
// 512 000 bytes, before an answer was asked for (#397). A packet of that municipality's shape and size goes through the
// whole turn here: the size check, the reference check, the answer call, the store and the read back. Since ADR-089's
// packed form it is stored with each repeated part once and opened again whole.
test('real DB: a packet the size of the largest municipality\'s goes through a whole turn, is stored packed and reads back whole', async t => {
  const f = await fixture(t, { maxInputTokens: 300000, budget: { attempts: 20, embeddingAttempts: 8, answerAttempts: 8, tokens: 2000000, nanoUsd: 2000000 } });
  const packet = municipalPacket({ tenant: f.config.tenant });
  assert(auditPacketBytes(packet) > 512000 && auditPacketBytes(packet) < AUDIT_PACKET_BYTES, String(auditPacketBytes(packet)));
  f.config.documents = Object.fromEntries(packet.evidence.map(entry => [entry.document_id, entry.document_version_id]));
  f.adapters.search = async () => packet;
  const result = await f.service.run(f.user.id, f.input);
  assert.equal(result.state, 'completed');
  assert.deepEqual(f.calls, ['embedding', 'answer']);
  // The model was given the context as the turn made it, not a packed form.
  assert.deepEqual(JSON.parse(f.bodies.at(-1).body.input[0].content).evidence, packet.model_context);
  const row = await asStored.findUnique({ where: { id: result.id } }), bytes = value => Buffer.byteLength(JSON.stringify(value), 'utf8');
  assert(isPackedJson(row.packet), 'stored packed');
  assert(bytes(row.packet) < bytes(packet) * 0.7, `${bytes(row.packet)} of ${bytes(packet)}`);
  // ADR-094, step 4: the packet, the request and the vector are in their own columns, not in the payload that every
  // step of the turn writes again.
  assert.deepEqual(['packet', 'requestAudit', 'vector'].map(key => [key in row.payload, row[key] !== null]), [[false, true], [false, true], [false, true]]);
  assert(bytes(row.payload) < 20000, String(bytes(row.payload)));
  assert.equal(stable(openTurn(row).payload.packet), stable(packet));
  // A repeat of the same request restores the turn from the stored row: references are checked on the opened packet.
  const again = await f.service.run(f.user.id, f.input);
  assert.deepEqual([again.id, again.state, again.sources.length], [result.id, 'completed', Object.keys(packet.reference_map).length]);
  assert.deepEqual(f.calls, ['embedding', 'answer']);
  // The chat's own source view reads one entry of the opened packet.
  const opened = openTurn(await turnRows.findUnique({ where: { id: result.id } }));
  assert.equal(opened.payload.packet.evidence.find(entry => entry.evidence_id === packet.reference_map.S1.evidence_id).source_text, packet.evidence[0].source_text);
});

// ADR-094, step 4. A turn's row is written at every step of the turn. Each of those writes used to carry the whole
// payload, the packet, the request and the vector included: on 06.10.2026 a turn put about 1 MB into the database's
// log for a row that keeps 13.6 KB under a plan without an audit time (scripts/rag-v2-chat-volume.mjs).
test('real DB: the turn\'s large parts are written once and its other writes are small', async t => {
  const bytes = value => Buffer.byteLength(JSON.stringify(value ?? null), 'utf8');
  const own = (target, key) => { const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value; };
  for (const auditDays of [7, 0]) {
    const f = await fixture(t, { auditDays, maxInputTokens: 300000, budget: { attempts: 20, embeddingAttempts: 8, answerAttempts: 8, tokens: 2000000, nanoUsd: 2000000 } });
    const packet = municipalPacket({ tenant: f.config.tenant });
    f.config.documents = Object.fromEntries(packet.evidence.map(entry => [entry.document_id, entry.document_version_id]));
    f.adapters.search = async () => packet;
    // Every write of the turn's row, as the store sends it.
    const writes = [];
    const watched = tx => new Proxy(tx, { get: (target, key) => (key !== 'm4PilotTurn' ? own(target, key) : new Proxy(target.m4PilotTurn, { get: (model, method) => (method !== 'update' ? own(model, method)
      : args => { writes.push(args.data); return model.update(args); }) })) });
    f.service.store = new PilotStore(new Proxy(db, { get: (target, key) => (key !== '$transaction' ? own(target, key) : (fn, options) => target.$transaction(tx => fn(watched(tx)), options)) }));
    const result = await f.service.run(f.user.id, f.input);
    assert.equal(result.state, 'completed');
    assert(writes.length >= 10, String(writes.length));
    // No write's payload holds a large part, and every payload is small.
    for (const data of writes) {
      assert.deepEqual(['packet', 'requestAudit', 'vector'].filter(key => key in data.payload), []);
      assert(bytes(data.payload) < 20000, String(bytes(data.payload)));
    }
    // One write of the turn is large: the packet's, with the request as sent. The vector has a write of its own (this
    // fixture's vector is a short one; a real one is about 63 KB).
    const large = writes.filter(data => bytes(data) > 50000);
    assert.deepEqual(large.map(data => ['packet', 'requestAudit', 'vector'].filter(key => key in data)), [['packet', 'requestAudit']]);
    assert.deepEqual([isPackedJson(large[0].packet), large[0].requestAudit.body !== undefined], [true, true]);
    assert.deepEqual(writes.filter(data => Array.isArray(data.vector)).map(data => [data.vector.length, 'packet' in data]), [[3072, false]]);
    const last = writes.at(-1), naming = key => writes.filter(data => key in data).length;
    assert.equal(last.state, 'completed');
    if (auditDays) {
      // A plan with an audit time: the publication names none of them, so each is written exactly once.
      assert.deepEqual(['packet', 'requestAudit', 'vector'].map(naming), [1, 1, 1]);
    } else {
      // A plan without one: the publication replaces them with the lean form, which is small, and clears the vector.
      assert.deepEqual(['packet', 'requestAudit', 'vector'].map(naming), [2, 2, 2]);
      assert.deepEqual([last.vector, 'body' in last.requestAudit, bytes(last) < 20000], [Prisma.DbNull, false, true]);
    }
    // The row reads back as the turn made it.
    const row = await turnRows.findUnique({ where: { id: result.id } });
    if (auditDays) assert.deepEqual([stable(row.payload.packet), row.payload.vector.length, row.payload.requestAudit.body !== undefined], [stable(packet), 3072, true]);
    else assert.deepEqual([isLeanTurn(row), isLeanPacket(row.payload.packet), 'vector' in row.payload], [true, true, false]);
    assert.equal((await f.service.run(f.user.id, f.input)).id, result.id);
  }
});

// A question asked before is not embedded again: its vector is read from the user's own earlier turn, found by the
// question's hash in the database, so the rows of other questions are not read.
test('real DB: the cached vector is found by the question among many other turns of the user', async t => {
  const f = await fixture(t);
  const first = await f.service.run(f.user.id, f.input);
  for (let n = 0; n < 3; n++) await f.service.run(f.user.id, { ...f.input, clientTurnKey: randomUUID(), question: `Teine küsimus ${n}` });
  const row = await turnRows.findUnique({ where: { id: first.id } });
  const cached = await f.store.cache(f.config, f.user.id, row.payload.query.hash);
  assert.deepEqual(cached, row.payload.vector);
  assert.equal(await f.store.cache(f.config, f.user.id, digest('a question never asked')), undefined);
  // A turn whose vector is in its payload (written before the parts had columns) still serves.
  const stored = await asStored.findUnique({ where: { id: first.id } });
  await db.m4PilotTurn.update({ where: { id: first.id }, data: { payload: { ...stored.payload, vector: stored.vector }, vector: Prisma.DbNull } });
  assert.deepEqual(await f.store.cache(f.config, f.user.id, row.payload.query.hash), row.payload.vector);
  const calls = f.calls.length;
  await f.service.run(f.user.id, { ...f.input, clientTurnKey: randomUUID() });
  assert.deepEqual(f.calls.slice(calls), ['answer']);
});

// ADR-094, step 5: the purge no longer runs in every request, so a row past its time may still be stored when the
// history is read. It is read by no one: the turn that has a record is shown from it, the one without is not shown.
test('real DB: rows past their time that are not purged yet do not reach the history', async t => {
  const f = await fixture(t), call = f.service.call;
  const first = await f.service.run(f.user.id, f.input);
  f.service.call = async () => { throw Error('timeout'); };
  await assert.rejects(f.service.run(f.user.id, { ...f.input, clientTurnKey: randomUUID(), question: 'Teine küsimus' }));
  f.service.call = call;
  await db.m4PilotTurn.updateMany({ where: { pilotId: f.config.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  assert.equal(await db.m4PilotTurn.count({ where: { pilotId: f.config.id } }), 2);
  const read = await conversationTurns({ db, service: f.service, config: f.config, userId: f.user.id, convId: f.conv.id });
  assert.deepEqual(read.turns.map(turn => [turn.id, turn.history, turn.answer]), [[first.id, true, first.answer]]);
  await f.store.purge();
  assert.equal(await db.m4PilotTurn.count({ where: { pilotId: f.config.id } }), 0);
});

test('real DB: a packet that has run away still stops the turn before an answer is asked for', async t => {
  const f = await fixture(t, { maxInputTokens: 300000, budget: { attempts: 20, embeddingAttempts: 8, answerAttempts: 8, tokens: 2000000, nanoUsd: 2000000 } });
  const packet = municipalPacket({ tenant: f.config.tenant, records: 200 });
  assert(auditPacketBytes(packet) > AUDIT_PACKET_BYTES, String(auditPacketBytes(packet)));
  f.config.documents = Object.fromEntries(packet.evidence.map(entry => [entry.document_id, entry.document_version_id]));
  f.adapters.search = async () => packet;
  await assert.rejects(f.service.run(f.user.id, f.input), { code: 'audit_packet_too_large' });
  assert.deepEqual(f.calls, ['embedding']);
  const row = await turnRows.findFirst({ where: { pilotId: f.config.id } });
  assert.equal(row.state, 'stopped'); assert.equal(row.payload.packet, undefined); assert.equal(row.payload.requestAudit, undefined);
  assert.equal((await db.m4PilotLedger.findUnique({ where: { id: f.config.id } })).totals.answerAttempts, 0);
  // The limit counts the packet as the turn made it: packed, this one would be under it, and that must not let it through.
  assert(Buffer.byteLength(JSON.stringify(packJson(packet)), 'utf8') < AUDIT_PACKET_BYTES);
});

// ADR-093: a finished turn's row was about 0.4 MB, the conversation in it about 1.3 KB. A plan that keeps no full audit
// stores a turn lean when it is published; a plan with an audit time makes its older turns lean later.
test('real DB: a plan without an audit time stores a whole turn lean, and the turn restores with its cited source', async t => {
  const f = await fixture(t, { auditDays: 0, maxInputTokens: 300000, budget: { attempts: 20, embeddingAttempts: 8, answerAttempts: 8, tokens: 2000000, nanoUsd: 2000000 } });
  const packet = municipalPacket({ tenant: f.config.tenant });
  f.config.documents = Object.fromEntries(packet.evidence.map(entry => [entry.document_id, entry.document_version_id]));
  f.adapters.search = async () => packet;
  const seen = [];
  f.adapters.canonical = async (config, checked, ref) => { seen.push(`${isLeanPacket(checked) ? 'lean' : 'full'}:${ref}`); if (!config.documents[checked.reference_map[ref]?.document_id]) throw Error('forbidden'); };
  const result = await f.service.run(f.user.id, f.input);
  assert.equal(result.state, 'completed');
  // The answer of the fixture cites S1: the reply lists that one source, as the page shows only cited ones.
  assert.deepEqual(result.sources.map(source => [source.ref, source.used, source.title]), [['S1', true, packet.evidence[0].bibliography.title]]);
  const stored = await turnRows.findUnique({ where: { id: result.id } }), bytes = value => Buffer.byteLength(JSON.stringify(value), 'utf8');
  assert(isLeanTurn(stored));
  assert(bytes(stored.payload) < 20000, String(bytes(stored.payload)));
  for (const key of ['vector', 'dialogue', 'previousDialogueState', 'dialogueStateContext']) assert.equal(key in stored.payload, false, key);
  assert.equal('body' in stored.payload.requestAudit, false);
  assert.equal(stored.payload.requestAudit.bodyHash, digest(f.bodies.at(-1).body));
  const kept = openTurn(stored).payload.packet;
  assert.deepEqual([Object.keys(kept.reference_map), kept.evidence.length, kept.evidence[0].source_text], [['S1'], 1, packet.evidence[0].source_text]);
  assert.deepEqual(stored.payload.lean.full, { packet: digest(packet), evidence: 104, references: 104, requestBody: stored.payload.requestAudit.bodyHash, bytes: stored.payload.lean.full.bytes });
  assert(stored.payload.lean.full.bytes > 600000);
  // Before publication every reference of the full packet was checked; after it, the lean turn's one.
  assert.equal(seen.filter(item => item.startsWith('full:')).length >= 104, true);
  assert.deepEqual(seen.filter(item => item.startsWith('lean:')), ['lean:S1']);
  // A repeat of the request restores the lean turn: no call, the same answer and source.
  const again = await f.service.run(f.user.id, f.input);
  assert.deepEqual([again.id, again.state, again.answer, again.sources.length], [result.id, 'completed', result.answer, 1]);
  assert.deepEqual(f.calls, ['embedding', 'answer']);
  // A lean row whose answer was changed afterwards is refused, not shown.
  // What the lean row holds: the vector's column is empty, the request is without its body, the packet is the lean one.
  const columns = await asStored.findUnique({ where: { id: result.id } });
  assert.deepEqual([columns.vector, 'body' in columns.requestAudit, 'packet' in columns.payload, 'requestAudit' in columns.payload], [null, false, false, false]);
  await db.m4PilotTurn.update({ where: { id: result.id }, data: { payload: { ...columns.payload, answer: { ...columns.payload.answer, limitations: ['muudetud'] } } } });
  await assert.rejects(f.service.run(f.user.id, f.input), { code: 'lean_turn_changed' });
});

test('real DB: with an audit time a turn is stored whole and made lean once it is older; a newer turn stays whole', async t => {
  const f = await fixture(t, { auditDays: 7 });
  const first = await f.service.run(f.user.id, f.input);
  const second = await f.service.run(f.user.id, { ...f.input, clientTurnKey: randomUUID(), question: 'Teine küsimus' });
  const whole = await turnRows.findUnique({ where: { id: first.id } });
  assert.equal(isLeanTurn(whole), false);
  assert.equal(whole.payload.vector.length, 3072);
  assert.ok(whole.payload.requestAudit.body);
  // The sweep is over every plan's turns (the test database holds other tests' old rows too), so this test reads its
  // own two. Neither is old enough yet.
  const sweep = async () => { while (await f.store.slimOld(f.config.auditDays, { limit: 50 })); };
  await sweep();
  assert.equal(isLeanTurn(await turnRows.findUnique({ where: { id: first.id } })), false);
  await db.m4PilotTurn.update({ where: { id: first.id }, data: { createdAt: new Date(Date.now() - 8 * 86400000) } });
  assert.equal(await f.store.slimOld(f.config.auditDays), 1);
  const lean = await turnRows.findUnique({ where: { id: first.id } }), newer = await turnRows.findUnique({ where: { id: second.id } });
  // A lean turn is not made lean again: nothing is left for the sweep, and the row keeps its first mark.
  assert.equal(await f.store.slimOld(f.config.auditDays), 0);
  assert.equal((await turnRows.findUnique({ where: { id: first.id } })).payload.lean.at, lean.payload.lean.at);
  assert(isLeanTurn(lean));
  assert.equal(isLeanTurn(newer), false);
  assert.deepEqual([lean.state, lean.payload.answer, lean.payload.question, 'vector' in lean.payload, 'body' in lean.payload.requestAudit], ['completed', whole.payload.answer, whole.payload.question, false, false]);
  assert.equal(lean.payload.lean.proved.answer, digest(whole.payload.answer));
  // The turn made lean later restores like any other, without a call.
  const calls = f.calls.length, restored = await f.service.run(f.user.id, f.input);
  assert.deepEqual([restored.id, restored.state, restored.answer, f.calls.length], [first.id, 'completed', first.answer, calls]);
});

// ADR-094: the conversation is kept with the conversation's own messages, not in the turn's audit row. The chat's
// history is read from there whenever the row cannot be: after a plan change (a release that changes the chat, a corpus
// increment) and after the audit row is gone.
test('real DB: a published turn stays in its conversation\'s history through a plan change and the end of its audit row', async t => {
  const f = await fixture(t);
  await db.conversation.update({ where: { id: f.conv.id }, data: { lastActivityAt: new Date(Date.now() - 30 * 86400000) } });
  const started = Date.now();
  const first = await f.service.run(f.user.id, f.input);
  const second = await f.service.run(f.user.id, { ...f.input, clientTurnKey: randomUUID(), question: 'Teine küsimus' });
  const messages = await db.conversationMessage.findMany({ where: { conversationId: f.conv.id }, orderBy: { createdAt: 'asc' } });
  assert.deepEqual(messages.map(m => [m.role, m.content, m.metadata.m4TurnId, isHistoryMessage(m)]), [['USER', 'Üldküsimus', first.id, false], ['ASSISTANT', 'Allikatekst [S1]\n\nPiiratud', first.id, true],
    ['USER', 'Teine küsimus', second.id, false], ['ASSISTANT', 'Allikatekst [S1]\n\nPiiratud', second.id, true]]);
  assert.equal(messages[0].authorId, f.user.id);
  // The record: what the chat shows and the dialogue goes on from; of the source a citation and ids, never its text.
  const record = messages[1].metadata.m4History;
  assert.deepEqual([record.turnId, record.mode, record.answer, record.language, record.forms], [first.id, 'real', first.answer, 'et', []]);
  assert.deepEqual(record.sources, [{ ref: 'S1', title: 'Testallikas', pages: [2], version: 'v1', document: 'doc1' }]);
  assert.equal(record.dialogue.contextMode, 'new');
  assert(Buffer.byteLength(JSON.stringify(record), 'utf8') < 2000);
  // A published turn marks its conversation active: the retention time of a conversation runs from its last activity.
  assert((await db.conversation.findUnique({ where: { id: f.conv.id } })).lastActivityAt.getTime() >= started);
  const base = { db, service: f.service, config: f.config, userId: f.user.id, convId: f.conv.id };
  const shown = turns => pilotChatMessages(turns, f.conv.id).map(m => [m.role, m.text]);
  // The running plan reads its own rows, references checked as before.
  const live = await conversationTurns(base);
  assert.deepEqual(live.turns.map(turn => [turn.id, turn.history === true]), [[first.id, false], [second.id, false]]);
  // Another plan (as after any release that changes the chat's code, or a corpus increment) reads no row of this one:
  // the conversation is shown from its records, the same messages.
  const next = { ...f.config, id: randomUUID(), configHash: randomUUID() };
  const later = await conversationTurns({ ...base, config: next });
  assert.deepEqual(later.turns.map(turn => [turn.id, turn.history, turn.question, turn.answer]), [[first.id, true, 'Üldküsimus', first.answer], [second.id, true, 'Teine küsimus', second.answer]]);
  assert.deepEqual(shown(later.turns), shown(live.turns));
  assert.deepEqual(later.turns[0].sources, [{ ref: 'S1', title: 'Testallikas', pages: [2], version: 'v1', used: true }]);
  assert.equal(later.rows.size, 0);
  // A source of such a turn: its citation; the text only when the corpus still holds the same excerpt (here the test
  // adapters have no corpus lookup, so nothing is claimed).
  const one = await conversationTurns({ ...base, config: next, turnId: second.id });
  assert.deepEqual(one.turns.map(turn => turn.id), [second.id]);
  assert.deepEqual(await historySourceView({ adapters: f.adapters, config: next, record: one.records.get(second.id), ref: 'S1' }),
    { title: 'Testallikas', version: 'v1', pages: [2], text: null, ref: 'S1', links: [], history: true, superseded: true });
  // The audit rows end (the plan's retention time, or a sweep): the conversation is still whole.
  assert.equal((await db.m4PilotTurn.deleteMany({ where: { pilotId: f.config.id } })).count, 2);
  const after = await conversationTurns(base);
  assert.deepEqual(shown(after.turns), shown(live.turns));
  assert.deepEqual(after.turns.map(turn => turn.history), [true, true]);
  // Another user's request finds nothing of it: rows go by the user, and the route reads records only after the
  // conversation's owner is checked (store.conversation).
  await assert.rejects(f.store.locked(f.config, tx => f.store.conversation(tx, 'another-user', f.conv.id)));
});

test('real DB: a turn that cannot be restored from its row is shown from its record; a stopped turn has none', async t => {
  const f = await fixture(t);
  const first = await f.service.run(f.user.id, f.input);
  f.service.call = async ({ stage }) => { if (stage === 'answer') throw Error('timeout'); return { value: Array.from({ length: 3072 }, (_, i) => i === 0 ? 1 : 0), usage: { input: 50, output: 0 }, requestId: 'fake' }; };
  await assert.rejects(f.service.run(f.user.id, { ...f.input, clientTurnKey: randomUUID(), question: 'Katkenud küsimus' }));
  assert.equal(await db.conversationMessage.count({ where: { conversationId: f.conv.id } }), 2, 'a turn without an answer writes no message');
  const base = { db, service: f.service, config: f.config, userId: f.user.id, convId: f.conv.id };
  // The source of the first turn leaves the plan: its row no longer restores, the conversation still shows the turn.
  f.config.documents = {};
  const listed = await conversationTurns(base);
  assert.deepEqual(listed.turns.map(turn => [turn.state, turn.history === true]), [['completed', true], ['unknown', false]]);
  assert.deepEqual([listed.turns[0].id, listed.turns[0].answer, listed.rows.has(first.id)], [first.id, first.answer, false]);
});

// ADR-094: a turn published before the conversation was kept in its own messages has an audit row and two placeholder
// messages. Its record is made from the row, as it is made at publication.
test('real DB: a turn published with placeholders gets its record from its audit row; a dry run writes nothing; other text is left alone', async t => {
  const f = await fixture(t);
  const first = await f.service.run(f.user.id, f.input);
  const second = await f.service.run(f.user.id, { ...f.input, clientTurnKey: randomUUID(), question: 'Teine küsimus' });
  const read = () => db.conversationMessage.findMany({ where: { conversationId: f.conv.id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  const published = await read();
  // As turns were published before: the placeholders and the turn's id.
  for (const message of published) await db.conversationMessage.update({ where: { id: message.id }, data: { content: PLACEHOLDERS[message.role], metadata: { m4TurnId: message.metadata.m4TurnId } } });
  // The test database holds other tests' turns too, and test files run side by side: this test works on its own plan's.
  const where = { pilotId: f.config.id };
  const mine = async () => (await read()).map(message => [message.role, message.content, isHistoryMessage(message)]);
  const placeholders = [['USER', PLACEHOLDERS.USER, false], ['ASSISTANT', PLACEHOLDERS.ASSISTANT, false], ['USER', PLACEHOLDERS.USER, false], ['ASSISTANT', PLACEHOLDERS.ASSISTANT, false]];
  assert.deepEqual(await mine(), placeholders);
  const counted = await recordStoredTurns(db, { dryRun: true, where });
  assert.deepEqual([counted.turns, counted.made, counted.already, counted.otherContent, counted.failed, counted.dryRun], [2, 2, 0, 0, {}, true]);
  assert.deepEqual(await mine(), placeholders, 'a dry run writes nothing');
  // The second turn's answer message holds some other text: it is not written over.
  await db.conversationMessage.update({ where: { id: published[3].id }, data: { content: 'Käsitsi muudetud tekst' } });
  const done = await recordStoredTurns(db, { where });
  assert.deepEqual([done.turns, done.made, done.otherContent, done.already, done.noMessages], [2, 1, 1, 0, 0]);
  assert(done.recordBytes.max > 0 && done.recordBytes.sum === done.recordBytes.max);
  const after = await read();
  // The first turn's messages are again what publication wrote: the same text, the same record.
  assert.deepEqual(after.slice(0, 2).map(message => [message.id, message.content, message.metadata]), published.slice(0, 2).map(message => [message.id, message.content, message.metadata]));
  assert.deepEqual(after.slice(2).map(message => [message.content, isHistoryMessage(message)]), [[PLACEHOLDERS.USER, false], ['Käsitsi muudetud tekst', false]]);
  // The turn is in the history under any plan now, and its audit row is as it was.
  const later = await conversationTurns({ db, service: f.service, config: { ...f.config, id: randomUUID(), configHash: randomUUID() }, userId: f.user.id, convId: f.conv.id });
  assert.deepEqual(later.turns.map(turn => [turn.id, turn.history, turn.question]), [[first.id, true, 'Üldküsimus']]);
  assert.equal((await turnRows.findUnique({ where: { id: second.id } })).state, 'completed');
  // A second run finds the first turn done.
  const again = await recordStoredTurns(db, { where });
  assert.deepEqual([again.turns, again.already, again.made, again.otherContent], [2, 1, 0, 1]);
  assert.deepEqual((await read()).map(message => message.content), after.map(message => message.content));
  // A record of the first step, without the topic's user turns, is completed from the row (here a turn without a
  // dialogue has no such list, so its record counts as whole).
  assert.equal(again.completed, 0);
});

// ADR-094, step 5: the storage report reads what the chat takes on disk and what waits for a sweep, in numbers only.
test('real DB: the storage report counts audit rows by form, the records in the messages and what waits for a sweep', async t => {
  const { chatStorageReport } = await import('../lib/rag-v2/pilot/storage-report.js');
  const f = await fixture(t, { auditDays: 7 });
  const before = await chatStorageReport(db, { auditDays: 7 });
  const first = await f.service.run(f.user.id, f.input);
  await f.service.run(f.user.id, { ...f.input, clientTurnKey: randomUUID(), question: 'Teine küsimus' });
  // The first row is older than the plan's audit time and past its own time; neither sweep has run yet.
  await db.m4PilotTurn.update({ where: { id: first.id }, data: { createdAt: new Date(Date.now() - 8 * 86400000), expiresAt: new Date(Date.now() - 1000) } });
  const after = await chatStorageReport(db, { auditDays: 7 });
  // The test database holds other tests' rows and test files run side by side: the report is read as a difference.
  const grew = (a, b, path) => path.reduce((value, key) => value[key], b) - path.reduce((value, key) => value[key], a);
  assert(grew(before, after, ['audit_rows', 'rows']) >= 2 && grew(before, after, ['audit_rows', 'whole']) >= 2);
  assert(grew(before, after, ['messages', 'with_record']) >= 2 && grew(before, after, ['messages', 'of_chat_turns']) >= 4);
  assert(after.audit_rows.past_their_time_not_purged >= 1 && after.lean_queue.whole_older_than_audit_time >= 1);
  assert(after.audit_rows.rows_last_day >= 1 && after.audit_rows.bytes_last_day > 0 && after.audit_rows.whole_avg_bytes > 0);
  assert(after.messages.answer_with_record_avg_bytes > 0 && after.messages.answer_with_record_max_bytes >= after.messages.answer_with_record_avg_bytes);
  assert(after.conversations.conversations >= 1 && after.database_bytes > 0 && after.tables.M4PilotTurn.total_bytes > 0 && after.tables.ConversationMessage.total_bytes > 0);
  assert.equal((await chatStorageReport(db)).lean_queue, null, 'a plan without an audit time has no lean queue');
  // Numbers and times only: no text of a turn is in the report.
  assert.doesNotMatch(JSON.stringify(after), /Üldküsimus|Allikatekst|Teine küsimus/u);
});
