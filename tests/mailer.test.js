import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMimeMessage,
  EmailTransportUnavailableError,
  getMailer
} from "../lib/mailer.js";

const ENV_KEYS = [
  "NODE_ENV",
  "EMAIL_SERVER",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "EMAIL_DEV_MOCK"
];

function withEmailEnv(values, callback) {
  const previous = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, values);
  delete globalThis.__sotsiaalai_mailer;
  return Promise.resolve()
    .then(callback)
    .finally(() => {
      delete globalThis.__sotsiaalai_mailer;
      for (const key of ENV_KEYS) {
        if (previous[key] === undefined) delete process.env[key];
        else process.env[key] = previous[key];
      }
    });
}

test("production without a real transport fails closed even when the dev mock flag is set", async () => {
  await withEmailEnv({ NODE_ENV: "production", EMAIL_DEV_MOCK: "true" }, async () => {
    await assert.rejects(
      getMailer("production-test").sendMail({
        to: "private@example.test",
        subject: "Private subject",
        text: "Private body"
      }),
      (error) => {
        assert.ok(error instanceof EmailTransportUnavailableError);
        assert.equal(error.code, "EMAIL_TRANSPORT_NOT_CONFIGURED");
        assert.equal(error.retryable, false);
        return true;
      }
    );
  });
});

test("development without explicit mock opt-in also fails closed", async () => {
  await withEmailEnv({ NODE_ENV: "development" }, async () => {
    await assert.rejects(
      getMailer("development-test").sendMail({ to: "private@example.test" }),
      { code: "EMAIL_TRANSPORT_NOT_CONFIGURED" }
    );
  });
});

test("explicit development mock logs only redacted delivery metadata", async () => {
  await withEmailEnv({ NODE_ENV: "development", EMAIL_DEV_MOCK: "true" }, async () => {
    const calls = [];
    const originalInfo = console.info;
    console.info = (...args) => calls.push(args);
    try {
      const result = await getMailer("mock-test").sendMail({
        to: "private@example.test",
        subject: "Sensitive subject",
        text: "Sensitive body"
      });
      assert.equal(result.mocked, true);
    } finally {
      console.info = originalInfo;
    }

    const serializedLog = JSON.stringify(calls);
    assert.doesNotMatch(serializedLog, /private@example\.test/u);
    assert.doesNotMatch(serializedLog, /Sensitive subject/u);
    assert.doesNotMatch(serializedLog, /Sensitive body/u);
    assert.match(serializedLog, /recipientCount/u);
  });
});

test("caller-supplied Message-ID is preserved and header injection is rejected", () => {
  const payload = buildMimeMessage({
    from: "noreply@example.test",
    to: "user@example.test",
    subject: "Notification",
    text: "Sign in",
    messageId: "notification-event-123@example.test"
  });
  assert.match(payload, /Message-ID: <notification-event-123@example\.test>/u);

  assert.throws(
    () => buildMimeMessage({
      from: "noreply@example.test",
      to: "user@example.test",
      subject: "Notification",
      text: "Sign in",
      messageId: "safe@example.test\r\nBcc: attacker@example.test"
    }),
    /Invalid Message-ID/u
  );
});
