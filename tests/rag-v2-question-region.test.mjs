import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { resolvePersonRegions, regionTarget } from '../lib/rag-v2/pilot/person-places.js';
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
const LEMMAS = { vallas: 'vald', valla: 'vald', valda: 'vald', linnas: 'linn', linna: 'linn', maardus: 'maardu', nõos: 'nõo', tartus: 'tartu', viimsis: 'viimsi', koses: 'kose' };
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
 * has read the earlier ones), before is the saved state's value, plan the search plan's person, places and queries.
 */
async function turn({ before = null, texts, plan }) {
  const scopeTurns = texts.map((text, index) => ({ turnId: `t${index + 1}`, text, mode: index ? 'same' : 'new' }));
  const query = { scopeTurns, person: plan.person, previousState: before ? { value: before, sourceTurnIds: scopeTurns.slice(0, -1).map(item => item.turnId) } : null };
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
const asked = (region, own) => ({ state: 'question_region', region, person_scope: own, interpretation: 'asked_municipality_source_scope_not_residence' });
const home = (region, person = 'user', state = 'person_region') => ({ state, region, person, interpretation: 'source_scope_only_not_confirmed_residence' });

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

test('the residence holds in the turns after such a question, and a later statement of a new home still replaces it', async () => {
  const q5 = await turn(STORED.Q5);
  const own = await turn({ before: q5.value, texts: [...LIVE.slice(0, 5), 'Millist koduteenust ma ise saan?'], plan: { person: 'user', places: [], queries: ['koduteenuse taotlemine ja tingimused'] } });
  assert.deepEqual(own.source, home('noo_vald'));
  // A query that names the asked municipality again, without the message naming it, selects nothing but the residence.
  const drift = await turn({ before: q5.value, texts: [...LIVE.slice(0, 5), 'Ja mis see maksab?'], plan: { person: 'user', places: [], queries: ['Maardu isikliku abistaja teenuse hind'] } });
  assert.deepEqual(drift.source, home('noo_vald'));
  const moved = await turn({ before: q5.value, texts: [...LIVE.slice(0, 5), 'Kolisin vahepeal ära, elan nüüd Maardus.'],
    plan: { person: 'user', places: [place(6, 'elan nüüd Maardus', 'Maardu linn', 'user', 'lives')], queries: ['Maardu sotsiaalteenused'] } });
  assert.deepEqual([moved.source.state, moved.source.region, moved.people.user], ['person_mentioned_region', 'maardu_linn', ['maardu_linn', 'reported']]);
});

test('Q6 and Q7 of 04.10: a mention the plan left unattributed, that says nothing of living there, no longer erases the residence', async () => {
  for (const [name, region] of [['Q6', 'pohja_sakala_vald'], ['Q7', 'harku_vald']]) {
    const result = await turn(STORED[name]);
    assert.deepEqual(result.places.map(item => [item.person, item.region, item.relation, item.reason]), [['user', region, 'other', 'unattributed_other_mention']], name);
    assert.deepEqual(result.people, { user: ['noo_vald', 'reported'], ema: ['kose_vald', 'reported'] }, name);
    assert.deepEqual(result.source, asked(region, home('noo_vald')), name);
  }
  // The other way the record's result can come about: the plan names a message the state has already read.
  const wrongTurn = await turn({ ...STORED.Q7, plan: { ...STORED.Q7.plan, places: [place(6, 'Harku valla toimetulekutoetuse taotluse vormi', 'Harku vald', 'user', 'other')] } });
  assert.deepEqual([wrongTurn.source.region, wrongTurn.people.user], ['harku_vald', ['noo_vald', 'reported']]);
  // A mention that does speak of living somewhere, or negates it, with nobody named, is still nobody's to assume.
  const before = { people: [saved('user', 'noo_vald')], focus: 'user' };
  for (const text of ['Ei ela enam Nõo vallas.', 'Elab nüüd Harku vallas.']) {
    const unclear = await turn({ before, texts: ['Elan Nõo vallas.', text], plan: { person: 'user', places: [], queries: ['Harku valla toimetulekutoetus'] } });
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

test('a place of work stays a mention: the search keeps the residence, whatever municipality the message also names', async () => {
  const text = 'Elan Nõo vallas, töötan Maardus; millist koduteenust ma saan?';
  const places = [place(1, 'Elan Nõo vallas', 'Nõo vald', 'user', 'lives'), place(1, 'töötan Maardus', 'Maardu linn', 'user', 'other')];
  for (const queries of [['Nõo valla koduteenuse taotlemine', 'koduteenuse tingimused'], ['koduteenuse taotlemine ja tingimused'], ['Nõo valla koduteenus', 'Maardu linna koduteenus']]) {
    const result = await turn({ texts: [text], plan: { person: 'user', places, queries } });
    assert.deepEqual([result.source.state, result.source.region, result.people], ['person_mentioned_region', 'noo_vald', { user: ['noo_vald', 'reported'] }], queries.join(' | '));
  }
  // The work place in a later message, with the plan's attribution and without it.
  const before = { people: [saved('user', 'noo_vald')], focus: 'user' }, later = ['Elan Nõo vallas.', 'Töötan Maardus. Millist koduteenust ma saan?'];
  for (const planned of [[place(2, 'Töötan Maardus', 'Maardu linn', 'user', 'other')], []]) {
    const result = await turn({ before, texts: later, plan: { person: 'user', places: planned, queries: ['koduteenuse taotlemine ja tingimused'] } });
    assert.deepEqual([result.source, result.people], [home('noo_vald'), { user: ['noo_vald', 'reported'] }]);
  }
});

test('two municipalities in one message: the home it gives is saved and the asked one searched; two asked ones are both kept, none chosen', async () => {
  const both = await turn({ texts: ['Elan Nõo vallas. Kas Maardus saab isikliku abistaja teenust?'], plan: { person: 'user',
    places: [place(1, 'Elan Nõo vallas', 'Nõo vald', 'user', 'lives'), place(1, 'Kas Maardus saab isikliku abistaja teenust?', 'Maardu linn', 'user', 'other')],
    queries: ['Maardu isikliku abistaja teenuse korraldamine'] } });
  assert.deepEqual(both.source, asked('maardu_linn', home('noo_vald', 'user', 'person_mentioned_region')));
  assert.deepEqual(both.people, { user: ['noo_vald', 'reported'] });
  const before = { people: [saved('user', 'noo_vald')], focus: 'user' }, text = 'Kas Maardus või Viimsi vallas on isikliku abistaja teenus?';
  const places = [place(2, text, 'Maardu linn', 'user', 'other'), place(2, text, 'Viimsi vald', 'user', 'other')];
  const compare = await turn({ before, texts: ['Elan Nõo vallas.', text], plan: { person: 'user', places, queries: ['Maardu isikliku abistaja teenus', 'Viimsi valla isikliku abistaja teenus'] } });
  assert.deepEqual(compare.source, { state: 'question_regions', region: null, candidates: ['maardu_linn', 'viimsi_vald'], person_scope: home('noo_vald'),
    interpretation: 'asked_municipality_source_scope_not_residence' });
  assert.deepEqual(keptTexts(compare.source), ['maardu_linn', 'viimsi_vald']);
  assert.deepEqual(compare.people, { user: ['noo_vald', 'reported'] });
  // The plan searches one of the two: that one. It searches the person's own municipality beside an asked one: the residence.
  const one = await turn({ before, texts: ['Elan Nõo vallas.', text], plan: { person: 'user', places, queries: ['Viimsi valla isikliku abistaja teenus'] } });
  assert.equal(one.source.region, 'viimsi_vald');
  const withHome = await turn({ before, texts: ['Elan Nõo vallas.', 'Kas Maardus on koduteenus odavam kui Nõo vallas?'], plan: { person: 'user',
    places: [place(2, 'Kas Maardus on koduteenus odavam', 'Maardu linn', 'user', 'other')], queries: ['Maardu koduteenuse hind', 'Nõo valla koduteenuse hind'] } });
  assert.deepEqual(withHome.source, home('noo_vald'));
  // A base name two municipalities share: both stay candidates, as in a conversation with no residence.
  const shared = await turn({ before, texts: ['Elan Nõo vallas.', 'Kas Tartus on sotsiaaltransport?'], plan: { person: 'user',
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
  const hers = await turn({ before: forHer.value, texts: [...texts, 'Kas ema saaks Tartu vallas sotsiaaltransporti?', 'Kuidas ema koduteenust taotleb?'],
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
  // The same place negated and mentioned again in one message is no question about it.
  const text = 'Ma ei ela enam Kose vallas. Käin Kose vallas tööl.';
  const work = await turn({ before, texts: ['Elan Kose vallas.', text], plan: { person: 'user', places: [place(2, 'Käin Kose vallas tööl', 'Kose vald', 'user', 'other')], queries: ['Kose vald toimetulekutoetus'] } });
  assert.deepEqual([work.source.region, work.people.user], [null, [null, 'negated']]);
  // A quote the server cannot read as one mention (the place twice) was an unresolved residence before; for a mention
  // the plan calls "other" the server now reads the message's mentions itself.
  const twice = 'Kas Maardus on isikliku abistaja teenus ja mis see Maardus maksab?';
  const repeated = await turn({ before: { people: [saved('user', 'noo_vald')], focus: 'user' }, texts: ['Elan Nõo vallas.', twice],
    plan: { person: 'user', places: [place(2, twice, 'Maardu linn', 'user', 'other')], queries: ['Maardu isikliku abistaja teenuse hind'] } });
  assert.deepEqual([repeated.source.region, repeated.people.user], ['maardu_linn', ['noo_vald', 'reported']]);
  // A residence claim the server cannot verify stays unresolved, as before.
  const claim = await turn({ before: { people: [saved('user', 'noo_vald')], focus: 'user' }, texts: ['Elan Nõo vallas.', twice],
    plan: { person: 'user', places: [place(2, twice, 'Maardu linn', 'user', 'lives')], queries: ['Maardu isikliku abistaja teenuse hind'] } });
  assert.deepEqual([claim.source.region, claim.people.user], [null, [null, 'unresolved']]);
});

test('the catalogue for a model run of these cases is well formed, and its checks tell the asked municipality from the residence', async () => {
  const catalogue = JSON.parse(await fs.readFile(new URL('./evaluation/dialogue/scenarios-question-region-1.json', import.meta.url), 'utf8'));
  assert.deepEqual(validateCatalogue(catalogue), []);
  const scenario = catalogue.scenarios.find(item => item.id === 'asks-another-municipality'), askedTurn = scenario.turns[1];
  assert.deepEqual([askedTurn.expect.region, askedTurn.expect.person_regions], ['maardu_linn', { user: 'noo_vald' }]);
  const observed = extra => ({ state: 'completed', region: 'maardu_linn', personRegions: { user: 'noo_vald' }, person: 'user', summaries: [], details: [], contacts: 0, evidenceTitles: ['Isikliku abistaja teenuse osutamise tingimused ja kord'], cited: [],
    text: 'Jah, Maardus on isikliku abistaja teenus. See on mõeldud inimesele, kelle rahvastikuregistri järgne elukoht on Maardu linn.', clarification: false, ...extra });
  assert.equal(checkTurn(askedTurn.expect, observed({})).verdict, 'passed');
  // What 04.10 gave: the residence's catalogue and a question back; and the opposite fault, the residence overwritten.
  const stayed = checkTurn(askedTurn.expect, observed({ region: 'noo_vald', text: 'Siin on kohalik info Nõo valla kohta. Kas küsid Nõo või Maardu kohta?', clarification: true }));
  assert.deepEqual(stayed.checks.filter(check => !check.ok).map(check => check.key), ['region', 'must', 'clarification']);
  assert.deepEqual(checkTurn(askedTurn.expect, observed({ personRegions: { user: 'maardu_linn' } })).checks.filter(check => !check.ok).map(check => check.key), ['person_regions']);
  // An answer that makes the asked municipality's service the user's own entitlement fails.
  const entitled = checkTurn(askedTurn.expect, observed({ text: 'Jah, Maardus on isikliku abistaja teenus ja sul on õigus seda saada.' }));
  assert.deepEqual(entitled.checks.filter(check => !check.ok).map(check => check.key), ['must_not']);
});
