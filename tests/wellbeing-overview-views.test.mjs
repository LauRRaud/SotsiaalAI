// Tööheaolu „Ülevaade": vaadete tekstid on kataloogis ja leht ei trüki sisemisi nimesid.
//
// Leht oli üks pikk veerg vanal ühisel kihil; signaalide ja töövoogude nimed
// olid koodis eestikeelsete sõnedena ja soovitatud töövood trükiti sisemise
// nimega („hard-case"). Nüüd on see vaadetena sammulaval
// (components/wellbeing/overview/OverviewViews.jsx).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { wellbeingTools } from '../lib/wellbeingTools.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const catalog = (lang) => JSON.parse(read(`../messages/${lang}.json`));
const at = (node, key) => key.split('.').reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), node);
const SOURCES = ['../components/wellbeing/overview/OverviewViews.jsx', '../components/wellbeing/OverviewWorkflow.jsx'];
const VIEW_KEYS = ['summary', 'patterns', 'memo', 'next'];

test('vaadete tekstivõtmed on kataloogis kolmes keeles', () => {
  const keys = new Set();
  for (const source of SOURCES) {
    for (const match of read(source).matchAll(/\bt\(\s*"((?:wellbeing|chat)\.[a-z_.0-9]+)"/g)) keys.add(match[1]);
  }
  assert.ok(keys.size > 25, `võtmeid leiti ${keys.size}`);
  for (const lang of ['et', 'en', 'ru']) {
    const messages = catalog(lang);
    assert.deepEqual([...keys].filter((key) => typeof at(messages, key) !== 'string'), [], lang);
  }
});

test('igal vaatel on nimi ja lühinimi; perioodid ja signaalid, mida leht kokku paneb, on olemas', () => {
  for (const lang of ['et', 'en', 'ru']) {
    const wellbeing = catalog(lang).wellbeing;
    for (const key of VIEW_KEYS) {
      assert.ok(wellbeing.overview.views[key]?.title && wellbeing.overview.views[key]?.short, `${lang}: ${key}`);
      assert.ok(wellbeing.overview.views[key].short.length <= 18, `${lang}: ${key} lühinimi mahub kiirmenüüsse`);
    }
    for (const period of ['all', 'week', 'month']) assert.equal(typeof wellbeing.overview[`period_${period}`], 'string', `${lang}: ${period}`);
    for (const level of ['green', 'yellow', 'red', 'insufficient_data']) assert.equal(typeof wellbeing.my_records.signal_level[level], 'string', `${lang}: ${level}`);
  }
});

test('igal töövool, mida ülevaade võib soovitada, on nimi kataloogis ja tee', () => {
  /* Varem trükiti soovitatud töövoog sisemise nimega. Nimi tuleb nüüd kataloogist. */
  const forms = wellbeingTools.map((tool) => tool.id).filter((id) => id !== 'my-records' && id !== 'overview');
  assert.ok(forms.length >= 9);
  for (const lang of ['et', 'en', 'ru']) {
    const labels = catalog(lang).wellbeing.my_records.workflow;
    for (const id of forms) assert.equal(typeof labels[id.replaceAll('-', '_')], 'string', `${lang}: ${id}`);
    assert.equal(typeof at(catalog(lang), 'chat.workspace.cards.kovision.title'), 'string', lang);
  }
  for (const tool of wellbeingTools) assert.ok(tool.route.startsWith('/tooheaolu/'), tool.id);
});

test('leht ei ole enam vanal ühisel kihil ega kanna eestikeelseid silte koodis', () => {
  const page = read('../components/wellbeing/OverviewWorkflow.jsx');
  assert.ok(!page.includes('<li key={workflowType}>{workflowType}</li>'), 'töövoo sisemist nime ei trükita');
  assert.ok(!/const (signalLabels|workflowLabels) = \{/.test(page), 'sildid ei ole koodis sõnedena');
  assert.ok(!page.includes('role="status"'), 'teated ei kasuta status-rolli');
  const shell = read('../components/wellbeing/WellbeingPage.jsx');
  const staged = shell.slice(shell.indexOf('const STAGED_TOOLS'), shell.indexOf(']);', shell.indexOf('const STAGED_TOOLS')));
  assert.ok(staged.includes('"overview"'), 'leht joonistab end ise, ilma vana `wellbeing-workflow` kihita');
  assert.ok(shell.includes('<OverviewWorkflow onNavigate={navigate} />'), 'soovitatud töövoog viib oma lehele');
});
