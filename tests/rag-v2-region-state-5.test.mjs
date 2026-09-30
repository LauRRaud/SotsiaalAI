import test from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { checkedTurnPlaces, resolvePersonRegions, personRegionScope, regionTarget } from '../lib/rag-v2/pilot/person-places.js';
import { queryPlanRequest, SEARCH_ASSIST_VERSION } from '../lib/rag-v2/pilot/search-assist.js';
import { knowledgeRegionScope, locateQuote } from '../lib/rag-v2/pilot/record-scope.js';
import { projectDialogueAnswer, stateAudit, REGION_STATE_VERSION, FACT_STATE_VERSION } from '../lib/rag-v2/pilot/dialogue-state.js';
import { PilotService } from '../lib/rag-v2/pilot/service.js';
import { DIALOGUE_VERSION } from '../lib/rag-v2/pilot/dialogue.js';

// Codex follow-up review 29.09 (J1-J3): one reading of each person's municipality for the search and the saved state.
// A stand-in for EstNLTK: each word reads as itself and, for the inflected fixture words, its lemma.
const LEMMAS = { vallas: 'vald', valda: 'vald' };
const analyzer = { analyze: async words => words.map(word => { const lower = word.toLowerCase(); return `vmet${lower}${LEMMAS[lower] ? ` vmet${LEMMAS[lower]}` : ''}`; }) };
const directory = [{ region: 'harku_vald', names: ['Harku vald'] }, { region: 'kose_vald', names: ['Kose vald'] }, { region: 'tartu_vald', names: ['Tartu vald'] },
  { region: 'tallinn', names: ['Tallinn'] }, { region: 'kohtla_jarve_linn', names: ['Kohtla-Järve linn', 'Kohtla-Järve'] }];
const place = (turn, quote, person, relation, name = quote) => ({ turn, quote, name, person, relation });
const regions = people => Object.fromEntries(people.map(entry => [entry.person, [entry.region.id, entry.region.status]]));

test('J2: the clause of the person decides, not the first sentence with the same place; a repeated clause stays unresolved', async () => {
  const messages = [{ turn: 1, text: 'Mina ei ela Kose vallas. Minu ema elab Kose vallas.' }];
  const checked = await checkedTurnPlaces([place(1, 'Minu ema elab Kose vallas', 'ema', 'lives'), place(1, 'Mina ei ela Kose vallas', 'user', 'not')],
    messages, directory, analyzer);
  assert.deepEqual(checked.map(item => [item.person, item.region, item.relation]), [['ema', 'kose_vald', 'lives'], ['user', 'kose_vald', 'not']]);
  assert.deepEqual(regions(resolvePersonRegions([], checked, 'ema')), { ema: ['kose_vald', 'reported'], user: [null, 'negated'] });
  // The place name alone is in both sentences: no occurrence is guessed.
  const short = await checkedTurnPlaces([place(1, 'Kose vallas', 'ema', 'lives')], messages, directory, analyzer);
  assert.deepEqual(short.map(item => [item.relation, item.reason]), [['unresolved', 'quote_repeated']]);
  assert.deepEqual(regions(resolvePersonRegions([], short, 'ema')), { ema: [null, 'unresolved'] });
});

test('J2: a place comes from the message it names; a wrong message leaves it unresolved', async () => {
  const messages = [{ turn: 1, text: 'Ema elab Harku vallas.' }, { turn: 2, text: 'Naaber elab Harku vallas.' }];
  const named = await checkedTurnPlaces([place(2, 'Naaber elab Harku vallas', 'naaber', 'lives')], messages, directory, analyzer);
  assert.deepEqual(named.map(item => [item.person, item.turn, item.relation]), [['naaber', 2, 'lives']]);
  const wrong = await checkedTurnPlaces([place(1, 'Naaber elab Harku vallas', 'naaber', 'lives'), place(3, 'Ema elab Harku vallas', 'ema', 'lives')],
    messages, directory, analyzer);
  assert.deepEqual(wrong.map(item => [item.person, item.relation, item.reason]), [['naaber', 'unresolved', 'quote_not_in_turn'], ['ema', 'unresolved', 'quote_not_in_turn']]);
});

