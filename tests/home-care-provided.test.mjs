// KODUTEENUS kiht 2, K2-e — osutatud aeg otsustatud mahu kõrval: nädala piirid ja otsustatud aja arvutus.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MISSED_VISIT_TYPES, expectedMinutes, weekBounds } from '../lib/homeCare/provided.js';

const TZ = 'Europe/Tallinn';
const iso = (range) => [range.gte.toISOString(), range.lt.toISOString()];

test('kalendrinädal: esmaspäevast pühapäevani asutuse ajavööndis, ka üle kellakeeramise', () => {
  /* Reede 09.10.2026: nädal on 05.10 kuni 11.10 (suveaeg, UTC+3). */
  const week = weekBounds(new Date('2026-10-09T08:00:00Z'), TZ);
  assert.deepEqual([week.fromDay, week.toDay], ['2026-10-05', '2026-10-11']);
  assert.deepEqual(iso(week.range), ['2026-10-04T21:00:00.000Z', '2026-10-11T21:00:00.000Z']);
  /* Esmaspäev ise ja pühapäeva hilisõhtu jäävad samasse nädalasse. */
  assert.equal(weekBounds(new Date('2026-10-05T05:00:00Z'), TZ).fromDay, '2026-10-05');
  assert.equal(weekBounds(new Date('2026-10-11T20:30:00Z'), TZ).fromDay, '2026-10-05');
  /* Pühapäev kell 22.30 UTC on Tallinnas juba esmaspäev: uus nädal. */
  assert.equal(weekBounds(new Date('2026-10-11T22:30:00Z'), TZ).fromDay, '2026-10-12');
  /* Nädal, mille pühapäeval (25.10) keeratakse kell tagasi, lõpeb talveaja järgi. */
  const turn = weekBounds(new Date('2026-10-21T08:00:00Z'), TZ);
  assert.deepEqual([turn.fromDay, turn.toDay], ['2026-10-19', '2026-10-25']);
  assert.deepEqual(iso(turn.range), ['2026-10-18T21:00:00.000Z', '2026-10-25T22:00:00.000Z']);
  /* Aastavahetus: neljapäev 31.12.2026 kuulub nädalasse 28.12 kuni 03.01. */
  const year = weekBounds(new Date('2026-12-31T10:00:00Z'), TZ);
  assert.deepEqual([year.fromDay, year.toDay], ['2026-12-28', '2027-01-03']);
});

test('otsustatud aeg ajavahemiku kohta: päeva kaupa, nädala- ja kuumahust', () => {
  const d = (validFrom, validUntil, volumeMinutes, volumePeriod, extra = {}) => ({ validFrom, validUntil, volumeMinutes, volumePeriod, retractedAt: null, ...extra });
  const weekly = d('2026-09-01', null, 420, 'WEEK');
  /* Nädalamaht 7 tundi: iga päev on üks tund. */
  assert.deepEqual(expectedMinutes([weekly], '2026-10-05', '2026-10-11'), { minutes: 420, coveredDays: 7, days: 7 });
  assert.equal(expectedMinutes([weekly], '2026-10-01', '2026-10-09').minutes, 540);
  /* Kuumaht 31 tundi oktoobris: terve kuu on 1860 minutit, kümme päeva 600. */
  const monthly = d('2026-01-01', null, 1860, 'MONTH');
  assert.equal(expectedMinutes([monthly], '2026-10-01', '2026-10-31').minutes, 1860);
  assert.equal(expectedMinutes([monthly], '2026-10-01', '2026-10-10').minutes, 600);
  /* Sama kuumaht veebruaris (28 päeva) annab päeva kohta rohkem; terve kuu on ikka kuumaht. */
  assert.equal(expectedMinutes([monthly], '2026-02-01', '2026-02-28').minutes, 1860);

  /* Poole pealt alanud otsus: loetakse ainult päevad, mil otsus kehtis. */
  assert.deepEqual(expectedMinutes([d('2026-10-06', null, 420, 'WEEK')], '2026-10-01', '2026-10-10'), { minutes: 300, coveredDays: 5, days: 10 });
  /* Lõppenud otsus ja järgmine suurema mahuga: kumbki oma päevadel. */
  const first = d('2026-01-01', '2026-10-05', 420, 'WEEK');
  const second = d('2026-10-06', null, 840, 'WEEK');
  assert.equal(expectedMinutes([first, second], '2026-10-01', '2026-10-10').minutes, 5 * 60 + 5 * 120);
  /* Kattuv ajutine lisaotsus: neil päevadel loeb hiliseima algusega otsus. */
  const extra = d('2026-10-03', '2026-10-04', 1680, 'WEEK');
  assert.equal(expectedMinutes([weekly, extra], '2026-10-01', '2026-10-07').minutes, 5 * 60 + 2 * 240);

  /* Mahuta või tühistatud otsus ja otsuse puudumine: võrrelda ei ole millegagi (null, mitte 0). */
  assert.equal(expectedMinutes([], '2026-10-01', '2026-10-09'), null);
  assert.equal(expectedMinutes([d('2026-01-01', null, null, null)], '2026-10-01', '2026-10-09'), null);
  assert.equal(expectedMinutes([d('2026-01-01', null, 420, 'WEEK', { retractedAt: new Date() })], '2026-10-01', '2026-10-09'), null);
  assert.equal(expectedMinutes([d('2026-11-01', null, 420, 'WEEK')], '2026-10-01', '2026-10-09'), null);
});

test('ära jäänud käigu liigid ja kuu kokkuvõtte tekstid kolmes keeles', () => {
  assert.deepEqual([...MISSED_VISIT_TYPES], ['DOOR_NOT_OPENED', 'REFUSED_HELP']);
  for (const locale of ['et', 'en', 'ru']) {
    const hc = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')).home_care;
    for (const type of MISSED_VISIT_TYPES) assert.ok(hc.incident.types[type], `${locale} ${type}`);
    for (const key of ['week', 'month']) {
      assert.match(hc.provided[key], /\{visits\}/, `${locale} ${key}`);
      assert.match(hc.provided[key], /\{amount\}/, `${locale} ${key}`);
      assert.ok(hc.provided[`${key}_none`], `${locale} ${key}_none`);
    }
    assert.match(hc.month.totals, /\{visits\}[\s\S]*\{amount\}[\s\S]*\{without\}[\s\S]*\{missed\}/, locale);
    for (const key of ['clients_title', 'workers_title', 'missed_title', 'expected', 'expected_none', 'how']) assert.ok(hc.month[key], `${locale} ${key}`);
  }
});
