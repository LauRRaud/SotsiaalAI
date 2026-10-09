import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { PilotStore, openTurn } from '../lib/rag-v2/pilot/store.js';
import { PilotService } from '../lib/rag-v2/pilot/service.js';
import { isLeanTurn } from '../lib/rag-v2/pilot/lean-turn.js';
import { digest } from '../lib/rag-v2/pilot/contracts.js';
import { DIALOGUE_VERSION, DIALOGUE_LIMITS } from '../lib/rag-v2/pilot/dialogue.js';
import { embeddingConfig } from '../lib/rag-v2/search/embedding.js';
import { DIALOGUE_STATE_VERSION, PERSON_DIALOGUE_STATE_VERSION, FACT_STATE_VERSION, REGION_STATE_VERSION } from '../lib/rag-v2/pilot/dialogue-state.js';
import { SEARCH_ASSIST_VERSION } from '../lib/rag-v2/pilot/search-assist.js';
import { runtimeAdapters } from '../lib/rag-v2/pilot/retrieval.js';
import { RECORD_RETRIEVAL_VERSION } from '../lib/rag-v2/search/structured-record-source.js';
import { recordStoredTurns, PLACEHOLDERS } from '../lib/rag-v2/pilot/history-backfill.js';

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

// fullTopic (ADR-105): a test that fills a topic of 30 messages needs a budget for them, and its earlier turns are moved
// out of the last minute so that the chat's limit of twelve turns a minute does not stop it.
async function fixture(t, stateFor = null, stateVersion = DIALOGUE_STATE_VERSION, { fullTopic = false } = {}) {
  const user = await db.user.create({ data: { email: `m4c-${randomUUID()}@example.invalid` } });
  const conv = await db.conversation.create({ data: { userId: user.id, role: 'CLIENT', metadata: { m4: true }, expiresAt: null } });
  const config = { id: randomUUID(), configHash: randomUUID(), tenant: 'm4c-test', mode: 'real', users: [user.id], documents: { doc: 'v1' },
    dialogueVersion: DIALOGUE_VERSION, ...(stateFor ? { dialogueStateVersion: stateVersion } : {}),
    embedding: embeddingConfig({ embedding_mode: 'real', provider: 'openai', model: 'text-embedding-3-large', dimensions: 3072, endpoint: 'https://api.openai.com/v1/embeddings' }),
    model: 'gpt-5.6-luna', reasoning: 'low', maxInputTokens: 64000, maxOutputTokens: 1000, expiresAt: null, retentionHours: null,
    prices: { embeddingInput: 1, answerInput: 1, answerOutput: 1 }, budget: fullTopic ? { attempts: 4 * DIALOGUE_LIMITS.scopeTurns, embeddingAttempts: 2 * DIALOGUE_LIMITS.scopeTurns, answerAttempts: 2 * DIALOGUE_LIMITS.scopeTurns, tokens: 10000000, nanoUsd: 10000000 }
      : { attempts: 24, embeddingAttempts: 12, answerAttempts: 12, tokens: 1000000, nanoUsd: 1000000 } };
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
  const run = async (question, contextMode = 'same', extra = {}) => {
    if (fullTopic) await db.chatTurn.updateMany({ where: { userId: user.id }, data: { startedAt: new Date(Date.now() - 120000) } });
    return service.run(user.id, input(question, contextMode, extra));
  };
  const row = async id => openTurn(await turnRows.findUnique({ where: { id } }));
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

test('ADR-107 real DB: the turn keeps the signed-in role and the answer model reads it; a role outside the list is refused', async t => {
  const f = await fixture(t);
  const first = await f.run('Olen valla sotsiaaltöötaja. Kust ma alustan?', 'new', { userRole: 'specialist' });
  const row = await f.row(first.id), sent = JSON.parse(f.calls.find(call => call.stage === 'answer').body.input[0].content);
  assert.deepEqual([row.payload.userRole, row.payload.dialogue.userRole, sent.dialogue.userRole], ['specialist', 'specialist', 'specialist']);
  // A turn without a role says nothing of it, as before.
  const second = await f.run('Aga edasi?'), plain = await f.row(second.id);
  assert.deepEqual([plain.payload.userRole, 'userRole' in plain.payload.dialogue], [undefined, false]);
  await assert.rejects(f.run('Kes ma olen?', 'same', { userRole: 'admin' }), { code: 'invalid_user_role' });
  // "role" itself is still no field of a turn.
  await assert.rejects(f.run('Kes ma olen?', 'same', { role: 'specialist' }), { code: 'invalid_shape' });
});

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

test('M4-C real DB: the last turn of a full topic is retained, the next goes on in a new topic of the same person without clipping', async t => {
  const f = await fixture(t, null, DIALOGUE_STATE_VERSION, { fullTopic: true });
  for (let i = 0; i < DIALOGUE_LIMITS.scopeTurns; i++) await f.run(`Pööre ${i}`, i ? 'same' : 'new');
  const before = await f.store.contextSummary(f.config, f.user.id, f.conv.id);
  await f.run('Liiga pikk jätk.');
  const after = await f.store.contextSummary(f.config, f.user.id, f.conv.id);
  assert.equal(f.calls.filter(c => c.stage === 'answer').length, DIALOGUE_LIMITS.scopeTurns + 1);
  assert.deepEqual([before.scopes.length, after.scopes.length, after.scopes[1].userTurns, after.scopes[1].person, after.active.mode],
    [1, 2, 1, before.scopes[0].person, 'new']);
  assert.equal(after.scopes[0].userTurns, DIALOGUE_LIMITS.scopeTurns);
});

// ADR-070: the message after a full topic begins a new topic with the user's earlier statements, the last message, the
// full topic's last answer and its state, and the turn is stored, restored and continued like any other. "eighth" and
// "ninth" are the names the topic of eight messages gave them: the full topic's last message and the one after it.
test('M4-C real DB (ADR-070): the message after a full topic carries the facts, the last message and the last answer into the new topic', async t => {
  const inputs = [];
  let draft = { new_facts: [{ topic: 'elukoht', person: 'ema', support: [{ turn: 1, quote: 'Minu ema elab Kose vallas' }] }], superseded: [], needs: [], unknowns: [], periods: [], language_hint: 'et' };
  const f = await fixture(t, dialogue => { inputs.push(dialogue); return draft; }, FACT_STATE_VERSION, { fullTopic: true });
  const first = await f.run('Minu ema elab Kose vallas.', 'new');
  draft = { new_facts: [], superseded: [], needs: [], unknowns: [], periods: [], language_hint: 'et' };
  for (let i = 1; i < DIALOGUE_LIMITS.scopeTurns - 1; i++) await f.run(`Küsimus ${i}?`);
  draft = { new_facts: [{ topic: 'pension', person: 'ema', support: [{ turn: DIALOGUE_LIMITS.scopeTurns, quote: 'Ema pension on 600 eurot' }] }], superseded: [], needs: [{ candidate: 'Hooldekodu koht', based_on: ['F1'] }], unknowns: [], periods: [], language_hint: 'et' };
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
  assert.equal(f.calls.filter(c => c.stage === 'answer').length, DIALOGUE_LIMITS.scopeTurns + 2);
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

test('M4-C real DB: an expired head with an answer goes on from its record, one without cannot resurrect an older person; null retention remains null', async t => {
  const f = await fixture(t); await f.run('Vana inimene.', 'new');
  const newer = await f.run('Uus inimene.', 'new_person');
  const before = await f.row(newer.id);
  assert.equal(before.expiresAt, null);
  // A request purges at most once a minute (ADR-094, step 5): after this one the next message's request does not.
  await f.store.purgeDue();
  await db.m4PilotTurn.update({ where: { id: newer.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  // ADR-094: the head's audit row has expired, its record has not. The message goes on with the head's person, read
  // from the record, never with the older one. The expired row is gone for the turn though it is still stored.
  const next = await f.row((await f.run('Aga hind?')).id);
  assert.equal(await db.m4PilotTurn.count({ where: { id: newer.id } }), 1, 'the expired row is still stored');
  await f.store.purge();
  assert.equal(await db.m4PilotTurn.count({ where: { id: newer.id } }), 0, 'the expired row was purged');
  assert.deepEqual(next.payload.dialogue.userTurns.map(turn => turn.text), ['Uus inimene.', 'Aga hind?']);
  assert.deepEqual([next.payload.context.scopeId, next.payload.context.personId], [before.payload.context.scopeId, before.payload.context.personId]);
  assert.equal(next.payload.dialogue.publishedAssistant.turnId, newer.id);
  assert.equal(f.calls.length, 6);
  // A head that got no answer has no record. Once its row has expired nothing names its person, and "same" fails
  // rather than going back to an older one.
  f.fail(true);
  await assert.rejects(f.run('Kolmas inimene.', 'new_person'));
  f.fail(false);
  const failed = await turnRows.findFirst({ where: { pilotId: f.config.id }, orderBy: { createdAt: 'desc' } });
  assert.equal(failed.payload.question, 'Kolmas inimene.');
  await db.m4PilotTurn.update({ where: { id: failed.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  const calls = f.calls.length;
  await assert.rejects(f.run('Aga hind?'), { code: 'context_unavailable' });
  assert.equal(f.calls.length, calls);
  const fresh = await f.run('Alustan uuesti.', 'new_person');
  assert.equal((await f.row(fresh.id)).payload.dialogue.userTurns.length, 1);
});

// State v5 through the service: the real place check and scope of the retrieval adapter in one conversation, a planned
// answer per turn. Each turn checks that both search lanes and the saved state read one region for the person searched.
async function regionConversation(t, { clarifications = [], requests = null, select = false } = {}) {
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
      // The selection, as the real search asks for it: after the vectors have come, once the candidates are fused (only
      // where a test asks for it).
      if (select) { await vector; await assist?.vectors; await assist?.rerank?.([{ id: 'P1', title: 'Source', text: 'Source' }]); }
      // As the retrieval adapter saves it: the turn's source scope with the catalogue (the next turn's follow-up reads it).
      return { ...packet, query_id: randomUUID(), record_context: { entries: [], scope: knowledgeRegion } };
    } };
  const unit = Array.from({ length: 3072 }, (_, i) => i === 0 ? 1 : 0);
  const service = new PilotService({ store: new PilotStore(db), readConfig: async () => config, adapters, call: async ({ stage, body }) => {
    const usage = { input: 20, output: stage === 'embedding' ? 0 : 10 };
    if (stage === 'embedding') return { value: Array.isArray(body.input) ? body.input.map(() => unit) : unit, usage, requestId: 'synthetic' };
    if (stage === 'plan' || stage === 'rerank') requests?.push({ stage, input: JSON.parse(body.input[0].content) });
    if (stage === 'plan') return { value: plans.shift(), usage, requestId: 'synthetic' };
    if (stage === 'rerank') return { value: { useful: ['P1'] }, usage, requestId: 'synthetic' };
    return { value: { kind: 'grounded', blocks: [{ text: 'Synthetic point', factual: true, refs: ['S1'] }], limitations: [], clarification: clarifications.shift() ?? null,
      dialogue_state: { new_facts: [], superseded: [], needs: [], unknowns: [], periods: [], language_hint: 'et' } }, usage, requestId: 'synthetic' };
  } });
  const turn = async (question, contextMode, plan) => {
    plans.push({ language: 'et', ...plan });
    const result = await service.run(user.id, { question, contextMode, convId: conv.id, clientTurnKey: randomUUID(), language: 'et' });
    const saved_ = (await turnRows.findUnique({ where: { id: result.id } })).payload, value = saved_.dialogueState.value;
    // Codex 7.8: the answer model reads only the date of the state context; the server keeps the municipalities for its checks.
    assert.deepEqual(Object.keys(JSON.parse(saved_.requestAudit.body.input[0].content).dialogue.stateContext), ['asOfDateUTC']);
    assert.deepEqual(saved_.dialogueStateContext.regions, directory);
    const searched = scopes.at(-1), saved = value.people.find(entry => entry.person === searched.person);
    // The same turn: the catalogue and the knowledge lane (one knowledgeRegion) and the saved state read one region.
    // ADR-074: in a question about another municipality both lanes read the asked one, and the saved state is still
    // the person's own scope of that turn. ADR-081: the same where nobody's place is decided and the municipality comes
    // from the plan's queries or from the question before.
    assert.equal(/^(question_|search_plan_|continued_)/u.test(searched.source) ? searched.own : searched.region, saved?.region.id ?? null);
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

test('dialogue state DB (ADR-078): with a plan\'s queries the search text is the current message; without queries it is the scope\'s text', async t => {
  const turn = await regionConversation(t);
  const messages = ['Elan Kose vallas ja mul on raske.', 'Kui suur on toimetulekupiir?', 'Kas hooldekodu kohatasu võib nõuda lastelt?', 'Vabandust, elan hoopis Harku vallas.', 'Ja mis see maksab?'];
  const lives = [{ turn: 1, quote: 'Elan Kose vallas', name: 'Kose vald', person: 'user', relation: 'lives' }];
  // The first message: one message, the text is the message either way.
  const first = await turn(messages[0], 'new', { queries: ['Kose vald toimetulek'], person: 'user', places: lives });
  assert.deepEqual([first.query.text, first.query.textBasis ?? null, first.assist.queries], [messages[0], null, ['Kose vald toimetulek']]);
  // A later message with a plan: the current message alone; the scope's messages and the residence stay.
  const second = await turn(messages[1], 'same', { queries: ['toimetulekupiiri suurus'], person: 'user', places: [] });
  assert.deepEqual([second.query.text, second.query.question, second.query.textBasis], [messages[1], messages[1], 'current_message']);
  assert.deepEqual([second.query.scopeTurns.map(item => item.text), second.searched.region, second.people.user], [messages.slice(0, 2), 'kose_vald', ['kose_vald', 'reported']]);
  const third = await turn(messages[2], 'same', { queries: ['täisealise lapse ülalpidamiskohustus', messages[2]], person: 'user', places: [] });
  assert.deepEqual([third.query.text, third.query.textBasis], [messages[2], 'current_message']);
  assert.doesNotMatch(third.query.text, /toimetulekupiir|Kose/u);
  // A planned query that only repeats the current message is not searched twice.
  assert.deepEqual(third.assist.queries, ['täisealise lapse ülalpidamiskohustus']);
  // A plan that writes no query (a bare correction, ADR-072): the scope's text, as before.
  const moved = [{ turn: 4, quote: 'elan hoopis Harku vallas', name: 'Harku vald', person: 'user', relation: 'lives' }];
  const fourth = await turn(messages[3], 'same', { queries: [], person: 'user', places: moved });
  assert.deepEqual([fourth.query.text, fourth.query.textBasis ?? null, fourth.assist.queries], [messages.slice(0, 4).join('\n\n'), null, []]);
  assert.deepEqual(fourth.people.user, ['harku_vald', 'reported']);
  // A plan that fails: the scope's text, and the failure is in the record.
  const fifth = await turn(messages[4], 'same', { queries: 'not a list' });
  assert.deepEqual([fifth.query.text, fifth.query.textBasis ?? null, fifth.assist.failures.map(failure => failure.stage)], [messages.join('\n\n'), null, ['plan']]);
});

// Codex's review of #357-#364 (docs/audits/rag-v2-pr357-364-review-2026-10-04.md in the main checkout), F1, its probe's messages and plan.
test('dialogue state DB (ADR-084, Codex F1): the plan is searched as planned; the query about the circumstances an earlier message gave is not left out', async t => {
  const turn = await regionConversation(t);
  // The first message gives the circumstances and asks nothing; the plan of the second wrote one query for each message.
  await turn('Mul on raske liikumispuue ja vajan eluruumi kohandamist.', 'new', { queries: ['Liikumispuudega inimese eluruumi kohandamine'], person: 'user', places: [] });
  const planned = ['Liikumispuudega inimese eluruumi kohandamise toetus', 'Rahalise abi taotlemise tingimused'];
  const second = await turn('Millist rahalist abi saan taotleda?', 'same', { queries: planned, person: 'user', places: [] });
  assert.deepEqual([second.assist.queries, 'droppedQueries' in second.assist], [planned, false]);
  // The search text is the current message (ADR-078); the adaptation reaches the search through the plan's query.
  // Under ADR-080 that query was left out and no search text had a word of the disability or the adaptation.
  assert.deepEqual([second.query.text, second.query.textBasis], ['Millist rahalist abi saan taotleda?', 'current_message']);
  assert.match([second.query.text, ...second.assist.queries].join(' | '), /liikumispuu.*eluruumi kohand/iu);
  // The pattern ADR-080 was written for, one query per message of unrelated questions, is searched whole as well:
  // which passages serve the current request is the selection's to judge.
  const unrelated = ['eluruumi kohandamise toetus', 'rahalise abi taotlemine', 'abivajavast lapsest teatamise kohustus'];
  const third = await turn('Kes peab teatama abivajavast lapsest ja kuhu?', 'same', { queries: unrelated, person: 'user', places: [] });
  assert.deepEqual([third.assist.queries, 'droppedQueries' in third.assist], [unrelated, false]);
});

test('dialogue state DB (ADR-081): a follow-up that points back is searched where the question before it was, also when the plan names no municipality', async t => {
  const turn = await regionConversation(t);
  const question = 'Kas Harku vallas saab koduteenust?', unnamed = ['koduteenuse tasu kujunemine inimese omaosalus'];
  // No residence given: the plan's query decides the question's municipality and the follow-up goes on with it.
  const asked = await turn(question, 'new', { queries: ['Harku vald koduteenus'], person: 'user', places: [{ turn: 1, quote: question, name: 'Harku vald', person: 'user', relation: 'other' }] });
  assert.deepEqual([asked.searched.source, asked.searched.region, asked.searched.own], ['search_plan_region', 'harku_vald', null]);
  const price = await turn('Ja mis see maksab?', 'same', { queries: unnamed, person: 'user', places: [] });
  assert.deepEqual([price.searched.source, price.searched.region, price.searched.own, price.query.askedRegions, price.query.askedPerson],
    ['continued_region', 'harku_vald', null, ['harku_vald'], 'user']);
  // The user gives a home: the search is the user's own, and nothing of the question before is the residence.
  const home = await turn('Elan Kose vallas. Millist abi ma saan?', 'same', { queries: ['Kose vald sotsiaalabi'], person: 'user',
    places: [{ turn: 3, quote: 'Elan Kose vallas', name: 'Kose vald', person: 'user', relation: 'lives' }] });
  assert.deepEqual([home.searched.source, home.searched.region, home.people.user], ['person_mentioned_region', 'kose_vald', ['kose_vald', 'reported']]);
  // With a residence: the question about Harku, and the follow-up with the kind of plan the run of 04.10 recorded.
  const again = await turn(question, 'same', { queries: ['Harku vald koduteenus'], person: 'user', places: [{ turn: 4, quote: question, name: 'Harku vald', person: 'user', relation: 'other' }] });
  assert.deepEqual([again.searched.source, again.searched.region], ['question_region', 'harku_vald']);
  const cost = await turn('Ja mis see mulle maksma läheb?', 'same', { queries: unnamed, person: 'user', places: [] });
  assert.deepEqual([cost.searched.source, cost.searched.region, cost.people.user], ['question_region', 'harku_vald', ['kose_vald', 'reported']]);
  // The user's own request points back at nothing: the residence, with the same kind of plan.
  const own = await turn('Millist abi ma ise saan?', 'same', { queries: ['toimetulekutoetuse taotlemine'], person: 'user', places: [] });
  assert.deepEqual([own.searched.source, own.searched.region, own.query.askedRegions], ['person_region', 'kose_vald', ['harku_vald']]);
});

// ADR-093: under a plan that keeps no full audit every turn is stored lean when it is published, and the next turn of
// the conversation is built from those lean rows: the earlier circumstances, the earlier answer and the earlier state.
test('ADR-093 real DB: a dialogue goes on from lean turns as it does from whole ones', async t => {
  const f = await fixture(t);
  f.config.auditDays = 0;
  const first = await f.run('Olen 67, elan Harkus ja küsin koduteenuse kohta.', 'new');
  await f.run('Millist abi kirjeldatakse?'); const third = await f.run('Aga teenuse ulatus?');
  const fourth = await f.run('Selgita teist punkti.');
  for (const id of [first.id, third.id, fourth.id]) {
    const stored = await turnRows.findUnique({ where: { id } });
    assert(isLeanTurn(stored));
    for (const key of ['vector', 'dialogue', 'previousDialogueState', 'dialogueStateContext']) assert.equal(key in stored.payload, false, key);
    assert.equal('body' in stored.payload.requestAudit, false);
  }
  const row = await f.row(fourth.id);
  assert.match(row.payload.query.text, /Olen 67, elan Harkus/);
  assert.doesNotMatch(row.payload.query.text, /Synthetic second point/);
  // What the model was given for the fourth turn: the third turn's published answer, read from its lean row.
  const sent = JSON.parse(f.calls.filter(call => call.stage === 'answer').at(-1).body.input[0].content).dialogue;
  assert.equal(sent.userTurns.length, 4);
  assert.equal(sent.publishedAssistant.turnId, third.id);
  assert.equal(sent.publishedAssistant.blocks[1].point, 2);
  assert.equal(sent.publishedAssistant.blocks[1].historicalReferences[0], `${third.id}/S1`);
  assert.deepEqual(f.calls.map(c => c.stage), ['embedding', 'answer', 'embedding', 'answer', 'embedding', 'answer', 'embedding', 'answer']);
  // Each lean turn restores for the history, and a repeat of a request makes no call.
  assert.equal((await f.service.restore(row)).context.userTurns, 4);
  assert.deepEqual((await f.service.restore(await f.row(first.id))).sources.map(source => [source.ref, source.used]), [['S1', true]]);
});

test('ADR-093 real DB: the dialogue state is carried on from a lean turn, and a lean turn with a state restores without being projected again', async t => {
  const initial = dialogueState([userFact('living', 1, 'Elan üksi.'), userFact('work', 1, 'Tööd ei ole.')]);
  let draft = initial;
  const f = await fixture(t, () => draft);
  f.config.auditDays = 0;
  const first = await f.run('Elan üksi. Tööd ei ole.', 'new');
  const corrected = structuredClone(initial);
  corrected.facts[1].status = 'superseded'; corrected.facts[1].superseded_by = 3;
  corrected.facts.push(userFact('work', 2, 'Nüüd töötan.'));
  draft = corrected;
  const correction = await f.run('Nüüd töötan.', 'correction');
  const stored = await turnRows.findUnique({ where: { id: first.id } });
  assert(isLeanTurn(stored));
  assert.ok(stored.payload.dialogueState, 'the state stays with the lean turn');
  assert.equal(stored.payload.lean.proved.dialogueState, digest(stored.payload.dialogueState));
  // The correction's request carried the first turn's state as the previous one, read from the lean row.
  const sent = JSON.parse(f.calls.filter(call => call.stage === 'answer').at(-1).body.input[0].content).dialogue;
  assert.ok(sent.previousState, 'a previous state was sent');
  for (const turn of [first, correction]) assert.equal((await f.service.restore(await f.row(turn.id))).state, 'completed');
  // A lean turn whose state was changed afterwards is refused.
  const kept = (await asStored.findUnique({ where: { id: first.id } })).payload;
  await db.m4PilotTurn.update({ where: { id: first.id }, data: { payload: { ...kept, dialogueState: { ...kept.dialogueState, changed: true } } } });
  await assert.rejects(async () => f.service.restore(await f.row(first.id)), { code: 'lean_turn_changed' });
});

// ADR-094, step 2: the dialogue goes on from the conversation's records when the audit rows cannot be read: after a
// plan change (a corpus increment, a release that needs a new plan) and after the rows are gone.
// Another plan takes over as a renewed plan does: a new id and hash, the same ledger.
const changePlan = (t, f) => {
  const ledger = f.config.budgetLedger ?? f.config.id;
  Object.assign(f.config, { id: randomUUID(), configHash: randomUUID(), budgetLedger: ledger });
  t.after(() => db.m4PilotLedger.deleteMany({ where: { id: ledger } }));
};
test('ADR-094 real DB: after a plan change the next message continues the topic from the records: user turns, earlier answer and state', async t => {
  const initial = dialogueState([userFact('living', 1, 'Elan üksi.'), userFact('work', 1, 'Tööd ei ole.')]);
  let draft = initial;
  const f = await fixture(t, () => draft);
  const first = await f.run('Elan üksi. Tööd ei ole.', 'new');
  const corrected = structuredClone(initial);
  corrected.facts[1].status = 'superseded'; corrected.facts[1].superseded_by = 3;
  corrected.facts.push(userFact('work', 2, 'Nüüd töötan.'));
  draft = corrected;
  const correction = await f.run('Nüüd töötan.', 'correction');
  const scope = (await f.row(first.id)).payload.context;
  // Another plan: none of the rows above belongs to it.
  changePlan(t, f);
  // The composer reads the active topic from the records, so its next message is sent as a continuation.
  const summary = await f.store.contextSummary(f.config, f.user.id, f.conv.id);
  assert.deepEqual([summary.active?.scopeId, summary.active?.userTurns, summary.unavailable, summary.scopes.length], [scope.scopeId, 2, false, 1]);
  const third = await f.row((await f.run('Selgita teist punkti.')).id);
  assert.deepEqual(third.payload.dialogue.userTurns.map(turn => [turn.text, turn.mode]), [['Elan üksi. Tööd ei ole.', 'new'], ['Nüüd töötan.', 'correction'], ['Selgita teist punkti.', 'same']]);
  assert.deepEqual([third.payload.context.scopeId, third.payload.context.personId, third.payload.context.revision, third.payload.context.correctionRevision], [scope.scopeId, scope.personId, 3, 1]);
  assert.equal(third.payload.contextAudit.selection.headFromEarlierPlan, undefined);
  // The earlier answer and the state came from the correction's record.
  assert.equal(third.payload.dialogue.publishedAssistant.turnId, correction.id);
  assert.equal(third.payload.dialogue.publishedAssistant.blocks[1].historicalReferences[0], `${correction.id}/S1`);
  assert.deepEqual(third.payload.dialogue.previousState, corrected);
  assert.deepEqual(third.payload.previousDialogueState.value, corrected);
  assert.match(third.payload.query.text, /Elan üksi\. Tööd ei ole\./u);
  // One answer call a turn (this fixture's packet needs no embedding): the continuation made no other call.
  assert.deepEqual(f.calls.map(call => call.stage), ['answer', 'answer', 'answer']);
  // The turn of the new plan restores, and the one after it goes on from its row and the two records.
  assert.equal((await f.service.restore(third)).context.userTurns, 3);
  const fourth = await f.row((await f.run('Aga hind?')).id);
  assert.deepEqual([fourth.payload.dialogue.userTurns.length, fourth.payload.dialogue.publishedAssistant.turnId, fourth.payload.context.revision], [4, third.id, 4]);
});

test('ADR-094 real DB: the dialogue goes on when the audit rows are gone, also past a turn that got no answer', async t => {
  const f = await fixture(t, () => dialogueState([userFact('living', 1, 'Elan üksi.')]));
  await f.run('Elan üksi.', 'new');
  f.fail(true);
  await assert.rejects(f.run('See ebaõnnestub.'));
  f.fail(false);
  const third = await f.run('Millist abi kirjeldatakse?');
  assert.equal((await f.row(third.id)).payload.dialogue.userTurns.length, 3);
  // Every audit row of the conversation ends (a retention time, a sweep): the records stay with the conversation.
  assert.equal((await db.m4PilotTurn.deleteMany({ where: { pilotId: f.config.id } })).count, 3);
  assert.equal(await db.conversationMessage.count({ where: { conversationId: f.conv.id } }), 4);
  const fourth = await f.row((await f.run('Aga teenuse ulatus?')).id);
  // The turn without an answer is still one of the topic's user turns: the third turn's record lists it.
  assert.deepEqual(fourth.payload.dialogue.userTurns.map(turn => turn.text), ['Elan üksi.', 'See ebaõnnestub.', 'Millist abi kirjeldatakse?', 'Aga teenuse ulatus?']);
  assert.equal(fourth.payload.dialogue.publishedAssistant.turnId, third.id);
  assert.ok(fourth.payload.previousDialogueState, 'the state went on from the third turn\'s record');
  assert.equal(fourth.payload.previousDialogueState.sourceTurnIds.length, 3);
  assert.equal(fourth.state, 'completed');
});

test('ADR-094 real DB: a record\'s state of another state version is not memory; the turn goes on without it', async t => {
  const f = await fixture(t, () => dialogueState([userFact('living', 1, 'Elan üksi.')]));
  const first = await f.run('Elan üksi.', 'new');
  // The record's state says another version (as after a plan that changes the state's form), and the plan changes.
  const message = await db.conversationMessage.findFirst({ where: { conversationId: f.conv.id, role: 'ASSISTANT' } });
  const record = message.metadata.m4History;
  await db.conversationMessage.update({ where: { id: message.id }, data: { metadata: { ...message.metadata, m4History: { ...record, dialogue: { ...record.dialogue, state: { ...record.dialogue.state, version: 'rag-v2/earlier-state' } } } } } });
  changePlan(t, f);
  const second = await f.row((await f.run('Millist abi kirjeldatakse?')).id);
  assert.deepEqual([second.state, second.payload.dialogue.userTurns.length, second.payload.dialogue.publishedAssistant.turnId, second.payload.previousDialogueState], ['completed', 2, first.id, null]);
});

test('ADR-094 real DB: turns published with placeholders are continued after a plan change once their records are made from their rows', async t => {
  const f = await fixture(t, () => dialogueState([userFact('living', 1, 'Elan üksi.')]));
  const first = await f.run('Elan üksi.', 'new'), second = await f.run('Millist abi kirjeldatakse?');
  const messages = await db.conversationMessage.findMany({ where: { conversationId: f.conv.id } });
  // The first turn as published before ADR-094 (placeholders); the second as its first step published it (a record
  // without the topic's user turns).
  for (const message of messages.filter(item => item.metadata.m4TurnId === first.id)) await db.conversationMessage.update({ where: { id: message.id }, data: { content: PLACEHOLDERS[message.role], metadata: { m4TurnId: first.id } } });
  const answer = messages.find(item => item.metadata.m4TurnId === second.id && item.role === 'ASSISTANT'), { userTurns: _turns, ...dialogue } = answer.metadata.m4History.dialogue;
  await db.conversationMessage.update({ where: { id: answer.id }, data: { metadata: { ...answer.metadata, m4History: { ...answer.metadata.m4History, dialogue } } } });
  const done = await recordStoredTurns(db, { where: { pilotId: f.config.id } });
  assert.deepEqual([done.turns, done.made, done.completed, done.already, done.otherContent, done.failed], [2, 1, 1, 0, 0, {}]);
  const restored = await db.conversationMessage.findMany({ where: { conversationId: f.conv.id } });
  const byId = list => Object.fromEntries(list.map(message => [message.id, [message.content, message.metadata]]));
  assert.deepEqual(byId(restored), byId(messages), 'the records are the ones publication writes');
  changePlan(t, f);
  const third = await f.row((await f.run('Aga teenuse ulatus?')).id);
  assert.deepEqual(third.payload.dialogue.userTurns.map(turn => turn.text), ['Elan üksi.', 'Millist abi kirjeldatakse?', 'Aga teenuse ulatus?']);
  assert.equal(third.payload.dialogue.publishedAssistant.turnId, second.id);
  assert.ok(third.payload.previousDialogueState);
});

// ADR-094, step 3: a plan gives its audit rows a retention time. The row ends then; the conversation lives by the
// published rule, 90 days from its last activity, and goes on from its own messages.
test('ADR-094 real DB: with a retention time the audit row expires, the conversation lives 90 days from its last activity and goes on from its records', async t => {
  const f = await fixture(t, () => dialogueState([userFact('living', 1, 'Elan üksi.')]));
  f.config.retentionHours = 24;
  const hour = 3600000, day = 24 * hour, started = Date.now();
  const first = await f.run('Elan üksi.', 'new');
  const row = await f.row(first.id), conversation = () => db.conversation.findUnique({ where: { id: f.conv.id } });
  const life = async () => (await conversation()).expiresAt.getTime();
  assert(row.expiresAt.getTime() - started > 23.9 * hour && row.expiresAt.getTime() - started < 24.1 * hour, 'the row: the plan\'s 24 hours');
  assert(await life() - started > 89.9 * day && await life() - started < 90.1 * day, 'the conversation: 90 days from the turn');
  // An earlier activity time shows that each published turn renews the conversation's time.
  await db.conversation.update({ where: { id: f.conv.id }, data: { expiresAt: new Date(started + 5 * day), lastActivityAt: new Date(started - 85 * day) } });
  // The first row's time passes: from then on no reader sees it, and a purge removes it (a request purges at most
  // once a minute; the purge just before means the next message's request does not). The conversation is whole.
  await f.store.purgeDue();
  await db.m4PilotTurn.update({ where: { id: first.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  const second = await f.row((await f.run('Millist abi kirjeldatakse?')).id);
  assert.equal(await db.m4PilotTurn.count({ where: { id: first.id } }), 1, 'still stored, and read by no one');
  await f.store.purge();
  assert.equal(await db.m4PilotTurn.count({ where: { id: first.id } }), 0);
  assert.deepEqual(second.payload.dialogue.userTurns.map(turn => turn.text), ['Elan üksi.', 'Millist abi kirjeldatakse?']);
  assert.equal(second.payload.dialogue.publishedAssistant.turnId, first.id);
  assert.ok(second.payload.previousDialogueState, 'the state went on from the record');
  assert(await life() - started > 89.9 * day, 'renewed by the second turn');
  assert((await conversation()).lastActivityAt.getTime() >= started);
  assert.equal(await db.conversationMessage.count({ where: { conversationId: f.conv.id } }), 4);
  // The next message gets no answer, and its row's time passes too. The head named its topic, so the message after it
  // goes on in that topic from the last turn that has a record.
  f.fail(true);
  await assert.rejects(f.run('See ei saa vastust.'));
  f.fail(false);
  const lost = await turnRows.findFirst({ where: { pilotId: f.config.id }, orderBy: { createdAt: 'desc' } });
  assert.equal(lost.payload.question, 'See ei saa vastust.');
  assert.deepEqual((await conversation()).metadata.m4Dialogue, { configHash: f.config.configHash, turnId: lost.id, revision: 3, scopeId: row.payload.context.scopeId, personId: row.payload.context.personId });
  await db.m4PilotTurn.updateMany({ where: { pilotId: f.config.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  const fourth = await f.row((await f.run('Aga teenuse ulatus?')).id);
  // The expired rows are read by no one; the purge (at most once a minute in a request, asked for here) removes them.
  await f.store.purge();
  assert.equal(await db.m4PilotTurn.count({ where: { pilotId: f.config.id } }), 1, 'every expired row is gone');
  assert.deepEqual(fourth.payload.dialogue.userTurns.map(turn => turn.text), ['Elan üksi.', 'Millist abi kirjeldatakse?', 'Aga teenuse ulatus?']);
  assert.deepEqual([fourth.payload.context.scopeId, fourth.payload.context.revision, fourth.payload.dialogue.publishedAssistant.turnId], [row.payload.context.scopeId, 4, second.id]);
  assert.equal(fourth.state, 'completed');
});

test('ADR-094 real DB: a plan without any time limit leaves the conversation\'s time as it is', async t => {
  const f = await fixture(t);
  const first = await f.run('Olen 67, elan Harkus ja küsin koduteenuse kohta.', 'new');
  const conversation = await db.conversation.findUnique({ where: { id: f.conv.id } });
  assert.deepEqual([conversation.expiresAt, (await f.row(first.id)).expiresAt], [null, null]);
  assert(conversation.lastActivityAt.getTime() > Date.now() - 60000);
});

// ADR-119: through the service and the database. The plan and the selection of a short reply are given the question
// the assistant asked at the end of the answer before it; a longer message, and a message after an answer that asked
// nothing, are planned as before.
test('dialogue state DB (ADR-119): a short reply is planned and selected with the assistant\'s own question; a longer message is not', async t => {
  const requests = [], question = 'Kas küsid hooldajatoetuse või hooldusteenuse kohta?';
  const turn = await regionConversation(t, { clarifications: [question, null, null], requests, select: true });
  const of = (stage, index) => requests.filter(request => request.stage === stage)[index].input;
  const first = await turn('Elan Kose vallas. Kas hooldamise eest saab abi?', 'new', { queries: ['hooldajatoetus Kose vald'], person: 'user',
    places: [{ turn: 1, quote: 'Elan Kose vallas', name: 'Kose vald', person: 'user', relation: 'lives' }] });
  // The first message follows no answer.
  assert.deepEqual(['assistant_question' in of('plan', 0), 'assistant_question' in of('rerank', 0), first.assist.assistantQuestion ?? null], [false, false, null]);
  // The reply to the question: both calls are given it, and the turn's record says so.
  const reply = await turn('toetuse kohta', 'same', { queries: ['hooldajatoetuse tingimused'], person: 'user', places: [] });
  assert.deepEqual([of('plan', 1).assistant_question, of('rerank', 1).assistant_question, reply.assist.assistantQuestion], [question, question, true]);
  assert.deepEqual(of('plan', 1).messages, ['Elan Kose vallas. Kas hooldamise eest saab abi?', 'toetuse kohta']);
  // The question is in no search text and no query: the search is made from the user's words and the plan's.
  assert.doesNotMatch([reply.query.text, ...reply.assist.queries].join(' | '), /Kas küsid/u);
  assert.deepEqual(reply.people.user, ['kose_vald', 'reported']);
  // The answer to the reply asked nothing: the next short message is planned as before.
  const next = await turn('Ja kui palju?', 'same', { queries: ['hooldajatoetuse suurus'], person: 'user', places: [] });
  assert.deepEqual(['assistant_question' in of('plan', 2), 'assistant_question' in of('rerank', 2), next.assist.assistantQuestion ?? null], [false, false, null]);
});

test('dialogue state DB (ADR-119): a long message after a question is planned without it', async t => {
  const requests = [];
  const turn = await regionConversation(t, { clarifications: ['Kas elad Kose vallas?'], requests, select: true });
  await turn('Kas hooldamise eest saab abi?', 'new', { queries: ['hooldajatoetus'], person: 'user', places: [] });
  const long = await turn('Tegelikult tahan teada hoopis seda, kuidas taotleda puudega lapse hooldajale toetust ja kes selle üle otsustab.', 'same', { queries: ['puudega lapse hooldajatoetuse taotlemine'], person: 'user', places: [] });
  assert.deepEqual(requests.filter(request => request.stage !== 'embedding').slice(-2).map(request => 'assistant_question' in request.input), [false, false]);
  assert.equal('assistantQuestion' in long.assist, false);
});
