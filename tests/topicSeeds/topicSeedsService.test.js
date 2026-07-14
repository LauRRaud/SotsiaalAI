import test from "node:test";
import assert from "node:assert/strict";

import {
  createTopicSeed,
  listTopicSeeds,
  getVisibleTopicSeed,
  normalizeTopicSeedQueueRequest,
  parseTopicSeedJsonBody,
  queueTopicSeed,
  serializeTopicSeed,
  topicSeedPublicError,
  updateTopicSeed
} from "../../lib/topicSeeds.js";

// A6.1 — TopicSeed owner-private persistent core: server-contract regressions.
// The role gate (requireCovisionRole) lives in lib/covision.js, which is a
// `server-only` module and cannot be imported into node:test; the 401/403 wiring
// is asserted in the route source-contract test instead.

const OWNER = "user_owner";
const OTHER = "user_other";
const ADMIN = "user_admin";

// Deterministic, strictly increasing clock so create/update timestamps differ.
function makeDb(initial = []) {
  let clock = Date.parse("2026-07-14T04:00:00.000Z");
  const tick = () => new Date((clock += 1000));
  const sameTime = (a, b) => new Date(a).getTime() === new Date(b).getTime();
  let counter = 0;
  const rows = initial.map((r) => ({ ...r }));
  return {
    rows,
    topicSeed: {
      async findMany({ where = {}, orderBy } = {}) {
        let out = rows.filter((r) => (where.ownerId ? r.ownerId === where.ownerId : true));
        if (orderBy) out = out.slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        return out.map((r) => ({ ...r }));
      },
      async findFirst({ where = {} } = {}) {
        const r = rows.find((row) =>
          row.id === where.id && (where.ownerId === undefined || row.ownerId === where.ownerId));
        return r ? { ...r } : null;
      },
      async findUnique({ where = {} } = {}) {
        const r = rows.find((row) => row.id === where.id);
        return r ? { ...r } : null;
      },
      async create({ data }) {
        const now = tick();
        const row = {
          id: `seed_${++counter}`,
          title: null, contextType: null, caseType: null, whyNow: null,
          requestedSupport: [], importance: null, safetyGate: null,
          status: "DRAFT", sharedCardSnapshot: null,
          ownerConfirmedAt: null, sharedAt: null,
          createdAt: now, updatedAt: now,
          ...data
        };
        rows.push(row);
        return { ...row };
      },
      async updateMany({ where = {}, data = {} }) {
        let count = 0;
        for (const row of rows) {
          const match =
            row.id === where.id &&
            (where.ownerId === undefined || row.ownerId === where.ownerId) &&
            (where.status === undefined || row.status === where.status) &&
            (where.updatedAt === undefined || sameTime(row.updatedAt, where.updatedAt));
          if (match) {
            Object.assign(row, data, { updatedAt: tick() });
            count += 1;
          }
        }
        return { count };
      }
    }
  };
}

const COMPLETE = Object.freeze({
  complete: true,
  title: "Katkendlik kooliskäimine",
  contextType: "child",
  caseType: "current",
  whyNow: "Puudumised on sagenenud.",
  requestedSupport: ["understanding", "perspectives"],
  importance: 8,
  safetyGate: "no_immediate_risk"
});

// --- create / validation ----------------------------------------------------

test("createTopicSeed: an allowed owner creates their own DRAFT", async () => {
  const db = makeDb();
  const seed = await createTopicSeed(OWNER, { ...COMPLETE }, { db });
  assert.equal(seed.ownerId, OWNER);
  assert.equal(seed.status, "DRAFT");
  assert.equal(seed.title, "Katkendlik kooliskäimine");
  assert.deepEqual(seed.requestedSupport, ["understanding", "perspectives"]);
});

test("createTopicSeed: client ownerId/status cannot forge ownership or state", async () => {
  const db = makeDb();
  const seed = await createTopicSeed(OWNER, { ...COMPLETE, ownerId: OTHER, status: "WAITING" }, { db });
  assert.equal(seed.ownerId, OWNER);
  assert.equal(seed.status, "DRAFT");
});

test("createTopicSeed: a partial draft is allowed only as a draft", async () => {
  const db = makeDb();
  const seed = await createTopicSeed(OWNER, { complete: false, title: "Pooleli", contextType: "adult" }, { db });
  assert.equal(seed.status, "DRAFT");
  assert.equal(seed.title, "Pooleli");
  assert.equal(seed.caseType, null);
});