test('J3: two places of one person stay ambiguous in the next state and the next search; one move replaces, in any order', async () => {
  const messages = [{ turn: 1, text: 'Elan nii Harku vallas kui ka Kose vallas.' }];
  const both = await checkedTurnPlaces([place(1, 'Elan nii Harku vallas', 'user', 'lives'), place(1, 'kui ka Kose vallas', 'user', 'lives')], messages, directory, analyzer);
  const people = resolvePersonRegions([], both, 'user');
  assert.deepEqual(people[0].region.candidates, ['harku_vald', 'kose_vald']);
  assert.equal(people[0].region.status, 'ambiguous');
  const next = await personRegionScope({ previousValue: { people }, places: [], person: 'user', turn: { turnId: 't2', text: 'Millist abi ma saan?', mode: 'same' },
    turnNumber: 2, directory, analyzer });
  assert.deepEqual(next, { state: 'ambiguous_region', region: null, candidates: ['harku_vald', 'kose_vald'], person: 'user' });
  // "Ma ei ela enam Harku vallas, elan nüüd Kose vallas": Kose, whichever order the plan lists the two places in.
  const move = [{ turn: 2, text: 'Ma ei ela enam Harku vallas, elan nüüd Kose vallas.' }];
  const places = [place(2, 'Ma ei ela enam Harku vallas', 'user', 'not'), place(2, 'elan nüüd Kose vallas', 'user', 'lives')];
  for (const order of [places, [...places].reverse()]) {
    const checked = await checkedTurnPlaces(order, move, directory, analyzer);
    const region = resolvePersonRegions([{ person: 'user', region: { id: 'harku_vald', status: 'reported', support: [] } }], checked, 'user')[0].region;
    assert.deepEqual([region.id, region.status, region.excluded], ['kose_vald', 'reported', ['harku_vald']]);
  }
  // The plan may quote the whole sentence for both places: its name picks the place among the clause's own, and the
  // negation is read at that place (measured 29.09: the unpicked sentence left the user without a place).
  const sentence = 'Ma ei ela enam Harku vallas, elan nüüd Kose vallas';
  const whole = [place(2, sentence, 'user', 'lives', 'Harku vald'), place(2, sentence, 'user', 'lives', 'Kose vald')];
  for (const order of [whole, [...whole].reverse()]) {
    const checked = await checkedTurnPlaces(order, move, directory, analyzer);
    assert.deepEqual(checked.map(item => [item.region, item.relation]).sort(), [['harku_vald', 'not'], ['kose_vald', 'lives']]);
    const region = resolvePersonRegions([{ person: 'user', region: { id: 'harku_vald', status: 'reported', support: [] } }], checked, 'user')[0].region;
    assert.deepEqual([region.id, region.status, region.excluded], ['kose_vald', 'reported', ['harku_vald']]);
  }
  // A name the clause does not have picks nothing.
  const other = await checkedTurnPlaces([place(2, sentence, 'user', 'lives', 'Tartu vald')], move, directory, analyzer);
  assert.deepEqual(other.map(item => [item.region, item.relation, item.reason]), [[null, 'unresolved', 'quote_names_several_places']]);
});

test('J1: a negated place is not restored by a search query, and a later negation never brings back a replaced place', async () => {
  const before = [{ person: 'user', region: { id: 'kose_vald', status: 'reported', support: [] } }];
  const messages = [{ turn: 2, text: 'Minu elukoht ei ole Kose vald.' }];
  const checked = await checkedTurnPlaces([place(2, 'Minu elukoht ei ole Kose vald', 'user', 'lives')], messages, directory, analyzer);
  assert.equal(checked[0].relation, 'not'); // the sentence decides, whatever the plan said
  const scope = await personRegionScope({ previousValue: { people: before }, places: checked, person: 'user', turn: { turnId: 't2', text: messages[0].text, mode: 'same' },
    turnNumber: 2, directory, analyzer });
  assert.deepEqual(scope, { state: 'region_required_after_negation', region: null, person: 'user' });
  assert.deepEqual(await knowledgeRegionScope(scope, ['Kose vald sotsiaalabi'], directory, analyzer), scope);
  // An unresolved attribution is a decision too; a place nobody gave may still come from the queries.
  const unresolved = { state: 'region_required', region: null, person: 'user', reason: 'attribution_unresolved' };
  assert.deepEqual(await knowledgeRegionScope(unresolved, ['Kose vald sotsiaalabi'], directory, analyzer), unresolved);
  assert.equal((await knowledgeRegionScope({ state: 'region_required', region: null, person: 'user' }, ['Kose vald sotsiaalabi'], directory, analyzer)).region, 'kose_vald');
  // Kose, then a move to Harku, then "not in Harku": nobody's place, never Kose again.
  const moved = resolvePersonRegions(before, [{ turn: 2, person: 'user', region: 'harku_vald', relation: 'lives', sentence: 'Kolisin Harku valda.' }], 'user');
  const left = resolvePersonRegions(moved, [{ turn: 3, person: 'user', region: 'harku_vald', relation: 'not', sentence: 'Ma ei ela enam Harku vallas.' }], 'user');
  assert.deepEqual([left[0].region.id, left[0].region.status, left[0].region.excluded], [null, 'negated', ['harku_vald']]);
});

