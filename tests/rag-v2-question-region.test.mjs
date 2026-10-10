import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { resolvePersonRegions, regionTarget, askedRegions, askedPerson } from '../lib/rag-v2/pilot/person-places.js';
import { namesPlaceByCommonWord } from '../lib/rag-v2/pilot/record-scope.js';
import { placeOccurrences, refersBack } from '../lib/rag-v2/pilot/record-scope.js';
import { runtimeAdapters } from '../lib/rag-v2/pilot/retrieval.js';
import { REGION_STATE_VERSION } from '../lib/rag-v2/pilot/dialogue-state.js';
import { SEARCH_ASSIST_VERSION } from '../lib/rag-v2/pilot/search-assist.js';
import { RECORD_RETRIEVAL_VERSION } from '../lib/rag-v2/search/structured-record-source.js';
import { municipalScope } from '../lib/rag-v2/search/unified.js';
import { DISCOVERY_SCHEMA } from '../lib/rag-v2/search/discovery.js';
import { validateCatalogue, checkTurn } from '../lib/rag-v2/pilot/conversation-eval.js';

// ADR-074: the municipality a question asks about is not where the person lives. The live questionnaire of 04.10.2026
// (docs/audits/rag-v2-live-questionnaire-2026-10-04.md) asked about another municipality after the user had said where
// they live; the search stayed in the municipality of residence (Q3, Q5), and where the plan's attribution did not reach
// the server, the residence itself was replaced by "unresolved" (Q6, Q7).
// Every turn here goes through the retrieval adapter's own place check and search scope (no database, no model): the
// catalogue and the knowledge lane read `source`, the saved state is resolvePersonRegions of the same checked places.
// A stand-in for EstNLTK: each word reads as itself and, for the inflected fixture words, its lemma. The directory has
// the shape the municipal adapter gives: the display name and the base name of each municipality.
const LEMMAS = { vallas: 'vald', valla: 'vald', valda: 'vald', vallast: 'vald', linnas: 'linn', linna: 'linn', maardus: 'maardu', maardusse: 'maardu', nõos: 'nõo', tartus: 'tartu', viimsis: 'viimsi', koses: 'kose',
  omavalitsuses: 'omavalitsus', elukohas: 'elukoht', linnades: 'linn' };
const analyzer = { analyze: async words => words.map(word => { const lower = word.toLowerCase(); return `vmet${lower}${LEMMAS[lower] ? ` vmet${LEMMAS[lower]}` : ''}`; }) };
const directory = [['anija_vald', 'Anija vald', 'Anija'], ['harku_vald', 'Harku vald', 'Harku'], ['kose_vald', 'Kose vald', 'Kose'], ['maardu_linn', 'Maardu linn', 'Maardu'],
  ['marjamaa_vald', 'Märjamaa vald', 'Märjamaa'], ['noo_vald', 'Nõo vald', 'Nõo'], ['pohja_sakala_vald', 'Põhja-Sakala vald', 'Põhja-Sakala'], ['tartu_linn', 'Tartu linn', 'Tartu'],
  ['tartu_vald', 'Tartu vald', 'Tartu'], ['viimsi_vald', 'Viimsi vald', 'Viimsi']].map(([region, ...names]) => ({ region, names }));
const config = { recordCatalogue: RECORD_RETRIEVAL_VERSION, dialogueStateVersion: REGION_STATE_VERSION, searchAssist: SEARCH_ASSIST_VERSION };
const runtime = runtimeAdapters(async () => config, 'user-1', { loadRegions: async () => directory, analyzer });
const saved = (person, id) => ({ person, region: { id, status: id ? 'reported' : 'unknown', candidates: [], excluded: [], support: id ? [{ turn: 1, quote: 'x' }] : [] } });
const regions = people => Object.fromEntries(people.map(entry => [entry.person, [entry.region.id, entry.region.status]]));
const place = (turn, quote, name, person, relation) => ({ turn, quote, name, person, relation });
// The municipal texts the knowledge lane keeps for a scope: one regulation per municipality beside a national act.
const municipalTexts = directory.map(row => ({ schema_version: DISCOVERY_SCHEMA, document_id: `kord-${row.region}`, version_id: 'v', source: { journal: false, record_kind: null },
  fields: { regions: { value: [row.region] } } }));
const keptTexts = scope => municipalScope(municipalTexts, scope).eligible.map(row => row.document_id.slice(5));

/**
 * One turn as the service runs it: texts are the topic's user messages (the last one is the current message, the state
 * has read the earlier ones), before is the saved state's value, plan the search plan's person, places and queries,
 * after the turn whose answer was published last (the service hands on the municipality that turn was asked about).
 */
async function turn({ before = null, texts, plan, after = null }) {
  const scopeTurns = texts.map((text, index) => ({ turnId: `t${index + 1}`, text, mode: index ? 'same' : 'new' }));
  const query = { scopeTurns, person: plan.person, previousState: before ? { value: before, sourceTurnIds: scopeTurns.slice(0, -1).map(item => item.turnId) } : null,
    // What the service hands on from the last published answer's scope: the asked municipality and whose question it was.
    ...(after && askedRegions(after.source).length ? { askedRegions: askedRegions(after.source), askedPerson: askedPerson(after.source) } : {}) };
  query.places = await runtime.checkedPlaces(config, query, plan.places || []);
  const { scope, knowledgeRegion } = await runtime.searchScope(config, query, directory, plan.queries || []);
  const focus = regionTarget(plan.person, before, texts.at(-1)), people = resolvePersonRegions(before?.people, query.places, focus);
  return { places: query.places, own: scope, source: knowledgeRegion, people: regions(people), value: { people, focus } };
}

// The topic of the live questionnaire's municipal conversation (ca1748f0), its messages word for word.
const LIVE = ['Elan Anija vallas ja mul on raha otsas. Kellele ma saan helistada?',
  'Mu ema elab Kose vallas ja vajab koduteenust. Kuidas seda taotleda ja kelle poole pöörduda?',
  'Kas Tartu vallas on sotsiaaltransport ja mis see maksab?',
  'Elan Nõo vallas. Kes on seal sotsiaaltööspetsialist?',
  'Kas Maardus saab isikliku abistaja teenust?',
  'Mis muutub Põhja-Sakala valla sotsiaalabi korras alates 6. oktoobrist?',
  'Kust leian Harku valla toimetulekutoetuse taotluse vormi?'];
// What the turn records of 04.10.2026 hold (M4PilotTurn.payload.searchAssist and previousDialogueState): the plan's
// person and queries and the checked place's quote and relation. The plan's own name for the place is not stored; the
// municipality's official name stands in for it here.
const STORED = {
  Q3: { before: { people: [saved('user', 'anija_vald'), saved('ema', 'kose_vald')], focus: 'ema' }, texts: LIVE.slice(0, 3),
    plan: { person: 'user', places: [place(3, 'Kas Tartu vallas on sotsiaaltransport ja mis see maksab?', 'Tartu vald', 'user', 'other')],
      queries: ['Tartu valla sotsiaaltransporditeenus taotlemine tingimused', 'Tartu vald sotsiaaltransporditeenuse hind omaosalus tasu arvestamine'] } },
  Q5: { before: { people: [saved('user', 'noo_vald'), saved('ema', 'kose_vald')], focus: 'user' }, texts: LIVE.slice(0, 5),
    plan: { person: 'user', places: [place(5, 'Kas Maardus saab isikliku abistaja teenust?', 'Maardu linn', 'user', 'other')],
      queries: ['Maardu isikliku abistaja teenuse korraldamine', 'Maardu isikliku abistaja teenuse taotlemine'] } },
  // Q6 and Q7: the record holds no place of the plan's, only the server's own "place_not_attributed".
  Q6: { before: { people: [saved('user', 'noo_vald'), saved('ema', 'kose_vald')], focus: 'user' }, texts: LIVE.slice(0, 6),
    plan: { person: 'user', places: [], queries: ['Põhja-Sakala valla sotsiaalhoolekandelise abi andmise kord 6. oktoober muudatused', 'Põhja-Sakala valla sotsiaalabi korra muudatuste jõustumine 6. oktoobril'] } },
  Q7: { before: { people: [saved('user', 'noo_vald'), saved('ema', 'kose_vald')], focus: 'user' }, texts: LIVE,
    plan: { person: 'user', places: [], queries: ['Harku valla toimetulekutoetuse taotluse vorm'] } },
  // The same questions as the first message of a conversation (R3, R5, R7), where the answers were right.
  R3: { texts: [LIVE[2]], plan: { person: 'user', places: [place(1, 'Tartu vallas', 'Tartu vald', 'user', 'other')],
    queries: ['Tartu valla sotsiaaltransporditeenuse korraldamine', 'Tartu valla sotsiaaltransporditeenuse hind omaosalus tasu'] } },
  R5: { texts: [LIVE[4]], plan: { person: 'user', places: [place(1, 'Kas Maardus saab isikliku abistaja teenust?', 'Maardu linn', 'user', 'other')],
    queries: ['Maardu isikliku abistaja teenuse korraldus ja saamise tingimused'] } },
  R7: { texts: [LIVE[6]], plan: { person: 'user', places: [place(1, 'Harku valla toimetulekutoetuse taotluse vormi', 'Harku vald', 'user', 'other')],
    queries: ['Harku valla toimetulekutoetuse taotluse vorm'] } },
};
const home = (region, person = 'user', state = 'person_region') => ({ state, region, person, interpretation: 'source_scope_only_not_confirmed_residence' });
const asked = (region, own, askedIn = 'current_message') => ({ state: 'question_region', region, asked_in: askedIn, person_scope: own,
  interpretation: 'asked_municipality_source_scope_not_residence' });
const nooState = { people: [saved('user', 'noo_vald')], focus: 'user' };

test('Q3 and Q5 of 04.10: a question about another municipality is searched there, and the residence stays as it was', async () => {
  const q3 = await turn(STORED.Q3);
  assert.deepEqual(q3.own, home('anija_vald'));
  assert.deepEqual(q3.source, asked('tartu_vald', home('anija_vald')));
  assert.deepEqual(keptTexts(q3.source), ['tartu_vald']);
  assert.deepEqual(q3.people, { user: ['anija_vald', 'reported'], ema: ['kose_vald', 'reported'] });
  const q5 = await turn(STORED.Q5);
  assert.deepEqual(q5.source, asked('maardu_linn', home('noo_vald')));
  assert.deepEqual(keptTexts(q5.source), ['maardu_linn']);
  assert.deepEqual(q5.people, { user: ['noo_vald', 'reported'], ema: ['kose_vald', 'reported'] });
  // The scope the answer reads names no person for the asked municipality: it is nobody's municipality.
  assert.equal('person' in q5.source, false);
});

