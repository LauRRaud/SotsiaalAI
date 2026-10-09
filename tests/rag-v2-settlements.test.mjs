import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolvePersonRegions, regionTarget, askedRegions, askedPerson, placedTurns } from '../lib/rag-v2/pilot/person-places.js';
import { shortReply } from '../lib/rag-v2/pilot/record-scope.js';
import { runtimeAdapters } from '../lib/rag-v2/pilot/retrieval.js';
import { REGION_STATE_VERSION, validateStateRegion, validateStateContext, modelStateContext } from '../lib/rag-v2/pilot/dialogue-state.js';
import { SEARCH_ASSIST_VERSION, PLAN_SETTLEMENT_INSTRUCTIONS, queryPlanRequest } from '../lib/rag-v2/pilot/search-assist.js';
import { NAMED_PLACE_INSTRUCTIONS, dialogueRequest } from '../lib/rag-v2/pilot/dialogue.js';
import { RECORD_RETRIEVAL_VERSION } from '../lib/rag-v2/search/structured-record-source.js';
import { municipalScope } from '../lib/rag-v2/search/unified.js';
import { DISCOVERY_SCHEMA } from '../lib/rag-v2/search/discovery.js';
import { settlementRows, admittedSettlements, withSettlements, namedPlace } from '../lib/rag-v2/pilot/settlements.js';
import { SETTLEMENTS, SETTLEMENT_SOURCE } from '../lib/rag-v2/adapters/settlement-data.js';
import { LOCATION_ALIAS_ENTRIES } from '../lib/help/locationAliases.js';
import { municipalDirectoryAdapter } from '../lib/rag-v2/adapters/municipal-directory.js';

// ADR-103: a settlement is not a municipality. On 07.10.2026 a user asked what a care home costs, was asked for the
// municipality and answered "Tabasalu", then "jah, pihlakodu", then "jah". No turn had a municipality: the place
// reading knew the municipalities' own names only, and Tabasalu is an alevik of Harku vald. The turns here go through
// the retrieval adapter's own place check and search scope (no database, no model), with the plans that conversation's
// turn records hold.
// The directory has the shape the municipal adapter gives, built from the app's own municipality list; the settlements
// are the official units and the help flow's own place names, as the adapter builds them.
const municipalities = JSON.parse(fs.readFileSync('src/server/data/municipalities.rich.json', 'utf8'));
const directory = municipalities.map(row => ({ region: row.slug.replaceAll('-', '_'), names: [...new Set([row.displayName, row.baseName])] }));
const regionByName = new Map(directory.flatMap(row => row.names.map(name => [name, row.region])));
const aliases = LOCATION_ALIAS_ENTRIES.map(alias => ({ place: alias.place, region: regionByName.get(alias.municipalityDisplayName) }));
const rows = settlementRows(SETTLEMENTS, aliases, directory), official = settlementRows(SETTLEMENTS, [], directory);
// A stand-in for EstNLTK: each word reads as itself and, for the inflected fixture words, its lemma.
const LEMMAS = { vallas: 'vald', valla: 'vald', valda: 'vald', linnas: 'linn', tabasalus: 'tabasalu', jüris: 'jüri', harkus: 'harku' };
const analyzer = { analyze: async words => words.map(word => { const lower = word.toLowerCase(); return `vmet${lower}${LEMMAS[lower] ? ` vmet${LEMMAS[lower]}` : ''}`; }) };
const config = { recordCatalogue: RECORD_RETRIEVAL_VERSION, dialogueStateVersion: REGION_STATE_VERSION, searchAssist: SEARCH_ASSIST_VERSION };
const adapters = settlements => runtimeAdapters(async () => config, 'user-1', { loadRegions: async () => directory, loadSettlements: async () => settlements, analyzer });
const runtime = adapters(rows);
const regions = people => Object.fromEntries(people.map(entry => [entry.person, [entry.region.id, entry.region.status]]));
const place = (turn, quote, name, person, relation) => ({ turn, quote, name, person, relation });
const municipalTexts = directory.map(row => ({ schema_version: DISCOVERY_SCHEMA, document_id: `kord-${row.region}`, version_id: 'v', source: { journal: false, record_kind: null },
  fields: { regions: { value: [row.region] } } }));
