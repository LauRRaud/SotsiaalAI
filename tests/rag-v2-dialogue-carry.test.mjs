import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptDialogue, buildDialogueQuery, dialogueInput, DIALOGUE_LIMITS } from '../lib/rag-v2/pilot/dialogue.js';
import { carriedState, carriedStatements, CARRY_LIMITS } from '../lib/rag-v2/pilot/dialogue-carry.js';
import { REGION_STATE_VERSION, stateAudit, previousStateFor, validateStateRegion } from '../lib/rag-v2/pilot/dialogue-state.js';
import { mergeFactState } from '../lib/rag-v2/pilot/dialogue-state-4.js';
import { digest } from '../lib/rag-v2/pilot/contracts.js';

// ADR-070: the topic that continues a full one begins with what the full one hands over. No database, no model: the
// rows are what the store keeps of each turn (its context and accepted context audit, its state when it was published).
const config = { configHash: 'config', embedding: { model: 'test' }, model: 'test', maxOutputTokens: 1000, reasoning: 'low', dialogueStateVersion: REGION_STATE_VERSION };
function conversation(settings = config) {
  let head = null;
  const rows = [];
  // state: the state value the turn's answer saved (the turn is then published); undefined: the turn did not finish.
  const next = (question, mode = 'same', state = undefined, extra = {}) => {
    const id = `turn-${String(rows.length + 1).padStart(8, '0')}`;
    const accepted = acceptDialogue(settings, { question, contextMode: mode, language: 'et', ...extra }, rows, head, id);
    rows.push({ id, state: state === undefined ? 'stopped' : 'completed', payload: { question, contextMode: mode, context: accepted.context, contextAudit: accepted,
      ...(state ? { dialogueState: stateAudit(state, accepted, settings.dialogueStateVersion) } : {}) } });
    head = { configHash: settings.configHash, turnId: id, revision: accepted.context.revision };
    return accepted;
  };
  return { rows, next };
}
const fact = (id, topic, person, support, status = 'current', by = null) => ({ id, topic, person, status, support, superseded_by: by });
const reported = (id, support) => ({ id, status: 'reported', candidates: [], excluded: [], support });
const unknown = () => ({ id: null, status: 'unknown', candidates: [], excluded: [], support: [] });
const MESSAGES = ['Minu ema elab Kose vallas ja ta on 82-aastane.', 'Ta ei saa enam üksi hakkama.', 'Kas vald aitab?', 'Mis teenuseid on?', 'Kuidas taotleda?',
  'Kes otsustab?', 'Kui kaua see võtab?', 'Ema pension on 600 eurot.'];
// The full topic's state after its eighth message: a replaced amount, a need, the mother's municipality.
const fullState = () => ({
  facts: [fact('F1', 'vanus', 'ema', [{ turn: 1, quote: 'ta on 82-aastane' }]),
    fact('F2', 'toimetulek', 'ema', [{ turn: 2, quote: 'Ta ei saa enam üksi hakkama' }]),
    fact('F3', 'pension', 'ema', [{ turn: 5, quote: 'Kuidas taotleda?' }], 'superseded', 'F4'),
    fact('F4', 'pension', 'ema', [{ turn: 8, quote: 'Ema pension on 600 eurot' }])],
  needs: [{ candidate: 'ööpäevaringne hooldus', based_on: ['F2'] }, { candidate: 'vana summa', based_on: ['F3'] }],
  unknowns: [{ question: 'Kas emal on sääste?', based_on: [] }], periods: [], language_hint: 'et',
  people: [{ person: 'user', region: unknown() }, { person: 'ema', region: reported('kose_vald', [{ turn: 1, quote: 'Minu ema elab Kose vallas ja ta on 82-aastane' }]) }],
  focus: 'ema', model: { accepted: true, dropped: [] } });
function fullTopic(settings = config, last = fullState()) {
  const c = conversation(settings);
  MESSAGES.forEach((text, index) => c.next(text, index ? 'same' : 'new', index === MESSAGES.length - 1 ? last : index === 6 ? null : undefined));
  return c;
}
const STATEMENTS = 'ema: Minu ema elab Kose vallas ja ta on 82-aastane\nema: Ta ei saa enam üksi hakkama';

