import test from "node:test";
import assert from "node:assert/strict";
import { loadPeerServiceMapEntries } from "../../lib/serviceMap/peerAccess.js";

test("anonymous peer capability is independent of hidden row existence", async () => {
  let calls = 0;
  const loader = async () => { calls += 1; return [{ id: "secret" }]; };
  const zero = await loadPeerServiceMapEntries({ loadHelpEntries: loader });
  const existing = await loadPeerServiceMapEntries({ loadHelpEntries: loader });
  assert.deepEqual(zero, existing);
  assert.deepEqual(zero, { entries: [], page: null, peerListingsAvailable: false, peerListingsAccess: "AUTH_REQUIRED" });
  assert.equal(calls, 0);
});

test("authenticated capability stays true for zero and existing results", async () => {
  const zero = await loadPeerServiceMapEntries({ userId: "user", loadHelpEntries: async () => [] });
  const existing = await loadPeerServiceMapEntries({ userId: "user", loadHelpEntries: async () => [{ id: "own-safe" }] });
  assert.equal(zero.peerListingsAvailable, true);
  assert.equal(existing.peerListingsAvailable, true);
  assert.deepEqual(existing.entries, [{ id: "own-safe" }]);
});
