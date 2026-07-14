import test from "node:test";
import assert from "node:assert/strict";

import {
  acceptPreInquiry,
  listVisiblePreInquiries,
  recallPreInquiry,
  sendPreInquiryCorrection,
  updatePreInquiry,
  updatePreInquiryReceiverWorkflow
} from "../../lib/preInquiries.js";

const AUTHOR = "user_author";
const RECIPIENT = "user_recipient";
const OTHER = "user_other";
const FIRST_UPDATED_AT = new Date("2026-07-14T10:00:00.000Z");

function baseInquiry(overrides = {}) {
  return {
    id: "inq_original",
    authorId: AUTHOR,
    recipientOwnerId: RECIPIENT,
    recipientEntryId: "entry_1",
    sourceJourneyId: "journey_1",
    recipientType: "KOV_CONTACT",
    deliveryChannel: "INTERNAL",
    selectedRecipientEmail: "recipient@example.test",
    selectedRecipientName: "Test recipient",
    topic: "General support",
    situation: "A general description without personal data.",
    assessmentState: { privateReceiverState: true },
    generatedDraft: "Original generated draft",
    userEditedDraft: "Original user draft",
    receiverNote: "Receiver-only note",
    receiverChecklist: { contacted: true },
    status: "SENT",
    sentAt: new Date("2026-07-14T09:00:00.000Z"),
    openedAt: null,
    recalledAt: null,
    supersededById: null,
    externalSendConfirmedAt: null,
    createdAt: new Date("2026-07-14T08:00:00.000Z"),
    updatedAt: FIRST_UPDATED_AT,
    recipientEntry: { id: "entry_1", title: "Test service" },
    author: { id: AUTHOR, email: "author@example.test", role: "CLIENT" },
    recipientOwner: { id: RECIPIENT, email: "recipient@example.test", role: "SOCIAL_WORKER" },
    ...overrides
  };
}

function sameValue(actual, expected) {
  if (actual instanceof Date || expected instanceof Date) {
    return new Date(actual).getTime() === new Date(expected).getTime();
  }
  if (expected && typeof expected === "object" && "not" in expected) {
    return expected.not === null ? actual !== null : actual !== expected.not;
  }
  return actual === expected;
}

function matches(row, where = {}) {
  return Object.entries(where).every(([key, expected]) => {
    if (key === "OR") return expected.some((branch) => matches(row, branch));
    return sameValue(row[key], expected);
  });
}

