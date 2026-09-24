import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { PilotStore } from '../lib/rag-v2/pilot/store.js';
import { PilotService } from '../lib/rag-v2/pilot/service.js';
import { DIALOGUE_VERSION, DIALOGUE_LIMITS } from '../lib/rag-v2/pilot/dialogue.js';
import { embeddingConfig } from '../lib/rag-v2/search/embedding.js';
import { DIALOGUE_STATE_VERSION } from '../lib/rag-v2/pilot/dialogue-state.js';

const url = new URL(process.env.M4_TEST_DATABASE_URL || 'postgres://invalid/invalid');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/sotsiaal_ai_m4_dev') throw Error('explicit isolated M4_TEST_DATABASE_URL required');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }), log: [] });
test.after(() => db.$disconnect());
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw Error('NETWORK_FORBIDDEN_IN_TEST'); };
test.after(() => { globalThis.fetch = originalFetch; });

async function fixture(t, stateFor = null) {
  const user = await db.user.create({ data: { email: `m4c-${randomUUID()}@example.invalid` } });
  const conv = await db.conversation.create({ data: { userId: user.id, role: 'CLIENT', metadata: { m4: true }, expiresAt: null } });
  const config = { id: randomUUID(), configHash: randomUUID(), tenant: 'm4c-test', mode: 'real', users: [user.id], documents: { doc: 'v1' },
    dialogueVersion: DIALOGUE_VERSION, ...(stateFor ? { dialogueStateVersion: DIALOGUE_STATE_VERSION } : {}),
    embedding: embeddingConfig({ embedding_mode: 'real', provider: 'openai', model: 'text-embedding-3-large', dimensions: 3072, endpoint: 'https://api.openai.com/v1/embeddings' }),
    model: 'gpt-5.6-luna', reasoning: 'low', maxInputTokens: 64000, maxOutputTokens: 1000, expiresAt: null, retentionHours: null,
    prices: { embeddingInput: 1, answerInput: 1, answerOutput: 1 }, budget: { attempts: 24, embeddingAttempts: 12, answerAttempts: 12, tokens: 1000000, nanoUsd: 1000000 } };
  const calls = [], queries = [];
  let fail = false, denied = false, generation = 0;
  const adapters = { preflight: async () => {}, search: async (c, query) => {
    queries.push(query);
    return { tenant: c.tenant, query_id: randomUUID(), reference_map: { S1: { document_id: 'doc', document_version_id: 'v1', evidence_id: `e${++generation}`, pdf_pages: [generation] } },
      evidence: [{ evidence_id: `e${generation}`, source_text: `Fresh source ${generation}`, bibliography: { title: `Source ${generation}` } }], model_context: { evidence: [{ ref: 'S1', text: `Fresh source ${generation}` }] } };
  }, canonical: async () => { if (denied) throw Object.assign(Error('reference_access_denied'), { code: 'reference_access_denied', status: 403 }); } };
  if (stateFor) adapters.records = adapters.search;
  const store = new PilotStore(db);
  const service = new PilotService({ store, readConfig: async () => config, adapters, call: async ({ stage, body }) => {
    calls.push({ stage, body });
    return { value: stage === 'embedding' ? Array.from({ length: 3072 }, (_, i) => i === 0 ? 1 : 0)
      : { kind: 'grounded', blocks: [{ text: 'Synthetic first point', factual: true, refs: ['S1'] }, { text: 'Synthetic second point', factual: true, refs: [fail ? 'S99' : 'S1'] }], limitations: [], clarification: null,
        ...(stateFor ? { dialogue_state: stateFor(JSON.parse(body.input[0].content).dialogue) } : {}) },
    usage: { input: 20, output: stage === 'answer' ? 30 : 0 }, requestId: 'synthetic-transport' };
  } });
  const input = (question, contextMode = 'same', extra = {}) => ({ question, contextMode, convId: conv.id, clientTurnKey: randomUUID(), language: 'et', ...extra });
  const run = (question, contextMode = 'same', extra = {}) => service.run(user.id, input(question, contextMode, extra));
  const row = id => db.m4PilotTurn.findUnique({ where: { id } });
  t.after(async () => { await db.user.delete({ where: { id: user.id } }); await db.m4PilotLedger.deleteMany({ where: { id: config.id } }); });
  return { user, conv, config, store, service, calls, queries, input, run, row, fail: value => { fail = value; }, deny: () => { denied = true; } };
}

