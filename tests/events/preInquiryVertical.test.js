import test from "node:test";
import assert from "node:assert/strict";
import {
  acceptPreInquiry,
  recallPreInquiry,
  updatePreInquiryReceiverWorkflow
} from "../../lib/preInquiries.js";

function inquiry(overrides = {}) {
  return {
    id: "inquiry-1",
    authorId: "author-1",
    recipientOwnerId: "recipient-1",
    recipientEntryId: null,
    sourceJourneyId: null,
    recipientType: "KOV_CONTACT",
    deliveryChannel: "INTERNAL",
    selectedRecipientEmail: null,
    selectedRecipientName: null,
    topic: "private topic",
    situation: "private situation",
    assessmentState: { private: true },
    generatedDraft: "private draft",
    userEditedDraft: "private edit",
    receiverNote: null,
    receiverChecklist: null,
    nextContactOn: null,
    status: "SENT",
    sentAt: new Date("2026-07-17T09:00:00.000Z"),
    openedAt: null,
    recalledAt: null,
    supersededById: null,
    externalSendConfirmedAt: null,
    createdAt: new Date("2026-07-17T09:00:00.000Z"),
    updatedAt: new Date("2026-07-17T09:00:00.000Z"),
    recipientEntry: null,
    author: { id: "author-1", email: "author@example.invalid", role: "CLIENT" },
    recipientOwner: { id: "recipient-1", email: "recipient@example.invalid", role: "SOCIAL_WORKER" },
    ...overrides
  };
}

function fakeDb(initial) {
  let row = inquiry(initial);
  const events = [];
  const notificationUpdates = [];
  const tx = {
    async $executeRaw() { return 1; },
    preInquiry: {
      async findUnique() { return structuredClone(row); },
      async updateMany({ data }) { row = { ...row, ...structuredClone(data) }; return { count: 1 }; }
    },
    room: { async findFirst() { return null; } },
    notificationEvent: {
      async updateMany(args) {
        notificationUpdates.push(structuredClone(args));
        return { count: 1 };
      }
    },
    domainEvent: {
      async create({ data }) {
        const event = { id: `event-${events.length + 1}`, ...structuredClone(data) };
        events.push(event);
        return event;
      },
      async findUnique({ where }) { return events.find((event) => event.idempotencyKey === where.idempotencyKey) || null; }
    }
  };
  return {
    events,
    notificationUpdates,
    get row() { return row; },
    client: {
      preInquiry: {
        async findFirst({ where }) {
          if (where.authorId && where.authorId !== row.authorId) return null;
          if (where.recipientOwnerId && where.recipientOwnerId !== row.recipientOwnerId) return null;
          if (where.recalledAt === null && row.recalledAt) return null;
          return { id: row.id };
        }
      },
      async $transaction(callback) { return callback(tx); }
    }
  };
}

test("open, reply and archive emit content-free events in the business transaction", async () => {
  const previous = process.env.U1_OUTBOX_ENABLED;
  process.env.U1_OUTBOX_ENABLED = "true";
  try {
    const db = fakeDb();
    await acceptPreInquiry("recipient-1", "inquiry-1", { db: db.client });
    assert.equal(db.events[0].type, "pre_inquiry.opened");
    assert.deepEqual(db.notificationUpdates[0].where, {
      userId: "recipient-1",
      type: "PRE_INQUIRY_ARRIVED",
      sourceType: "PRE_INQUIRY",
      sourceId: "inquiry-1",
      readAt: null
    });

    await updatePreInquiryReceiverWorkflow("recipient-1", "inquiry-1", {
      status: "READY", receiverNote: "private response", expectedUpdatedAt: db.row.updatedAt.toISOString()
    }, { db: db.client });
    assert.equal(db.events[1].type, "pre_inquiry.replied");

    await updatePreInquiryReceiverWorkflow("recipient-1", "inquiry-1", {
      status: "ARCHIVED", expectedUpdatedAt: db.row.updatedAt.toISOString()
    }, { db: db.client });
    assert.equal(db.events[2].type, "pre_inquiry.archived");
    for (const event of db.events) {
      const serialized = JSON.stringify(event.meta || {});
      for (const forbidden of ["private topic", "private situation", "private response", "private draft", "example.invalid"]) {
        assert.doesNotMatch(serialized, new RegExp(forbidden));
      }
    }
  } finally {
    if (previous === undefined) delete process.env.U1_OUTBOX_ENABLED;
    else process.env.U1_OUTBOX_ENABLED = previous;
  }
});

test("recall emits once and keeps an empty payload", async () => {
  const previous = process.env.U1_OUTBOX_ENABLED;
  process.env.U1_OUTBOX_ENABLED = "true";
  try {
    const db = fakeDb();
    await recallPreInquiry("author-1", "inquiry-1", {
      expectedUpdatedAt: db.row.updatedAt.toISOString(), db: db.client
    });
    assert.equal(db.events.length, 1);
    assert.equal(db.events[0].type, "pre_inquiry.recalled");
    assert.equal(db.events[0].meta, undefined);
    await recallPreInquiry("author-1", "inquiry-1", { db: db.client });
    assert.equal(db.events.length, 1);
  } finally {
    if (previous === undefined) delete process.env.U1_OUTBOX_ENABLED;
    else process.env.U1_OUTBOX_ENABLED = previous;
  }
});