function createDb(initial, {
  failCorrectionLink = false,
  canonicalRoom = null,
  freshUpdateOverride = null
} = {}) {
  const rows = new Map(initial.map((row) => [row.id, structuredClone(row)]));
  let sequence = initial.length;
  let clock = new Date("2026-07-14T11:00:00.000Z").getTime();
  let pendingFreshUpdateOverride = freshUpdateOverride;
  const counters = { creates: 0, updates: 0 };

  const hydrate = (row) => row ? structuredClone(row) : null;
  const client = {
    preInquiry: {
      async findFirst({ where }) {
        return hydrate([...rows.values()].find((row) => matches(row, where)));
      },
      async findUnique({ where }) {
        if (pendingFreshUpdateOverride) {
          const row = rows.get(where.id);
          if (row) Object.assign(row, structuredClone(pendingFreshUpdateOverride));
          pendingFreshUpdateOverride = null;
        }
        return hydrate(rows.get(where.id));
      },
      async findMany({ where }) {
        return [...rows.values()].filter((row) => matches(row, where)).map(hydrate);
      },
      async updateMany({ where, data }) {
        const row = [...rows.values()].find((candidate) => matches(candidate, where));
        if (!row || (failCorrectionLink && data.supersededById)) return { count: 0 };
        Object.assign(row, structuredClone(data), { updatedAt: new Date(++clock) });
        counters.updates += 1;
        return { count: 1 };
      },
      async update({ where, data }) {
        const row = rows.get(where.id);
        if (!row) throw new Error("missing fake pre-inquiry");
        Object.assign(row, structuredClone(data), { updatedAt: new Date(++clock) });
        counters.updates += 1;
        return hydrate(row);
      },
      async create({ data }) {
        const id = `inq_correction_${++sequence}`;
        const createdAt = new Date(++clock);
        const row = baseInquiry({
          ...structuredClone(data),
          id,
          openedAt: null,
          recalledAt: null,
          supersededById: null,
          receiverNote: null,
          receiverChecklist: null,
          externalSendConfirmedAt: null,
          createdAt,
          updatedAt: createdAt,
          recipientEntry: { id: data.recipientEntryId, title: "Test service" },
          author: { id: data.authorId, email: "author@example.test", role: "CLIENT" },
          recipientOwner: {
            id: data.recipientOwnerId,
            email: "recipient@example.test",
            role: "SOCIAL_WORKER"
          }
        });
        rows.set(id, row);
        counters.creates += 1;
        return hydrate(row);
      }
    },
    user: {
      async findUnique({ where }) {
        if (where.email === "recipient@example.test") {
          return { id: RECIPIENT, acceptsPreInquiries: true };
        }
        return null;
      }
    },
    serviceMapEntry: {
      async findUnique({ where }) {
        if (where.id !== "entry_1") return null;
        return {
          id: "entry_1",
          type: "KOV_CONTACT",
          title: "Test service",
          email: "recipient@example.test",
          providerProfile: null
        };
      }
    },
    room: {
      async findFirst() {
        return canonicalRoom ? structuredClone(canonicalRoom) : null;
      }
    },
    async $executeRaw() {
      return 1;
    },
    async $transaction(callback) {
      const snapshot = structuredClone([...rows.entries()]);
      const beforeCounters = { ...counters };
      try {
        return await callback(client);
      } catch (error) {
        rows.clear();
        snapshot.forEach(([id, row]) => rows.set(id, row));
        counters.creates = beforeCounters.creates;
        counters.updates = beforeCounters.updates;
        throw error;
      }
    }
  };

  return {
    client,
    counters,
    row(id = "inq_original") {
      return hydrate(rows.get(id));
    },
    rows() {
      return [...rows.values()].map(hydrate);
    }
  };
}

async function rejectsWith(errorPromise, status, message) {
  await assert.rejects(errorPromise, (error) => {
    assert.equal(error.status, status);
    assert.equal(error.message, message);
    return true;
  });
}

test("recall wins before open, is idempotent, and hides the inquiry from the recipient", async () => {
  const db = createDb([baseInquiry()]);
  const recalled = await recallPreInquiry(AUTHOR, "inq_original", {
    expectedUpdatedAt: FIRST_UPDATED_AT.toISOString(),
    db: db.client
  });

  assert.ok(recalled.recalledAt);
  assert.equal(db.counters.updates, 1);
  const repeated = await recallPreInquiry(AUTHOR, "inq_original", {
    expectedUpdatedAt: "2000-01-01T00:00:00.000Z",
    db: db.client
  });
  assert.equal(new Date(repeated.recalledAt).getTime(), new Date(recalled.recalledAt).getTime());
  assert.equal(db.counters.updates, 1);

  await rejectsWith(
    acceptPreInquiry(RECIPIENT, "inq_original", { db: db.client }),
    404,
    "api.common.not_found"
  );
  assert.deepEqual(
    await listVisiblePreInquiries(RECIPIENT, { db: db.client }),
    []
  );
  assert.equal((await listVisiblePreInquiries(AUTHOR, { db: db.client })).length, 1);
});

test("an assigned draft is visible to its author but not to the recipient", async () => {
  const db = createDb([baseInquiry({ status: "DRAFT", sentAt: null })]);
  assert.deepEqual(await listVisiblePreInquiries(RECIPIENT, { db: db.client }), []);
  assert.equal((await listVisiblePreInquiries(AUTHOR, { db: db.client })).length, 1);
});