test("createTopicSeed: a complete quick seed requires all §9 fields", async () => {
  const db = makeDb();
  const error = await createTopicSeed(OWNER, { complete: true, title: "Ilma väljadeta" }, { db })
    .then(() => null, (e) => e);
  assert.equal(error.status, 400);
  assert.equal(error.message, "topic_seeds.errors.incomplete");
  assert.equal(db.rows.length, 0);
});

test("createTopicSeed: invalid context/case/support/importance/gate are rejected", async () => {
  for (const bad of [
    { title: { text: "T" } },
    { whyNow: ["text"] },
    { contextType: "spy" },
    { contextType: { key: "child" } },
    { caseType: "whenever" },
    { requestedSupport: "understanding" },
    { requestedSupport: ["nonsense"] },
    { requestedSupport: ["understanding", "nonsense"] },
    { requestedSupport: ["understanding", 7] },
    { importance: 42 },
    { importance: 3.5 },
    { importance: true },
    { importance: "8" },
    { complete: "true" },
    { safetyGate: "cannot_wait" }
  ]) {
    const db = makeDb();
    const error = await createTopicSeed(OWNER, { complete: false, title: "T", ...bad }, { db })
      .then(() => null, (e) => e);
    assert.equal(error?.status, 400, `expected 400 for ${JSON.stringify(bad)}`);
    assert.equal(db.rows.length, 0);
  }
});

test("createTopicSeed: body must be a plain object", async () => {
  for (const body of [null, [], "seed", true]) {
    const db = makeDb();
    const error = await createTopicSeed(OWNER, body, { db }).then(() => null, (e) => e);
    assert.equal(error?.status, 400);
    assert.equal(error?.message, "topic_seeds.errors.invalid");
    assert.equal(db.rows.length, 0);
  }
});

test("createTopicSeed: duplicate valid support keys are deduplicated", async () => {
  const db = makeDb();
  const seed = await createTopicSeed(OWNER, {
    complete: false,
    requestedSupport: ["understanding", "understanding", "role"]
  }, { db });
  assert.deepEqual(seed.requestedSupport, ["understanding", "role"]);
});

test("parseTopicSeedJsonBody: malformed JSON and JSON null fail before any write", async () => {
  for (const request of [
    { async json() { throw new SyntaxError("bad json"); } },
    { async json() { return null; } },
    { async json() { return []; } }
  ]) {
    const db = makeDb();
    const error = await (async () => {
      const body = await parseTopicSeedJsonBody(request);
      return createTopicSeed(OWNER, body, { db });
    })().then(() => null, (e) => e);
    assert.equal(error?.status, 400);
    assert.equal(error?.message, "topic_seeds.errors.invalid");
    assert.equal(db.rows.length, 0);
  }
});

test("normalizeTopicSeedQueueRequest: queue body is strict", () => {
  assert.deepEqual(
    normalizeTopicSeedQueueRequest({ expectedUpdatedAt: "2026-07-14T04:00:00.000Z", confirmedNoIdentifiers: true }),
    { expectedUpdatedAt: "2026-07-14T04:00:00.000Z", confirmedNoIdentifiers: true }
  );
  for (const body of [null, [], { expectedUpdatedAt: 123 }, { confirmedNoIdentifiers: "true" }]) {
    assert.throws(
      () => normalizeTopicSeedQueueRequest(body),
      (error) => error?.status === 400 && error?.message === "topic_seeds.errors.invalid"
    );
  }
});

// --- ownership / visibility -------------------------------------------------

test("listTopicSeeds: an owner sees only their own seeds", async () => {
  const db = makeDb();
  await createTopicSeed(OWNER, { ...COMPLETE }, { db });
  await createTopicSeed(OTHER, { ...COMPLETE }, { db });
  const mine = await listTopicSeeds(OWNER, { db });
  assert.equal(mine.length, 1);
  assert.equal(mine[0].ownerId, OWNER);
});

test("getVisibleTopicSeed: a foreign and a missing seed both yield null (no-leak 404)", async () => {
  const db = makeDb();
  const seed = await createTopicSeed(OWNER, { ...COMPLETE }, { db });
  assert.equal(await getVisibleTopicSeed(OTHER, seed.id, { db }), null);
  assert.equal(await getVisibleTopicSeed(OWNER, "does_not_exist", { db }), null);
});

test("getVisibleTopicSeed: an admin (as a different user) cannot read a private seed by default", async () => {
  const db = makeDb();
  const seed = await createTopicSeed(OWNER, { ...COMPLETE }, { db });
  assert.equal(await getVisibleTopicSeed(ADMIN, seed.id, { db }), null);
});

