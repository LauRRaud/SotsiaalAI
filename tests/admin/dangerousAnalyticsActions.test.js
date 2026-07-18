import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DangerousActionError,
  executeBulkEmail,
  executeLogDeletion,
  executeResetAction,
  previewBulkEmail,
  previewLogDeletion,
  previewResetAction
} from "../../lib/admin/dangerousAnalyticsActions.js";

const NOW = new Date("2026-07-16T10:00:00.000Z");
const ENV = { NODE_ENV: "test", ADMIN_DANGEROUS_ACTION_PREVIEW_SECRET: "test-preview-secret" };
const REQUEST = {
  headers: new Map([
    ["x-forwarded-for", "127.0.0.1"],
    ["user-agent", "admin-p0.1-test"]
  ])
};

function countModel(state, key) {
  return {
    async count() {
      return state.counts[key];
    },
    async deleteMany() {
      const count = state.counts[key];
      state.counts[key] = 0;
      state.deletions.push(key);
      return { count };
    }
  };
}

function makeResetDb(overrides = {}) {
  const counts = {
    ChatLog: 4,
    ConversationMessage: 5,
    ConversationRun: 2,
    Conversation: 3,
    RoomMessage: 7,
    Invite: 2,
    RoomMember: 4,
    Room: 1,
    VerificationToken: 2,
    LoginTempToken: 3,
    EmailOtpCode: 4,
    TrustedDevice: 5,
    UsageEvent: 8,
    UsageReservation: 2,
    UsageBucket: 6,
    Payment: 9,
    Subscription: 3,
    ...overrides
  };
  const state = { counts, deletions: [], audits: [] };
  const db = {
    state,
    chatLog: countModel(state, "ChatLog"),
    conversationMessage: countModel(state, "ConversationMessage"),
    conversationRun: countModel(state, "ConversationRun"),
    conversation: countModel(state, "Conversation"),
    roomMessage: countModel(state, "RoomMessage"),
    invite: countModel(state, "Invite"),
    roomMember: countModel(state, "RoomMember"),
    room: countModel(state, "Room"),
    verificationToken: countModel(state, "VerificationToken"),
    loginTempToken: countModel(state, "LoginTempToken"),
    emailOtpCode: countModel(state, "EmailOtpCode"),
    trustedDevice: countModel(state, "TrustedDevice"),
    usageEvent: countModel(state, "UsageEvent"),
    usageReservation: countModel(state, "UsageReservation"),
    usageBucket: countModel(state, "UsageBucket"),
    payment: countModel(state, "Payment"),
    subscription: countModel(state, "Subscription"),
    dataAuditLog: {
      async create({ data }) {
        state.audits.push(data);
        return data;
      }
    },
    async $transaction(callback) {
      return callback(db);
    }
  };
  return db;
}

function matchesLogWhere(row, where = {}) {
  if (where.event && row.event !== where.event) return false;
  if (where.data && Boolean(row.data?.isCrisis) !== where.data.equals) return false;
  return true;
}

function makeLogDb() {
  const state = {
    logs: [
      { id: "1", event: "chat_request", data: { isCrisis: false } },
      { id: "2", event: "crisis_detected", data: { isCrisis: true } },
      { id: "3", event: "crisis_detected", data: { isCrisis: true } }
    ],
    audits: []
  };
  const db = {
    state,
    chatLog: {
      async count({ where = {} } = {}) {
        return state.logs.filter(row => matchesLogWhere(row, where)).length;
      },
      async deleteMany({ where = {} } = {}) {
        const kept = state.logs.filter(row => !matchesLogWhere(row, where));
        const count = state.logs.length - kept.length;
        state.logs = kept;
        return { count };
      }
    },
    dataAuditLog: {
      async create({ data }) {
        state.audits.push(data);
        return data;
      }
    },
    async $transaction(callback) {
      return callback(db);
    }
  };
  return db;
}

