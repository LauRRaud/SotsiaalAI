import test from 'node:test';
import assert from 'node:assert/strict';
import { DIALOGUE_ANSWER_SCHEMA, DIALOGUE_STATE_VERSION, validateDialogueState, stateAudit, previousStateFor, projectDialogueAnswer } from '../lib/rag-v2/pilot/dialogue-state.js';
import { dialogueInput, dialogueRequest } from '../lib/rag-v2/pilot/dialogue.js';

const context = { regions: [{ region: 'harku_vald', names: ['Harku vald', 'Harku'] }] };
const accepted = texts => ({ context: { scopeId: 'topic', personId: 'person' }, selection: {},
  userTurns: texts.map((text, i) => ({ turnId: `turn-${i}`, text, mode: i ? 'same' : 'new', correctionOf: null })) });
const fact = (topic, turn, quote) => ({ topic, subject: 'self', status: 'current', support: [{ turn, quote }], superseded_by: null });
const state = facts => ({ facts, needs: [], unknowns: [], region: { id: null, status: 'unknown', support: [] }, period: null, language_hint: 'et' });
const invalid = fn => assert.throws(fn, { code: 'invalid_dialogue_state' });

test('state quotes attribute ET/EN/RU user reports without a word-form dictionary or assistant claims', () => {
  for (const text of ['Olen üksi kodus, raske on toimetulek, tööd ei ole.', 'I live alone and have no job.', 'Я живу один, работы нет.']) {
    const input = accepted([text]), value = state([fact('reported situation', 1, text)]);
    value.needs = [{ candidate: 'Possible support need', based_on: [1] }];
    value.unknowns = [{ question: 'Which locality is relevant?', based_on: [1] }];
    assert.deepEqual(validateDialogueState(value, input, context), value);
    for (const quote of ['The assistant promised help.', 'Guaranteed eligibility']) {
      invalid(() => validateDialogueState(state([fact('invented', 1, quote)]), input, context));
    }
    invalid(() => validateDialogueState(state([fact('wrong turn', 2, text)]), input, context));
  }
});

test('a correction supersedes the quoted job report while retaining unrelated circumstances; omission and resurrection fail', () => {
  const first = accepted(['Elan üksi. Tööd ei ole.']), current = accepted([...first.userTurns.map(t => t.text), 'Nüüd töötan.']);
  const value = state([fact('living', 1, 'Elan üksi.'), fact('work', 1, 'Tööd ei ole.')]);
  const previous = stateAudit(value, first);
  const corrected = structuredClone(value);
  corrected.facts[1].status = 'superseded'; corrected.facts[1].superseded_by = 3;
  corrected.facts.push(fact('work', 2, 'Nüüd töötan.'));
  assert.deepEqual(validateDialogueState(corrected, current, context, previous), corrected);
  invalid(() => validateDialogueState(state([corrected.facts[2]]), current, context, previous));
  const later = accepted([...current.userTurns.map(t => t.text), 'Aga kodune abi?']);
  invalid(() => validateDialogueState({ ...corrected, facts: [...value.facts, corrected.facts[2]] }, later, context, stateAudit(corrected, current)));
  invalid(() => validateDialogueState({ ...corrected, needs: [{ candidate: 'Unemployment help', based_on: [2] }] }, current, context, previous));
});

test('supersession rejects cycles, same-turn replacements, malformed later facts and unanchored scope/date data', () => {
  const input = accepted(['Elan Harkus. Periood 2024–2025.']);
  const value = state([fact('location', 1, 'Elan Harkus.')]);
  for (const superseded_by of [0, 1, 2, 1.5]) {
    invalid(() => validateDialogueState({ ...value, facts: [{ ...value.facts[0], status: 'superseded', superseded_by }] }, input, context));
  }
  invalid(() => validateDialogueState({ ...value, facts: [{ ...value.facts[0], status: 'superseded', superseded_by: 2 }, { support: [null] }] }, input, context));
  invalid(() => validateDialogueState({ ...value, region: { id: 'invented', status: 'reported', support: [{ turn: 1, quote: 'Harkus' }] } }, input, context));
  invalid(() => validateDialogueState({ ...value, region: { id: 'harku_vald', status: 'unknown', support: [] } }, input, context));
  invalid(() => validateDialogueState({ ...value, region: { id: 'harku_vald', status: 'reported', support: [] } }, input, context));
  for (const [from, to] of [['2025-02-29', null], ['2025-01-01', '2024-12-31'], [null, null]]) {
    invalid(() => validateDialogueState({ ...value, period: { from, to, support: [{ turn: 1, quote: '2024–2025' }] } }, input, context));
  }
  const period = { from: '2024-01-01', to: '2025-12-31', support: [{ turn: 1, quote: '2024–2025' }] };
  assert.deepEqual(validateDialogueState({ ...value, period }, input, context).period, period);
});

