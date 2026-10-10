import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveRecordScope, mentionedRegions, placeOccurrences, namesPlaceByCommonWord, wordTerms } from '../lib/rag-v2/pilot/record-scope.js';
import { resolvePersonRegions, regionTarget } from '../lib/rag-v2/pilot/person-places.js';
import { runtimeAdapters } from '../lib/rag-v2/pilot/retrieval.js';
import { REGION_STATE_VERSION, validateStateRegion, validateStateContext } from '../lib/rag-v2/pilot/dialogue-state.js';
import { SEARCH_ASSIST_VERSION } from '../lib/rag-v2/pilot/search-assist.js';
import { RECORD_RETRIEVAL_VERSION } from '../lib/rag-v2/search/structured-record-source.js';
import { settlementRows, withSettlements } from '../lib/rag-v2/pilot/settlements.js';
import { SETTLEMENTS } from '../lib/rag-v2/adapters/settlement-data.js';
import { LOCATION_ALIAS_ENTRIES } from '../lib/help/locationAliases.js';
import { municipalDirectoryAdapter } from '../lib/rag-v2/adapters/municipal-directory.js';
import { RECORDED_TERMS, recordedAnalyzer as analyzer } from './fixtures/rag-v2-recorded-terms.mjs';

// ADR-127 (10.10.2026): a part of a compound word is not a municipality. The morphology gives a compound its root tokens
// beside its lemma, and the place reading took any of them for the word's own form: "Raekülas" (a district of the city
// of Pärnu) selected Rae vald, "raekojas" too, "Järvamaal" Järva vald, "Pärnumaal" Pärnu linn, "kanepiõli" Kanepi vald.
// This machine has no EstNLTK, so the analyzer here is a stand-in that answers with the term sets recorded from the
// server's own (tests/fixtures/rag-v2-recorded-terms.mjs). The rows that read the morphology alone (what a word reads
// as, which municipality a sentence names, the common word) run against the real one too, in
// tests/rag-v2-record-scope.test.mjs on the server; the turns ("in a turn" below) and the test on invented readings run
// only here, on the same words.
// The directory is the app's own municipality list as the chat loads it (the adapter's loadRegions): the register's two
// names of each municipality and, for the two islands that are their municipality, the island's name as a land.
// registerOnly: the two names alone, for the rows that show what the rule took before the land names gave it back.
const municipalities = JSON.parse(fs.readFileSync('src/server/data/municipalities.rich.json', 'utf8'));
const directory = await municipalDirectoryAdapter({ municipality: { findMany: async () => municipalities } }).loadRegions();
const registerOnly = municipalities.map(row => ({ region: row.slug.replaceAll('-', '_'), names: [...new Set([row.displayName, row.baseName])] }));
const scope = text => resolveRecordScope([{ turnId: 't1', text, mode: 'same' }], directory, analyzer);
const read = async text => { const found = await scope(text); return found.region || found.candidates || found.state; };

test('the recorded readings carry the parts of a compound, and a word\'s own readings leave them out', async () => {
  // The fault's input is in the fixture: a municipality's name, or its kind word, is among the compound's terms.
  for (const [word, part] of [['Raekülas', 'rae'], ['raekojas', 'rae'], ['Järvamaal', 'järva'], ['Pärnumaal', 'pärnu'], ['Tartumaal', 'tartu'], ['Mulgimaal', 'mulgi'], ['tõrvalill', 'tõrva'],
    ['kanepiõli', 'kanepi'], ['Kosejõe', 'kose'], ['Jürikooli', 'jüri'], ['Annelinnas', 'linn'], ['Sauevallas', 'vald'], ['Muhumaal', 'muhu'], ['Kihnumaal', 'kihnu'], ['Järvakandis', 'järva'], ['Türisalus', 'türi'],
    ['Võrumõisas', 'võru'], ['tapamaja', 'tapa'], ['võrukael', 'võru'], ['mulgikapsad', 'mulgi'], ['Harjumaal', 'harju'], ['Virumaal', 'viru']]) assert.ok(RECORDED_TERMS[word].includes(part), word);
  const own = async word => (await wordTerms(word, analyzer))[0].terms.sort();
  assert.deepEqual(await own('Raekülas'), ['raeküla', 'raekülas']);
  assert.deepEqual(await own('Muhumaal'), ['muhumaa', 'muhumaal']);
  assert.deepEqual(await own('Annelinnas'), ['annelinn', 'annelinnas']);
  // One root, no compound: "valdkond" holds no "vald". Inside a longer compound it is a part itself.
  assert.deepEqual(await own('valdkonnas'), ['valdkond', 'valdkonnas']);
  assert.deepEqual(await own('sotsiaalvaldkonnas'), ['sotsiaalvaldkond', 'sotsiaalvaldkonnas']);
  // Two compound readings: both lemmas stay, the three parts go.
  assert.deepEqual(await own('Raekülla'), ['raeküla', 'raeküll', 'raekülla']);
  assert.deepEqual(await own('Mustamäel'), ['mustamäe', 'mustamäel', 'mustamägi']);
  // A hyphen joins words, not parts: "narva" stays a reading, and the hyphen rule (a hyphenated name only in a
  // hyphenated word, and the other way round) keeps Narva linn out of "Narva-Jõesuus".
  assert.deepEqual(await own('Narva-Jõesuus'), ['jõesuu', 'jõesuus', 'narva', 'narva-jõesuu', 'narva-jõesuus']);
  assert.deepEqual(await own('Tartu-Tallinna'), ['tallinn', 'tartu', 'tartu-tallinn', 'tartu-tallinna']);
  // No compound: every reading is the word's own, also where one begins another ("tõrv", "tõrva", "tõrvas").
  assert.deepEqual(await own('Tõrvas'), ['tõrv', 'tõrva', 'tõrvama', 'tõrvas']);
  assert.deepEqual(await own('Rae'), ['raad', 'rae']);
});

test('the rule itself, on invented readings: the word as written is never a part, and a compound of three parts is cut like one of two', async () => {
  // NOT recorded readings: made up for the two corners of the rule no recorded word reaches, and kept out of the fixture.
  const invented = { tee: ['tee', 'ma', 'teema'], Tee: ['tee', 'ma', 'teema'], Raekülakoolis: ['rae', 'küla', 'kool', 'raekülakool', 'raekülakoolis'] };
  const made = { analyze: async words => words.map(word => (invented[word] || [word.toLowerCase()]).map(term => `vmet${term}`).join(' ')) };
  // "tee" could be cut out of another reading ("teema" = tee + ma), but it is the word as written: it stays its own.
  // So does the word written with a capital letter, at the start of a sentence: the terms are lowercase, the word is not.
  for (const word of ['tee', 'Tee']) {
    assert.deepEqual((await wordTerms(word, made))[0].terms.sort(), ['tee', 'teema'], word);
    assert.deepEqual(await mentionedRegions(word, [{ region: 'x_vald', names: ['Tee'] }], made), ['x_vald'], word);
  }
  // rae + küla + kool: all three are parts, also the middle one.
  assert.deepEqual((await wordTerms('Raekülakoolis', made))[0].terms.sort(), ['raekülakool', 'raekülakoolis']);
  for (const name of ['Rae', 'Küla', 'Kool']) assert.deepEqual(await mentionedRegions('Laps käib Raekülakoolis.', [{ region: 'x_vald', names: [name] }], made), [], name);
});

