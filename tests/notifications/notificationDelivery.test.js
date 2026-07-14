import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { runNotificationDelivery } from "../../lib/notificationDelivery.js";

const NOW = new Date("2026-07-14T12:00:00.000Z");

function deliveryDb({ emailEnabled = true, attempts = 0 } = {}) {
  const event = {
    id: "event-1", userId: "user-1", type: "NEXT_CONTACT_DUE",
    emailPolicy: "OPTIONAL", emailStatus: "PENDING", emailAttempts: attempts,
    emailNextAttemptAt: new Date("2026-07-14T11:00:00.000Z"), emailClaimedAt: null,
    emailMessageId: "notification.stable@sotsiaal.ai",
    user: { id: "user-1", email: "person@example.test", notificationEmailEnabled: emailEnabled }
  };
  const client = {
    notificationEvent: {
      async findMany({ where }) {
        if (!["PENDING", "RETRY"].includes(event.emailStatus)) return [];
        if (event.emailAttempts >= where.emailAttempts.lt) return [];
        return [{ id: event.id }];
      },
      async findUnique({ where }) {
        return where.id === event.id ? structuredClone(event) : null;
      },
      async updateMany({ where, data }) {
        if (where.emailStatus === "SENDING" && event.emailStatus === "SENDING" && where.emailClaimedAt?.getTime() === event.emailClaimedAt?.getTime()) {
          Object.assign(event, structuredClone(data));
          return { count: 1 };
        }
        if (where.emailStatus?.in && where.emailStatus.in.includes(event.emailStatus)) {
          event.emailStatus = data.emailStatus;
          event.emailClaimedAt = data.emailClaimedAt;
          event.emailAttempts += Number(data.emailAttempts?.increment || 0);
          event.emailLastErrorCode = data.emailLastErrorCode;
          return { count: 1 };
        }
        return { count: 0 };
      }
    },
    frameworkAcceptance: {
      async findFirst() { return { locale: "en" }; }
    }
  };
  return { client, event };
}

test("parallel delivery workers claim once and reuse the stable Message-ID", async () => {
  const db = deliveryDb();
  const sent = [];
  const mailer = { async sendMail(message) { sent.push(message); } };
  const [first, second] = await Promise.all([
    runNotificationDelivery({ db: db.client, now: NOW, mailer, baseUrl: "https://sotsiaal.ai" }),
    runNotificationDelivery({ db: db.client, now: NOW, mailer, baseUrl: "https://sotsiaal.ai" })
  ]);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].messageId, "notification.stable@sotsiaal.ai");
  assert.equal(db.event.emailStatus, "SENT");
  assert.equal(first.sent + second.sent, 1);
  assert.doesNotMatch(sent[0].text, /person@example|inquiry text|room message/iu);
});

test("a fresh opt-out skips optional mail after claim", async () => {
  const db = deliveryDb({ emailEnabled: false });
  let sends = 0;
  const result = await runNotificationDelivery({
    db: db.client, now: NOW, baseUrl: "https://sotsiaal.ai",
    mailer: { async sendMail() { sends += 1; } }
  });
  assert.equal(sends, 0);
  assert.equal(result.skippedPreference, 1);
  assert.equal(db.event.emailStatus, "SKIPPED_PREFERENCE");
});

test("timeout is bounded and schedules retry with a safe code", async () => {
  const db = deliveryDb();
  const result = await runNotificationDelivery({
    db: db.client, now: NOW, timeoutMs: 5, baseUrl: "https://sotsiaal.ai",
    mailer: { sendMail() { return new Promise(() => {}); } }
  });
  assert.equal(result.retried, 1);
  assert.equal(db.event.emailStatus, "RETRY");
  assert.equal(db.event.emailLastErrorCode, "EMAIL_TIMEOUT");
  assert.ok(db.event.emailNextAttemptAt > NOW);
});

test("dry-run changes nothing and sends nothing", async () => {
  const db = deliveryDb();
  const before = structuredClone(db.event);
  let sends = 0;
  const result = await runNotificationDelivery({
    db: db.client, now: NOW, dryRun: true,
    mailer: { async sendMail() { sends += 1; } }
  });
  assert.equal(result.eligible, 1);
  assert.equal(sends, 0);
  assert.deepEqual(db.event, before);
});

test("job route is fail-closed, timing-safe, bounded, and returns counters only", async () => {
  const route = await readFile(new URL("../../app/api/jobs/notifications/route.js", import.meta.url), "utf8");
  assert.match(route, /if \(!key\) return false/u);
  assert.match(route, /timingSafeEqual/u);
  assert.match(route, /Math\.min\([^\n]+100/u);
  assert.doesNotMatch(route, /emailMessageId|inviteeEmail|selectedRecipientEmail/u);
});