test('the ninth message begins a new topic with the user\'s earlier statements, the last message and the full topic\'s state', async () => {
  const c = fullTopic(), first = c.rows[0], eighth = c.rows[7];
  const ninth = c.next('Aga kui palju see maksab?');
  assert.deepEqual([ninth.context.mode, ninth.context.personId, ninth.selection.previousScopeFull], ['new', first.payload.context.personId, first.payload.context.scopeId]);
  assert.notEqual(ninth.context.scopeId, first.payload.context.scopeId);
  // A statement the mother's place sentence already holds is not repeated, nor one of the last message, which is carried whole.
  assert.deepEqual(ninth.userTurns.map(turn => [turn.text, turn.carried ?? null, turn.mode]),
    [[STATEMENTS, 'statements', 'same'], [MESSAGES[7], 'message', 'same'], ['Aga kui palju see maksab?', null, 'new']]);
  assert.deepEqual(ninth.selection.carried, { scopeId: first.payload.context.scopeId, turnIds: [eighth.id], stateTurnId: eighth.id, assistantTurnId: eighth.id, read: 2 });
  assert.deepEqual([ninth.selection.stateTurnId, ninth.selection.assistantTurnId, ninth.selection.assistantSelection], [eighth.id, eighth.id, 'carried_published_answer']);
  assert.deepEqual(ninth.selection.selected.map(entry => entry.reason), ['carried_from_full_scope', 'carried_from_full_scope', 'active_scope', 'carried_published_answer']);
  assert.ok(!ninth.selection.excluded.some(entry => entry.turnId === eighth.id) && ninth.selection.excluded.length === 7);
  assert.deepEqual(ninth.sourceTurnIds, [eighth.id]);
  // The search text and the plan's messages have the earlier circumstances and the last question.
  assert.equal(buildDialogueQuery(ninth, config).text, [STATEMENTS, MESSAGES[7], 'Aga kui palju see maksab?'].join('\n\n'));

  // The state: the current facts with their ids, anchored where the carried turns hold their words; the replaced fact and
  // the need that named it are gone; the mother keeps her municipality.
  const state = carriedState(eighth.payload.dialogueState, ninth);
  assert.deepEqual(state.value.facts.map(entry => [entry.id, entry.status, entry.support]), [
    ['F1', 'current', [{ turn: 1, quote: 'ta on 82-aastane' }]], ['F2', 'current', [{ turn: 1, quote: 'Ta ei saa enam üksi hakkama' }]],
    ['F4', 'current', [{ turn: 2, quote: 'Ema pension on 600 eurot' }]]]);
  assert.deepEqual(state.value.needs, [{ candidate: 'ööpäevaringne hooldus', based_on: ['F2'] }]);
  assert.deepEqual(state.value.unknowns, [{ question: 'Kas emal on sääste?', based_on: [] }]);
  assert.deepEqual(state.value.people[1], { person: 'ema', region: reported('kose_vald', [{ turn: 1, quote: 'Minu ema elab Kose vallas ja ta on 82-aastane' }]) });
  assert.equal(state.value.focus, 'ema');
  assert.deepEqual([state.scopeId, state.personId, state.sourceTurnIds, state.carriedFrom], [ninth.context.scopeId, ninth.context.personId,
    [`carried-${first.payload.context.scopeId}`, eighth.id], { scopeId: first.payload.context.scopeId, hash: eighth.payload.dialogueState.hash }]);
  // It is an ordinary state of the new topic: bound to it, every quotation in its numbered turn, the region anchored.
  assert.equal(previousStateFor(state, ninth), state);
  for (const entry of state.value.facts) for (const source of entry.support) assert.ok(ninth.userTurns[source.turn - 1].text.includes(source.quote));
  // A stand-in for EstNLTK, as in the state tests: each word reads as itself and, for the inflected fixture word, its lemma.
  const regions = [{ region: 'kose_vald', names: ['Kose vald'] }];
  const analyzer = { analyze: async words => words.map(word => { const lower = word.toLowerCase(); return `vmet${lower}${lower === 'vallas' ? ' vmetvald' : ''}`; }) };
  await validateStateRegion(state.value, { regions }, analyzer, ninth.userTurns);
  // The answer model reads it as the previous state, with the carried turns marked.
  const input = dialogueInput(ninth, null, { previous: state, context: {} }).value;
  assert.deepEqual([input.previousState.facts.map(entry => entry.id), input.userTurns.map(turn => [turn.turn, turn.carried ?? null])],
    [['F1', 'F2', 'F4'], [[1, 'statements'], [2, 'message'], [3, null]]]);
  // A new fact of the ninth message replaces a carried one like any other.
  const merged = mergeFactState(state.value, { new_facts: [{ topic: 'pension', person: 'ema', support: [{ turn: 3, quote: 'kui palju see maksab' }] }],
    superseded: [{ fact: 'F4', by: 'N1' }], needs: [], unknowns: [], periods: [], language_hint: 'et' }, ninth.userTurns, { people: state.value.people, focus: 'ema' });
  assert.deepEqual(merged.facts.map(entry => [entry.id, entry.status]), [['F1', 'current'], ['F2', 'current'], ['F4', 'superseded'], ['F5', 'current']]);
  assert.deepEqual(merged.model.dropped, []);
});