test('a compound that holds a municipality\'s name selects no municipality', async () => {
  for (const text of ['Elan Raekülas.', 'Kolisin Raekülla.', 'Abiellusime raekojas.', 'Raekoja platsil on laat.', 'Elan Järvamaal.', 'Elan Pärnumaal.', 'Ema elab Tartumaal.', 'Elan Raplamaal.',
    'Elan Võrumaal.', 'Elan Viljandimaal.', 'Elan Valgamaal.', 'Elan Põlvamaal.', 'Elan Jõgevamaal.', 'Elan Mulgimaal.', 'Kas tõrvalill on mürgine?', 'Katusel on tõrvapapp.', 'Kas kanepiõli aitab?',
    'Maja on Kosejõe ääres.', 'Käisin kosekülas.',
    // The second recording of 10.10.2026. Settlements that begin with a municipality's name (an alev of Kehtna vald, a
    // village of Harku vald and one of Võru vald; before: Järva vald, Türi vald, Võru linn or vald) and everyday
    // compounds (before: Tapa vald, Võru linn or vald, Mulgi vald).
    'Elan Järvakandis.', 'Elan Türisalus.', 'Elan Võrumõisas.', 'tapamaja', 'võrukael', 'mulgikapsad']) {
    assert.deepEqual([await scope(text), await mentionedRegions(text, directory, analyzer), await placeOccurrences(text, directory, analyzer)], [{ state: 'region_required', region: null }, [], []], text);
  }
  // What the rule took by the register's two names: an island named as a land, where the island is its municipality
  // (before: Muhu vald, Kihnu vald, through the parts "muhu" and "kihnu"). The directory the chat loads gives both back
  // as names of the municipality itself (below).
  for (const text of ['Elan Muhumaal.', 'Elan Kihnumaal.']) assert.deepEqual([await mentionedRegions(text, registerOnly, analyzer), await placeOccurrences(text, registerOnly, analyzer)], [[], []], text);
});

test('a municipality is still selected by its own forms, also where its name is a compound', async () => {
  for (const [text, region] of [['Elan Raes.', 'rae_vald'], ['Elan Rae vallas.', 'rae_vald'], ['Kolisin Raele.', 'rae_vald'], ['Elan Hiiumaal.', 'hiiumaa_vald'], ['Saaremaal on raske abi saada.', 'saaremaa_vald'],
    ['Elan Setomaal.', 'setomaa_vald'], ['Elan Märjamaal.', 'marjamaa_vald'], ['Elan Põltsamaal.', 'poltsamaa_vald'], ['Elan Sillamäel.', 'sillamae_linn'], ['Elan Mustvees.', 'mustvee_vald'],
    ['Elan Haapsalus.', 'haapsalu_linn'], ['Elan Kuusalus.', 'kuusalu_vald'], ['Elan Jõelähtmel.', 'joelahtme_vald'], ['Elan Häädemeestel.', 'haademeeste_vald'], ['Elan Alutagusel.', 'alutaguse_vald'],
    ['Elan Peipsiääres.', 'peipsiaare_vald'], ['Elan Põhja-Pärnumaal.', 'pohja_parnumaa_vald'], ['Ta elab Narva-Jõesuus.', 'narva_joesuu_linn'], ['Elan Tõrvas.', 'torva_vald'], ['Elan Kosel.', 'kose_vald'],
    ['Elan Kanepis.', 'kanepi_vald'], ['Elan Järvas.', 'jarva_vald'], ['Elan Pärnus.', 'parnu_linn'], ['Kolisin Tapale.', 'tapa_vald'], ['Elan Tallinnas.', 'tallinn'], ['Elan Muhus.', 'muhu_vald'],
    // The known limit of ADR-020 stays: the word as written is the name ("kanepi", the genitive of hemp).
    ['Kas kanepi tarvitamine on ohtlik?', 'kanepi_vald'],
    // A limit ADR-127 does not change: a county written in two words still selects its namesake municipality, because the
    // name stands as a word of its own. Only the county written as one word ("Järvamaal") selects none.
    ['Elan Järva maakonnas.', 'jarva_vald'],
    // The island named as a land is a name of its municipality itself (adapters/municipal-directory.js): the whole word
    // is the name, read like "Elan Muhus." wherever it stands, and no part of the compound is needed for it.
    ['Elan Muhumaal.', 'muhu_vald'], ['Elan Kihnumaal.', 'kihnu_vald'], ['Elan Kihnus.', 'kihnu_vald']]) assert.equal(await read(text), region, text);
  // A closed list: these two municipalities have a third name, and no other has one.
  assert.deepEqual(directory.filter(row => row.names.length > 2).map(row => [row.region, row.names.at(-1)]).sort(), [['kihnu_vald', 'Kihnumaa'], ['muhu_vald', 'Muhumaa']]);
  assert.deepEqual(directory.map(row => [row.region, row.names.slice(0, 2)]), registerOnly.map(row => [row.region, row.names]));
  assert.deepEqual(await read('Rakveres elan.'), ['rakvere_linn', 'rakvere_vald']);
  assert.deepEqual(await read('Elan Tartus.'), ['tartu_linn', 'tartu_vald']);
  // Case forms the sweep of the 705 did not make (the terminative, essive, translative and abessive) and the word with
  // "-ki": the morphology gives the name as their lemma, and no part.
  for (const form of ['Tartuni', 'Tartuna', 'Tartuks', 'Tartuta', 'Tartuski']) assert.deepEqual(await read(form), ['tartu_linn', 'tartu_vald'], form);
  assert.equal(await read('Tahan end tappa.'), 'region_required');
});

