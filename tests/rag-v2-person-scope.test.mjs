import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRecordScope, focusRegion } from '../lib/rag-v2/pilot/record-scope.js';
import { PERSON_DIALOGUE_STATE_VERSION, TYPED_DIALOGUE_STATE_VERSION, validateDialogueState, validateStateRegion, stateAudit,
  PERSON_DIALOGUE_ANSWER_SCHEMA, previousStateFor, projectDialogueAnswer } from '../lib/rag-v2/pilot/dialogue-state.js';

// ADR-049. A stand-in for EstNLTK: each word reads as itself and, for the few inflected fixture words, its lemma.
// The runtime has no such list; the real analyzer is covered by rag-v2-record-scope.test.mjs.
const LEMMAS = { vallas: 'vald', vallast: 'vald' };
const analyzer = { analyze: async words => words.map(word => { const lower = word.toLowerCase(); return `vmet${lower}${LEMMAS[lower] ? ` vmet${LEMMAS[lower]}` : ''}`; }) };
const directory = [{ region: 'tartu_vald', names: ['Tartu vald'] }, { region: 'kose_vald', names: ['Kose vald'] }, { region: 'harku_vald', names: ['Harku vald'] }];
const context = { regions: directory };
const TEXTS = ['Elan Tartu vallas ja mul on võlad.', 'Naabrimees on eakas ja elab Kose vallas, ta vajab koduabi.', 'Teine asi: mul pole täna kusagil magada.'];
const turns = texts => texts.map((text, i) => ({ turnId: `t${i + 1}`, text, mode: i ? 'same' : 'new' }));
const accepted = texts => ({ context: { scopeId: 'topic', personId: 'person' }, selection: {}, userTurns: turns(texts).map(turn => ({ ...turn, correctionOf: null })) });
const region = (id, turn, quote) => ({ id, status: 'reported', support: [{ turn, quote }] });
const unknown = { id: null, status: 'unknown', support: [] };
const fact = (topic, subject, turn, quote) => ({ topic, subject, status: 'current', support: [{ turn, quote }], superseded_by: null });
const state = (facts, people, focus) => ({ facts, needs: [], unknowns: [], language_hint: 'et', periods: [], people, focus });
// The state after the neighbour's turn: the user in Tartu vald, the neighbour in Kose vald, the neighbour in focus.
const afterNeighbour = () => stateAudit(state([fact('võlad', 'self', 1, 'mul on võlad'), fact('koduabi', 'other', 2, 'ta vajab koduabi')],
  [{ person: 'user', region: region('tartu_vald', 1, 'Elan Tartu vallas') }, { person: 'naabrimees', region: region('kose_vald', 2, 'elab Kose vallas') }],
  'naabrimees'), accepted(TEXTS.slice(0, 2)), PERSON_DIALOGUE_STATE_VERSION);

test('a request about the user keeps the user\'s municipality, not the neighbour\'s mentioned last (owner report 28.09)', async () => {
  const previous = afterNeighbour();
  const scope = person => resolveRecordScope(turns(TEXTS), directory, analyzer, previous, person);
  assert.deepEqual(await scope('user'), { state: 'person_region', region: 'tartu_vald', person: 'user', interpretation: 'source_scope_only_not_confirmed_residence' });
  assert.equal((await scope('naabrimees')).region, 'kose_vald');
  // Someone the state does not know gets none: never another person's.
  assert.deepEqual(await scope('other'), { state: 'region_required', region: null, person: 'other' });
  // Unclear (or an older plan without a person): the person the conversation was about, as before, now named.
  for (const person of ['unclear', null]) {
    assert.deepEqual(await scope(person), { state: 'dialogue_region', region: 'kose_vald', person: 'naabrimees', interpretation: 'source_scope_only_not_confirmed_residence' });
  }
  assert.equal(focusRegion(previous.value).id, 'kose_vald');
  // A known person without a municipality ("Kellele ma helistan?" about the mother's help reads as the user's) falls
  // back to the person the conversation was about, instead of losing the catalogue.
  const motherOnly = stateAudit(state([fact('koduabi', 'other', 1, 'ta vajab koduabi')], [{ person: 'user', region: unknown },
    { person: 'ema', region: region('kose_vald', 1, 'Ema elab Kose vallas') }], 'ema'), accepted(['Ema elab Kose vallas, ta vajab koduabi.']), PERSON_DIALOGUE_STATE_VERSION);
  assert.equal((await resolveRecordScope(turns(['Ema elab Kose vallas, ta vajab koduabi.', 'Kellele ma helistan?']), directory, analyzer, motherOnly, 'user')).region, 'kose_vald');
});

