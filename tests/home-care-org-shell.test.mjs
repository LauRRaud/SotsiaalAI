// Koduteenuse lehed organisatsiooni kestas.
//
// Koduteenuse lehed kandsid viimasena vana päist (organisatsiooni nimi, seisu rida
// ja kuni 13 lingiga rida): umbes 220 px 522 px paneelist enne sisu algust. Nüüd
// kannab iga leht sama kesta mis organisatsiooni teised osad
// (components/org/OrgPart.jsx): kiirmenüüs on organisatsiooni nimi ja lehe nimi.
// Test hoiab, et uus leht ei jääks kestata ja et lehe nimi mahuks kiirmenüüsse.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const LANGS = ['et', 'en', 'ru'];
const catalogs = Object.fromEntries(LANGS.map((lang) => [lang, JSON.parse(read(`messages/${lang}.json`))]));
const at = (node, key) => key.split('.').reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), node);

/* Kõik vaatega lehed kaustas app/org/[orgId]/koduteenus ja vaade, mille leht joonistab. */
function pages(dir = 'app/org/[orgId]/koduteenus') {
  const found = [];
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const file = `${dir}/${entry.name}`;
    if (entry.isDirectory()) found.push(...pages(file));
    else if (entry.name === 'page.jsx') found.push(file);
  }
  return found;
}
const viewOf = (page) => read(page).match(/from "@\/components\/homeCare\/(HomeCare\w+)"/)?.[1];

test('iga koduteenuse leht joonistab vaate, mis kannab organisatsiooni kesta', () => {
  const list = pages();
  assert.ok(list.length >= 23, `lehti ${list.length}`);
  for (const page of list) {
    const view = viewOf(page);
    assert.ok(view, `${page}: vaade kaustast components/homeCare`);
    const source = read(`components/homeCare/${view}.jsx`);
    assert.ok(source.includes('import OrgPart from "@/components/org/OrgPart";'), `${view}: kest`);
    /* Iga `return (` selles failis, mis joonistab lehe (`hc-shell`), on kesta sees. */
    const shells = source.match(/<section className="hc-shell">/g) || [];
    const parts = source.match(/<OrgPart context=\{context\} part="home_care"/g) || [];
    /* Avaleht on laud ja selle vaated on uuel kujul: vana kihi lehe ümbrist seal ei ole, kest on. */
    if (view === 'HomeCareHome') assert.ok(shells.length === 0 && parts.length >= 1, `${view}: lehti ${shells.length}, kesti ${parts.length}`);
    else assert.ok(shells.length > 0 && shells.length === parts.length, `${view}: lehti ${shells.length}, kesti ${parts.length}`);
    /* Lehe pealkiri (h1) tuleb kestast; vaade ise teist ei lisa. */
    assert.ok(!/<h1[\s>]/.test(source), `${view}: h1`);
  }
});

test('vana päist ja lingirida ei ole enam olemas', () => {
  for (const file of ['components/org/OrgHeader.jsx', 'components/org/OrgNav.jsx', 'app/styles/org-workspace.css']) {
    assert.ok(!fs.existsSync(path.join(root, file)), file);
  }
  for (const name of fs.readdirSync(path.join(root, 'components/homeCare'))) {
    if (!name.endsWith('.jsx')) continue;
    assert.ok(!/OrgHeader|OrgNav|ow-shell/.test(read(`components/homeCare/${name}`)), name);
  }
});

test('lehe nimi kiirmenüüs on kolmes keeles olemas ja mahub ära', () => {
  /* Kiirmenüü näitab osa nimest 12 rem (mõõdetud 1536 × 640: ladina tähti umbes 21, kirillitsas
     umbes 19); pikem nimi lõigatakse poolelt sõnalt. */
  const LIMIT = { et: 21, en: 21, ru: 19 };
  const keys = new Set(['org.nav.home_care']);
  for (const page of pages()) {
    const source = read(`components/homeCare/${viewOf(page)}.jsx`);
    for (const match of source.matchAll(/part="home_care" partLabel=\{t\("([a-z_.]+)"\)\}/g)) keys.add(match[1]);
  }
  /* Avaleht kannab osa enda nime; igal teisel lehel on oma. */
  assert.ok(keys.size >= 23, `nimesid ${keys.size}`);
  for (const key of keys) {
    for (const lang of LANGS) {
      const value = at(catalogs[lang], key);
      assert.equal(typeof value, 'string', `${lang}: ${key}`);
      assert.ok(value.length > 0 && value.length <= LIMIT[lang], `${lang}: ${key} = „${value}” (${value.length} tähte, lubatud ${LIMIT[lang]})`);
      assert.ok(!/\{\w+\}/.test(value), `${lang}: ${key} ei tohi oodata muutujat`);
    }
  }
});
