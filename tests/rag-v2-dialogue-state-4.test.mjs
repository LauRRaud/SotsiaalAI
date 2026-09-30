import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeFactState, activeView, FACT_LIMITS, FACT_STATE_VERSION, FACT_STATE_INSTRUCTIONS } from '../lib/rag-v2/pilot/dialogue-state-4.js';
import { projectDialogueAnswer, previousStateFor, stateAudit } from '../lib/rag-v2/pilot/dialogue-state.js';
import { checkedPlaces, nextPeople, nextFocus, placeScope } from '../lib/rag-v2/pilot/person-places.js';

// ADR-051. A stand-in for EstNLTK: each word reads as itself and, for the inflected fixture words, its lemma.
const LEMMAS = { vallas: 'vald', valda: 'vald' };
const analyzer = { analyze: async words => words.map(word => { const lower = word.toLowerCase(); return `vmet${lower}${LEMMAS[lower] ? ` vmet${LEMMAS[lower]}` : ''}`; }) };
const directory = [{ region: 'harku_vald', names: ['Harku vald'] }, { region: 'kose_vald', names: ['Kose vald'] }, { region: 'tartu_vald', names: ['Tartu vald'] }];
const turns = texts => texts.map((text, i) => ({ turnId: `t${i + 1}`, text, mode: i ? 'same' : 'new', correctionOf: null }));
const accepted = texts => ({ context: { scopeId: 'topic', personId: 'person' }, selection: {}, userTurns: turns(texts) });
const fact = (topic, person, turn, quote) => ({ topic, person, support: [{ turn, quote }] });
const answer = { kind: 'clarification', blocks: [], limitations: [], clarification: 'Kus sa elad?' };

test('the model records only changes; facts get stable ids, a correction replaces, a retraction ends a fact', () => {
  const t = ['Elan üksi. Tööd ei ole.', 'Nüüd töötan. Tegelikult ma ei ela üksi.'];
  const first = mergeFactState(null, { new_facts: [fact('elukorraldus', 'user', 1, 'Elan üksi.'), fact('töö', 'user', 1, 'Tööd ei ole.')],
    superseded: [], needs: [{ candidate: 'Töötutoetus', based_on: ['N2'] }], unknowns: [], periods: [], language_hint: 'et' }, turns(t.slice(0, 1)), { people: [], focus: 'user' });
  assert.deepEqual(first.facts.map(entry => [entry.id, entry.status]), [['F1', 'current'], ['F2', 'current']]);
  assert.deepEqual(first.needs, [{ candidate: 'Töötutoetus', based_on: ['F2'] }]);
  const second = mergeFactState(first, { new_facts: [fact('töö', 'user', 2, 'Nüüd töötan.')], superseded: [{ fact: 'F2', by: 'N1' }, { fact: 'F1', by: null }],
    needs: [], unknowns: [{ question: 'Kellega koos elad?', based_on: [] }], periods: [], language_hint: 'et' }, turns(t), { people: [], focus: 'user' });
  assert.deepEqual(second.facts.map(entry => [entry.id, entry.status, entry.superseded_by]), [['F1', 'retracted', null], ['F2', 'superseded', 'F3'], ['F3', 'current', null]]);
  assert.deepEqual(activeView(second).facts.map(entry => entry.id), ['F3']);
  assert.deepEqual(second.model, { accepted: true, dropped: [] });
});

