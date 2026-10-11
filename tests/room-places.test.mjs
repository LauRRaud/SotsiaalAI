// Töölaud: tuba on töölaud (omanik 11.10.2026). Lehe otsused käitumisena.
//
// Toavaate otsused elavad puhtas moodulis lib/roomPlaces.js: mis tsoon on toas
// kus, mis tööriist on suur ja mis väike, mis märk tal on ja kuhu kaamera läheb.
// Siin hoitakse neid lubadusi, mida silm kohe ei näe: tundmatu tsooniga kaart ei
// kao ära, märk tuleb ainult päris arvust, suuri kaarte ei ole kohas rohkem, kui
// mahub, ja kaamera ei tõmba tuba ekraani servast lahti.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  CARD_BADGE_KEY,
  MAX_LARGE_PER_PLACE,
  PLACE_SPOTS,
  buildPlaces,
  cameraFor,
  gridColumns,
  nearestPlace,
  splitTools,
  stepPlace,
  waitingFor
} from '../lib/roomPlaces.js';
import { CLIENT_ZONE, WORKSPACE_ZONES } from '../lib/deskZones.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const card = (key, zone) => ({ key, zone, label: key, href: `/${key}` });
const badge = (value) => ({ type: 'number', value, label: String(value) });

test('igal Töölaua tsoonil on toas koht ja selgitus kolmes keeles', () => {
  const zones = new Set(Object.values(WORKSPACE_ZONES).flat());
  for (const zone of zones) {
    assert.ok(PLACE_SPOTS[zone], `tsoonil ${zone} on koht`);
    assert.ok(PLACE_SPOTS[zone].ax > 0 && PLACE_SPOTS[zone].ax < 100 && PLACE_SPOTS[zone].ay > 0 && PLACE_SPOTS[zone].ay < 100);
  }
  for (const zone of new Set(Object.values(CLIENT_ZONE))) assert.ok(PLACE_SPOTS[zone], `kliendi tsoonil ${zone} on koht`);
  /* Ühe rolli kohad ei seisa üksteise otsas: vahe vähemalt veerand ekraani. */
  for (const [role, ids] of Object.entries(WORKSPACE_ZONES)) {
    const xs = ids.map((id) => PLACE_SPOTS[id].ax).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i += 1) assert.ok(xs[i] - xs[i - 1] >= 25, `${role}: ${xs.join(', ')}`);
  }
  for (const lang of ['et', 'en', 'ru']) {
    const room = JSON.parse(read(`../messages/${lang}.json`)).room;
    for (const zone of zones) {
      assert.ok(room.zones[zone].name, `${lang} ${zone} nimi`);
      assert.ok(room.zones[zone].what, `${lang} ${zone} selgitus`);
    }
    for (const key of ['back_room', 'waiting_count', 'waiting_draft']) assert.ok(room.places[key], `${lang} ${key}`);
    assert.ok(room.places.waiting_count.includes('{count}'), `${lang}: arv on lauses sees`);
  }
});

test('kohad on toas vasakult paremale ja ükski kaart ei kao ära', () => {
  const items = [card('poordumised', 'juhtum'), card('otsi', 'teadmine'), card('jagamised', 'mina'), card('uus', 'tundmatu'), card('valitoo', 'juhtum')];
  const places = buildPlaces(WORKSPACE_ZONES.SOCIAL_WORKER, items);
  assert.deepEqual(places.map((place) => place.id), ['mina', 'juhtum', 'teadmine']);
  assert.deepEqual(places.find((place) => place.id === 'juhtum').items.map((item) => item.key), ['poordumised', 'valitoo']);
  /* Tundmatu tsooniga kaart läheb rolli tsooniloendi viimasesse kohta, mitte prügikasti. */
  const last = WORKSPACE_ZONES.SOCIAL_WORKER[WORKSPACE_ZONES.SOCIAL_WORKER.length - 1];
  assert.ok(places.find((place) => place.id === last).items.some((item) => item.key === 'uus'));
  assert.equal(places.reduce((sum, place) => sum + place.items.length, 0), items.length);
  /* Tühja kohta ei näidata; kliendil on kaks kohta. */
  assert.deepEqual(buildPlaces(WORKSPACE_ZONES.SOCIAL_WORKER, [card('otsi', 'teadmine')]).map((place) => place.id), ['teadmine']);
  assert.deepEqual(buildPlaces(WORKSPACE_ZONES.CLIENT, [card('teekond', 'minu_tee'), card('otsi', 'leian_abi')]).map((place) => place.id), ['minu_tee', 'leian_abi']);
  assert.deepEqual(buildPlaces(null, items), []);
  assert.deepEqual(buildPlaces(['tundmatu'], items), []);
  assert.deepEqual(buildPlaces(WORKSPACE_ZONES.CLIENT, null), []);
});