const keptTexts = scope => municipalScope(municipalTexts, scope).eligible.map(row => row.document_id.slice(5));
// The saved state's open question, as the conversation's own state held it after the first answer.
const ASKED = [{ based_on: [], question: 'Millises omavalitsuses on inimese rahvastikuregistrijärgne elukoht?' }, { based_on: [], question: 'Millise hooldekodu hinda soovitakse teada?' }];

/** One turn as the service runs it (the helper of rag-v2-question-region.test.mjs, with the state's open questions). */
async function turn({ before = null, texts, plan, after = null, unknowns = [], using = runtime }) {
  const scopeTurns = texts.map((text, index) => ({ turnId: `t${index + 1}`, text, mode: index ? 'same' : 'new' }));
  const value = before || (unknowns.length ? { people: [], focus: 'user' } : null);
  const query = { scopeTurns, person: plan.person, previousState: value ? { value: { ...value, unknowns }, sourceTurnIds: scopeTurns.slice(0, -1).map(item => item.turnId) } : null,
    ...(after && askedRegions(after.source).length ? { askedRegions: askedRegions(after.source), askedPerson: askedPerson(after.source) } : {}) };
  query.places = await using.checkedPlaces(config, query, plan.places || []);
  const { scope, knowledgeRegion } = await using.searchScope(config, query, directory, plan.queries || []);
  const focus = regionTarget(plan.person, value, texts.at(-1)), people = resolvePersonRegions(value?.people, query.places, focus);
  return { places: query.places, settlements: query.settlements || [], query, own: scope, source: knowledgeRegion, people: regions(people), value: { people, focus } };
}

const CONVERSATION = ['Kui palju maksab hooldekodu koht ja kui suure osa sellest peab inimene ise maksma?', 'Tabasalu', 'jah, pihlakodu', 'jah'];
// The plans of that conversation's turn records (07.10.2026): persons, places and queries as the model gave them.
const PLANS = [
  { person: 'user', places: [], queries: ['väljaspool kodu osutatava üldhooldusteenuse hind omaosalus kulude katmine'] },
  { person: 'user', places: [], queries: ['Üldhooldusteenuse maksumus ja teenuse saaja omaosalus Tabasalu'] },
  { person: 'unclear', places: [place(2, 'Tabasalu', 'Tabasalu', 'unclear', 'other')], queries: ['Pihlakodu hooldekodu kohatasu elaniku omaosalus', 'Üldhooldusteenuse rahastamine hoolduskulud ülalpidamiskulud'] },
  { person: 'user', places: [], queries: ['Pihlakodu üldhooldusteenuse maksumus teenusesaaja omaosalus'] },
];

test('the table: the official units of every municipality, with the source it was built from', () => {
  assert.deepEqual([SETTLEMENT_SOURCE.units, SETTLEMENT_SOURCE.exported, Object.keys(SETTLEMENTS).length], [4717, '2026-09-02', directory.length]);
  assert.ok(directory.every(row => typeof SETTLEMENTS[row.region] === 'string' && SETTLEMENTS[row.region].length > 0));
  assert.ok(SETTLEMENTS.harku_vald.split(';').includes('Tabasalu:a'));
  assert.ok(Object.values(SETTLEMENTS).flatMap(list => list.split(';')).every(item => /^[^:;|\s]+:[kavlo]$/u.test(item)));
  // The help flow's own names are in, and decide before the official units.
  assert.deepEqual(rows.filter(row => row.preferred).map(row => row.name).sort((a, b) => a.localeCompare(b, 'et')), LOCATION_ALIAS_ENTRIES.map(alias => alias.place).sort((a, b) => a.localeCompare(b, 'et')));
});

