import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  DangerousActionError,
  executeBulkUserDeletion,
  previewBulkEmail,
  previewBulkUserDeletion
} from "../../lib/admin/dangerousAnalyticsActions.js";
import {
  buildCrisisSafeEventWhere,
  buildExclusiveRequestSplit,
  countServiceAvailabilityStates,
  createCrisisCountMetric,
  createMetric,
  createMetricBasis
} from "../../lib/admin/analyticsMetrics.js";
import {
  isFullAdminEmailProjectionEnabled,
  maskAdminEmail,
  projectAdminEmail,
  redactAdminEmailSideChannels
} from "../../lib/admin/emailProjection.js";

const ENV = {
  NODE_ENV: "test",
  ADMIN_DANGEROUS_ACTION_PREVIEW_SECRET: "admin-v1-core-test-secret"
};
const NOW = new Date("2026-07-17T10:00:00.000Z");

function fakeDb(seed = {}) {
  const state = {
    users: seed.users || [
      { id: "actor-1", email: "actor@example.test", isAdmin: true },
      { id: "user-1", email: "user1@example.test", isAdmin: false },
      { id: "user-2", email: "user2@example.test", isAdmin: false },
      { id: "admin-2", email: "admin2@example.test", isAdmin: true }
    ],
    audits: new Map()
  };
  return {
    state,
    user: {
      async findMany({ where }) {
        const ids = new Set(where?.id?.in || []);
        return state.users.filter(user => ids.has(user.id)).map(user => ({ ...user }));
      }
    },
    dataAuditLog: {
      async create({ data }) {
        if (state.audits.has(data.id)) {
          const error = new Error("duplicate");
          error.code = "P2002";
          throw error;
        }
        state.audits.set(data.id, structuredClone(data));
        return data;
      },
      async update({ where, data }) {
        const current = state.audits.get(where.id);
        state.audits.set(where.id, { ...current, ...structuredClone(data) });
        return state.audits.get(where.id);
      }
    }
  };
}

async function expectDangerous(promise, code, status) {
  await assert.rejects(promise, error => {
    assert.ok(error instanceof DangerousActionError);
    assert.equal(error.code, code);
    if (status != null) assert.equal(error.status, status);
    return true;
  });
}

test("crisis detail queries are count-only for event, isCrisis and mixed filters", () => {
  const base = { createdAt: { gte: NOW }, role: "CLIENT" };
  const mixed = buildCrisisSafeEventWhere(base, "all");
  assert.deepEqual(mixed.safeWhere.AND[1], {
    NOT: {
      OR: [
        { event: "crisis_detected" },
        { data: { path: ["isCrisis"], equals: true } }
      ]
    }
  });
  assert.deepEqual(mixed.crisisWhere.AND[1].OR[0], { event: "crisis_detected" });

  const crisisOnly = buildCrisisSafeEventWhere({ ...base, event: "crisis_detected" }, "true");
  assert.deepEqual(crisisOnly.safeWhere.AND.at(-1), { id: "__count_only_crisis__" });
  assert.equal(buildCrisisSafeEventWhere(base, "false").crisisWhere, null);
});

test("crisis counts suppress small cohorts and never expose private fields", () => {
  const suppressed = createCrisisCountMetric(4, { computedAt: NOW });
  assert.equal(suppressed.value, null);
  assert.equal(suppressed.basis.suppressed, true);
  assert.equal(suppressed.basis.suppressionReason, "count_below_5");
  assert.equal(JSON.stringify(suppressed).includes("userId"), false);
  assert.equal(JSON.stringify(suppressed).includes("data"), false);

  const zero = createCrisisCountMetric(0, { computedAt: NOW });
  assert.equal(zero.value, 0);
  assert.equal(zero.basis.suppressed, false);
});

test("metric basis distinguishes null, degradation, sample and real zero", () => {
  const basis = createMetricBasis({
    source: "test-source",
    window: "30d",
    computedAt: NOW,
    sampleLimit: 1000,
    degraded: true,
    degradationReason: "test-degradation"
  });
  assert.deepEqual(createMetric(null, basis), { value: null, basis });
  assert.equal(createMetric(0, basis).value, 0);
  assert.equal(basis.sampleLimit, 1000);
  assert.equal(basis.degraded, true);
  assert.equal(basis.computedAt, NOW.toISOString());
});

test("request split categories are mutually exclusive and arithmetically complete", () => {
  const split = buildExclusiveRequestSplit({ totalRequests: 100, ragSearchCount: 69, noContextCount: 69 });
  assert.deepEqual(split.counts, { ragWithContext: 0, noContext: 69, other: 31 });
  assert.equal(Object.values(split.counts).reduce((sum, value) => sum + value, 0), 100);
  assert.equal(Object.values(split.percentages).reduce((sum, value) => sum + value, 0), 100);
});

test("service confirmation counter returns only status aggregates", () => {
  const result = countServiceAvailabilityStates(
    [{ state: "fresh", secret: "a" }, { state: "stale", secret: "b" }, { state: "other", secret: "c" }],
    row => ({ freshness: row.state })
  );
  assert.deepEqual(result, { fresh: 1, stale: 1, unknown: 1, total: 3 });
  assert.equal(JSON.stringify(result).includes("secret"), false);
});