test("direct PATCH cannot rewrite an opened READY pre-inquiry", async () => {
  const openedAt = new Date("2026-07-14T10:30:00.000Z");
  const original = baseInquiry({ status: "READY", openedAt, topic: "Original topic" });
  const db = createDb([original]);

  await rejectsWith(
    updatePreInquiry(AUTHOR, original.id, { topic: "Rewritten topic" }, { db: db.client }),
    409,
    "pre_inquiries.errors.opened_cannot_be_edited"
  );
  assert.equal(db.counters.updates, 0);
  assert.equal(db.row().topic, "Original topic");
  assert.equal(new Date(db.row().openedAt).getTime(), openedAt.getTime());
});

test("direct PATCH cannot rewrite a superseded pre-inquiry", async () => {
  const original = baseInquiry({
    status: "READY",
    openedAt: null,
    supersededById: "inq_correction_existing",
    topic: "Original topic"
  });
  const db = createDb([original]);

  await rejectsWith(
    updatePreInquiry(AUTHOR, original.id, { topic: "Rewritten topic" }, { db: db.client }),
    409,
    "pre_inquiries.errors.opened_cannot_be_edited"
  );
  assert.equal(db.counters.updates, 0);
  assert.equal(db.row().topic, "Original topic");
});

test("the under-lock fresh read blocks a concurrent open before direct PATCH", async () => {
  const original = baseInquiry({ status: "READY", openedAt: null, topic: "Original topic" });
  const db = createDb([original], {
    freshUpdateOverride: { openedAt: new Date("2026-07-14T10:30:00.000Z") }
  });

  await rejectsWith(
    updatePreInquiry(AUTHOR, original.id, { topic: "Rewritten topic" }, { db: db.client }),
    409,
    "pre_inquiries.errors.opened_cannot_be_edited"
  );
  assert.equal(db.counters.updates, 0);
  assert.equal(db.row().topic, "Original topic");
});

test("unopened DRAFT and READY pre-inquiries remain directly editable", async () => {
  for (const status of ["DRAFT", "READY"]) {
    const original = baseInquiry({ status, sentAt: null, openedAt: null, topic: "Original topic" });
    const db = createDb([original]);
    const updated = await updatePreInquiry(
      AUTHOR,
      original.id,
      { topic: `${status} edited`, situation: original.situation },
      { db: db.client }
    );

    assert.equal(updated.topic, `${status} edited`);
    assert.equal(db.counters.updates, 1);
  }
});

test("trusted accept wins before recall and preserves the first openedAt", async () => {
  const db = createDb([baseInquiry()]);
  const accepted = await acceptPreInquiry(RECIPIENT, "inq_original", { db: db.client });
  assert.equal(accepted.status, "READY");
  assert.ok(accepted.openedAt);
  assert.equal(accepted.receiverNote, "Receiver-only note");
  assert.equal("email" in accepted.author, false);
  assert.equal(accepted.recipientOwner.email, "recipient@example.test");

  await rejectsWith(
    recallPreInquiry(AUTHOR, "inq_original", {
      expectedUpdatedAt: accepted.updatedAt,
      db: db.client
    }),
    409,
    "pre_inquiries.errors.already_opened"
  );

  const firstOpenedAt = accepted.openedAt;
  const workflow = await updatePreInquiryReceiverWorkflow(
    RECIPIENT,
    "inq_original",
    {
      receiverNote: "Reviewed",
      status: "ARCHIVED",
      expectedUpdatedAt: accepted.updatedAt
    },
    { db: db.client }
  );
  assert.equal(new Date(workflow.openedAt).getTime(), new Date(firstOpenedAt).getTime());
  assert.equal(workflow.status, "ARCHIVED");
});