test('the other names and the negation of a message are read without the compound', async () => {
  // The district and its town: before, the answer had to ask between Pärnu linn and Rae vald.
  assert.equal(await read('Elan Raekülas, Pärnus.'), 'parnu_linn');
  // The county and the municipality in it: before, between Järva vald and Türi vald.
  assert.equal(await read('Elan Järvamaal, Türi vallas.'), 'turi_vald');
  // A negated name is not affirmed by a compound after it (before: Rae vald, selected by "Raekülas").
  assert.equal(await read('Ma ei ela Raes, elan Raekülas.'), 'region_required_after_negation');
  assert.equal(await read('Elan Raekülas, mitte Rae vallas.'), 'region_required_after_negation');
  // And a negated compound is no negated mention: the state that reads every mention saw "not Rae vald" beside "lives
  // in Rae vald" in one message and left the person's municipality unresolved.
  const mentions = async text => (await placeOccurrences(text, directory, analyzer)).map(item => [item.region ?? item.candidates, item.negated]);
  assert.deepEqual(await mentions('Ma ei ela Raekülas, elan Raes.'), [['rae_vald', false]]);
  assert.deepEqual(await mentions('Ma ei ela Raes, elan Raekülas.'), [['rae_vald', true]]);
  assert.equal(await read('Ma ei ela enam Raekülas.'), 'region_required');
});

test('the kind word inside a compound completes no name, and a name written together with its kind selects none', async () => {
  // Before: "linn" of "Annelinnas" made "Tartu linn" of "Tartus" wherever it stood in the message. The search scope then
  // was Tartu linn, and the reading of every mention found none: the full name hid the short one and stood nowhere.
  assert.deepEqual(await read('Elan Tartus, laps käib Annelinnas koolis.'), ['tartu_linn', 'tartu_vald']);
  assert.deepEqual(await mentionedRegions('Elan Tartus, laps käib Annelinnas koolis.', directory, analyzer), ['tartu_linn', 'tartu_vald']);
  // Also side by side: "Tartus Annelinnas" is as open as "Tartus", and stays so in a turn, which asks (below). The letters
  // "linn" at the district's end no longer decide, and nothing decides in their place.
  assert.deepEqual(await read('Elan Tartus Annelinnas.'), ['tartu_linn', 'tartu_vald']);
  // The other side of the same accident: a district's "linn" no longer turns a rural municipality named beside it into
  // a choice between it and the town (before: Tartu linn or Tartu vald).
  assert.equal(await read('Elan Tartu vallas, töötan Kesklinnas.'), 'tartu_vald');
  // Decided with ADR-127: "Sauevallas" for "Saue vallas" is a spelling the reading does not repair. Before, the search
  // scope read it as Saue vald, never saw its negation, and the reading of every mention did not see it at all.
  for (const text of ['Elan Sauevallas.', 'Elan Tartuvallas.', 'Elan Koselinnas.', 'Ma ei ela Sauevallas.']) assert.equal(await read(text), 'region_required', text);
});

test('one test for a name word: a hyphenated place holds no other municipality, wherever the reading looks (ADR-020, ADR-127)', async () => {
  // Before, only the first of the two looks had the hyphen rule: with "Keilas" elsewhere in the message the second found
  // Keila linn in "Keila-Joal" too (an alevik of Lääne-Harju vald) and read it as the residence.
  assert.deepEqual((await placeOccurrences('Elan Keila-Joal, töötan Keilas.', directory, analyzer)).map(item => [item.region, item.residence]), [['keila_linn', false]]);
  // Before: open between Narva-Jõesuu linn and Narva linn, the negated "Narvas" being affirmed by "Narva-Jõesuus".
  assert.equal(await read('Elan Narva-Jõesuus, mitte Narvas.'), 'narva_joesuu_linn');
  // A hyphenated name whose last piece is a compound with another municipality's name in it (before: open between
  // Põhja-Pärnumaa vald and Pärnu linn).
  assert.equal(await read('Elan Põhja-Pärnumaal, mitte Pärnus.'), 'pohja_parnumaa_vald');
});

test('a common word for a municipality is read as before, also as the head of a compound (ADR-084)', async () => {
  // Not changed by ADR-127: "vallas" is the word's own lemma; in "Kesklinnas" the head "linn" still says the message
  // names a place by a common word. The first part of "vallavalitsus" is recorded as the stem "valla", not the lemma "vald".
  for (const [text, expected] of [['Kas see teenus on ka minu vallas olemas?', true], ['Elan Kesklinnas.', true], ['Elan Sauevallas.', true], ['Mida vallavalitsus ütleb?', false],
    ['Küsisin linnavalitsusest.', false], ['Elan Raekülas.', false],
    // The second recording of 10.10.2026. The head of a compound, in lowercase too; "koduvald" is a common word by its
    // lemma and by its head alike.
    ['Kas naabervallas on see teenus?', true], ['Kas lähivallas on see teenus?', true], ['Elan kesklinnas.', true], ['Kas minu koduvallas on see teenus?', true],
    // The cost that stays as it was before ADR-127: any compound that ends in "linn" names a place by a common word.
    ['Elan vanalinnas.', true], ['Elan pealinnas.', true], ['Elan Annelinnas.', true],
    // A field of work is no municipality: "valdkond" is one root, and a part of "sotsiaalvaldkond" as a whole.
    ['Kes selles valdkonnas aitab?', false], ['Kes sotsiaalvaldkonnas aitab?', false], ['Küsisin vallavalitsuses.', false], ['Elan Muhumaal.', false]]) assert.equal(await namesPlaceByCommonWord(text, analyzer), expected, text);
});

// The turns below go through the retrieval adapter's own place check and search scope (no database, no model), as in
// tests/rag-v2-settlements.test.mjs: the settlements are the official units and the help flow's own place names.
const regionByName = new Map(directory.flatMap(row => row.names.map(name => [name, row.region])));
const rows = settlementRows(SETTLEMENTS, LOCATION_ALIAS_ENTRIES.map(alias => ({ place: alias.place, region: regionByName.get(alias.municipalityDisplayName) })), directory);
const config = { recordCatalogue: RECORD_RETRIEVAL_VERSION, dialogueStateVersion: REGION_STATE_VERSION, searchAssist: SEARCH_ASSIST_VERSION };
const runtime = runtimeAdapters(async () => config, 'user-1', { loadRegions: async () => directory, loadSettlements: async () => rows, analyzer });
const place = (turn, quote, name, person, relation) => ({ turn, quote, name, person, relation });
const ASKED = [{ based_on: [], question: 'Millises omavalitsuses on inimese rahvastikuregistrijärgne elukoht?' }];
async function turn({ before = null, texts, plan, unknowns = [] }) {
  const scopeTurns = texts.map((text, index) => ({ turnId: `t${index + 1}`, text, mode: index ? 'same' : 'new' }));
  const value = before || (unknowns.length ? { people: [], focus: 'user' } : null);
  const query = { scopeTurns, person: plan.person, previousState: value ? { value: { ...value, unknowns }, sourceTurnIds: scopeTurns.slice(0, -1).map(item => item.turnId) } : null };
  query.places = await runtime.checkedPlaces(config, query, plan.places || []);
  const { knowledgeRegion } = await runtime.searchScope(config, query, directory, plan.queries || []);
  const people = resolvePersonRegions(value?.people, query.places, regionTarget(plan.person, value, texts.at(-1)));
  return { places: query.places.map(item => [item.person, item.region, item.relation]), settlements: (query.settlements || []).map(item => [item.name, item.regions, item.via]), source: knowledgeRegion,
    user: people.filter(entry => entry.person === 'user').map(entry => [entry.region.id, entry.region.status])[0], value: { people, focus: 'user' }, query,
    // Why a place was left unresolved.
    reasons: query.places.flatMap(item => (item.relation === 'unresolved' ? [item.reason] : [])) };
}