test('the conversation of 07.10.2026: "Tabasalu" is Harku vald, and the short replies after it stay there', async () => {
  const first = await turn({ texts: CONVERSATION.slice(0, 1), plan: PLANS[0] });
  assert.deepEqual([first.source.state, first.settlements], ['region_required', []]);
  // The bare reply to the question about the municipality: read by the server, also where the plan names no place.
  const second = await turn({ texts: CONVERSATION.slice(0, 2), plan: PLANS[1], unknowns: ASKED, after: first });
  assert.deepEqual(second.settlements.map(item => [item.name, item.kind, item.regions, item.turn, item.via]), [['Tabasalu', 'a', ['harku_vald'], 2, 'reply']]);
  assert.deepEqual(second.places.map(item => [item.person, item.region, item.relation]), [['user', 'harku_vald', 'other']]);
  assert.deepEqual([second.source.state, second.source.region, second.source.named_place], ['search_plan_region', 'harku_vald', { name: 'Tabasalu alevik', municipality: 'harku_vald' }]);
  assert.deepEqual(keptTexts(second.source), ['harku_vald']);
  // Nobody's residence: the message says nothing of living there (ADR-074).
  assert.deepEqual(second.people, {});
  // A plan whose queries do not carry the name: the reply itself is the place.
  const unnamed = await turn({ texts: CONVERSATION.slice(0, 2), plan: { ...PLANS[1], queries: ['üldhooldusteenuse maksumus ja omaosalus'] }, unknowns: ASKED, after: first });
  assert.deepEqual([unnamed.source.state, unnamed.source.region, unnamed.source.asked_in, unnamed.source.named_place.name], ['reply_region', 'harku_vald', 'reply', 'Tabasalu alevik']);
  // "jah, pihlakodu" and "jah": short replies that ask nothing go on where the answer before was searched; the mapping is
  // said once, not again. The plan's place of the message the state has read changes nothing.
  const third = await turn({ before: second.value, texts: CONVERSATION.slice(0, 3), plan: PLANS[2], after: second });
  assert.deepEqual([third.source.state, third.source.region, third.source.named_place, third.places], ['continued_region', 'harku_vald', undefined, []]);
  const fourth = await turn({ before: third.value, texts: CONVERSATION, plan: PLANS[3], after: third });
  assert.deepEqual([fourth.source.state, fourth.source.region, keptTexts(fourth.source)], ['continued_region', 'harku_vald', ['harku_vald']]);
  // Before ADR-103 (no settlements): no turn has a municipality, as the turn records show.
  const before = adapters([]);
  const old = await turn({ texts: CONVERSATION.slice(0, 2), plan: PLANS[1], unknowns: ASKED, after: first, using: before });
  assert.deepEqual([old.source.state, old.places, keptTexts(old.source)], ['region_required', [], []]);
});

