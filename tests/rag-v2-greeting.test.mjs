import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { loneGreeting } from '../lib/rag-v2/pilot/greeting.js';
import { checkTurn, validateCatalogue } from '../lib/rag-v2/pilot/conversation-eval.js';

// ADR-067: a message that is only a greeting takes the turn's short route; anything more is a request.
test('a lone greeting is recognised with its language, whatever its case, punctuation or emoji', () => {
  const language = Object.fromEntries(['tere', 'Tere!', '  TERE  ', 'Tere-tere', 'tere, tere!', 'Tere hommikust', 'Hei', 'hei hei 👋', 'Tsau', 'Tšau!', 'Tervist.',
    'Hello', 'hi!', 'Hey there', 'Good morning', 'Привет', 'Здравствуйте!', 'Добрый день'].map(text => [text, loneGreeting(text)]));
  assert.deepEqual(language, { tere: 'et', 'Tere!': 'et', '  TERE  ': 'et', 'Tere-tere': 'et', 'tere, tere!': 'et', 'Tere hommikust': 'et', Hei: 'et', 'hei hei 👋': 'et',
    Tsau: 'et', 'Tšau!': 'et', 'Tervist.': 'et', Hello: 'en', 'hi!': 'en', 'Hey there': 'en', 'Good morning': 'en', Привет: 'ru', 'Здравствуйте!': 'ru', 'Добрый день': 'ru' });
});

test('a greeting with anything else in it, a thanks, an answer to a question or a non-string is no lone greeting', () => {
  for (const text of ['Tere! Mul on suured võlad, kes aitab?', 'tere, kuidas taotleda toimetulekutoetust', 'Tere Luna', 'aitäh', 'jah', 'ei', 'ok', 'Elan Kose vallas', 'tere 2',
    'terekesttere', 'hi5', '', '   ', '?', `tere ${'!'.repeat(80)}`, null, undefined, 42, ['tere']]) assert.equal(loneGreeting(text), null, JSON.stringify(text));
});

test('the evaluation catalogue for greetings is valid, and the greeting route is a search check either way', async () => {
  const catalogue = JSON.parse(await fs.readFile('tests/evaluation/dialogue/scenarios-greeting-1.json', 'utf8'));
  assert.deepEqual(validateCatalogue(catalogue), []);
  // Every first message of the catalogue is read by the server as its expectation says.
  for (const scenario of catalogue.scenarios) {
    const first = scenario.turns[0];
    assert.equal(loneGreeting(first.text) !== null, first.expect.greeting, scenario.id);
  }
  assert.deepEqual(validateCatalogue({ scenarios: [{ id: 'x', turns: [{ mode: 'new', text: 'tere', expect: { greeting: 'yes' } }] }] }), ['x turn 1: greeting is true or false']);
  const observed = { state: 'completed', text: 'Tere! Kuidas saan sind aidata?', summaries: [], details: [], evidenceTitles: [], found: [], cited: [], facts: [], dropped: [] };
  const check = (expect, greeting) => checkTurn(expect, { ...observed, greeting }, { today: '2026-10-02' }).checks.find(item => item.key === 'greeting');
  assert.deepEqual([check({ greeting: true }, true).ok, check({ greeting: true }, false).ok, check({ greeting: false }, false).ok, check({ greeting: false }, true).ok, check({ greeting: true }, false).kind],
    [true, false, true, false, 'search']);
});
