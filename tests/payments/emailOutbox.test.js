import test from "node:test";
import assert from "node:assert/strict";

import { enqueuePaymentEmail, runPaymentEmailDelivery } from "../../lib/payments/emailOutbox.js";

const NOW = new Date("2026-07-19T12:00:00.000Z");

function matchRow(row, where, _now) {
  if (where.id && row.id !== where.id) return false;
  if (where.status?.in && !where.status.in.includes(row.status)) return false;
  if (where.status && typeof where.status === "string" && row.status !== where.status) return false;
  if (where.nextAttemptAt?.lte && !(row.nextAttemptAt && new Date(row.nextAttemptAt) <= new Date(where.nextAttemptAt.lte))) return false;
  if (where.attempts?.lt !== undefined && !(Number(row.attempts) < where.attempts.lt)) return false;
  if (where.claimedAt && "lt" in where.claimedAt && !(row.claimedAt && new Date(row.claimedAt) < new Date(where.claimedAt.lt))) return false;
  if (where.claimedAt instanceof Date && Number(new Date(row.claimedAt)) !== Number(where.claimedAt)) return false;
  return true;
}

function applyData(row, data) {
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === "object" && "increment" in v) row[k] = Number(row[k] || 0) + Number(v.increment);
    else row[k] = v;
  }
}

function fakeDb({ payments = new Map() } = {}) {
  const outbox = new Map();
  let seq = 0;
  return {
    outbox,
    paymentEmailOutbox: {
      async create({ data }) {
        if ([...outbox.values()].some((r) => r.dedupeKey === data.dedupeKey)) {
          throw Object.assign(new Error("unique"), { code: "P2002" });
        }
        const row = { id: `o${++seq}`, attempts: 0, claimedAt: null, sentAt: null, lastErrorCode: null, createdAt: NOW, ...data };
        outbox.set(row.id, row);
        return { ...row };
      },
      async updateMany({ where, data }) {
        let count = 0;
        for (const row of outbox.values()) {
          if (!matchRow(row, where, NOW)) continue;
          applyData(row, data);
          count += 1;
        }
        return { count };
      },
      async findMany({ where, take }) {
        return [...outbox.values()]
          .filter((r) => matchRow(r, where, NOW))
          .sort((a, b) => (a.id < b.id ? -1 : 1))
          .slice(0, take)
          .map((r) => ({ id: r.id }));
      },
      async findUnique({ where }) {
        const r = outbox.get(where.id);
        return r ? { ...r } : null;
      }
    },
    payment: {
      async findUnique({ where }) {
        const p = payments.get(where.id);
        return p ? { ...p } : null;
      }
    }
  };
}

function stubMailer(behavior = {}) {
  const sent = [];
  return {
    sent,
    async sendMail(message) {
      if (behavior.fail) {
        throw Object.assign(new Error("smtp down"), { code: "ESMTP" });
      }
      sent.push(message);
      return { messageId: "m1" };
    }
  };
}

test("enqueue is idempotent by dedupeKey", async () => {
  const db = fakeDb();
  const first = await enqueuePaymentEmail(db, { dedupeKey: "owner:p1:PAID", template: "owner_webhook", toEmail: "ops@x.ee", locale: "en", payload: { paymentId: "p1" } });
  assert.equal(first.enqueued, true);
  const second = await enqueuePaymentEmail(db, { dedupeKey: "owner:p1:PAID", template: "owner_webhook", toEmail: "ops@x.ee", locale: "en", payload: { paymentId: "p1" } });
  assert.equal(second.enqueued, false);
  assert.equal(second.reason, "duplicate");
  assert.equal(db.outbox.size, 1);
});

test("enqueue rejects missing recipient/template", async () => {
  const db = fakeDb();
  assert.equal((await enqueuePaymentEmail(db, { dedupeKey: "x", template: "owner_webhook", toEmail: "" })).enqueued, false);
  assert.equal((await enqueuePaymentEmail(db, { dedupeKey: "x", template: "", toEmail: "a@b.ee" })).enqueued, false);
});

test("owner/customer outbox rows carry only a paymentId, no PII at rest", async () => {
  const db = fakeDb();
  await enqueuePaymentEmail(db, { dedupeKey: "owner:p1:PAID", template: "owner_webhook", toEmail: "ops@x.ee", locale: "en", payload: { paymentId: "p1", status: "PAID" } });
  const row = [...db.outbox.values()][0];
  const serialized = JSON.stringify(row.payload);
  assert.ok(serialized.includes("p1"));
  assert.ok(!/token|card|last4|@(?!x\.ee)/i.test(serialized), "no token/card/foreign email in payload");
});

test("worker sends a sponsored invite email containing the join link", async () => {
  const db = fakeDb();
  await enqueuePaymentEmail(db, {
    dedupeKey: "invite:p1",
    template: "invite_sponsored",
    toEmail: "invitee@x.ee",
    locale: "en",
    payload: { joinToken: "JOINTOKEN123", roomTitle: "Room A", inviterName: "Host", targetRole: "CLIENT" },
    now: NOW
  });
  const mailer = stubMailer();
  process.env.EMAIL_FROM = process.env.EMAIL_FROM || "noreply@sotsiaal.ai";
  const result = await runPaymentEmailDelivery({ db, now: NOW, mailer, baseUrl: "https://app.test" });
  assert.equal(result.sent, 1);
  assert.equal(mailer.sent.length, 1);
  assert.match(mailer.sent[0].text + mailer.sent[0].html, /JOINTOKEN123/);
  assert.equal([...db.outbox.values()][0].status, "SENT");
});

test("worker retries with backoff when the mailer fails, then stops sending", async () => {
  const db = fakeDb();
  await enqueuePaymentEmail(db, {
    dedupeKey: "invite:p2",
    template: "invite_sponsored",
    toEmail: "invitee@x.ee",
    locale: "en",
    payload: { joinToken: "T", roomTitle: "R", inviterName: "H", targetRole: "CLIENT" },
    now: NOW
  });
  process.env.EMAIL_FROM = process.env.EMAIL_FROM || "noreply@sotsiaal.ai";
  const result = await runPaymentEmailDelivery({ db, now: NOW, mailer: stubMailer({ fail: true }), baseUrl: "https://app.test" });
  assert.equal(result.retried, 1);
  const row = [...db.outbox.values()][0];
  assert.equal(row.status, "RETRY");
  assert.equal(row.attempts, 1);
  assert.ok(new Date(row.nextAttemptAt) > NOW, "backoff schedules a future retry");
});
