// Koduteenuse info kiirmenüüs.
//
// Koduteenuse lehtedel ei olnud infot üldse: ei nurgas ega kiirmenüüs. Omaniku
// reegel (10.10, 11.10): info on all kiirmenüüs lehe nime kõrval. Kest
// (components/org/OrgPart.jsx) registreerib osa `home_care` info ühest kohast ja
// sisu tuleb failist lib/dashboardInfoContent.js. Test hoiab, et info oleks
// kolmes keeles päris lausetega olemas (puuduv võti paistaks lehel toore võtmena)
// ja et ükski koduteenuse vaade ei registreeriks teist infot selle peale.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getDashboardInfoContent } from '../lib/dashboardInfoContent.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const LANGS = ['et', 'en', 'ru'];
const catalogs = Object.fromEntries(LANGS.map((lang) => [lang, JSON.parse(read(`messages/${lang}.json`))]));
const at = (node, key) => key.split('.').reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), node);
/* Platvormi `t` annab puuduva sõna kohta võtme enda: nii paistab puuduv tõlge testis välja. */
const tFor = (lang) => (key) => {
  const value = at(catalogs[lang], key);
  return typeof value === 'string' ? value : key;
};
const texts = (content) => [content.title, ...content.details.flatMap((section) => [section.title, section.body, ...(section.items || [])])].filter(Boolean);

test('koduteenuse info on kolmes keeles olemas ja ükski rida ei ole toores võti', () => {
  for (const lang of LANGS) {
    const content = getDashboardInfoContent(tFor(lang), 'home_care');
    assert.ok(content, `${lang}: info`);
    assert.equal(content.title, catalogs[lang].home_care.info.title, `${lang}: pealkiri`);
    assert.equal(content.details.length, 4, `${lang}: osi`);
    for (const section of content.details) {
      assert.ok(section.title, `${lang}: osa pealkiri`);
      assert.ok(section.body || (section.items || []).length > 0, `${lang}: ${section.title} on tühi`);
    }
    for (const text of texts(content)) {
      assert.ok(!text.startsWith('home_care.'), `${lang}: toores võti ${text}`);
    }
  }
});

test('infofaili eestikeelne varutekst on sama mis kataloogis', () => {
  /* `t`, mis sõnu ei tunne, annab tagasi varuteksti: see peab olema kataloogi lause, mitte vana koopia. */
  const fallback = getDashboardInfoContent((...args) => args[1], 'home_care');
  const live = getDashboardInfoContent(tFor('et'), 'home_care');
  assert.deepEqual(texts(fallback), texts(live));
});

test('inglise ja vene tekst on tõlgitud, mitte eesti koopia', () => {
  const et = catalogs.et.home_care.info;
  for (const lang of ['en', 'ru']) {
    const own = catalogs[lang].home_care.info;
    assert.deepEqual(Object.keys(own).sort(), Object.keys(et).sort(), `${lang}: võtmed`);
    for (const key of Object.keys(et)) assert.notEqual(own[key], et[key], `${lang}: ${key}`);
  }
});

test('eesti tekst on lihtne: mõttekriipsu ega sirgeid jutumärke ei ole', () => {
  for (const [key, text] of Object.entries(catalogs.et.home_care.info)) {
    assert.ok(!/[—–"]/.test(text), key);
  }
});

test('kest registreerib koduteenuse info ja vaated ise teist ei registreeri', () => {
  const shell = read('components/org/OrgPart.jsx');
  assert.match(shell, /const PART_INFO = Object\.freeze\(\{ home_care: "home_care" \}\);/);
  assert.match(shell, /usePanelInfoSlot\(\{ infoId: PART_INFO\[part\] \|\| "" \}\);/);
  for (const name of fs.readdirSync(path.join(root, 'components/homeCare'))) {
    if (!name.endsWith('.jsx')) continue;
    assert.ok(!read(`components/homeCare/${name}`).includes('usePanelInfoSlot'), `${name}: info tuleb kestast`);
  }
});