test('Codex F1: a follow-up goes on with the asked municipality; a request about the person, or a new home, returns to the person', async () => {
  const q5 = await turn(STORED.Q5), texts = LIVE.slice(0, 5);
  // "Ja mis see maksab?": the message names no municipality, the plan's query still is about Maardu.
  const price = await turn({ before: q5.value, after: q5, texts: [...texts, 'Ja mis see maksab?'], plan: { person: 'user', places: [], queries: ['Maardu isikliku abistaja teenuse hind'] } });
  assert.deepEqual(price.source, asked('maardu_linn', home('noo_vald'), 'earlier_question'));
  assert.deepEqual(price.people, { user: ['noo_vald', 'reported'], ema: ['kose_vald', 'reported'] });
  // And once more: the follow-up's own scope is what the next turn goes on from.
  const apply = await turn({ before: price.value, after: price, texts: [...texts, 'Ja mis see maksab?', 'Kuidas seda taotleda?'],
    plan: { person: 'user', places: [], queries: ['Maardu isikliku abistaja teenuse taotlemine'] } });
  assert.deepEqual([apply.source.region, apply.source.asked_in, apply.people.user], ['maardu_linn', 'earlier_question', ['noo_vald', 'reported']]);
  // The user's own request: the plan's queries name the home or no municipality.
  for (const queries of [['koduteenuse taotlemine ja tingimused'], ['Nõo valla koduteenus'], ['Maardu koduteenus', 'Nõo valla koduteenus']]) {
    const own = await turn({ before: q5.value, after: q5, texts: [...texts, 'Aga millist koduteenust ma ise saan?'], plan: { person: 'user', places: [], queries } });
    assert.deepEqual(own.source, home('noo_vald'), queries.join(' | '));
    // After it, a query that names Maardu again has nothing to go on with: the last answer was about the home.
    const later = await turn({ before: own.value, after: own, texts: [...texts, 'Aga millist koduteenust ma ise saan?', 'Ja mis see maksab?'],
      plan: { person: 'user', places: [], queries: ['Maardu isikliku abistaja teenuse hind'] } });
    assert.deepEqual(later.source, home('noo_vald'), queries.join(' | '));
  }
  // A message that names a municipality itself is read for itself, not as a follow-up.
  const work = await turn({ before: q5.value, after: q5, texts: [...texts, 'Töötan muide Viimsis. Ja mis see maksab?'],
    plan: { person: 'user', places: [place(6, 'Töötan muide Viimsis', 'Viimsi vald', 'user', 'other')], queries: ['Maardu isikliku abistaja teenuse hind'] } });
  assert.deepEqual(work.source, home('noo_vald'));
  // A real move replaces the residence.
  const moved = await turn({ before: q5.value, after: q5, texts: [...texts, 'Kolisin vahepeal ära, elan nüüd Maardus.'],
    plan: { person: 'user', places: [place(6, 'elan nüüd Maardus', 'Maardu linn', 'user', 'lives')], queries: ['Maardu sotsiaalteenused'] } });
  assert.deepEqual([moved.source.state, moved.source.region, moved.people.user], ['person_mentioned_region', 'maardu_linn', ['maardu_linn', 'reported']]);
  // Without a known residence the follow-up reads the plan's queries, as it did before.
  const r5 = await turn(STORED.R5);
  const clean = await turn({ before: r5.value, after: r5, texts: [LIVE[4], 'Ja mis see maksab?'], plan: { person: 'user', places: [], queries: ['Maardu isikliku abistaja teenuse hind'] } });
  assert.deepEqual([clean.source.state, clean.source.region], ['search_plan_region', 'maardu_linn']);
});

// The run on the live plan after the deploy (04.10.2026, 8 turns; docs/audits/evidence/question-region-measured-2026-10-04.json):
// the plans the model gave, word for word (searchAssist.plannedPlaces and queries of the turn records).
const MEASURED = ['Elan Nõo vallas ja mul on raske toime tulla. Kust ma abi saan?', 'Kas Maardus saab isikliku abistaja teenust?', 'Ja mis see maksab?', 'Aga millist koduteenust ma ise saan?'];
const relisted = place(1, 'Elan Nõo vallas', 'Nõo vald', 'user', 'lives'); // the plan named the first message's home again in turns 3 and 4

test('the measured run: the follow-up\'s plan also searched the user\'s own earlier request, and that query no longer takes the follow-up home', async () => {
  const question = await turn({ before: nooState, texts: MEASURED.slice(0, 2), plan: { person: 'user', places: [place(2, MEASURED[1], 'Maardu', 'user', 'other')],
    queries: ['Maardu isikliku abistaja teenuse korraldus taotlemine', 'Maardu isikliku abistaja teenuse saamise tingimused'] } });
  assert.deepEqual(question.source, asked('maardu_linn', home('noo_vald')));
  // Measured: the catalogue was Nõo vald's and the answer said it could not give Maardu's price.
  const price = await turn({ before: question.value, after: question, texts: MEASURED.slice(0, 3), plan: { person: 'user', places: [relisted],
    queries: ['isikliku abistaja teenus Maardu linnas korraldamine', 'isikliku abistaja teenuse tasu omaosalus hinna kehtestamine', 'Nõo valla sotsiaalabi toimetulekuraskustes'] } });
  assert.deepEqual(price.places, []);
  assert.deepEqual(price.source, asked('maardu_linn', home('noo_vald'), 'earlier_question'));
  assert.deepEqual(price.people, { user: ['noo_vald', 'reported'] });
  const own = await turn({ before: price.value, after: price, texts: MEASURED, plan: { person: 'user', places: [relisted],
    queries: ['Nõo valla koduteenus taotlemine ja abivajaduse hindamine', 'Koduteenuse sisu ja osutatavad toimingud Eestis'] } });
  assert.deepEqual(own.source, home('noo_vald'));
  // The same in a question itself: a query about the user's own earlier request beside the asked municipality.
  const reopened = await turn({ before: nooState, texts: MEASURED.slice(0, 2), plan: { person: 'user', places: [place(2, MEASURED[1], 'Maardu', 'user', 'other')],
    queries: ['Maardu isikliku abistaja teenuse korraldus', 'Nõo valla sotsiaalabi toimetulekuraskustes'] } });
  assert.deepEqual(reopened.source, asked('maardu_linn', home('noo_vald')));
  // Not set aside: a query about a third municipality.
  const third = await turn({ before: question.value, after: question, texts: MEASURED.slice(0, 3), plan: { person: 'user', places: [],
    queries: ['Maardu isikliku abistaja teenuse hind', 'Viimsi valla isikliku abistaja teenuse hind'] } });
  assert.deepEqual(third.source, home('noo_vald'));
  // A follow-up whose only named municipality is the user's own has nothing to go on with.
  const home_ = await turn({ before: question.value, after: question, texts: MEASURED.slice(0, 3), plan: { person: 'user', places: [], queries: ['Nõo valla sotsiaalabi toimetulekuraskustes'] } });
  assert.deepEqual(home_.source, home('noo_vald'));
  // The other measured turns: the work place and the question in a conversation about two people.
  const work = await turn({ texts: ['Elan Nõo vallas, töötan Maardus. Millist koduteenust ma saan?'], plan: { person: 'user',
    places: [place(1, 'Elan Nõo vallas', 'Nõo vald', 'user', 'lives'), place(1, 'töötan Maardus', 'Maardu', 'user', 'other')],
    queries: ['Nõo valla koduteenus saamise tingimused', 'koduteenuse sisu ja korraldamine sotsiaalhoolekande seadus'] } });
  assert.deepEqual([work.source.state, work.source.region], ['person_mentioned_region', 'noo_vald']);
  const tartu = await turn({ before: { people: [saved('user', 'anija_vald'), saved('ema', 'kose_vald')], focus: 'ema' }, texts: LIVE.slice(0, 3), plan: { person: 'user',
    places: [place(3, 'Kas Tartu vallas on sotsiaaltransport', 'Tartu vald', 'user', 'other')],
    queries: ['Tartu vald sotsiaaltransporditeenus olemasolu', 'Tartu vald sotsiaaltransporditeenuse hind omaosalus hinnakiri'] } });
  assert.deepEqual([tartu.source.region, tartu.people], ['tartu_vald', { user: ['anija_vald', 'reported'], ema: ['kose_vald', 'reported'] }]);
});