test('in a turn: the compound is no residence and no asked place; the settlement table reads the whole word', async () => {
  // Without the plan's attribution the message names no place (before: the server read a residence in Rae vald by itself).
  const bare = await turn({ texts: ['Elan Raekülas.'], plan: { person: 'user', places: [], queries: ['koduteenuse taotlemine'] } });
  assert.deepEqual([bare.places, bare.settlements, bare.source.state, bare.user], [[], [], 'region_required', undefined]);
  // The plan's queries still lead to the municipality they name.
  const planned = await turn({ texts: ['Elan Raekülas.'], plan: { person: 'user', places: [], queries: ['koduteenuse taotlemine Pärnus'] } });
  assert.deepEqual([planned.source.state, planned.source.region], ['search_plan_region', 'parnu_linn']);
  // The plan names it as a place: the district of Pärnu, by the place names (lib/help/locationAliases.js), which decide
  // before the official units; those know only a village Raeküla in Väike-Maarja vald. The answer says where the place
  // lies, so a wrong reading can be corrected. Before, "Rae" in it was Rae vald's own name and no settlement was asked for.
  // The plan's name for the place is read with its recorded parts too ("Raeküla": rae, küla), and is no Rae vald either.
  const named = await turn({ texts: ['Elan Raekülas.'], plan: { person: 'user', places: [place(1, 'Elan Raekülas', 'Raeküla', 'user', 'lives')], queries: ['koduteenuse taotlemine'] } });
  assert.deepEqual([named.settlements, named.places, named.source.region, named.source.named_place, named.user],
    [[['Raeküla', ['parnu_linn'], 'plan']], [['user', 'parnu_linn', 'lives']], 'parnu_linn', { name: 'Raeküla', municipality: 'parnu_linn' }, ['parnu_linn', 'reported']]);
  // Without the place names the official units alone read the village (the reading of 10.10.2026 before that line).
  const official = runtimeAdapters(async () => config, 'user-1', { loadRegions: async () => directory, loadSettlements: async () => settlementRows(SETTLEMENTS, [], directory), analyzer });
  const query = { scopeTurns: [{ turnId: 't1', text: 'Elan Raekülas.', mode: 'new' }], person: 'user', previousState: null };
  await official.checkedPlaces(config, query, [place(1, 'Elan Raekülas', 'Raeküla', 'user', 'lives')]);
  assert.deepEqual(query.settlements.map(item => [item.name, item.regions]), [['Raeküla', ['vaike_maarja_vald']]]);
  // The district with its town: the town's own name decides (before: unresolved between Pärnu linn and Rae vald).
  const town = await turn({ texts: ['Elan Raekülas, Pärnus.'], plan: { person: 'user', places: [place(1, 'Elan Raekülas, Pärnus', 'Pärnu linn', 'user', 'lives')], queries: [] } });
  assert.deepEqual([town.settlements, town.places, town.user], [[], [['user', 'parnu_linn', 'lives']], ['parnu_linn', 'reported']]);
  // A negated compound beside the affirmed name (before: "not Rae vald" and "lives in Rae vald", so unresolved).
  const moved = await turn({ texts: ['Ma ei ela Raekülas, elan Raes.'], plan: { person: 'user', places: [], queries: [] } });
  assert.deepEqual([moved.places, moved.user], [[['user', 'rae_vald', 'lives']], ['rae_vald', 'reported']]);
  // The same with a county written as one word beside its town (before: "not" and "lives" of Pärnu linn, unresolved).
  const county = await turn({ texts: ['Ma ei ela Pärnumaal, elan Pärnus.'], plan: { person: 'user', places: [], queries: [] } });
  assert.deepEqual([county.places, county.user], [[['user', 'parnu_linn', 'lives']], ['parnu_linn', 'reported']]);
  // A settlement whose own name is a compound is read as before.
  const tabasalu = await turn({ texts: ['Elan Tabasalus.'], plan: { person: 'user', places: [place(1, 'Elan Tabasalus', 'Tabasalu', 'user', 'lives')], queries: [] } });
  assert.deepEqual([tabasalu.settlements, tabasalu.user], [[['Tabasalu', ['harku_vald'], 'plan']], ['harku_vald', 'reported']]);
  // A name written together with its kind costs a turn nothing: with the plan's "Saue vald" it was unresolved before
  // ADR-127 too, because the server finds no word of the clause that is that name.
  const joinedUp = await turn({ texts: ['Elan Sauevallas, vajan koduteenust.'], plan: { person: 'user', places: [place(1, 'Elan Sauevallas', 'Saue vald', 'user', 'lives')], queries: [] } });
  assert.deepEqual([joinedUp.places, joinedUp.reasons, joinedUp.user], [[['user', null, 'unresolved']], ['place_link_unverified'], [null, 'unresolved']]);
});

// ADR-127 (10.10.2026): a town named with its district. Until that day "Elan Tartus Annelinnas." was saved as Tartu linn
// by accident (the part "linn" of "Annelinnas" completed the name "Tartu linn"). With a word's own readings the clause is
// as open as "Elan Tartus" (Tartu linn or Tartu vald; the same for Viljandi, Võru and Rakvere), and the turn asks which.
// That is a KNOWN COST, kept on purpose. A second round of that day chose between the two by a place named in the clause
// (a district of the place names, or an official unit the plan named), repaired the plan's attributions around it and
// read a plan quote that stopped at the shared name as the whole message read it. An independent check found it saving a
// wrong municipality: "Elan Tartus mitte Annelinnas." became Tartu linn, and "Elan Tartus Raadil." with the plan's
// "Raadi" Tartu vald (Raadi is an alev of Tartu vald in the official units and a district of the town besides). A wrong
// municipality is worse than a clarifying question, so that rule was taken out whole: beside a name two municipalities
// share the server chooses nothing by itself.
const lives = (text, name, number = 1) => place(number, text.replace(/\.$/u, ''), name, 'user', 'lives');
const told = (text, places = [], rest = {}) => turn({ texts: [text], plan: { person: 'user', places, queries: [] }, ...rest });
// The turn asks: nothing admitted as a place, no municipality for the person and none for the search, which says why.
const ASKS = [[], [null, 'unresolved'], 'region_required', 'attribution_unresolved'];
const outcome = read => [read.settlements, read.user, read.source.state, read.source.reason];