test('J1-J3: another person\'s new place changes only that person; the saved state is the search scope\'s own reading', async () => {
  const before = [{ person: 'user', region: { id: 'tartu_vald', status: 'reported', support: [] } }];
  const messages = [{ turn: 2, text: 'Mu ema elab Kose vallas. Kuhu ta pöörduda saab?' }];
  const checked = await checkedTurnPlaces([place(2, 'Mu ema elab Kose vallas', 'ema', 'lives')], messages, directory, analyzer);
  const people = resolvePersonRegions(before, checked, 'ema');
  assert.deepEqual(regions(people), { user: ['tartu_vald', 'reported'], ema: ['kose_vald', 'reported'] });
  const scope = await personRegionScope({ previousValue: { people: before }, places: checked, person: 'ema', turn: { turnId: 't2', text: messages[0].text, mode: 'same' },
    turnNumber: 2, directory, analyzer });
  assert.deepEqual([scope.state, scope.region], ['person_mentioned_region', 'kose_vald']);
  // The v5 projection saves the same reading; v4 keeps its own.
  const turns = texts => texts.map((text, i) => ({ turnId: `t${i + 1}`, text, mode: i ? 'same' : 'new', correctionOf: null }));
  const accepted = texts => ({ context: { scopeId: 'topic', personId: 'person' }, selection: {}, userTurns: turns(texts) });
  const answer = { kind: 'clarification', blocks: [], limitations: [], clarification: 'Kus ema elab?' };
  const first = accepted(['Elan Tartu vallas.']);
  const previous = stateAudit({ facts: [], needs: [], unknowns: [], periods: [], language_hint: null, people: before, focus: 'user', model: { accepted: true, dropped: [] } },
    first, REGION_STATE_VERSION);
  const projected = projectDialogueAnswer({ ...answer, dialogue_state: {} }, { reference_map: {} }, accepted(['Elan Tartu vallas.', messages[0].text]),
    { regions: directory }, previous, REGION_STATE_VERSION, { places: checked, person: 'ema' });
  assert.deepEqual(regions(projected.audit.value.people), regions(people));
  assert.equal(projected.audit.value.focus, 'ema');
  assert.notEqual(REGION_STATE_VERSION, FACT_STATE_VERSION);
});

test('a place in another script is the municipality the plan names only when a word of the clause is that name', async () => {
  const messages = [{ turn: 1, text: 'Моя мама живёт в Козе. Я больше не живу в Таллинне, мой брат живёт в Кохтла-Ярве.' }];
  const checked = await checkedTurnPlaces([place(1, 'Моя мама живёт в Козе', 'ema', 'lives', 'Kose vald'),
    place(1, 'Я больше не живу в Таллинне', 'user', 'lives', 'Tallinn'), place(1, 'мой брат живёт в Кохтла-Ярве', 'vend', 'lives', 'Kohtla-Järve linn')],
  messages, directory, analyzer);
  // The negation is read in the clause, whatever the plan said.
  assert.deepEqual(checked.map(item => [item.person, item.region, item.relation]),
    [['ema', 'kose_vald', 'lives'], ['user', 'tallinn', 'not'], ['vend', 'kohtla_jarve_linn', 'lives']]);
  assert.deepEqual(regions(resolvePersonRegions([], checked, 'ema')), { ema: ['kose_vald', 'reported'], user: [null, 'negated'], vend: ['kohtla_jarve_linn', 'reported'] });
  // A name no word of the clause is, or a name of several places, leaves the person's place unresolved.
  const wrong = await checkedTurnPlaces([place(1, 'Моя мама живёт в Козе', 'ema', 'lives', 'Tallinn')], messages, directory, analyzer);
  assert.deepEqual(wrong.map(item => [item.region, item.relation, item.reason]), [[null, 'unresolved', 'place_link_unverified']]);
  assert.deepEqual(regions(resolvePersonRegions([], wrong, 'ema')), { ema: [null, 'unresolved'] });
  const scope = await personRegionScope({ previousValue: null, places: wrong, person: 'ema', turn: { turnId: 't1', text: messages[0].text, mode: 'new' },
    turnNumber: 1, directory, analyzer });
  assert.equal((await knowledgeRegionScope(scope, ['Kose vald koduteenus'], directory, analyzer)).region, null);
  // A village or district that is no municipality gives nobody a place.
  assert.deepEqual(await checkedTurnPlaces([place(1, 'Моя мама живёт в Козе', 'ema', 'lives', 'Ardu küla')], messages, directory, analyzer), []);
});

