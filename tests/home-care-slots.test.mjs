// KODUTEENUS kiht 3, K3-a — käigumuster: nädalapäev ja kehtivus (tehtud käigu reegel on päevaplaani testis).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HOME_CARE_LIMITS } from '../lib/homeCare/constants.js';
import { shiftDay, slotActiveOn, timeText, weekdayOf } from '../lib/homeCare/slots.js';

const sql = readFileSync(new URL('../prisma/migrations/20261010130000_home_care_visit_slots/migration.sql', import.meta.url), 'utf8');

test('käigumuster: andmebaasi CHECK-ide piirid on samad mis koodis', () => {
  assert.match(sql, /"CareVisitSlot_weekday_check" CHECK \("weekday" BETWEEN 1 AND 7\)/);
  assert.match(sql, /"CareVisitSlot_startMinute_check" CHECK \("startMinute" BETWEEN 0 AND 1439\)/);
  assert.match(
    sql,
    new RegExp(`"CareVisitSlot_plannedMinutes_check" CHECK \\("plannedMinutes" BETWEEN ${HOME_CARE_LIMITS.SLOT_MINUTES_MIN} AND ${HOME_CARE_LIMITS.SLOT_MINUTES_MAX}\\)`)
  );
  /* Lõpp ei ole enne algust; tühi lõpp on lubatud. */
  assert.match(sql, /"validUntil" IS NULL OR \("validUntil" ~ '[^']+' AND "validUntil" >= "validFrom"\)/);
  /* Liikmesuse kadumisel jääb käik määramata, mitte ei kao. */
  assert.match(sql, /REFERENCES "OrganizationMembership"\("id"\) ON DELETE SET NULL/);
});

test('nädalapäev, päeva nihutamine ja kellaaeg', () => {
  /* 09.10.2026 on reede; nädal algab esmaspäevast. */
  assert.deepEqual(['2026-10-05', '2026-10-09', '2026-10-11', '2026-10-12'].map(weekdayOf), [1, 5, 7, 1]);
  assert.equal(weekdayOf('2027-01-01'), 5);
  assert.equal(shiftDay('2026-10-09', -1), '2026-10-08');
  assert.equal(shiftDay('2026-10-31', 1), '2026-11-01');
  assert.equal(shiftDay('2027-01-01', -1), '2026-12-31');
  assert.deepEqual([0, 570, 1439].map(timeText), ['00:00', '09:30', '23:59']);
});

test('muster kehtib õigel nädalapäeval ja ainult oma kehtivuse sees', () => {
  const slot = { weekday: 5, validFrom: '2026-10-09', validUntil: '2026-10-23' };
  assert.equal(slotActiveOn(slot, '2026-10-09'), true);
  assert.equal(slotActiveOn(slot, '2026-10-23'), true);
  assert.equal(slotActiveOn(slot, '2026-10-02'), false); // enne algust
  assert.equal(slotActiveOn(slot, '2026-10-30'), false); // pärast lõppu
  assert.equal(slotActiveOn(slot, '2026-10-12'), false); // esmaspäev
  assert.equal(slotActiveOn({ ...slot, validUntil: null }, '2027-10-08'), true);
});

test('käigumustri tekstid on kolmes keeles', () => {
  for (const locale of ['et', 'en', 'ru']) {
    const hc = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')).home_care;
    for (const weekday of [1, 2, 3, 4, 5, 6, 7]) {
      assert.ok(hc.slots.weekdays[weekday], `${locale} ${weekday}`);
      assert.ok(hc.slots.weekdays_long[weekday], `${locale} ${weekday}`);
    }
    assert.match(hc.slots.worker_option, /\{name\}[\s\S]*\{count\}/, locale);
    for (const key of [
      'slot_time_invalid',
      'slot_minutes_invalid',
      'slot_weekday_required',
      'slot_worker_not_in_team',
      'slot_from_past',
      'slot_period_invalid',
      'slot_too_many',
      'slot_not_found',
      'slot_ended',
      'slot_end_past'
    ]) {
      assert.ok(hc.errors[key], `${locale} ${key}`);
    }
  }
});
