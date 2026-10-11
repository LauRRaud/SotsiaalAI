// Koduteenuse laud ja liikumine kiirmenüüs.
//
// Koduteenuse avalehel seisis 16 lingiga nupurida ja igal alalehel tagasilink
// paneeli ülaservas. Nüüd on koduteenus laud (plaadid kõigi lehtedega, mida
// inimene näeb) ja liikumine on kiirmenüüs: nelja ruuduga nupp viib alati ühe
// taseme võrra üles. Test hoiab laua reegleid (kes mida näeb, mis järjekorras,
// kuhu koduteenus avaneb) ja seda, et tagasilink paneeli tagasi ei tuleks.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DESK_GROUPS, HOME_VIEWS, WORKER_TILES, deskGroups, deskViewer, hasOwnDay, landingView, viewName } from '../components/homeCare/desk/homeCareDesk.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const LANGS = ['et', 'en', 'ru'];
const catalogs = Object.fromEntries(LANGS.map((lang) => [lang, JSON.parse(read(`messages/${lang}.json`))]));
const at = (node, key) => key.split('.').reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), node);
const t = (key) => key;
const opts = { t, organizationId: 'org1' };
const keysOf = (groups) => groups.flatMap((group) => group.tiles.map((tile) => tile.key));

const coordinator = { isCoordinator: true, canSearch: true, canExport: true, canEditReferrals: true, hasReferrals: true, writable: true, hasDay: false, needsName: false };
const worker = { isCoordinator: false, canSearch: true, canExport: false, canEditReferrals: false, hasReferrals: true, writable: true, hasDay: true, needsName: false };

test('hooldusjuhi laual on kolm rühma ja rühmas kuni kuus plaati', () => {
  const groups = deskGroups({ ...coordinator, hasDay: true }, opts);
  assert.deepEqual(groups.map((group) => group.key), ['daily', 'people', 'month']);
  for (const group of groups) {
    assert.ok(group.title, group.key);
    assert.ok(group.tiles.length >= 1 && group.tiles.length <= 6, `${group.key}: ${group.tiles.length}`);
  }
  /* Kõigi õigustega hooldusjuht, kellel on ka oma käigud: kõik 18 plaati. */
  assert.equal(keysOf(groups).length, 18);
  assert.deepEqual(keysOf(groups), DESK_GROUPS.flatMap((group) => group.tiles));
});

test('plaat on kas alaleht (marsruut) või avalehe vaade, mitte mõlemad', () => {
  for (const tile of deskGroups({ ...coordinator, hasDay: true }, opts).flatMap((group) => group.tiles)) {
    assert.ok(Boolean(tile.href) !== Boolean(tile.view), tile.key);
    if (tile.href) assert.match(tile.href, /^\/org\/org1\/koduteenus\/[a-z]+$/, tile.key);
    else assert.ok(HOME_VIEWS[tile.view], tile.key);
  }
});

test('iga alalehe plaat viib lehele, mis on olemas', () => {
  for (const tile of deskGroups({ ...coordinator, hasDay: true }, opts).flatMap((group) => group.tiles)) {
    if (!tile.href) continue;
    const page = `app/org/[orgId]/koduteenus/${tile.href.split('/').pop()}/page.jsx`;
    assert.ok(fs.existsSync(path.join(root, page)), page);
  }
});

test('õiguseta plaati laual ei ole', () => {
  const plain = keysOf(deskGroups({ ...coordinator, canExport: false, canEditReferrals: false, hasReferrals: false, canSearch: false }, opts));
  for (const key of ['export', 'workers', 'refer', 'trips', 'today']) assert.ok(!plain.includes(key), key);
  /* „Kuhu suunata": loend on olemas või inimene tohib seda koostada. */
  assert.ok(keysOf(deskGroups({ ...coordinator, hasReferrals: false }, opts)).includes('refer'));
  assert.ok(!keysOf(deskGroups({ ...coordinator, hasReferrals: false, writable: false }, opts)).includes('refer'));
  assert.ok(keysOf(deskGroups({ ...coordinator, hasReferrals: true, canEditReferrals: false }, opts)).includes('refer'));
});

test('hooldaja laual on üks pealkirjata rühm tema enda asjadega', () => {
  const groups = deskGroups(worker, opts);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].title, '');
  assert.deepEqual(keysOf(groups), [...WORKER_TILES]);
  /* Hooldaja näeb oma kliente: plaadi nimi ja rida ütlevad seda. */
  const clients = groups[0].tiles.find((tile) => tile.key === 'clients');
  assert.equal(clients.name, 'home_care.home.my_clients');
  assert.equal(clients.line, 'home_care.desk.lines.my_clients');
  /* Ilma oma päevata ja sõidupäevikuta jäävad kliendid. */
  assert.deepEqual(keysOf(deskGroups({ ...worker, hasDay: false, canSearch: false, hasReferrals: false }, opts)), ['clients']);
});