test('M4-C real DB: four turns retain first circumstances; old S1 is dialogue only, new packet binds its own S1', async t => {
  const f = await fixture(t);
  const first = await f.run('Olen 67, elan Harkus ja küsin koduteenuse kohta.', 'new');
  await f.run('Millist abi kirjeldatakse?'); await f.run('Aga teenuse ulatus?');
  const fourth = await f.run('Selgita teist punkti.');
  const row = await f.row(fourth.id);
  assert.equal(row.payload.dialogue.userTurns.length, 4);
  assert.match(row.payload.query.text, /Olen 67, elan Harkus/);
  assert.doesNotMatch(row.payload.query.text, /Synthetic second point/);
  const prior = row.payload.dialogue.publishedAssistant;
  assert.equal(prior.blocks[1].point, 2);
  assert.equal(prior.blocks[1].historicalReferences[0], `${prior.turnId}/S1`);
  assert.notEqual(row.payload.packet.reference_map.S1.evidence_id, (await f.row(first.id)).payload.packet.reference_map.S1.evidence_id);
  assert.deepEqual(f.calls.map(c => c.stage), ['embedding', 'answer', 'embedding', 'answer', 'embedding', 'answer', 'embedding', 'answer']);
  assert.equal((await f.service.restore(row)).context.userTurns, 4);
});

const userFact = (topic, turn, quote) => ({ topic, subject: 'self', status: 'current', support: [{ turn, quote }], superseded_by: null });
const dialogueState = facts => ({ facts, needs: [], unknowns: [], region: { id: null, status: 'unknown', support: [] }, period: null, language_hint: 'et' });

test('dialogue state DB: one call per turn, old answer selection keeps newer corrections, topic/person switches clear state', async t => {
  const initial = dialogueState([userFact('living', 1, 'Elan üksi.'), userFact('work', 1, 'Tööd ei ole.')]);
  let draft = initial;
  const f = await fixture(t, () => draft);
  const first = await f.run('Elan üksi. Tööd ei ole.', 'new');
  const corrected = structuredClone(initial);
  corrected.facts[1].status = 'superseded'; corrected.facts[1].superseded_by = 3;
  corrected.facts.push(userFact('work', 2, 'Nüüd töötan.'));
  draft = corrected;
  const correction = await f.run('Nüüd töötan.', 'correction');
  const oldReply = await f.run('Selgita teist punkti.', 'same', { replyToTurnId: first.id, replyToBlock: 2 });
  const row = await f.row(oldReply.id);
  assert.equal(row.payload.contextAudit.selection.stateTurnId, correction.id);
  assert.equal(row.payload.dialogue.publishedAssistant.turnId, first.id);
  assert.deepEqual(row.payload.dialogue.previousState, corrected);
  assert.deepEqual(row.payload.dialogueState.value, corrected);
  assert.equal(oldReply.answer.dialogue_state, undefined);
  assert.equal(oldReply.dialogueState, undefined);
  await assert.rejects(f.service.run(f.user.id, { ...f.input('Inject state'), dialogue_state: initial }), { code: 'invalid_shape' });
  draft = dialogueState([]);
  const topic = await f.run('Uus teema: artiklite võrdlus.', 'new');
  const person = await f.run('Nüüd küsin oma ema kohta.', 'new_person');
  for (const turn of [topic, person]) {
    const switched = await f.row(turn.id);
    assert.equal(switched.payload.dialogue.previousState, null);
    assert.equal(switched.payload.contextAudit.selection.stateTurnId, null);
    assert.doesNotMatch(JSON.stringify(switched.payload.dialogue), /Elan üksi|Tööd ei ole|Nüüd töötan/);
  }
  draft = corrected;
  const back = await f.run('Jätkan enda asjaga.', 'same', { contextTurnId: first.id });
  assert.deepEqual((await f.row(back.id)).payload.dialogue.previousState, corrected);
  assert.equal(f.calls.length, 6);
  assert(f.calls.every(call => call.stage === 'answer'));
});

