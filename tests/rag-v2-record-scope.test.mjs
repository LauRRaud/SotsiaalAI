import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { resolveRecordScope, mentionedRegions, placeOccurrences, namesPlaceByCommonWord, wordTerms } from '../lib/rag-v2/pilot/record-scope.js';
import { withSettlements } from '../lib/rag-v2/pilot/settlements.js';
import { EstnltkAnalyzer } from '../lib/rag-v2/search/estnltk.js';
import { MUNICIPALITY_DATA_PATH } from '../lib/help/municipalityData.js';
import { municipalDirectoryAdapter } from '../lib/rag-v2/adapters/municipal-directory.js';

// Real local EstNLTK (RAG_V2_ESTNLTK_PYTHON) and the canonical municipality seed.
// The sentences are fixtures; the runtime has no inflection or place-word lists.
const analyzer = new EstnltkAnalyzer();
after(() => analyzer.close());
const seed = JSON.parse(await fs.readFile(MUNICIPALITY_DATA_PATH, 'utf8')), municipalities = Array.isArray(seed) ? seed : Object.values(seed).find(Array.isArray);
// The directory as the chat loads it (the adapter's loadRegions, ADR-127, 10.10.2026): the register's two names of each
// municipality and, for the two islands that are their municipality, the island's name as a land. registerOnly: the two
// names alone, as this file built its directory until then.
const directory = await municipalDirectoryAdapter({ municipality: { findMany: async () => municipalities } }).loadRegions();
const registerOnly = municipalities.map(row => ({ region: row.slug.replaceAll('-', '_'), names: [...new Set([row.displayName, row.baseName])] }));
const scope = text => resolveRecordScope([{ turnId: 't1', text, mode: 'same' }], directory, analyzer);

test('a municipality is selected by its own canonical name, not by other readings or shared compound parts', async () => {
  for (const [text, region] of [
    ['Elan Lääne-Harju vallas', 'laane_harju_vald'], ['Elan Pärnus', 'parnu_linn'], ['Elan Narvas', 'narva_linn'],
    ['Ta elab Narva-Jõesuus', 'narva_joesuu_linn'], ['Saaremaal on raske abi saada', 'saaremaa_vald'], ['Elan Tallinnas', 'tallinn'],
    ['Kolisin Tapale', 'tapa_vald'], ['elan harkus', 'harku_vald'], ['Elan Tartu vallas', 'tartu_vald'], ['Elame Väike-Maarjas', 'vaike_maarja_vald'],
  ]) assert.equal((await scope(text)).region, region, text);
  for (const text of ['Ema elab Tartus', 'Rakveres elan']) assert.equal((await scope(text)).state, 'ambiguous_region', text);
});

test('ordinary words that share a reading or compound part with a municipality do not select it', async () => {
  for (const text of ['Tahan end tappa', 'Mulk on mu vanaisa', 'Mul on põlve valu', 'Elan üksi, raske on toimetulek'])
    assert.equal((await scope(text)).region, null, text);
  // Known limit: an identical surface form ("kanepi" = genitive of hemp and the
  // municipality name) still matches. The answer model must treat it as tentative.
  assert.equal((await scope('Kas kanepi tarvitamine on ohtlik?')).region, 'kanepi_vald');
});

test('with real morphology a negated place is left out: Tartu vald, not Tartu linn (acceptance G8)', async () => {
  for (const [text, region] of [['Elan Tartu vallas, mitte Tartu linnas.', 'tartu_vald'], ['Ema ei ela Tallinnas, vaid Harku vallas.', 'harku_vald'],
    ['Me elame Tartu linnas, mitte Tartu vallas.', 'tartu_linn']]) assert.equal((await scope(text)).region, region, text);
  assert.equal((await scope('Ma ei ela enam Tallinnas.')).state, 'region_required_after_negation');
  // ADR-044: a negated action keeps the place, and a negation stops at a sentence or comma (Codex review 28.09).
  for (const text of ['Ma ei saa Tallinnas abi.', 'Ma ei tea. Elan Tallinnas.', 'Ma ei leia Tallinnas tööd, elan seal.']) {
    assert.equal((await scope(text)).region, 'tallinn', text);
  }
  for (const text of ['Ma pole enam Tallinnas.', 'Tegelikult ei ela ma enam Tallinnas.']) {
    assert.equal((await scope(text)).state, 'region_required_after_negation', text);
  }
});