test('in a turn: beside a name two municipalities share a district decides nothing, and the turn asks which municipality', async () => {
  // In every shape the plan gives the clause without naming a municipality outright: no place (the server reads the
  // clause itself), the shared name, the district's name, no name. A district of the place names ("Annelinn", "Karlova",
  // "Supilinn", "Tammelinn", "Ihaste"), one the place names give to another town ("Kesklinn" is Tallinn's there), an
  // official unit of one of the two ("Raadi": Tartu vald, "Tähtvere": Tartu linn) or of neither ("Ülejõe"), a district
  // of another town ("Raeküla" is Pärnu's), the district before the town, behind a comma, or denied.
  for (const [text, shared, district] of [['Elan Tartus Annelinnas.', 'Tartu', 'Annelinn'], ['Elan Tartus Karlovas.', 'Tartu', 'Karlova'], ['Elan Tartus Kesklinnas.', 'Tartu', 'Kesklinn'], ['Elan Tartus Raadil.', 'Tartu', 'Raadi'],
    ['Elan Tartus mitte Annelinnas.', 'Tartu', 'Annelinn'], ['Elan Tartus Supilinnas.', 'Tartu', 'Supilinn'], ['Elan Tartus Tammelinnas.', 'Tartu', 'Tammelinn'], ['Elan Tartus Ihastes.', 'Tartu', 'Ihaste'],
    ['Elan Annelinnas Tartus.', 'Tartu', 'Annelinn'], ['Elan Tartus, Annelinnas.', 'Tartu', 'Annelinn'], ['Elan Tartus Tähtveres.', 'Tartu', 'Tähtvere'], ['Elan Tartus Ülejõel.', 'Tartu', 'Ülejõe'],
    ['Elan Viljandis Annelinnas.', 'Viljandi', 'Annelinn'], ['Elan Rakveres Raekülas.', 'Rakvere', 'Raeküla'], ['Olen Tartus Annelinnas.', 'Tartu', 'Annelinn'], ['Ma ei ela Tartus Annelinnas.', 'Tartu', 'Annelinn'],
    // The shared name alone: the same outcome, so the district changes nothing.
    ['Elan Tartus.', 'Tartu', 'Tartu']]) {
    for (const places of [[], [lives(text, shared)], [lives(text, district)], [lives(text, undefined)]]) assert.deepEqual(outcome(await told(text, places)), ASKS, `${text} ${places.map(item => item.name).join(' + ') || 'no place'}`);
  }
  // The plan gives the town and the district an attribution each (its instruction on districts asks for both). The
  // district's name is no municipality and cannot say which of the clause's two it means, so that attribution is left
  // unresolved, and an unresolved attribution leaves the person's municipality unresolved whatever the other one names.
  // In either order of the plan's list; until that day the part "linn" answered for the district.
  for (const [text, district] of [['Elan Tartus Annelinnas.', 'Annelinn'], ['Elan Tartus Karlovas.', 'Karlova'], ['Elan Tartus Kesklinnas.', 'Kesklinn']]) {
    for (const places of [[lives(text, 'Tartu linn'), lives(text, district)], [lives(text, district), lives(text, 'Tartu linn')]]) {
      const read = await told(text, places);
      assert.deepEqual([outcome(read), read.reasons], [ASKS, ['quote_names_several_places']], `${text} ${places.map(item => item.name).join(' + ')}`);
    }
  }
  // So does a quote of the plan that stops at the shared name ("Elan Tartus" of the clause, "Elan Tartu" of "Elan Tartu
  // vallas."): as open as the name alone, as before.
  for (const [text, quote] of [['Elan Tartus Annelinnas.', 'Elan Tartus'], ['Elan Tartu vallas.', 'Elan Tartu']]) assert.deepEqual(outcome(await told(text, [place(1, quote, 'Tartu', 'user', 'lives')])), ASKS, text);
  // Only the plan's own word decides, as it does for "Elan Tartus." with no district: a municipality it names outright.
  for (const text of ['Elan Tartus Annelinnas.', 'Elan Tartus Karlovas.', 'Elan Tartus.']) {
    for (const [name, region] of [['Tartu linn', 'tartu_linn'], ['Tartu vald', 'tartu_vald']]) {
      const read = await told(text, [lives(text, name)]);
      assert.deepEqual([read.settlements, read.places, read.user, read.source.region], [[], [['user', region, 'lives']], [region, 'reported'], region], `${text} ${name}`);
    }
  }
  // After a saved residence the sentence is a move the server cannot place: the saved Nõo vald gives way to "unresolved"
  // and the turn asks. Exactly what the committed code did with "Elan Tartus Karlovas." before ADR-127 (measured on it,
  // 10.10.2026), and what "Elan nüüd Tartus." does.
  const home = await told('Elan Nõos.', [lives('Elan Nõos.', 'Nõo vald')]);
  assert.deepEqual(home.user, ['noo_vald', 'reported']);
  for (const [moved, district] of [['Elan nüüd Tartus Annelinnas.', 'Annelinn'], ['Elan Tartus Karlovas.', 'Karlova'], ['Elan nüüd Tartus.', 'Tartu']]) {
    for (const places of [[], [lives(moved, 'Tartu', 2)], [lives(moved, district, 2)]]) {
      const read = await turn({ before: home.value, texts: ['Elan Nõos.', moved], plan: { person: 'user', places, queries: [] } });
      assert.deepEqual(outcome(read), ASKS, `${moved} ${places.map(item => item.name).join(' + ') || 'no place'}`);
    }
  }
  // Asked about, the two stay candidates and the residence is kept; so in a bare reply to the question about the
  // municipality. Before ADR-127 both were Tartu linn, by the accident.
  const asked = await turn({ before: home.value, texts: ['Elan Nõos.', 'Kas Tartus Annelinnas on päevakeskus?'], plan: { person: 'user', places: [], queries: ['päevakeskus Tartus'] } });
  assert.deepEqual([asked.settlements, asked.source.state, asked.source.candidates, asked.user], [[], 'question_regions', ['tartu_linn', 'tartu_vald'], ['noo_vald', 'reported']]);
  for (const said of ['Tartus Annelinnas', 'Tartu Kesklinnas']) {
    const reply = await turn({ texts: ['Kui palju maksab hooldekodu koht?', said], plan: { person: 'user', places: [], queries: [] }, unknowns: ASKED });
    assert.deepEqual([reply.settlements, reply.source.state, reply.source.candidates, reply.user], [[], 'reply_regions', ['tartu_linn', 'tartu_vald'], undefined], said);
  }
  // A municipality's own unshared name needs no district to say which it is, be the district its own ("Raeküla" is
  // Pärnu's) or another town's: Pärnu linn by its name, and no place admitted.
  for (const text of ['Elan Pärnus Raekülas.', 'Elan Pärnus Annelinnas.']) {
    const named = await told(text);
    assert.deepEqual([named.settlements, named.places, named.user], [[], [['user', 'parnu_linn', 'lives']], ['parnu_linn', 'reported']], text);
  }
});

