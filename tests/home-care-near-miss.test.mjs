import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { CARE_INCIDENT_TYPES, CARE_NEAR_MISS_KINDS } from '../lib/homeCare/constants.js';
import { composeNearMissText } from '../lib/homeCare/nearMissText.js';
import { normalizeEntryInput } from '../lib/homeCare/validation.js';

const et = JSON.parse(readFileSync(new URL('../messages/et.json', import.meta.url), 'utf8'));
const translate = (key, values = {}) => {
  const text = key.split('.').reduce((node, part) => (node ? node[part] : undefined), et);
  assert.equal(typeof text, 'string', key);
  return text.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
};

test('„peaaegu juhtus" kirje tekst: valik ja soovi korral üks rida', () => {
  assert.equal(composeNearMissText(translate, 'SLIP', ''), 'Peaaegu juhtus: libisesin või komistasin.');
  assert.equal(composeNearMissText(translate, 'ANIMAL', '  Koer oli  lahti õues. '), 'Peaaegu juhtus: loom ründas või hirmutas. Koer oli lahti õues.');
  assert.equal(composeNearMissText(translate, 'OTHER', null), 'Peaaegu juhtus: muu.');
});

test('liik on erijuhtumite loendis ja kirje võtab selle vastu; tekstid on kolmes keeles', () => {
  assert.ok(CARE_INCIDENT_TYPES.includes('NEAR_MISS'));
  const data = normalizeEntryInput({ kind: 'INCIDENT', incidentType: 'NEAR_MISS', text: 'Peaaegu juhtus: muu.' }, { now: new Date('2026-10-09T08:00:00Z') });
  assert.deepEqual([data.kind, data.incidentType], ['INCIDENT', 'NEAR_MISS']);
  for (const locale of ['et', 'en', 'ru']) {
    const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
    assert.ok(messages.home_care.incident.types.NEAR_MISS, locale);
    for (const kind of CARE_NEAR_MISS_KINDS) assert.ok(messages.home_care.near_miss.kinds[kind], `${locale} ${kind}`);
    for (const key of ['text', 'text_with_note']) assert.ok(messages.home_care.near_miss[key].includes('{what}'), `${locale} ${key}`);
  }
});