test("receiver workflow rejects missing and stale client snapshots before writing", async () => {
  const db = createDb([baseInquiry({
    status: "READY",
    openedAt: new Date("2026-07-14T10:30:00.000Z")
  })]);

  await rejectsWith(
    updatePreInquiryReceiverWorkflow(
      RECIPIENT,
      "inq_original",
      { receiverNote: "Missing fingerprint", status: "READY" },
      { db: db.client }
    ),
    409,
    "pre_inquiries.errors.open_conflict"
  );
  await rejectsWith(
    updatePreInquiryReceiverWorkflow(
      RECIPIENT,
      "inq_original",
      {
        receiverNote: "Stale fingerprint",
        status: "READY",
        expectedUpdatedAt: "2000-01-01T00:00:00.000Z"
      },
      { db: db.client }
    ),
    409,
    "pre_inquiries.errors.open_conflict"
  );

  assert.equal(db.counters.updates, 0);
  assert.equal(db.row().receiverNote, "Receiver-only note");

  const updated = await updatePreInquiryReceiverWorkflow(
    RECIPIENT,
    "inq_original",
    {
      receiverNote: "Fresh fingerprint",
      status: "READY",
      expectedUpdatedAt: db.row().updatedAt
    },
    { db: db.client }
  );
  assert.equal(updated.receiverNote, "Fresh fingerprint");
  assert.equal(db.counters.updates, 1);
});

test("repeated acceptance never resurrects an archived receiver workflow", async () => {
  const openedAt = new Date("2026-07-14T10:30:00.000Z");
  const db = createDb([baseInquiry({ status: "ARCHIVED", openedAt })]);

  const accepted = await acceptPreInquiry(RECIPIENT, "inq_original", { db: db.client });
  assert.equal(accepted.status, "ARCHIVED");
  assert.equal(new Date(accepted.openedAt).getTime(), openedAt.getTime());
  assert.equal(db.counters.updates, 0);
});

test("stale recall and foreign ids fail without mutating state", async () => {
  const db = createDb([baseInquiry()]);
  await rejectsWith(
    recallPreInquiry(AUTHOR, "inq_original", {
      expectedUpdatedAt: "2000-01-01T00:00:00.000Z",
      db: db.client
    }),
    409,
    "pre_inquiries.errors.recall_conflict"
  );
  await rejectsWith(
    recallPreInquiry(OTHER, "inq_original", {
      expectedUpdatedAt: FIRST_UPDATED_AT,
      db: db.client
    }),
    404,
    "api.common.not_found"
  );
  assert.equal(db.row().recalledAt, null);
  assert.equal(db.counters.updates, 0);
});

test("recall is refused once a canonical shared room exists", async () => {
  const db = createDb([baseInquiry()], {
    canonicalRoom: { id: "room_existing" }
  });
  await rejectsWith(
    recallPreInquiry(AUTHOR, "inq_original", {
      expectedUpdatedAt: FIRST_UPDATED_AT,
      db: db.client
    }),
    409,
    "pre_inquiries.errors.already_opened"
  );
  assert.equal(db.row().recalledAt, null);
});

test("external email delivery is never recallable or correctable", async () => {
  const external = baseInquiry({
    recipientOwnerId: null,
    recipientOwner: null,
    deliveryChannel: "EXTERNAL_EMAIL",
    openedAt: new Date("2026-07-14T10:30:00.000Z")
  });
  const db = createDb([external]);
  await rejectsWith(
    recallPreInquiry(AUTHOR, external.id, {
      expectedUpdatedAt: FIRST_UPDATED_AT,
      db: db.client
    }),
    409,
    "pre_inquiries.errors.external_cannot_be_recalled"
  );
  await rejectsWith(
    sendPreInquiryCorrection(AUTHOR, external.id, {
      expectedUpdatedAt: FIRST_UPDATED_AT,
      situation: "Corrected general situation",
      correctionText: "Corrected general message"
    }, { db: db.client }),
    409,
    "pre_inquiries.errors.external_cannot_be_corrected"
  );
});