// Codex 7.2: an answer stored under state v4 before v5 existed, made once with the code of commit 21aabc81b and never
// recomputed with newer code, reads and restores unchanged; a changed stored state still fails closed.
test('a v4 answer stored before state v5 projects and restores unchanged; a changed stored state fails the check', () => {
  const stored = JSON.parse(fs.readFileSync(new URL('./fixtures/rag-v2-dialogue-state-4-answer.json', import.meta.url), 'utf8'));
  assert.equal(stored.version, FACT_STATE_VERSION);
  const projected = projectDialogueAnswer(stored.draft, stored.packet, stored.contextAudit, stored.stateContext, stored.previous, stored.version, stored.server);
  assert.deepEqual(projected.answer, stored.expected.answer);
  assert.deepEqual(projected.audit, stored.expected.audit);
  const service = new PilotService({ store: null, readConfig: async () => null, adapters: {}, call: async () => { throw Error('no model call in a restore'); } });
  const config = { dialogueVersion: DIALOGUE_VERSION, dialogueStateVersion: stored.version };
  const row = { payload: { requestAudit: { dialogueStateVersion: stored.version }, responseAudit: { draft: { text: JSON.stringify(stored.draft), truncated: false } },
    packet: stored.packet, contextAudit: stored.contextAudit, dialogueStateContext: stored.stateContext, previousDialogueState: stored.previous,
    searchAssist: { places: stored.server.places, person: stored.server.person }, dialogueState: stored.expected.audit, answer: stored.expected.answer } };
  assert.doesNotThrow(() => service.checkDialogueState(config, row));
  const changed = structuredClone(row);
  changed.payload.dialogueState.value.people[1].region.id = 'harku_vald';
  assert.throws(() => service.checkDialogueState(config, changed), { code: 'dialogue_state_projection_mismatch' });
  // Under a v5 plan the same stored turn is another contract's and is not restored as v5.
  assert.throws(() => service.checkDialogueState({ ...config, dialogueStateVersion: REGION_STATE_VERSION }, row), { code: 'dialogue_state_unavailable' });
});

// ---- The review of state v5 (Codex, 29.09 evening; docs/audits/rag-v2-state-v5-review-2026-09-29.md) ----
const saved = (person, id) => ({ person, region: { id, status: 'reported', candidates: [], excluded: [], support: [] } });
const scopeFor = (previousValue, places, person, turnNumber) => personRegionScope({ previousValue, places, person, turnNumber, directory });
const read = (texts, readCount) => texts.map((text, index) => ({ turn: index + 1, text, read: index < readCount }));