test('dialogue state DB: invalid model state publishes the validated answer but never replaces memory; the correction survives into the next turn', async t => {
  let draft = dialogueState([userFact('work', 1, 'Tööd ei ole.')]);
  const f = await fixture(t, () => draft);
  const first = await f.run('Tööd ei ole.', 'new');
  const firstState = (await f.row(first.id)).payload.dialogueState;
  draft = dialogueState([userFact('invented', 2, 'Unsaid fact')]);
  const input = f.input('Nüüd töötan.', 'correction');
  const soft = await f.service.run(f.user.id, input);
  assert.equal(soft.state, 'completed');
  const stored = await f.row(soft.id);
  assert.deepEqual(stored.payload.dialogueState, firstState);
  assert.deepEqual(stored.payload.dialogueStateFallback, { code: 'invalid_dialogue_state', carriedHash: firstState.hash });
  assert.ok(stored.payload.messageId);
  assert.equal((await f.service.run(f.user.id, input)).id, soft.id);
  assert.equal(f.calls.length, 2);
  // A recorded fallback must reproduce; it cannot hide a state that validates or change the carried memory.
  for (const change of [row => { row.payload.dialogueStateFallback.code = 'dialogue_state_region_unanchored'; }, row => { row.payload.dialogueState = null; }]) {
    const forged = structuredClone(stored); change(forged);
    await assert.rejects(f.service.restore(forged), { code: 'dialogue_state_projection_mismatch' });
  }
  const corrected = dialogueState([{ ...userFact('work', 1, 'Tööd ei ole.'), status: 'superseded', superseded_by: 2 }, userFact('work', 2, 'Nüüd töötan.')]);
  draft = corrected;
  const next = await f.run('Aga muu abi?');
  const row = await f.row(next.id);
  assert.equal(row.payload.contextAudit.selection.stateTurnId, soft.id);
  assert.deepEqual(row.payload.dialogue.previousState, firstState.value);
  assert.equal(row.payload.dialogue.userTurns[1].text, input.question);
  assert.deepEqual(row.payload.dialogueState.value, corrected);
  assert.equal(row.payload.dialogueStateFallback, undefined);
});

test('dialogue state DB: an invalid first state publishes without memory; an invalid answer still fails closed', async t => {
  let draft = dialogueState([userFact('invented', 1, 'Unsaid fact')]);
  const f = await fixture(t, () => draft);
  const first = await f.run('Elan üksi.', 'new');
  assert.equal(first.state, 'completed');
  const row = await f.row(first.id);
  assert.equal(row.payload.dialogueState, null);
  assert.deepEqual(row.payload.dialogueStateFallback, { code: 'invalid_dialogue_state', carriedHash: null });
  draft = dialogueState([userFact('living', 1, 'Elan üksi.')]);
  const next = await f.row((await f.run('Mis abi on?')).id);
  assert.equal(next.payload.dialogue.previousState, null);
  assert.deepEqual(next.payload.dialogueState.value, draft);
  f.fail(true); draft = dialogueState([userFact('invented', 1, 'Unsaid fact')]);
  const input = f.input('Veel üks küsimus.');
  await assert.rejects(f.service.run(f.user.id, input), { code: 'invalid_answer_reference' });
  assert.equal((await f.store.existing(f.config, f.user.id, input)).state, 'answer_rejected');
  // The asynchronous region check fails softly too; restore accepts it only for a structurally valid state.
  f.fail(false); draft = dialogueState([userFact('living', 1, 'Elan üksi.')]);
  f.service.adapters.validateDialogueStateRegion = async () => { throw Object.assign(Error('dialogue_state_region_unanchored'), { code: 'dialogue_state_region_unanchored', status: 422 }); };
  const regional = await f.row((await f.run('Kus abi saab?')).id);
  assert.deepEqual(regional.payload.dialogueStateFallback, { code: 'dialogue_state_region_unanchored', carriedHash: next.payload.dialogueState.hash });
  assert.deepEqual(regional.payload.dialogueState, next.payload.dialogueState);
  assert.equal((await f.service.restore(regional)).state, 'completed');
});

