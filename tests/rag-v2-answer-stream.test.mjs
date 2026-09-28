import test from 'node:test';
import assert from 'node:assert/strict';
import { answerTextStream, provisionalText } from '../lib/rag-v2/pilot/answer-stream.js';

// ADR-040: the provisional text of an answer the model is still writing is exactly what a reader will see of the
// complete answer (without references), however the JSON arrives in pieces.
const answers = [
  { kind: 'grounded', blocks: [{ text: 'Vaide esitad 30 päeva jooksul.', factual: true, refs: ['S1'] },
    { text: 'Otsus peab olema "põhjendatud"; vt ka § 54.\nTeine rida \\ kaldkriips ja 😀.', factual: true, refs: ['S2', 'S3'] }],
  limitations: ['Kohtu tähtaega siin ei ole.'], clarification: 'Millal said otsusest teada?' },
  { kind: 'unsupported', blocks: [], limitations: ['Allikad ei ütle hinda.'], clarification: null },
  { kind: 'clarification', blocks: [], limitations: [], clarification: 'Kas hooldatav on laps?',
    dialogue_state: { facts: [{ text: 'NOT VISIBLE', turn: 1 }], region: { id: null, status: 'unknown', support: [] }, clarification: 'NOT VISIBLE EITHER' } },
];
let seed = 7;
const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pieces = (text, most) => { const out = []; for (let i = 0; i < text.length;) { const n = 1 + Math.floor(random() * most); out.push(text.slice(i, i + n)); i += n; } return out; };

test('the provisional text equals the visible text of the complete answer for any split of its JSON', () => {
  for (const answer of answers) for (const json of [JSON.stringify(answer), JSON.stringify(answer, null, 2), JSON.stringify(answer).replace(/[ä-õ]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)]) {
    for (const most of [1, 3, 17, json.length]) {
      let shown = '';
      const stream = answerTextStream(text => { shown += text; });
      for (const piece of pieces(json, most)) stream.push(piece);
      assert.equal(shown, provisionalText(answer), `${answer.kind}, pieces up to ${most}`);
      assert.equal(stream.stopped, false);
    }
  }
});

test('escaped surrogate pairs arrive whole, and the text grows only by appending', () => {
  const json = '{"kind":"grounded","blocks":[{"text":"a\\ud83d\\ude00b","factual":true,"refs":["S1"]}],"limitations":[],"clarification":null}';
  const parts = [];
  const stream = answerTextStream(text => parts.push(text));
  for (const c of json) stream.push(c);
  assert.equal(parts.join(''), 'a😀b');
  assert(parts.every(part => !/^[\ud800-\udbff]$/.test(part)), 'no lone high surrogate is sent');
});

test('malformed or unexpected JSON stops the provisional text and never throws; a failing reader does not stop it', () => {
  for (const broken of ['{"blocks":[{"text":"ok"}]]]', '{"blocks":[{"text":"a\\q"}]}', '["text","x"]{', '{"blocks":[{"text":"a\u0001"}]}']) {
    let shown = '';
    const stream = answerTextStream(text => { shown += text; });
    assert.doesNotThrow(() => stream.push(broken));
    assert.equal(stream.stopped, true, broken);
    assert(!shown.includes('x'), broken);
  }
  let calls = 0;
  const stream = answerTextStream(() => { calls++; throw new Error('reader gone'); });
  const json = JSON.stringify(answers[0]);
  for (const piece of pieces(json, 5)) assert.doesNotThrow(() => stream.push(piece));
  assert(calls > 1);
  assert.equal(stream.stopped, false);
});
