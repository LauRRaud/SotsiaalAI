// KODUTEENUS kiht 2, K2-d — käigu kirje: kestus ja tehtud toimingud päeviku kirjel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CARE_ACTIVITY_GROUPS, CARE_PLAN_MODES, HOME_CARE_LIMITS } from '../lib/homeCare/constants.js';
import { entryDocumentText } from '../lib/homeCare/chronology.js';
import { isDraftWorthKeeping } from '../lib/homeCare/outbox.js';
import { entryRequestHash, normalizeEntryInput } from '../lib/homeCare/validation.js';

const sql = readFileSync(new URL('../prisma/migrations/20261010090000_home_care_visit_record/migration.sql', import.meta.url), 'utf8');
const list = (text) => [...text.matchAll(/'([A-Z_]+)'/g)].map((match) => match[1]);
const NOW = new Date('2026-10-09T08:00:00Z');
const A = 'cmv0aaaaaaaaaaaaaaaaaaaa1';
const B = 'cmv0aaaaaaaaaaaaaaaaaaaa2';
const normalize = (input, base = null) => normalizeEntryInput(input, { now: NOW, base });
const failsWith = (input, key, base = null) =>
  assert.throws(
    () => normalize(input, base),
    (error) => error.status === 400 && error.messageKey === key,
    key
  );

test('käigu kirje: andmebaasi CHECK-id ja koodi sõnastikud on samad', () => {
  assert.deepEqual(list(/"CareEntryActivity_mode_check" CHECK \("mode" IN \(([^)]*)\)\)/.exec(sql)[1]), [...CARE_PLAN_MODES]);
  assert.deepEqual(list(/"CareEntryActivity_activityGroup_check" CHECK \("activityGroup" IN \(([\s\S]*?)\)\);/.exec(sql)[1]), [...CARE_ACTIVITY_GROUPS]);
  assert.match(sql, new RegExp(`"visitMinutes" IS NULL OR "visitMinutes" BETWEEN 1 AND ${HOME_CARE_LIMITS.VISIT_MINUTES_MAX}\\)`));
  /* Olemasoleva tabeli kontroll lisatakse NOT VALID-ina; üks toiming kirjel üks kord. */
  assert.match(sql, /"CareClientEntry_visitMinutes_check"[\s\S]*?NOT VALID;/);
  assert.match(sql, /CREATE UNIQUE INDEX "CareEntryActivity_entryId_activityId_key" ON "CareEntryActivity"\("entryId", "activityId"\) WHERE "activityId" IS NOT NULL;/);
});

test('käigu kirje sisend: kestus ja toimingud ainult käigul; märgitud toimingutega käik ei vaja teksti', () => {
  /* Tavaline kirje: käigu väljad on tühjad ja tekst on kohustuslik nagu enne. */
  const plain = normalize({ text: 'Kõik korras.' });
  assert.deepEqual([plain.visitMinutes, plain.visitActivities, plain.text], [null, [], 'Kõik korras.']);
  failsWith({}, 'home_care.errors.entry_text_required');
  failsWith({ visitMinutes: 30 }, 'home_care.errors.entry_text_required');

  /* Märgitud toimingutega käik: tekst võib puududa ja salvestub tühjana. */
  const visit = normalize({ visitMinutes: '45', activities: [{ activityId: A, mode: 'FOR' }, { activityId: B, mode: 'TOGETHER' }] });
  assert.deepEqual([visit.visitMinutes, visit.text, visit.contactMode], [45, '', 'VISIT']);
  /* Tulemus puudub = tehtud (nii saatis kirjeid varasem vorm ja seadme järjekord). */
  assert.deepEqual(visit.visitActivities, [
    { activityId: A, mode: 'FOR', outcome: 'DONE' },
    { activityId: B, mode: 'TOGETHER', outcome: 'DONE' }
  ]);
  /* Teade järgmisele, kokkulepe, mure ja erijuhtum on tekst ka siis, kui toimingud on märgitud. */
  for (const kind of ['HANDOVER', 'AGREEMENT', 'CONCERN']) {
    failsWith({ kind, activities: [{ activityId: A, mode: 'FOR' }] }, 'home_care.errors.entry_text_required');
  }

  /* Telefonikontaktil käigu välju ei ole: need jäetakse kõrvale ja tekst on kohustuslik. */
  const phone = normalize({ contactMode: 'PHONE', text: 'Helistas tütar.', visitMinutes: 30, activities: [{ activityId: A, mode: 'FOR' }] });
  assert.deepEqual([phone.visitMinutes, phone.visitActivities], [null, []]);
  failsWith({ contactMode: 'PHONE', activities: [{ activityId: A, mode: 'FOR' }] }, 'home_care.errors.entry_text_required');

  /* Vigane kestus ja vigased toimingud. */
  for (const value of [0, 1441, -5, 30.5, 'pool tundi', '12345']) {
    failsWith({ text: 'x', visitMinutes: value }, 'home_care.errors.visit_minutes_invalid');
  }
  assert.equal(normalize({ text: 'x', visitMinutes: 1440 }).visitMinutes, 1440);
  failsWith({ activities: 'kõik' }, 'home_care.errors.visit_activity_unknown');
  failsWith({ activities: [{ activityId: 'x', mode: 'FOR' }] }, 'home_care.errors.visit_activity_unknown');
  failsWith({ activities: [{ activityId: A, mode: 'ALONE' }] }, 'home_care.errors.visit_mode_required');
  failsWith({ activities: [{ activityId: A, mode: 'FOR' }, { activityId: A, mode: 'GUIDE' }] }, 'home_care.errors.visit_activity_repeated');
  failsWith(
    { activities: Array.from({ length: HOME_CARE_LIMITS.VISIT_ACTIVITIES_MAX + 1 }, (_, index) => ({ activityId: `cmv0aaaaaaaaaaaaaaaaaa${String(index).padStart(3, '0')}`, mode: 'FOR' })) },
    'home_care.errors.visit_too_many_activities'
  );
});