test('dialogue state DB: validated answer and state recover together without another model call; altered projection fails closed', async t => {
  const draft = dialogueState([userFact('living', 1, 'Elan üksi.')]);
  const f = await fixture(t, () => draft), publish = f.store.publish.bind(f.store);
  f.store.publish = async () => { throw Error('synthetic publication failure'); };
  const input = f.input('Elan üksi.', 'new');
  await assert.rejects(f.service.run(f.user.id, input), /synthetic publication failure/);
  const pending = await f.store.existing(f.config, f.user.id, input);
  assert.equal(pending.state, 'needs_recovery');
  assert.deepEqual(pending.payload.dialogueState.value, draft);
  const altered = structuredClone(pending);
  altered.payload.dialogueState.value.facts[0].topic = 'altered';
  await assert.rejects(f.service.recover(altered), { code: 'dialogue_state_projection_mismatch' });
  f.store.publish = publish;
  const recovered = await f.service.recover(pending);
  assert.equal(recovered.state, 'completed');
  assert.equal(f.calls.length, 1);
  assert.deepEqual((await f.row(pending.id)).payload.dialogueState, pending.payload.dialogueState);
  const ledger = await db.m4PilotLedger.findUnique({ where: { id: f.config.id } });
  await db.conversation.delete({ where: { id: f.conv.id } });
  assert.equal(await f.row(pending.id), null);
  await assert.rejects(f.service.restore({ ...pending, state: 'completed' }), { code: 'conversation_unavailable' });
  assert.deepEqual((await db.m4PilotLedger.findUnique({ where: { id: f.config.id } })).totals, ledger.totals);
});

test('M4-C real DB: failed correction is accepted once and remains alongside unchanged user circumstances', async t => {
  const f = await fixture(t); await f.run('Olen 67 ja elan Harkus.', 'new');
  f.fail(true);
  const correction = f.input('Parandus: elan Tartus.', 'correction');
  await assert.rejects(f.service.run(f.user.id, correction), { code: 'invalid_answer_reference' });
  const failed = await f.store.existing(f.config, f.user.id, correction);
  assert.equal(failed.state, 'answer_rejected');
  assert.equal((await f.service.run(f.user.id, correction)).id, failed.id);
  f.fail(false);
  const next = await f.run('Aga hind?');
  const row = await f.row(next.id);
  assert.equal(row.payload.context.correctionRevision, 1);
  assert.deepEqual(row.payload.dialogue.userTurns.map(x => x.text), ['Olen 67 ja elan Harkus.', 'Parandus: elan Tartus.', 'Aga hind?']);
  assert.deepEqual(row.payload.query.strictFilters, {});
  assert.ok(row.payload.contextAudit.selection.excluded.some(x => x.turnId === failed.id && x.role === 'assistant' && x.reason === 'not_published'));
  assert.equal(f.calls.filter(c => c.stage === 'answer').length, 3);
});

test('M4-C real DB: failed person switch cannot fall back to the last successful old person', async t => {
  const f = await fixture(t); const old = await f.run('Vana inimene: 67, Harku, abielus.', 'new');
  f.fail(true); await assert.rejects(f.run('Teine inimene: 30, Tartu.', 'new_person'));
  f.fail(false); const next = await f.run('Aga hind?');
  const row = await f.row(next.id);
  assert.notEqual(next.context.personId, old.context.personId);
  assert.doesNotMatch(JSON.stringify(row.payload.dialogue), /67|Harku|abielus/);
  assert.equal(row.payload.dialogue.publishedAssistant, null);
  assert.match(row.payload.query.text, /30, Tartu/);
});