test("one email projection is masked by default and fail-closed", () => {
  const email = "alice.long@example.org";
  assert.equal(maskAdminEmail(email), "a********g@e***e.org");
  for (const value of [undefined, "", "1", "yes", "TRUE-ish", "false"]) {
    assert.equal(isFullAdminEmailProjectionEnabled({ ADMIN_ANALYTICS_SHOW_FULL_EMAILS: value }), false);
    assert.equal(projectAdminEmail(email, { env: { ADMIN_ANALYTICS_SHOW_FULL_EMAILS: value } }), maskAdminEmail(email));
  }
  assert.equal(projectAdminEmail(email, { env: { ADMIN_ANALYTICS_SHOW_FULL_EMAILS: "true" } }), email);
  assert.deepEqual(
    redactAdminEmailSideChannels({ reason: "contact alice@example.org", nested: ["bob@example.org"] }),
    { reason: "contact [redacted-email]", nested: ["[redacted-email]"] }
  );
});

test("all three required email surfaces import the shared projection", async () => {
  const files = await Promise.all([
    readFile(new URL("../../app/api/admin/analytics/users/route.js", import.meta.url), "utf8"),
    readFile(new URL("../../app/api/admin/framework-acceptances/route.js", import.meta.url), "utf8"),
    readFile(new URL("../../lib/usage/adminUserDetail.js", import.meta.url), "utf8")
  ]);
  for (const source of files) assert.match(source, /projectAdminEmail/);
  assert.doesNotMatch(files[0], /crisisDetected/);
});

test("bulk deletion requires reason, preview token and exact confirmation with zero side effects", async () => {
  const db = fakeDb();
  let calls = 0;
  const deletionService = async () => { calls += 1; return { ok: true }; };
  const body = { userIds: ["user-1"], reason: "support request" };
  const preview = await previewBulkUserDeletion({ db, body, actorUserId: "actor-1", now: NOW, env: ENV });

  await expectDangerous(
    executeBulkUserDeletion({ db, body, actorUserId: "actor-1", deletionService, now: NOW, env: ENV }),
    "DANGEROUS_CONFIRMATION_REQUIRED",
    400
  );
  await expectDangerous(
    executeBulkUserDeletion({
      db,
      body: { ...body, confirmation: preview.confirmation },
      actorUserId: "actor-1",
      deletionService,
      now: NOW,
      env: ENV
    }),
    "DANGEROUS_PREVIEW_REQUIRED",
    400
  );
  await expectDangerous(
    executeBulkUserDeletion({
      db,
      body: { ...body, previewToken: preview.previewToken, confirmation: "DELETE USERS 999" },
      actorUserId: "actor-1",
      deletionService,
      now: NOW,
      env: ENV
    }),
    "DANGEROUS_CONFIRMATION_INVALID",
    400
  );
  assert.equal(calls, 0);
  assert.equal(db.state.audits.size, 0);
});

test("bulk deletion rejects expiry, tamper, action mismatch and actor mismatch", async () => {
  const body = { userIds: ["user-1"], reason: "support request" };
  const db = fakeDb();
  const preview = await previewBulkUserDeletion({ db, body, actorUserId: "actor-1", now: NOW, env: ENV });
  const execute = (previewToken, actorUserId = "actor-1", now = NOW) => executeBulkUserDeletion({
    db,
    body: { ...body, previewToken, confirmation: preview.confirmation },
    actorUserId,
    deletionService: async () => ({ ok: true }),
    now,
    env: ENV
  });

  await expectDangerous(execute(preview.previewToken, "actor-1", new Date(NOW.getTime() + 6 * 60 * 1000)), "DANGEROUS_PREVIEW_STALE");
  await expectDangerous(execute(`${preview.previewToken.slice(0, -1)}x`), "DANGEROUS_PREVIEW_INVALID");
  await expectDangerous(execute(preview.previewToken, "admin-2"), "DANGEROUS_PREVIEW_STALE");

  const emailPreview = await previewBulkEmail({
    db,
    body: { target: "selected", userIds: ["user-1"], subject: "x", text: "y", reason: "support request" },
    now: NOW,
    env: ENV
  });
  await expectDangerous(execute(emailPreview.previewToken), "DANGEROUS_PREVIEW_STALE");
});