test('in a turn: a district named alone is its town where the plan attributes it or it answers the question about the place', async () => {
  // The place names (lib/help/locationAliases.js) hold the districts of the town of Tartu since ADR-127. Alone, each is
  // read the way a settlement is: not by the server itself, but where the plan names it as a place or it is a bare reply
  // to the open question about the municipality; the answer says which municipality the place lies in.
  for (const [word, name] of [['Annelinnas', 'Annelinn'], ['Supilinnas', 'Supilinn'], ['Tammelinnas', 'Tammelinn'], ['Karlovas', 'Karlova'], ['Ihastes', 'Ihaste']]) {
    const text = `Elan ${word}.`, bare = await told(text), named = await told(text, [lives(text, name)]);
    assert.deepEqual([bare.settlements, bare.places, bare.user, bare.source.state], [[], [], undefined, 'region_required'], text);
    assert.deepEqual([named.settlements, named.places, named.user, named.source.region, named.source.named_place],
      [[[name, ['tartu_linn'], 'plan']], [['user', 'tartu_linn', 'lives']], ['tartu_linn', 'reported'], 'tartu_linn', { name, municipality: 'tartu_linn' }], text);
    const reply = await turn({ texts: ['Kui palju maksab hooldekodu koht?', word], plan: { person: 'user', places: [], queries: [] }, unknowns: ASKED });
    assert.deepEqual([reply.settlements, reply.source.state, reply.source.region, reply.source.named_place], [[[name, ['tartu_linn'], 'reply']], 'reply_region', 'tartu_linn', { name, municipality: 'tartu_linn' }], word);
  }
  // A question about the district, attributed by the plan, is searched in the town, the residence kept; unattributed,
  // the word is no place and the search stays with the person.
  const home = await told('Elan Nõos.', [lives('Elan Nõos.', 'Nõo vald')]), question = 'Kas Annelinnas on päevakeskus?', queries = ['päevakeskus Annelinnas'];
  const asked = await turn({ before: home.value, texts: ['Elan Nõos.', question], plan: { person: 'user', places: [place(2, question, 'Annelinn', 'user', 'other')], queries } });
  assert.deepEqual([asked.source.state, asked.source.region, asked.user], ['question_region', 'tartu_linn', ['noo_vald', 'reported']]);
  const unattributed = await turn({ before: home.value, texts: ['Elan Nõos.', question], plan: { person: 'user', places: [], queries } });
  assert.deepEqual([unattributed.settlements, unattributed.places, unattributed.source.state, unattributed.source.region], [[], [], 'person_region', 'noo_vald']);
});

// A town named beside its district, or beside the rural municipality of the same name (ADR-127, third round,
// 10.10.2026). The part "linn" of a district's name used to make a "Tartu linn" of its own beside the shared name, and
// two homes in one message are asked about; with the parts gone, two committed paths would have saved a municipality
// there. Two small rules keep the turn asking: a verb of living says "lives" only of the first place after it
// (record-scope.js, livingInClause), and a residence in a shared name that nothing resolved is not dropped because the
// same message gives another home (person-places.js, checkedTurnPlaces).
test('in a turn: a town beside its district or beside the rural municipality of the same name asks', async () => {
  // 1. "Elan Tartus ja töötan Tartu vallas." saved Tartu vald as the residence before ADR-127: "Elan" reached the place
  // of work. Now the place of work is no home, and the shared name before it is asked about.
  for (const text of ['Elan Tartus ja töötan Tartu vallas.', 'Elan Tartus Annelinnas ja töötan Tartu vallas.']) {
    const bare = await told(text);
    assert.deepEqual([bare.user, bare.source.state], [[null, 'unresolved'], 'region_required'], text);
  }
  const comma = await told('Elan Tartus Annelinnas, töötan Tartu vallas.');
  assert.deepEqual([comma.places, comma.user], [[['user', 'tartu_vald', 'other']], undefined]);
  // A home and a place of work that share no name are read as before: the home is saved.
  for (const [text, region] of [['Elan Nõos ja töötan Tartus.', 'noo_vald'], ['Elan Nõos ja töötan Tartus Annelinnas.', 'noo_vald']]) assert.deepEqual((await told(text)).user, [region, 'reported'], text);
  // 2. A place the plan quotes alone is admitted as a place (ADR-103). Beside a town's name that nothing resolved it no
  // longer decides the home: the place names give "Kesklinn" to Tallinn, and the official units know "Raadi" only in
  // Tartu vald, so "Elan Tartus Kesklinnas." would be saved as Tallinn. The price: "Elan Tartus Annelinnas." in this
  // shape asks too, although the district is the town's.
  for (const [text, quote, name, region] of [['Elan Tartus Annelinnas.', 'Annelinnas', 'Annelinn', 'tartu_linn'], ['Elan Tartus Karlovas.', 'Karlovas', 'Karlova', 'tartu_linn'],
    ['Elan Tartus Kesklinnas.', 'Kesklinn', 'Kesklinn', 'tallinn'], ['Elan Tartus Raadil.', 'Raadi', 'Raadi', 'tartu_vald']]) {
    const read = await told(text, [place(1, quote, name, 'user', 'lives')]);
    assert.deepEqual([read.settlements, read.places, read.user, read.source.state], [[[name, [region], 'plan']], [['user', region, 'lives'], ['user', null, 'unresolved']], [null, 'unresolved'], 'region_required'], text);
  }
  const denied = await told('Elan Tartus mitte Annelinnas.', [place(1, 'Annelinnas', 'Annelinn', 'user', 'lives')]);
  assert.deepEqual([denied.places, denied.user], [[['user', 'tartu_linn', 'not'], ['user', null, 'unresolved']], [null, 'unresolved']]);
  // The district quoted alone where the same message names the rural municipality as the place of work: the full name
  // hides the shared one (below), the place of work is no home, and the district's town is the residence.
  const both = await told('Elan Tartus Annelinnas ja töötan Tartu vallas.', [place(1, 'Annelinnas', 'Annelinn', 'user', 'lives')]);
  assert.deepEqual([both.places, both.user, both.source.region], [[['user', 'tartu_linn', 'lives']], ['tartu_linn', 'reported'], 'tartu_linn']);
});