test('the continuing topic keeps its carried turns, uses its own answer and state once it has them, and hands over again when it is full', () => {
  const c = fullTopic(), eighth = c.rows[7];
  const ninth = c.next('Aga kui palju see maksab?');                // not published: no answer or state of its own yet
  const tenth = c.next('Ja kes maksab puuduoleva osa?', 'same', { ...fullState(), facts: [], needs: [], people: [], focus: 'ema' });
  assert.deepEqual(tenth.userTurns.map(turn => turn.carried ?? turn.text), ['statements', 'message', 'Aga kui palju see maksab?', 'Ja kes maksab puuduoleva osa?']);
  assert.deepEqual([tenth.context.scopeId, tenth.selection.previousScopeFull, tenth.selection.carried, tenth.selection.stateTurnId, tenth.selection.assistantSelection],
    [ninth.context.scopeId, undefined, ninth.selection.carried, eighth.id, 'carried_published_answer']);
  assert.equal(previousStateFor(carriedState(eighth.payload.dialogueState, tenth), tenth).sourceTurnIds.length, 2);
  const eleventh = c.next('Selge.');
  assert.deepEqual([eleventh.selection.stateTurnId, eleventh.selection.assistantTurnId, eleventh.selection.assistantSelection], [c.rows[9].id, c.rows[9].id, 'latest_published_answer']);
  assert.deepEqual(eleventh.sourceTurnIds, [eighth.id, c.rows[8].id, c.rows[9].id]);
  // Two carried turns and six of its own make eight: the seventh own message goes on in a third topic.
  for (let i = 0; i < 3; i++) c.next(`Veel üks küsimus ${i}`);
  assert.equal(c.rows.at(-1).payload.contextAudit.userTurns.length, DIALOGUE_LIMITS.scopeTurns);
  const third = c.next('Ja edasi?', 'same', { ...fullState(), facts: [], needs: [], people: [], focus: 'ema' });
  assert.deepEqual([third.context.scopeId === ninth.context.scopeId, third.selection.previousScopeFull, third.userTurns.at(-2).text, third.userTurns.at(-2).carried],
    [false, ninth.context.scopeId, 'Veel üks küsimus 2', 'message']);
  // The message that went on was sent as 'same' and accepted as 'new'; the state saved with it still fits the next turn
  // (on 02.10 the tenth message of a conversation failed here with dialogue_state_scope_mismatch).
  const after = c.next('Ja siis?');
  assert.equal(after.userTurns.at(-2).mode, 'new');
  assert.equal(previousStateFor(c.rows.at(-2).payload.dialogueState, after).sourceTurnIds.length, after.userTurns.length - 1);
  // An explicit choice of a full topic is still refused.
  assert.throws(() => c.next('Tagasi', 'same', undefined, { contextTurnId: c.rows[8].id }), { code: 'context_window_full' });
  assert.throws(() => c.next('Tagasi', 'same', undefined, { contextTurnId: c.rows[0].id }), { code: 'context_window_full' });
});