// --- owner-only optimistic DRAFT edit --------------------------------------

test("updateTopicSeed: owner can update a DRAFT atomically without minting server fields", async () => {
  const db = makeDb();
  const seed = await createTopicSeed(OWNER, { complete: false, title: "Vana" }, { db });
  const updated = await updateTopicSeed(OWNER, seed.id, {
    expectedUpdatedAt: seed.updatedAt,
    title: "Uus",
    requestedSupport: ["role", "role"],
    ownerId: OTHER,
    status: "WAITING",
    sharedCardSnapshot: { forged: true }
  }, { db });
  assert.equal(updated.title, "Uus");
  assert.deepEqual(updated.requestedSupport, ["role"]);
  assert.equal(updated.ownerId, OWNER);
  assert.equal(updated.status, "DRAFT");
  assert.equal(updated.sharedCardSnapshot, null);
});

test("updateTopicSeed: foreign and missing ids both return generic 404", async () => {
  const db = makeDb();
  const seed = await seedFor(db);
  for (const [userId, id] of [[OTHER, seed.id], [OWNER, "missing"]]) {
    const error = await updateTopicSeed(userId, id, {
      expectedUpdatedAt: seed.updatedAt,
      title: "Ei tohi"
    }, { db }).then(() => null, (e) => e);
    assert.equal(error?.status, 404);
    assert.equal(error?.message, "api.common.not_found");
  }
  assert.equal(db.rows[0].title, COMPLETE.title);
});

test("updateTopicSeed: expectedUpdatedAt is mandatory and stale writes change nothing", async () => {
  for (const expectedUpdatedAt of [undefined, null, "not-a-date", "2020-01-01T00:00:00.000Z"]) {
    const db = makeDb();
    const seed = await seedFor(db);
    const error = await updateTopicSeed(OWNER, seed.id, {
      expectedUpdatedAt,
      title: "Ei tohi"
    }, { db }).then(() => null, (e) => e);
    assert.equal(error?.status, 409);
    assert.equal(error?.message, "topic_seeds.errors.edit_conflict");
    assert.equal(db.rows[0].title, COMPLETE.title);
  }
});

test("updateTopicSeed: invalid field types and mixed-invalid support never write", async () => {
  for (const bad of [
    { title: { text: "T" } },
    { whyNow: false },
    { contextType: ["child"] },
    { requestedSupport: ["role", "not_allowed"] },
    { requestedSupport: "role" },
    { importance: "7" },
    { importance: true },
    { safetyGate: 1 },
    { complete: "true" }
  ]) {
    const db = makeDb();
    const seed = await seedFor(db);
    const error = await updateTopicSeed(OWNER, seed.id, {
      expectedUpdatedAt: seed.updatedAt,
      ...bad
    }, { db }).then(() => null, (e) => e);
    assert.equal(error?.status, 400, `expected 400 for ${JSON.stringify(bad)}`);
    assert.equal(error?.message, "topic_seeds.errors.invalid");
    assert.equal(db.rows[0].title, COMPLETE.title);
    assert.deepEqual(db.rows[0].requestedSupport, COMPLETE.requestedSupport);
  }
});

test("updateTopicSeed: WAITING is immutable", async () => {
  const db = makeDb();
  const seed = await seedFor(db);
  const queued = await queueTopicSeed(OWNER, seed.id, {
    expectedUpdatedAt: seed.updatedAt,
    confirmedNoIdentifiers: true,
    db
  });
  const error = await updateTopicSeed(OWNER, seed.id, {
    expectedUpdatedAt: queued.updatedAt,
    title: "Ei tohi"
  }, { db }).then(() => null, (e) => e);
  assert.equal(error?.status, 409);
  assert.equal(error?.message, "topic_seeds.errors.edit_conflict");
  assert.equal(db.rows[0].title, COMPLETE.title);
});

test("updateTopicSeed: complete=true enforces the complete quick-seed contract", async () => {
  const db = makeDb();
  const seed = await createTopicSeed(OWNER, { complete: false, title: "Pooleli" }, { db });
  const error = await updateTopicSeed(OWNER, seed.id, {
    expectedUpdatedAt: seed.updatedAt,
    complete: true,
    whyNow: "Veel pooleli"
  }, { db }).then(() => null, (e) => e);
  assert.equal(error?.status, 400);
  assert.equal(error?.message, "topic_seeds.errors.incomplete");
  assert.equal(db.rows[0].whyNow, null);
});