test('märk tuleb ainult päris arvust ja ütleb, kas keegi ootab või on mul pooleli', () => {
  assert.equal(waitingFor('poordumised', { pre_inquiries: badge(2) }, 'SOCIAL_WORKER').kind, 'count');
  assert.equal(waitingFor('poordumised', { pre_inquiries: badge(2) }, 'SOCIAL_WORKER').label, '2');
  /* Kliendi eelpöördumise märk on tema enda mustand. */
  assert.equal(waitingFor('poordumised', { pre_inquiries: badge(1) }, 'CLIENT').kind, 'draft');
  assert.equal(waitingFor('tooheaolu', { wellbeing: badge(1) }, 'SOCIAL_WORKER').kind, 'draft');
  assert.equal(waitingFor('teekond', { journey: badge(3) }, 'CLIENT').kind, 'draft');
  assert.equal(waitingFor('teenuseprofiil', { service_profile: badge(1) }, 'SERVICE_PROVIDER').kind, 'count');
  /* Suur arv tuleb serveri sildiga („99+"). */
  assert.equal(waitingFor('mentorlus', { mentoring: { type: 'number', value: 99, label: '99+' } }, 'SOCIAL_WORKER').label, '99+');
  /* Ei ole märki: null, tühi, vale kuju, teise kaardi arv, kaart ilma allikata. */
  for (const badges of [null, undefined, {}, { pre_inquiries: badge(0) }, { pre_inquiries: { value: 'x' } }, { pre_inquiries: null }, { wellbeing: badge(4) }]) {
    assert.equal(waitingFor('poordumised', badges, 'SOCIAL_WORKER'), null);
  }
  assert.equal(waitingFor('juhtumitoo', { pre_inquiries: badge(5), field_visits: badge(5) }, 'SOCIAL_WORKER'), null);
  /* Iga märgi võti on päris kaardi võti (muidu ei sütti märk kunagi). */
  const stage = read('../components/room/RoomStage.jsx');
  for (const key of Object.keys(CARD_BADGE_KEY)) assert.ok(stage.includes(`key: "${key}"`), `kaart ${key} on Töölaua loendis`);
  const continuity = read('../lib/workspaceContinuity.js');
  for (const badgeKey of new Set(Object.values(CARD_BADGE_KEY))) assert.ok(continuity.includes(`badgeKey: "${badgeKey}"`), `server annab arvu ${badgeKey}`);
});

test('suurelt on ees ainult see, mis ootab, ja mitte rohkem, kui kohas mahub', () => {
  const items = [card('supervisioon', 'mina'), card('mentorlus', 'mina'), card('kovisioon', 'mina'), card('tooheaolu', 'mina'), card('teenuseprofiil', 'mina'), card('jagamised', 'mina')];
  const nothing = splitTools(items, {}, 'SOCIAL_WORKER');
  assert.equal(nothing.large.length, 0);
  assert.deepEqual(nothing.small.map((entry) => entry.item.key), items.map((item) => item.key));
  assert.ok(nothing.small.every((entry) => entry.waiting === null));

  const some = splitTools(items, { mentoring: badge(2), wellbeing: badge(1) }, 'SOCIAL_WORKER');
  assert.deepEqual(some.large.map((entry) => entry.item.key), ['mentorlus', 'tooheaolu']);
  assert.deepEqual(some.small.map((entry) => entry.item.key), ['supervisioon', 'kovisioon', 'teenuseprofiil', 'jagamised']);

  /* Neli ootavat: kolm suurelt, neljas jääb väikeseks, aga teab, et ootab (täpp). */
  const many = splitTools(items, { supervision: badge(1), mentoring: badge(1), wellbeing: badge(1), service_profile: badge(1) }, 'SERVICE_PROVIDER');
  assert.equal(many.large.length, MAX_LARGE_PER_PLACE);
  assert.deepEqual(many.large.map((entry) => entry.item.key), ['supervisioon', 'mentorlus', 'tooheaolu']);
  const fourth = many.small.find((entry) => entry.item.key === 'teenuseprofiil');
  assert.equal(fourth.waiting.kind, 'count');
  assert.equal(many.large.length + many.small.length, items.length);
  assert.deepEqual(splitTools(null, {}, 'CLIENT'), { large: [], small: [] });
});