// ADR-127 (10.10.2026). The expectations are written from the term sets this morphology gave on the server that day
// (the same ones tests/rag-v2-compound-parts.test.mjs reads from its fixture, where EstNLTK is not installed).
test('ADR-127: a part of a compound word is not a municipality', async () => {
  // Before: Rae vald (four times), Järva vald, Pärnu linn, Tartu linn or vald, Rapla vald, Võru, Viljandi, Valga vald,
  // Põlva vald, Jõgeva vald, Mulgi vald, Tõrva vald (twice), Kanepi vald, Kose vald (twice), Saue vald, Tartu vald.
  for (const text of ['Elan Raekülas', 'Kolisin Raekülla', 'Abiellusime raekojas', 'Raekoja platsil on laat', 'Elan Järvamaal', 'Elan Pärnumaal', 'Ema elab Tartumaal', 'Elan Raplamaal', 'Elan Võrumaal',
    'Elan Viljandimaal', 'Elan Valgamaal', 'Elan Põlvamaal', 'Elan Jõgevamaal', 'Elan Mulgimaal', 'Kas tõrvalill on mürgine?', 'Katusel on tõrvapapp', 'Kas kanepiõli aitab?', 'Maja on Kosejõe ääres',
    'Käisin kosekülas', 'Elan Sauevallas', 'Elan Tartuvallas']) {
    assert.deepEqual([await scope(text), await mentionedRegions(text, directory, analyzer)], [{ state: 'region_required', region: null }, []], text);
  }
  // The name that is itself a compound, the name's own case forms, and the other name of a message beside a compound.
  for (const [text, region] of [['Elan Hiiumaal', 'hiiumaa_vald'], ['Elan Setomaal', 'setomaa_vald'], ['Elan Märjamaal', 'marjamaa_vald'], ['Elan Põltsamaal', 'poltsamaa_vald'],
    ['Elan Sillamäel', 'sillamae_linn'], ['Elan Mustvees', 'mustvee_vald'], ['Elan Haapsalus', 'haapsalu_linn'], ['Elan Kuusalus', 'kuusalu_vald'], ['Elan Jõelähtmel', 'joelahtme_vald'],
    ['Elan Häädemeestel', 'haademeeste_vald'], ['Elan Alutagusel', 'alutaguse_vald'], ['Elan Peipsiääres', 'peipsiaare_vald'], ['Elan Põhja-Pärnumaal', 'pohja_parnumaa_vald'], ['Elan Raes', 'rae_vald'],
    ['Elan Rae vallas', 'rae_vald'], ['Kolisin Raele', 'rae_vald'], ['Elan Tõrvas', 'torva_vald'], ['Elan Kosel', 'kose_vald'], ['Elan Kanepis', 'kanepi_vald'], ['Elan Järvas', 'jarva_vald'],
    ['Elan Raekülas, Pärnus', 'parnu_linn'], ['Elan Järvamaal, Türi vallas', 'turi_vald'],
    // One test for a name word (ADR-020 with ADR-127): a hyphenated place holds no other municipality, and its negated
    // namesake is left out (before: open between the two).
    ['Elan Narva-Jõesuus, mitte Narvas', 'narva_joesuu_linn'], ['Elan Põhja-Pärnumaal, mitte Pärnus', 'pohja_parnumaa_vald'],
    // Not changed: a county written in two words still selects its namesake municipality.
    ['Elan Järva maakonnas', 'jarva_vald'],
    // A district's "linn" no longer turns a rural municipality named beside it into a choice between it and the town.
    ['Elan Tartu vallas, töötan Kesklinnas', 'tartu_vald']]) assert.equal((await scope(text)).region, region, text);
  // The kind word inside a compound completes no name: as open as "Tartus" alone (before: Tartu linn). In a turn it stays
  // so and the answer asks which of the two (tests/rag-v2-compound-parts.test.mjs has the turns and why nothing chooses).
  for (const text of ['Elan Tartus', 'Elan Tartus Annelinnas', 'Elan Tartus, laps käib Annelinnas koolis']) {
    assert.deepEqual([(await scope(text)).candidates, await mentionedRegions(text, directory, analyzer)], [['tartu_linn', 'tartu_vald'], ['tartu_linn', 'tartu_vald']], text);
  }
  for (const text of ['Ma ei ela Raes, elan Raekülas', 'Elan Raekülas, mitte Rae vallas']) assert.equal((await scope(text)).state, 'region_required_after_negation', text);
  // A negated compound is no negated mention, and a name written together with its kind is no name, negated or not.
  for (const text of ['Ma ei ela enam Raekülas', 'Elan Koselinnas', 'Ma ei ela Sauevallas']) assert.deepEqual(await scope(text), { state: 'region_required', region: null }, text);
  assert.deepEqual((await placeOccurrences('Ma ei ela Raekülas, elan Raes', directory, analyzer)).map(item => [item.region, item.negated]), [['rae_vald', false]]);
  assert.deepEqual((await placeOccurrences('Ma ei ela Raes, elan Raekülas', directory, analyzer)).map(item => [item.region, item.negated]), [['rae_vald', true]]);
  // Before: a second Keila linn, read as the residence, in "Keila-Joal" (an alevik of Lääne-Harju vald).
  assert.deepEqual((await placeOccurrences('Elan Keila-Joal, töötan Keilas', directory, analyzer)).map(item => [item.region, item.residence]), [['keila_linn', false]]);
  // A word's own readings: the parts of a compound go, also where two compound readings share them; a hyphen joins words,
  // not parts; a word that is no compound keeps every reading.
  for (const [word, own] of [['Raekülas', ['raeküla', 'raekülas']], ['Raekülla', ['raeküla', 'raeküll', 'raekülla']], ['Mustamäel', ['mustamäe', 'mustamäel', 'mustamägi']],
    ['Narva-Jõesuus', ['jõesuu', 'jõesuus', 'narva', 'narva-jõesuu', 'narva-jõesuus']], ['Tartu-Tallinna', ['tallinn', 'tartu', 'tartu-tallinn', 'tartu-tallinna']], ['Tõrvas', ['tõrv', 'tõrva', 'tõrvama', 'tõrvas']],
    ['Annelinnas', ['annelinn', 'annelinnas']], ['Rae', ['raad', 'rae']]]) {
    assert.deepEqual((await wordTerms(word, analyzer))[0].terms.sort(), own, word);
  }
  // An admitted settlement is a name like a municipality's: its compound selects nothing either, and its own form does.
  const widened = withSettlements(directory, [{ name: 'Jüri', kind: 'a', word: 'Jüri', read: true, regions: ['rae_vald'], turn: 1, via: 'state' },
    { name: 'Tabasalu', kind: 'a', word: 'Tabasalus', read: true, regions: ['harku_vald'], turn: 1, via: 'state' }]);
  assert.deepEqual([await mentionedRegions('Laps käib Jürikooli', widened, analyzer), await mentionedRegions('Elan Tabasalus', widened, analyzer)], [[], ['harku_vald']]);
  // The common word for a municipality is read on all of a word's terms, as before.
  for (const [text, expected] of [['Kas see teenus on ka minu vallas olemas?', true], ['Elan Kesklinnas', true], ['Elan Sauevallas', true], ['Mida vallavalitsus ütleb?', false], ['Küsisin linnavalitsusest', false],
    ['Elan Raekülas', false]]) assert.equal(await namesPlaceByCommonWord(text, analyzer), expected, text);
});