test('käigu kirje parandus: saatmata väli jääb nii, nagu see kirjel on', () => {
  const base = {
    kind: 'NOTE',
    contactMode: 'VISIT',
    occurredAt: '2026-10-09T07:00:00.000Z',
    visitMinutes: 45,
    activities: [{ activityId: A, activityName: 'Kütmine', mode: 'FOR' }]
  };
  /* Ainult teksti parandus: kestus tuleb kirjelt ja toimingute read jäävad puutumata (null). */
  const textOnly = normalize({ text: 'Lisan märkuse.' }, base);
  assert.deepEqual([textOnly.visitMinutes, textOnly.visitActivities], [45, null]);
  /* Kirjel on toimingud, seega tohib tekst parandusega ka tühjaks jääda. */
  assert.equal(normalize({ text: '' }, base).text, '');
  /* Selge tühjendus: kestus null ja tühi loend; siis on tekst jälle kohustuslik. */
  const cleared = normalize({ text: 'Ainult jutt.', visitMinutes: null, activities: [] }, base);
  assert.deepEqual([cleared.visitMinutes, cleared.visitActivities], [null, []]);
  failsWith({ text: '', activities: [] }, 'home_care.errors.entry_text_required', base);
  /* Kontakti viis muudetakse telefoniks: käigu kirje kaob koos sellega. */
  const toPhone = normalize({ text: 'Tegelikult oli kõne.', contactMode: 'PHONE' }, base);
  assert.deepEqual([toPhone.visitMinutes, toPhone.visitActivities], [null, []]);
});

test('päringu räsi: käigu väljad muudavad räsi ainult siis, kui need on olemas', () => {
  const plain = normalize({ text: 'Kõik korras.', occurredAt: '2026-10-09T07:00:00Z' });
  const same = normalize({ text: 'Kõik korras.', occurredAt: '2026-10-09T07:00:00Z', activities: [] });
  assert.equal(entryRequestHash('c1', plain), entryRequestHash('c1', same));
  const withMinutes = normalize({ text: 'Kõik korras.', occurredAt: '2026-10-09T07:00:00Z', visitMinutes: 30 });
  const withActivity = normalize({ text: 'Kõik korras.', occurredAt: '2026-10-09T07:00:00Z', visitMinutes: 30, activities: [{ activityId: A, mode: 'FOR' }] });
  const otherMode = normalize({ text: 'Kõik korras.', occurredAt: '2026-10-09T07:00:00Z', visitMinutes: 30, activities: [{ activityId: A, mode: 'GUIDE' }] });
  const hashes = [plain, withMinutes, withActivity, otherMode].map((data) => entryRequestHash('c1', data));
  assert.equal(new Set(hashes).size, 4);
  /* Sama keha uuesti annab sama räsi (kordussaatmine võrgu taastumisel). */
  const again = normalize({ text: 'Kõik korras.', occurredAt: '2026-10-09T07:00:00Z', visitMinutes: 30, activities: [{ activityId: A, mode: 'FOR' }] });
  assert.equal(entryRequestHash('c1', withActivity), entryRequestHash('c1', again));
});

test('pooleli käigu kirje on mustand, mida tasub hoida', () => {
  assert.equal(isDraftWorthKeeping({ text: '', done: { [A]: 'FOR' } }), true);
  assert.equal(isDraftWorthKeeping({ text: '', visitMinutes: '30' }), true);
  assert.equal(isDraftWorthKeeping({ text: '', done: {}, visitMinutes: '' }), false);
  assert.equal(isDraftWorthKeeping({ text: '', done: null, extra: [{ activityId: A, name: 'x' }] }), false);
});

test('kronoloogia tekst: käigu kirjel lisandub kestuse ja toimingute rida', () => {
  assert.equal(entryDocumentText({ text: 'Kõik korras.', visitMinutes: null, activities: [] }, 'et'), 'Kõik korras.');
  const activities = [
    { activityName: 'Kütmine', mode: 'FOR' },
    { activityName: 'Pesemine', mode: 'ASSIST' }
  ];
  assert.equal(
    entryDocumentText({ text: 'Kõik korras.', visitMinutes: 45, activities }, 'et'),
    'Kõik korras.\nKäik kestis 45 min. Tehtud: Kütmine (tegin tema eest); Pesemine (aitasin osaliselt).'
  );
  /* Ilma tekstita käik ei ole kronoloogias tühi rida. */
  assert.equal(entryDocumentText({ text: '', visitMinutes: null, activities: [activities[0]] }, 'et'), 'Tehtud: Kütmine (tegin tema eest).');
  assert.equal(entryDocumentText({ text: '', visitMinutes: 20, activities: [] }, 'en'), 'The visit lasted 20 min.');
});

test('käigu kirje tekstid on kolmes keeles', () => {
  for (const locale of ['et', 'en', 'ru']) {
    const hc = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')).home_care;
    for (const value of CARE_PLAN_MODES) assert.ok(hc.visit.modes[value], `${locale} ${value}`);
    assert.match(hc.visit.doc.minutes, /\{minutes\}/);
    assert.match(hc.visit.doc.done, /\{list\}/);
    assert.match(hc.visit.lasted, /\{minutes\}/);
    for (const key of ['visit_minutes_invalid', 'visit_activity_unknown', 'visit_activity_repeated', 'visit_mode_required', 'visit_too_many_activities']) {
      assert.ok(hc.errors[key], `${locale} ${key}`);
    }
  }
});