test('ADR-110: a place the plan numbers wrongly is read in the message that holds its quote', async () => {
  // The re-test of 08.10.2026: the fourth message of a conversation, with the plan's places as its turn record holds
  // them. Both attributions name message 1; the clause stands in message 4. Before, the place was left out (message 1
  // was read), the turn had no municipality and the answer asked which municipality "Jüri" meant.
  const texts = ['Mu poeg on 4-aastane ja ei räägi peaaegu üldse.', 'Mis see olla võib?', 'Kelle poole ma kõigepealt pöörduma peaksin?', 'Elame Jüris.'];
  const before = { people: [], focus: 'poeg' }, queries = ['lapse kõne arengu hindamine kelle poole pöörduda'];
  const numbered = number => ({ person: 'poeg', queries, places: [place(number, 'Elame Jüris', 'Jüri alevik', 'user', 'lives'), place(number, 'Elame Jüris', 'Jüri alevik', 'poeg', 'lives')] });
  const wrong = await turn({ before, texts, plan: numbered(1) }), right = await turn({ before, texts, plan: numbered(4) });
  assert.deepEqual(wrong.settlements.map(item => [item.name, item.regions, item.turn, item.via]), [['Jüri', ['rae_vald'], 4, 'plan']]);
  assert.deepEqual(wrong.places.map(item => [item.person, item.region, item.relation, item.turn]), [['user', 'rae_vald', 'lives', 4], ['poeg', 'rae_vald', 'lives', 4]]);
  assert.deepEqual([wrong.source.region, wrong.source.named_place, wrong.people], ['rae_vald', { name: 'Jüri alevik', municipality: 'rae_vald' }, { poeg: ['rae_vald', 'reported'], user: ['rae_vald', 'reported'] }]);
  // The reading is the one the right number gives.
  assert.deepEqual([wrong.places, wrong.settlements, wrong.source, wrong.people], [right.places, right.settlements, right.source, right.people]);

  // The rule by itself: the quote decides only where exactly one unread message holds it.
  const messages = [{ turn: 1, text: 'Elan Tabasalus.', read: true }, { turn: 2, text: 'Aga hind?', read: true }, { turn: 3, text: 'Ema elab Jüris.', read: false }, { turn: 4, text: 'Ja mina elan Tabasalus.', read: false }];
  const moved = placedTurns([place(1, 'Ema elab Jüris', 'Jüri alevik', 'ema', 'lives')], messages);
  assert.deepEqual(moved, [place(3, 'Ema elab Jüris', 'Jüri alevik', 'ema', 'lives')]);
  // A right number is left alone (the same object), also when another message repeats the clause.
  const kept = place(4, 'elan Tabasalus', 'Tabasalu', 'user', 'lives');
  assert.equal(placedTurns([kept], messages)[0], kept);
  // A clause only a read message holds stays with its number: what the state has read is not read again.
  const read = place(2, 'Elan Tabasalus', 'Tabasalu', 'user', 'lives');
  assert.equal(placedTurns([read], messages.slice(0, 3))[0], read);
  // A clause two unread messages hold names neither.
  const twice = [{ turn: 1, text: 'Elan Jüris.', read: false }, { turn: 2, text: 'Jah, elan Jüris.', read: false }], unclear = place(5, 'lan Jüris', 'Jüri alevik', 'user', 'lives');
  assert.equal(placedTurns([unclear], twice)[0], unclear);
  // What is not a place of the plan's shape passes through untouched.
  assert.deepEqual(placedTurns([null, { turn: 'x', quote: 'Elan Jüris' }, { turn: 1, quote: '' }], twice), [null, { turn: 'x', quote: 'Elan Jüris' }, { turn: 1, quote: '' }]);
  assert.equal(placedTurns(null, twice), null);
});

