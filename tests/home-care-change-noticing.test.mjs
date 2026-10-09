import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { CARE_CHANGE_AREAS, CARE_CHANGE_OUTCOMES } from '../lib/homeCare/constants.js';
import { entryRequestHash, normalizeChangeAnswer, normalizeEntryInput } from '../lib/homeCare/validation.js';
import { normalizeUsualState } from '../lib/homeCare/changes.js';

const NOW = new Date('2026-10-09T08:00:00Z');
const refused = (fn, key) => assert.throws(fn, (error) => error.status === 400 && error.messageKey === key, key);

test('vastus küsimusele „kas midagi oli teisiti?": kuju, valdkondade järjekord ja nõuded', () => {
  assert.deepEqual(normalizeChangeAnswer({ answer: 'NO', areas: ['MOOD'], major: true }), { answer: 'NO', areas: [], major: false });
  /* Valdkonnad kindlas järjekorras ja ilma kordusteta; „suur muutus" ainult tõeväärtusena. */
  assert.deepEqual(normalizeChangeAnswer({ answer: 'YES', areas: ['MOOD', 'MOBILITY', 'MOOD'], major: 'jah' }), { answer: 'YES', areas: ['MOBILITY', 'MOOD'], major: false });
  assert.equal(normalizeChangeAnswer({ answer: 'YES', areas: ['HOME'], major: true }).major, true);
  refused(() => normalizeChangeAnswer({ answer: 'YES', areas: [] }), 'home_care.errors.change_area_required');
  refused(() => normalizeChangeAnswer({ answer: 'YES', areas: ['MUU'] }), 'home_care.errors.change_area_invalid');
  refused(() => normalizeChangeAnswer({ answer: 'VIST' }), 'home_care.errors.change_answer_invalid');
  refused(() => normalizeChangeAnswer('YES'), 'home_care.errors.change_answer_invalid');
});

test('käigu kirje: vastus „jah" nõuab lauset, „ei" mitte; ainult käigul ja ainult uuel kirjel', () => {
  const visit = { kind: 'NOTE', contactMode: 'VISIT', activities: [{ activityId: 'act_123456', mode: 'TOGETHER' }] };
  /* Märgitud toimingutega käik ei vaja teksti; vastus „ei" seda ei muuda. */
  assert.equal(normalizeEntryInput({ ...visit, change: { answer: 'NO' } }, { now: NOW }).text, '');
  assert.deepEqual(normalizeEntryInput({ ...visit, change: { answer: 'NO' } }, { now: NOW }).change, { answer: 'NO', areas: [], major: false });
  refused(() => normalizeEntryInput({ ...visit, change: { answer: 'YES', areas: ['MOOD'] } }, { now: NOW }), 'home_care.errors.change_text_required');
  const yes = normalizeEntryInput({ ...visit, text: 'Ei tahtnud rääkida', change: { answer: 'YES', areas: ['MOOD'], major: true } }, { now: NOW });
  assert.deepEqual(yes.change, { answer: 'YES', areas: ['MOOD'], major: true });
  /* Telefonikontaktil vastust ei ole; paranduses jääb see puutumata (ei loeta sisendist). */
  assert.equal(normalizeEntryInput({ kind: 'NOTE', contactMode: 'PHONE', text: 'Helistas', change: { answer: 'YES', areas: ['MOOD'] } }, { now: NOW }).change, null);
  const base = { kind: 'NOTE', contactMode: 'VISIT', occurredAt: NOW, activities: [] };
  assert.equal(normalizeEntryInput({ text: 'Parandus', change: { answer: 'YES', areas: ['MOOD'] } }, { now: NOW, base }).change, null);
});

test('kordussaatmise räsi: vastuseta kirje räsi ei muutu, vastus muudab räsi', () => {
  const body = { kind: 'NOTE', contactMode: 'VISIT', text: 'Kõik nagu ikka', occurredAt: '2026-10-09T07:00:00Z' };
  const plain = entryRequestHash('client_1', normalizeEntryInput(body, { now: NOW }));
  /* Sama keha nagu enne selle välja tulekut: seadme järjekorras ootav vanem kirje ei tohi konfliktiks muutuda. */
  const before = normalizeEntryInput(body, { now: NOW });
  delete before.change;
  assert.equal(entryRequestHash('client_1', before), plain);
  const no = entryRequestHash('client_1', normalizeEntryInput({ ...body, change: { answer: 'NO' } }, { now: NOW }));
  const yes = entryRequestHash('client_1', normalizeEntryInput({ ...body, change: { answer: 'YES', areas: ['MOOD'] } }, { now: NOW }));
  const major = entryRequestHash('client_1', normalizeEntryInput({ ...body, change: { answer: 'YES', areas: ['MOOD'], major: true } }, { now: NOW }));
  assert.equal(new Set([plain, no, yes, major]).size, 4);
  /* Valdkondade järjekord sisendis räsi ei muuda. */
  const ab = entryRequestHash('client_1', normalizeEntryInput({ ...body, change: { answer: 'YES', areas: ['MOOD', 'HOME'] } }, { now: NOW }));
  const ba = entryRequestHash('client_1', normalizeEntryInput({ ...body, change: { answer: 'YES', areas: ['HOME', 'MOOD'] } }, { now: NOW }));
  assert.equal(ab, ba);
});

test('tavaline seis: sisendi kuju', () => {
  assert.deepEqual(normalizeUsualState({ areas: { MOBILITY: '  Liigub   rulaatoriga ', MOOD: '' } }), { MOBILITY: 'Liigub rulaatoriga', MOOD: '' });
  assert.deepEqual(normalizeUsualState({}), {});
  refused(() => normalizeUsualState({ areas: { MUU: 'x' } }), 'home_care.errors.change_area_invalid');
  refused(() => normalizeUsualState({ areas: { HOME: 'x'.repeat(301) } }), 'home_care.errors.text_too_long');
});

test('valdkonnad, vastused ja teavitus on kolmes keeles; migratsiooni loendid klapivad koodiga', () => {
  for (const locale of ['et', 'en', 'ru']) {
    const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
    for (const area of CARE_CHANGE_AREAS) {
      assert.ok(messages.home_care.change.areas[area], `${locale} ${area}`);
      assert.ok(messages.home_care.usual.examples[area], `${locale} näide ${area}`);
    }
    for (const outcome of CARE_CHANGE_OUTCOMES) assert.ok(messages.home_care.change.outcomes[outcome], `${locale} ${outcome}`);
    assert.ok(messages.notifications.events.home_care_change_noticed, locale);
  }
  const sql = readFileSync(new URL('../prisma/migrations/20261011090000_home_care_change_noticing/migration.sql', import.meta.url), 'utf8');
  for (const value of [...CARE_CHANGE_AREAS, ...CARE_CHANGE_OUTCOMES, 'TWO_WORKERS', 'MAJOR']) assert.ok(sql.includes(`'${value}'`), value);
  assert.match(sql, /^SET lock_timeout = '5s';\r?\nSET statement_timeout = '30s';/m);
});
