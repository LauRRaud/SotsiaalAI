import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { homecomingOf } from '../lib/homeCare/homecoming.js';

const at = (iso) => new Date(iso);
const row = (fromStatus, toStatus, when, reason = null) => ({ fromStatus, toStatus, reason, changedAt: at(when) });
const on = (iso) => ({ now: at(iso), timeZone: 'Europe/Tallinn' });

test('kojutulek: viimane muutus on „ära → teenusel" ja äraolek oli piisavalt pikk', () => {
  const hospital = [row('ACTIVE', 'AWAY', '2026-09-28T08:00:00Z', 'HOSPITAL'), row('AWAY', 'ACTIVE', '2026-10-08T09:00:00Z')];
  assert.deepEqual(homecomingOf(hospital, on('2026-10-09T08:00:00Z')), { returnedOn: '2026-10-08', awayFrom: '2026-09-28', reason: 'HOSPITAL' });
  /* Haigla loeb ka ühe päevaga; muu äraolek alates kolmest päevast. */
  assert.ok(homecomingOf([row('ACTIVE', 'AWAY', '2026-10-07T08:00:00Z', 'HOSPITAL'), row('AWAY', 'ACTIVE', '2026-10-08T09:00:00Z')], on('2026-10-09T08:00:00Z')));
  assert.equal(homecomingOf([row('ACTIVE', 'AWAY', '2026-10-06T08:00:00Z', 'WITH_FAMILY'), row('AWAY', 'ACTIVE', '2026-10-08T09:00:00Z')], on('2026-10-09T08:00:00Z')), null);
  assert.ok(homecomingOf([row('ACTIVE', 'AWAY', '2026-10-05T08:00:00Z', 'OTHER'), row('AWAY', 'ACTIVE', '2026-10-08T09:00:00Z')], on('2026-10-09T08:00:00Z')));
});

test('kojutulek: ei ole kojutulek', () => {
  const now = on('2026-10-09T08:00:00Z');
  assert.equal(homecomingOf([], now), null);
  assert.equal(homecomingOf(null, now), null);
  /* Ikka veel ära; teenus lõppes; teenus algas uuesti pärast lõppu. */
  assert.equal(homecomingOf([row('ACTIVE', 'AWAY', '2026-09-28T08:00:00Z', 'HOSPITAL')], now), null);
  assert.equal(homecomingOf([row('ACTIVE', 'AWAY', '2026-09-28T08:00:00Z', 'HOSPITAL'), row('AWAY', 'ENDED', '2026-10-08T09:00:00Z', 'DIED')], now), null);
  assert.equal(homecomingOf([row('ACTIVE', 'ENDED', '2026-09-01T08:00:00Z', 'NO_LONGER_NEEDED'), row('ENDED', 'ACTIVE', '2026-10-08T09:00:00Z')], now), null);
  /* Ohutuse pärast peatatud käigud. */
  assert.equal(homecomingOf([row('ACTIVE', 'AWAY', '2026-09-20T08:00:00Z', 'SAFETY'), row('AWAY', 'ACTIVE', '2026-10-08T09:00:00Z')], now), null);
  /* Ajalugu on poolik: äraoleku algust ei ole. */
  assert.equal(homecomingOf([row('AWAY', 'ACTIVE', '2026-10-08T09:00:00Z')], now), null);
});

test('kojutulek: põhjuse täpsustus äraoleku ajal, aegumine ja päev asutuse ajavööndis', () => {
  /* Põhjust täpsustati äraoleku ajal: algus on esimene „ära" rida, põhjus viimane. */
  const refined = [
    row('ACTIVE', 'AWAY', '2026-09-28T08:00:00Z', 'OTHER'),
    row('AWAY', 'AWAY', '2026-09-30T08:00:00Z', 'HOSPITAL'),
    row('AWAY', 'ACTIVE', '2026-10-08T09:00:00Z')
  ];
  assert.deepEqual(homecomingOf(refined, on('2026-10-09T08:00:00Z')), { returnedOn: '2026-10-08', awayFrom: '2026-09-28', reason: 'HOSPITAL' });
  /* Varasem äraolek ei sega: loeb ainult viimane. */
  const twice = [row('ACTIVE', 'AWAY', '2026-08-01T08:00:00Z', 'HOSPITAL'), row('AWAY', 'ACTIVE', '2026-08-10T08:00:00Z'), ...refined];
  assert.equal(homecomingOf(twice, on('2026-10-09T08:00:00Z')).awayFrom, '2026-09-28');
  /* 30 päeva pärast naasmist veel kehtib, 31. päeval enam mitte. */
  assert.ok(homecomingOf(refined, on('2026-11-07T08:00:00Z')));
  assert.equal(homecomingOf(refined, on('2026-11-08T08:00:00Z')), null);
  /* Kell 22.30 UTC on Tallinnas juba järgmine päev. */
  const late = [row('ACTIVE', 'AWAY', '2026-09-28T08:00:00Z', 'HOSPITAL'), row('AWAY', 'ACTIVE', '2026-10-08T22:30:00Z')];
  assert.equal(homecomingOf(late, on('2026-10-09T08:00:00Z')).returnedOn, '2026-10-09');
});

test('kojutulek: tekstid kolmes keeles', () => {
  for (const locale of ['et', 'en', 'ru']) {
    const catalogue = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')).home_care;
    for (const key of ['notice', 'first_visit', 'coordinator', 'day_line', 'my_line']) assert.ok(catalogue.homecoming[key], `${locale} ${key}`);
    for (const key of ['homecomings_title', 'homecomings_empty', 'homecomings_line']) assert.ok(catalogue.deadlines[key], `${locale} ${key}`);
  }
});