// Codex's review of #344-#345 (docs/audits/rag-v2-pr344-345-review-2026-10-04.md in the main checkout), its probes' inputs.
test('Codex F1 (#345): the same follow-up in the first person goes on with the asked municipality; a new request of the user\'s own does not', async () => {
  const question = await turn({ before: nooState, texts: MEASURED.slice(0, 2), plan: { person: 'user', places: [place(2, MEASURED[1], 'Maardu linn', 'user', 'other')],
    queries: ['Maardu isikliku abistaja teenuse korraldamine'] } });
  const plan = { person: 'user', places: [], queries: ['Maardu isikliku abistaja teenuse taotlemine', 'Nõo valla sotsiaalabi'] };
  for (const text of ['Kuidas seda taotleda?', 'Kuidas ma seda taotleda saan?', 'Kas ma saaksin sealt abi?', 'Ja mis see mulle maksma läheb?']) {
    const follow = await turn({ before: question.value, after: question, texts: [...MEASURED.slice(0, 2), text], plan });
    assert.deepEqual(follow.source, asked('maardu_linn', home('noo_vald'), 'earlier_question'), text);
    assert.deepEqual(follow.people, { user: ['noo_vald', 'reported'] }, text);
  }
  // A new request of the user's own points back at nothing: the query about the user's municipality is the request
  // itself and the one about the asked municipality the leftover, in either order.
  for (const queries of [['Nõo valla koduteenuse saamise tingimused', 'Maardu isikliku abistaja teenuse hind'], ['Maardu isikliku abistaja teenuse hind', 'Nõo valla koduteenuse saamise tingimused'],
    ['Nõo valla koduteenuse saamise tingimused']]) {
    for (const text of ['Aga millist koduteenust ma ise saan?', 'Millist koduteenust saab?']) {
      const own = await turn({ before: question.value, after: question, texts: [...MEASURED.slice(0, 2), text], plan: { person: 'user', places: [], queries } });
      assert.deepEqual(own.source, home('noo_vald'), `${text} | ${queries.join(' | ')}`);
    }
  }
  // A limit, kept as one: a follow-up that points back with no word of its own, beside a query about the user's own
  // earlier request, stays with the residence; with queries about the asked municipality alone it goes on.
  const bare = await turn({ before: question.value, after: question, texts: [...MEASURED.slice(0, 2), 'Ja kuidas taotleda?'], plan });
  assert.deepEqual(bare.source, home('noo_vald'));
  const only = await turn({ before: question.value, after: question, texts: [...MEASURED.slice(0, 2), 'Ja kuidas taotleda?'], plan: { ...plan, queries: plan.queries.slice(0, 1) } });
  assert.equal(only.source.region, 'maardu_linn');
  for (const [text, expected] of [['Ja mis see maksab?', true], ['Kuidas ma seda taotleda saan?', true], ['Kas sealt saab abi?', true], ['А сколько это стоит?', true], ['How much is it?', true],
    ['Aga millist koduteenust ma ise saan?', false], ['Aga millist koduteenust ema saab?', false], ['Ja kuidas taotleda?', false], ['Sest mul on raske.', false]]) {
    assert.equal(refersBack(text.toLowerCase().match(/[\p{L}']+/gu) || []), expected, text);
  }
});

test('Codex F2 (#345): the asked municipality belongs to the question of the person it was asked for; another person\'s request is searched in their own', async () => {
  const before = { people: [saved('user', 'noo_vald'), saved('ema', 'kose_vald')], focus: 'user' };
  const texts = ['Elan Nõo vallas. Mu ema elab Kose vallas.', 'Kas Maardus saab isikliku abistaja teenust?'];
  const question = await turn({ before, texts, plan: { person: 'user', places: [place(2, texts[1], 'Maardu linn', 'user', 'other')], queries: ['Maardu isikliku abistaja teenuse korraldamine'] } });
  assert.deepEqual([question.source.region, askedPerson(question.source)], ['maardu_linn', 'user']);
  for (const queries of [['Kose valla koduteenuse saamise tingimused'], ['Kose valla koduteenuse saamise tingimused', 'Maardu isikliku abistaja teenuse hind'],
    ['Maardu isikliku abistaja teenuse hind', 'Kose valla koduteenuse saamise tingimused'], ['Maardu isikliku abistaja teenuse hind']]) {
    for (const text of ['Aga millist koduteenust ema saab?', 'Kas ema saaks seda ka?']) {
      const hers = await turn({ before: question.value, after: question, texts: [...texts, text], plan: { person: 'ema', places: [], queries } });
      assert.deepEqual(hers.source, home('kose_vald', 'ema'), `${text} | ${queries.join(' | ')}`);
      assert.deepEqual(hers.people, { user: ['noo_vald', 'reported'], ema: ['kose_vald', 'reported'] });
    }
  }
  // The mother's own question about another municipality is hers to go on with, and the user's next request is not.
  const forHer = await turn({ before: question.value, after: question, texts: [...texts, 'Kas ema saaks Maardus isikliku abistaja teenust?'], plan: { person: 'ema',
    places: [place(3, 'Kas ema saaks Maardus isikliku abistaja teenust?', 'Maardu linn', 'ema', 'other')], queries: ['Maardu isikliku abistaja teenuse tingimused'] } });
  assert.deepEqual([forHer.source.region, askedPerson(forHer.source)], ['maardu_linn', 'ema']);
  const herPrice = await turn({ before: forHer.value, after: forHer, texts: [...texts, 'Kas ema saaks Maardus isikliku abistaja teenust?', 'Ja mis see talle maksab?'],
    plan: { person: 'ema', places: [], queries: ['Maardu isikliku abistaja teenuse hind', 'Kose valla koduteenus'] } });
  assert.deepEqual(herPrice.source, asked('maardu_linn', home('kose_vald', 'ema'), 'earlier_question'));
  const mine = await turn({ before: forHer.value, after: forHer, texts: [...texts, 'Kas ema saaks Maardus isikliku abistaja teenust?', 'Ja mis see mulle maksaks?'],
    plan: { person: 'user', places: [], queries: ['Maardu isikliku abistaja teenuse hind'] } });
  assert.deepEqual(mine.source, home('noo_vald'));
  // A caller that hands on the municipality without the person it was asked for gets no continuation.
  const scopeTurns = [...texts, 'Ja mis see maksab?'].map((text, index) => ({ turnId: `t${index + 1}`, text, mode: index ? 'same' : 'new' }));
  const query = { scopeTurns, person: 'user', previousState: { value: question.value, sourceTurnIds: scopeTurns.slice(0, -1).map(item => item.turnId) }, askedRegions: ['maardu_linn'], places: [] };
  assert.deepEqual((await runtime.searchScope(config, query, directory, ['Maardu isikliku abistaja teenuse hind'])).knowledgeRegion, home('noo_vald'));
});

test('Q6 and Q7 of 04.10: a mention the plan left unattributed, that says nothing of living there, no longer erases the residence', async () => {
  for (const [name, region] of [['Q6', 'pohja_sakala_vald'], ['Q7', 'harku_vald']]) {
    const result = await turn(STORED[name]);
    assert.deepEqual(result.places.map(item => [item.person, item.region, item.relation, item.reason, item.asking]), [['user', region, 'other', 'unattributed_other_mention', true]], name);
    assert.deepEqual(result.people, { user: ['noo_vald', 'reported'], ema: ['kose_vald', 'reported'] }, name);
    assert.deepEqual(result.source, asked(region, home('noo_vald')), name);
  }
  // The other way the record's result can come about: the plan names a message the state has already read.
  const wrongTurn = await turn({ ...STORED.Q7, plan: { ...STORED.Q7.plan, places: [place(6, 'Harku valla toimetulekutoetuse taotluse vormi', 'Harku vald', 'user', 'other')] } });
  assert.deepEqual([wrongTurn.source.region, wrongTurn.people.user], ['harku_vald', ['noo_vald', 'reported']]);
  // A mention that does speak of living somewhere, or negates it, with nobody named, is still nobody's to assume.
  for (const text of ['Ei ela enam Nõo vallas.', 'Elab nüüd Harku vallas.']) {
    const unclear = await turn({ before: nooState, texts: ['Elan Nõo vallas.', text], plan: { person: 'user', places: [], queries: ['Harku valla toimetulekutoetus'] } });
    assert.deepEqual([unclear.source.region, unclear.people.user], [null, [null, 'unresolved']], text);
  }
});

test('the same questions as a first message keep the scope the answers of 04.10 were given with', async () => {
  for (const [name, region] of [['R3', 'tartu_vald'], ['R5', 'maardu_linn'], ['R7', 'harku_vald']]) {
    const result = await turn(STORED[name]);
    assert.deepEqual(result.source, { state: 'search_plan_region', region, person: 'user', interpretation: 'source_scope_only_not_confirmed_residence' }, name);
    assert.deepEqual(result.people, {}, name);
  }
  // Without the plan's attribution a first message now reaches the same scope (before: unresolved, no municipality).
  const bare = await turn({ texts: [LIVE[6]], plan: { person: 'user', places: [], queries: ['Harku valla toimetulekutoetuse taotluse vorm'] } });
  assert.deepEqual([bare.source.state, bare.source.region, bare.people], ['search_plan_region', 'harku_vald', {}]);
});

test('Codex F2: a place of work is a circumstance; the search keeps the residence, also when the plan\'s queries name only the work place', async () => {
  const text = 'Elan Nõo vallas, töötan Maardus; millist koduteenust ma saan?';
  const places = [place(1, 'Elan Nõo vallas', 'Nõo vald', 'user', 'lives'), place(1, 'töötan Maardus', 'Maardu linn', 'user', 'other')];
  const queries = [['Nõo valla koduteenuse taotlemine', 'koduteenuse tingimused'], ['koduteenuse taotlemine ja tingimused'], ['Nõo valla koduteenus', 'Maardu linna koduteenus'],
    ['Maardu linna koduteenuse taotlemine ja tingimused']];
  for (const list of queries) {
    const result = await turn({ texts: [text], plan: { person: 'user', places, queries: list } });
    assert.deepEqual([result.source.state, result.source.region, result.people], ['person_mentioned_region', 'noo_vald', { user: ['noo_vald', 'reported'] }], list.join(' | '));
  }
  // The work place in a later message, written in several ways, with the plan's attribution and without it.
  const later = [['Töötan Maardus. Millist koduteenust ma saan?', 'Töötan Maardus'], ['töötan maardus millist koduteenust ma saan', 'töötan maardus'],
    ['Käin Maardus tööl, kas ma saan koduteenust?', 'Käin Maardus tööl'], ['Kas ma saan koduteenust, kui töötan Maardus?', 'kui töötan Maardus']];
  for (const [message, quote] of later) {
    // Unchanged for a message without punctuation: its one clause is in the first person ("ma"), and a first-person
    // clause the plan left unattributed still leaves the residence unresolved; no municipality is searched then.
    const unattributed = message === later[1][0] ? [] : [[]];
    for (const planned of [[place(2, quote, 'Maardu linn', 'user', 'other')], ...unattributed]) {
      for (const list of queries) {
        const result = await turn({ before: nooState, texts: ['Elan Nõo vallas.', message], plan: { person: 'user', places: planned, queries: list } });
        assert.deepEqual([result.source, result.people], [home('noo_vald'), { user: ['noo_vald', 'reported'] }], `${message} | ${planned.length} | ${list[0]}`);
      }
    }
  }
  const firstPerson = await turn({ before: nooState, texts: ['Elan Nõo vallas.', later[1][0]], plan: { person: 'user', places: [], queries: queries[3] } });
  assert.deepEqual([firstPerson.source.region, firstPerson.people.user], [null, [null, 'unresolved']]);
  // Asking about that municipality's service is still a question about it, beside the work place and without it.
  // ADR-128 (10.10.2026): so is a request for information that is no question, the last five here. Until then "Soovin
  // infot Maardu isikliku abistaja teenuse kohta." stood in the limit below and stayed with the residence.
  for (const message of ['Töötan Maardus. Kas Maardus saab isikliku abistaja teenust?', 'Tahan teada, kas Maardus saab isikliku abistaja teenust.',
    'Räägi Maardu isikliku abistaja teenusest.', 'Maardus saab isikliku abistaja teenust?', 'Kui palju Maardus isikliku abistaja teenus maksab?',
    'Soovin infot Maardu isikliku abistaja teenuse kohta.', 'Sooviksin teada Maardu isikliku abistaja teenuse hinda.', 'Mind huvitab Maardu isikliku abistaja teenus.',
    'Töötan Maardus. Vajan infot Maardu isikliku abistaja teenuse kohta.', 'Мне нужна информация об услуге личного помощника в Маарду.']) {
    const result = await turn({ before: nooState, texts: ['Elan Nõo vallas.', message], plan: { person: 'user', places: [], queries: ['Maardu isikliku abistaja teenus'] } });
    assert.deepEqual([result.source.region, result.source.state, result.people.user], ['maardu_linn', 'question_region', ['noo_vald', 'reported']], message);
  }
  // A limit, not a goal: a bare name of the matter, an information word after the name, and a request with no wish word
  // are not read as asking, and stay with the residence.
  for (const message of ['Maardu isikliku abistaja teenus', 'Soovin Maardu isikliku abistaja teenuse kohta infot.', 'Infot Maardu isikliku abistaja teenuse kohta.']) {
    const result = await turn({ before: nooState, texts: ['Elan Nõo vallas.', message], plan: { person: 'user', places: [], queries: ['Maardu isikliku abistaja teenus'] } });
    assert.deepEqual([result.source, result.people.user], [home('noo_vald'), ['noo_vald', 'reported']], message);
  }
});

test('a mention stands in the question when a question word or a request precedes it in its clause, or its one-clause sentence ends with a question mark', async () => {
  const asking = async text => (await placeOccurrences(text, directory, analyzer)).map(item => item.asking);
  for (const [text, expected] of [
    ['Kas Maardus saab isikliku abistaja teenust?', [true]], ['Mis toetusi Tartu vald maksab', [true]], ['Kust leian Harku valla toimetulekutoetuse taotluse vormi?', [true]],
    ['Ütle, mida Kose vald pakub.', [true]], ['Kui palju maksab Maardus koduteenus?', [true]], ['Maardus on koduteenus?', [true]],
    ['Можно ли в Маарду получить услугу?', [true]], ['Where in Maardu can I get help?', [true]],
    ['Töötan Maardus.', [false]], ['Elan Nõo vallas, töötan Maardus; millist koduteenust ma saan?', [false, false]], ['töötan maardus millist koduteenust ma saan', [false]],
    ['Kas ma saan koduteenust, kui töötan Maardus?', [false]], ['Töötan Maardus. Kas Maardus saab abi?', [false, true]], ['Maardu isikliku abistaja teenus', [false]],
  ]) assert.deepEqual(await asking(text), expected, text);
});

test('two municipalities in one message: the home it gives is saved and the asked one searched; two asked ones are both kept, none chosen', async () => {
  const both = await turn({ texts: ['Elan Nõo vallas. Kas Maardus saab isikliku abistaja teenust?'], plan: { person: 'user',
    places: [place(1, 'Elan Nõo vallas', 'Nõo vald', 'user', 'lives'), place(1, 'Kas Maardus saab isikliku abistaja teenust?', 'Maardu linn', 'user', 'other')],
    queries: ['Maardu isikliku abistaja teenuse korraldamine'] } });
  assert.deepEqual(both.source, asked('maardu_linn', home('noo_vald', 'user', 'person_mentioned_region')));
  assert.deepEqual(both.people, { user: ['noo_vald', 'reported'] });
  const text = 'Kas Maardus või Viimsi vallas on isikliku abistaja teenus?';
  const places = [place(2, text, 'Maardu linn', 'user', 'other'), place(2, text, 'Viimsi vald', 'user', 'other')];
  const compare = await turn({ before: nooState, texts: ['Elan Nõo vallas.', text], plan: { person: 'user', places, queries: ['Maardu isikliku abistaja teenus', 'Viimsi valla isikliku abistaja teenus'] } });
  assert.deepEqual(compare.source, { state: 'question_regions', region: null, candidates: ['maardu_linn', 'viimsi_vald'], asked_in: 'current_message', person_scope: home('noo_vald'),
    interpretation: 'asked_municipality_source_scope_not_residence' });
  assert.deepEqual(keptTexts(compare.source), ['maardu_linn', 'viimsi_vald']);
  assert.deepEqual(compare.people, { user: ['noo_vald', 'reported'] });
  // The plan searches one of the two: that one. It searches the person's own municipality beside an asked one: the residence.
  const one = await turn({ before: nooState, texts: ['Elan Nõo vallas.', text], plan: { person: 'user', places, queries: ['Viimsi valla isikliku abistaja teenus'] } });
  assert.equal(one.source.region, 'viimsi_vald');
  const withHome = await turn({ before: nooState, texts: ['Elan Nõo vallas.', 'Kas Maardus on koduteenus odavam kui Nõo vallas?'], plan: { person: 'user',
    places: [place(2, 'Kas Maardus on koduteenus odavam', 'Maardu linn', 'user', 'other')], queries: ['Maardu koduteenuse hind', 'Nõo valla koduteenuse hind'] } });
  assert.deepEqual(withHome.source, home('noo_vald'));
  // A base name two municipalities share: both stay candidates, as in a conversation with no residence.
  const shared = await turn({ before: nooState, texts: ['Elan Nõo vallas.', 'Kas Tartus on sotsiaaltransport?'], plan: { person: 'user',
    places: [place(2, 'Kas Tartus on sotsiaaltransport?', 'Tartu', 'user', 'other')], queries: ['Tartu sotsiaaltransporditeenus'] } });
  assert.deepEqual([shared.source.state, shared.source.candidates, shared.people.user], ['question_regions', ['tartu_linn', 'tartu_vald'], ['noo_vald', 'reported']]);
});

test('another person: the mother keeps Kose vald, a question about another municipality for her is searched there, and her work place gives the user nothing', async () => {
  const before = { people: [saved('user', 'anija_vald'), saved('ema', 'kose_vald')], focus: 'ema' };
  const texts = [LIVE[0], LIVE[1]];
  const forHer = await turn({ before, texts: [...texts, 'Kas ema saaks Tartu vallas sotsiaaltransporti?'], plan: { person: 'ema',
    places: [place(3, 'Kas ema saaks Tartu vallas sotsiaaltransporti?', 'Tartu vald', 'ema', 'other')], queries: ['Tartu valla sotsiaaltransporditeenus'] } });
  assert.deepEqual(forHer.source, asked('tartu_vald', home('kose_vald', 'ema')));
  assert.deepEqual(forHer.people, { user: ['anija_vald', 'reported'], ema: ['kose_vald', 'reported'] });
  const hers = await turn({ before: forHer.value, after: forHer, texts: [...texts, 'Kas ema saaks Tartu vallas sotsiaaltransporti?', 'Kuidas ema koduteenust taotleb?'],
    plan: { person: 'ema', places: [], queries: ['koduteenuse taotlemine'] } });
  assert.deepEqual(hers.source, home('kose_vald', 'ema'));
  // The mother's work place in a request about the user: not the user's question, also when a query names only that place.
  for (const queries of [['Anija valla koduteenus'], ['Maardu koduteenus']]) {
    const mine = await turn({ before, texts: [...texts, 'Ema käib Maardus tööl. Millist koduteenust mina saan?'], plan: { person: 'user',
      places: [place(3, 'Ema käib Maardus tööl', 'Maardu linn', 'ema', 'other')], queries } });
    assert.deepEqual([mine.source, mine.people], [home('anija_vald'), { user: ['anija_vald', 'reported'], ema: ['kose_vald', 'reported'] }], queries[0]);
  }
});

test('what stays decided: a negated place is not asked back by a query, and a mention the plan calls another one never unsettles a residence', async () => {
  const before = { people: [saved('user', 'kose_vald')], focus: 'user' };
  // Codex J1: the user's own negation, with a query that still names the place.
  const negated = await turn({ before, texts: ['Elan Kose vallas.', 'Ma ei ela enam Kose vallas.'], plan: { person: 'user', places: [], queries: ['Kose vald toimetulekutoetus'] } });
  assert.deepEqual([negated.source.state, negated.source.region], ['region_required_after_negation', null]);
  // The same place negated and asked about in one message is no question about it.
  const text = 'Ma ei ela enam Kose vallas. Kas Kose vallas saab tööd?';
  const work = await turn({ before, texts: ['Elan Kose vallas.', text], plan: { person: 'user', places: [place(2, 'Kas Kose vallas saab tööd?', 'Kose vald', 'user', 'other')], queries: ['Kose vald toimetulekutoetus'] } });
  assert.deepEqual([work.source.region, work.people.user], [null, [null, 'negated']]);
  // A quote the server cannot read as one mention (the place twice) was an unresolved residence before; for a mention
  // the plan calls "other" the server now reads the message's mentions itself.
  const twice = 'Kas Maardus on isikliku abistaja teenus ja mis see Maardus maksab?';
  const repeated = await turn({ before: nooState, texts: ['Elan Nõo vallas.', twice],
    plan: { person: 'user', places: [place(2, twice, 'Maardu linn', 'user', 'other')], queries: ['Maardu isikliku abistaja teenuse hind'] } });
  assert.deepEqual([repeated.source.region, repeated.people.user], ['maardu_linn', ['noo_vald', 'reported']]);
  // A residence claim the server cannot verify stays unresolved, as before.
  const claim = await turn({ before: nooState, texts: ['Elan Nõo vallas.', twice],
    plan: { person: 'user', places: [place(2, twice, 'Maardu linn', 'user', 'lives')], queries: ['Maardu isikliku abistaja teenuse hind'] } });
  assert.deepEqual([claim.source.region, claim.people.user], [null, [null, 'unresolved']]);
});

test('the catalogue for a model run of these cases is well formed, and its checks tell the asked municipality from the residence', async () => {
  const catalogue = JSON.parse(await fs.readFile(new URL('./evaluation/dialogue/scenarios-question-region-1.json', import.meta.url), 'utf8'));
  assert.deepEqual(validateCatalogue(catalogue), []);
  assert.equal(catalogue.scenarios.reduce((sum, item) => sum + item.turns.length, 0), 8);
  const scenario = catalogue.scenarios.find(item => item.id === 'asks-another-municipality'), askedTurn = scenario.turns[1];
  assert.deepEqual([askedTurn.expect.region, askedTurn.expect.person_regions], ['maardu_linn', { user: 'noo_vald' }]);
  // The follow-up stays with the asked municipality, the user's own request returns to the residence (Codex F1).
  assert.deepEqual(scenario.turns.slice(2).map(item => [item.text, item.expect.region, item.expect.person_regions.user]),
    [['Ja mis see maksab?', 'maardu_linn', 'noo_vald'], ['Aga millist koduteenust ma ise saan?', 'noo_vald', 'noo_vald']]);
  const observed = extra => ({ state: 'completed', region: 'maardu_linn', personRegions: { user: 'noo_vald' }, person: 'user', summaries: [], details: [], contacts: 0,
    evidenceTitles: ['Isikliku abistaja teenuse osutamise tingimused ja kord'], cited: [{ title: 'Isikliku abistaja teenuse osutamise tingimused ja kord', documentId: 'maardu-isiklik-abistaja' }],
    text: 'Jah, Maardus on isikliku abistaja teenus. See on mõeldud inimesele, kelle rahvastikuregistri järgne elukoht on Maardu linn.', clarification: false, ...extra });
  assert.equal(checkTurn(askedTurn.expect, observed({})).verdict, 'passed');
  // What 04.10 gave: the residence's catalogue and a question back; and the opposite fault, the residence overwritten.
  const stayed = checkTurn(askedTurn.expect, observed({ region: 'noo_vald', cited: [], text: 'Siin on kohalik info Nõo valla kohta. Kas küsid Nõo või Maardu kohta?', clarification: true }));
  assert.deepEqual(stayed.checks.filter(check => !check.ok).map(check => check.key), ['region', 'cited', 'must', 'must_not']);
  // The answer of the second run (04.10, commit ae7703fd), word for word: Maardu's service and conditions, then a question
  // about whom the service is for. The catalogue as it was run failed it on clarification=false; that check was written
  // against the fault of 04.10 and is replaced by a pattern for the fault itself. The run's record lists the regulation as
  // cited (docs/audits/evidence/question-region-followup-measured-2026-10-04.json), as the default here does.
  const secondRun = 'Jah, Maardu linnas osutatakse isikliku abistaja teenust. Seda on õigus saada eelkõige täisealisel sügava liikumis- või nägemispuudega inimesel, kelle rahvastikuregistrijärgne elukoht on Maardu linn. '
    + 'Teenus aitab igapäevatoimingutes, kus inimene vajab puude tõttu füüsilist kõrvalabi. [S1, S2]\n\nTaotluse saab esitada Maardu Linnavalitsusele. Linn hindab abivajadust kodukülastusel ja teeb teenuse osutamise või sellest '
    + 'keeldumise otsuse 10 tööpäeva jooksul pärast taotluse saamist. [S4, S5]\n\nSa ütlesid varem, et elad Nõo vallas. Ma ei saa aru, kas küsid teenust endale või kellelegi teisele ega kas taotleja rahvastikuregistrijärgne elukoht on '
    + 'Maardu linnas.\n\nKas küsid teenust endale või kellelegi teisele, ja kas selle inimese rahvastikuregistrijärgne elukoht on Maardu linnas?';
  assert.equal(checkTurn(askedTurn.expect, observed({ text: secondRun, clarification: true })).verdict, 'passed');
  assert.deepEqual(checkTurn({ ...askedTurn.expect, clarification: false }, observed({ text: secondRun, clarification: true })).checks.filter(check => !check.ok).map(check => check.key), ['clarification']);
  // The first run's follow-up answer (commit a88dfe78) named the fault in its own words; that wording fails too.
  assert.deepEqual(checkTurn(askedTurn.expect, observed({ text: 'Isikliku abistaja teenuse eest võidakse tasu küsida. Kohalik teenusekirje puudutab Nõo valda, mitte Maardut.' }))
    .checks.filter(check => !check.ok).map(check => check.key), ['must_not']);
  // Codex review of #346-#347 (F1): a question back instead of the information names the service too, so the words alone
  // let it pass. It cites nothing; the turn expects a source block that cites the asked municipality's regulation.
  const bare = checkTurn(askedTurn.expect, observed({ cited: [], clarification: true,
    text: 'Kas küsid isikliku abistaja teenust Nõo vallas või Maardu linnas? Ma ei saa enne täpsustust Maardu teenuse kohta vastata.' }));
  assert.deepEqual([bare.verdict, bare.checks.filter(check => !check.ok).map(check => check.key)], ['answer', ['cited']]);
  // The same information cited from another source (a national guide, not the municipality's regulation) fails as well.
  assert.deepEqual(checkTurn(askedTurn.expect, observed({ cited: [{ title: 'Isikliku abi juhend', documentId: 'guide' }] })).checks.filter(check => !check.ok).map(check => check.key), ['cited']);
  // The fifth entry is the third run (ADR-077): the same conversation as a check that a follow-up is kept.
  // Later runs of the same conversation (ADR-078 and after) only add entries.
  assert.ok(catalogue.history.length >= 5);
  assert.deepEqual(checkTurn(askedTurn.expect, observed({ personRegions: { user: 'maardu_linn' } })).checks.filter(check => !check.ok).map(check => check.key), ['person_regions']);
  // An answer that makes the asked municipality's service the user's own entitlement fails.
  const entitled = checkTurn(askedTurn.expect, observed({ text: 'Jah, Maardus on isikliku abistaja teenus ja sul on õigus seda saada.' }));
  assert.deepEqual(entitled.checks.filter(check => !check.ok).map(check => check.key), ['must_not']);
  // The work place scenario (Codex F2) keeps the residence.
  assert.deepEqual(catalogue.scenarios.find(item => item.id === 'workplace-keeps-residence').turns.map(item => item.expect.region), ['noo_vald']);
});

// ADR-081. The run after ADR-080 (04.10.2026, release 9aabbf6f, eval-files/plan-guard-2026-10-04): the plan of the
// follow-up wrote one query, word for word below, that names no municipality, and the search read Nõo vald.
const UNNAMED = ['Isikliku abistaja teenuse tasu kujunemine inimese omaosalus'];

test('ADR-081: a follow-up that points back goes on with the asked municipality when the plan names none; the plan can still take the search elsewhere', async () => {
  const question = await turn({ before: nooState, texts: MEASURED.slice(0, 2), plan: { person: 'user', places: [place(2, MEASURED[1], 'Maardu linn', 'user', 'other')],
    queries: ['Maardu linn isikliku abistaja teenuse korraldamine ja taotlemine'] } });
  const follow = (text, queries, person = 'user') => turn({ before: question.value, after: question, texts: [...MEASURED.slice(0, 2), text], plan: { person, places: [], queries } });
  const price = await follow(MEASURED[2], UNNAMED);
  assert.deepEqual(price.source, asked('maardu_linn', home('noo_vald'), 'earlier_question'));
  assert.deepEqual(keptTexts(price.source), ['maardu_linn']);
  assert.deepEqual(price.people, { user: ['noo_vald', 'reported'] });
  // The same without any query (a failed plan), in the first person, and in the other languages of the word list.
  for (const [text, queries] of [[MEASURED[2], []], ['Kuidas ma seda taotleda saan?', ['isikliku abistaja teenuse taotlemine']], ['How much is it?', UNNAMED], ['А сколько это стоит?', UNNAMED]]) {
    assert.equal((await follow(text, queries)).source.region, 'maardu_linn', text);
  }
  // And the turn after it goes on from the follow-up's own scope.
  const apply = await turn({ before: price.value, after: price, texts: [...MEASURED.slice(0, 3), 'Kuidas seda taotleda?'], plan: { person: 'user', places: [], queries: ['isikliku abistaja teenuse taotlemine'] } });
  assert.deepEqual([apply.source.region, apply.source.asked_in, apply.people.user], ['maardu_linn', 'earlier_question', ['noo_vald', 'reported']]);
  // The plan takes the search away by naming the person's own municipality or a third one.
  for (const queries of [['Nõo valla isikliku abistaja teenuse tasu'], ['Viimsi valla isikliku abistaja teenuse tasu'], [...UNNAMED, 'Viimsi valla isikliku abistaja teenuse tasu']]) {
    assert.deepEqual((await follow(MEASURED[2], queries)).source, home('noo_vald'), queries.join(' | '));
  }
  // A message that points back at nothing still needs the plan to name the asked municipality.
  for (const text of ['Aga millist koduteenust ma ise saan?', 'Ja kuidas taotleda?', 'Mis teenuse tasu on?']) {
    assert.deepEqual((await follow(text, UNNAMED)).source, home('noo_vald'), text);
  }
  // Another person's request is never a follow-up of this one's question.
  const before = { people: [saved('user', 'noo_vald'), saved('ema', 'kose_vald')], focus: 'user' };
  const forUser = await turn({ before, texts: MEASURED.slice(0, 2), plan: { person: 'user', places: [place(2, MEASURED[1], 'Maardu linn', 'user', 'other')], queries: ['Maardu isikliku abistaja teenus'] } });
  const hers = await turn({ before: forUser.value, after: forUser, texts: [...MEASURED.slice(0, 2), 'Kas ema saaks seda ka?'], plan: { person: 'ema', places: [], queries: UNNAMED } });
  assert.deepEqual(hers.source, home('kose_vald', 'ema'));
  // A message that names a municipality itself is read for itself.
  const work = await turn({ before: question.value, after: question, texts: [...MEASURED.slice(0, 2), 'Töötan muide Viimsis. Ja mis see maksab?'],
    plan: { person: 'user', places: [place(3, 'Töötan muide Viimsis', 'Viimsi vald', 'user', 'other')], queries: UNNAMED } });
  assert.deepEqual(work.source, home('noo_vald'));
  // Two asked municipalities: the follow-up keeps both, as the question did.
  const text = 'Kas Maardus või Viimsi vallas on isikliku abistaja teenus?';
  const compare = await turn({ before: nooState, texts: ['Elan Nõo vallas.', text], plan: { person: 'user',
    places: [place(2, text, 'Maardu linn', 'user', 'other'), place(2, text, 'Viimsi vald', 'user', 'other')], queries: ['Maardu isikliku abistaja teenus', 'Viimsi valla isikliku abistaja teenus'] } });
  const both = await turn({ before: compare.value, after: compare, texts: ['Elan Nõo vallas.', text, MEASURED[2]], plan: { person: 'user', places: [], queries: UNNAMED } });
  assert.deepEqual([both.source.state, both.source.candidates, both.source.asked_in], ['question_regions', ['maardu_linn', 'viimsi_vald'], 'earlier_question']);
});

test('ADR-081: a person who has given no residence: the follow-up that points back is searched where the question before it was', async () => {
  const continued = (region, person = 'user') => ({ state: 'continued_region', region, person, asked_in: 'earlier_question', interpretation: 'source_scope_only_not_confirmed_residence' });
  const r5 = await turn(STORED.R5);
  assert.deepEqual([r5.source.state, askedRegions(r5.source), askedPerson(r5.source)], ['search_plan_region', ['maardu_linn'], 'user']);
  const follow = (text, queries, person = 'user') => turn({ before: r5.value, after: r5, texts: [LIVE[4], text], plan: { person, places: [], queries } });
  const price = await follow(MEASURED[2], UNNAMED);
  assert.deepEqual(price.source, continued('maardu_linn'));
  assert.deepEqual(keptTexts(price.source), ['maardu_linn']);
  // Nothing is saved as anybody's residence.
  assert.deepEqual(price.people, {});
  // The next follow-up goes on from it; a failed plan (no queries) does too.
  const apply = await turn({ before: price.value, after: price, texts: [LIVE[4], MEASURED[2], 'Kuidas seda taotleda?'], plan: { person: 'user', places: [], queries: ['isikliku abistaja teenuse taotlemine'] } });
  assert.deepEqual(apply.source, continued('maardu_linn'));
  assert.deepEqual((await follow(MEASURED[2], [])).source, continued('maardu_linn'));
  // A plan that names a municipality decides, as before: the same one, or another.
  assert.deepEqual([(await follow(MEASURED[2], ['Maardu isikliku abistaja teenuse hind'])).source.state, (await follow(MEASURED[2], ['Viimsi valla isikliku abistaja teenuse hind'])).source.region],
    ['search_plan_region', 'viimsi_vald']);
  // A message that points back at nothing, or is about another person, gets no municipality from the question before.
  for (const [text, person] of [['Aga millist koduteenust ma ise saan?', 'user'], ['Ja kuidas taotleda?', 'user'], ['Kas ema saaks seda ka?', 'ema']]) {
    const own = await follow(text, UNNAMED, person);
    assert.deepEqual([own.source.state, own.source.region], ['region_required', null], text);
  }
  // A message that gives a home is the home.
  const moved = await turn({ before: r5.value, after: r5, texts: [LIVE[4], 'Elan Nõo vallas. Ja mis see maksab?'], plan: { person: 'user',
    places: [place(2, 'Elan Nõo vallas', 'Nõo vald', 'user', 'lives')], queries: UNNAMED } });
  assert.deepEqual([moved.source.state, moved.source.region, moved.people.user], ['person_mentioned_region', 'noo_vald', ['noo_vald', 'reported']]);
  // A base name two municipalities share: both stay candidates in the follow-up.
  const shared = await turn({ texts: ['Kas Tartus on sotsiaaltransport?'], plan: { person: 'user', places: [place(1, 'Kas Tartus on sotsiaaltransport?', 'Tartu', 'user', 'other')], queries: ['Tartu sotsiaaltransporditeenus'] } });
  assert.equal(shared.source.state, 'search_plan_ambiguous_region');
  const sharedPrice = await turn({ before: shared.value, after: shared, texts: ['Kas Tartus on sotsiaaltransport?', MEASURED[2]], plan: { person: 'user', places: [], queries: ['sotsiaaltransporditeenuse tasu'] } });
  assert.deepEqual([sharedPrice.source.state, sharedPrice.source.candidates], ['continued_regions', ['tartu_linn', 'tartu_vald']]);
});

// Codex's review of #357-#364 (docs/audits/rag-v2-pr357-364-review-2026-10-04.md in the main checkout), F2, its probe's
// message and query: "see" points at the service, "minu vallas" says where the question asks.
test('ADR-084 (Codex F2): a follow-up that names a municipality by a common word is searched in the person\'s own, whatever the plan names', async () => {
  const question = await turn({ before: nooState, texts: MEASURED.slice(0, 2), plan: { person: 'user', places: [place(2, MEASURED[1], 'Maardu linn', 'user', 'other')],
    queries: ['Maardu linn isikliku abistaja teenuse korraldamine ja taotlemine'] } });
  const follow = (text, queries) => turn({ before: question.value, after: question, texts: [...MEASURED.slice(0, 2), text], plan: { person: 'user', places: [], queries } });
  const common = ['Isikliku abistaja teenuse kättesaadavus elukohajärgses omavalitsuses'];
  const plans = [common, [], ['Nõo valla isikliku abistaja teenus'], ['Maardu isikliku abistaja teenus'], ['Maardu isikliku abistaja teenus', 'Nõo valla isikliku abistaja teenus']];
  for (const text of ['Kas see teenus on ka minu vallas olemas?', 'Kas seda saab ka minu elukohas?', 'Ja mis see meie omavalitsuses maksab?', 'Is it available in my municipality too?', 'А это есть в моём городе?']) {
    for (const queries of plans) {
      const own = await follow(text, queries);
      assert.deepEqual([own.source, keptTexts(own.source), own.people], [home('noo_vald'), ['noo_vald'], { user: ['noo_vald', 'reported'] }], `${text} | ${queries.join(' | ')}`);
    }
  }
  // A question about municipalities in general is no follow-up of the asked one either: the person's own scope stands.
  assert.deepEqual((await follow('Kas see on teistes linnades ka nii?', common)).source, home('noo_vald'));
  // What stays: a follow-up that names no place goes on with the asked municipality, with the measured plan and with none.
  for (const text of ['Ja mis see maksab?', 'Kuidas ma seda taotleda saan?', 'Ja mis see mulle maksma läheb?']) {
    for (const queries of [UNNAMED, [], ['Maardu isikliku abistaja teenuse tasu']]) assert.equal((await follow(text, queries)).source.region, 'maardu_linn', `${text} | ${queries.join(' | ')}`);
  }
  // A person without a residence: the municipality of the question before is not "my municipality"; none is chosen.
  const r5 = await turn(STORED.R5);
  const unknown = await turn({ before: r5.value, after: r5, texts: [LIVE[4], 'Kas see teenus on ka minu vallas olemas?'], plan: { person: 'user', places: [], queries: common } });
  assert.deepEqual([unknown.source.state, unknown.source.region], ['region_required', null]);
  assert.equal((await turn({ before: r5.value, after: r5, texts: [LIVE[4], 'Ja mis see maksab?'], plan: { person: 'user', places: [], queries: UNNAMED } })).source.region, 'maardu_linn');
  // The reading itself: a common word for a municipality, by lemma; a name alone or no place is not one.
  for (const [text, expected] of [['Kas see teenus on ka minu vallas olemas?', true], ['oma elukohas', true], ['elukohajärgses omavalitsuses', true], ['in my town', true], ['в нашей волости', true],
    ['Ja mis see maksab?', false], ['Kas Maardus saab isikliku abistaja teenust?', false], ['Kuidas ma seda taotleda saan?', false], ['', false]]) {
    assert.equal(await namesPlaceByCommonWord(text, analyzer), expected, text);
  }
});

// ADR-128 (10.10.2026): a request for information that is no question ("Soovin infot Maardu … kohta") asks about the
// municipality named after it in its clause; until then it was the limit ADR-074 named. The rule reads the words as
// written and the clause breaks, never the morphology's terms: the stand-in analyzer only finds the names here.
const asks = async text => (await placeOccurrences(text, directory, analyzer)).map(item => item.asking);

test('ADR-128: a wish, need or search for information, or a word of interest, before the name in its clause asks about it (ET, EN, RU)', async () => {
  for (const text of [
    // The wish word and the wanted word side by side, and the word of interest alone.
    'Soovin infot Maardu isikliku abistaja teenuse kohta.', 'Soovin teavet Maardu koduteenuse kohta.', 'Sooviksin teada Maardu koduteenuse hinda.', 'Tahaksin infot Maardu toetuste kohta.',
    'Mind huvitab Maardu isikliku abistaja teenus.', 'Vajan infot Maardu sotsiaaltranspordi kohta.', 'Palun infot Maardu koduteenuse kohta.', 'Otsin infot Maardu hooldekodude kohta.',
    'Tahan teada Kose valla sotsiaaltranspordi hinda.', 'Mind huvitaks Tartu valla sotsiaaltransport.', 'Meid huvitavad Maardu linna toetused.', 'Tahaks teada Maardu koduteenuse hinda.',
    'Tahaksin küsida Maardu koduteenuse kohta.', 'Sooviksin uurida Viimsi valla toetuste kohta.', 'Soovin lisainfot Maardu koduteenuse kohta.', 'Soovin lisainformatsiooni Maardu koduteenuse kohta.',
    'Palun selgitust Märjamaa valla hooldajatoetuse kohta.', 'Otsime infot Põhja-Sakala valla koduteenuse kohta.',
    // The name later in the clause; filler words between the two; a greeting or a lead-in in a clause of its own.
    'Soovin infot isikliku abistaja teenuse kohta Maardus.', 'Sooviksin saada täpsemat teavet Harku valla toimetulekutoetuse kohta.', 'Soovin rohkem infot Viimsi valla koduteenuse kohta.',
    'Palun andke mulle infot Viimsi valla koduteenuse kohta.', 'Tere! Vajaksin ülevaadet Anija valla toetustest.', 'Mul on küsimus: soovin infot Harku valla koduteenuse kohta.',
    'Tere\nSoovin infot Maardu koduteenuse kohta',
    // "vaja" carries no tense: a present or conditional "on", "oleks" before it leaves it a request.
    'Mul on vaja infot Maardu koduteenuse kohta.', 'Mul oleks vaja infot Maardu koduteenuse kohta.', 'Oleks vaja teada Maardu koduteenuse hinda.',
    // No capitals and no punctuation; a question word after the name does not hide the request before it; the reason
    // follows in a clause of its own; a base name two municipalities share is one mention with both as candidates.
    'soovin infot maardu koduteenuse kohta', 'Soovin infot Maardu koduteenuse kohta kuidas taotleda', 'Soovin infot Maardu isikliku abistaja teenuse kohta, sest ema vajab abi.', 'Soovin infot Tartu kohta.',
    'I would like information about the personal assistant service in Maardu.', 'I need information on home care in Maardu.', 'I am looking for information about home care in Viimsi.',
    'I\'m interested in home care in Harku.', 'I\'d like to know the price of home care in Maardu.', 'I would like to ask about home care in Maardu.', 'We need details on home care in Viimsi.',
    // English "if" joins no telling clause here: it opens the indirect question.
    'I would like to know if home care is available in Maardu.',
    'Мне нужна информация об услуге личного помощника в Маарду.', 'Хочу узнать про услугу личного помощника в Маарду.', 'Интересует услуга личного помощника в Маарду.',
    'Хотел бы получить информацию о домашнем уходе в Виймси.', 'Мне нужно узнать про услугу в Маарду.', 'Хотелось бы спросить про услуги в Маарду.',
    // Every word of the lists stands in a row: the plural and conditional wishes, each filler, each word for what is
    // wanted (a list word no row reads could be mistyped or dropped with no test noticing).
    'Sooviks infot Maardu koduteenuse kohta.', 'Soovime veel informatsiooni Maardu koduteenuse kohta.', 'Sooviksime ka lisateavet Maardu koduteenuse kohta.', 'Tahame täpsemalt teada Maardu koduteenuse hinda.',
    'Tahaksime veidi infot Maardu koduteenuse kohta.', 'Vajame lisa info Maardu koduteenuse kohta.', 'Paluksin natuke selgitusi Maardu koduteenuse kohta.', 'Palun anna meile infot Maardu koduteenuse kohta.',
    'Palume infot Maardu koduteenuse kohta.', 'Soovin väga teada Maardu koduteenuse hinda.', 'I want to get some more information about home care in Maardu.', 'We are seeking information about home care in Maardu.',
    'Хотим узнать про услуги в Маарду.', 'Хотела бы знать про услуги в Маарду.', 'Мне нужны сведения об услугах в Маарду.', 'Прошу больше информации об услугах в Маарду.', 'Ищу информацию об услугах в Маарду.',
    'Интересуют услуги в Маарду.',
    // A denial or a past word that ends the sentence, the clause or the line before takes nothing away from the request
    // after it: the word right before the wish word counts only inside the request's own stretch.
    'Vastust ei olnud. Soovin infot Maardu koduteenuse kohta.', 'Ei, soovin infot Maardu koduteenuse kohta.', 'Vastust ei olnud\nSoovin infot Maardu koduteenuse kohta',
    // A hyphen inside a word cuts nothing; only one with a space on both sides stands for a dash (below).
    'Soovin infot e-teenuste kohta Maardus.',
  ]) assert.deepEqual(await asks(text), [true], text);
  // Several mentions: each is read in its own clause ("ja" between two names does not cut the request).
  for (const [text, expected] of [['Soovin infot Maardu ja Viimsi valla koduteenuse kohta.', [true, true]], ['Elan Nõo vallas. Soovin infot Maardu koduteenuse kohta.', [false, true]],
    ['Töötan Maardus. Soovin infot Maardu isikliku abistaja teenuse kohta.', [false, true]], ['Töötan Maardus\nSoovin infot Maardu koduteenuse kohta', [false, true]]]) assert.deepEqual(await asks(text), expected, text);
});

test('ADR-128: a report, a wish for something else, a denied or past wish, and a place in a clause or on a line that only tells, are no requests', async () => {
  for (const text of [
    // A report, a circumstance, a third person's wish, the name before everything, a bare name of the matter.
    'Sain infot Maardu linnavalitsusest, et toetus lõpeb.', 'Töötan Maardus.', 'Ema soovib elada Tartus.', 'Maardu linnavalitsus saatis mulle info.', 'Maardu isikliku abistaja teenus',
    'Ema sai teavet Kose vallavalitsusest.', 'Ema soovib infot Maardu koduteenuse kohta.', 'Käisin eile Viimsis infot küsimas.',
    // A wish for something else than information: a move (the residence rules read moves), help, a flat, work.
    'Soovin kolida Maardusse.', 'Vajan abi Maardus.', 'Soovin elada Maardus.', 'Tahan Maardusse tööle minna.', 'Otsin Maardus korterit.', 'Otsin tööd Maardus.', 'Mul on vaja Maardusse kolida.', 'Vaja abi Maardus.',
    // Another word than a filler between the two: the speaker gives information, or the wish word is a politeness.
    'Soovin jagada infot Maardu linnavalitsuse kohta.', 'Tahan anda infot Maardu linnavalitsuse kohta.', 'Palun aidake, sain infot Maardu linnavalitsusest.', 'palun aidake sain infot maardu linnavalitsusest',
    'Palun vabandust, töötan Maardus.',
    // The name in another clause or sentence, behind a joining word where the comma is left out, or on the next line.
    'Soovin infot koduteenuse kohta, töötan Maardus.', 'Soovin infot koduteenuse kohta. Ema elab Kose vallas.', 'Mind huvitab koduteenus, sest töötan Maardus.',
    'Soovin infot koduteenuse kohta sest töötan Maardus.', 'Soovin infot koduteenuse kohta aga töötan Maardus.', 'Soovin infot koduteenuse kohta ent töötan Maardus', 'Soovin infot koduteenuse kohta ehkki töötan Maardus',
    'Vajan infot kuna ema kolib Maardusse.', 'Soovin teada anda et kolisin Maardusse.', 'Soovin infot koduteenuse kohta\nTöötan Maardus', 'Mind huvitab koduteenus\nTöötan Maardus',
    // The name before the request (the order of "Töötan Maardus ja soovin infot …"), the wanted word after the name, no
    // wish word, the request wrapped over two lines by hand: limits, today's reading.
    'Töötan Maardus ja soovin infot koduteenuse kohta.', 'Maardus soovin infot koduteenuse kohta.', 'Soovin Maardu koduteenuse kohta infot.', 'Infot Maardu koduteenuse kohta.', 'Soovin infot\nMaardu koduteenuse kohta',
    // Denied, or in the past: another form of the verb ("ei huvita", "soovisin", "tahtsin"), or the word right before it.
    'Mind ei huvita Maardu.', 'Mind ei huvitaks Maardu.', 'Ma ei tahaks infot Maardu kohta.', 'Soovisin infot Maardu linnavalitsuselt, aga vastust ei tulnud.', 'Tahtsin infot Maardu linnavalitsuselt.',
    'Mul oli vaja infot Maardu linnavalitsusest.', 'Mul ei ole vaja infot Maardu kohta.', 'Mul pole vaja infot Maardu kohta.', 'Mul polnud vaja infot Maardu kohta.',
    'I work in Maardu.', 'I received information from the Maardu city government.', 'I would like to move to Maardu.', 'I need help in Maardu.', 'I don\'t need information about Maardu.',
    'I\'m not interested in Maardu.', 'I need information on home care because I work in Maardu.', 'I need information on home care though I work in Maardu', 'I need information on home care\nI work in Maardu',
    'I was looking for information about Maardu yesterday.', 'I was interested in Maardu before.', 'We were seeking information from the Maardu city government.',
    'Я работаю в Маарду.', 'Я получил информацию от управы Маарду.', 'Мне нужна помощь в Маарду.', 'Хочу переехать в Маарду.', 'Меня не интересует Маарду.', 'Мне не нужна информация о Маарду.',
    'Мама хочет жить в Маарду.', 'Мне была нужна информация от управы Маарду.', 'Мне было нужно узнать про Маарду.', 'Мне нужна информация об уходе поскольку я работаю в Маарду',
    'Мне нужна информация об уходе если я работаю в Маарду', 'Мне нужна информация об уходе хотя я работаю в Маарду', 'Мне нужна информация об уходе\nЯ работаю в Маарду',
    // Not read, as before: punctuation between the wanted word and the name, a wish for another thing than the listed ones.
    'Soovin infot: Maardu koduteenus.', 'Vajan Maardu sotsiaaltöötaja kontakti.',
    // Every joining word and every past word of the lists stands in a row (each is a must-not rule of its own).
    'Soovin infot koduteenuse kohta kui töötan Maardus', 'Soovin infot koduteenuse kohta kuid töötan Maardus', 'Soovin infot koduteenuse kohta kuigi töötan Maardus',
    'I need information on home care since I work in Maardu', 'I need information on home care but I work in Maardu', 'I need information on home care although I work in Maardu',
    'Мне нужна информация об уходе но я работаю в Маарду', 'Mul on olnud vaja infot Maardu linnavalitsusest.', 'Мне были нужны сведения от управы Маарду.',
    // A hyphen with a space on both sides is typed for a dash and ends the request like a line break: what follows tells
    // something. The cost: a request with such a hyphen between the wanted word and the name is not read either.
    'Soovin infot koduteenuse kohta - töötan Maardus.', 'Mind huvitab koduteenus - töötan Maardus', 'I need information on home care - I work in Maardu', 'Soovin infot - Maardu koduteenus.',
    // The request stands before the name: a word of interest after it is not read (the limit of "the name before the
    // request", which the rows above pin for a wish word only).
    'Maardu koduteenus huvitab mind.',
    // ADR-074 (Codex F2), kept through the rewrite of its line: a work place before a question word, in one clause that
    // ends with a question mark, is not asked about.
    'Töötan Maardus mis koduteenust ma saan?',
  ]) assert.deepEqual(await asks(text), [false], text);
  // Limits, not goals: the syntax rule reads these as requests, and only the second condition of ADR-074 (the plan's
  // queries name that municipality and no other) holds them. A run-on sentence with "ja" (noun phrases are joined by it
  // far more often: "Maardu ja Viimsi valla koduteenuse kohta"), an aside in brackets, "teada anda" (to notify), a denial
  // that is not the word right before, reported speech. A run-on sentence with no joining word at all, a denial two
  // words back in a word of the list ("pole enam vaja": the list reaches one word), a need that is denied by "no" (in
  // Estonian "no" is a filler, "No tahaks teada …", so it is not in the list), and a third person's interest.
  for (const text of ['Soovin infot koduteenuse kohta ja töötan Maardus.', 'Soovin infot koduteenuse kohta (töötan Maardus).', 'Tahan teada anda Maardu linnavalitsuse tegevusest.',
    'I no longer need information about Maardu.', 'He said he would ask about home care in Maardu.', 'Soovin infot koduteenuse kohta töötan Maardus', 'Mul pole enam vaja infot Maardu kohta.',
    'There is no need to ask Maardu.', 'My mother is interested in moving to Maardu.']) assert.deepEqual(await asks(text), [true], text);
});

test('ADR-128: a request is searched in the municipality it names, the residence kept; the plan\'s queries decide as for a question', async () => {
  const told = (message, queries) => turn({ before: nooState, texts: ['Elan Nõo vallas.', message], plan: { person: 'user', places: [], queries } });
  // The wordings of the task, with no attribution from the plan: the server reads the mention as another one, asked about.
  for (const message of ['Soovin infot Maardu isikliku abistaja teenuse kohta.', 'Sooviksin teada Maardu isikliku abistaja teenuse hinda.', 'Tahaksin infot Maardu isikliku abistaja teenuse kohta.',
    'Mind huvitab Maardu isikliku abistaja teenus.', 'Vajan infot Maardu isikliku abistaja teenuse kohta.', 'Palun infot Maardu isikliku abistaja teenuse kohta.', 'Otsin infot Maardu isikliku abistaja teenuse kohta.',
    'Soovin teavet isikliku abistaja teenuse kohta Maardus.', 'Mul on vaja infot Maardu isikliku abistaja teenuse kohta.', 'Мне нужна информация об услуге личного помощника в Маарду.',
    'Хочу узнать про услугу личного помощника в Маарду.', 'Интересует услуга личного помощника в Маарду.']) {
    const result = await told(message, ['Maardu isikliku abistaja teenus']);
    assert.deepEqual([result.source, result.people, result.places.map(item => [item.region, item.relation, item.asking, item.reason])],
      [asked('maardu_linn', home('noo_vald')), { user: ['noo_vald', 'reported'] }, [['maardu_linn', 'other', true, 'unattributed_other_mention']]], message);
  }
  // The second condition of ADR-074 is as it was: the person's own municipality in a query is set aside; no named
  // municipality, or a third one, keeps the search with the person; the own municipality is never an asked one.
  const request = 'Soovin infot Maardu koduteenuse kohta.';
  assert.deepEqual((await told(request, ['Maardu koduteenus', 'Nõo valla sotsiaalabi'])).source, asked('maardu_linn', home('noo_vald')));
  for (const queries of [['koduteenuse taotlemine'], ['Maardu koduteenus', 'Viimsi valla koduteenus']]) assert.deepEqual((await told(request, queries)).source, home('noo_vald'), queries.join(' | '));
  assert.deepEqual((await told('Soovin infot Nõo valla koduteenuse kohta.', ['Nõo valla koduteenus'])).source, home('noo_vald'));
  // Two requested municipalities, and a base name two municipalities share: both are kept, none chosen.
  const two = await told('Soovin infot Maardu ja Viimsi valla koduteenuse kohta.', ['Maardu koduteenus', 'Viimsi valla koduteenus']);
  assert.deepEqual([two.source.state, two.source.candidates, two.people.user], ['question_regions', ['maardu_linn', 'viimsi_vald'], ['noo_vald', 'reported']]);
  const shared = await told('Soovin infot Tartu sotsiaaltranspordi kohta.', ['Tartu sotsiaaltransporditeenus']);
  assert.deepEqual([shared.source.state, shared.source.candidates, shared.people.user], ['question_regions', ['tartu_linn', 'tartu_vald'], ['noo_vald', 'reported']]);
  // A person who has given no residence gets the scope such a first message had before: the plan's queries.
  const first = await turn({ texts: ['Soovin infot Maardu isikliku abistaja teenuse kohta.'], plan: { person: 'user', places: [], queries: ['Maardu isikliku abistaja teenus'] } });
  assert.deepEqual([first.source.state, first.source.region, first.people], ['search_plan_region', 'maardu_linn', {}]);
  // The home and the request in one message: the home is saved, the requested municipality searched.
  const both = await turn({ texts: ['Elan Nõo vallas. Soovin infot Maardu isikliku abistaja teenuse kohta.'], plan: { person: 'user',
    places: [place(1, 'Elan Nõo vallas', 'Nõo vald', 'user', 'lives'), place(1, 'Soovin infot Maardu isikliku abistaja teenuse kohta', 'Maardu linn', 'user', 'other')],
    queries: ['Maardu isikliku abistaja teenuse korraldamine'] } });
  assert.deepEqual([both.source, both.people], [asked('maardu_linn', home('noo_vald', 'user', 'person_mentioned_region')), { user: ['noo_vald', 'reported'] }]);
  // The work place first, then the request about the same municipality.
  assert.deepEqual((await told('Töötan Maardus. Soovin infot Maardu isikliku abistaja teenuse kohta.', ['Maardu isikliku abistaja teenus'])).source, asked('maardu_linn', home('noo_vald')));
});

test('ADR-128: what must not become a request keeps the residence, also when the plan calls the place another mention and its queries name only that place', async () => {
  const told = (message, places = []) => turn({ before: nooState, texts: ['Elan Nõo vallas.', message], plan: { person: 'user', places, queries: ['Maardu koduteenus'] } });
  const other = quote => [place(2, quote, 'Maardu linn', 'user', 'other')];
  // The message and the clause the plan quotes for the place (Codex F2's shape: the query names the place alone).
  for (const [message, quote] of [['Sain infot Maardu linnavalitsusest, et toetus lõpeb.', 'Sain infot Maardu linnavalitsusest'], ['Maardu linnavalitsus saatis mulle info.', null],
    ['Soovin kolida Maardusse.', null], ['Vajan abi Maardus.', null], ['Töötan Maardus.', null], ['Töötan Maardus ja soovin infot koduteenuse kohta.', 'Töötan Maardus'],
    ['Soovin infot koduteenuse kohta. Töötan Maardus.', 'Töötan Maardus'], ['Soovin infot koduteenuse kohta, töötan Maardus.', 'töötan Maardus'],
    ['Soovin infot koduteenuse kohta sest töötan Maardus.', 'töötan Maardus'], ['Mind huvitab koduteenus, sest töötan Maardus.', 'sest töötan Maardus'],
    ['Soovin infot koduteenuse kohta\nTöötan Maardus', 'Töötan Maardus'], ['Soovin infot koduteenuse kohta - töötan Maardus.', 'töötan Maardus'], ['Mul oli vaja infot Maardu linnavalitsusest.', null],
    ['I don\'t need information about Maardu.', null],
    ['I was looking for information about Maardu yesterday.', null], ['Я получил информацию от управы Маарду.', null], ['Мне была нужна информация от управы Маарду.', null],
    ['Мне нужна информация об уходе поскольку я работаю в Маарду', null]]) {
    const result = await told(message, other(quote || message));
    assert.deepEqual([result.source, result.people], [home('noo_vald'), { user: ['noo_vald', 'reported'] }], message);
  }
  // The line break, without the plan's attribution too: a request on one line and the work place on the next.
  const lines = await told('Soovin infot koduteenuse kohta\nTöötan Maardus');
  assert.deepEqual([lines.source, lines.people], [home('noo_vald'), { user: ['noo_vald', 'reported'] }]);
  // A limit, kept as one (the same as ADR-074's "kas ma saan koduteenust kui töötan Maardus" without its comma): a telling
  // clause joined by "ja" reads as requested, and the plan's queries alone decide where the search goes.
  const joined = 'Soovin infot koduteenuse kohta ja töötan Maardus.', quoted = [place(2, 'töötan Maardus', 'Maardu linn', 'user', 'other')];
  assert.deepEqual((await turn({ before: nooState, texts: ['Elan Nõo vallas.', joined], plan: { person: 'user', places: quoted, queries: ['Nõo valla koduteenus'] } })).source, home('noo_vald'));
  assert.deepEqual((await told(joined, quoted)).source, asked('maardu_linn', home('noo_vald')));
});

test('ADR-128: which mention is whose stays as it was: a first-person clause needs the plan\'s attribution, a clause about another person is theirs', async () => {
  const told = (message, places = []) => turn({ before: nooState, texts: ['Elan Nõo vallas.', message], plan: { person: 'user', places, queries: ['Maardu koduteenus'] } });
  // "Ma", "I": the clause is the user's own, and a place in it that the plan left unattributed leaves the residence
  // unresolved, exactly as for "Kas ma saan Maardus …?" (ADR-074's own limit). The rule sets only `asking`.
  for (const message of ['Ma soovin infot Maardu koduteenuse kohta.', 'Ma tahaks teada Maardu koduteenuse hinda.', 'I would like information about home care in Maardu.', 'I need information on home care in Maardu.']) {
    const bare = await told(message);
    assert.deepEqual([bare.source.region, bare.people.user], [null, [null, 'unresolved']], message);
    const attributed = await told(message, [place(2, message, 'Maardu linn', 'user', 'other')]);
    assert.deepEqual([attributed.source, attributed.people.user], [asked('maardu_linn', home('noo_vald')), ['noo_vald', 'reported']], message);
  }
  // A word that starts like a word for a person ("lapsehoiuteenus": laps) makes the clause somebody's: unattributed, it
  // decides nothing; with the plan's attribution the request is read.
  const care = 'Soovin infot Maardu lapsehoiuteenuse kohta.';
  const unread = await told(care);
  assert.deepEqual([unread.places, unread.source], [[], home('noo_vald')]);
  assert.deepEqual((await told(care, [place(2, care, 'Maardu linn', 'user', 'other')])).source, asked('maardu_linn', home('noo_vald')));
  // A request for another person is searched for her, both residences kept.
  const before = { people: [saved('user', 'anija_vald'), saved('ema', 'kose_vald')], focus: 'ema' }, forHer = 'Soovin infot Tartu valla sotsiaaltranspordi kohta ema jaoks.';
  const hers = await turn({ before, texts: [LIVE[0], LIVE[1], forHer], plan: { person: 'ema', places: [place(3, forHer, 'Tartu vald', 'ema', 'other')], queries: ['Tartu valla sotsiaaltransporditeenus'] } });
  assert.deepEqual([hers.source, hers.people], [asked('tartu_vald', home('kose_vald', 'ema')), { user: ['anija_vald', 'reported'], ema: ['kose_vald', 'reported'] }]);
  // A place the same message negates is never a requested one.
  const negated = await turn({ before: { people: [saved('user', 'kose_vald')], focus: 'user' }, texts: ['Elan Kose vallas.', 'Ma ei ela enam Kose vallas. Soovin infot Kose valla toetuste kohta.'],
    plan: { person: 'user', places: [place(2, 'Soovin infot Kose valla toetuste kohta', 'Kose vald', 'user', 'other')], queries: ['Kose vald toimetulekutoetus'] } });
  assert.deepEqual([negated.source.state, negated.source.region, negated.people.user], ['region_required_after_negation', null, [null, 'negated']]);
});

test('ADR-128: the turns after a request go on like after a question (ADR-074, ADR-081), and the user\'s own request returns to the residence', async () => {
  const texts = ['Elan Nõo vallas.', 'Soovin infot Maardu isikliku abistaja teenuse kohta.'];
  const request = await turn({ before: nooState, texts, plan: { person: 'user', places: [], queries: ['Maardu isikliku abistaja teenus'] } });
  assert.deepEqual([askedRegions(request.source), askedPerson(request.source)], [['maardu_linn'], 'user']);
  const follow = (text, queries) => turn({ before: request.value, after: request, texts: [...texts, text], plan: { person: 'user', places: [], queries } });
  // The measured plan of a follow-up that names no municipality (ADR-081), and a short request that names it again.
  assert.deepEqual((await follow('Ja mis see maksab?', ['Isikliku abistaja teenuse tasu kujunemine inimese omaosalus'])).source, asked('maardu_linn', home('noo_vald'), 'earlier_question'));
  assert.deepEqual((await follow('Soovin rohkem infot', ['Maardu isikliku abistaja teenus'])).source, asked('maardu_linn', home('noo_vald'), 'earlier_question'));
  assert.deepEqual((await follow('Aga millist koduteenust ma ise saan?', ['Nõo valla koduteenus'])).source, home('noo_vald'));
});
