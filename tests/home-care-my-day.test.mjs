// Hooldaja päev („Täna") väikeste vaadetena.
//
// „Täna" oli pika keritava lehe algus (proovandmetega 1348 px, paneel 522).
// Hooldaja avab lehe ukse taga: vaade peab mahtuma ekraanile. Reeglid on puhtas
// failis components/homeCare/day/myDay.js; test hoiab, mis käigud on ees, mis
// lähevad ühele reale, mis sõnad on real ja millal takistuse teade on lubatud.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { FOLLOWING, allLine, obstacleButtonKey, showObstacle, splitToday, visitChips, visitLine, visitNotes } from '../components/homeCare/day/myDay.js';
import { HOME_VIEWS } from '../components/homeCare/desk/homeCareDesk.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const LANGS = ['et', 'en', 'ru'];
const catalogs = Object.fromEntries(LANGS.map((lang) => [lang, JSON.parse(read(`messages/${lang}.json`))]));
const t = (key, params) => (params ? `${key}:${Object.values(params).join(',')}` : key);
const visit = (slotId, startTime, extra = {}) => ({ slotId, startTime, client: { id: `c-${slotId}`, displayName: `Klient ${slotId}`, address: 'Pikk 4' }, plannedMinutes: 45, state: 'PLANNED', done: false, ...extra });
const ids = (list) => list.map((item) => item.slotId);

test('järgmine käik on ees täies pikkuses, järgnevad ühe reana', () => {
  const split = splitToday([visit('a', '09:00'), visit('b', '10:00'), visit('c', '11:00')]);
  assert.equal(split.first.slotId, 'a');
  assert.deepEqual(ids(split.follow), ['b', 'c']);
  assert.deepEqual(split.done, []);
  assert.deepEqual(split.later, []);
});

test('tehtud ja hilisemad käigud on rea „Kõik tänased käigud” taga', () => {
  const day = [visit('a', '08:00', { done: true }), visit('b', '09:00', { done: true }), visit('c', '10:00'), visit('d', '11:00'), visit('e', '12:00'), visit('f', '13:00'), visit('g', '14:00'), visit('h', '15:00')];
  const split = splitToday(day);
  assert.deepEqual(ids(split.done), ['a', 'b']);
  assert.equal(split.first.slotId, 'c');
  assert.deepEqual(ids(split.follow), ['d', 'e', 'f']);
  assert.equal(split.follow.length, FOLLOWING);
  assert.deepEqual(ids(split.later), ['g', 'h']);
  /* Iga käik on täpselt ühes kohas. */
  assert.equal(split.done.length + 1 + split.follow.length + split.later.length, day.length);
  assert.equal(allLine(split, { t }), 'home_care.today.done_part:2 · home_care.today.later_part:2');
  assert.equal(allLine(splitToday([visit('a', '09:00'), visit('b', '10:00')]), { t }), '');
  /* Tühi ja puuduv loend ei kuku. */
  assert.deepEqual(splitToday(null), { done: [], first: null, follow: [], later: [] });
});

test('ära jäetud käik ei ole „järgmine käik”, aga jääb märgiga ette', () => {
  const split = splitToday([visit('a', '09:00', { state: 'CANCELLED' }), visit('b', '10:00'), visit('c', '11:00')]);
  assert.equal(split.first.slotId, 'b');
  assert.deepEqual(ids(split.follow), ['a', 'c']);
  assert.deepEqual(visitChips(visit('a', '09:00', { state: 'CANCELLED' }), { t }), [{ key: 'cancelled', text: 'home_care.day.states.CANCELLED', wait: true }]);
  /* Kõik tegemata käigud on ära jäetud: täispikka rida ei ole. */
  const none = splitToday([visit('a', '09:00', { state: 'CANCELLED' })]);
  assert.equal(none.first, null);
  assert.deepEqual(ids(none.follow), ['a']);
});

test('käigu märgid: tehtud, asendus ja muudetud aeg', () => {
  const chips = visitChips(visit('a', '09:00', { done: true, covering: true, change: { timeChanged: true } }), { t });
  assert.deepEqual(chips.map((chip) => chip.key), ['done', 'covering', 'time']);
  assert.deepEqual(visitChips(visit('a', '09:00'), { t }), []);
});

