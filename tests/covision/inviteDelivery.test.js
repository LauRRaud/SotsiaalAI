import test from "node:test";
import assert from "node:assert/strict";

import {
  covisionInviteDeliveryInternals,
  queueCovisionInviteDelivery,
  runCovisionInviteDelivery
} from "../../lib/covisionInviteDelivery.js";

const NOW = new Date("2026-08-14T09:00:00.000Z");

function deliveryDb(overrides = {}) {
  const participant = {
    id: "participant_1",
    covisionCaseId: "case_1",
    inviteStatus: "INVITED",
    inviteExpiresAt: new Date("2026-08-28T09:00:00.000Z"),
    ...overrides.participant
  };
  const row = {
    id: "delivery_1",
    participantId: participant.id,
    recipientEmail: "invitee@example.test",
    status: "PENDING",
    attempts: 0,
    nextAttemptAt: NOW,
    claimedAt: null,
    sentAt: null,
    messageId: covisionInviteDeliveryInternals.messageId(participant.id),
    lastErrorCode: null,
    ...overrides.row
  };
  const matchesStatus = (candidate, condition) => (
    !condition || (condition.in ? condition.in.includes(candidate) : candidate === condition)
  );
  const client = {
    covisionInviteDelivery: {
      async findMany() {
        return row.status === "PENDING" || row.status === "RETRY" ? [{ id: row.id }] : [];
      },
      async findUnique({ where }) {
        if ((where.id && where.id !== row.id) || (where.participantId && where.participantId !== row.participantId)) return null;
        return { ...structuredClone(row), participant: structuredClone(participant) };
      },
      async updateMany({ where, data }) {
        const idMatches = !where.id || where.id === row.id;
        const participantMatches = !where.participantId || where.participantId === row.participantId;
        const statusMatches = matchesStatus(row.status, where.status);
        if (!idMatches || !participantMatches || !statusMatches) return { count: 0 };
        for (const [key, value] of Object.entries(data)) {
          row[key] = value && typeof value === "object" && "increment" in value
            ? row[key] + value.increment
            : value;
        }
        return { count: 1 };
      },
      async update({ data }) {
        Object.assign(row, structuredClone(data));
        return structuredClone(row);
      },
      async create({ data }) {
        Object.assign(row, structuredClone(data));
        return structuredClone(row);
      }
    }
  };
  return { client, participant, row };
}

function withMailFrom(value, work) {
  const previousEmail = process.env.EMAIL_FROM;
  const previousSmtp = process.env.SMTP_FROM;
  if (value === null) {
    delete process.env.EMAIL_FROM;
    delete process.env.SMTP_FROM;
  } else {
    process.env.EMAIL_FROM = value;
    delete process.env.SMTP_FROM;
  }
  return Promise.resolve().then(work).finally(() => {
    if (previousEmail === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = previousEmail;
    if (previousSmtp === undefined) delete process.env.SMTP_FROM;
    else process.env.SMTP_FROM = previousSmtp;
  });
}

test("SOL-COV-04: queue is transactional, stable and resend resets the same row", async () => {
  const db = deliveryDb({ row: { status: "FAILED", attempts: 4, lastErrorCode: "ESOCKET" } });
  const firstId = db.row.id;
  const queued = await queueCovisionInviteDelivery(db.client, {
    participantId: db.participant.id,
    email: " INVITEE@example.test ",
    now: NOW
  });
  assert.equal(queued.id, firstId);
  assert.equal(db.row.status, "PENDING");
  assert.equal(db.row.attempts, 0);
  assert.equal(db.row.recipientEmail, "invitee@example.test");
  assert.equal(db.row.messageId, covisionInviteDeliveryInternals.messageId(db.participant.id));
});

test("SOL-COV-04: missing sender is a visible terminal failure", async () => withMailFrom(null, async () => {
  const db = deliveryDb();
  let sends = 0;
  const result = await runCovisionInviteDelivery({
    db: db.client,
    now: NOW,
    baseUrl: "https://example.test",
    mailer: { async sendMail() { sends += 1; } }
  });
  assert.equal(sends, 0);
  assert.equal(result.failed, 1);
  assert.equal(db.row.status, "FAILED");
  assert.equal(db.row.lastErrorCode, "EMAIL_FROM_MISSING");
}));

test("SOL-COV-04: clear SMTP failure retries with the stable Message-ID", async () => withMailFrom("notifications@example.test", async () => {
  const db = deliveryDb();
  const result = await runCovisionInviteDelivery({
    db: db.client,
    now: NOW,
    baseUrl: "https://example.test",
    mailer: { async sendMail() { throw Object.assign(new Error("down"), { code: "ESOCKET" }); } }
  });
  assert.equal(result.retried, 1);
  assert.equal(db.row.status, "RETRY");
  assert.equal(db.row.lastErrorCode, "ESOCKET");
  assert.equal(db.row.messageId, covisionInviteDeliveryInternals.messageId(db.participant.id));
}));

test("SOL-COV-04: timeout is UNKNOWN and is never blindly retried", async () => withMailFrom("notifications@example.test", async () => {
  const db = deliveryDb();
  const result = await runCovisionInviteDelivery({
    db: db.client,
    now: NOW,
    timeoutMs: 5,
    baseUrl: "https://example.test",
    mailer: { sendMail() { return new Promise(() => {}); } }
  });
  assert.equal(result.ambiguous, 1);
  assert.equal(result.retried, 0);
  assert.equal(db.row.status, "UNKNOWN");
}));

test("SOL-COV-04: successful mail contains no case content and records SENT", async () => withMailFrom("notifications@example.test", async () => {
  const db = deliveryDb();
  const sent = [];
  const result = await runCovisionInviteDelivery({
    db: db.client,
    now: NOW,
    baseUrl: "https://example.test",
    mailer: { async sendMail(message) { sent.push(message); } }
  });
  assert.equal(result.sent, 1);
  assert.equal(db.row.status, "SENT");
  assert.equal(sent[0].messageId, db.row.messageId);
  assert.match(sent[0].text, /kovisioon\?case=case_1/);
  assert.doesNotMatch(sent[0].text, /juhtumi pealkiri|case title/i);
}));
