import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { checkTurn, validateCatalogue } from '../lib/rag-v2/pilot/conversation-eval.js';

// The whole-conversation evaluation names what failed in a turn: search, answer or the conversation state.
const observed = (extra = {}) => ({ state: 'completed', error: null, crisis: false, region: 'harku_vald', previousStateCleared: null,
  summaries: ['Toimetulekutoetus'], details: [], contacts: 0, evidenceTitles: ['Haldusmenetluse seadus', 'Harku valla sotsiaalhoolekande kord'],
  cited: [{ title: 'Haldusmenetluse seadus', documentId: 'hms-2024' }], text: 'Esita vaie 30 päeva jooksul. [S1]', clarification: false, ...extra });
const validity = id => ({ 'hms-2024': { from: '2024-01-01', to: '2026-12-31' }, 'shs-feb-2027': { from: '2027-02-01', to: '2027-03-31' } })[id] || null;

test('the catalogue has known expectations, modes and a new start for every conversation', async () => {
  const catalogue = JSON.parse(await fs.readFile('tests/evaluation/dialogue/scenarios-corpus-1.json', 'utf8'));
  assert.deepEqual(validateCatalogue(catalogue), []);
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
  assert.equal(on('2027-03-01', [{ title: 'Sotsiaalhoolekande seadus', documentId: 'shs-feb-2027' }]).verdict, 'passed');
  const wrong = on('2027-06-01', [{ title: 'Sotsiaalhoolekande seadus', documentId: 'shs-feb-2027' }]);
  assert.equal(wrong.verdict, 'answer');
  assert.match(wrong.checks.find(check => check.key === 'valid_on').detail, /not in force on 2027-06-01: Sotsiaalhoolekande seadus 2027-02-01..2027-03-31/);
  assert.equal(on('today', [{ title: 'Harku kord', documentId: 'municipal' }]).verdict, 'passed');
  assert.equal(checkTurn({ must_not: ['Kose'], clarification: true }, observed({ text: 'Kose vallas', clarification: false }), { today: '2026-09-28' }).checks
    .filter(check => !check.ok).map(check => check.key).join(), 'must_not,clarification');
});