test('the plan\'s attribution: a settlement in a clause is read like a municipality, in any case form', async () => {
  // A residence the plan attributes: the person's municipality, saved and anchored in the user's own words.
  const lives = await turn({ texts: ['Elan Tabasalus ja vajan koduteenust.'], plan: { person: 'user', places: [place(1, 'Elan Tabasalus', 'Tabasalu', 'user', 'lives')], queries: ['koduteenuse taotlemine'] } });
  assert.deepEqual([lives.source.state, lives.source.region, lives.people.user, lives.source.named_place], ['person_mentioned_region', 'harku_vald', ['harku_vald', 'reported'], { name: 'Tabasalu alevik', municipality: 'harku_vald' }]);
  // The saved state's anchor is read from the same names: the turn's own state context carries the settlement.
  const context = validateStateContext({ regions: directory });
  await assert.rejects(validateStateRegion(lives.value, context, analyzer, [{ text: 'Elan Tabasalus ja vajan koduteenust.' }]), { code: 'dialogue_state_region_unanchored' });
  const placed = runtime.turnStateContext(context, lives.query);
  await validateStateRegion(lives.value, validateStateContext(placed), analyzer, [{ text: 'Elan Tabasalus ja vajan koduteenust.' }]);
  // The model's own state context is not widened: it still carries the date only.
  assert.deepEqual(Object.keys(modelStateContext(REGION_STATE_VERSION, { ...placed, asOfDateUTC: '2026-10-07' })), ['asOfDateUTC']);
  // The next turn: the plan names nothing, the saved residence stands, and its anchor still reads (via "state").
  const next = await turn({ before: lives.value, texts: ['Elan Tabasalus ja vajan koduteenust.', 'Kellele ma helistan?'], plan: { person: 'user', places: [], queries: ['koduteenuse taotlemine kontakt'] }, after: lives });
  assert.deepEqual([next.source.state, next.source.region, next.source.named_place, next.settlements.map(item => item.via)], ['person_region', 'harku_vald', undefined, ['state']]);
  await validateStateRegion(next.value, validateStateContext(runtime.turnStateContext(context, next.query)), analyzer, [{ text: 'Elan Tabasalus ja vajan koduteenust.' }, { text: 'Kellele ma helistan?' }]);
  // A negation is read at the settlement like at a municipality.
  const not = await turn({ texts: ['Ma ei ela enam Tabasalus.'], plan: { person: 'user', places: [place(1, 'Ma ei ela enam Tabasalus', 'Tabasalu', 'user', 'lives')], queries: [] } });
  assert.deepEqual([not.places.map(item => [item.region, item.relation]), not.people.user], [[['harku_vald', 'not']], [null, 'negated']]);
  // A case form the morphology does not read the name from ("Haabneemes"): the word as written is the second name.
  const ending = await turn({ texts: ['Ema elab Haabneemes.'], plan: { person: 'ema', places: [place(1, 'Ema elab Haabneemes', 'Haabneeme', 'ema', 'lives')], queries: [] } });
  assert.deepEqual([ending.settlements.map(item => [item.name, item.word, item.read]), ending.people.ema], [[['Haabneeme', 'Haabneemes', false]], ['viimsi_vald', 'reported']]);
  // A question about a settlement is asked about its municipality (ADR-074), the residence kept.
  const lived = await turn({ texts: ['Elan Tabasalus.'], plan: { person: 'user', places: [place(1, 'Elan Tabasalus', 'Tabasalu', 'user', 'lives')], queries: [] } });
  const asked = await turn({ before: lived.value, texts: ['Elan Tabasalus.', 'Kas Haabneemes saab isikliku abistaja teenust?'], after: lived,
    plan: { person: 'user', places: [place(2, 'Kas Haabneemes saab isikliku abistaja teenust?', 'Haabneeme', 'user', 'other')], queries: ['Haabneeme isikliku abistaja teenus'] } });
  assert.deepEqual([asked.source.state, asked.source.region, asked.people.user, asked.source.named_place.name], ['question_region', 'viimsi_vald', ['harku_vald', 'reported'], 'Haabneeme alevik']);
});