test("bulk deletion token is single-use for sequential and parallel replay", async () => {
  const body = { userIds: ["user-1", "user-2"], reason: "support request" };
  const sequentialDb = fakeDb();
  const preview = await previewBulkUserDeletion({ sequentialDb, db: sequentialDb, body, actorUserId: "actor-1", now: NOW, env: ENV });
  let calls = 0;
  const execute = () => executeBulkUserDeletion({
    db: sequentialDb,
    body: { ...body, previewToken: preview.previewToken, confirmation: preview.confirmation },
    actorUserId: "actor-1",
    deletionService: async () => { calls += 1; return { ok: true }; },
    now: NOW,
    env: ENV
  });
  assert.equal((await execute()).deletedCount, 2);
  await expectDangerous(execute(), "DANGEROUS_PREVIEW_ALREADY_USED", 409);
  assert.equal(calls, 2);

  const parallelDb = fakeDb();
  const parallelPreview = await previewBulkUserDeletion({ db: parallelDb, body, actorUserId: "actor-1", now: NOW, env: ENV });
  let parallelCalls = 0;
  const parallelExecute = () => executeBulkUserDeletion({
    db: parallelDb,
    body: { ...body, previewToken: parallelPreview.previewToken, confirmation: parallelPreview.confirmation },
    actorUserId: "actor-1",
    deletionService: async () => { parallelCalls += 1; return { ok: true }; },
    now: NOW,
    env: ENV
  });
  const settled = await Promise.allSettled([parallelExecute(), parallelExecute()]);
  assert.equal(settled.filter(item => item.status === "fulfilled").length, 1);
  assert.equal(settled.filter(item => item.status === "rejected" && item.reason?.status === 409).length, 1);
  assert.equal(parallelCalls, 2);
});

test("bulk deletion preserves self/admin blocking, cleanup call and content-minimal audit", async () => {
  const db = fakeDb();
  const body = {
    userIds: ["actor-1", "admin-2", "user-1"],
    reason: "ticket from alice@example.org"
  };
  const preview = await previewBulkUserDeletion({ db, body, actorUserId: "actor-1", now: NOW, env: ENV });
  assert.deepEqual(preview.blocked, { self: true, adminCount: 1 });
  assert.equal(preview.deletableCount, 1);

  const cleanupCalls = [];
  const result = await executeBulkUserDeletion({
    db,
    body: { ...body, previewToken: preview.previewToken, confirmation: preview.confirmation },
    actorUserId: "actor-1",
    deletionService: async input => { cleanupCalls.push(input); return { ok: true }; },
    now: NOW,
    env: ENV
  });
  assert.deepEqual(result.deletedIds, ["user-1"]);
  assert.deepEqual(cleanupCalls.map(call => call.targetUserId), ["user-1"]);
  assert.equal(cleanupCalls[0].reason.includes("alice@example.org"), false);

  const audit = Array.from(db.state.audits.values())[0];
  assert.equal(audit.meta.reason, "ticket from [redacted-email]");
  assert.equal(JSON.stringify(audit).includes("user1@example.test"), false);
  assert.equal(JSON.stringify(audit).includes("user-1"), false);
});

test("bulk deletion refuses self/admin-only target sets before issuing a token", async () => {
  const db = fakeDb();
  await expectDangerous(
    previewBulkUserDeletion({
      db,
      body: { userIds: ["actor-1", "admin-2"], reason: "support request" },
      actorUserId: "actor-1",
      now: NOW,
      env: ENV
    }),
    "USERS_DELETE_FORBIDDEN_TARGETS",
    409
  );
  assert.equal(db.state.audits.size, 0);
});

test("summary contract contains five content-free operational counters and honest user arithmetic", async () => {
  const source = await readFile(new URL("../../app/api/admin/analytics/summary/route.js", import.meta.url), "utf8");
  for (const key of [
    "materialsPending",
    "sourceFeedbackOpen",
    "deletionBacklog",
    "serviceConfirmations",
    "sentUnopenedPreInquiries"
  ]) assert.match(source, new RegExp(key));
  assert.match(source, /materialSubmission\.count\(\{ where: \{ status: "pending" \} \}\)/);
  assert.match(source, /sourceFeedback\.count\(\{ where: \{ status: "OPEN" \} \}\)/);
  assert.match(source, /status: \{ in: \["pending", "failed"\] \}/);
  assert.match(source, /serviceProviderService\.findMany\([\s\S]*where: \{ status: "PUBLISHED" \}[\s\S]*select: \{ availabilityStatus: true, availabilityCheckedAt: true \}/);
  assert.match(source, /status: "SENT"[\s\S]*openedAt: null[\s\S]*sentAt: \{ lt: unopenedPreInquiryCutoff \}/);
  assert.match(source, /users:\s*\{[\s\S]*total:\s*usersTotal[\s\S]*byRole:/);
  assert.doesNotMatch(source, /operations:\s*\{[\s\S]*situation:/);
  assert.doesNotMatch(source, /operations:\s*\{[\s\S]*generatedDraft:/);
});

test("UI renders null as an em dash, exposes basis states and has no individual cost ranking", async () => {
  const [dashboard, aiCostsRoute] = await Promise.all([
    readFile(new URL("../../components/admin/AnalyticsDashboard.jsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/api/admin/analytics/ai-costs/route.js", import.meta.url), "utf8")
  ]);
  assert.match(dashboard, /metric\.value == null\) return "—"/);
  assert.match(dashboard, /basis\.suppressed/);
  assert.match(dashboard, /basis\.degraded/);
  assert.match(dashboard, /basis\.sampleLimit/);
  assert.doesNotMatch(aiCostsRoute, /top_users:/);
  assert.match(aiCostsRoute, /threshold_users:/);
  assert.match(aiCostsRoute, /\.filter\(row => row\?\.threshold_flags\?\.at_or_above_85\)/);
});
