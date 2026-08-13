import test from "node:test";
import assert from "node:assert/strict";
import { confirmExternalPreInquirySent } from "../../lib/preInquiries.js";

const UPDATED_AT = new Date("2026-08-13T10:00:00.000Z");

function draft(overrides = {}) {
  return {
    id: "inquiry", authorId: "author", deliveryChannel: "EXTERNAL_EMAIL", status: "READY",
    selectedRecipientEmail: "service@example.test", recipientEntryId: "provider",
    selectedRecipientName: "Teenuseosutaja", recipientType: "SERVICE_PROVIDER",
    recipientEntry: { id: "provider", type: "SERVICE_PROVIDER" }, situation: "Abi",
    updatedAt: UPDATED_AT, externalSendConfirmedAt: null,
    ...overrides
  };
}

function transactionalDb(inquiry, currentEntry = null) {
  let updateCalls = 0;
  const db = {
    preInquiry: {
      findFirst: async () => inquiry,
      findUnique: async () => inquiry,
      updateMany: async () => { updateCalls += 1; return { count: 1 }; }
    },
    serviceMapEntry: { findFirst: async () => currentEntry },
    user: { findUnique: async () => null },
    room: { findFirst: async () => null },
    $executeRaw: async () => 1,
    $transaction: async (callback) => callback(db)
  };
  return { db, get updateCalls() { return updateCalls; } };
}

test("legacy provider email draft without stable service selection fails before confirmation", async () => {
  const fixture = transactionalDb(draft());
  await assert.rejects(
    confirmExternalPreInquirySent("author", "inquiry", {
      expectedUpdatedAt: UPDATED_AT.toISOString(),
      db: fixture.db
    }),
    (error) => error.status === 409 && error.message === "pre_inquiries.errors.recipient_channel_changed"
  );
  assert.equal(fixture.updateCalls, 0);
});

test("confirmation-time service policy switch blocks the stored email", async () => {
  const inquiry = draft({ recipientServiceId: "service", recipientLocationId: "location" });
  const currentEntry = {
    id: "provider", type: "SERVICE_PROVIDER", title: "Teenuseosutaja",
    providerProfile: {
      organizationName: "Teenuseosutaja",
      acceptsPlatformPreInquiries: true,
      acceptsEmailPreInquiries: true,
      serviceItems: [{
        id: "service", status: "PUBLISHED", mapVisible: true,
        acceptsEmailPreInquiries: false, acceptsPlatformPreInquiries: true,
        directContactAllowed: "jah", email: "service@example.test"
      }],
      serviceLocations: [{
        id: "location", status: "PUBLISHED", mapVisible: true,
        serviceLinks: [{ providerServiceId: "service" }]
      }]
    }
  };
  const fixture = transactionalDb(inquiry, currentEntry);
  await assert.rejects(
    confirmExternalPreInquirySent("author", "inquiry", {
      expectedUpdatedAt: UPDATED_AT.toISOString(),
      db: fixture.db
    }),
    (error) => error.status === 409 && error.message === "pre_inquiries.errors.recipient_channel_changed"
  );
  assert.equal(fixture.updateCalls, 0);
});