test('a bad item is left out and named; the rest of the state advances (no whole-state rejection)', () => {
  const t = ['Elan Harku vallas. Mul on võlad.'];
  const merged = mergeFactState(null, { new_facts: [fact('võlad', 'user', 1, 'Mul on võlad.'), fact('leiutatud', 'user', 1, 'Mul on kolm last.')],
    superseded: [{ fact: 'F9', by: null }], needs: [{ candidate: 'Võlanõustamine', based_on: ['N2'] }], unknowns: [],
    periods: [{ basis: 'event', from: '2025-02-30', to: null, support: [{ turn: 1, quote: 'Mul on võlad.' }] }], language_hint: 'xx' },
  turns(t), { people: [], focus: 'user' });
  assert.deepEqual(merged.facts.map(entry => entry.topic), ['võlad']);
  assert.deepEqual(merged.model.dropped.map(item => item.reason), ['fact_not_quoted', 'supersession_invalid', 'needs_based_on', 'period_bounds']);
  assert.equal(merged.language_hint, null);
  // A missing model state keeps the previous model part; the server part still advances.
  const kept = mergeFactState(merged, null, turns([...t, 'Aitäh.']), { people: [{ person: 'user', region: { id: 'harku_vald', status: 'reported', support: [] } }], focus: 'user' });
  assert.deepEqual(kept.facts, merged.facts);
  assert.equal(kept.people[0].region.id, 'harku_vald');
  assert.deepEqual(kept.model, { accepted: false, dropped: [{ kind: 'state', reason: 'state_missing' }] });
  // The same person and quotes as a current fact is not a new fact; a reference to it still resolves.
  // A need keeps its valid references; a reference to a fact the schema did not let in is left out (eval 29.09: N7-N12).
  const partial = mergeFactState(null, { new_facts: [fact('võlad', 'user', 1, 'Mul on võlad.')], superseded: [],
    needs: [{ candidate: 'Võlanõustamine', based_on: ['N1', 'N7'] }], unknowns: [], periods: [], language_hint: 'et' }, turns(t), { people: [], focus: 'user' });
  assert.deepEqual(partial.needs, [{ candidate: 'Võlanõustamine', based_on: ['F1'] }]);
  assert.deepEqual(partial.model.dropped, [{ kind: 'needs', reason: 'reference_dropped' }]);
  const again = mergeFactState(merged, { new_facts: [fact('võlaprobleem', 'user', 1, 'Mul on võlad.')], superseded: [],
    needs: [{ candidate: 'Võlanõustamine', based_on: ['N1'] }], unknowns: [], periods: [], language_hint: 'et' }, turns([...t, 'Jah.']), { people: [], focus: 'user' });
  assert.deepEqual(again.facts.map(entry => [entry.id, entry.topic]), [['F1', 'võlad']]);
  assert.deepEqual(again.needs, [{ candidate: 'Võlanõustamine', based_on: ['F1'] }]);
});

test('bounded memory without a dead end: past 16 current facts the oldest move to history; the eight turns of a scope fit the history', () => {
  const texts = Array.from({ length: 8 }, (_, i) => Array.from({ length: 6 }, (_, k) => `Asjaolu ${i * 6 + k + 1}.`).join(' '));
  let state = null;
  for (let turn = 1; turn <= 8; turn++) {
    state = mergeFactState(state, { new_facts: Array.from({ length: 6 }, (_, k) => fact(`asjaolu ${(turn - 1) * 6 + k + 1}`, 'user', turn, `Asjaolu ${(turn - 1) * 6 + k + 1}.`)),
      superseded: [], needs: [], unknowns: [], periods: [], language_hint: 'et' }, turns(texts.slice(0, turn)), { people: [], focus: 'user' });
  }
  const current = state.facts.filter(entry => entry.status === 'current');
  assert.equal(current.length, FACT_LIMITS.active);
  assert.equal(current[0].id, 'F33');
  assert(state.facts.length <= FACT_LIMITS.history);
  assert.equal(state.facts.at(-1).id, 'F48');
  assert.deepEqual(state.model.dropped, []);
});

