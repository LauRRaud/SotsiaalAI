import test from 'node:test';
import assert from 'node:assert/strict';
import { PilotStore, PURGE_EVERY_MS } from '../lib/rag-v2/pilot/store.js';

// ADR-094, step 5: the purge ran first in every chat request; with 200 000 live rows one purge took 144 ms (06.10.2026).
test('a chat request purges at most once in the purge time; a failed purge is tried again by the next request', async () => {
  let purges = 0, broken = false;
  const store = new PilotStore({ m4PilotTurn: { deleteMany: async () => { if (broken) throw Error('database away'); purges += 1; return { count: 0 }; } } });
  // Times of this test's own, later than any purge this process may have made.
  const start = Date.now() + 10 * PURGE_EVERY_MS;
  assert.equal(await store.purgeDue(start), true);
  assert.equal(await store.purgeDue(start + 1), false);
  assert.equal(await new PilotStore(store.db).purgeDue(start + PURGE_EVERY_MS - 1), false, 'the time is the process\'s, not one store\'s');
  assert.equal(purges, 1);
  assert.equal(await store.purgeDue(start + PURGE_EVERY_MS), true);
  assert.equal(purges, 2);
  broken = true;
  await assert.rejects(store.purgeDue(start + 2 * PURGE_EVERY_MS), /database away/u);
  broken = false;
  assert.equal(await store.purgeDue(start + 2 * PURGE_EVERY_MS + 1), true, 'the failed purge did not use up the minute');
  assert.equal(purges, 3);
  // The purge itself is unconditional: the retention run and a test ask for it outright.
  await store.purge(); await store.purge();
  assert.equal(purges, 5);
});
