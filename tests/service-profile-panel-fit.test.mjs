// Teenuseprofiili leht töölaua paneelis: avaldamise kontrolli vaate kuju ja märkide loendur.
//
// Töölaua paneelis (umbes 37,8 rem lai) keris iga profiili vaade: kõrgeim oli 696 px, mahub 476.
// Osa sellest oli kujundus (väljad läksid üksteise alla), osa otsused: kontrolli vaade näitas
// kõiki ridu ühes loendis ja iga välja all seisis loendur. Otsused on failis
// components/workspace/serviceProfile/profileModel.js; siin on nende käitumine.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { COUNTER_FROM, PUBLISH_CHECK_PAGE, counterShown, publishCheckView } from '../components/workspace/serviceProfile/profileModel.js';

const LANGS = ['et', 'en', 'ru'];
const catalog = (lang) => JSON.parse(fs.readFileSync(new URL(`../messages/${lang}.json`, import.meta.url), 'utf8')).workspace_feature_pages.service_profile;
const at = (node, key) => key.split('.').reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), node);
const row = (key, over = {}) => ({ key, ok: true, blocking: false, optional: false, ...over });

test('avaldamise kontroll: ees on read, mis vajavad tähelepanu, takistavad enne', () => {
  const rows = [
    row('status'),
    row('assistant', { ok: false, optional: true }),
    row('location', { ok: false }),
    row('map'),
    row('register_name', { ok: false, blocking: true }),
    row('contact', { ok: false }),
    row('service')
  ];
  const view = publishCheckView(rows);
  /* Takistav rida on esimene, siis „vaata üle" read algses järjekorras, viimasena inimese enda valik. */
  assert.deepEqual(view.open.items.map((item) => item.key), ['register_name', 'location', 'contact', 'assistant']);
  assert.deepEqual([view.open.total, view.open.pages, view.open.from, view.open.to], [4, 1, 1, 4]);
  /* Korras read on eraldi (avatavas plokis) ja algses järjekorras. */
  assert.deepEqual(view.ok.map((item) => item.key), ['status', 'map', 'service']);
  assert.equal(view.allOk, false);
  /* Algne loend ei muutu. */
  assert.equal(rows[0].key, 'status');
});

test('avaldamise kontroll: kõik korras, tühi loend ja leheküljed', () => {
  const allOk = publishCheckView([row('status'), row('map')]);
  assert.equal(allOk.allOk, true);
  assert.deepEqual([allOk.open.items.length, allOk.open.pages, allOk.open.from, allOk.open.to, allOk.ok.length], [0, 1, 0, 0, 2]);
  assert.deepEqual([publishCheckView([]).allOk, publishCheckView(null).ok.length, publishCheckView([null, undefined]).open.total], [true, 0, 0]);

  /* Uus tühi profiil: palju ridu on korrast ära, need on lehekülgede kaupa. */
  const many = Array.from({ length: PUBLISH_CHECK_PAGE * 2 + 1 }, (_, index) => row(`r${index}`, { ok: false }));
  const first = publishCheckView(many);
  assert.deepEqual([first.open.items.length, first.open.pages, first.open.from, first.open.to], [PUBLISH_CHECK_PAGE, 3, 1, PUBLISH_CHECK_PAGE]);
  const last = publishCheckView(many, { page: 2 });
  assert.deepEqual([last.open.items.map((item) => item.key), last.open.from, last.open.to], [[`r${PUBLISH_CHECK_PAGE * 2}`], PUBLISH_CHECK_PAGE * 2 + 1, PUBLISH_CHECK_PAGE * 2 + 1]);
  /* Lehekülg, mida enam ei ole (rida sai korda), annab viimase olemasoleva. */
  assert.equal(publishCheckView(many, { page: 9 }).open.page, 2);
  assert.equal(publishCheckView(many, { page: -1 }).open.page, 0);
  assert.equal(publishCheckView(many, { pageSize: 0 }).open.items.length, 1, 'lehekülje suurus on vähemalt üks');
  assert.ok(PUBLISH_CHECK_PAGE >= 3 && PUBLISH_CHECK_PAGE <= 6, 'lehekülg on mõõdetud nii, et vaade mahub töölaua paneeli');
});

test('märkide loendur ilmub alles piiri lähedal', () => {
  /* Registrikoodi all seisev „8 / 1000" on müra ja iga loenduririda tegi vaate 18 px kõrgemaks. */
  assert.equal(counterShown('12345678', 1000), false);
  assert.equal(counterShown('', 1000), false);
  assert.equal(counterShown('a'.repeat(799), 1000), false);
  assert.equal(counterShown('a'.repeat(800), 1000), true);
  assert.equal(counterShown('a'.repeat(1000), 1000), true);
  assert.equal(counterShown('abcd', 5), true);
  assert.equal(counterShown('abc', 5), false);
  /* Väärtus, mis ei ole tekst, ja puuduv piir loendurit ei too. */
  assert.equal(counterShown(null, 1000), false);
  assert.equal(counterShown(12345678, 10), false);
  assert.equal(counterShown('a'.repeat(50), undefined), false);
  assert.equal(counterShown('a'.repeat(50), 0), false);
  assert.ok(COUNTER_FROM > 0.5 && COUNTER_FROM < 1);
});

test('kontrolli vaate ja jalarea tekstid on kataloogis kolmes keeles', () => {
  const keys = [
    'views.check.title', 'views.check.all_ok', 'views.check.ok_fold', 'views.check.range', 'views.check.prev', 'views.check.next',
    'views.check.missing', 'views.check.ok', 'views.check.optional', 'views.check.review',
    'views.publish_blocked', 'views.publish_blocked_short'
  ];
  for (const lang of LANGS) {
    const messages = catalog(lang);
    assert.deepEqual(keys.filter((key) => typeof at(messages, key) !== 'string' || !at(messages, key).trim()), [], lang);
    assert.ok(messages.views.check.ok_fold.includes('{count}'), lang);
    for (const mark of ['{from}', '{to}', '{total}']) assert.ok(messages.views.check.range.includes(mark), `${lang}: ${mark}`);
    /* Jalarea lause on lühem kui kontrolli vaate oma: pikk murdus jalareas kolmele reale. */
    assert.ok(messages.views.publish_blocked_short.length < messages.views.publish_blocked.length, lang);
    /* Avaldamise vaate üldjuhis on eemaldatud (märkekaart ütleb sama). */
    assert.equal(messages.publish_help, undefined, `${lang}: publish_help`);
  }
});