function makeEmailDb(users) {
  const state = {
    users:
      users ||
      [
        { id: "u1", email: "first@example.test" },
        { id: "u2", email: "second@example.test" },
        { id: "u3", email: null }
      ],
    audits: [],
    auditUpdates: 0
  };
  return {
    state,
    user: {
      async findMany({ where, take }) {
        const ids = where.id?.in ? new Set(where.id.in) : null;
        return state.users
          .filter(row => row.email && (!ids || ids.has(row.id)))
          .sort((left, right) => left.id.localeCompare(right.id))
          .slice(0, take);
      }
    },
    dataAuditLog: {
      async create({ data }) {
        if (state.audits.some(row => row.id === data.id)) {
          throw Object.assign(new Error("unique constraint"), { code: "P2002" });
        }
        state.audits.push(data);
        return data;
      },
      async update({ where, data }) {
        const index = state.audits.findIndex(row => row.id === where.id);
        if (index < 0) throw new Error("audit row not found");
        state.audits[index] = { ...state.audits[index], ...data };
        state.auditUpdates += 1;
        return state.audits[index];
      }
    }
  };
}

function makeMailer() {
  const sent = [];
  return {
    sent,
    async sendMail(message) {
      sent.push(message);
    }
  };
}

function decodePreviewToken(previewToken) {
  const [encodedPayload, signature] = String(previewToken || "").split(".");
  return {
    encodedPayload,
    signature,
    payload: JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"))
  };
}

function replacePreviewJti(previewToken, jti) {
  const decoded = decodePreviewToken(previewToken);
  const encodedPayload = Buffer.from(JSON.stringify({ ...decoded.payload, jti })).toString("base64url");
  return `${encodedPayload}.${decoded.signature}`;
}

async function expectGate(promise, code, status = 400) {
  await assert.rejects(
    promise,
    error => error instanceof DangerousActionError && error.code === code && error.status === status
  );
}

test("missing reason is a 400 and does not mutate reset data", async () => {
  const db = makeResetDb();
  await expectGate(
    previewResetAction({ db, body: { action: "clear_billing", dryRun: true }, now: NOW, env: ENV }),
    "DANGEROUS_REASON_REQUIRED"
  );
  assert.equal(db.state.counts.Payment, 9);
  assert.equal(db.state.audits.length, 0);
});

test("blank reason is a 400", async () => {
  const db = makeLogDb();
  await expectGate(
    previewLogDeletion({ db, body: { all: true, reason: "   " }, now: NOW, env: ENV }),
    "DANGEROUS_REASON_REQUIRED"
  );
  assert.equal(db.state.logs.length, 3);
});

test("missing written confirmation is a 400 without reset side effects", async () => {
  const db = makeResetDb();
  const preview = await previewResetAction({
    db,
    body: { action: "clear_billing", reason: "Pre-launch cleanup" },
    now: NOW,
    env: ENV
  });
  await expectGate(
    executeResetAction({
      db,
      body: { action: "clear_billing", reason: "Pre-launch cleanup", previewToken: preview.previewToken },
      actorUserId: "admin-1",
      request: REQUEST,
      now: NOW,
      env: ENV
    }),
    "DANGEROUS_CONFIRMATION_REQUIRED"
  );
  assert.equal(db.state.counts.Payment, 9);
  assert.equal(db.state.audits.length, 0);
});

test("incorrect written confirmation is a 400 without log deletion", async () => {
  const db = makeLogDb();
  const body = { all: false, event: "crisis_detected", isCrisis: "all", reason: "Remove test logs" };
  const preview = await previewLogDeletion({ db, body, now: NOW, env: ENV });
  await expectGate(
    executeLogDeletion({
      db,
      body: { ...body, confirmation: "WRONG", previewToken: preview.previewToken },
      actorUserId: "admin-1",
      request: REQUEST,
      now: NOW,
      env: ENV
    }),
    "DANGEROUS_CONFIRMATION_INVALID"
  );
  assert.equal(db.state.logs.length, 3);
  assert.equal(db.state.audits.length, 0);
});