test('v4 projection: the previous v4 state is the next turn\'s, the model part merges and the people come from the plan', () => {
  const t = ['Elan Tartu vallas ja mul on võlad.'];
  const first = projectDialogueAnswer({ ...answer, dialogue_state: { new_facts: [fact('võlad', 'user', 1, 'mul on võlad')], superseded: [], needs: [], unknowns: [],
    periods: [], language_hint: 'et' } }, { reference_map: {} }, accepted(t), { regions: directory }, null, FACT_STATE_VERSION,
  { places: [{ person: 'user', region: 'tartu_vald', relation: 'lives', quote: 'Tartu vallas', sentence: 'Elan Tartu vallas ja mul on võlad.' }], person: 'user' });
  assert.equal(first.audit.version, FACT_STATE_VERSION);
  assert.deepEqual(first.audit.value.people, [{ person: 'user', region: { id: 'tartu_vald', status: 'reported', support: [{ turn: 1, quote: 'Elan Tartu vallas ja mul on võlad.' }] } }]);
  const t2 = [...t, 'Naabrimees elab Kose vallas ja vajab abi.'];
  const second = projectDialogueAnswer({ ...answer, dialogue_state: { new_facts: [fact('abivajadus', 'naabrimees', 2, 'vajab abi')], superseded: [], needs: [], unknowns: [],
    periods: [], language_hint: 'et' } }, { reference_map: {} }, accepted(t2), { regions: directory }, first.audit, FACT_STATE_VERSION,
  { places: [{ person: 'naabrimees', region: 'kose_vald', relation: 'lives', quote: 'Kose vallas', sentence: 'Naabrimees elab Kose vallas ja vajab abi.' }], person: 'naabrimees' });
  assert.deepEqual(second.audit.value.people.map(entry => [entry.person, entry.region.id]), [['user', 'tartu_vald'], ['naabrimees', 'kose_vald']]);
  assert.equal(second.audit.value.focus, 'naabrimees');
  assert.deepEqual(second.audit.value.facts.map(entry => [entry.id, entry.person]), [['F1', 'user'], ['F2', 'naabrimees']]);
  assert.deepEqual(previousStateFor(second.audit, accepted([...t2, 'Jätka.'])), second.audit);
  // A malformed model state never rejects the turn's state in v4.
  const third = projectDialogueAnswer({ ...answer, dialogue_state: 'nonsense' }, { reference_map: {} }, accepted([...t2, 'Mul pole kusagil magada.']),
    { regions: directory }, second.audit, FACT_STATE_VERSION, { places: [], person: 'user' });
  assert.equal(third.audit.value.focus, 'user');
  assert.equal(third.audit.value.facts.length, 2);
  assert.throws(() => projectDialogueAnswer({ ...answer, dialogue_state: {} }, { reference_map: {} }, accepted(t2), { regions: directory },
    stateAudit({ facts: [] }, accepted(t), 'm4-dialogue-state-3'), FACT_STATE_VERSION, null), { code: 'dialogue_state_scope_mismatch' });
});

test('a place counts only as the message shows it: its own text, one municipality, and the sentence decides a negation', async () => {
  const text = 'Minu elukoht ei ole Kose vald. Naaber elab Harku vallas. Käin tööl Tartu vallas.';
  const checked = await checkedPlaces([
    { quote: 'Kose vald', person: 'user', relation: 'lives' },
    { quote: 'Harku vallas', person: 'Naaber', relation: 'lives' },
    { quote: 'Tartu vallas', person: 'user', relation: 'other' },
    { quote: 'Rae vallas', person: 'user', relation: 'lives' },
    { quote: 'Mars', person: 'user', relation: 'lives' },
  ], text, directory, analyzer);
  assert.deepEqual(checked.map(place => [place.person, place.region, place.relation]),
    [['user', 'kose_vald', 'not'], ['naaber', 'harku_vald', 'lives'], ['user', 'tartu_vald', 'other']]);
  const people = nextPeople([{ person: 'user', region: { id: 'kose_vald', status: 'reported', support: [] } }], checked, 3);
  assert.deepEqual(people.map(entry => [entry.person, entry.region.id]), [['user', null], ['naaber', 'harku_vald']]);
  assert.equal(nextFocus('user', 'unclear'), 'user');
  assert.equal(nextFocus('user', ' Ema '), 'ema');
});