test('M4-C real DB: explicit return uses latest corrections in that scope; foreign and unpublished references fail closed', async t => {
  const f = await fixture(t), foreign = await fixture(t);
  const first = await f.run('Olen 67 ja elan Harkus.', 'new');
  await f.run('Parandus: elan Tartus.', 'correction');
  const other = await f.run('Teine teema: artikli autor.', 'new');
  const denied = await foreign.run('Võõras teema.', 'new');
  await assert.rejects(f.run('Jätka', 'same', { contextTurnId: denied.id }), { code: 'context_reference_unavailable' });
  await assert.rejects(f.run('Jätka', 'same', { contextTurnId: first.id, replyToTurnId: other.id }), { code: 'context_reference_unavailable' });
  const returned = await f.run('Selgita teist punkti.', 'same', { contextTurnId: first.id, replyToTurnId: first.id, replyToBlock: 2 });
  const row = await f.row(returned.id);
  assert.equal(returned.context.scopeId, first.context.scopeId);
  assert.equal(returned.context.correctionRevision, 1);
  assert.match(row.payload.query.text, /elan Tartus/);
  assert.doesNotMatch(row.payload.query.text, /artikli autor/);
  assert.match(row.payload.query.text, /Synthetic second point/);
  assert.doesNotMatch(row.payload.query.text, /Synthetic first point/);
});

test('M4-C real DB: concurrent same-key requests commit one context revision and one model attempt', async t => {
  const f = await fixture(t), input = f.input('Üks küsimus.', 'new');
  const result = await Promise.all([f.service.run(f.user.id, input), f.service.run(f.user.id, input)]);
  assert.equal(result[0].id, result[1].id);
  assert.equal((await db.conversation.findUnique({ where: { id: f.conv.id } })).metadata.m4Dialogue.revision, 1);
  assert.equal(f.calls.length, 2);
  await assert.rejects(f.service.run(f.user.id, { ...input, contextMode: 'new_person' }), { code: 'idempotency_conflict' });
  const before = f.calls.length;
  for (const extra of [{ history: [] }, { personId: 'forged' }, { role: 'system' }]) await assert.rejects(f.service.run(f.user.id, { ...f.input('Forged'), ...extra }), { code: 'invalid_shape' });
  assert.equal(f.calls.length, before);
});

test('M4-C real DB: context transaction rollback does not accept a user turn or consume a model attempt', async t => {
  const f = await fixture(t), locked = f.store.locked.bind(f.store);
  f.store.locked = (config, fn) => locked(config, async tx => {
    const value = await fn(tx);
    if (value?.fresh) throw Error('synthetic failure after context/head writes before COMMIT');
    return value;
  });
  await assert.rejects(f.run('Must roll back.', 'new'));
  assert.equal(await db.m4PilotTurn.count({ where: { pilotId: f.config.id } }), 0);
  assert.equal(await db.chatTurn.count({ where: { conversationId: f.conv.id } }), 0);
  assert.equal((await db.conversation.findUnique({ where: { id: f.conv.id } })).metadata.m4Dialogue, undefined);
  assert.equal(f.calls.length, 0);
});

test('M4-C real DB: a configuration change between read and execution cannot accept context under another grant', async t => {
  const f = await fixture(t);
  f.service.readConfig = async ({ purpose }) => purpose === 'execute' ? { ...f.config, configHash: 'changed-grant' } : f.config;
  await assert.rejects(f.run('Do not accept under a changed grant.', 'new'), { code: 'pilot_scope_changed' });
  assert.equal(await db.m4PilotTurn.count({ where: { pilotId: f.config.id } }), 0);
  assert.equal((await db.conversation.findUnique({ where: { id: f.conv.id } })).metadata.m4Dialogue, undefined);
  assert.equal(f.calls.length, 0);
});