test("valid dry-runs report actual impact without deleting data or sending email", async () => {
  const resetDb = makeResetDb();
  const logDb = makeLogDb();
  const emailDb = makeEmailDb();
  const mailer = makeMailer();
  const reset = await previewResetAction({
    db: resetDb,
    body: { action: "clear_billing", reason: "Pre-launch cleanup" },
    now: NOW,
    env: ENV
  });
  const logs = await previewLogDeletion({
    db: logDb,
    body: { all: true, reason: "Remove test logs" },
    now: NOW,
    env: ENV
  });
  const email = await previewBulkEmail({
    db: emailDb,
    body: {
      target: "selected",
      userIds: ["u1", "u2"],
      subject: "Service notice",
      text: "Scheduled maintenance",
      reason: "Notify affected users"
    },
    now: NOW,
    env: ENV
  });
  assert.equal(reset.total, 12);
  assert.equal(logs.count, 3);
  assert.equal(email.recipientCount, 2);
  assert.equal(resetDb.state.counts.Payment, 9);
  assert.equal(logDb.state.logs.length, 3);
  assert.equal(mailer.sent.length, 0);
  assert.equal(emailDb.state.audits.length, 0);
});

test("production reset is disabled by default even after a correct preview", async () => {
  const db = makeResetDb();
  const env = { NODE_ENV: "production", ADMIN_DANGEROUS_ACTION_PREVIEW_SECRET: "production-secret" };
  const body = { action: "clear_billing", reason: "Pre-launch cleanup" };
  const preview = await previewResetAction({ db, body, now: NOW, env });
  assert.equal(preview.executionAllowed, false);
  await expectGate(
    executeResetAction({
      db,
      body: { ...body, confirmation: preview.confirmation, previewToken: preview.previewToken },
      actorUserId: "admin-1",
      request: REQUEST,
      now: NOW,
      env
    }),
    "RESET_DISABLED_IN_PRODUCTION",
    403
  );
  assert.equal(db.state.counts.Payment, 9);
  assert.equal(db.state.counts.Subscription, 3);
  assert.equal(db.state.audits.length, 0);
});

test("each successful reset writes exactly one correct audit row", async () => {
  const actions = [
    "clear_logs",
    "clear_conversations",
    "clear_rooms",
    "clear_auth_tokens",
    "clear_usage_metrics",
    "clear_billing"
  ];
  for (const action of actions) {
    const db = makeResetDb();
    const body = { action, reason: `Approved cleanup for ${action}` };
    const preview = await previewResetAction({ db, body, now: NOW, env: ENV });
    const result = await executeResetAction({
      db,
      body: { ...body, confirmation: preview.confirmation, previewToken: preview.previewToken },
      actorUserId: "admin-1",
      request: REQUEST,
      now: NOW,
      env: ENV
    });
    assert.equal(result.total, preview.total);
    assert.equal(db.state.audits.length, 1);
    assert.equal(db.state.audits[0].action, "ADMIN_ANALYTICS_RESET_COMPLETED");
    assert.equal(db.state.audits[0].actorUserId, "admin-1");
    assert.equal(db.state.audits[0].meta.reason, body.reason);
    assert.equal(db.state.audits[0].meta.resetAction, action);
    assert.equal(db.state.audits[0].meta.result, "success");
  }
});

test("bulk email sends nothing until every server gate passes", async () => {
  const db = makeEmailDb();
  const mailer = makeMailer();
  const body = {
    target: "selected",
    userIds: ["u1", "u2"],
    subject: "Service notice",
    text: "Scheduled maintenance",
    reason: "Notify affected users"
  };
  const preview = await previewBulkEmail({ db, body, now: NOW, env: ENV });
  await expectGate(
    executeBulkEmail({
      db,
      mailer,
      from: "service@example.test",
      body: { ...body, confirmation: "WRONG", previewToken: preview.previewToken },
      actorUserId: "admin-1",
      request: REQUEST,
      now: NOW,
      env: ENV
    }),
    "DANGEROUS_CONFIRMATION_INVALID"
  );
  assert.equal(mailer.sent.length, 0);
  assert.equal(db.state.audits.length, 0);
});