test('Codex review 29.09: the catalogue follows the person the message is about, with the same reading as the state', async () => {
  const scope = (previousValue, places, person, text) => placeScope({ previousValue, places, person, turn: { turnId: 't', text, mode: 'same' }, directory, analyzer });
  const motherOnly = { people: [{ person: 'ema', region: { id: 'kose_vald', status: 'reported', support: [] } }], focus: 'ema' };
  // The mother in Kose vald, the user's own place unknown: the user's own request gets none.
  assert.deepEqual(await scope(motherOnly, [], 'user', 'Kust saan mina oma elukohas abi?'), { state: 'region_required', region: null, person: 'user' });
  assert.equal((await scope(motherOnly, [], 'ema', 'Kellele ma helistan?')).region, 'kose_vald');
  // The user in Harku vald names the neighbour's Kose vald in the same message.
  const user = { people: [{ person: 'user', region: { id: 'harku_vald', status: 'reported', support: [] } }], focus: 'user' };
  const text = 'Naabri omavalitsus on Kose vald. Millist abi saan mina oma vallast?';
  const places = await checkedPlaces([{ quote: 'Kose vald', person: 'naaber', relation: 'lives' }], text, directory, analyzer);
  assert.equal((await scope(user, places, 'user', text)).region, 'harku_vald');
  // A move of the user's own: the message's place wins.
  const moved = await checkedPlaces([{ quote: 'Kose valda', person: 'user', relation: 'lives' }], 'Kolisin Kose valda.', directory, analyzer);
  assert.deepEqual(await scope(user, moved, 'user', 'Kolisin Kose valda.'), { state: 'person_mentioned_region', region: 'kose_vald', person: 'user', interpretation: 'source_scope_only_not_confirmed_residence' });
  // A negated sentence clears the user's own place.
  const negated = await checkedPlaces([{ quote: 'Harku vald', person: 'user', relation: 'lives' }], 'Minu elukoht ei ole enam Harku vald.', directory, analyzer);
  assert.deepEqual(await scope(user, negated, 'user', 'Minu elukoht ei ole enam Harku vald.'), { state: 'region_required', region: null, person: 'user' });
  // The plan could not tell, or it named no place although the message names one: the resolver decides as before.
  assert.equal(await scope(user, [], 'unclear', 'Aga edasi?'), null);
  assert.equal(await scope(user, [], 'user', 'Elan Tartu vallas.'), null);
});

test('after a turn whose state was not kept, the places of its message still reach the next state, the latest message first', async () => {
  // Turn 1 named the user's Kose vald but its answer was rejected; turn 2 names no place.
  const unread = [{ turn: 1, text: 'Olen 78-aastane ja elan üksi Kose vallas. Poeg elab Tartu vallas.' }, { turn: 2, text: 'Lisaks kukkusin eile kodus.' }];
  const places = await checkedPlaces([{ quote: 'Tartu vallas', person: 'poeg', relation: 'lives' }, { quote: 'Kose vallas', person: 'user', relation: 'lives' },
    { quote: 'Tartus', person: 'user', relation: 'lives' }], unread, directory, analyzer);
  assert.deepEqual(places.map(place => [place.person, place.region, place.turn]), [['poeg', 'tartu_vald', 1], ['user', 'kose_vald', 1]]);
  assert.deepEqual(nextPeople(null, places, 2).map(entry => [entry.person, entry.region.id, entry.region.support[0].turn]),
    [['user', 'kose_vald', 1], ['poeg', 'tartu_vald', 1]]);
  const scope = (list, text) => placeScope({ previousValue: null, places: list, person: 'user', turn: { turnId: 't2', text, mode: 'same' }, turnNumber: 2, directory, analyzer });
  assert.equal((await scope(places, 'Lisaks kukkusin eile kodus.')).region, 'kose_vald');
  // A later message moves the user, or says they no longer live there: the later message wins.
  const moved = await checkedPlaces([{ quote: 'Kose vallas', person: 'user', relation: 'lives' }, { quote: 'Harku valda', person: 'user', relation: 'lives' }],
    [{ turn: 1, text: 'Elan Kose vallas.' }, { turn: 2, text: 'Kolisin eile Harku valda.' }], directory, analyzer);
  assert.equal((await scope(moved, 'Kolisin eile Harku valda.')).region, 'harku_vald');
  assert.equal(nextPeople(null, moved, 2)[0].region.id, 'harku_vald');
  const left = await checkedPlaces([{ quote: 'Kose vallas', person: 'user', relation: 'lives' }, { quote: 'Kose vallas', person: 'user', relation: 'not' }],
    [{ turn: 1, text: 'Elan Kose vallas.' }, { turn: 2, text: 'Ma ei ela enam Kose vallas.' }], directory, analyzer);
  assert.deepEqual(left.map(place => [place.relation, place.turn]), [['not', 2], ['not', 2]]);
  assert.deepEqual(await scope(left, 'Ma ei ela enam Kose vallas.'), { state: 'region_required', region: null, person: 'user' });
});

test('prompt 19: one circumstance per fact, so a correction replaces only what it concerns (measured 30.09: a whole-message fact lost "kaks last")', () => {
  assert.match(FACT_STATE_INSTRUCTIONS, /one circumstance per fact with the clause that states it/);
  assert.match(FACT_STATE_INSTRUCTIONS, /never one fact for the whole message/);
});
