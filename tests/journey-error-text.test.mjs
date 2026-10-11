// TEEKOND — veateade inimesele, mitte veavõti.
//
// Teekonna API vastab võtmega (`journeys.errors.conflict`). Tõlkeid ei olnud ja
// lehed näitasid võtit toorelt. See test hoiab kaks asja paigas: iga võti, mida
// lähtekood kasutab, on kolmes keeles lauseks tõlgitud, ja abifunktsioon ei lase
// ekraanile ei toorest võtit ega tundmatut serveri teksti.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { journeyErrorText } from '../lib/journey/errorText.js';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

function sourceFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.(js|jsx)$/.test(name)) out.push(path);
  }
  return out;
}

test('iga Teekonna veavõti on kolmes keeles lause ja toores võti ekraanile ei jõua', () => {
  /* Kõik kohad, kust Teekonna veavõti võib inimeseni jõuda. */
  const files = [
    ...sourceFiles(join(root, 'lib', 'journey')),
    ...sourceFiles(join(root, 'app', 'api', 'journeys')),
    ...sourceFiles(join(root, 'components', 'journey')),
    join(root, 'lib', 'preInquiries.js'),
    join(root, 'lib', 'preInquiryApiBoundary.js')
  ];
  const used = new Set();
  for (const file of files) {
    for (const match of readFileSync(file, 'utf8').matchAll(/journeys\.errors\.([a-z0-9_]+)/g)) used.add(match[1]);
  }
  assert.ok(used.size >= 20, `leitud ainult ${used.size} võtit: otsing on katki`);
  assert.ok(used.has('conflict') && used.has('field_too_long') && used.has('not_found'));

  const catalogs = Object.fromEntries(
    ['et', 'en', 'ru'].map((locale) => [locale, JSON.parse(readFileSync(join(root, 'messages', `${locale}.json`), 'utf8'))])
  );
  for (const [locale, messages] of Object.entries(catalogs)) {
    const errors = messages.journeys?.errors || {};
    for (const key of used) {
      const text = errors[key];
      assert.ok(typeof text === 'string' && text.trim().length > 5, `${locale}: journeys.errors.${key} on tõlkimata`);
      assert.equal(text.includes('journeys.errors'), false, `${locale}: ${key}`);
    }
  }

  /* Abifunktsioon lehe tõlkijaga, mis käitub nagu päris: puuduv võti annab varuteksti. */
  const et = catalogs.et;
  const t = (key, fallback) => key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), et) ?? fallback ?? key;
  const fallback = 'Teekonna salvestamine ei õnnestunud.';
  assert.equal(journeyErrorText(t, 'journeys.errors.conflict', fallback), et.journeys.errors.conflict);
  assert.equal(journeyErrorText(t, ' journeys.errors.archived ', fallback), et.journeys.errors.archived);
  /* Tundmatu võti, tühi väärtus ja võõras tekst annavad lehe enda teate. */
  assert.equal(journeyErrorText(t, 'journeys.errors.midagi_uut', fallback), fallback);
  assert.equal(journeyErrorText(t, '', fallback), fallback);
  assert.equal(journeyErrorText(t, undefined, fallback), fallback);
  assert.equal(journeyErrorText(t, 'PrismaClientKnownRequestError: relation "Journey" does not exist', fallback), fallback);
  assert.equal(journeyErrorText(t, 'home_care.errors.client_not_found', fallback), fallback);
  /* Tõlkija, mis tagastab puuduva võtme enda, ei lase võtit läbi. */
  assert.equal(journeyErrorText((key) => key, 'journeys.errors.conflict', fallback), fallback);
});
