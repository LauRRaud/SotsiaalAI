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