// NOT a goal, and open (reported to the maintainer on 10.10.2026). A full name anywhere in a message hides the shared
// name everywhere in it (record-scope.js: "A full city/rural-municipality name wins over its ambiguous shared base
// name", which is what reads "Elan Tartus, täpsemalt Tartu vallas." rightly). So when the plan quotes the WHOLE of
// "Elan Tartus ja töötan Tartu vallas." as one home, the quote names only Tartu vald and that is saved, with or without
// a district after "Tartus"; so it was before ADR-127 for the sentence without one. A change that reads the shared name
// where it stands outside the full name's own words turns these rows on purpose.
test('in a turn (a limit, not a goal): one quote of a whole sentence that names the rural municipality in full saves it', async () => {
  for (const text of ['Elan Tartus ja töötan Tartu vallas.', 'Elan Tartus Annelinnas ja töötan Tartu vallas.']) {
    for (const name of ['Tartu', 'Tartu linn']) assert.deepEqual((await told(text, [lives(text, name)])).user, ['tartu_vald', 'reported'], `${text} ${name}`);
  }
});

test('in a turn: a hyphenated place gives no other municipality a residence, and its negated namesake is left out', async () => {
  // Before: Keila linn saved as the user's residence, read from "Keila-Joal".
  const work = await turn({ texts: ['Elan Keila-Joal, töötan Keilas.'], plan: { person: 'user', places: [], queries: [] } });
  assert.deepEqual([work.places, work.user, work.source.state], [[['user', 'keila_linn', 'other']], undefined, 'region_required']);
  // With the plan's places the settlement is read as before and after: Keila-Joa is an alevik of Lääne-Harju vald.
  const planned = await turn({ texts: ['Elan Keila-Joal, töötan Keilas.'], plan: { person: 'user',
    places: [place(1, 'Elan Keila-Joal', 'Keila-Joa', 'user', 'lives'), place(1, 'töötan Keilas', 'Keila linn', 'user', 'other')], queries: [] } });
  assert.deepEqual([planned.settlements, planned.user], [[['Keila-Joa', ['laane_harju_vald'], 'plan']], ['laane_harju_vald', 'reported']]);
  // Before: unresolved, "lives" and "not" of the same Narva linn.
  const narva = await turn({ texts: ['Elan Narva-Jõesuus, mitte Narvas.'], plan: { person: 'user', places: [], queries: [] } });
  assert.deepEqual([narva.places, narva.user], [[['user', 'narva_joesuu_linn', 'lives']], ['narva_joesuu_linn', 'reported']]);
  const parnumaa = await turn({ texts: ['Elan Põhja-Pärnumaal, mitte Pärnus.'], plan: { person: 'user', places: [], queries: [] } });
  assert.equal(parnumaa.user?.join(' '), 'pohja_parnumaa_vald reported');
});

test('in a turn: a bare reply that is a compound is no place, and a county written as one word leaves the search with the person', async () => {
  const reply = said => turn({ texts: ['Kui palju maksab hooldekodu koht?', said], plan: { person: 'user', places: [], queries: [] }, unknowns: ASKED });
  // Before: reply_region Rae vald, Kose vald, and "Tartu linn or Tartu vald". The settlement table must not read the
  // first part either ("Rae" and "Kose" are villages and an alevik of several municipalities).
  // "Harjumaal" and "Virumaal" are the fault the settlement table had by itself, live until ADR-127: no municipality
  // has the name "Harju" or "Viru", so the table was asked, the first part passed its length rule, and the reply became
  // Hiiumaa vald (its village Harju) and Rõuge vald (the village Viru).
  for (const said of ['Raekoja', 'Kosejõe', 'Tartumaal', 'Harjumaal', 'Virumaal']) {
    const read = await reply(said);
    assert.deepEqual([read.settlements, read.places, read.source.state, read.source.named_place], [[], [], 'region_required', undefined], said);
  }
  // So with the plan's attribution, the other way a settlement is admitted.
  for (const [said, name] of [['Harjumaal', 'Harjumaa'], ['Virumaal', 'Virumaal']]) {
    const read = await turn({ texts: [`Elan ${said}.`], plan: { person: 'user', places: [place(1, `Elan ${said}`, name, 'user', 'lives')], queries: [] } });
    assert.deepEqual([read.settlements, read.places, read.user], [[], [], undefined], said);
  }
  // The whole word is a place: a reply names it like any other. The district of Pärnu, by the place names.
  const village = await reply('Raekülas');
  assert.deepEqual([village.settlements, village.source.state, village.source.region, village.source.named_place],
    [[['Raeküla', ['parnu_linn'], 'reply']], 'reply_region', 'parnu_linn', { name: 'Raeküla', municipality: 'parnu_linn' }]);
  // A county written as one word ("Pärnumaal", "Järvamaal") is no municipality: the question names none, so the person's
  // own municipality stands, as it did for the counties without a namesake municipality ("Harjumaal"). Before:
  // question_region Pärnu linn. Written in two words ("Pärnu maakonnas") it still selects the namesake, see above.
  const home = await turn({ texts: ['Elan Nõos.'], plan: { person: 'user', places: [place(1, 'Elan Nõos', 'Nõo vald', 'user', 'lives')], queries: [] } });
  const county = await turn({ before: home.value, texts: ['Elan Nõos.', 'Kas Pärnumaal saab isikliku abistaja teenust?'],
    plan: { person: 'user', places: [place(2, 'Kas Pärnumaal saab isikliku abistaja teenust?', 'Pärnumaa', 'user', 'other')], queries: ['Pärnumaa isikliku abistaja teenus'] } });
  assert.deepEqual([county.places, county.settlements, county.source.state, county.source.region], [[], [], 'person_region', 'noo_vald']);
});