test('a municipality\'s own name decides; a name of several municipalities is asked about; a town comes before a village', async () => {
  // "Kose" is Kose vald, although four other municipalities have a village or an alevik of that name.
  const kose = await turn({ texts: CONVERSATION.slice(0, 1).concat('Kose'), plan: { person: 'user', places: [], queries: ['üldhooldusteenuse maksumus Kose'] }, unknowns: ASKED });
  assert.deepEqual([kose.settlements, kose.source.state, kose.source.region, kose.source.named_place], [[], 'search_plan_region', 'kose_vald', undefined]);
  // A message that names the municipality beside the settlement: the municipality's name is read, the settlement is not.
  const both = await turn({ texts: ['Elan Tabasalus, Harku vallas.'], plan: { person: 'user', places: [place(1, 'Elan Tabasalus, Harku vallas', 'Tabasalu', 'user', 'lives')], queries: [] } });
  assert.deepEqual([both.settlements, both.people.user], [[], ['harku_vald', 'reported']]);
  // The town of Saaremaa vald, not the village of that name in Viljandi vald.
  const town = await turn({ texts: CONVERSATION.slice(0, 1).concat('Kuressaare'), plan: { person: 'user', places: [], queries: [] }, unknowns: ASKED });
  assert.deepEqual([town.source.state, town.source.region, town.source.named_place], ['reply_region', 'saaremaa_vald', { name: 'Kuressaare linn', municipality: 'saaremaa_vald' }]);
  // The help flow's own names decide: "Peetri" is Rae vald there (the official units have it in Järva vald too), and
  // "Nõmme" the district of Tallinn (and a village of eight municipalities).
  for (const [said, region] of [['Peetri', 'rae_vald'], ['Nõmme', 'tallinn'], ['Õismäe', 'tallinn'], ['Ihaste', 'tartu_linn']]) {
    const reply = await turn({ texts: CONVERSATION.slice(0, 1).concat(said), plan: { person: 'user', places: [], queries: [] }, unknowns: ASKED });
    assert.deepEqual([reply.source.state, reply.source.region], ['reply_region', region], said);
  }
  // Without them the official units leave "Peetri" between its two municipalities: both stay candidates and are named.
  const peetri = await turn({ texts: CONVERSATION.slice(0, 1).concat('Peetri'), plan: { person: 'user', places: [], queries: [] }, unknowns: ASKED, using: adapters(official) });
  assert.deepEqual([peetri.source.state, peetri.source.candidates, peetri.source.named_place], ['reply_regions', ['jarva_vald', 'rae_vald'], { name: 'Peetri alevik', municipalities: ['jarva_vald', 'rae_vald'] }]);
  assert.deepEqual(keptTexts(peetri.source).sort(), ['jarva_vald', 'rae_vald']);
  // The kind the user gives decides among same-named units: "Nõmme külas" is not the district.
  const village = await turn({ texts: ['Ema elab Nõmme külas.'], plan: { person: 'ema', places: [place(1, 'Ema elab Nõmme külas', 'Nõmme küla', 'ema', 'lives')], queries: [] } });
  assert.equal(village.settlements[0].kind, 'k');
  assert.ok(village.settlements[0].regions.length > 1 && !village.settlements[0].regions.includes('tallinn'));
  // Whose residence a clause with several places gives stays unresolved, as it does for "Tartu" (linn and vald); the
  // scope carries the name and its municipalities, so the answer can ask which one is meant.
  assert.deepEqual([village.people.ema, village.source.state, village.source.named_place.name, village.source.named_place.municipalities.length > 1], [[null, 'unresolved'], 'region_required', 'Nõmme küla', true]);
});

test('nothing but a named place is read: a person\'s name, a common word and a longer message stay what they are', async () => {
  // "Jüri" is an alevik of Rae vald and a man's name. Unattributed in a sentence, it is no place.
  for (const text of ['Mu isa Jüri vajab hooldekodu kohta.', 'Minu nimi on Anna.', 'Peetri ema vajab abi.']) {
    const read = await turn({ texts: [text], plan: { person: 'user', places: [], queries: ['hooldekodu koha taotlemine'] }, unknowns: ASKED });
    assert.deepEqual([read.settlements, read.places, read.source.state], [[], [], 'region_required'], text);
  }
  // A bare reply is a place only to a question about a place.
  const asked = await turn({ texts: ['Kelle kohta sa küsid?', 'Jüri'].slice(1), plan: { person: 'user', places: [], queries: [] }, unknowns: [{ based_on: [], question: 'Kelle kohta küsimus on?' }] });
  assert.deepEqual(asked.settlements, []);
  const place4 = await turn({ texts: ['Jüri'], plan: { person: 'user', places: [], queries: [] }, unknowns: ASKED });
  assert.deepEqual([place4.settlements.map(item => [item.name, item.regions]), place4.source.region], [[['Jüri', ['rae_vald']]], 'rae_vald']);
  // A short everyday word that is also a village ("Ole", "Loo", "Vee") is not read from a bare reply; with its kind it is.
  for (const text of ['ole', 'Ole hea', 'Vee', 'jah', 'ei']) {
    const read = await turn({ texts: [text], plan: { person: 'user', places: [], queries: [] }, unknowns: ASKED });
    assert.deepEqual(read.settlements, [], text);
  }
  const kind = await turn({ texts: ['Loo alevik'], plan: { person: 'user', places: [], queries: [] }, unknowns: ASKED });
  assert.deepEqual(kind.settlements.map(item => [item.name, item.regions]), [['Loo', ['joelahtme_vald']]]);
  // A reply with other words than the place and a few reply words is left to the plan.
  const long = await turn({ texts: ['Tabasalu kandis vist kuskil'], plan: { person: 'user', places: [], queries: [] }, unknowns: ASKED });
  assert.deepEqual(long.settlements, []);
  // A municipality named as a bare reply is searched there too (the reply scope is not about settlements only).
  const plain = await turn({ texts: ['Harku vald'], plan: { person: 'user', places: [], queries: [] }, unknowns: ASKED });
  assert.deepEqual([plain.settlements, plain.source.state, plain.source.region, plain.source.named_place], [[], 'reply_region', 'harku_vald', undefined]);
});

