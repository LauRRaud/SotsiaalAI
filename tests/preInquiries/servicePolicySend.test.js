import test from "node:test";
import assert from "node:assert/strict";
import { sendExternalPreInquiry } from "../../lib/preInquiries.js";

function draft(overrides = {}) {
  return {
    id: "inquiry", authorId: "author", deliveryChannel: "EXTERNAL_EMAIL", status: "READY",
    selectedRecipientEmail: "service@example.test", recipientEntryId: "provider",
    recipientEntry: { id: "provider", type: "SERVICE_PROVIDER" }, situation: "Abi",
    ...overrides
  };
}

test("legacy provider email draft without stable service selection fails before mail", async () => {
  let mailCalls = 0;
  const db = { preInquiry: { findFirst: async () => draft() } };
  await assert.rejects(
    sendExternalPreInquiry("author", "inquiry", { db, mailer: { sendMail: async () => { mailCalls += 1; } } }),
    (error) => error.status === 409 && error.message === "pre_inquiries.errors.recipient_channel_changed"
  );
  assert.equal(mailCalls, 0);
});

test("send-time service policy switch blocks the stored email", async () => {
  let mailCalls = 0;
  const db = {
    preInquiry: { findFirst: async () => draft({ recipientServiceId: "service", recipientLocationId: "location" }) },
    serviceMapEntry: { findFirst: async () => ({
      id: "provider", type: "SERVICE_PROVIDER",
      providerProfile: {
        acceptsEmailPreInquiries: true,
        serviceItems: [{ id: "service", acceptsEmailPreInquiries: false, email: "service@example.test" }],
        serviceLocations: [{ id: "location", serviceLinks: [{ providerServiceId: "service" }] }]
      }
    }) }
  };
  await assert.rejects(
    sendExternalPreInquiry("author", "inquiry", { db, mailer: { sendMail: async () => { mailCalls += 1; } } }),
    (error) => error.status === 409 && error.message === "pre_inquiries.errors.recipient_channel_changed"
  );
  assert.equal(mailCalls, 0);
});