test("correction creates exactly one clean SENT version and repeats return it", async () => {
  const opened = baseInquiry({ openedAt: new Date("2026-07-14T10:30:00.000Z") });
  const db = createDb([opened]);
  const input = {
    expectedUpdatedAt: FIRST_UPDATED_AT.toISOString(),
    topic: "Corrected topic",
    situation: "Corrected general situation",
    correctionText: "Corrected general message"
  };

  const first = await sendPreInquiryCorrection(AUTHOR, opened.id, input, { db: db.client });
  assert.equal(first.created, true);
  assert.equal(first.inquiry.status, "SENT");
  assert.equal(first.inquiry.recipientOwnerId, RECIPIENT);
  assert.equal("receiverNote" in first.inquiry, false);
  assert.equal("receiverChecklist" in first.inquiry, false);
  assert.equal(first.inquiry.author.email, "author@example.test");
  assert.equal("email" in first.inquiry.recipientOwner, false);
  assert.equal(first.inquiry.assessmentState, null);
  assert.equal(db.row().supersededById, first.inquiry.id);

  const repeated = await sendPreInquiryCorrection(AUTHOR, opened.id, {
    ...input,
    expectedUpdatedAt: "2000-01-01T00:00:00.000Z",
    recipientOwnerId: OTHER
  }, { db: db.client });
  assert.equal(repeated.created, false);
  assert.equal(repeated.inquiry.id, first.inquiry.id);
  assert.equal(repeated.inquiry.recipientOwnerId, RECIPIENT);
  assert.equal(db.counters.creates, 1);
});

test("correction with an empty situation returns the localized contract key", async () => {
  const opened = baseInquiry({ openedAt: new Date("2026-07-14T10:30:00.000Z") });
  const db = createDb([opened]);

  await rejectsWith(
    sendPreInquiryCorrection(AUTHOR, opened.id, {
      expectedUpdatedAt: FIRST_UPDATED_AT,
      situation: "   ",
      correctionText: "Corrected general message"
    }, { db: db.client }),
    400,
    "pre_inquiries.errors.situation_required"
  );
  assert.equal(db.counters.creates, 0);
  assert.equal(db.counters.updates, 0);
});

test("a failed correction link rolls the replacement back", async () => {
  const opened = baseInquiry({ openedAt: new Date("2026-07-14T10:30:00.000Z") });
  const db = createDb([opened], { failCorrectionLink: true });
  await rejectsWith(
    sendPreInquiryCorrection(AUTHOR, opened.id, {
      expectedUpdatedAt: FIRST_UPDATED_AT,
      situation: "Corrected general situation",
      correctionText: "Corrected general message"
    }, { db: db.client }),
    409,
    "pre_inquiries.errors.correction_conflict"
  );
  assert.equal(db.rows().length, 1);
  assert.equal(db.row().supersededById, null);
  assert.equal(db.counters.creates, 0);
});

test("correction pauses for privacy confirmation and can send a redacted version", async () => {
  const opened = baseInquiry({ openedAt: new Date("2026-07-14T10:30:00.000Z") });
  const db = createDb([opened]);
  const input = {
    expectedUpdatedAt: FIRST_UPDATED_AT,
    situation: "My phone number is 51234567.",
    correctionText: "Please write to mari@example.com."
  };

  await assert.rejects(
    sendPreInquiryCorrection(AUTHOR, opened.id, input, { db: db.client }),
    (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.message, "privacy.confirmation_required");
      assert.equal(error.privacyPayload.needsPrivacyConfirmation, true);
      return true;
    }
  );
  assert.equal(db.counters.creates, 0);

  const result = await sendPreInquiryCorrection(AUTHOR, opened.id, {
    ...input,
    privacyDecision: { action: "use_redacted" }
  }, { db: db.client });
  assert.equal(result.created, true);
  assert.doesNotMatch(result.inquiry.situation, /51234567/);
  assert.doesNotMatch(result.inquiry.userEditedDraft, /mari@example\.com/);
});