test('what the full topic\'s state has not read is carried as an unread message; without a state only the last message goes over', () => {
  // The eighth message did not finish: the state is the seventh message's, which has not read it.
  const c = conversation();
  const seventh = { ...fullState(), facts: fullState().facts.slice(0, 2), needs: [], unknowns: [] };
  MESSAGES.forEach((text, index) => c.next(text, index ? 'same' : 'new', index === 6 ? seventh : undefined));
  const ninth = c.next('Aga kui palju see maksab?'), state = carriedState(c.rows[6].payload.dialogueState, ninth);
  assert.deepEqual([ninth.selection.carried.read, ninth.selection.carried.stateTurnId, ninth.userTurns.map(turn => turn.carried ?? null)], [1, c.rows[6].id, ['statements', 'message', null]]);
  assert.deepEqual([state.sourceTurnIds.length, state.value.facts.map(entry => entry.id)], [1, ['F1', 'F2']]);
  // No published turn at all: the last message alone, and no state.
  const bare = conversation();
  MESSAGES.forEach((text, index) => bare.next(text, index ? 'same' : 'new'));
  const plain = bare.next('Aga kui palju see maksab?');
  assert.deepEqual([plain.userTurns.map(turn => turn.text), plain.selection.carried.read, plain.selection.stateTurnId, plain.selection.assistantTurnId],
    [[MESSAGES[7], 'Aga kui palju see maksab?'], 0, null, null]);
  // A plan without a dialogue state: the same.
  const stateless = fullTopic({ ...config, dialogueStateVersion: undefined }, null).next('Aga kui palju see maksab?');
  assert.deepEqual([stateless.userTurns.map(turn => turn.text), stateless.selection.stateTurnId, stateless.selection.assistantTurnId !== null],
    [[MESSAGES[7], 'Aga kui palju see maksab?'], undefined, true]);
});

test('the statements keep to their room, newest facts first; a state that is not the full topic\'s own is refused', () => {
  const long = index => `Asjaolu number ${index} ${'x'.repeat(200)}`;
  const many = { ...fullState(), facts: Array.from({ length: 12 }, (_, index) => fact(`F${index + 1}`, 'asjaolu', 'user', [{ turn: 1, quote: long(index + 1) }])), needs: [] };
  const audit = { version: REGION_STATE_VERSION, scopeId: 's', personId: 'p', sourceTurnIds: ['a'], inputHash: 'h', value: many };
  const text = carriedStatements({ ...audit, hash: digest(audit) }, []);
  assert.ok(text.length <= CARRY_LIMITS.statementChars);
  const kept = text.split('\n');
  // The mother's place first, then the newest facts that fit, oldest of them first.
  assert.match(kept[0], /^ema: Minu ema elab Kose vallas/u);
  assert.deepEqual(kept.slice(1).map(line => Number(line.match(/number (\d+)/u)[1])), [5, 6, 7, 8, 9, 10, 11, 12]);
  assert.equal(carriedStatements({ ...audit, hash: 'changed' }, []), null);
  assert.equal(carriedStatements({ ...audit, value: { ...many, facts: [], people: [] }, hash: digest({ ...audit, value: { ...many, facts: [], people: [] } }) }, []), null);

  const c = fullTopic(), ninth = c.next('Aga kui palju see maksab?'), own = c.rows[7].payload.dialogueState;
  const { hash: _hash, ...content } = own;
  const other = { ...content, scopeId: 'another-scope' }, person = { ...content, personId: 'another-person' };
  for (const foreign of [{ ...own, hash: 'changed' }, { ...other, hash: digest(other) }, { ...person, hash: digest(person) }, null]) {
    assert.throws(() => carriedState(foreign, ninth), { code: 'dialogue_state_scope_mismatch' });
  }
  // A topic that continues nothing has nothing to carry.
  assert.throws(() => carriedState(own, c.rows[0].payload.contextAudit), { code: 'dialogue_state_scope_mismatch' });
});
