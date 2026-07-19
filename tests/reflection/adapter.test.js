import assert from "node:assert/strict";
import test from "node:test";

import {
  listWorkspaces,
  toPracticeReflectionDescriptor
} from "../../lib/workspaces/adapters/practiceReflectionAdapter.js";

/* Adapter loeb AINULT updatedAt-i (`select: { updatedAt: true }`). Fake jäljendab
   seda: kui adapter küsiks rohkem, kukuks sisutuse test allpool. */
function fakeDb(rowsByOwner = {}) {
  return {
    practiceReflection: {
      findFirst: async ({ where = {}, select } = {}) => {
        const rows = rowsByOwner[where.ownerUserId] || [];
        if (!rows.length) return null;
        const latest = rows.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b));
        if (select?.updatedAt) return { updatedAt: latest.updatedAt };
        return { ...latest };
      }
    }
  };
}

test("adapter is owner-only: a foreign viewer (admin included) gets []", async () => {
  const db = fakeDb({ user_1: [{ updatedAt: new Date("2026-07-19T10:00:00Z") }] });
  const foreign = await listWorkspaces("admin_user", { db });
  assert.deepEqual(foreign, []);
  const anonymous = await listWorkspaces("", { db });
  assert.deepEqual(anonymous, []);
});

test("empty space (0 reflections) yields [] — existence of the space itself leaks nothing", async () => {
  const db = fakeDb({});
  assert.deepEqual(await listWorkspaces("user_1", { db }), []);
});

test("descriptor is contentless: timestamps and lifecycle only, no method/outcome/count", async () => {
  const db = fakeDb({ user_1: [
    { updatedAt: new Date("2026-07-18T08:00:00Z") },
    { updatedAt: new Date("2026-07-19T10:00:00Z") }
  ] });
  const [descriptor] = await listWorkspaces("user_1", { db });
  assert.equal(descriptor.ref.kind, "practice_reflection");
  assert.equal(descriptor.ownerId, "user_1");
  assert.equal(descriptor.visibility, "PRIVATE");
  assert.equal(descriptor.lastMeaningfulActivityAt, "2026-07-19T10:00:00.000Z");

  /* Anti-jälgimine (doc ptk 3.6 p3): descriptor EI kanna kirjete ARVU, meetodit,
     tulemit ega muud sisu. Serialiseeritud kujul ei tohi leiduda ühtegi
     sisuvälja — see test kukub, kui keegi lisab descriptorile "count" vms. */
  const serialized = JSON.stringify(descriptor);
  for (const forbidden of ["method", "outcome", "observation", "interpretation", "count"]) {
    assert.equal(serialized.toLowerCase().includes(forbidden), false, `descriptor leaked: ${forbidden}`);
  }
});

test("descriptor builder rejects a missing owner id via the shared validator", () => {
  assert.throws(() => toPracticeReflectionDescriptor({ userId: "", lastActivityAt: Date.now() }));
});