test('käigu rea sõnad: kestus, aadress, märkus, võtme asukoht ja sõit', () => {
  const format = { t, minutes: (value) => `${value} min`, keyWhere: () => 'võti: kontoris', ride: () => 'sõit kell 12:00' };
  assert.equal(visitLine(visit('a', '09:00', { note: 'helista ette' }), format), '45 min · Pikk 4 · helista ette');
  /* Võtme asukoht ainult siis, kui võti ei ole minu käes ja käik toimub. */
  assert.equal(visitLine(visit('a', '09:00', { key: { held: false } }), format), '45 min · Pikk 4 · võti: kontoris');
  assert.equal(visitLine(visit('a', '09:00', { key: { held: true } }), format), '45 min · Pikk 4');
  assert.equal(visitLine(visit('a', '09:00', { ride: { time: '12:00' } }), format), '45 min · Pikk 4 · sõit kell 12:00');
  /* Ära jäetud käik: põhjus ja märkus, võtme asukohta ei ole. */
  assert.equal(
    visitLine(visit('a', '09:00', { state: 'CANCELLED', key: { held: false }, change: { reason: 'CLIENT_AWAY', note: 'haiglas' } }), format),
    '45 min · Pikk 4 · home_care.day.cancel_reasons.CLIENT_AWAY · haiglas'
  );
});

test('käigu teated: kojutulek ja esmakäik', () => {
  const day = (value) => `p${value}`;
  assert.deepEqual(visitNotes(visit('a', '09:00'), { t, day }), []);
  assert.deepEqual(visitNotes(visit('a', '09:00', { homecoming: { returnedOn: '2026-10-10' } }), { t, day }), ['home_care.homecoming.my_line:p2026-10-10']);
  assert.deepEqual(visitNotes(visit('a', '09:00', { firstVisit: { outcome: null } }), { t, day }), ['home_care.first_visit.my_line home_care.first_visit.my_not_marked']);
  assert.deepEqual(visitNotes(visit('a', '09:00', { firstVisit: { outcome: 'REACHED' } }), { t, day }), ['home_care.first_visit.my_line home_care.first_visit.my_outcomes.REACHED']);
});

test('takistuse teade: mitte puudumise päeval ja ainult siis, kui on teade või tegemata käik', () => {
  assert.equal(showObstacle(null), false);
  assert.equal(showObstacle({ absent: true, visits: [visit('a', '09:00')] }), false);
  assert.equal(showObstacle({ absent: false, visits: [visit('a', '09:00')] }), true);
  assert.equal(showObstacle({ absent: false, visits: [visit('a', '09:00', { done: true })] }), false);
  assert.equal(showObstacle({ absent: false, visits: [visit('a', '09:00', { state: 'CANCELLED' })] }), false);
  assert.equal(showObstacle({ absent: false, visits: [], obstacle: { id: 'o1' } }), true);
  assert.equal(obstacleButtonKey(null), 'home_care.obstacle.button');
  assert.equal(obstacleButtonKey({ handled: false }), 'home_care.obstacle.change');
  assert.equal(obstacleButtonKey({ handled: true }), 'home_care.obstacle.again');
});

test('päeva vaadete sõnad on kolmes keeles olemas', () => {
  const keys = Object.keys(catalogs.et.home_care.today);
  assert.ok(keys.length >= 9, `võtmeid ${keys.length}`);
  for (const key of ['count', 'done_part', 'later_part', 'all_title', 'mine_title', 'mine_keys', 'mine_money', 'back', 'none']) assert.ok(keys.includes(key), key);
  for (const lang of LANGS) {
    for (const key of keys) {
      const value = catalogs[lang].home_care.today[key];
      assert.ok(typeof value === 'string' && value.trim(), `${lang}: home_care.today.${key}`);
      if (lang !== 'et') assert.notEqual(value, catalogs.et.home_care.today[key], `${lang}: ${key} on eesti koopia`);
    }
  }
  /* Vaate „Täna" alavaated kannavad kiirmenüüs sama nime, järgmised päevad oma. */
  for (const view of ['all', 'mine', 'obstacle']) assert.equal(HOME_VIEWS[view], HOME_VIEWS.today);
  assert.equal(HOME_VIEWS.next, 'home_care.slots.next_title');
});
