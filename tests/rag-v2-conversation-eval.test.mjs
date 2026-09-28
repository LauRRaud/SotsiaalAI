import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { checkTurn, validateCatalogue } from '../lib/rag-v2/pilot/conversation-eval.js';

// The whole-conversation evaluation names what failed in a turn: search, answer or the conversation state.
const observed = (extra = {}) => ({ state: 'completed', error: null, crisis: false, region: 'harku_vald', previousStateCleared: null,
  summaries: ['Toimetulekutoetus'], details: [], contacts: 0, evidenceTitles: ['Haldusmenetluse seadus', 'Harku valla sotsiaalhoolekande kord'],
  cited: [{ title: 'Haldusmenetluse seadus', documentId: 'hms-2024' }], text: 'Esita vaie 30 päeva jooksul. [S1]', clarification: false, ...extra });
const validity = id => ({ 'hms-2024': { from: '2024-01-01', to: '2026-12-31' }, 'shs-feb-2027': { from: '2027-02-01', to: '2027-03-31' },
  'shs-now': { from: '2026-06-12', to: '2026-09-30' }, 'open-law': { from: '2020-01-01', to: null } })[id] || null;

test('the catalogue has known expectations, modes and a new start for every conversation', async () => {
  for (const version of [1, 2, 3, 4]) {
    const catalogue = JSON.parse(await fs.readFile(`tests/evaluation/dialogue/scenarios-corpus-${version}.json`, 'utf8'));
    assert.deepEqual(validateCatalogue(catalogue), [], `version ${version}`);
  }
  assert.deepEqual(validateCatalogue({ scenarios: [{ id: 'x', turns: [{ mode: 'same', text: 'a', expect: { wrong: 1, must: 'x', valid_on: 'soon' } }] }] }),
    ["x turn 1: a conversation starts with 'new'", 'x turn 1: unknown expectation wrong', 'x turn 1: must needs a list of patterns', 'x turn 1: valid_on soon']);
});

test('a missing source is a search failure, a wrong answer an answer failure, a wrong municipality a state failure', () => {
  const expect = { region: 'harku_vald', evidence: ['Haldusmenetluse seadus'], cited: ['Haldusmenetluse'], must: ['30 päeva'], valid_on: 'today' };
  assert.equal(checkTurn(expect, observed(), { today: '2026-09-28', validity }).verdict, 'passed');
  assert.equal(checkTurn(expect, observed({ evidenceTitles: ['Muu'], cited: [], text: 'Ei tea.' }), { today: '2026-09-28', validity }).verdict, 'search');
  assert.equal(checkTurn(expect, observed({ text: 'Esita vaie. [S1]' }), { today: '2026-09-28', validity }).verdict, 'answer');
  assert.equal(checkTurn(expect, observed({ region: 'kose_vald' }), { today: '2026-09-28', validity }).verdict, 'state');
  const failed = checkTurn({}, observed({ state: 'answer_rejected', error: 'invalid_answer_reference' }), { today: '2026-09-28' });
  assert.deepEqual([failed.verdict, failed.checks[0].detail], ['answer', 'invalid_answer_reference']);
});

test('a cited legal text must be in force on the asked date; sources without validity are not judged by date', () => {
  const on = (date, cited) => checkTurn({ valid_on: date }, observed({ cited }), { today: '2026-09-28', validity });
  const feb = { title: 'Sotsiaalhoolekande seadus', documentId: 'shs-feb-2027' }, now = { title: 'Sotsiaalhoolekande seadus', documentId: 'shs-now' };
  const other = { title: 'Haldusmenetluse seadus', documentId: 'hms-2024' };
  assert.equal(on('2027-03-01', [feb]).verdict, 'passed');
  const wrong = on('2027-06-01', [feb]);
  assert.equal(wrong.verdict, 'answer');
  assert.match(wrong.checks.find(check => check.key === 'valid_on').detail, /not in force on 2027-06-01: Sotsiaalhoolekande seadus 2027-02-01..2027-03-31/);
  assert.equal(on('today', [{ title: 'Harku kord', documentId: 'municipal' }]).verdict, 'passed');
  // Today's version of the same act beside the asked one (a comparison) is right; today's alone for 1 March 2027 is not.
  assert.equal(on('2027-03-01', [now, feb]).verdict, 'passed');
  assert.equal(on('2027-03-01', [now]).verdict, 'answer');
  // Codex review 28.09: another act in force on the date never vouches for a wrong version of the asked act.
  assert.equal(on('2026-09-28', [now, other]).verdict, 'passed');
  const vouched = on('2027-03-01', [now, { title: 'Teine seadus', documentId: 'open-law' }]);
  assert.equal(vouched.verdict, 'answer');
  assert.match(vouched.checks.find(check => check.key === 'valid_on').detail, /not in force on 2027-03-01: Sotsiaalhoolekande seadus 2026-06-12..2026-09-30$/);
  assert.equal(checkTurn({ must_not: ['Kose'], clarification: true }, observed({ text: 'Kose vallas', clarification: false }), { today: '2026-09-28' }).checks
    .filter(check => !check.ok).map(check => check.key).join(), 'must_not,clarification');
});

