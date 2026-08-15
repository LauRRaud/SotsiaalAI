import test from "node:test";
import assert from "node:assert/strict";

import {
  assessTopicSeedPrivacy,
  createTopicSeed,
  deleteTopicSeed,
  listTopicSeedPage,
  listTopicSeeds,
  listWaitingTopicSeedPage,
  getVisibleTopicSeed,
  normalizeTopicSeedQueueRequest,
  parseTopicSeedJsonBody,
  queueTopicSeed,
  serializeTopicSeed,
  topicSeedPublicError,
  updateTopicSeed,
  withdrawTopicSeed
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
  const audits = [];
  return {
    rows,
    audits,
    async $transaction(callback) { return callback(this); },
    dataAuditLog: {
      async create({ data }) {
        const row = { id: `audit_${audits.length + 1}`, ...data };
        audits.push(row);
        return row;
      }
    },
    covisionClosure: {
      async findFirst({ where = {} } = {}) {
        const seedId = where.OR?.map((branch) => branch.sourceTopicSeedId
          || branch.continuationTopicSeedId).find(Boolean);
        const row = rows.find((item) => item.id === seedId);
        return row && (row.sourceForClosures > 0 || row.continuationForClosure)
          ? { id: "closure_1" }
          : null;
      }
    },
    topicSeed: {
      async findMany({ where = {}, orderBy, take, select } = {}) {
        const matchesSeek = (row) => !where.OR || where.OR.some((branch) => {
          if (branch.updatedAt?.lt) return new Date(row.updatedAt) < new Date(branch.updatedAt.lt);
          return new Date(row.updatedAt).getTime() === new Date(branch.updatedAt).getTime()
            && row.id < branch.id.lt;
        });
        let out = rows.filter((r) =>
          (where.ownerId ? r.ownerId === where.ownerId : true)
          && (where.status ? r.status === where.status : true)
          && (where.covisionCaseId === null ? r.covisionCaseId == null : true)
          && matchesSeek(r));
        if (orderBy) out = out.slice().sort((a, b) => {
          const byTime = new Date(b.updatedAt) - new Date(a.updatedAt);
          return byTime || b.id.localeCompare(a.id);
        });
        if (take) out = out.slice(0, take);
        return out.map((r) => select
          ? Object.fromEntries(Object.keys(select).filter((key) => select[key]).map((key) => [key, r[key]]))
          : { ...r });
      },
      async groupBy({ where = {} } = {}) {
        const counts = new Map();
        for (const row of rows.filter((item) => !where.ownerId || item.ownerId === where.ownerId)) {
          counts.set(row.status, (counts.get(row.status) || 0) + 1);
        }
        return [...counts].map(([status, count]) => ({ status, _count: { _all: count } }));
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
          version: 1, privacyAssessment: null, privacyReviewedAt: null,
          covisionCaseId: null,
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
            (where.covisionCaseId === undefined || row.covisionCaseId === where.covisionCaseId) &&
            (where.version === undefined || row.version === where.version) &&
            (where.updatedAt === undefined || sameTime(row.updatedAt, where.updatedAt));
          if (match) {
            const next = { ...data };
            if (data.version && typeof data.version === "object") next.version = row.version + Number(data.version.increment || 0);
            Object.assign(row, next, { updatedAt: tick() });
            count += 1;
          }
        }
        return { count };
      },
      async deleteMany({ where = {} }) {
        const index = rows.findIndex((row) => row.id === where.id
          && (where.ownerId === undefined || row.ownerId === where.ownerId)
          && (where.status === undefined || row.status === where.status)
          && (where.covisionCaseId === undefined || row.covisionCaseId === where.covisionCaseId)
          && (where.sourceForClosures?.none === undefined || !row.sourceForClosures)
          && (where.continuationForClosure?.is === undefined || row.continuationForClosure == null)
          && (where.version === undefined || row.version === where.version));
        if (index < 0) return { count: 0 };
        rows.splice(index, 1);
        return { count: 1 };
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
    normalizeTopicSeedQueueRequest({ expectedVersion: 3, confirmedNoIdentifiers: true, confirmedPrivacyReview: false }),
    { expectedVersion: 3, confirmedNoIdentifiers: true, confirmedPrivacyReview: false }
  );
  for (const body of [null, [], { expectedVersion: 0 }, { confirmedNoIdentifiers: "true" }, { confirmedPrivacyReview: "true" }]) {
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
    expectedVersion: seed.version,
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
      expectedVersion: seed.version,
      title: "Ei tohi"
    }, { db }).then(() => null, (e) => e);
    assert.equal(error?.status, 404);
    assert.equal(error?.message, "api.common.not_found");
  }
  assert.equal(db.rows[0].title, COMPLETE.title);
});