test("updateTopicSeed: a concurrent write losing the conditional update returns 409", async () => {
  const db = makeDb();
  const seed = await seedFor(db);
  db.topicSeed.updateMany = async () => ({ count: 0 });
  const error = await updateTopicSeed(OWNER, seed.id, {
    expectedUpdatedAt: seed.updatedAt,
    title: "Võistlev kirjutus"
  }, { db }).then(() => null, (e) => e);
  assert.equal(error?.status, 409);
  assert.equal(error?.message, "topic_seeds.errors.edit_conflict");
  assert.equal(db.rows[0].title, COMPLETE.title);
});

test("topicSeedPublicError: only explicit public keys cross the API boundary", () => {
  assert.deepEqual(
    topicSeedPublicError(Object.assign(new Error("topic_seeds.errors.invalid"), { status: 400 })),
    { messageKey: "topic_seeds.errors.invalid", status: 400 }
  );
  for (const error of [
    Object.assign(new Error("raw database detail"), { status: 400 }),
    Object.assign(new Error("topic_seeds.errors.invalid"), { status: 418 }),
    new Error("topic_seeds.errors.invalid")
  ]) {
    assert.deepEqual(
      topicSeedPublicError(error),
      { messageKey: "topic_seeds.errors.request_failed", status: 500 }
    );
  }
});

// --- queue: deliberate, version-safe DRAFT -> WAITING -----------------------

async function seedFor(db, owner = OWNER) {
  return createTopicSeed(owner, { ...COMPLETE }, { db });
}

test("queueTopicSeed: requires explicit no-identifiers confirmation", async () => {
  const db = makeDb();
  const seed = await seedFor(db);
  const error = await queueTopicSeed(OWNER, seed.id, { expectedUpdatedAt: seed.updatedAt, confirmedNoIdentifiers: false, db })
    .then(() => null, (e) => e);
  assert.equal(error.status, 400);
  assert.equal(error.message, "topic_seeds.errors.confirmation_required");
  assert.equal(db.rows[0].status, "DRAFT");
});

test("queueTopicSeed: an incomplete draft cannot be queued", async () => {
  const db = makeDb();
  const seed = await createTopicSeed(OWNER, { complete: false, title: "Pooleli" }, { db });
  const error = await queueTopicSeed(OWNER, seed.id, { expectedUpdatedAt: seed.updatedAt, confirmedNoIdentifiers: true, db })
    .then(() => null, (e) => e);
  assert.equal(error.status, 400);
  assert.equal(error.message, "topic_seeds.errors.incomplete");
  assert.equal(db.rows[0].status, "DRAFT");
});

test("queueTopicSeed: a correct fingerprint queues, stamps audit times and freezes the snapshot", async () => {
  const db = makeDb();
  const seed = await seedFor(db);
  const queued = await queueTopicSeed(OWNER, seed.id, { expectedUpdatedAt: seed.updatedAt, confirmedNoIdentifiers: true, db });
  assert.equal(queued.status, "WAITING");
  assert.ok(queued.ownerConfirmedAt);
  assert.ok(queued.sharedAt);
  assert.ok(queued.sharedCardSnapshot);
});

test("queueTopicSeed: the frozen snapshot holds ONLY generalized card fields", async () => {
  const db = makeDb();
  const seed = await seedFor(db);
  const queued = await queueTopicSeed(OWNER, seed.id, { expectedUpdatedAt: seed.updatedAt, confirmedNoIdentifiers: true, db });
  assert.deepEqual(
    Object.keys(queued.sharedCardSnapshot).sort(),
    ["caseType", "contextType", "frozenAt", "importance", "requestedSupport", "title", "whyNow"]
  );
  // Never leak owner or private gate result into the shareable card.
  assert.equal(queued.sharedCardSnapshot.ownerId, undefined);
  assert.equal(queued.sharedCardSnapshot.safetyGate, undefined);
});

test("queueTopicSeed: a missing/invalid/stale fingerprint is a generic 409 with no write", async () => {
  for (const fingerprint of [null, undefined, "not-a-date", "2020-01-01T00:00:00.000Z"]) {
    const db = makeDb();
    const seed = await seedFor(db);
    const error = await queueTopicSeed(OWNER, seed.id, { expectedUpdatedAt: fingerprint, confirmedNoIdentifiers: true, db })
      .then(() => null, (e) => e);
    assert.equal(error?.status, 409, `expected 409 for fingerprint ${String(fingerprint)}`);
    assert.equal(error.message, "topic_seeds.errors.queue_conflict");
    assert.equal(db.rows[0].status, "DRAFT");
    assert.equal(db.rows[0].sharedCardSnapshot, null);
  }
});

