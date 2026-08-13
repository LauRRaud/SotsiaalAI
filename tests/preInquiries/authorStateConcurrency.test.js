import test from "node:test";
import assert from "node:assert/strict";

import {
  confirmExternalPreInquirySent,
  PRE_INQUIRY_AUTHOR_STATUS_TRANSITIONS,
  reopenPreInquiry,
  updatePreInquiry
} from "../../lib/preInquiries.js";

const AUTHOR = "author-1";
const INITIAL_AT = new Date("2026-08-13T08:00:00.000Z");

test("author status transition table makes ARCHIVED terminal except for explicit reopen", () => {
  assert.deepEqual(PRE_INQUIRY_AUTHOR_STATUS_TRANSITIONS.PATCH.ARCHIVED, []);
  assert.deepEqual(PRE_INQUIRY_AUTHOR_STATUS_TRANSITIONS.PATCH.SENT, []);
  assert.deepEqual(PRE_INQUIRY_AUTHOR_STATUS_TRANSITIONS.REOPEN.ARCHIVED, ["READY"]);
  assert.ok(PRE_INQUIRY_AUTHOR_STATUS_TRANSITIONS.PATCH.DOWNLOADED.includes("READY"));
  assert.ok(!PRE_INQUIRY_AUTHOR_STATUS_TRANSITIONS.PATCH.DRAFT.includes("DOWNLOADED"));
});

function row(overrides = {}) {
  return {
    id: "inq-1",
    authorId: AUTHOR,
    recipientOwnerId: null,
    recipientOrganizationId: null,
    recipientEntryId: null,
    recipientServiceId: null,
    recipientLocationId: null,
    recipientType: "KOV_CONTACT",
    deliveryChannel: "EXTERNAL_EMAIL",
    selectedRecipientEmail: "help@example.test",
    selectedRecipientName: "Abi kontakt",
    topic: "Eluase",
    situation: "Vajan eluaseme küsimuses abi.",
    assessmentState: null,
    generatedDraft: "Tere, vajan abi.",
    userEditedDraft: "Tere, vajan abi.",
    receiverNote: null,
    receiverChecklist: null,
    nextContactOn: null,
    status: "DRAFT",
    sentAt: null,
    openedAt: null,
    recalledAt: null,
    supersededById: null,
    externalSendConfirmedAt: null,
    createdAt: INITIAL_AT,
    updatedAt: INITIAL_AT,
    recipientEntry: null,
    author: { id: AUTHOR, email: "author@example.test" },
    recipientOwner: null,
    ...overrides
  };
}

function matches(actual, expected) {
  return Object.entries(expected || {}).every(([key, value]) => {
    if (value instanceof Date) return actual?.[key]?.getTime?.() === value.getTime();
    return actual?.[key] === value;
  });
}

function createDb(initial = row()) {
  let current = { ...initial };
  let updateManyCalls = 0;
  let updateCalls = 0;
  const client = {
    preInquiry: {
      async findFirst({ where }) {
        if (!current || (where.id && current.id !== where.id)) return null;
        if (where.authorId && current.authorId !== where.authorId) return null;
        if (Array.isArray(where.OR) && !where.OR.some((clause) => matches(current, clause))) return null;
        return { ...current };
      },
      async findUnique({ where, select }) {
        if (!current || current.id !== where.id) return null;
        if (!select) return { ...current };
        return Object.fromEntries(Object.keys(select).map((key) => [key, current[key] ?? null]));
      },
      async updateMany({ where, data }) {
        updateManyCalls += 1;
        if (!current || !matches(current, where)) return { count: 0 };
        current = { ...current, ...data };
        return { count: 1 };
      },
      async update({ where, data }) {
        updateCalls += 1;
        if (!current || current.id !== where.id) throw new Error("missing row");
        current = { ...current, ...data };
        return { ...current };
      }
    },
    user: { async findUnique() { return null; } },
    room: { async findFirst() { return null; } },
    async $executeRaw() { return 1; },
    async $transaction(callback) { return callback(client); }
  };
  return {
    client,
    row: () => ({ ...current }),
    updateManyCalls: () => updateManyCalls,
    updateCalls: () => updateCalls
  };
}

