import test from "node:test";
import assert from "node:assert/strict";

import {
  shouldSendInternalArrival,
  buildInternalArrivalEmail,
  dispatchInternalArrivalEmail,
  sendInternalPreInquiryArrivalEmail
} from "../../lib/preInquiries.js";
import { readFile } from "node:fs/promises";

// A5/U1-lite: internal pre-inquiry arrival notification email.
// The email is a notification only (sign-in link, no content) and fires once,
// on the INTERNAL -> SENT transition to a platform recipient.

// --- trigger predicate ------------------------------------------------------

test("shouldSendInternalArrival fires on a fresh internal SENT to a platform recipient", () => {
  assert.equal(
    shouldSendInternalArrival({ previousStatus: null, nextStatus: "SENT", deliveryChannel: "INTERNAL", recipientOwnerId: "u1" }),
    true
  );
  assert.equal(
    shouldSendInternalArrival({ previousStatus: "DRAFT", nextStatus: "SENT", deliveryChannel: "INTERNAL", recipientOwnerId: "u1" }),
    true
  );
});

test("shouldSendInternalArrival does not double-fire when already SENT", () => {
  assert.equal(
    shouldSendInternalArrival({ previousStatus: "SENT", nextStatus: "SENT", deliveryChannel: "INTERNAL", recipientOwnerId: "u1" }),
    false
  );
});

test("shouldSendInternalArrival ignores external channel, non-SENT status, and missing recipient", () => {
  assert.equal(
    shouldSendInternalArrival({ previousStatus: null, nextStatus: "SENT", deliveryChannel: "EXTERNAL_EMAIL", recipientOwnerId: "u1" }),
    false
  );
  assert.equal(
    shouldSendInternalArrival({ previousStatus: null, nextStatus: "DRAFT", deliveryChannel: "INTERNAL", recipientOwnerId: "u1" }),
    false
  );
  assert.equal(
    shouldSendInternalArrival({ previousStatus: null, nextStatus: "SENT", deliveryChannel: "INTERNAL", recipientOwnerId: null }),
    false
  );
});

// --- notification-only email body ------------------------------------------

test("buildInternalArrivalEmail is a notification with a sign-in link and no pre-inquiry content", () => {
  const email = buildInternalArrivalEmail({ baseUrl: "https://app.example.test/" });

  assert.ok(email.subject.length > 0);
  assert.match(email.text, /Logi sisse/);
  assert.match(email.text, /https:\/\/app\.example\.test/);
  assert.doesNotMatch(email.text, /https:\/\/app\.example\.test\//); // trailing slash trimmed
  // structurally cannot carry content — the builder takes only a baseUrl
  assert.equal("topic" in email, false);
  assert.equal("situation" in email, false);
});

test("buildInternalArrivalEmail still produces a message without a base URL", () => {
  const email = buildInternalArrivalEmail({});
  assert.ok(email.text.length > 0);
  assert.match(email.text, /Logi sisse/);
});

// --- send helper (DI db + mailer) ------------------------------------------

function createFakeDb(email) {
  return {
    user: {
      async findUnique() {
        return email === undefined ? null : { email };
      }
    }
  };
}

function createFakeMailer() {
  const sent = [];
  return { sent, async sendMail(message) { sent.push(message); return { message: "ok" }; } };
}

test("sendInternalPreInquiryArrivalEmail emails the recipient with notification-only content", async () => {
  const db = createFakeDb("worker@example.test");
  const mailer = createFakeMailer();

  const result = await sendInternalPreInquiryArrivalEmail("u1", {
    db,
    mailer,
    resolveUrl: () => "https://app.example.test",
    from: "noreply@example.test"
  });

  assert.equal(result.sent, true);
  assert.equal(mailer.sent.length, 1);
  assert.equal(mailer.sent[0].to, "worker@example.test");
  assert.equal(mailer.sent[0].from, "noreply@example.test");
  assert.match(mailer.sent[0].text, /Logi sisse/);
});

test("sendInternalPreInquiryArrivalEmail skips when the recipient has no email", async () => {
  const db = createFakeDb(""); // user found but no email
  const mailer = createFakeMailer();

  const result = await sendInternalPreInquiryArrivalEmail("u1", {
    db,
    mailer,
    resolveUrl: () => "https://app.example.test",
    from: "noreply@example.test"
  });

  assert.equal(result.sent, false);
  assert.equal(result.reason, "no_recipient_email");
  assert.equal(mailer.sent.length, 0);
});

test("sendInternalPreInquiryArrivalEmail skips silently when no sender is configured", async () => {
  let dbQueried = false;
  const db = { user: { async findUnique() { dbQueried = true; return { email: "x@y.test" }; } } };
  const mailer = createFakeMailer();

  const result = await sendInternalPreInquiryArrivalEmail("u1", { db, mailer, from: "" });

  assert.equal(result.sent, false);
  assert.equal(result.reason, "no_sender");
  assert.equal(mailer.sent.length, 0);
  assert.equal(dbQueried, false, "must not query the recipient when it cannot send");
});

test("best-effort dispatch waits for and contains a mail transport failure", async () => {
  const result = await dispatchInternalArrivalEmail("u1", {
    db: createFakeDb("worker@example.test"),
    mailer: { async sendMail() { throw new Error("smtp unavailable"); } },
    resolveUrl: () => "https://app.example.test",
    from: "noreply@example.test"
  });

  assert.deepEqual(result, { sent: false, reason: "send_failed" });
});

test("create, update, and correction paths await the internal arrival attempt before returning", async () => {
  const source = await readFile(new URL("../../lib/preInquiries.js", import.meta.url), "utf8");
  const awaitedDispatches = source.match(/await dispatchInternalArrivalEmail\(/gu) || [];
  assert.equal(awaitedDispatches.length, 3);
});
