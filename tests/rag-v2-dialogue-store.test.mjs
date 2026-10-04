import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { PilotStore } from '../lib/rag-v2/pilot/store.js';
import { PilotService } from '../lib/rag-v2/pilot/service.js';
import { DIALOGUE_VERSION, DIALOGUE_LIMITS } from '../lib/rag-v2/pilot/dialogue.js';
import { embeddingConfig } from '../lib/rag-v2/search/embedding.js';
import { DIALOGUE_STATE_VERSION, PERSON_DIALOGUE_STATE_VERSION, FACT_STATE_VERSION, REGION_STATE_VERSION } from '../lib/rag-v2/pilot/dialogue-state.js';
import { SEARCH_ASSIST_VERSION } from '../lib/rag-v2/pilot/search-assist.js';
import { runtimeAdapters } from '../lib/rag-v2/pilot/retrieval.js';
import { RECORD_RETRIEVAL_VERSION } from '../lib/rag-v2/search/structured-record-source.js';

const url = new URL(process.env.M4_TEST_DATABASE_URL || 'postgres://invalid/invalid');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/sotsiaal_ai_m4_dev') throw Error('explicit isolated M4_TEST_DATABASE_URL required');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }), log: [] });
test.after(() => db.$disconnect());
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw Error('NETWORK_FORBIDDEN_IN_TEST'); };
test.after(() => { globalThis.fetch = originalFetch; });