test('the search must find a version in force on the asked date: a found title of another version is a search failure', () => {
  const found = [{ title: 'Sotsiaalhoolekande seadus', documentId: 'hms-2024' }, { title: 'Harku kord', documentId: 'municipal' }];
  const turn = (date, extra) => checkTurn({ evidence: ['Sotsiaalhoolekande seadus'], found_valid_on: date }, observed({ evidenceTitles: ['Sotsiaalhoolekande seadus'], found, ...extra }),
    { today: '2026-09-28', validity });
  assert.equal(turn('today').verdict, 'passed');
  const missed = turn('2027-03-01');
  assert.equal(missed.verdict, 'search', 'the title matched, the version did not');
  assert.match(missed.checks.find(check => check.key === 'found_valid_on').detail, /found legal texts for 2027-03-01: Sotsiaalhoolekande seadus 2024-01-01..2026-12-31/);
  assert.equal(turn('2027-03-01', { found: [...found, { title: 'Sotsiaalhoolekande seadus', documentId: 'shs-feb-2027' }] }).verdict, 'passed');
  // Another found act in force on the date does not stand in for the expected one (Codex review 28.09).
  assert.equal(turn('2027-03-01', { found: [...found, { title: 'Teine seadus', documentId: 'open-law' }] }).verdict, 'search');
  // Without evidence patterns the cited ones name the expected act; without either, every found act is judged.
  const byCited = checkTurn({ cited: ['Sotsiaalhoolekande seadus'], found_valid_on: '2027-03-01' },
    observed({ found: [{ title: 'Sotsiaalhoolekande seadus', documentId: 'shs-now' }, { title: 'Teine seadus', documentId: 'open-law' }], cited: [] }), { today: '2026-09-28', validity });
  assert.equal(byCited.checks.find(check => check.key === 'found_valid_on').ok, false);
  assert.deepEqual(validateCatalogue({ scenarios: [{ id: 'x', turns: [{ mode: 'new', text: 'a', expect: { found_valid_on: 'March' } }] }] }), ['x turn 1: found_valid_on March']);
});

test('catalogue v4: an honest limit for a day without a legal text; an invented fee beside an unrelated doubt fails', async () => {
  const catalogue = JSON.parse(await fs.readFile('tests/evaluation/dialogue/scenarios-corpus-4.json', 'utf8'));
  const expect = catalogue.scenarios.find(scenario => scenario.id === 'law-on-dates').turns[3].expect;
  const verdict = text => checkTurn(expect, observed({ text, cited: [] }), { today: '2026-09-28', validity }).verdict;
  // The answers of runs 1-3 (docs/audits/rag-v2-conversation-eval-2026-09-28-run*.md).
  assert.equal(verdict('31. oktoobril 2026 kehtinud tasu ma selle teabe põhjal kinnitada ei saa.'), 'passed');
  assert.equal(verdict('30. oktoobrini oli lõiv 45 eurot. Ma ei saa siin kinnitada 31. oktoobril 2026 kehtinud riigilõivu.'), 'passed');
  assert.equal(verdict('Ma ei saa siin kinnitada, kui suur on ID-kaardi taotlemise riigilõiv 31. oktoobril 2026.'), 'passed');
  // v3 missed this honest answer of the ADR-046 run: 85 characters between the doubt and the day.
  assert.equal(verdict('Ma ei saa siin olemasoleva teabe põhjal kinnitada ID-kaardi taotlemise riigilõivu suurust 31. oktoobril 2026. aastal.'), 'passed');
  // Codex's negative example: a doubt about something else does not excuse an invented fee.
  assert.equal(verdict('31. oktoobril on tasu 999 eurot. Sinu pensioni suurust ei saa kinnitada.'), 'answer');
});