test('a short reply goes on with the place before it; a short question does not (ADR-081 stays)', () => {
  assert.equal(shortReply(['jah'], 'jah', 3), true);
  assert.equal(shortReply(['jah', 'pihlakodu'], 'jah, pihlakodu', 3), true);
  assert.equal(shortReply(['ja', 'kuidas', 'taotleda'], 'Ja kuidas taotleda?', 3), false);
  assert.equal(shortReply(['aga', 'hind'], 'Aga hind?', 3), false);
  assert.equal(shortReply(['see', 'on', 'minu', 'ema'], 'See on minu ema', 3), false);
  assert.equal(shortReply([], '', 3), false);
});

test('the pure parts: admitted names of a directory, the limits, and what the scope carries', async () => {
  const messages = [{ turn: 1, text: 'Elan Vanamõisas.', read: false }];
  const admitted = await admittedSettlements({ rows, directory, analyzer, messages, places: [place(1, 'Elan Vanamõisas', 'Vanamõisa', 'user', 'lives')] });
  assert.equal(admitted.length, 1);
  assert.deepEqual([admitted[0].name, admitted[0].word, admitted[0].read, admitted[0].regions.length > 5], ['Vanamõisa', 'Vanamõisas', false, true]);
  const wider = withSettlements(directory, admitted);
  assert.equal(wider.length, directory.length);
  for (const region of admitted[0].regions) assert.deepEqual(wider.find(row => row.region === region).names.slice(-2), ['Vanamõisa', 'Vanamõisas']);
  // The base directory is not changed, and a directory without admitted names is the same object.
  assert.ok(directory.every(row => !row.names.includes('Vanamõisa')));
  assert.equal(withSettlements(directory, []), directory);
  validateStateContext({ regions: wider });
  // The scope names the place only for a settlement of the current message that led to its municipality.
  const item = { name: 'Tabasalu', kind: 'a', word: 'Tabasalu', regions: ['harku_vald'], turn: 2, via: 'reply' };
  assert.deepEqual(namedPlace({ state: 'reply_region', region: 'harku_vald' }, [item], 2).named_place, { name: 'Tabasalu alevik', municipality: 'harku_vald' });
  assert.equal(namedPlace({ state: 'reply_region', region: 'harku_vald' }, [item], 3).named_place, undefined);
  assert.equal(namedPlace({ state: 'reply_region', region: 'kose_vald' }, [item], 2).named_place, undefined);
  assert.equal(namedPlace({ state: 'person_region', region: 'harku_vald' }, [{ ...item, via: 'state' }], 2).named_place, undefined);
  // A unit whose name ends with its kind word is not given the word twice.
  assert.equal(namedPlace({ state: 'reply_region', region: 'turi_vald' }, [{ ...item, name: 'Mäeküla', kind: 'k', regions: ['turi_vald'] }], 2).named_place.name, 'Mäeküla');
  // ADR-106: the conversation's places of other municipalities go with the scope as known_places (the user's village
  // while the request is about the mother's town), each once and with one municipality. A place of the turn's own
  // municipality is not listed: the answer works with that municipality already and need not say again where it lies.
  const village = { name: 'Jüri', kind: 'a', word: 'Jüris', regions: ['rae_vald'], turn: 1, via: 'state' }, town = { name: 'Kuressaare', kind: 'l', word: 'Kuressaares', regions: ['saaremaa_vald'], turn: 1, via: 'state' };
  assert.deepEqual(namedPlace({ state: 'person_region', region: 'saaremaa_vald', person: 'ema' }, [village, town, village], 8),
    { state: 'person_region', region: 'saaremaa_vald', person: 'ema', known_places: [{ name: 'Jüri alevik', municipality: 'rae_vald' }] });
  const own = { state: 'person_region', region: 'rae_vald', person: 'poeg' };
  assert.equal(namedPlace(own, [village], 6), own);
  assert.deepEqual(namedPlace({ state: 'region_required', region: null }, [village, town], 21).known_places, [{ name: 'Jüri alevik', municipality: 'rae_vald' }, { name: 'Kuressaare linn', municipality: 'saaremaa_vald' }]);
  // The place the turn itself names is the named place and not a known one; a name of several municipalities is not known.
  const named = namedPlace({ state: 'reply_region', region: 'harku_vald' }, [item, village, { ...village, name: 'Nõmme', kind: 'k', regions: ['a_vald', 'b_vald'] }], 2);
  assert.deepEqual([named.named_place, named.known_places], [{ name: 'Tabasalu alevik', municipality: 'harku_vald' }, [{ name: 'Jüri alevik', municipality: 'rae_vald' }]]);
  // Nothing admitted: the scope is the same object, as before.
  const bare = { state: 'region_required', region: null };
  assert.equal(namedPlace(bare, [], 1), bare);
});

