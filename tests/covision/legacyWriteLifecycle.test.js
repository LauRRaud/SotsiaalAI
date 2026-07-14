import test from "node:test";
import assert from "node:assert/strict";

import { updateCovisionCase } from "../../lib/covision.js";
import { withCovisionLegacyWriteLock } from "../../lib/covisionLegacyWrite.js";

function makeDb() {
  const store = {
    locked: 0,
    case: {
      id: "case_1",
      ownerId: "owner_1",
      status: "ACTIVE",
      sessionState: { phase: "story_sharing" },
      closure: null
    },
    messages: [],
    summaries: [],
    patches: []
  };
  const db = {
    store,
    async $transaction(callback) { return callback(db); },
    async $executeRaw() { store.locked += 1; return 1; }
  };
  return db;
}

const auth = { userId: "owner_1", email: "owner@example.test" };
const findVisible = async (db, actor, id) => (
  id === db.store.case.id && actor.userId === db.store.case.ownerId
    ? structuredClone(db.store.case)
    : null
);

async function write(db, kind, marker) {
  return withCovisionLegacyWriteLock(db, auth, "case_1", findVisible, async (tx) => {
    tx.store[kind].push(marker);
    return marker;
  });
}

test("closure-first rejects legacy message and summary writes without side effects", async () => {
  for (const kind of ["messages", "summaries"]) {
    const db = makeDb();
    Object.assign(db.store.case, {
      status: "CLOSED",
      sessionState: { phase: "complete" },
      closure: { id: "closure_1" }
    });
    const error = await write(db, kind, "RAW_AFTER_CLOSE").then(() => null, (failure) => failure);
    assert.equal(error.status, 409);
    assert.deepEqual(db.store[kind], []);
    assert.equal(db.store.locked, 1);
  }
});

test("legacy-first then closure purge is deterministic and cannot recreate raw data", async () => {
  const db = makeDb();
  await write(db, "messages", "RAW_BEFORE_CLOSE");
  await write(db, "summaries", "RAW_SUMMARY_BEFORE_CLOSE");
  assert.equal(db.store.messages.length, 1);
  assert.equal(db.store.summaries.length, 1);

  Object.assign(db.store.case, {
    status: "CLOSED",
    sessionState: { phase: "complete" },
    closure: { id: "closure_1" }
  });
  db.store.messages.length = 0;
  db.store.summaries.length = 0;

  assert.equal((await write(db, "messages", "RAW_AFTER_CLOSE").then(() => null, (error) => error)).status, 409);
  assert.equal((await write(db, "summaries", "RAW_AFTER_CLOSE").then(() => null, (error) => error)).status, 409);
  assert.deepEqual(db.store.messages, []);
  assert.deepEqual(db.store.summaries, []);
});

test("a terminal no-session legacy row and a stale active precheck cannot be patched", async () => {
  for (const scenario of [{
    status: "CLOSED",
    sessionState: null,
    closure: null
  }, {
    status: "ARCHIVED",
    sessionState: null,
    closure: null
  }, {
    status: "ACTIVE",
    sessionState: { phase: "complete" },
    closure: { id: "closure_1" }
  }]) {
    const db = makeDb();
    const stalePrecheck = structuredClone(db.store.case);
    assert.equal(stalePrecheck.status, "ACTIVE");
    Object.assign(db.store.case, scenario);
    const error = await write(db, "patches", "RAW_PATCH_AFTER_CLOSE")
      .then(() => null, (failure) => failure);
    assert.equal(error.status, 409);
    assert.deepEqual(db.store.patches, []);
    assert.equal(db.store.locked, 1);
  }
});

test("updateCovisionCase performs its terminal guard after taking the shared lock", async () => {
  const store = {
    locked: 0,
    deleteWrites: 0,
    updateWrites: 0,
    case: {
      id: "case_1",
      ownerId: auth.userId,
      status: "ACTIVE",
      sessionState: null,
      closure: null,
      participants: []
    }
  };
  const db = {
    async $transaction(callback) { return callback(db); },
    async $executeRaw() {
      store.locked += 1;
      Object.assign(store.case, { status: "CLOSED" });
      return 1;
    },
    covisionCase: {
      async findFirst() { return structuredClone(store.case); },
      async update() { store.updateWrites += 1; }
    },
    covisionJourneyStep: { async deleteMany() { store.deleteWrites += 1; } },
    covisionParty: { async deleteMany() { store.deleteWrites += 1; } },
    covisionRiskFactor: { async deleteMany() { store.deleteWrites += 1; } },
    covisionParticipant: { async deleteMany() { store.deleteWrites += 1; } }
  };

  const error = await updateCovisionCase(auth, "case_1", {
    title: "Seda ei tohi salvestada",
    anonymityConfirmed: true
  }, { db }).then(() => null, (failure) => failure);
  assert.equal(error.status, 409);
  assert.equal(error.message, "covision.errors.case_read_only");
  assert.equal(store.locked, 1);
  assert.equal(store.deleteWrites, 0);
  assert.equal(store.updateWrites, 0);
});