test('koduteenus avaneb hooldajal vaatega „Täna”, hooldusjuhil lauaga, nimeta inimesel nime vormiga', () => {
  assert.equal(landingView(worker), 'today');
  assert.equal(landingView({ ...worker, hasDay: false }), '');
  assert.equal(landingView(coordinator), '');
  assert.equal(landingView({ ...coordinator, hasDay: true }), '');
  assert.equal(landingView({ ...worker, needsName: true }), 'name');
  assert.equal(landingView({ ...coordinator, needsName: true }), 'name');
});

test('lehe andmetest loetakse, kes lauda vaatab', () => {
  const who = deskViewer({
    context: { writable: true },
    initial: { isCoordinator: true, canSearch: true, canExport: false },
    myDay: { absent: false, visits: [], next: [], obstacle: null, keys: [], money: [] },
    referrals: { referrals: [{ id: 'r1' }], canEditReferrals: false },
    ownName: { firstName: '', lastName: '', complete: false }
  });
  assert.deepEqual(who, { isCoordinator: true, canSearch: true, canExport: false, canEditReferrals: false, hasReferrals: true, writable: true, hasDay: false, needsName: true });
  assert.equal(deskViewer({}).needsName, false);
  for (const day of [{ absent: true }, { obstacle: { id: 'o1' } }, { visits: [{}] }, { keys: [{}] }, { money: [{}] }, { next: [{}] }]) assert.equal(hasOwnDay(day), true);
  assert.equal(hasOwnDay(null), false);
});

test('laua sõnad on kolmes keeles olemas', () => {
  const used = new Set();
  const collect = (key) => {
    used.add(key);
    return key;
  };
  for (const who of [{ ...coordinator, hasDay: true }, worker]) {
    for (const group of deskGroups(who, { t: collect, organizationId: 'org1' })) {
      for (const tile of group.tiles) assert.ok(tile.name && tile.line, tile.key);
    }
    for (const view of Object.keys(HOME_VIEWS)) viewName(view, who, { t: collect });
  }
  assert.equal(viewName('missing', worker, { t: collect }), '');
  for (const key of used) {
    for (const lang of LANGS) {
      const value = at(catalogs[lang], key);
      assert.ok(typeof value === 'string' && value.trim(), `${lang}: ${key}`);
    }
  }
});

test('avalehe vaate nimi mahub kiirmenüüsse', () => {
  /* Sama piir mis lehe nimedel (tests/home-care-org-shell.test.mjs): ladina 21, kirillitsas 19 tähte. */
  const limit = { et: 21, en: 21, ru: 19 };
  for (const lang of LANGS) {
    const say = (key) => at(catalogs[lang], key);
    for (const who of [coordinator, worker]) {
      for (const view of Object.keys(HOME_VIEWS)) {
        const name = viewName(view, who, { t: say });
        assert.ok(name.length <= limit[lang], `${lang}: ${view} „${name}” on ${name.length} tähte`);
      }
    }
  }
});

test('ükski koduteenuse vaade ei kanna tagasilinki paneelis', () => {
  for (const name of fs.readdirSync(path.join(root, 'components/homeCare'))) {
    if (!name.endsWith('.jsx')) continue;
    assert.ok(!read(`components/homeCare/${name}`).includes('hc-back'), name);
  }
});

test('kest viib osa alalehelt osa lauale ja kliendi alaleht kliendi lehele', () => {
  const shell = read('components/org/OrgPart.jsx');
  assert.match(shell, /const PART_DESK = Object\.freeze\(\{ home_care: "koduteenus" \}\);/);
  assert.match(shell, /const level = up \|\| \(partLabel && PART_DESK\[part\] \?/);
  assert.match(shell, /allLabel=\{upName\}/);
  /* Kliendi alalehed ütlevad oma taseme ise: üks tase üles on kliendi leht. */
  for (const view of ['HomeCareChronology', 'HomeCareDecisions', 'HomeCareDoorTag', 'HomeCarePlanEditor', 'HomeCareSlots']) {
    assert.match(read(`components/homeCare/${view}.jsx`), /up=\{\{ label: t\("home_care\.client\.page_name"\), href: clientHref/, view);
  }
});