test('the adapter builds the rows once for a set of municipalities; the instructions say what a settlement is and what the answer says', async () => {
  const db = { municipality: { findMany: async () => municipalities.map(row => ({ slug: row.slug, baseName: row.baseName, displayName: row.displayName })) } };
  // Taken apart as runtimeAdapters takes them (on the server's pre-merge check a method that read "this" failed).
  const { loadSettlements, loadRegions } = municipalDirectoryAdapter(db), built = await loadSettlements();
  assert.equal(await loadSettlements(), built);
  assert.equal((await loadRegions()).length, directory.length);
  assert.deepEqual([built.length, built.filter(row => row.preferred).length], [rows.length, LOCATION_ALIAS_ENTRIES.length]);
  assert.ok(built.some(row => row.name === 'Tabasalu' && row.region === 'harku_vald' && row.preferred && row.kind === 'a'));
  // search-assist-9: the plan's line on settlements (its last one until search-assist-10, -11 and -13 added theirs after it).
  const plan = queryPlanRequest({ model: 'm', searchAssist: SEARCH_ASSIST_VERSION }, ['küsimus'], 'et').instructions;
  assert.equal(SEARCH_ASSIST_VERSION, 'rag-v2/search-assist-13');
  assert.equal(plan.split('\n').at(-4), PLAN_SETTLEMENT_INSTRUCTIONS);
  for (const phrase of ['A village, a small town (alevik) or a town district is a place like a municipality', 'also when the message is nothing but that name']) assert.ok(PLAN_SETTLEMENT_INSTRUCTIONS.includes(phrase), phrase);
  // Dialogue prompt 33: the record instructions end with the rule on a named place; a turn without the catalogue has none.
  const body = dialogueRequest({ model: 'm', maxOutputTokens: 100, reasoning: 'low', recordCatalogue: RECORD_RETRIEVAL_VERSION }, 'Küsimus?', { sources: {}, evidence: [] }, 'et', { userTurns: [] });
  assert.ok(body.instructions.includes(NAMED_PLACE_INSTRUCTIONS));
  assert.equal(dialogueRequest({ model: 'm', maxOutputTokens: 100, reasoning: 'low' }, 'Küsimus?', { sources: {}, evidence: [] }, 'et', { userTurns: [] }).instructions.includes(NAMED_PLACE_INSTRUCTIONS), false);
  for (const phrase of ['records.scope has named_place', 'say once, at the start of the answer, that the place belongs to it', 'do not ask again which municipality it is',
    'a place of that name lies in each of them: say so, name them, and ask which one is meant']) assert.ok(NAMED_PLACE_INSTRUCTIONS.includes(phrase), phrase);
  // A general rule: no place name in either instruction.
  assert.doesNotMatch(NAMED_PLACE_INSTRUCTIONS + PLAN_SETTLEMENT_INSTRUCTIONS, /Tabasalu|Harku|Tallinn|\d/u);
});