test('kaamera toob koha keskele, aga ei tõmba tuba ekraani servast lahti', () => {
  const view = { width: 1536, height: 640 };
  assert.deepEqual(cameraFor(null, view), { scale: 1, txPercent: 0, tyPercent: 0, tx: 0, ty: 0 });
  for (const [id, spot] of Object.entries(PLACE_SPOTS)) {
    for (const narrow of [false, true]) {
      const camera = cameraFor(spot, { ...view, narrow });
      assert.equal(camera.scale, narrow ? 1.2 : 1.3);
      /* Toa vasak ülanurk ei tule ekraani sisse ja parem alanurk ei jää ekraanist ettepoole. */
      assert.ok(camera.txPercent <= 0 && camera.tyPercent <= 0, id);
      assert.ok(camera.scale * (100 + camera.txPercent) >= 100 - 1e-9, `${id}: parem serv`);
      assert.ok(camera.scale * (100 + camera.tyPercent) >= 100 - 1e-9, `${id}: alumine serv`);
      /* Koht ise jääb ekraanile. */
      const x = camera.scale * (spot.ax + camera.txPercent);
      const y = camera.scale * (spot.ay + camera.tyPercent);
      assert.ok(x > 5 && x < 95 && y > 5 && y < 95, `${id}: ${x}, ${y}`);
      /* Pikslid on samad protsendid. */
      assert.ok(Math.abs(camera.tx - (camera.txPercent / 100) * view.width) < 0.01);
      assert.ok(Math.abs(camera.ty - (camera.tyPercent / 100) * view.height) < 0.01);
    }
  }
  /* Keskmine koht tuleb täpselt keskele, äärmine nii kaugele, kui serv lubab. */
  const wall = cameraFor(PLACE_SPOTS.juhtum, view);
  assert.ok(Math.abs(wall.scale * (PLACE_SPOTS.juhtum.ax + wall.txPercent) - 50) < 1e-9);
  assert.equal(cameraFor(PLACE_SPOTS.mina, view).txPercent, 0);
});

test('veerud, lähim koht ja nooleklahv', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9].map((count) => gridColumns(count)), [1, 2, 3, 3, 3, 3, 4, 4, 4]);
  assert.deepEqual([1, 2, 3, 7, 9].map((count) => gridColumns(count, true)), [1, 2, 3, 3, 3]);
  const places = buildPlaces(WORKSPACE_ZONES.SOCIAL_WORKER, [card('a', 'mina'), card('b', 'juhtum'), card('c', 'teadmine')]);
  assert.equal(nearestPlace(places, 5).id, 'mina');
  assert.equal(nearestPlace(places, 49).id, 'juhtum');
  assert.equal(nearestPlace(places, 99).id, 'teadmine');
  assert.equal(nearestPlace([], 50), null);
  /* Nooled: toa servast edasi ei lähe; ilma kohata haarab esimene vajutus selle serva, kust tullakse. */
  assert.equal(stepPlace(places, '', 1).id, 'mina');
  assert.equal(stepPlace(places, '', -1).id, 'teadmine');
  assert.equal(stepPlace(places, 'mina', 1).id, 'juhtum');
  assert.equal(stepPlace(places, 'teadmine', 1).id, 'teadmine');
  assert.equal(stepPlace(places, 'mina', -1).id, 'mina');
  assert.equal(stepPlace([], 'mina', 1), null);
});

test('Töölaud kasutab toavaadet, teised menüüd jäävad karusselli ja laua peale', () => {
  const stage = read('../components/room/RoomStage.jsx');
  assert.ok(stage.includes('{carouselSet === "workspace" ? ('), 'toavaade ainult Töölaua komplektile');
  assert.ok(stage.includes('<RoomPlaces'));
  /* Tööheaolu laud ja ülejäänud karussellid on endiselt GlassCarousel. */
  assert.ok(stage.includes('if (carouselSet === "wellbeing") return WELLBEING_ZONES;'));
  assert.equal([...stage.matchAll(/<GlassCarousel\b/g)].length, 3, 'karussell ja kaks dokki');
  /* Toapilt liigub ainult Töölaua kaameraga: reegel on märgi `data-places` taga. */
  const css = read('../app/styles/room.css');
  assert.ok(css.includes('.room[data-places] .room-view {'));
  assert.ok(!/^\.room-view \{[^}]*transform:/m.test(css), 'teistel lehtedel pildil teisendust ei ole');
  /* Värav on karusselliga üks ja sama (aken, paneel ja avatud ülariba lukustavad). */
  assert.ok(read('../components/room/GlassCarousel.jsx').includes('isRoomInteractive(navRef.current, options)'));
  assert.ok(read('../components/room/RoomPlaces.jsx').includes('isRoomInteractive(root)'));
});