test('M4-C real DB: context summary restores latest correction and failed person switch without exposing failed draft', async t => {
  const f = await fixture(t);
  const first = await f.run('I am 67 and live in Harku.', 'new');
  await f.run('Correction: Tartu; my age is unchanged.', 'correction');
  const summary = await f.store.contextSummary(f.config, f.user.id, f.conv.id);
  assert.equal(summary.active.scopeId, first.id);
  assert.equal(summary.active.correctionRevision, 1);
  assert.equal(summary.scopes[0].latestCorrection, 'Correction: Tartu; my age is unchanged.');
  f.fail(true);
  await assert.rejects(f.run('Another person, age 30.', 'new_person'), { code: 'invalid_answer_reference' });
  const restored = await f.store.contextSummary(f.config, f.user.id, f.conv.id);
  assert.notEqual(restored.active.personId, first.id);
  assert.equal(restored.scopes[1].person, 2);
  assert.deepEqual(restored.scopes[1].answers, []);
  assert.doesNotMatch(JSON.stringify(restored), /Synthetic second point|S99/);
  await assert.rejects(f.store.contextSummary(f.config, 'foreign-user', f.conv.id), { code: 'conversation_unavailable' });
  assert.deepEqual((await f.store.contextSummary(f.config, f.user.id, randomUUID())).scopes, []);
});

test('M4-C real DB: eighth turn is retained, ninth is visibly rejected without silent clipping or context mutation', async t => {
  const f = await fixture(t);
  for (let i = 0; i < DIALOGUE_LIMITS.scopeTurns; i++) await f.run(`Pööre ${i}`, i ? 'same' : 'new');
  const before = await db.conversation.findUnique({ where: { id: f.conv.id } });
  await assert.rejects(f.run('Liiga pikk jätk.'), { code: 'context_window_full' });
  assert.deepEqual((await db.conversation.findUnique({ where: { id: f.conv.id } })).metadata, before.metadata);
  assert.equal(f.calls.filter(c => c.stage === 'answer').length, 8);
});

test('M4-C real DB: equal questions in different scopes do not share vectors; legacy cache cannot supply a dialogue vector', async t => {
  const f = await fixture(t);
  const a = await f.run('Aga hind?', 'new'), b = await f.run('Aga hind?', 'new_person');
  const ar = await f.row(a.id), br = await f.row(b.id);
  assert.equal(ar.payload.query.hash, br.payload.query.hash);
  assert.notEqual(ar.payload.query.cacheKey, br.payload.query.cacheKey);
  assert.equal(f.calls.filter(c => c.stage === 'embedding').length, 2);
  assert.equal(await f.store.cache(f.config, f.user.id, ar.payload.query.hash), undefined);
});

test('M4-C real DB: source revocation blocks prior-answer reuse before egress; deletion removes dialogue while costs remain', async t => {
  const f = await fixture(t); const first = await f.run('Esimene.', 'new');
  f.deny();
  await assert.rejects(f.run('Selgita teist punkti.'), { code: 'reference_access_denied' });
  assert.equal(f.calls.length, 2);
  await assert.rejects(f.service.restore(await f.row(first.id)), { code: 'reference_access_denied' });
  const ledger = await db.m4PilotLedger.findUnique({ where: { id: f.config.id } });
  await db.conversation.delete({ where: { id: f.conv.id } });
  assert.equal(await db.m4PilotTurn.count({ where: { pilotId: f.config.id } }), 0);
  assert.deepEqual((await db.m4PilotLedger.findUnique({ where: { id: f.config.id } })).totals, ledger.totals);
});

test('M4-C real DB: expired accepted head cannot resurrect an older person; null retention remains null', async t => {
  const f = await fixture(t); await f.run('Vana inimene.', 'new');
  const newer = await f.run('Uus inimene.', 'new_person');
  assert.equal((await f.row(newer.id)).expiresAt, null);
  await db.m4PilotTurn.update({ where: { id: newer.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  await assert.rejects(f.run('Aga hind?'), { code: 'context_unavailable' });
  assert.equal(f.calls.length, 4);
  const fresh = await f.run('Alustan uuesti.', 'new_person');
  assert.equal((await f.row(fresh.id)).payload.dialogue.userTurns.length, 1);
});
