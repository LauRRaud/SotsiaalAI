import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createPendingTurnRefresh, isTransientStatus, PENDING_REFRESH_MS, PENDING_REFRESH_TRIES } from '../lib/chat/pendingTurnRefresh.js';
import { createRequestGeneration } from '../lib/chat/requestGeneration.js';

// Codex R3 (#288): a window that loaded a conversation mid-answer looks at the turn again while the server still
// answers it. One HTTP 503 or network error used to leave no timer, so "Pooleliolev katse" stayed until a focus event.
// A fake timer drives the order; nothing waits for real time.
const fakeTimer = () => {
  const timers = new Map();
  let next = 0;
  return {
    setTimer: (run, ms) => { timers.set(++next, { run, ms }); return next; },
    clearTimer: id => { timers.delete(id); },
    get size() { return timers.size; },
    get id() { return [...timers.keys()][0]; },
    fire() {
      assert.equal(timers.size, 1);
      const [[id, { run, ms }]] = timers;
      assert.equal(ms, PENDING_REFRESH_MS);
      timers.delete(id);
      run();
    }
  };
};

// The hook's decisions, one reply per look: 'PENDING' and 'COMPLETED' are successful replies, anything else failed.
const chain = replies => {
  const timer = fakeTimer();
  const refresh = createPendingTurnRefresh(timer);
  let asked = 0;
  const look = () => {
    const reply = replies[asked++];
    if (reply === 'PENDING') refresh.pending(look);
    else if (reply === 'COMPLETED') refresh.settled();
    else refresh.failed(look);
  };
  return { timer, refresh, look, asked: () => asked };
};

test('PENDING → 503 → COMPLETED: the failed look is tried again and the finished turn ends the chain', () => {
  const { timer, refresh, look, asked } = chain(['PENDING', 503, 'COMPLETED']);
  look();
  assert.deepEqual([timer.size, refresh.tries], [1, 1]);
  timer.fire();
  assert.deepEqual([asked(), timer.size, refresh.tries], [2, 1, 2]);
  timer.fire();
  assert.deepEqual([asked(), timer.size, refresh.tries, refresh.scheduled], [3, 0, 0, false]);
});

test('PENDING → network error → PENDING → COMPLETED keeps looking until the turn is done', () => {
  const { timer, refresh, look, asked } = chain(['PENDING', 'network', 'PENDING', 'COMPLETED']);
  look();
  for (const tries of [2, 3]) {
    timer.fire();
    assert.deepEqual([timer.size, refresh.tries], [1, tries]);
  }
  timer.fire();
  assert.deepEqual([asked(), timer.size, refresh.tries], [4, 0, 0]);
});

test('PENDING and failed looks share one budget of 45 tries; a settled turn starts it again', () => {
  assert.equal(PENDING_REFRESH_TRIES, 45);
  const { timer, refresh, look, asked } = chain(Array.from({ length: 60 }, (_, i) => (i % 3 === 1 ? 503 : 'PENDING')));
  look();
  for (let i = 1; i < PENDING_REFRESH_TRIES; i += 1) timer.fire();
  assert.deepEqual([asked(), timer.size, refresh.tries], [45, 1, 45]);
  timer.fire();
  assert.deepEqual([asked(), timer.size, refresh.tries], [46, 0, 45]);
  assert.deepEqual([refresh.pending(look), refresh.failed(look), timer.size], [false, false, 0]);
  refresh.settled();
  assert.deepEqual([refresh.pending(look), refresh.tries, timer.size], [true, 1, 1]);
});

test('at the end of the budget the last counted look stays scheduled; a later failure or PENDING does not drop it', () => {
  const { timer, refresh, look } = chain(Array.from({ length: 50 }, () => 'PENDING'));
  look();
  for (let i = 1; i < PENDING_REFRESH_TRIES; i += 1) timer.fire();
  const lastLook = timer.id;
  assert.deepEqual([refresh.tries, timer.size], [45, 1]);
  assert.deepEqual([refresh.failed(look), refresh.pending(look), timer.size, timer.id], [false, false, 1, lastLook]);
});

test('only a passing HTTP error is tried again: 5xx, 408 and 429', () => {
  assert.deepEqual([500, 502, 503, 504, 408, 429].map(isTransientStatus), [true, true, true, true, true, true]);
  assert.deepEqual([400, 401, 403, 404, 410].map(isTransientStatus), [false, false, false, false, false]);
});

test('stop() clears the timer; a request that was in flight fails afterwards without scheduling', () => {
  const { timer, refresh, look } = chain(['PENDING']);
  look();
  refresh.stop();
  assert.deepEqual([timer.size, refresh.tries, refresh.scheduled], [0, 0, false]);
  assert.equal(refresh.failed(look), false);
  refresh.settled();
  assert.deepEqual([timer.size, refresh.tries], [0, 0]);
});

test('a failure outside a chain starts nothing: a focus refresh with nothing pending, or after the turn settled', () => {
  const { timer, refresh, look } = chain(['COMPLETED']);
  assert.equal(refresh.failed(look), false);
  look();
  assert.equal(refresh.failed(look), false);
  assert.deepEqual([timer.size, refresh.tries], [0, 0]);
});

test('a superseded look schedules nothing and leaves the newer look’s timer alone', () => {
  const { timer, refresh, look } = chain(['PENDING']);
  look();
  const newer = timer.id;
  assert.equal(refresh.failed(look, { superseded: true }), false);
  assert.deepEqual([timer.size, timer.id, refresh.tries], [1, newer, 1]);
});