test('a rejected state names the failed check for diagnosis', () => {
  const input = accepted(['Elan Harkus.']), value = state([fact('location', 1, 'Elan Harkus.')]);
  const reason = fn => { try { fn(); } catch (error) { assert.equal(error.code, 'invalid_dialogue_state'); return error.reason; } };
  assert.equal(reason(() => validateDialogueState(state([fact('invented', 1, 'Elan Tallinnas.')]), input, context)), 'fact_quote_not_in_turn');
  assert.equal(reason(() => validateDialogueState({ ...value, region: { id: 'invented', status: 'reported', support: [{ turn: 1, quote: 'Harkus' }] } }, input, context)), 'region_id');
  assert.equal(reason(() => validateDialogueState({ ...value, region: { id: 'harku_vald', status: 'reported', support: [] } }, input, context)), 'region_support_count');
  assert.equal(reason(() => validateDialogueState({ ...value, needs: [{ candidate: 'Abi', based_on: [2] }] }, input, context)), 'needs_based_on');
  assert.equal(reason(() => projectDialogueAnswer({ kind: 'clarification', blocks: [], limitations: [], clarification: 'Kus?' }, { reference_map: {} }, input, context, null)), 'state_missing');
});

test('state reuse is bound to the exact accepted prefix, person and topic, including failed user turns', () => {
  const first = accepted(['Elan üksi.']), value = state([fact('living', 1, 'Elan üksi.')]), previous = stateAudit(value, first);
  const next = accepted(['Elan üksi.', 'Parandus.', 'Jätka.']);
  assert.deepEqual(previousStateFor(previous, next), previous);
  for (const forged of [{ ...previous, value: state([]) }, stateAudit(value, { ...first, context: { scopeId: 'other', personId: 'person' } }),
    stateAudit(value, { ...first, context: { scopeId: 'topic', personId: 'other' } }), stateAudit(value, accepted(['Elan koos perega.']))]) {
    assert.throws(() => previousStateFor(forged, next), { code: 'dialogue_state_scope_mismatch' });
  }
  assert.throws(() => previousStateFor(previous, { ...next, userTurns: [...next.userTurns].reverse() }), { code: 'dialogue_state_scope_mismatch' });
});

test('one strict response carries a private state; the existing public answer contract and selected answer language remain intact', () => {
  const input = accepted(['Elan üksi.']), value = state([fact('living', 1, 'Elan üksi.')]);
  value.language_hint = 'ru';
  const dialogue = dialogueInput(input, null, { previous: null, context });
  const config = { dialogueStateVersion: DIALOGUE_STATE_VERSION, model: 'gpt-6-luna', reasoning: 'medium', maxOutputTokens: 4096 };
  const body = dialogueRequest(config, input.userTurns[0].text, {}, 'et', dialogue.value);
  assert.deepEqual(body.text.format.schema, DIALOGUE_ANSWER_SCHEMA);
  assert.equal(JSON.parse(body.input[0].content).dialogue.previousState, null);
  assert.equal(body.reasoning.effort, 'medium');
  assert.match(body.instructions, /language.*Estonian/i);
  const plain = { kind: 'clarification', blocks: [], limitations: [], clarification: 'Millises vallas või linnas abi vajate?' };
  const projected = projectDialogueAnswer({ ...plain, dialogue_state: value }, { reference_map: {} }, input, context, null);
  assert.deepEqual(projected.answer, plain);
  assert.equal(projected.audit.value.language_hint, 'ru');
  assert.equal(projected.audit.version, DIALOGUE_STATE_VERSION);
  invalid(() => projectDialogueAnswer(plain, { reference_map: {} }, input, context, null));
});