// The second recording of 10.10.2026: the words the first one lacked. The expectations are written from the readings the
// server's morphology gave each that day (tests/rag-v2-compound-parts.test.mjs reads the same sets from its fixture, where
// EstNLTK is not installed). Only the rows a rule rests on.
test('ADR-127: the island named as a land, settlements and everyday compounds that begin with a name, forms the sweep did not make, and the common word', async () => {
  const own = async word => (await wordTerms(word, analyzer))[0].terms.sort(), named = text => mentionedRegions(text, directory, analyzer);
  // "Muhumaal" is muhu + maa and "Kihnumaal" kihnu + maa (recorded: maa, muhu, muhumaa, muhumaal; kihnu, kihnumaa,
  // kihnumaal, maa): by the register's two names they name none now (before: Muhu vald, Kihnu vald, through the part).
  assert.deepEqual([await own('Muhumaal'), await own('Kihnumaal')], [['muhumaa', 'muhumaal'], ['kihnumaa', 'kihnumaal']]);
  for (const word of ['Muhumaal', 'Kihnumaal']) assert.deepEqual(await mentionedRegions(word, registerOnly, analyzer), [], word);
  // The directory the chat loads gives both back as names of the municipality itself ("Muhumaa", "Kihnumaa":
  // lib/rag-v2/adapters/municipal-directory.js): the whole word is the name, read exactly as the municipality's own name
  // is, as a home, in a denial and in a question (the turns are in tests/rag-v2-compound-parts.test.mjs).
  const read = async text => (await placeOccurrences(text, directory, analyzer)).map(item => [item.region, item.negated, item.residence, item.asking]);
  for (const [land, name, region] of [['Muhumaal', 'Muhus', 'muhu_vald'], ['Kihnumaal', 'Kihnus', 'kihnu_vald']]) {
    for (const word of [land, name]) {
      assert.deepEqual([(await scope(`Elan ${word}`)).region, await named(`Elan ${word}`), await named(word)], [region, [region], [region]], word);
      assert.deepEqual([await read(`Elan ${word}.`), await read(`Ma ei ela ${word}.`), await read(`Kas ${word} on koduteenus?`)],
        [[[region, false, true, false]], [[region, true, false, false]], [[region, false, false, true]]], word);
      assert.equal((await scope(`Ma ei ela ${word}`)).state, 'region_required_after_negation', word);
    }
  }
  // Settlements that begin with a municipality's name (before: Järva vald, Türi vald, Võru linn or vald), and everyday
  // compounds (before: Tapa vald, Võru linn or vald, Mulgi vald).
  for (const word of ['Järvakandis', 'Türisalus', 'Võrumõisas', 'tapamaja', 'võrukael', 'mulgikapsad']) assert.deepEqual(await named(word), [], word);
  // A name's own forms are read, also the ones the sweep of the 705 did not make (the terminative, essive, translative
  // and abessive) and the word with "-ki".
  assert.deepEqual(await named('Tallinnas'), ['tallinn']);
  for (const form of ['Tartuni', 'Tartuna', 'Tartuks', 'Tartuta', 'Tartuski']) assert.deepEqual(await named(form), ['tartu_linn', 'tartu_vald'], form);
  // The common word (ADR-084): the head of a compound says a place, in lowercase too; "koduvald" by its lemma and its
  // head alike. The cost that stays: any compound that ends in "linn" does. A field of work does not: "valdkond" is one
  // root (and a part of "sotsiaalvaldkond" as a whole), and the first part of "vallavalitsus" comes as a stem.
  assert.deepEqual([await own('valdkonnas'), await own('sotsiaalvaldkonnas')], [['valdkond', 'valdkonnas'], ['sotsiaalvaldkond', 'sotsiaalvaldkonnas']]);
  for (const [text, expected] of [['Kas naabervallas on see teenus?', true], ['Kas lähivallas on see teenus?', true], ['Elan kesklinnas', true], ['Kas minu koduvallas on see teenus?', true], ['Elan vanalinnas', true],
    ['Elan pealinnas', true], ['Elan Annelinnas', true], ['Kes selles valdkonnas aitab?', false], ['Kes sotsiaalvaldkonnas aitab?', false], ['Küsisin vallavalitsuses', false], ['Elan Muhumaal', false]]) {
    assert.equal(await namesPlaceByCommonWord(text, analyzer), expected, text);
  }
});