test("successful bulk email writes one content-free audit with actual recipient count", async () => {
  const db = makeEmailDb();
  const mailer = makeMailer();
  const body = {
    target: "all",
    subject: "Private subject must not enter audit",
    text: "Private body must not enter audit",
    reason: "Notify all active recipients"
  };
  const preview = await previewBulkEmail({ db, body, now: NOW, env: ENV });
  const result = await executeBulkEmail({
    db,
    mailer,
    from: "service@example.test",
    body: { ...body, confirmation: preview.confirmation, previewToken: preview.previewToken },
    actorUserId: "admin-1",
    request: REQUEST,
    now: NOW,
    env: ENV
  });
  assert.equal(result.sentCount, 2);
  assert.equal(mailer.sent.length, 2);
  assert.equal(db.state.audits.length, 1);
  assert.equal(db.state.auditUpdates, 1);
  const audit = db.state.audits[0];
  assert.equal(audit.action, "ADMIN_ANALYTICS_BULK_EMAIL_SENT");
  assert.equal(audit.actorUserId, "admin-1");
  assert.equal(audit.meta.reason, body.reason);
  assert.equal(audit.meta.targetType, "all");
  assert.equal(audit.meta.recipientCount, 2);
  assert.deepEqual(audit.meta.result, { status: "success", sentCount: 2, failedCount: 0 });
  assert.equal(audit.ipAddress, undefined);
  assert.equal(audit.userAgent, undefined);
  const serializedAudit = JSON.stringify(audit);
  assert.doesNotMatch(serializedAudit, /Private subject|Private body|first@example|second@example/);
});

test("bulk email preview token is single-use across sequential requests", async () => {
  const db = makeEmailDb();
  const sent = [];
  const mailer = {
    sent,
    async sendMail(message) {
      assert.equal(db.state.audits.length, 1);
      assert.equal(db.state.audits[0].meta.result.status, "started");
      sent.push(message);
    }
  };
  const body = {
    target: "all",
    subject: "Service notice",
    text: "Scheduled maintenance",
    reason: "Notify all active recipients"
  };
  const preview = await previewBulkEmail({ db, body, now: NOW, env: ENV });
  const execution = {
    db,
    mailer,
    from: "service@example.test",
    body: { ...body, confirmation: preview.confirmation, previewToken: preview.previewToken },
    actorUserId: "admin-1",
    now: NOW,
    env: ENV
  };

  await executeBulkEmail(execution);
  await expectGate(executeBulkEmail(execution), "DANGEROUS_PREVIEW_ALREADY_USED", 409);

  assert.equal(mailer.sent.length, 2);
  assert.equal(db.state.audits.length, 1);
  assert.equal(db.state.audits[0].meta.result.status, "success");
});