// The hook's own hydrateFromServer on a fake fetch and the fake timer, as pilot-client-intent checks the shipped
// component: React is not rendered, the sandbox gives the callback its closure.
const hookSource = fs.readFileSync('components/chat/hooks/useChatConversationState.js', 'utf8').replace(/\r\n/gu, '\n');
const hook = replies => {
  const start = 'const hydrateFromServer = useCallback(';
  const from = hookSource.indexOf(start);
  const to = hookSource.indexOf('}, [normalizeSources, setIsCrisis, shouldPreserveLocalMessages, pilotEnabled, _t]);', from);
  assert(from > 0 && to > from);
  const timer = fakeTimer();
  const refresh = createPendingTurnRefresh(timer);
  const hydrateAgainRef = { current: null }, hydrationAbortRef = { current: null };
  let messages = [], asked = 0, last = null;
  const turn = completionStatus => ({ ok: true, json: async () => ({ ok: true, messages: [
    { role: 'user', text: 'Kas mul on õigus hooldajatoetusele?' }, { role: 'ai', text: '', completionStatus }] }) });
  const sandbox = {
    convIdRef: { current: 'conversation-A' }, EMPTY_CONVERSATION_READY_KEY: '__empty__', setServerHydratedConversationId() {},
    hydrationGenerationRef: { current: createRequestGeneration() }, hydrationAbortRef, AbortController,
    pendingRefreshRef: { current: refresh }, hydrateAgainRef, pilotEnabled: true, isGeneratingRef: { current: false }, isTransientStatus,
    window: { sessionStorage: {} }, scopeRef: { current: {} }, readActiveConversationId: () => 'conversation-A',
    normalizeSources: sources => sources, defaultNormalizeSources: sources => sources, setIsCrisis: undefined,
    messagesRef: { current: [] }, _t: key => key, messageIdRef: { current: 1 }, shouldPreserveLocalMessages: () => false,
    setMessages: update => { messages = update(messages); },
    fetch: async (_url, { signal }) => {
      const reply = replies[asked++];
      if (typeof reply === 'number') return { ok: false, status: reply };
      if (reply === 'not ok') return { ok: true, json: async () => ({ ok: false }) };
      if (reply === 'network') throw new TypeError('Failed to fetch');
      if (reply === 'aborted') return new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)));
      if (typeof reply === 'object') return reply.promise;
      return turn(reply);
    }
  };
  const hydrate = vm.runInNewContext(`(${hookSource.slice(from + start.length, to + 1)})`, sandbox);
  hydrateAgainRef.current = cancelledRef => (last = hydrate(cancelledRef));
  return { timer, refresh, hydrateAgainRef, hydrationAbortRef, asked: () => asked, last: () => last,
    status: () => messages.at(-1)?.completionStatus };
};

test('the hook: PENDING → 503 → COMPLETED, and PENDING → network error → ok: false → PENDING → COMPLETED', async () => {
  for (const replies of [['PENDING', 503, 'COMPLETED'], ['PENDING', 'network', 'not ok', 'PENDING', 'COMPLETED']]) {
    const run = hook(replies);
    await run.hydrateAgainRef.current({ current: false });
    assert.deepEqual([run.status(), run.timer.size, run.refresh.tries], ['PENDING', 1, 1]);
    while (run.timer.size) {
      run.timer.fire();
      await run.last();
    }
    assert.deepEqual([run.asked(), run.status(), run.refresh.tries], [replies.length, 'COMPLETED', 0]);
  }
});

test('the hook: a 404 (conversation deleted elsewhere) or 401 ends the chain instead of looking for three minutes', async () => {
  for (const status of [404, 401]) {
    const run = hook(['PENDING', status]);
    await run.hydrateAgainRef.current({ current: false });
    run.timer.fire();
    await run.last();
    assert.deepEqual([run.asked(), run.timer.size, run.refresh.tries], [2, 0, 0]);
  }
});

test('the hook: an aborted or superseded look schedules nothing; the newer look and unmount decide', async () => {
  // A focus refresh starts while the timer's look is in flight: the older one is aborted, the newer sees PENDING.
  const aborted = hook(['PENDING', 'aborted', 'PENDING']);
  const cancelledRef = { current: false };
  await aborted.hydrateAgainRef.current(cancelledRef);
  aborted.timer.fire();
  const older = aborted.last();
  await aborted.hydrateAgainRef.current(cancelledRef);
  await older;
  assert.deepEqual([aborted.asked(), aborted.timer.size, aborted.refresh.tries], [3, 1, 2]);

  // An older look's 503 arrives after the newer look scheduled its timer: that timer stays, no try is spent.
  let answer;
  const late = hook(['PENDING', { promise: new Promise(resolve => { answer = resolve; }) }, 'PENDING']);
  await late.hydrateAgainRef.current(cancelledRef);
  late.timer.fire();
  const slow = late.last();
  await late.hydrateAgainRef.current(cancelledRef);
  const newer = late.timer.id;
  answer({ ok: false, status: 503 });
  await slow;
  assert.deepEqual([late.timer.size, late.timer.id, late.refresh.tries], [1, newer, 2]);

  // Unmount (the effect's cleanup) while a look is in flight: nothing is left scheduled.
  const unmounted = hook(['PENDING', 'aborted']);
  const unmountedRef = { current: false };
  await unmounted.hydrateAgainRef.current(unmountedRef);
  unmounted.timer.fire();
  unmountedRef.current = true;
  unmounted.refresh.stop();
  unmounted.hydrationAbortRef.current.abort();
  await unmounted.last();
  assert.deepEqual([unmounted.timer.size, unmounted.refresh.tries], [0, 0]);
});
