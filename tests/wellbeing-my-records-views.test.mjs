// Tööheaolu „Minu kirjed": vaadete tekstid on kataloogis ja leht hoiab oma lubadusi.
//
// Leht oli üks pikk veerg vanal ühisel kihil; nüüd on see vaadetena sammulaval
// (components/wellbeing/records/RecordsViews.jsx). Test hoiab seda, mida silm
// kergesti ei märka: puuduv tõlkevõti, nimeta vaade, ühe vajutusega kustutamine.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const catalog = (lang) => JSON.parse(read(`../messages/${lang}.json`));
const at = (node, key) => key.split('.').reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), node);
const SOURCES = ['../components/wellbeing/records/RecordsViews.jsx', '../components/wellbeing/MyRecordsWorkflow.jsx'];
const VIEW_KEYS = ['list', 'record', 'next', 'drafts', 'unfinished'];

test('vaadete tekstivõtmed on kataloogis kolmes keeles', () => {
  const keys = new Set();
  for (const source of SOURCES) {
    /* Ainult täielikud võtmed: mallisõnega kokku pandud võtmed kontrollib järgmine test. */
    for (const match of read(source).matchAll(/\bt\(\s*"(wellbeing\.[a-z_.0-9]+)"/g)) keys.add(match[1]);
  }
  assert.ok(keys.size > 40, `võtmeid leiti ${keys.size}`);
  for (const lang of ['et', 'en', 'ru']) {
    const messages = catalog(lang);
    assert.deepEqual([...keys].filter((key) => typeof at(messages, key) !== 'string'), [], lang);
  }
});

test('igal vaatel on nimi ja lühinimi kiirmenüü jaoks', () => {
  const page = read('../components/wellbeing/MyRecordsWorkflow.jsx');
  for (const key of VIEW_KEYS) assert.ok(page.includes(`"${key}"`), `leht kasutab vaadet ${key}`);
  for (const lang of ['et', 'en', 'ru']) {
    const views = catalog(lang).wellbeing.my_records.views;
    for (const key of VIEW_KEYS) {
      assert.ok(views[key]?.title && views[key]?.short, `${lang}: ${key}`);
      assert.ok(views[key].short.length <= 18, `${lang}: ${key} lühinimi mahub kiirmenüüsse`);
    }
    assert.ok(views.open && views.confirm_delete && views.list.lead && views.next.change, lang);
  }
});

test('filtrite, mustandi seisu ja kontrollpunkti vastuse võtmed, mida leht kokku paneb, on olemas', () => {
  for (const lang of ['et', 'en', 'ru']) {
    const wellbeing = catalog(lang).wellbeing;
    for (const period of ['all', 'week', 'month']) assert.equal(typeof wellbeing.my_records[`filter_period_${period}`], 'string', `${lang}: ${period}`);
    for (const status of ['draft', 'ready_to_share', 'in_covision']) assert.equal(typeof wellbeing.my_records.draft_status[status], 'string', `${lang}: ${status}`);
    for (const state of ['kept', 'not_kept', 'unclear']) assert.equal(typeof wellbeing.checkpoint.follow_up[state], 'string', `${lang}: ${state}`);
  }
});

test('kustutamine küsib teist vajutust ja leht ei ole enam vanal ühisel kihil', () => {
  const page = read('../components/wellbeing/MyRecordsWorkflow.jsx');
  assert.ok(page.includes('armConfirm("record")') && page.includes('armConfirm("record-drafts")'), 'kirje kustutamine kahe vajutusega');
  assert.ok(page.includes('armConfirm(draft.id)'), 'mustandi kustutamine kahe vajutusega');
  assert.ok(!page.includes('role="status"'), 'teated ei kasuta status-rolli (ühine kiht joonistab selle kastina)');
  const shell = read('../components/wellbeing/WellbeingPage.jsx');
  const staged = shell.slice(shell.indexOf('const STAGED_TOOLS'), shell.indexOf(']);', shell.indexOf('const STAGED_TOOLS')));
  assert.ok(staged.includes('"my-records"'), 'leht joonistab end ise, ilma vana `wellbeing-workflow` kihita');
});
