import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Runs the pilot page's own loadConversation/submit bodies with a stubbed API, state setters and
// browser storage, so the retry rule is checked on the shipped component code.
function harness({ failFirst = true } = {}) {
  const code = fs.readFileSync('app/rag-pilot/pilot-client.jsx', 'utf8');
  const load = code.slice(code.indexOf('  async function loadConversation('), code.indexOf('  useEffect(() => { let active = true;'));
  const submit = code.slice(code.indexOf('  async function submit('), code.indexOf('  async function showSource('));
  assert(load.startsWith('  async function loadConversation(') && submit.startsWith('  async function submit('));
  const requests = [], saved = new Map();
  let fail = failFirst, keys = 0;
  const sandbox = { convId: 'conversation-A', question: 'Question A', contextMode: 'new', locale: 'et', dialogue: { enabled: false },
    pending: { current: null }, submitting: { current: false }, shown: { current: '' },
    crypto: { randomUUID: () => `key-${++keys}` }, window: { history: { replaceState() {} } },
    sessionStorage: { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) },
    setTurns() {}, setSource() {}, setBusy() {}, setError() {}, setQuestion: value => { sandbox.question = value; }, setConvId: value => { sandbox.convId = value; },
    api: async (url, body) => {
      if (url === '/api/chat') {
        requests.push(structuredClone(body));
        if (fail) { fail = false; throw Error('synthetic transport failure'); }
        return { state: 'completed' };
      }
      return { turns: [] };
    } };
  vm.runInNewContext(`${load}\n${submit}\nglobalThis.handlers = { loadConversation, submit };`, sandbox, { timeout: 1000 });
  return { sandbox, requests, saved, submit: () => sandbox.handlers.submit({ preventDefault() {} }) };
}

test('after a failed send, another conversation sends its own question with its own intent key', async () => {
  const { sandbox, requests, saved, submit } = harness();
  await submit();
  await sandbox.handlers.loadConversation('conversation-B');
  sandbox.question = 'Question B';
  await submit();
  assert.equal(requests.length, 2);
  assert.deepEqual([requests[1].convId, requests[1].question], ['conversation-B', 'Question B']);
  assert.notEqual(requests[1].clientTurnKey, requests[0].clientTurnKey);
  assert.equal(saved.get('m4-intent/conversation-A'), requests[0].clientTurnKey, 'conversation A keeps its failed intent key');
});

test('the same failed question retries with the same intent key; a changed question gets a new one', async () => {
  const { sandbox, requests, submit } = harness();
  await submit();
  const retry = harness();
  await retry.submit();
  retry.sandbox.question = 'Question A';
  await retry.submit();
  assert.equal(retry.requests[1].clientTurnKey, retry.requests[0].clientTurnKey);
  sandbox.question = 'Question A, reworded';
  await submit();
  assert.notEqual(requests[1].clientTurnKey, requests[0].clientTurnKey);
  assert.equal(requests[1].question, 'Question A, reworded');
});