test('V1: a place change the plan left out is one decision for search and memory, and the next turn keeps it', async () => {
  const before = { people: [saved('user', 'kose_vald')], focus: 'user' };
  const texts = ['Elan Kose vallas.', 'Ma ei ela enam Kose vallas.'];
  // The plan names the user but lists no place: the server reads the user's own first-person negation.
  const checked = await checkedTurnPlaces([], read(texts, 1), directory, analyzer, { target: 'user', previousPeople: before.people });
  assert.deepEqual(checked.map(item => [item.person, item.region, item.relation, item.reason]), [['user', 'kose_vald', 'not', 'server_read_negation']]);
  const scope = await scopeFor(before, checked, 'user', 2);
  assert.deepEqual(scope, { state: 'region_required_after_negation', region: null, person: 'user' });
  assert.equal((await knowledgeRegionScope(scope, ['Kose vald toimetulekutoetus'], directory, analyzer)).region, null);
  const people = resolvePersonRegions(before.people, checked, 'user');
  assert.deepEqual(regions(people), { user: [null, 'negated'] });
  // "Millist abi ma saan?": no Kose again.
  const next = await checkedTurnPlaces([], read([...texts, 'Millist abi ma saan?'], 2), directory, analyzer, { target: 'user', previousPeople: people });
  assert.deepEqual(next, []);
  assert.equal((await scopeFor({ people, focus: 'user' }, next, 'user', 3)).region, null);
  // An unclear plan: the negation is the user's own, so only the user loses Kose; the mother keeps it (Codex N1).
  const both = { people: [saved('user', 'kose_vald'), saved('ema', 'kose_vald')], focus: 'ema' };
  const unclear = await checkedTurnPlaces([], read(texts, 1), directory, analyzer, { target: regionTarget('unclear', both), previousPeople: both.people });
  assert.deepEqual(regions(resolvePersonRegions(both.people, unclear, 'ema')), { user: [null, 'negated'], ema: ['kose_vald', 'reported'] });
  // A mention whose person the text does not show ("Ei ela enam Kose vallas.", no pronoun): the target and everyone who
  // lives there get no place from it.
  const bare = await checkedTurnPlaces([], read(['Elan Kose vallas.', 'Ei ela enam Kose vallas.'], 1), directory, analyzer, { target: 'ema', previousPeople: both.people });
  assert.deepEqual(regions(resolvePersonRegions(both.people, bare, 'ema')), { user: [null, 'unresolved'], ema: [null, 'unresolved'] });
  // A partial plan: the mother's new place is checked; the user's negation it left out still reaches the user.
  const partial = ['Elan Kose vallas.', 'Ema elab Harku vallas. Mina ei ela enam Kose vallas.'];
  const half = await checkedTurnPlaces([place(2, 'Ema elab Harku vallas', 'ema', 'lives', 'Harku vald')], read(partial, 1), directory, analyzer,
    { target: 'ema', previousPeople: before.people });
  assert.deepEqual(regions(resolvePersonRegions(before.people, half, 'ema')), { user: [null, 'negated'], ema: ['harku_vald', 'reported'] });
  // A move with only the new place in the plan (measured 30.09): the old place's negation is the user's own, the new place stays.
  const move = read(['Elan Kose vallas.', 'Ma ei ela enam Kose vallas, elan nüüd Harku vallas.'], 1);
  const moved = await checkedTurnPlaces([place(2, 'elan nüüd Harku vallas', 'user', 'lives', 'Harku vald')], move, directory, analyzer, { target: 'user', previousPeople: before.people });
  const movedRegion = resolvePersonRegions(before.people, moved, 'user')[0].region;
  assert.deepEqual([movedRegion.id, movedRegion.status, movedRegion.excluded], ['harku_vald', 'reported', ['kose_vald']]);
  // Another person's home the plan left out is read for the one person its clause names, and changes nobody else.
  const other = await checkedTurnPlaces([], read(['Elan Kose vallas.', 'Ema elab Harku vallas.'], 1), directory, analyzer, { target: 'ema', previousPeople: before.people });
  assert.deepEqual(regions(resolvePersonRegions(before.people, other, 'ema')), { user: ['kose_vald', 'reported'], ema: ['harku_vald', 'reported'] });
  // A plan quote that shows the person but not the place (measured 30.09): the clause that names the neighbour is read.
  const neighbour = await checkedTurnPlaces([place(2, 'Mu naabrimees on eakas', 'naabrimees', 'lives', 'Kose vald')],
    read(['Elan Tartu vallas.', 'Mu naabrimees on eakas ja elab Kose vallas. Ta ei saa enam hakkama.'], 1), directory, analyzer, { target: 'naabrimees', previousPeople: [saved('user', 'tartu_vald')] });
  assert.deepEqual(regions(resolvePersonRegions([saved('user', 'tartu_vald')], neighbour, 'naabrimees')), { user: ['tartu_vald', 'reported'], naabrimees: ['kose_vald', 'reported'] });
  // Another mention of a named person's place, not a home, still decides nothing for them.
  const visit = await checkedTurnPlaces([], read(['Elan Kose vallas.', 'Ema käib Harku vallas arsti juures.'], 1), directory, analyzer, { target: 'ema', previousPeople: before.people });
  assert.deepEqual(regions(resolvePersonRegions(before.people, visit, 'ema')), { user: ['kose_vald', 'reported'], ema: [null, 'unresolved'] });
});