async function fixture(t, stateFor = null, stateVersion = DIALOGUE_STATE_VERSION) {
  const user = await db.user.create({ data: { email: `m4c-${randomUUID()}@example.invalid` } });
  const conv = await db.conversation.create({ data: { userId: user.id, role: 'CLIENT', metadata: { m4: true }, expiresAt: null } });
  const config = { id: randomUUID(), configHash: randomUUID(), tenant: 'm4c-test', mode: 'real', users: [user.id], documents: { doc: 'v1' },
    dialogueVersion: DIALOGUE_VERSION, ...(stateFor ? { dialogueStateVersion: stateVersion } : {}),
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

test('dialogue state DB (ADR-049): a v3 state with persons is the memory of the next turn; a renamed topic and a left-out person are carried', async t => {
  const person = (label, facts) => ({ facts, needs: [], unknowns: [], language_hint: 'et', periods: [], people: [{ person: label, region: { id: null, status: 'unknown', support: [] } }], focus: label });
  const debts = userFact('debts', 1, 'Mul on võlad.');
  let draft = person('user', [debts]);
  const f = await fixture(t, () => draft, PERSON_DIALOGUE_STATE_VERSION);
  await f.run('Mul on võlad.', 'new');
  // The neighbour's turn: the model renames the user's fact and lists only the neighbour.
  draft = person('naabrimees', [{ ...debts, topic: 'rahamured' }, { ...userFact('neighbour help', 2, 'Naaber vajab abi.'), subject: 'other' }]);
  const second = await f.run('Naaber vajab abi.');
  const kept = (await f.row(second.id)).payload;
  assert.equal(kept.dialogueStateFallback, undefined);
  assert.equal(kept.dialogueState.version, PERSON_DIALOGUE_STATE_VERSION);
  assert.equal(kept.dialogueState.value.facts[0].topic, 'debts');
  assert.deepEqual(kept.dialogueState.value.people.map(entry => entry.person), ['naabrimees', 'user']);
  draft = { ...kept.dialogueState.value, focus: 'user' };
  const third = await f.run('Mul pole kusagil magada.');
  const next = (await f.row(third.id)).payload;
  assert.deepEqual(next.dialogue.previousState, kept.dialogueState.value);
  assert.equal(next.dialogueState.value.focus, 'user');
});

test('dialogue state DB (ADR-051): v4 records changes; the next turn sees current facts with ids; a broken model state still advances', async t => {
  const inputs = [];
  let draft = { new_facts: [{ topic: 'võlad', person: 'user', support: [{ turn: 1, quote: 'Mul on võlad.' }] }], superseded: [], needs: [], unknowns: [], periods: [], language_hint: 'et' };
  const f = await fixture(t, dialogue => { inputs.push(dialogue); return draft; }, FACT_STATE_VERSION);
  await f.run('Mul on võlad.', 'new');
  draft = { new_facts: [{ topic: 'võlad', person: 'user', support: [{ turn: 2, quote: 'Võlgu on 3000 eurot.' }] }], superseded: [{ fact: 'F1', by: 'N1' }],
    needs: [{ candidate: 'Võlanõustamine', based_on: ['N1'] }], unknowns: [], periods: [], language_hint: 'et' };
  const second = await f.run('Võlgu on 3000 eurot.');
  const kept = (await f.row(second.id)).payload;
  assert.equal(kept.dialogueStateFallback, undefined);
  assert.deepEqual(kept.dialogueState.value.facts.map(entry => [entry.id, entry.status]), [['F1', 'superseded'], ['F2', 'current']]);
  assert.deepEqual(kept.dialogueState.value.needs, [{ candidate: 'Võlanõustamine', based_on: ['F2'] }]);
  // The model sees the active view: the current fact with its id, not the replaced one.
  assert.deepEqual(inputs[1].previousState.facts.map(entry => entry.id), ['F1']);
  draft = 'broken';
  const third = await f.run('Mul pole kusagil magada.');
  const next = (await f.row(third.id)).payload;
  assert.deepEqual(inputs[2].previousState.facts.map(entry => entry.id), ['F2']);
  assert.equal(next.dialogueState.value.model.accepted, false);
  assert.deepEqual(next.dialogueState.sourceTurnIds.length, 3);
  assert.deepEqual(next.dialogueState.value.facts.map(entry => entry.id), ['F1', 'F2']);
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
  // A word-bounded age: the random ids in the dialogue can contain "67".
  assert.doesNotMatch(JSON.stringify(row.payload.dialogue), /\b67\b|Harku|abielus/);
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

test('M4-C real DB: eighth turn is retained, ninth goes on in a new topic of the same person without clipping', async t => {
  const f = await fixture(t);
  for (let i = 0; i < DIALOGUE_LIMITS.scopeTurns; i++) await f.run(`Pööre ${i}`, i ? 'same' : 'new');
  const before = await f.store.contextSummary(f.config, f.user.id, f.conv.id);
  await f.run('Liiga pikk jätk.');
  const after = await f.store.contextSummary(f.config, f.user.id, f.conv.id);
  assert.equal(f.calls.filter(c => c.stage === 'answer').length, 9);
  assert.deepEqual([before.scopes.length, after.scopes.length, after.scopes[1].userTurns, after.scopes[1].person, after.active.mode],
    [1, 2, 1, before.scopes[0].person, 'new']);
  assert.equal(after.scopes[0].userTurns, DIALOGUE_LIMITS.scopeTurns);
});

// ADR-070: the ninth message begins a new topic with the user's earlier statements, the last message, the full topic's
// last answer and its state, and the turn is stored, restored and continued like any other.
test('M4-C real DB (ADR-070): the ninth message carries the facts, the last message and the last answer into the new topic', async t => {
  const inputs = [];
  let draft = { new_facts: [{ topic: 'elukoht', person: 'ema', support: [{ turn: 1, quote: 'Minu ema elab Kose vallas' }] }], superseded: [], needs: [], unknowns: [], periods: [], language_hint: 'et' };
  const f = await fixture(t, dialogue => { inputs.push(dialogue); return draft; }, FACT_STATE_VERSION);
  const first = await f.run('Minu ema elab Kose vallas.', 'new');
  draft = { new_facts: [], superseded: [], needs: [], unknowns: [], periods: [], language_hint: 'et' };
  for (let i = 1; i < DIALOGUE_LIMITS.scopeTurns - 1; i++) await f.run(`Küsimus ${i}?`);
  draft = { new_facts: [{ topic: 'pension', person: 'ema', support: [{ turn: 8, quote: 'Ema pension on 600 eurot' }] }], superseded: [], needs: [{ candidate: 'Hooldekodu koht', based_on: ['F1'] }], unknowns: [], periods: [], language_hint: 'et' };
  const eighth = await f.run('Ema pension on 600 eurot.');
  draft = { new_facts: [{ topic: 'küsimus', person: 'ema', support: [{ turn: 3, quote: 'kui palju see maksab' }] }], superseded: [], needs: [], unknowns: [], periods: [], language_hint: 'et' };
  const ninth = await f.run('Aga kui palju see maksab?');
  const row = (await f.row(ninth.id)).payload, scope = (await f.row(first.id)).payload.context.scopeId;
  assert.deepEqual(row.dialogue.userTurns.map(turn => [turn.text, turn.carried ?? null]),
    [['ema: Minu ema elab Kose vallas', 'statements'], ['Ema pension on 600 eurot.', 'message'], ['Aga kui palju see maksab?', null]]);
  assert.match(row.query.text, /^ema: Minu ema elab Kose vallas\n\nEma pension on 600 eurot\.\n\nAga kui palju/u);
  // The answer model saw the full topic's last answer and its facts, anchored in the carried turns.
  assert.equal(row.dialogue.publishedAssistant.turnId, eighth.id);
  assert.deepEqual(inputs.at(-1).previousState.facts.map(entry => [entry.id, entry.support]),
    [['F1', [{ turn: 1, quote: 'Minu ema elab Kose vallas' }]], ['F2', [{ turn: 2, quote: 'Ema pension on 600 eurot' }]]]);
  assert.deepEqual(inputs.at(-1).previousState.needs, [{ candidate: 'Hooldekodu koht', based_on: ['F1'] }]);
  assert.deepEqual([row.previousDialogueState.carriedFrom.scopeId, row.previousDialogueState.scopeId, row.context.mode, row.contextAudit.selection.previousScopeFull],
    [scope, row.context.scopeId, 'new', scope]);
  // The new topic's own state goes on from it, and the stored turn is checked again as it is restored.
  assert.equal(row.dialogueStateFallback, undefined);
  assert.deepEqual(row.dialogueState.value.facts.map(entry => entry.id), ['F1', 'F2', 'F3']);
  assert.equal((await f.service.restore(await f.row(ninth.id))).context.userTurns, 3);
  draft = { new_facts: [], superseded: [], needs: [], unknowns: [], periods: [], language_hint: 'et' };
  const tenth = (await f.row((await f.run('Ja kes selle otsustab?')).id)).payload;
  assert.deepEqual([tenth.dialogue.userTurns.length, tenth.dialogue.publishedAssistant.turnId, tenth.previousDialogueState.sourceTurnIds.length, tenth.context.scopeId],
    [4, ninth.id, 3, row.context.scopeId]);
  assert.equal(f.calls.filter(c => c.stage === 'answer').length, 10);
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

// State v5 through the service: the real place check and scope of the retrieval adapter in one conversation, a planned
// answer per turn. Each turn checks that both search lanes and the saved state read one region for the person searched.
async function regionConversation(t) {
  const user = await db.user.create({ data: { email: `m4c-${randomUUID()}@example.invalid` } });
  const conv = await db.conversation.create({ data: { userId: user.id, role: 'CLIENT', metadata: { m4: true }, expiresAt: null } });
  const config = { id: randomUUID(), configHash: randomUUID(), tenant: 'm4c-test', mode: 'real', users: [user.id], documents: { doc: 'v1' },
    dialogueVersion: DIALOGUE_VERSION, dialogueStateVersion: REGION_STATE_VERSION, searchAssist: SEARCH_ASSIST_VERSION, recordCatalogue: RECORD_RETRIEVAL_VERSION,
    embedding: embeddingConfig({ embedding_mode: 'real', provider: 'openai', model: 'text-embedding-3-large', dimensions: 3072, endpoint: 'https://api.openai.com/v1/embeddings' }),
    model: 'gpt-5.6-luna', reasoning: 'low', maxInputTokens: 64000, maxOutputTokens: 1000, expiresAt: null, retentionHours: null,
    prices: { embeddingInput: 1, answerInput: 1, answerOutput: 1 }, budget: { attempts: 24, embeddingAttempts: 12, answerAttempts: 12, tokens: 1000000, nanoUsd: 1000000 } };
  t.after(async () => { await db.user.delete({ where: { id: user.id } }); await db.m4PilotLedger.deleteMany({ where: { id: config.id } }); });
  // A stand-in for EstNLTK and the municipal directory.
  const directory = [{ region: 'harku_vald', names: ['Harku vald', 'Harku'] }, { region: 'kose_vald', names: ['Kose vald', 'Kose'] }, { region: 'tartu_vald', names: ['Tartu vald'] }];
  const analyzer = { analyze: async words => words.map(word => { const lower = word.toLowerCase(); return `vmet${lower}${lower === 'vallas' ? ' vmetvald' : ''}`; }) };
  const runtime = runtimeAdapters(async () => config, user.id, { loadRegions: async () => directory, analyzer });
  const scopes = [], plans = [];
  const packet = { tenant: 'm4c-test', reference_map: { S1: { document_id: 'doc', document_version_id: 'v1', evidence_id: 'e1', pdf_pages: [1] } },
    evidence: [{ evidence_id: 'e1', source_text: 'Source', bibliography: { title: 'Source' } }], model_context: { evidence: [{ ref: 'S1', text: 'Source' }] } };
  const adapters = { preflight: async () => {}, canonical: async () => {}, dialogueStateContext: async () => ({ regions: directory }),
    checkedPlaces: (c, query, places) => runtime.checkedPlaces(c, query, places),
    search: async (c, query, vector, assist) => {
      const { scope, knowledgeRegion } = await runtime.searchScope(c, query, directory, assist?.variants || []);
      scopes.push({ person: scope.person ?? query.person, region: knowledgeRegion.region ?? null, state: scope.state,
        own: scope.region ?? null, source: knowledgeRegion.state });
      // As the retrieval adapter saves it: the turn's source scope with the catalogue (the next turn's follow-up reads it).
      return { ...packet, query_id: randomUUID(), record_context: { entries: [], scope: knowledgeRegion } };
    } };
  const unit = Array.from({ length: 3072 }, (_, i) => i === 0 ? 1 : 0);
  const service = new PilotService({ store: new PilotStore(db), readConfig: async () => config, adapters, call: async ({ stage, body }) => {
    const usage = { input: 20, output: stage === 'embedding' ? 0 : 10 };
    if (stage === 'embedding') return { value: Array.isArray(body.input) ? body.input.map(() => unit) : unit, usage, requestId: 'synthetic' };
    if (stage === 'plan') return { value: plans.shift(), usage, requestId: 'synthetic' };
    return { value: { kind: 'grounded', blocks: [{ text: 'Synthetic point', factual: true, refs: ['S1'] }], limitations: [], clarification: null,
      dialogue_state: { new_facts: [], superseded: [], needs: [], unknowns: [], periods: [], language_hint: 'et' } }, usage, requestId: 'synthetic' };
  } });
  const turn = async (question, contextMode, plan) => {
    plans.push({ language: 'et', ...plan });
    const result = await service.run(user.id, { question, contextMode, convId: conv.id, clientTurnKey: randomUUID(), language: 'et' });
    const saved_ = (await db.m4PilotTurn.findUnique({ where: { id: result.id } })).payload, value = saved_.dialogueState.value;
    // Codex 7.8: the answer model reads only the date of the state context; the server keeps the municipalities for its checks.
    assert.deepEqual(Object.keys(JSON.parse(saved_.requestAudit.body.input[0].content).dialogue.stateContext), ['asOfDateUTC']);
    assert.deepEqual(saved_.dialogueStateContext.regions, directory);
    const searched = scopes.at(-1), saved = value.people.find(entry => entry.person === searched.person);
    // The same turn: the catalogue and the knowledge lane (one knowledgeRegion) and the saved state read one region.
    // ADR-074: in a question about another municipality both lanes read the asked one, and the saved state is still
    // the person's own scope of that turn.
    assert.equal(searched.source.startsWith('question_') ? searched.own : searched.region, saved?.region.id ?? null);
    assert.equal(value.focus, searched.person);
    return { searched, assist: saved_.searchAssist, query: saved_.query, people: Object.fromEntries(value.people.map(entry => [entry.person, [entry.region.id, entry.region.status]])) };
  };
  return turn;
}

test('dialogue state DB (Codex J1-J3): in every turn both search filters and the saved person region are one reading', async t => {
  const turn = await regionConversation(t);
  // J2: one sentence negates the user's Kose, the next gives the mother's; the plan got the user's relation wrong.
  const first = await turn('Mina ei ela Kose vallas. Minu ema elab Kose vallas. Kuidas emale koduteenust saada?', 'new', { queries: ['Kose vald koduteenus'], person: 'ema',
    places: [{ turn: 1, quote: 'Minu ema elab Kose vallas', name: 'Kose vald', person: 'ema', relation: 'lives' },
      { turn: 1, quote: 'Mina ei ela Kose vallas', name: 'Kose vald', person: 'user', relation: 'lives' }] });
  assert.deepEqual([first.searched.region, first.people], ['kose_vald', { ema: ['kose_vald', 'reported'], user: [null, 'negated'] }]);
  // J1: a query that names Kose does not give the user the place the user negated.
  const second = await turn('Aga mina ise? Millist abi mina saan?', 'same', { queries: ['Kose vald toimetulekutoetus'], person: 'user', places: [] });
  assert.deepEqual([second.searched.region, second.searched.state, second.people.user], [null, 'region_required_after_negation', [null, 'negated']]);
  // A place in another script, linked to a word of the clause, is the user's new place in both.
  const third = await turn('Я живу в Харку.', 'same', { queries: ['Harku vald toimetulekutoetus'], person: 'user',
    places: [{ turn: 3, quote: 'Я живу в Харку', name: 'Harku vald', person: 'user', relation: 'lives' }] });
  assert.deepEqual([third.searched.region, third.people], ['harku_vald', { ema: ['kose_vald', 'reported'], user: ['harku_vald', 'reported'] }]);
});

test('dialogue state DB (Codex review of state v5, V1): a place change the plan left out is one decision for search and memory, and the next turn keeps it', async t => {
  const turn = await regionConversation(t);
  await turn('Elan Kose vallas ja mul on raske.', 'new', { queries: ['Kose vald toimetulek'], person: 'user',
    places: [{ turn: 1, quote: 'Elan Kose vallas', name: 'Kose vald', person: 'user', relation: 'lives' }] });
  // The plan names the user but leaves the negation out; its query still names Kose. The server reads the user's own negation.
  const left = await turn('Ma ei ela enam Kose vallas.', 'same', { queries: ['Kose vald toimetulekutoetus'], person: 'user', places: [] });
  assert.deepEqual([left.searched.region, left.people.user], [null, [null, 'negated']]);
  const next = await turn('Millist abi ma saan?', 'same', { queries: ['Kose vald sotsiaalabi'], person: 'user', places: [] });
  assert.deepEqual([next.searched.region, next.people.user], [null, [null, 'negated']]);
  // A partial plan with an unclear person: the mother's place is checked; the user's own first-person home it left out is read too.
  const partial = await turn('Ema elab Harku vallas. Ma elan nüüd Kose vallas.', 'same', { queries: ['Harku vald koduteenus'], person: 'unclear',
    places: [{ turn: 4, quote: 'Ema elab Harku vallas', name: 'Harku vald', person: 'ema', relation: 'lives' }] });
  assert.deepEqual([partial.searched.person, partial.searched.region, partial.people], ['user', 'kose_vald', { user: ['kose_vald', 'reported'], ema: ['harku_vald', 'reported'] }]);
  // A place the plan lists again from a message the state has read changes nothing.
  const again = await turn('Kui palju emale koduteenus maksab?', 'same', { queries: ['Harku vald koduteenuse hind'], person: 'ema',
    places: [{ turn: 4, quote: 'Ema elab Harku vallas', name: 'Harku vald', person: 'ema', relation: 'lives' }] });
  assert.deepEqual([again.searched.region, again.people.ema], ['harku_vald', ['harku_vald', 'reported']]);
});

test('dialogue state DB (ADR-074): a question about another municipality is searched there, its follow-up too, the saved residence stays, and a request about the user is the residence again', async t => {
  const turn = await regionConversation(t);
  await turn('Elan Kose vallas ja mul on raske.', 'new', { queries: ['Kose vald toimetulek'], person: 'user',
    places: [{ turn: 1, quote: 'Elan Kose vallas', name: 'Kose vald', person: 'user', relation: 'lives' }] });
  const planned = [{ turn: 2, quote: 'Kas Harku vallas saab koduteenust?', name: 'Harku vald', person: 'user', relation: 'other' }];
  const asked = await turn('Kas Harku vallas saab koduteenust?', 'same', { queries: ['Harku vald koduteenus'], person: 'user', places: planned });
  assert.deepEqual([asked.searched.source, asked.searched.region, asked.searched.own, asked.people.user], ['question_region', 'harku_vald', 'kose_vald', ['kose_vald', 'reported']]);
  // The turn record keeps the plan's own attributions beside the checked ones, and the server's reading of the mention.
  assert.deepEqual(asked.assist.plannedPlaces, planned);
  assert.deepEqual(asked.assist.places.map(item => [item.region, item.relation, item.asking]), [['harku_vald', 'other', true]]);
  // Codex F1: the follow-up names no municipality; the service hands on what the last answer was asked about.
  const price = await turn('Ja mis see maksab?', 'same', { queries: ['Harku vald koduteenuse hind'], person: 'user', places: [] });
  assert.deepEqual([price.searched.source, price.searched.region, price.query.askedRegions, price.query.askedPerson, price.people.user],
    ['question_region', 'harku_vald', ['harku_vald'], 'user', ['kose_vald', 'reported']]);
  // Codex's review of #345, F1: the same follow-up in the first person, beside a query about the user's own earlier request.
  const apply = await turn('Kuidas ma seda taotleda saan?', 'same', { queries: ['Harku vald koduteenuse taotlemine', 'Kose vald toimetulek'], person: 'user', places: [] });
  assert.deepEqual([apply.searched.source, apply.searched.region, apply.people.user], ['question_region', 'harku_vald', ['kose_vald', 'reported']]);
  // The user's own request: the plan's queries are not about the asked municipality any more.
  const own = await turn('Millist abi ma ise saan?', 'same', { queries: ['toimetulekutoetuse taotlemine'], person: 'user', places: [] });
  assert.deepEqual([own.searched.source, own.searched.region, own.people.user], ['person_region', 'kose_vald', ['kose_vald', 'reported']]);
  // After it nothing is handed on: a query that names the other municipality again does not move the search.
  const later = await turn('Ja kui palju see on?', 'same', { queries: ['Harku vald toimetulekutoetuse suurus'], person: 'user', places: [] });
  assert.deepEqual([later.searched.source, later.searched.region, later.query.askedRegions], ['person_region', 'kose_vald', undefined]);
  // The plan names no place: the server reads the mention as another one, and the record shows the plan gave none.
  const bare = await turn('Kust leian Harku valla koduteenuse taotluse?', 'same', { queries: ['Harku valla koduteenuse taotlus'], person: 'user', places: [] });
  assert.deepEqual([bare.searched.source, bare.searched.region, bare.people.user], ['question_region', 'harku_vald', ['kose_vald', 'reported']]);
  assert.deepEqual([bare.assist.plannedPlaces, bare.assist.places.map(item => [item.reason, item.asking])], [[], [['unattributed_other_mention', true]]]);
  // Codex F2: a place of work, with a plan whose only query names it.
  const work = await turn('Töötan Harku vallas. Millist koduteenust ma saan?', 'same', { queries: ['Harku vald koduteenus'], person: 'user',
    places: [{ turn: 8, quote: 'Töötan Harku vallas', name: 'Harku vald', person: 'user', relation: 'other' }] });
  assert.deepEqual([work.searched.source, work.searched.region, work.people.user], ['person_region', 'kose_vald', ['kose_vald', 'reported']]);
  assert.deepEqual(work.assist.places.map(item => [item.region, item.relation, item.asking, item.reason ?? null]), [['harku_vald', 'other', false, null]]);
});

test('dialogue state DB (ADR-074, Codex\'s review of #345, F2): another person\'s request is not a follow-up of the user\'s question about another municipality', async t => {
  const turn = await regionConversation(t);
  await turn('Elan Kose vallas.', 'new', { queries: ['Kose vald toimetulek'], person: 'user', places: [{ turn: 1, quote: 'Elan Kose vallas', name: 'Kose vald', person: 'user', relation: 'lives' }] });
  await turn('Mu ema elab Tartu vallas.', 'same', { queries: ['Tartu vald koduteenus'], person: 'ema', places: [{ turn: 2, quote: 'Mu ema elab Tartu vallas', name: 'Tartu vald', person: 'ema', relation: 'lives' }] });
  const asked = await turn('Kas Harku vallas saab koduteenust?', 'same', { queries: ['Harku vald koduteenus'], person: 'user',
    places: [{ turn: 3, quote: 'Kas Harku vallas saab koduteenust?', name: 'Harku vald', person: 'user', relation: 'other' }] });
  assert.deepEqual([asked.searched.source, asked.searched.region, asked.searched.person], ['question_region', 'harku_vald', 'user']);
  // The plan reads the mother and still writes a query about the user's earlier question.
  const hers = await turn('Aga millist koduteenust ema saab?', 'same', { queries: ['Tartu vald koduteenuse tingimused', 'Harku vald koduteenuse hind'], person: 'ema', places: [] });
  assert.deepEqual([hers.searched.source, hers.searched.region, hers.searched.person, hers.query.askedPerson], ['person_region', 'tartu_vald', 'ema', 'user']);
  assert.deepEqual(hers.people, { user: ['kose_vald', 'reported'], ema: ['tartu_vald', 'reported'] });
});