test("parallel bulk email requests reserve the preview token at most once", async () => {
  const db = makeEmailDb();
  const mailer = makeMailer();
  const body = {
    target: "all",
    subject: "Service notice",
    text: "Scheduled maintenance",
    reason: "Notify all active recipients"
  };
  const preview = await previewBulkEmail({ db, body, now: NOW, env: ENV });
  const execute = () => executeBulkEmail({
    db,
    mailer,
    from: "service@example.test",
    body: { ...body, confirmation: preview.confirmation, previewToken: preview.previewToken },
    actorUserId: "admin-1",
    now: NOW,
    env: ENV
  });

  const results = await Promise.allSettled([execute(), execute()]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  const rejection = results.find(result => result.status === "rejected");
  assert.ok(rejection);
  assert.equal(rejection.reason?.code, "DANGEROUS_PREVIEW_ALREADY_USED");
  assert.equal(rejection.reason?.status, 409);
  assert.equal(mailer.sent.length, 2);
  assert.equal(db.state.audits.length, 1);
});

test("modified and expired preview jti values are rejected before reservation", async () => {
  const db = makeEmailDb();
  const mailer = makeMailer();
  const body = {
    target: "all",
    subject: "Service notice",
    text: "Scheduled maintenance",
    reason: "Notify all active recipients"
  };
  const preview = await previewBulkEmail({ db, body, now: NOW, env: ENV });
  const decoded = decodePreviewToken(preview.previewToken);
  assert.match(decoded.payload.jti, /^[0-9a-f-]{36}$/i);

  await expectGate(
    executeBulkEmail({
      db,
      mailer,
      from: "service@example.test",
      body: {
        ...body,
        confirmation: preview.confirmation,
        previewToken: replacePreviewJti(preview.previewToken, "00000000-0000-4000-8000-000000000000")
      },
      actorUserId: "admin-1",
      now: NOW,
      env: ENV
    }),
    "DANGEROUS_PREVIEW_INVALID"
  );
  await expectGate(
    executeBulkEmail({
      db,
      mailer,
      from: "service@example.test",
      body: { ...body, confirmation: preview.confirmation, previewToken: preview.previewToken },
      actorUserId: "admin-1",
      now: new Date(NOW.getTime() + 6 * 60 * 1000),
      env: ENV
    }),
    "DANGEROUS_PREVIEW_STALE"
  );
  assert.equal(mailer.sent.length, 0);
  assert.equal(db.state.audits.length, 0);
});

test("bulk email preview binds the actual recipient identity without exposing addresses", async () => {
  const db = makeEmailDb();
  const mailer = makeMailer();
  const body = {
    target: "all",
    subject: "Service notice",
    text: "Scheduled maintenance",
    reason: "Notify all active recipients"
  };
  const preview = await previewBulkEmail({ db, body, now: NOW, env: ENV });
  const serializedPayload = JSON.stringify(decodePreviewToken(preview.previewToken).payload);
  assert.doesNotMatch(serializedPayload, /first@example|second@example/);

  db.state.users[0].email = "replacement@example.test";
  await expectGate(
    executeBulkEmail({
      db,
      mailer,
      from: "service@example.test",
      body: { ...body, confirmation: preview.confirmation, previewToken: preview.previewToken },
      actorUserId: "admin-1",
      now: NOW,
      env: ENV
    }),
    "DANGEROUS_PREVIEW_STALE"
  );
  assert.equal(mailer.sent.length, 0);
  assert.equal(db.state.audits.length, 0);
});

test("bulk email preview reports eligible, send and truncation counts above 500", async () => {
  const users = Array.from({ length: 503 }, (_, index) => ({
    id: `u${String(index).padStart(4, "0")}`,
    email: `recipient${index}@example.test`
  }));
  const db = makeEmailDb(users);
  const preview = await previewBulkEmail({
    db,
    body: {
      target: "all",
      subject: "Service notice",
      text: "Scheduled maintenance",
      reason: "Notify all active recipients"
    },
    now: NOW,
    env: ENV
  });

  assert.equal(preview.eligibleRecipientCount, 503);
  assert.equal(preview.sendRecipientCount, 500);
  assert.equal(preview.recipientCount, 500);
  assert.equal(preview.truncated, true);
  assert.equal(preview.confirmation, "SEND BULK EMAIL 500");
  assert.doesNotMatch(JSON.stringify(decodePreviewToken(preview.previewToken).payload), /recipient\d+@example/);
});

test("selected bulk email targets above 500 are reported instead of silently truncated", async () => {
  const users = Array.from({ length: 502 }, (_, index) => ({
    id: `u${String(index).padStart(4, "0")}`,
    email: `selected${index}@example.test`
  }));
  const db = makeEmailDb(users);
  const preview = await previewBulkEmail({
    db,
    body: {
      target: "selected",
      userIds: users.map(user => user.id),
      subject: "Service notice",
      text: "Scheduled maintenance",
      reason: "Notify selected recipients"
    },
    now: NOW,
    env: ENV
  });

  assert.equal(preview.eligibleRecipientCount, 502);
  assert.equal(preview.sendRecipientCount, 500);
  assert.equal(preview.truncated, true);
});

test("ET, EN and RU expose the 500-recipient warning contract in the dashboard", async () => {
  const [et, en, ru, dashboard] = await Promise.all([
    readFile(new URL("../../messages/et.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../../messages/en.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../../messages/ru.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../../components/admin/AnalyticsDashboard.jsx", import.meta.url), "utf8")
  ]);
  for (const messages of [et, en, ru]) {
    const actions = messages.admin.analytics.users.actions;
    assert.match(actions.email_preview_counts, /\{eligible\}/);
    assert.match(actions.email_preview_counts, /\{send\}/);
    assert.match(actions.email_recipient_limit_warning, /500/);
    assert.match(actions.email_recipient_limit_warning, /\{eligible\}/);
    assert.match(actions.email_recipient_limit_warning, /\{send\}/);
  }
  assert.match(dashboard, /admin\.analytics\.users\.actions\.email_recipient_limit_warning/);
  assert.match(dashboard, /bulkEmailPreview\.truncated/);
});

test("failed bulk email recipients are address-free in the response and audit", async () => {
  const db = makeEmailDb();
  const mailer = {
    async sendMail(message) {
      if (message.to === "first@example.test") {
        throw new Error(`Delivery failed for ${message.to}`);
      }
    }
  };
  const body = {
    target: "all",
    subject: "Private subject",
    text: "Private body",
    reason: "Notify all active recipients"
  };
  const preview = await previewBulkEmail({ db, body, now: NOW, env: ENV });
  const result = await executeBulkEmail({
    db,
    mailer,
    from: "service@example.test",
    body: { ...body, confirmation: preview.confirmation, previewToken: preview.previewToken },
    actorUserId: "admin-1",
    now: NOW,
    env: ENV
  });

  assert.equal(result.failedCount, 1);
  assert.equal(result.failed[0].email, undefined);
  assert.deepEqual(result.failed[0], { recipientIndex: 0, error: "send_failed" });
  assert.doesNotMatch(JSON.stringify(result), /first@example|second@example/);
  assert.doesNotMatch(JSON.stringify(db.state.audits), /first@example|second@example|Private subject|Private body/);
  assert.equal(db.state.audits[0].ipAddress, undefined);
  assert.equal(db.state.audits[0].userAgent, undefined);
});

test("log deletion cannot run without a matching server preview", async () => {
  const db = makeLogDb();
  const body = { all: true, reason: "Remove test logs", confirmation: "DELETE LOGS 3" };
  await expectGate(
    executeLogDeletion({
      db,
      body,
      actorUserId: "admin-1",
      request: REQUEST,
      now: NOW,
      env: ENV
    }),
    "DANGEROUS_PREVIEW_REQUIRED"
  );
  assert.equal(db.state.logs.length, 3);
  assert.equal(db.state.audits.length, 0);
});

test("successful log deletion preserves exactly one new DataAuditLog row", async () => {
  const db = makeLogDb();
  const body = { all: false, event: "crisis_detected", isCrisis: "all", reason: "Remove test logs" };
  const preview = await previewLogDeletion({ db, body, now: NOW, env: ENV });
  const result = await executeLogDeletion({
    db,
    body: { ...body, confirmation: preview.confirmation, previewToken: preview.previewToken },
    actorUserId: "admin-1",
    request: REQUEST,
    now: NOW,
    env: ENV
  });
  assert.equal(result.deletedCount, 2);
  assert.equal(db.state.logs.length, 1);
  assert.equal(db.state.audits.length, 1);
  assert.equal(db.state.audits[0].action, "ADMIN_ANALYTICS_LOGS_DELETED");
  assert.equal(db.state.audits[0].meta.targetType, "filtered");
  assert.equal(db.state.audits[0].meta.deletedCount, 2);
  assert.equal(db.state.audits[0].meta.reason, body.reason);
});

test("admin protection and the explicit dry-run route contract remain in place", async () => {
  const [resetRoute, usersRoute, eventsRoute, dashboard] = await Promise.all([
    readFile(new URL("../../app/api/admin/analytics/reset/route.js", import.meta.url), "utf8"),
    readFile(new URL("../../app/api/admin/analytics/users/route.js", import.meta.url), "utf8"),
    readFile(new URL("../../app/api/admin/analytics/events/route.js", import.meta.url), "utf8"),
    readFile(new URL("../../components/admin/AnalyticsDashboard.jsx", import.meta.url), "utf8")
  ]);
  for (const route of [resetRoute, usersRoute, eventsRoute]) {
    assert.match(route, /assertAdmin\(session\)/);
    assert.match(route, /body\?\.dryRun === true/);
  }
  assert.match(resetRoute, /previewResetAction/);
  assert.match(usersRoute, /previewBulkEmail/);
  assert.match(eventsRoute, /previewLogDeletion/);
  assert.equal((dashboard.match(/window\.confirm/g) || []).length, 1);
  assert.doesNotMatch(dashboard, /admin\.analytics\.reset\.confirm_with_count/);
});