test('a residence the plan left out: the user\'s own first-person home is read, a plural one reaches a person with no place yet', async () => {
  const only = [saved('user', 'kose_vald')];
  const after = async (text, plan, people, target = 'user') => {
    const checked = await checkedTurnPlaces(plan, read(['Tere.', text], 1), directory, analyzer, { target, previousPeople: people });
    return regions(resolvePersonRegions(people, checked, target));
  };
  // "Olen Harkus." (measured 30.09: the plan listed no place); a home verb or a place that ends the clause.
  assert.deepEqual(await after('Olen Harku vallas.', [], only), { user: ['harku_vald', 'reported'] });
  assert.deepEqual(await after('Elan nüüd Harku vallas ja mul on raske.', [], only), { user: ['harku_vald', 'reported'] });
  assert.deepEqual(await after('Я живу в Харку.', [], only), { user: ['harku_vald', 'reported'] });
  assert.deepEqual(await after('Olen Harku vallas tööl.', [], only), { user: [null, 'unresolved'] });
  assert.deepEqual(await after('Käin Harku vallas arsti juures.', [], only), { user: [null, 'unresolved'] });
  // "Me elame …": the user's home, and the target's when the target has none yet; it never replaces a known place.
  const child = [saved('user', 'kose_vald'), { person: 'naabri laps', region: { id: null, status: 'unknown', candidates: [], excluded: [], support: [] } }];
  const plan = [place(2, 'Me elame Harku vallas', 'user', 'lives', 'Harku vald')];
  assert.deepEqual(await after('Me elame Harku vallas.', plan, child, 'naabri laps'), { user: ['harku_vald', 'reported'], 'naabri laps': ['harku_vald', 'reported'] });
  assert.deepEqual(await after('Me elame Harku vallas.', [], child, 'naabri laps'), { user: ['harku_vald', 'reported'], 'naabri laps': ['harku_vald', 'reported'] });
  const mother = [saved('user', 'kose_vald'), saved('ema', 'tartu_vald')];
  assert.deepEqual(await after('Me elame Harku vallas.', plan, mother, 'ema'), { user: ['harku_vald', 'reported'], ema: ['tartu_vald', 'reported'] });
  // A named person's home with the subject between the verb and the place (measured 30.09: "tegelikult elab ema Harkus");
  // "ei ela ema …" is a negation; another clause's work place does not take a new home away; a visit decides nothing.
  const emaKose = [saved('ema', 'kose_vald')];
  assert.deepEqual(await after('Vabandust, tegelikult elab ema Harku vallas.', [], emaKose, 'ema'), { ema: ['harku_vald', 'reported'] });
  assert.deepEqual(await after('Tegelikult ei ela ema Harku vallas.', [], emaKose, 'ema'), { ema: ['kose_vald', 'reported'] });
  assert.deepEqual(await after('Ema elab Tartu vallas, aga töötab Harku vallas.', [], emaKose, 'ema'), { ema: ['tartu_vald', 'reported'] });
  assert.deepEqual(await after('Ema käib Harku vallas arsti juures.', [], emaKose, 'ema'), { ema: [null, 'unresolved'] });
  // A singular home stays the user's alone.
  assert.deepEqual(await after('Elan Harku vallas.', [place(2, 'Elan Harku vallas', 'user', 'lives', 'Harku vald')], child, 'naabri laps'),
    { user: ['harku_vald', 'reported'], 'naabri laps': [null, 'unknown'] });
});

test('whom an unclear plan\'s message is about: the one known person it names, unless it speaks in the first person; else the focus', () => {
  const value = { people: [saved('user', 'tallinn'), saved('ema', 'harku_vald'), saved('naabrimees', 'kose_vald')], focus: 'user' };
  assert.equal(regionTarget('ema', value, 'Kellele ma helistan?'), 'ema');
  assert.equal(regionTarget('unclear', value, 'Ja ema, kas tema saaks sotsiaaltransporti?'), 'ema');
  assert.equal(regionTarget('unclear', value, 'Kas emale saab koju abi tellida?'), 'ema');
  assert.equal(regionTarget('unclear', value, 'Kas ma saan emale abi?'), 'user');
  assert.equal(regionTarget('unclear', value, 'Kas ema või naabrimees saab abi?'), 'user');
  assert.equal(regionTarget('unclear', { ...value, focus: 'naabrimees' }, 'Mis edasi?'), 'naabrimees');
  assert.equal(regionTarget(null, null, 'Tere'), 'user');
});

test('N1-N3 (Codex 30.09): a mention is read where it is and for whom it is; a shared old place moves nobody else', async () => {
  const both = [saved('user', 'kose_vald'), saved('ema', 'kose_vald')], only = [saved('user', 'kose_vald')];
  const turn = async (text, plan, people, target = 'user') => {
    const checked = await checkedTurnPlaces(plan, read(['Mina ja ema elame Kose vallas.', text], 1), directory, analyzer, { target, previousPeople: people });
    return { checked, people: resolvePersonRegions(people, checked, target) };
  };
  // N1: the user moves; the mother, who lived in Kose too, keeps Kose, also when the next question is about her.
  const n1 = await turn('Ma ei ela enam Kose vallas, elan nüüd Harku vallas.', [place(2, 'elan nüüd Harku vallas', 'user', 'lives', 'Harku vald')], both);
  assert.deepEqual(regions(n1.people), { user: ['harku_vald', 'reported'], ema: ['kose_vald', 'reported'] });
  const ask = await checkedTurnPlaces([], read(['Mina ja ema elame Kose vallas.', 'Ma ei ela enam Kose vallas, elan nüüd Harku vallas.', 'Kellele ema helistama peaks?'], 2),
    directory, analyzer, { target: 'ema', previousPeople: n1.people });
  assert.equal((await scopeFor({ people: n1.people, focus: 'ema' }, ask, 'ema', 3)).region, 'kose_vald');
  // N2: the mother's checked Kose does not cover the user's own negation of Kose, in either order, nor does an "other" mention.
  for (const text of ['Ma ei ela enam Kose vallas. Ema elab Kose vallas.', 'Ema elab Kose vallas. Ma ei ela enam Kose vallas.']) {
    const n2 = await turn(text, [place(2, 'Ema elab Kose vallas', 'ema', 'lives', 'Kose vald')], only);
    assert.deepEqual(regions(n2.people), { user: [null, 'negated'], ema: ['kose_vald', 'reported'] }, text);
    assert.equal((await scopeFor({ people: only, focus: 'user' }, n2.checked, 'user', 2)).region, null, text);
  }
  const work = await turn('Ma ei ela enam Kose vallas. Käin Kose vallas tööl.', [place(2, 'Käin Kose vallas tööl', 'user', 'other', 'Kose vald')], only);
  assert.deepEqual(regions(work.people), { user: [null, 'negated'] });
  // N3: a negation in Russian or Estonian, before or after the work place; the work place never becomes a home.
  for (const [text, quote] of [['Я больше не живу в Козе, работаю в Харку.', 'работаю в Харку'], ['Работаю в Харку, я больше не живу в Козе.', 'Работаю в Харку'],
    ['Ma ei ela enam Kose vallas, töötan Harku vallas.', 'töötan Harku vallas'], ['Töötan Harku vallas, ma ei ela enam Kose vallas.', 'Töötan Harku vallas']]) {
    const n3 = await turn(text, [place(2, quote, 'user', 'other', 'Harku vald')], only);
    assert.deepEqual(regions(n3.people), { user: [null, 'negated'] }, text);
    assert.equal((await scopeFor({ people: only, focus: 'user' }, n3.checked, 'user', 2)).region, null, text);
  }
});

