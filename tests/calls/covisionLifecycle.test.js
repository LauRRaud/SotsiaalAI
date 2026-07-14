import test from "node:test";
import assert from "node:assert/strict";

import { withCovisionCallMutationLock } from "../../lib/calls/covisionLifecycle.js";

const OWNER = { userId: "owner_1", email: "owner@example.test", isAdmin: false };

function makeDb() {
  const store = {
    locked: 0,
    covisionCase: {
      id: "case_1",
      ownerId: OWNER.userId,
      status: "ACTIVE",
      sessionState: { phase: "story_sharing" },
      closure: null,
      participants: []
    },
    calls: []
  };
  const db = {
    store,
    async $transaction(callback) { return callback(db); },
    async $executeRaw() { store.locked += 1; return 1; },
    covisionCase: {
      async findUnique({ where }) {
        return where.id === store.covisionCase.id ? structuredClone(store.covisionCase) : null;
      }
    },
    callSession: {
      async deleteMany({ where }) {
        const before = store.calls.length;
        store.calls = store.calls.filter((item) => (
          item.contextType !== where.contextType || item.contextId !== where.contextId
        ));
        return { count: before - store.calls.length };
      }
    }
  };
  return db;
}

function serviceFor(db) {
  return {
    async startContextCall({ contextType, contextId, userId }) {
      const call = { id: `call_${db.store.calls.length + 1}`, contextType, contextId, userId };
      db.store.calls.push(call);
      return structuredClone(call);
    }
  };
}

async function start(db, access = OWNER) {
  return withCovisionCallMutationLock({
    db,
    covisionCaseId: "case_1",
    access,
    createService: serviceFor,
    callback: ({ service, access: fresh }) => service.startContextCall({
      contextType: "COVISION",
      contextId: "case_1",
      userId: fresh.userId
    })
  });
}

test("closure-first and stale-precheck call mutations fail under the shared lock", async () => {
  for (const terminal of [
    { status: "CLOSED", closure: { id: "closure_1" } },
    { status: "ARCHIVED" },
    { status: "ACTIVE", sessionState: { phase: "complete" } }
  ]) {
    const db = makeDb();
    Object.assign(db.store.covisionCase, terminal);
    const error = await start(db).then(() => null, (failure) => failure);
    assert.equal(error.status, 409);
    assert.equal(error.message, "covision.errors.case_read_only");
    assert.equal(db.store.calls.length, 0);
    assert.equal(db.store.locked, 1);
  }
});

test("call-first ordering is deterministic and closure cleanup removes the call", async () => {
  const db = makeDb();
  const call = await start(db);
  assert.equal(call.id, "call_1");
  assert.equal(db.store.calls.length, 1);

  Object.assign(db.store.covisionCase, {
    status: "CLOSED",
    sessionState: { phase: "complete" },
    closure: { id: "closure_1" }
  });
  await db.callSession.deleteMany({ where: { contextType: "COVISION", contextId: "case_1" } });
  assert.equal(db.store.calls.length, 0);
  assert.equal((await start(db).then(() => null, (failure) => failure)).status, 409);
});

test("a bound stale email does not become call access inside the lock", async () => {
  const db = makeDb();
  db.store.covisionCase.ownerId = "other_owner";
  db.store.covisionCase.participants = [{
    userId: "former_account",
    email: "reused@example.test",
    role: "CO_MODERATOR",
    inviteStatus: "ACCEPTED"
  }];
  const error = await start(db, {
    userId: "new_account",
    email: "reused@example.test",
    isAdmin: false
  }).then(() => null, (failure) => failure);
  assert.equal(error.status, 404);
  assert.equal(db.store.calls.length, 0);
});

test("terminal cleanup is an idempotent no-op under the shared lock", async () => {
  const db = makeDb();
  db.store.covisionCase.status = "CLOSED";
  let callbackRuns = 0;
  const result = await withCovisionCallMutationLock({
    db,
    covisionCaseId: "case_1",
    access: OWNER,
    createService: serviceFor,
    callback: async () => {
      callbackRuns += 1;
      db.store.calls.push({ id: "forbidden_write" });
      return { terminal: false };
    },
    onTerminal: () => ({ terminal: true })
  });
  assert.deepEqual(result, { terminal: true });
  assert.equal(callbackRuns, 0);
  assert.equal(db.store.calls.length, 0);
  assert.equal(db.store.locked, 1);
});