// ADR-127 (10.10.2026): "Muhumaal" reads as muhu + maa, so the municipality's own name is a part of it and is not found
// any more; Muhumaa is the island that Muhu vald is, and Kihnumaa the one that Kihnu vald is. Each is a name of its
// municipality itself in the directory the chat loads (lib/rag-v2/adapters/municipal-directory.js), so the whole word is
// read wherever a municipality's own name is. First they were given back as place names, which are read only where the
// plan or an open question says the word is a place: "Elan Muhumaal." alone then saved no residence, an unattributed
// question about Muhumaa stayed with the home municipality, and a lone "Muhumaal" named nothing.
test('in a turn: an island named as a land is its municipality, exactly as by the municipality\'s own name', async () => {
  const home = await told('Elan Nõos.', [lives('Elan Nõos.', 'Nõo vald')]), none = { person: 'user', places: [], queries: [] };
  const seen = read => [read.settlements, read.places, read.user, read.source, read.reasons];
  for (const [land, own, name, vald, region] of [['Muhumaal', 'Muhus', 'Muhumaa', 'Muhu vald', 'muhu_vald'], ['Kihnumaal', 'Kihnus', 'Kihnumaa', 'Kihnu vald', 'kihnu_vald']]) {
    // Every way a turn reads a municipality, by one word for it: a home with and without the plan's attribution (which
    // may name the island or the municipality), a bare reply to the question about the municipality, the word alone, a
    // denial with and without the plan and after the saved home, a question with and without the plan's attribution,
    // with the plan's queries naming the place or not, and as the first message.
    const each = async word => {
      const live = `Elan ${word}.`, not = `Ma ei ela ${word}.`, question = `Kas ${word} on koduteenus?`, saved = await told(`Elan ${own}.`);
      const asked = (places, queries) => turn({ before: home.value, texts: ['Elan Nõos.', question], plan: { person: 'user', places, queries } });
      return { home: await told(live), byIsland: await told(live, [lives(live, name)]), byName: await told(live, [lives(live, vald)]),
        reply: await turn({ texts: ['Kui palju maksab hooldekodu koht?', word], plan: none, unknowns: ASKED }), alone: await turn({ texts: [word], plan: none }),
        denied: await told(not), deniedByPlan: await told(not, [lives(not, vald)]), left: await turn({ before: saved.value, texts: [`Elan ${own}.`, not], plan: none }),
        question: await asked([], [`koduteenus ${word}`]), attributed: await asked([place(2, question, vald, 'user', 'other')], [`koduteenus ${word}`]), elsewhere: await asked([], ['koduteenuse taotlemine']),
        first: await turn({ texts: [question], plan: { person: 'user', places: [], queries: ['koduteenus'] } }) };
    };
    const byLand = await each(land), byOwn = await each(own);
    // The same in every one of them as by the municipality's own name ("Elan Muhus.").
    for (const key of Object.keys(byOwn)) assert.deepEqual(seen(byLand[key]), seen(byOwn[key]), `${land} ${key}`);
    // And what that is: the home is saved, also where the server reads it alone; no settlement is admitted for it.
    for (const key of ['home', 'byIsland', 'byName']) {
      assert.deepEqual([byLand[key].settlements, byLand[key].places, byLand[key].user, byLand[key].source.state, byLand[key].source.region, byLand[key].source.named_place],
        [[], [['user', region, 'lives']], [region, 'reported'], 'person_mentioned_region', region, undefined], `${land} ${key}`);
    }
    for (const key of ['reply', 'alone', 'first']) assert.deepEqual([byLand[key].places, byLand[key].source.state, byLand[key].source.region], [[['user', region, 'other']], 'reply_region', region], `${land} ${key}`);
    for (const key of ['denied', 'deniedByPlan', 'left']) assert.deepEqual([byLand[key].places, byLand[key].user, byLand[key].source.state], [[['user', region, 'not']], [null, 'negated'], 'region_required_after_negation'], `${land} ${key}`);
    // A question about the island is searched there, the residence kept, also where the plan attributes nothing; where
    // the plan's queries name no municipality the search stays with the person, as for any municipality (ADR-074).
    for (const key of ['question', 'attributed']) assert.deepEqual([byLand[key].source.state, byLand[key].source.region, byLand[key].user], ['question_region', region, ['noo_vald', 'reported']], `${land} ${key}`);
    assert.deepEqual([byLand.elsewhere.source.state, byLand.elsewhere.source.region], ['person_region', 'noo_vald'], land);
  }
  // The saved residence is anchored in the user's own words by the directory itself, in the turn and in the turns after
  // it. This also holds a conversation that saved Muhu vald from "Elan Muhumaal." before the change; by the register's
  // two names alone its anchor would be lost.
  const text = 'Elan Muhumaal.', saved = await told(text), context = validateStateContext({ regions: directory }), turns = [{ text }, { text: 'Kellele ma helistan?' }];
  await validateStateRegion(saved.value, context, analyzer, turns.slice(0, 1));
  const next = await turn({ before: saved.value, texts: turns.map(item => item.text), plan: { person: 'user', places: [], queries: ['koduteenuse taotlemine'] } });
  assert.deepEqual([next.settlements, next.source.state, next.source.region], [[], 'person_region', 'muhu_vald']);
  await validateStateRegion(next.value, validateStateContext(runtime.turnStateContext(context, next.query)), analyzer, turns);
  await assert.rejects(validateStateRegion(next.value, validateStateContext({ regions: registerOnly }), analyzer, turns), { code: 'dialogue_state_region_unanchored' });
  // A name of the municipality, not a place in it: the place names do not hold it, a text that names the island names
  // no settlement beside it (as for "Elan Tabasalus, Harku vallas."), and said with the municipality's other name it is
  // one municipality and one home. Someone else's home is read the same way.
  assert.deepEqual(LOCATION_ALIAS_ENTRIES.filter(alias => ['Muhumaa', 'Kihnumaa'].includes(alias.place)), []);
  for (const both of ['Elan Muhumaal, Muhu vallas.', 'Elan Muhumaal Muhu vallas.']) {
    for (const places of [[], [lives(both, 'Muhu vald')]]) {
      const read = await told(both, places);
      assert.deepEqual([read.settlements, read.user, read.source.region, read.reasons], [[], ['muhu_vald', 'reported'], 'muhu_vald', []], `${both} ${places.length ? 'attributed' : 'no place'}`);
    }
  }
  const hers = await turn({ texts: ['Ema elab Kihnumaal.'], plan: { person: 'ema', places: [place(1, 'Ema elab Kihnumaal', 'Kihnumaa', 'ema', 'lives')], queries: [] } });
  assert.deepEqual([hers.settlements, hers.places, hers.source.region], [[], [['ema', 'kihnu_vald', 'lives']], 'kihnu_vald']);
  // The plan's queries lead to the municipality by either name.
  for (const query of ['koduteenus Muhus', 'koduteenus Muhumaal']) {
    const planned = await turn({ texts: ['Kuidas koduteenust taotleda?'], plan: { person: 'user', places: [], queries: [query] } });
    assert.deepEqual([planned.source.state, planned.source.region], ['search_plan_region', 'muhu_vald'], query);
  }
});

test('an admitted settlement is a name like a municipality\'s: its compound selects nothing either', async () => {
  const widened = withSettlements(directory, [{ name: 'Jüri', kind: 'a', word: 'Jüri', read: true, regions: ['rae_vald'], turn: 1, via: 'state' },
    { name: 'Tabasalu', kind: 'a', word: 'Tabasalus', read: true, regions: ['harku_vald'], turn: 1, via: 'state' }]);
  assert.deepEqual(await mentionedRegions('Laps käib Jürikooli.', widened, analyzer), []);
  assert.deepEqual(await mentionedRegions('Elan Tabasalus.', widened, analyzer), ['harku_vald']);
});