test('a place the plan lists again from a message the state has read changes nothing (measured 29.09: it erased the mother\'s Harku)', async () => {
  const people = [saved('ema', 'harku_vald')], texts = ['Mu ema elab Harku vallas ja vajab abi.', 'Kui palju see talle maksma läheb?'];
  const again = await checkedTurnPlaces([place(1, 'Mu ema elab Harku vallas', 'ema', 'lives', 'Harku vald'), place(2, 'Mu ema elab Harku vallas', 'ema', 'lives', 'Harku vald')],
    read(texts, 1), directory, analyzer, { target: 'ema', previousPeople: people });
  assert.deepEqual(again, []);
  assert.deepEqual(regions(resolvePersonRegions(people, again, 'ema')), { ema: ['harku_vald', 'reported'] });
  assert.equal((await scopeFor({ people, focus: 'ema' }, again, 'ema', 2)).region, 'harku_vald');
});

test('a quote that differs from the message only in case, spacing or punctuation is found, and the user\'s own words are read', async () => {
  assert.deepEqual(locateQuote('Elan Tartu vallas, mitte Kose vallas.', 'elan tartu vallas mitte Kose vallas'), { at: 0, length: 36, count: 1 });
  assert.deepEqual(locateQuote('Elan Harku  vallas. Elan Harku vallas!', 'Elan Harku vallas'), { at: 20, length: 17, count: 1 });
  assert.equal(locateQuote('Elan Harku vallas.', 'Elan Harju vallas'), null);
  assert.equal(locateQuote('Elan Harku  vallas. Elan Harku vallas!', 'elan harku vallas').count, 2);
  const checked = await checkedTurnPlaces([place(1, 'mina ei ela kose vallas', 'user', 'lives', 'Kose vald')], [{ turn: 1, text: 'Mina ei ela Kose vallas.' }], directory, analyzer);
  assert.deepEqual(checked.map(item => [item.region, item.relation, item.quote]), [['kose_vald', 'not', 'Mina ei ela Kose vallas']]);
});

test('V2: the chosen place must have one mention in the quote; a whole sentence with the same place twice decides nothing', async () => {
  for (const [text, user, ema] of [['Mina elan Kose vallas, aga ema ei ela Kose vallas.', 'lives', 'not'], ['Mina ei ela Kose vallas, aga ema elab Kose vallas.', 'not', 'lives']]) {
    const messages = [{ turn: 1, text }];
    const [userClause, emaClause] = text.slice(0, -1).split(', aga ');
    const exact = await checkedTurnPlaces([place(1, userClause, 'user', 'lives', 'Kose vald'), place(1, `aga ${emaClause}`, 'ema', 'lives', 'Kose vald')], messages, directory, analyzer);
    assert.deepEqual(exact.map(item => [item.person, item.relation]), [['user', user], ['ema', ema]], text);
    const whole = await checkedTurnPlaces([place(1, text.slice(0, -1), 'user', user, 'Kose vald'), place(1, text.slice(0, -1), 'ema', ema, 'Kose vald')], messages, directory, analyzer);
    // The mother's reading of it is also the user's first-person clause (V4); unresolved either way.
    assert.deepEqual(whole.map(item => [item.person, item.relation]), [['user', 'unresolved'], ['ema', 'unresolved']]);
    assert.equal(whole[0].reason, 'place_repeated_in_quote');
  }
});