test("queueTopicSeed: re-queuing an already-WAITING seed is idempotent (no new snapshot)", async () => {
  const db = makeDb();
  const seed = await seedFor(db);
  const first = await queueTopicSeed(OWNER, seed.id, { expectedUpdatedAt: seed.updatedAt, confirmedNoIdentifiers: true, db });
  const frozenAt = first.sharedCardSnapshot.frozenAt;
  // A second call with a now-stale fingerprint still returns WAITING unchanged.
  const second = await queueTopicSeed(OWNER, seed.id, { expectedUpdatedAt: seed.updatedAt, confirmedNoIdentifiers: true, db });
  assert.equal(second.status, "WAITING");
  assert.equal(second.sharedCardSnapshot.frozenAt, frozenAt);
});

test("queueTopicSeed: a foreign user cannot queue and gets a no-leak 404", async () => {
  const db = makeDb();
  const seed = await seedFor(db);
  const error = await queueTopicSeed(OTHER, seed.id, { expectedUpdatedAt: seed.updatedAt, confirmedNoIdentifiers: true, db })
    .then(() => null, (e) => e);
  assert.equal(error.status, 404);
  assert.equal(db.rows[0].status, "DRAFT");
});

test("ordering: PATCH first makes the old queue fingerprint conflict", async () => {
  const db = makeDb();
  const writes = [];
  const updateMany = db.topicSeed.updateMany;
  db.topicSeed.updateMany = async (args) => {
    writes.push(args);
    return updateMany(args);
  };
  const seed = await seedFor(db);
  const updated = await updateTopicSeed(OWNER, seed.id, {
    expectedUpdatedAt: seed.updatedAt,
    title: "Uuem sisu"
  }, { db });
  const error = await queueTopicSeed(OWNER, seed.id, {
    expectedUpdatedAt: seed.updatedAt,
    confirmedNoIdentifiers: true,
    db
  }).then(() => null, (e) => e);

  assert.equal(updated.title, "Uuem sisu");
  assert.equal(error?.status, 409);
  assert.equal(db.rows[0].status, "DRAFT");
  assert.equal(db.rows[0].sharedCardSnapshot, null);
  assert.equal(writes.length, 1);
  assert.deepEqual(Object.keys(writes[0].where).sort(), ["id", "ownerId", "status", "updatedAt"]);
  assert.equal(writes[0].where.status, "DRAFT");
});

test("ordering: queue first makes PATCH conflict and preserves the frozen snapshot", async () => {
  const db = makeDb();
  const writes = [];
  const updateMany = db.topicSeed.updateMany;
  db.topicSeed.updateMany = async (args) => {
    writes.push(args);
    return updateMany(args);
  };
  const seed = await seedFor(db);
  const queued = await queueTopicSeed(OWNER, seed.id, {
    expectedUpdatedAt: seed.updatedAt,
    confirmedNoIdentifiers: true,
    db
  });
  const snapshot = structuredClone(queued.sharedCardSnapshot);
  const error = await updateTopicSeed(OWNER, seed.id, {
    expectedUpdatedAt: queued.updatedAt,
    title: "Ei tohi muutuda"
  }, { db }).then(() => null, (e) => e);

  assert.equal(error?.status, 409);
  assert.equal(db.rows[0].title, COMPLETE.title);
  assert.deepEqual(db.rows[0].sharedCardSnapshot, snapshot);
  assert.equal(writes.length, 1);
  assert.deepEqual(Object.keys(writes[0].where).sort(), ["id", "ownerId", "status", "updatedAt"]);
  assert.equal(writes[0].where.status, "DRAFT");
});

// --- serializer -------------------------------------------------------------

test("serializeTopicSeed: exposes the owner-facing shape without inventing fields", () => {
  const out = serializeTopicSeed({
    id: "s1", ownerId: OWNER, title: "T", contextType: "adult", caseType: "current",
    whyNow: "w", requestedSupport: ["role"], importance: 5, safetyGate: "risk_assessed",
    status: "DRAFT", sharedCardSnapshot: null, ownerConfirmedAt: null, sharedAt: null,
    createdAt: new Date(), updatedAt: new Date()
  });
  assert.equal(out.status, "DRAFT");
  assert.equal(out.covisionCaseId, null);
  assert.equal(out.safetyGate, "risk_assessed");
  assert.deepEqual(out.requestedSupport, ["role"]);
});