test("author PATCH requires expectedUpdatedAt and stale content writes nothing", async () => {
  for (const expectedUpdatedAt of [null, "2000-01-01T00:00:00.000Z"]) {
    const db = createDb();
    const error = await updatePreInquiry(AUTHOR, "inq-1", {
      topic: "Vana vahekaardi teema",
      expectedUpdatedAt
    }, { db: db.client }).then(() => null, (reason) => reason);
    assert.equal(error?.status, 409);
    assert.equal(error?.message, "pre_inquiries.errors.edit_conflict");
    assert.equal(db.updateManyCalls(), 0);
    assert.equal(db.updateCalls(), 0);
    assert.equal(db.row().topic, "Eluase");
  }
});

test("author PATCH uses an updatedAt CAS and reports a lost race without a partial write", async () => {
  const db = createDb();
  const originalUpdateMany = db.client.preInquiry.updateMany;
  db.client.preInquiry.updateMany = async () => ({ count: 0 });

  const error = await updatePreInquiry(AUTHOR, "inq-1", {
    topic: "Uus teema",
    expectedUpdatedAt: INITIAL_AT.toISOString()
  }, { db: db.client }).then(() => null, (reason) => reason);

  assert.equal(error?.status, 409);
  assert.equal(error?.message, "pre_inquiries.errors.edit_conflict");
  assert.equal(db.row().topic, "Eluase");
  db.client.preInquiry.updateMany = originalUpdateMany;
});

test("ARCHIVED is fail-closed for ordinary PATCH until a version-safe reopen", async () => {
  const archivedAt = new Date("2026-08-13T09:00:00.000Z");
  const db = createDb(row({ status: "ARCHIVED", updatedAt: archivedAt }));

  const editError = await updatePreInquiry(AUTHOR, "inq-1", {
    topic: "Vaikne taasavamine",
    status: "DRAFT",
    expectedUpdatedAt: archivedAt.toISOString()
  }, { db: db.client }).then(() => null, (reason) => reason);
  assert.equal(editError?.status, 409);
  assert.equal(editError?.message, "pre_inquiries.errors.archived_cannot_be_edited");
  assert.equal(db.row().status, "ARCHIVED");

  const staleError = await reopenPreInquiry(AUTHOR, "inq-1", {
    expectedUpdatedAt: "2000-01-01T00:00:00.000Z",
    db: db.client
  }).then(() => null, (reason) => reason);
  assert.equal(staleError?.status, 409);
  assert.equal(db.row().status, "ARCHIVED");

  const reopened = await reopenPreInquiry(AUTHOR, "inq-1", {
    expectedUpdatedAt: archivedAt.toISOString(),
    db: db.client
  });
  assert.equal(reopened.status, "READY");
  assert.notEqual(new Date(reopened.updatedAt).getTime(), archivedAt.getTime());

  const edited = await updatePreInquiry(AUTHOR, "inq-1", {
    topic: "Teadlikult taasavatud",
    expectedUpdatedAt: reopened.updatedAt
  }, { db: db.client });
  assert.equal(edited.topic, "Teadlikult taasavatud");
});

test("external mail contract only records an explicit user confirmation and is idempotent", async () => {
  const db = createDb(row({ status: "READY" }));
  let providerSends = 0;

  const first = await confirmExternalPreInquirySent(AUTHOR, "inq-1", {
    expectedUpdatedAt: INITIAL_AT.toISOString(),
    db: db.client,
    mailer: { async sendMail() { providerSends += 1; } }
  });
  assert.equal(first.status, "SENT");
  assert.ok(first.externalSendConfirmedAt);

  const retry = await confirmExternalPreInquirySent(AUTHOR, "inq-1", {
    expectedUpdatedAt: INITIAL_AT.toISOString(),
    db: db.client,
    mailer: { async sendMail() { providerSends += 1; } }
  });
  assert.equal(retry.status, "SENT");
  assert.equal(retry.externalSendConfirmedAt, first.externalSendConfirmedAt);
  assert.equal(providerSends, 0, "server must never send a provider email in the mailto contract");
});

test("external confirmation is CAS protected and DB failure leaves a recoverable READY record", async () => {
  const db = createDb(row({ status: "READY" }));
  db.client.preInquiry.updateMany = async () => ({ count: 0 });

  const error = await confirmExternalPreInquirySent(AUTHOR, "inq-1", {
    expectedUpdatedAt: INITIAL_AT.toISOString(),
    db: db.client
  }).then(() => null, (reason) => reason);

  assert.equal(error?.status, 409);
  assert.equal(db.row().status, "READY");
  assert.equal(db.row().externalSendConfirmedAt, null);
});