test('V3: only a Cyrillic word that is exactly one municipality\'s name links; "koos" is no Kose and a name of two places decides nothing', async () => {
  const wide = [...directory, { region: 'tartu_linn', names: ['Tartu linn', 'Tartu'] }, { region: 'narva_linn', names: ['Narva linn', 'Narva'] },
    { region: 'johvi_vald', names: ['Jõhvi vald', 'Jõhvi'] }, { region: 'parnu_linn', names: ['Pärnu linn', 'Pärnu'] }, { region: 'narva_joesuu_linn', names: ['Narva-Jõesuu linn'] }];
  const link = async (text, name) => {
    const [item] = await checkedTurnPlaces([place(1, text, 'user', 'lives', name)], [{ turn: 1, text }], wide, analyzer);
    return item ? [item.region, item.relation, item.reason ?? null] : null;
  };
  // No place in the text: nothing to link, whatever the plan names.
  assert.deepEqual(await link('Ma elan koos emaga', 'Kose vald'), [null, 'unresolved', 'place_link_unverified']);
  assert.deepEqual(await link('Я живу с мамой', 'Kose vald'), [null, 'unresolved', 'place_link_unverified']);
  // Exact transliterations, with a Russian case ending and a hyphen.
  for (const [text, name, region] of [['Я живу в Козе', 'Kose vald', 'kose_vald'], ['Я живу в Таллине', 'Tallinn', 'tallinn'], ['Я живу в Нарве', 'Narva linn', 'narva_linn'],
    ['Я живу в Йыхви', 'Jõhvi vald', 'johvi_vald'], ['Я живу в Пярну', 'Pärnu linn', 'parnu_linn'], ['Я живу в Нарва-Йыэсуу', 'Narva-Jõesuu linn', 'narva_joesuu_linn']]) {
    assert.deepEqual(await link(text, name), [region, 'lives', null], text);
  }
  // Another municipality than the one the text names, and a name two municipalities share (Tartu linn and Tartu vald).
  assert.deepEqual(await link('Я живу в Нарве', 'Kose vald'), [null, 'unresolved', 'place_link_unverified']);
  assert.deepEqual(await link('Я живу в Тарту', 'Tartu vald'), [null, 'unresolved', 'name_matches_several_places']);
  // An ordinary Russian word near a name is none: "косой" (Kose ends in e and is not declined).
  assert.deepEqual(await link('Он смотрит косой взгляд', 'Kose vald'), [null, 'unresolved', 'place_link_unverified']);
});

test('V4: the plan gives another person the same place only when a message says they share it; a neighbour alone gets none', async () => {
  const { instructions } = queryPlanRequest({ model: 'm', searchAssist: SEARCH_ASSIST_VERSION }, ['Elan Harku vallas. Mu naaber vajab abi.'], 'et');
  assert.match(instructions, /Give another person the same place only when a message says so/);
  assert.match(instructions, /Being a neighbour, a relative or an acquaintance alone gives no place/);
  assert.doesNotMatch(instructions, /next door/);
  // The server too: the user's own first-person clause gives another person no place; living together or "we" does.
  const check = async (text, quote, person) => (await checkedTurnPlaces([place(1, quote, person, 'lives', 'Harku vald')], [{ turn: 1, text }], directory, analyzer))
    .map(item => [item.region, item.relation, item.reason ?? null]);
  assert.deepEqual(await check('Elan Harku vallas. Mu naaber vajab abi.', 'Elan Harku vallas', 'naaber'), [['harku_vald', 'unresolved', 'clause_is_the_users']]);
  assert.deepEqual(await check('Я живу в Харку. Соседу нужна помощь.', 'Я живу в Харку', 'сосед'), [['harku_vald', 'unresolved', 'clause_is_the_users']]);
  assert.deepEqual(await check('Elan Harku vallas. Mu naaber vajab abi.', 'Elan Harku vallas', 'user'), [['harku_vald', 'lives', null]]);
  assert.deepEqual(await check('Elan koos emaga Harku vallas.', 'Elan koos emaga Harku vallas', 'ema'), [['harku_vald', 'lives', null]]);
  assert.deepEqual(await check('Elan emaga Harku vallas.', 'Elan emaga Harku vallas', 'ema'), [['harku_vald', 'lives', null]]);
  assert.deepEqual(await check('Naabri laps on üksi. Me elame Harku vallas.', 'Me elame Harku vallas', 'naabri laps'), [['harku_vald', 'lives', null]]);
  assert.deepEqual(await check('Mu naabrimees elab Harku vallas.', 'Mu naabrimees elab Harku vallas', 'naabrimees'), [['harku_vald', 'lives', null]]);
});
