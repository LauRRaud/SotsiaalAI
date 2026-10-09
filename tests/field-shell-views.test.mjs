// Välitöö avaleht ja ühenduse seis.
//
// Ühenduse seis oli paneeli sisu kohal kleepuv riba, mis kerides jäi vormi peale
// (kujundusaudit K04). Nüüd on see märk kiirmenüüs ja vajadusel teade sisu
// alguses; seisu reegel on puhas funktsioon ja siin kontrollitud.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fieldConnectionState } from '../components/field/connectionState.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const catalog = (lang) => JSON.parse(read(`../messages/${lang}.json`));
const at = (node, key) => key.split('.').reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), node);

test('ühenduse seis: võrguta on ülimuslik, siis vead, siis saatmata, siis korras', () => {
  assert.deepEqual(fieldConnectionState({ online: true }), { key: 'online', pending: 0, failed: 0, needsLogin: false, attention: false });
  assert.equal(fieldConnectionState({ online: true, pendingCount: 3 }).key, 'pending');
  assert.equal(fieldConnectionState({ online: true, pendingCount: 3, failedCount: 1 }).key, 'failed');
  assert.equal(fieldConnectionState({ online: false, pendingCount: 3, failedCount: 1 }).key, 'offline');
  assert.equal(fieldConnectionState().key, 'offline');
});

test('teade sisu alguses on ainult siis, kui inimene peab midagi teadma', () => {
  assert.equal(fieldConnectionState({ online: true }).attention, false);
  assert.equal(fieldConnectionState({ online: true, pendingCount: 1 }).attention, true);
  assert.equal(fieldConnectionState({ online: false }).attention, true);
  assert.equal(fieldConnectionState({ online: true, needsLogin: true }).attention, true);
  /* Vigased arvud ei tee seisu: negatiivne ja mittearv loetakse nulliks. */
  assert.equal(fieldConnectionState({ online: true, pendingCount: -2, failedCount: 'x' }).key, 'online');
});

test('avalehe ja ühenduse seisu tekstid on kataloogis kolmes keeles', () => {
  const keys = new Set();
  for (const source of ['../components/field/FieldShell.jsx', '../components/field/FieldConnection.jsx']) {
    for (const match of read(source).matchAll(/\bt\(\s*"(field\.[A-Za-z_.0-9]+)"/g)) keys.add(match[1]);
  }
  assert.ok(keys.size > 20, `võtmeid leiti ${keys.size}`);
  for (const lang of ['et', 'en', 'ru']) {
    const messages = catalog(lang);
    assert.deepEqual([...keys].filter((key) => typeof at(messages, key) !== 'string'), [], lang);
    for (const status of ['DRAFT', 'PLANNED', 'IN_PROGRESS', 'WRAP_UP', 'CLOSED', 'CANCELLED']) {
      assert.equal(typeof messages.field.status[status], 'string', `${lang}: ${status}`);
    }
    for (const key of ['pending', 'failed']) assert.ok(messages.field.sync.short[key].includes('{count}'), `${lang}: ${key}`);
  }
});

test('ühenduse seis ei kleepu sisu peale ja paneelil ei ole lehe pealkirja', () => {
  const css = read('../app/styles/field.css');
  assert.ok(!css.includes('fld-connection'), 'vana kleepuv riba on stiilidest eemaldatud');
  for (const file of ['../components/field/fieldConnection.module.css', '../components/field/fieldShell.module.css']) {
    assert.ok(!/position:\s*(sticky|fixed)/.test(read(file)), `${file}: midagi ei kleepu sisu kohale`);
  }
  for (const file of ['../components/field/FieldShell.jsx', '../components/field/FieldVisitRoom.jsx']) {
    const source = read(file);
    assert.ok(source.includes('<FieldConnection'), `${file} kasutab ühist ühenduse seisu`);
    assert.ok(!source.includes('fld-connection'), `${file}: vana riba ei ole`);
  }
  const shell = read('../components/field/FieldShell.jsx');
  assert.ok(shell.includes('<h1 className="sr-only">'), 'lehe pealkiri on ainult ekraanilugejale');
  assert.ok(!shell.includes('fullWidth'), 'nuppe ei venitata paneeli laiuseks');
  assert.ok(!shell.includes('role="status"'), 'teated ei kasuta status-rolli');
  /* Lehe raam annab juba <main>-i; teine selle sees on vigane märgistus. */
  assert.ok(!/<main[\s>]/.test(shell), 'avaleht ei tee teist main-elementi');
});

test('telefonis on põhitegevus pöidla ulatuses ja puuteala vähemalt 48 px', () => {
  const css = read('../components/field/fieldShell.module.css');
  /* Leht täidab paneeli kõrguse; StepPanel paneb tegevusrea selle alla serva. */
  assert.match(css, /\.page\s*\{[^}]*min-height:\s*100%/);
  assert.match(css, /\.view > :last-child\s*\{[^}]*flex:\s*1 1 auto/);
  /* Rida ja puuteekraani nupud ning väljad: 3rem = 48 px. */
  assert.match(css, /\.row\s*\{[^}]*min-height:\s*3rem/);
  assert.match(css, /\(pointer:\s*coarse\)\s*\{[^}]*\.page button,\s*\.page input\s*\{[^}]*min-height:\s*3rem/);
});