test('a place in the current message still wins; the person comes before an older message whose state was not kept', async () => {
  const previous = afterNeighbour();
  const moved = [...TEXTS.slice(0, 2), 'Kolisin eile Harku valda, mul pole kusagil magada.'];
  assert.equal((await resolveRecordScope(turns([...TEXTS.slice(0, 2), 'Elan nüüd Harku vallas.']), directory, analyzer, previous, 'user')).region, 'harku_vald');
  assert.equal((await resolveRecordScope(turns(moved), directory, { analyze: async words => words.map(word => `vmet${word.toLowerCase()}${word === 'valda' ? ' vmetvald' : ''}`) }, previous, 'user')).region, 'harku_vald');
  // The neighbour's turn lost its state: only the user's first turn is remembered. Before ADR-049 the scan of the
  // unremembered turns found Kose vald for the user's own request.
  const first = stateAudit(state([fact('võlad', 'self', 1, 'mul on võlad')], [{ person: 'user', region: region('tartu_vald', 1, 'Elan Tartu vallas') }], 'user'),
    accepted(TEXTS.slice(0, 1)), PERSON_DIALOGUE_STATE_VERSION);
  assert.equal((await resolveRecordScope(turns(TEXTS), directory, analyzer, first, 'user')).region, 'tartu_vald');
  assert.equal((await resolveRecordScope(turns(TEXTS), directory, analyzer, first, 'unclear')).region, 'kose_vald');
  // A typed state v2 has one region and no persons: the plan's person changes nothing.
  const v2 = { ...first, version: TYPED_DIALOGUE_STATE_VERSION, value: { region: region('tartu_vald', 1, 'Elan Tartu vallas') } };
  assert.equal((await resolveRecordScope(turns(TEXTS), directory, analyzer, v2, 'user')).region, 'kose_vald');
});

test('state v3: each person\'s own region, one focus; a person the model left out keeps their region', async () => {
  const input = accepted(TEXTS), previous = afterNeighbour();
  const facts = [...previous.value.facts, fact('ööbimine', 'self', 3, 'mul pole täna kusagil magada')];
  const value = state(facts, [{ person: 'user', region: region('tartu_vald', 1, 'Elan Tartu vallas') }], 'user');
  const validated = validateDialogueState(value, input, context, previous, PERSON_DIALOGUE_STATE_VERSION);
  assert.deepEqual(validated.people.map(entry => [entry.person, entry.region.id]), [['user', 'tartu_vald'], ['naabrimees', 'kose_vald']]);
  await validateStateRegion(validated, context, analyzer);
  const invalid = (change, reason) => assert.throws(() => validateDialogueState({ ...value, ...change }, input, context, previous, PERSON_DIALOGUE_STATE_VERSION),
    error => error.code === 'invalid_dialogue_state' && error.reason === reason);
  invalid({ focus: 'ema' }, 'focus_person');
  invalid({ people: [{ person: 'user', region: unknown }, { person: 'User ', region: unknown }] }, 'person_duplicate');
  invalid({ people: [{ person: 'user', region: region('tallinn', 1, 'Elan Tartu vallas') }] }, 'person_region_id');
  invalid({ people: [{ person: 'user', region: { id: 'tartu_vald', status: 'reported', support: [] } }] }, 'person_region_support_count');
  assert.equal(validateDialogueState({ ...value, focus: 'unclear' }, input, context, previous, PERSON_DIALOGUE_STATE_VERSION).focus, 'unclear');
  // Every person's region is anchored in a quoted mention of its municipality.
  const unanchored = { ...validated, people: [{ person: 'user', region: region('harku_vald', 1, 'Elan Tartu vallas') }] };
  await assert.rejects(validateStateRegion(unanchored, context, analyzer), { code: 'dialogue_state_region_unanchored' });
  assert.deepEqual(Object.keys(PERSON_DIALOGUE_ANSWER_SCHEMA.properties.dialogue_state.properties),
    ['facts', 'needs', 'unknowns', 'language_hint', 'periods', 'people', 'focus']);
});