test("updateTopicSeed: expectedVersion is mandatory and stale writes change nothing", async () => {
  for (const expectedVersion of [undefined, null, 0, 2]) {
    const db = makeDb();
    const seed = await seedFor(db);
    const error = await updateTopicSeed(OWNER, seed.id, {
      expectedVersion,
      title: "Ei tohi"
    }, { db }).then(() => null, (e) => e);
    assert.equal(error?.status, expectedVersion === 2 ? 409 : 400);
    assert.equal(error?.message, expectedVersion === 2 ? "topic_seeds.errors.edit_conflict" : "topic_seeds.errors.invalid");
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
      expectedVersion: seed.version,
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
    expectedVersion: seed.version,
    confirmedNoIdentifiers: true,
    db
  });
  const error = await updateTopicSeed(OWNER, seed.id, {
    expectedVersion: queued.version,
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
    expectedVersion: seed.version,
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
    expectedVersion: seed.version,
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
  const error = await queueTopicSeed(OWNER, seed.id, { expectedVersion: seed.version, confirmedNoIdentifiers: false, db })
    .then(() => null, (e) => e);
  assert.equal(error.status, 400);
  assert.equal(error.message, "topic_seeds.errors.confirmation_required");
  assert.equal(db.rows[0].status, "DRAFT");
});

test("queueTopicSeed: an incomplete draft cannot be queued", async () => {
  const db = makeDb();
  const seed = await createTopicSeed(OWNER, { complete: false, title: "Pooleli" }, { db });
  const error = await queueTopicSeed(OWNER, seed.id, { expectedVersion: seed.version, confirmedNoIdentifiers: true, db })
    .then(() => null, (e) => e);
  assert.equal(error.status, 400);
  assert.equal(error.message, "topic_seeds.errors.incomplete");
  assert.equal(db.rows[0].status, "DRAFT");
});

test("queueTopicSeed: a correct fingerprint queues, stamps audit times and freezes the snapshot", async () => {
  const db = makeDb();
  const seed = await seedFor(db);
  const queued = await queueTopicSeed(OWNER, seed.id, { expectedVersion: seed.version, confirmedNoIdentifiers: true, db });
  assert.equal(queued.status, "WAITING");
  assert.ok(queued.ownerConfirmedAt);
  assert.ok(queued.sharedAt);
  assert.ok(queued.sharedCardSnapshot);
});

test("queueTopicSeed: the frozen snapshot holds ONLY generalized card fields", async () => {
  const db = makeDb();
  const seed = await seedFor(db);
  const queued = await queueTopicSeed(OWNER, seed.id, { expectedVersion: seed.version, confirmedNoIdentifiers: true, db });
  assert.deepEqual(
    Object.keys(queued.sharedCardSnapshot).sort(),
    ["caseType", "contextType", "frozenAt", "importance", "requestedSupport", "title", "whyNow"]
  );
  // Never leak owner or private gate result into the shareable card.
  assert.equal(queued.sharedCardSnapshot.ownerId, undefined);
  assert.equal(queued.sharedCardSnapshot.safetyGate, undefined);
});

test("queueTopicSeed: a missing/invalid/stale version never writes", async () => {
  for (const expectedVersion of [null, undefined, 0, 2]) {
    const db = makeDb();
    const seed = await seedFor(db);
    const error = await queueTopicSeed(OWNER, seed.id, { expectedVersion, confirmedNoIdentifiers: true, db })
      .then(() => null, (e) => e);
    assert.equal(error?.status, expectedVersion === 2 ? 409 : 400, `unexpected status for version ${String(expectedVersion)}`);
    assert.equal(error.message, expectedVersion === 2 ? "topic_seeds.errors.queue_conflict" : "topic_seeds.errors.invalid");
    assert.equal(db.rows[0].status, "DRAFT");
    assert.equal(db.rows[0].sharedCardSnapshot, null);
  }
});

test("queueTopicSeed: re-queuing an already-WAITING seed is idempotent (no new snapshot)", async () => {
  const db = makeDb();
  const seed = await seedFor(db);
  const first = await queueTopicSeed(OWNER, seed.id, { expectedVersion: seed.version, confirmedNoIdentifiers: true, db });
  const frozenAt = first.sharedCardSnapshot.frozenAt;
  // A second call with a now-stale fingerprint still returns WAITING unchanged.
  const second = await queueTopicSeed(OWNER, seed.id, { expectedVersion: seed.version, confirmedNoIdentifiers: true, db });
  assert.equal(second.status, "WAITING");
  assert.equal(second.sharedCardSnapshot.frozenAt, frozenAt);
});

test("queueTopicSeed: a foreign user cannot queue and gets a no-leak 404", async () => {
  const db = makeDb();
  const seed = await seedFor(db);
  const error = await queueTopicSeed(OTHER, seed.id, { expectedVersion: seed.version, confirmedNoIdentifiers: true, db })
    .then(() => null, (e) => e);
  assert.equal(error.status, 404);
  assert.equal(db.rows[0].status, "DRAFT");
});

test("privacy preflight classifies the required direct-identifier corpus", () => {
  const cases = [
    ["Kirjuta mari.maas@example.test", "EMAIL"],
    ["Helista numbril 5123 4567", "PHONE"],
    ["Välisnumber on +358 40 123 4567", "PHONE"],
    ["Isikukood 37605030299", "PERSONAL_CODE"],
    ["Kohtusime Mari Maasiga", "PERSON_NAME"],
    ["Elukoht on Pargi tee 12", "ADDRESS"],
    ["Juhtumi nr ABC-12345", "CASE_NUMBER"]
  ];
  for (const [whyNow, category] of cases) {
    const result = assessTopicSeedPrivacy({ title: "Üldistus", whyNow });
    assert.ok(result.direct.includes(category), `${category} jäi leidmata: ${whyNow}`);
  }
});

test("privacy preflight requires a distinct human review for rare combinations", async () => {
  const db = makeDb();
  const seed = await createTopicSeed(OWNER, {
    ...COMPLETE,
    whyNow: "17-aastane Kureküla küla elanik on piirkonna ainus selle ameti õppija."
  }, { db });
  const first = await queueTopicSeed(OWNER, seed.id, {
    expectedVersion: seed.version,
    confirmedNoIdentifiers: true,
    db
  }).then(() => null, (error) => error);
  assert.equal(first?.status, 422);
  assert.equal(first?.message, "topic_seeds.errors.privacy_review_required");
  assert.equal(db.rows[0].status, "DRAFT");

  const queued = await queueTopicSeed(OWNER, seed.id, {
    expectedVersion: seed.version,
    confirmedNoIdentifiers: true,
    confirmedPrivacyReview: true,
    db
  });
  assert.equal(queued.status, "WAITING");
  assert.ok(queued.privacyReviewedAt);
  assert.deepEqual(queued.privacyAssessment.indirectCategories.sort(), [
    "DISTINCTIVE_TRAIT", "EXACT_AGE", "SMALL_LOCATION"
  ]);
});

test("DRAFT delete is owner-only, version-safe and leaves only a content-free audit receipt", async () => {
  const db = makeDb();
  const seed = await seedFor(db);
  const stale = await deleteTopicSeed(OWNER, seed.id, { expectedVersion: seed.version + 1, db })
    .then(() => null, (error) => error);
  assert.equal(stale?.status, 409);
  assert.equal(db.rows.length, 1);

  const result = await deleteTopicSeed(OWNER, seed.id, { expectedVersion: seed.version, db });
  assert.deepEqual(result, { id: seed.id, deleted: true });
  assert.equal(db.rows.length, 0);
  assert.equal(db.audits.length, 1);
  assert.equal(db.audits[0].action, "TOPIC_SEED_DRAFT_DELETED");
  assert.equal(JSON.stringify(db.audits[0]).includes(COMPLETE.whyNow), false);
});

test("DRAFT delete rejects seeds linked to a completed Covision lifecycle", async () => {
  for (const relation of ["sourceForClosures", "continuationForClosure"]) {
    const seed = {
      ...completeSeedForStatus("DRAFT"),
      covisionCaseId: null,
      sourceForClosures: 0,
      continuationForClosure: null,
      [relation]: relation === "sourceForClosures" ? 1 : { id: "closure_1" }
    };
    const db = makeDb([seed]);
    const error = await deleteTopicSeed(OWNER, seed.id, { expectedVersion: seed.version, db })
      .then(() => null, (caught) => caught);
    assert.equal(error?.status, 409, `${relation} link must prevent deletion`);
    assert.equal(db.rows.length, 1);
    assert.equal(db.audits.length, 0);
  }
});

test("WAITING withdraw clears the frozen share and linked/later seeds remain protected", async () => {
  const db = makeDb();
  const seed = await seedFor(db);
  const queued = await queueTopicSeed(OWNER, seed.id, {
    expectedVersion: seed.version,
    confirmedNoIdentifiers: true,
    db
  });
  const withdrawn = await withdrawTopicSeed(OWNER, seed.id, { expectedVersion: queued.version, db });
  assert.equal(withdrawn.status, "DRAFT");
  assert.equal(withdrawn.sharedCardSnapshot, null);
  assert.equal(withdrawn.ownerConfirmedAt, null);
  assert.equal(withdrawn.version, queued.version + 1);
  assert.equal(db.audits.at(-1).action, "TOPIC_SEED_WAITING_WITHDRAWN");

  for (const status of ["IN_COVISION", "FOLLOW_UP", "CLOSED"]) {
    const protectedDb = makeDb([completeSeedForStatus(status)]);
    const error = await deleteTopicSeed(OWNER, "protected", { expectedVersion: 7, db: protectedDb })
      .then(() => null, (caught) => caught);
    assert.equal(error?.status, 409, `${status} must not be deleted`);
  }
});

function completeSeedForStatus(status) {
  return {
    id: "protected", ownerId: OWNER, ...COMPLETE, complete: undefined,
    status, version: 7, covisionCaseId: "case_1",
    sharedCardSnapshot: {}, ownerConfirmedAt: new Date(), sharedAt: new Date(),
    createdAt: new Date("2026-08-13T08:00:00.000Z"),
    updatedAt: new Date("2026-08-13T08:00:00.000Z")
  };
}

test("cursor pages are bounded, gap-free and carry full-history server counts", async () => {
  const db = makeDb();
  for (let index = 0; index < 31; index += 1) {
    await createTopicSeed(OWNER, { ...COMPLETE, title: `Seeme ${index}` }, { db });
  }
  const first = await listTopicSeedPage(OWNER, { limit: 10, db });
  const second = await listTopicSeedPage(OWNER, { limit: 10, cursor: first.nextCursor, db });
  assert.equal(first.seeds.length, 10);
  assert.equal(second.seeds.length, 10);
  assert.equal(first.counts.ALL, 31);
  assert.equal(first.counts.DRAFT, 31);
  assert.ok(first.nextCursor);
  assert.equal(new Set([...first.seeds, ...second.seeds].map((seed) => seed.id)).size, 20);
});

test("dedicated Kovisioon queue returns only WAITING unlinked minimal snapshots", async () => {
  const db = makeDb([
    completeSeedForStatus("IN_COVISION"),
    { ...completeSeedForStatus("WAITING"), id: "waiting", covisionCaseId: null },
    { ...completeSeedForStatus("WAITING"), id: "linked", covisionCaseId: "case_2" }
  ]);
  const page = await listWaitingTopicSeedPage(OWNER, { limit: 10, db });
  assert.deepEqual(page.seeds.map((seed) => seed.id), ["waiting"]);
  assert.deepEqual(Object.keys(page.seeds[0]).sort(), [
    "covisionCaseId", "id", "sharedCardSnapshot", "status", "updatedAt", "version"
  ]);
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
    expectedVersion: seed.version,
    title: "Uuem sisu"
  }, { db });
  const error = await queueTopicSeed(OWNER, seed.id, {
    expectedVersion: seed.version,
    confirmedNoIdentifiers: true,
    db
  }).then(() => null, (e) => e);

  assert.equal(updated.title, "Uuem sisu");
  assert.equal(error?.status, 409);
  assert.equal(db.rows[0].status, "DRAFT");
  assert.equal(db.rows[0].sharedCardSnapshot, null);
  assert.equal(writes.length, 1);
  assert.deepEqual(Object.keys(writes[0].where).sort(), ["id", "ownerId", "status", "version"]);
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
    expectedVersion: seed.version,
    confirmedNoIdentifiers: true,
    db
  });
  const snapshot = structuredClone(queued.sharedCardSnapshot);
  const error = await updateTopicSeed(OWNER, seed.id, {
    expectedVersion: queued.version,
    title: "Ei tohi muutuda"
  }, { db }).then(() => null, (e) => e);

  assert.equal(error?.status, 409);
  assert.equal(db.rows[0].title, COMPLETE.title);
  assert.deepEqual(db.rows[0].sharedCardSnapshot, snapshot);
  assert.equal(writes.length, 1);
  assert.deepEqual(Object.keys(writes[0].where).sort(), ["id", "ownerId", "status", "version"]);
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
