// TEEKOND — alguse täpsustavad küsimused: ei küsita seda, millele kirjeldus juba vastab.
//
// Kolm küsimust olid alati samad. Kahe konto läbimängus 11.10.2026 kirjutas pöörduja „Ema on 82 ja
// elab üksi Rakveres” ja Teekond küsis ikka, millises omavalitsuses abi vajatakse ja kas abi on vaja
// inimesele endale või lähedasele.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildJourneyDraft } from '../lib/journey/draft.js';
import {
  JOURNEY_EXISTING_HELP_QUESTION,
  JOURNEY_PERSON_QUESTION,
  JOURNEY_PLACE_QUESTION,
  journeyDraftQuestions,
  namesPerson,
  namesPlace
} from '../lib/journey/draftQuestions.js';

const NAMES = JSON.parse(readFileSync(new URL('../src/server/data/municipalities.rich.json', import.meta.url), 'utf8'))
  .map((entry) => entry.baseName);

test('omavalitsuste loend on olemas ja nimed on täpitähtedega', () => {
  assert.ok(NAMES.length >= 70, String(NAMES.length));
  for (const name of ['Rakvere', 'Jõhvi', 'Võru', 'Türi', 'Saaremaa', 'Lääne-Harju']) assert.ok(NAMES.includes(name), name);
});

test('nimetatud omavalitsust ei küsita uuesti, ka käändes', () => {
  for (const text of [
    'Ema on 82 ja elab üksi Rakveres.',
    'Elan Türil ja vajan abi.',
    'Isa kolis Tallinnast Sauele.',
    'Vend elab Kohtla-Järvel.',
    'Olen pärit Võrust, praegu Lääne-Harju vallas.',
    'Vanaema elab Saaremaal.',
    'Otsime abi Harjumaal.',
    'Tädi elab Lääne-Virumaal üksi.',
    'TARTU: vajan koduteenust.'.replace('TARTU', 'Tartu')
  ]) {
    assert.equal(namesPlace(text, NAMES), true, text);
  }
});

test('tavaline sõna ei ole kohanimi ja kahtluse korral küsimus jääb', () => {
  for (const text of [
    'Vajan abi pesemisel ja toidu toomisel.',
    'ema ei tapa kärbestki, aga kardab naabrit',
    'noo, ei oska öelda, kust alustada',
    'tori on katki ja vesi ei tule',
    'Ema vajab abi. Kodus on trepp.',
    'Maal on raske elada, buss ei käi.'
  ]) {
    assert.equal(namesPlace(text, NAMES), false, text);
  }
  /* Ilma loendita tuntakse ära ainult piirkond ja „… vald”. */
  assert.equal(namesPlace('Ema elab Rakveres.', []), false);
  assert.equal(namesPlace('Ema elab Vinni vallas.', []), true);
});

test('lähedast nimetav või endast rääkiv kirjeldus vastab küsimusele, kelle jaoks abi on', () => {
  for (const text of [
    'Ema on 82 ja elab üksi.',
    'Hooldan isa, kes ei saa enam trepist alla.',
    'Õde vajab abi lapse hoidmisel.',
    'Minu mees jäi pärast insulti koju.',
    'Mu naine ei saa enam üksi poes käia.',
    'Vanaemale on vaja rollaatorit.',
    'Naabrimees ei ole mitu päeva väljas käinud.',
    'Klient elab üksi ja keeldub abist.',
    'Mul on raske arveid maksta.',
    'Ma ei jaksa enam.',
    'Olen töötu ja üür on maksmata.',
    'Vajan abi avalduse kirjutamisel.'
  ]) {
    assert.equal(namesPerson(text), true, text);
  }
});

test('kui kirjeldus ei ütle, kelle jaoks abi on, jääb küsimus alles', () => {
  for (const text of [
    'Vaja on koduteenust ja abi pesemisel.',
    'Koduteenuse taotlus Rakveres.',
    'Emakeel on vene keel, tõlki on vaja.',
    'Õelus ja tülid majas.',
    'Mees kukkus trepil.',
    'Kuidas taotleda toimetulekutoetust?'
  ]) {
    assert.equal(namesPerson(text), false, text);
  }
});

test('küsimuste loend: vastatud küsimus jääb ära, kolmas on alati', () => {
  assert.deepEqual(
    journeyDraftQuestions('Ema on 82 ja elab üksi Rakveres.', { municipalityNames: NAMES }),
    [JOURNEY_EXISTING_HELP_QUESTION]
  );
  assert.deepEqual(
    journeyDraftQuestions('Ema on 82 ja elab üksi.', { municipalityNames: NAMES }),
    [JOURNEY_PLACE_QUESTION, JOURNEY_EXISTING_HELP_QUESTION]
  );
  assert.deepEqual(
    journeyDraftQuestions('Vaja on koduteenust Tartus.', { municipalityNames: NAMES }),
    [JOURNEY_PERSON_QUESTION, JOURNEY_EXISTING_HELP_QUESTION]
  );
  assert.deepEqual(
    journeyDraftQuestions('Vaja on koduteenust.', { municipalityNames: NAMES }),
    [JOURNEY_PLACE_QUESTION, JOURNEY_PERSON_QUESTION, JOURNEY_EXISTING_HELP_QUESTION]
  );
});

test('Teekonna mustand kannab samu küsimusi; ilma loendita küsitakse koht nagu varem', () => {
  const situation = 'Ema on 82 ja elab üksi Rakveres. Ta ei saa enam ise poes käia.';
  assert.deepEqual(buildJourneyDraft({ situation }, { municipalityNames: NAMES }).missingInfo, [JOURNEY_EXISTING_HELP_QUESTION]);
  assert.deepEqual(buildJourneyDraft({ situation }).missingInfo, [JOURNEY_PLACE_QUESTION, JOURNEY_EXISTING_HELP_QUESTION]);
});