test('a v3 state is the previous state of the next turn, and the answer projection carries it (eval 29.09: every later turn stopped)', () => {
  const input = accepted(TEXTS), previous = afterNeighbour();
  assert.deepEqual(previousStateFor(previous, input), previous);
  const value = state([...previous.value.facts, fact('ööbimine', 'self', 3, 'mul pole täna kusagil magada')], [], 'user');
  const projected = projectDialogueAnswer({ kind: 'clarification', blocks: [], limitations: [], clarification: 'Millises vallas sa praegu oled?', dialogue_state: value },
    { reference_map: {} }, input, context, previous, PERSON_DIALOGUE_STATE_VERSION);
  assert.equal(projected.audit.version, PERSON_DIALOGUE_STATE_VERSION);
  assert.deepEqual(projected.audit.value.people.map(entry => entry.person), ['user', 'naabrimees']);
  assert.deepEqual(previousStateFor(projected.audit, accepted([...TEXTS, 'Aitäh.'])), projected.audit);
});

test('state v3 keeps what the model may only repeat: an earlier topic and an omitted current fact; other drops still fail', () => {
  const input = accepted(TEXTS), previous = afterNeighbour();
  const people = [{ person: 'user', region: region('tartu_vald', 1, 'Elan Tartu vallas') }];
  const next = fact('ööbimine', 'self', 3, 'mul pole täna kusagil magada');
  // 33 of 42 dropped facts on 28.09: the same person and quote under a new topic label.
  const renamed = state([{ ...previous.value.facts[0], topic: 'võlaprobleem' }, previous.value.facts[1], next], people, 'user');
  assert.equal(validateDialogueState(renamed, input, context, previous, PERSON_DIALOGUE_STATE_VERSION).facts[0].topic, 'võlad');
  // The neighbour's turn wrote only its own facts: the user's current fact is carried unchanged, after the model's.
  const omitted = validateDialogueState(state([previous.value.facts[1], next], people, 'user'), input, context, previous, PERSON_DIALOGUE_STATE_VERSION);
  assert.deepEqual(omitted.facts.map(entry => entry.topic), ['koduabi', 'ööbimine', 'võlad']);
  // A superseded fact that went missing, or a changed person, is not repaired.
  const superseded = stateAudit(state([{ ...previous.value.facts[0], status: 'superseded', superseded_by: 2 }, fact('võlad', 'self', 2, 'ta vajab koduabi')],
    people, 'user'), accepted(TEXTS.slice(0, 2)), PERSON_DIALOGUE_STATE_VERSION);
  assert.throws(() => validateDialogueState(state([superseded.value.facts[1], next], people, 'user'), input, context, superseded, PERSON_DIALOGUE_STATE_VERSION),
    error => error.reason === 'previous_fact_dropped');
  assert.throws(() => validateDialogueState(state([{ ...previous.value.facts[0], subject: 'other' }, previous.value.facts[1], next], people, 'user'),
    input, context, previous, PERSON_DIALOGUE_STATE_VERSION), error => error.reason === 'previous_fact_dropped');
  // The typed state v2 keeps its strict rule, so its recorded failures still reproduce on recovery.
  const v2previous = { ...previous, version: TYPED_DIALOGUE_STATE_VERSION, value: { ...previous.value, region: unknown } };
  delete v2previous.value.people; delete v2previous.value.focus;
  const v2value = { facts: [{ ...previous.value.facts[0], topic: 'võlaprobleem' }, previous.value.facts[1]], needs: [], unknowns: [], language_hint: 'et', periods: [], region: unknown };
  assert.throws(() => validateDialogueState(v2value, input, context, v2previous, TYPED_DIALOGUE_STATE_VERSION), error => error.reason === 'previous_fact_dropped');
});
