import test from 'node:test';
import assert from 'node:assert/strict';
import { pilotExchange, readPilotStream } from '../lib/chat/m4PilotStream.js';
import { createSSEReader } from '../components/chat/utils/sse.js';

// ADR-040, the browser's side: provisional text while the answer is written, then only the 'done' reply counts. A lost
// stream asks again with the same request; a user's abort stops everything.
// The received bytes first; a network error, like a real one, only on the next read.
const stream = (events, { error = null } = {}) => {
  let sent = false;
  return new Response(new ReadableStream({ pull(controller) {
    if (!sent) { sent = true; controller.enqueue(new TextEncoder().encode(events.map(([event, data]) => `event: ${event}\ndata: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`).join(''))); return; }
    if (error) controller.error(error); else controller.close();
  } }), { headers: { 'content-type': 'text/event-stream' } });
};
const reply = { status: 200, body: { ok: true, answer: 'Vaide esitad 30 päeva jooksul. [S1]', completionStatus: 'COMPLETED' } };
const exchange = (responses, extra = {}) => {
  const shown = [], restarts = [];
  let sent = 0;
  const run = pilotExchange(async () => responses[sent++], { createReader: createSSEReader, waitMs: 0, onText: text => shown.push(text), onRestart: () => restarts.push(shown.length), ...extra });
  return { run, shown, restarts, sent: () => sent };
};

test('a stream shows its text and returns the done reply', async () => {
  const shown = [];
  const done = await readPilotStream(stream([['delta', { t: 'Vaide esitad ' }], [': comment', ''], ['delta', { t: '30 päeva jooksul.' }], ['done', reply]]).body,
    { createReader: createSSEReader, onText: text => shown.push(text) });
  assert.deepEqual(done, reply);
  assert.equal(shown.join(''), 'Vaide esitad 30 päeva jooksul.');
});

test('a lost stream is asked again with the same request; the text shown so far stays until new text arrives', async () => {
  // The first stream breaks before 'done'; the reconnect only waits for the saved turn and sends 'done'.
  const waited = exchange([stream([['delta', { t: 'Vaide esitad ' }]], { error: new TypeError('network error') }), stream([['done', reply]])]);
  const result = await waited.run;
  assert.deepEqual([result.done, result.lost, waited.sent()], [reply, false, 2]);
  assert.deepEqual([waited.shown.join(''), waited.restarts], ['Vaide esitad ', []]);
  // A cut final event counts as lost too; a reconnect that writes the answer again replaces the old text first.
  const fresh = exchange([stream([['delta', { t: 'Vana ' }], ['done', '{"status":2']]), stream([['delta', { t: 'Uus.' }], ['done', reply]])]);
  const again = await fresh.run;
  assert.deepEqual(again.done, reply);
  assert.deepEqual([fresh.shown, fresh.restarts], [['Vana ', 'Uus.'], [1]]);
});

test('every attempt lost ends as lost; a reply that is not a stream is returned as it is', async () => {
  const lost = exchange([stream([['delta', { t: 'a' }]]), stream([]), stream([])]);
  const result = await lost.run;
  assert.deepEqual([result.done, result.lost, lost.sent()], [null, true, 3]);
  const limited = Response.json({ ok: false, code: 'rate_limited' }, { status: 429 });
  const json = await exchange([limited]).run;
  assert.deepEqual([json.response.status, json.done, json.lost], [429, null, false]);
});

test('the user stopping the answer is not a lost connection', async () => {
  const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
  await assert.rejects(exchange([stream([['delta', { t: 'a' }]], { error: abort })]).run, { name: 'AbortError' });
});
