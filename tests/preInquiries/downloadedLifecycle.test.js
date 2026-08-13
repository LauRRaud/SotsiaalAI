import test from "node:test";
import assert from "node:assert/strict";

import {
  resolvePreInquiryEditStatus,
  preInquiryContentChanged,
  markPreInquiryDownloaded,
  updatePreInquiry
} from "../../lib/preInquiries.js";
import { buildPreInquiryDownloadContent } from "../../lib/preInquiriesQuestionnaire.js";

// A3: complete the pre-inquiry DOWNLOADED lifecycle (with Sol correction round:
// version-safe marking, closed PATCH side-channel, canonical downloadable text).

const AUTHOR = "user_author";
const RECIPIENT = "user_recipient";
const OTHER = "user_other";
const SNAPSHOT_AT = "2026-07-13T09:00:00.000Z";

// --- pure transition logic --------------------------------------------------

test("resolvePreInquiryEditStatus reverts a DOWNLOADED record to READY on a substantive edit", () => {
  assert.equal(resolvePreInquiryEditStatus({ currentStatus: "DOWNLOADED", requestedStatus: "DRAFT", contentChanged: true }), "READY");
});

test("resolvePreInquiryEditStatus keeps DOWNLOADED on a no-op edit", () => {
  assert.equal(resolvePreInquiryEditStatus({ currentStatus: "DOWNLOADED", requestedStatus: "DRAFT", contentChanged: false }), "DOWNLOADED");
});

test("resolvePreInquiryEditStatus lets a DOWNLOADED record be sent or archived even with edits", () => {
  assert.equal(resolvePreInquiryEditStatus({ currentStatus: "DOWNLOADED", requestedStatus: "SENT", contentChanged: true }), "SENT");
  assert.equal(resolvePreInquiryEditStatus({ currentStatus: "DOWNLOADED", requestedStatus: "ARCHIVED", contentChanged: true }), "ARCHIVED");
});

test("resolvePreInquiryEditStatus never lets an edit promote a record to DOWNLOADED (PATCH side-channel closed)", () => {
  assert.equal(resolvePreInquiryEditStatus({ currentStatus: "DRAFT", requestedStatus: "DOWNLOADED", contentChanged: false }), "DRAFT");
  assert.equal(resolvePreInquiryEditStatus({ currentStatus: "READY", requestedStatus: "DOWNLOADED", contentChanged: true }), "READY");
  assert.equal(resolvePreInquiryEditStatus({ currentStatus: "ARCHIVED", requestedStatus: "DOWNLOADED", contentChanged: false }), "ARCHIVED");
});

test("resolvePreInquiryEditStatus leaves ordinary requested statuses intact", () => {
  assert.equal(resolvePreInquiryEditStatus({ currentStatus: "READY", requestedStatus: "DRAFT", contentChanged: true }), "DRAFT");
  assert.equal(resolvePreInquiryEditStatus({ currentStatus: "DRAFT", requestedStatus: "DRAFT", contentChanged: false }), "DRAFT");
});

test("preInquiryContentChanged reflects every field visible in the downloaded file", () => {
  const base = { topic: "T", situation: "Olukord.", userEditedDraft: "D", assessmentState: null, selectedRecipientName: "Kontakt" };
  assert.equal(preInquiryContentChanged(base, { ...base }), false);
  assert.equal(preInquiryContentChanged(base, { ...base, topic: "T2" }), true);
  assert.equal(preInquiryContentChanged(base, { ...base, situation: "Muu olukord." }), true);
  assert.equal(preInquiryContentChanged(base, { ...base, userEditedDraft: "D2" }), true);
  // The recipient name is printed in the file ("Adressaat: ...") -> a change counts.
  assert.equal(preInquiryContentChanged(base, { ...base, selectedRecipientName: "Teine kontakt" }), true);
  // Assessment answers that surface in the export count too.
  assert.equal(preInquiryContentChanged(
    { ...base, assessmentState: { subject: { concernsAbout: "Ise" } } },
    { ...base, assessmentState: { subject: { concernsAbout: "Naaber" } } }
  ), true);
});

// --- canonical downloadable content (the client's mark/skip gate) -----------
// The editor marks DOWNLOADED only when its live content equals the saved
// snapshot's canonical text; an unsaved edit yields a different text and is NOT
// marked (A3 Sol round: point 1). These assertions pin that comparison basis.

test("buildPreInquiryDownloadContent is stable for an unchanged snapshot", () => {
  const saved = { topic: "Teema", situation: "Olukord.", userEditedDraft: "Mustand", assessmentState: null, selectedRecipientName: "Kontakt" };
  const editorMatchesSaved = { ...saved };
  assert.equal(buildPreInquiryDownloadContent(editorMatchesSaved), buildPreInquiryDownloadContent(saved));
});

test("buildPreInquiryDownloadContent differs when the editor has unsaved changes", () => {
  const saved = { topic: "Teema", situation: "Olukord.", userEditedDraft: "Mustand", assessmentState: null, selectedRecipientName: "Kontakt" };
  const editedBody = { ...saved, userEditedDraft: "Muudetud mustand" };
  const editedRecipient = { ...saved, selectedRecipientName: "Teine kontakt" };
  assert.notEqual(buildPreInquiryDownloadContent(editedBody), buildPreInquiryDownloadContent(saved));
  assert.notEqual(buildPreInquiryDownloadContent(editedRecipient), buildPreInquiryDownloadContent(saved));
});

// --- shared fake db ---------------------------------------------------------

function inquiryRow(overrides = {}) {
  return {
    id: "inq_1",
    authorId: AUTHOR,
    recipientOwnerId: RECIPIENT,
    recipientType: "KOV_CONTACT",
    recipientEntryId: null,
    deliveryChannel: "INTERNAL",
    status: "READY",
    topic: "Teema",
    situation: "Olukord.",
    userEditedDraft: "Mustand",
    generatedDraft: "Mustand",
    assessmentState: null,
    selectedRecipientEmail: "r@example.test",
    selectedRecipientName: "Kontakt",
    createdAt: new Date("2026-07-13T08:00:00.000Z"),
    updatedAt: new Date(SNAPSHOT_AT),
    ...overrides
  };
}

// Supports BOTH markPreInquiryDownloaded (findFirst + lock + findUnique(include))
// and updatePreInquiry (findUnique(select) + recipient resolution + lock).
function fakeDb(inquiry) {
  const state = inquiry ? { ...inquiry } : null;
  const updates = [];
  const users = { "r@example.test": { id: RECIPIENT, acceptsPreInquiries: true } };
  const client = {
    updates,
    get state() { return state; },
    preInquiry: {
      async findFirst({ where }) {
        if (!state || state.id !== where.id) return null;
        const visible = (where.OR || []).some(
          (c) =>
            (c.authorId !== undefined && c.authorId === state.authorId) ||
            (c.recipientOwnerId !== undefined && c.recipientOwnerId === state.recipientOwnerId)
        );
        return visible ? { ...state } : null;
      },
      async findUnique({ where, select }) {
        if (!state || state.id !== where.id) return null;
        if (!select) return { ...state };
        return Object.fromEntries(Object.keys(select).map((k) => [k, state[k] ?? null]));
      },
      async update({ data }) {
        updates.push(data);
        Object.assign(state, data);
        return { ...state };
      },
      async updateMany({ where, data }) {
        if (where.updatedAt && state.updatedAt.getTime() !== new Date(where.updatedAt).getTime()) return { count: 0 };
        updates.push(data);
        Object.assign(state, data);
        return { count: 1 };
      }
    },
    user: { async findUnique({ where }) { return users[where.email] || null; } },
    serviceMapEntry: { async findUnique() { return null; } },
    room: { async findFirst() { return null; } },
    async $executeRaw() { return 1; },
    async $transaction(cb) { return cb(client); }
  };
  return client;
}

// --- markPreInquiryDownloaded: ownership + transitions ----------------------

for (const from of ["DRAFT", "READY"]) {
  test(`markPreInquiryDownloaded: author moves ${from} -> DOWNLOADED with a matching fingerprint`, async () => {
    const db = fakeDb(inquiryRow({ status: from }));
    const result = await markPreInquiryDownloaded(AUTHOR, "inq_1", { expectedUpdatedAt: SNAPSHOT_AT, db });
    assert.equal(db.updates.length, 1);
    assert.equal(db.updates[0].status, "DOWNLOADED");
    assert.equal(result.status, "DOWNLOADED");
  });
}

test("markPreInquiryDownloaded: re-downloading an already-DOWNLOADED record is a no-op update", async () => {
  const db = fakeDb(inquiryRow({ status: "DOWNLOADED" }));
  const result = await markPreInquiryDownloaded(AUTHOR, "inq_1", { db });
  assert.equal(db.updates.length, 0);
  assert.equal(result.status, "DOWNLOADED");
});

for (const from of ["SENT", "ARCHIVED"]) {
  test(`markPreInquiryDownloaded: downloading a ${from} record does not change its state`, async () => {
    const db = fakeDb(inquiryRow({ status: from }));
    const result = await markPreInquiryDownloaded(AUTHOR, "inq_1", { db });
    assert.equal(db.updates.length, 0);
    assert.equal(result.status, from);
  });
}

test("markPreInquiryDownloaded: a recipient (not author) is forbidden (403)", async () => {
  const db = fakeDb(inquiryRow({ status: "READY" }));
  const error = await markPreInquiryDownloaded(RECIPIENT, "inq_1", { db }).then(() => null, (e) => e);
  assert.equal(error.status, 403);
  assert.equal(db.updates.length, 0);
});

test("markPreInquiryDownloaded: a foreign user gets 404 without leaking existence", async () => {
  const db = fakeDb(inquiryRow({ status: "READY" }));
  const error = await markPreInquiryDownloaded(OTHER, "inq_1", { db }).then(() => null, (e) => e);
  assert.equal(error.status, 404);
  assert.equal(db.updates.length, 0);
});

// --- markPreInquiryDownloaded: version safety -------------------------------

test("markPreInquiryDownloaded: a matching fingerprint marks the exact saved version", async () => {
  const db = fakeDb(inquiryRow({ status: "READY" }));
  const result = await markPreInquiryDownloaded(AUTHOR, "inq_1", { expectedUpdatedAt: SNAPSHOT_AT, db });
  assert.equal(result.status, "DOWNLOADED");
  assert.equal(db.updates.length, 1);
});

test("markPreInquiryDownloaded: a stale fingerprint (edit-before-mark) is a generic 409, state unchanged", async () => {
  const db = fakeDb(inquiryRow({ status: "READY" }));
  const error = await markPreInquiryDownloaded(AUTHOR, "inq_1", {
    expectedUpdatedAt: "2026-07-13T08:00:00.000Z",
    db
  }).then(() => null, (e) => e);
  assert.equal(error.status, 409);
  assert.equal(error.message, "pre_inquiries.errors.download_conflict");
  assert.equal(db.updates.length, 0);
  assert.equal(db.state.status, "READY");
});

test("markPreInquiryDownloaded: a fingerprint is MANDATORY for DRAFT/READY -> DOWNLOADED", async () => {
  // missing option entirely
  const missing = fakeDb(inquiryRow({ status: "READY" }));
  const e1 = await markPreInquiryDownloaded(AUTHOR, "inq_1", { db: missing }).then(() => null, (e) => e);
  assert.equal(e1.status, 409);
  assert.equal(e1.message, "pre_inquiries.errors.download_conflict");
  assert.equal(missing.updates.length, 0);
  assert.equal(missing.state.status, "READY");

  // explicit null
  const nulled = fakeDb(inquiryRow({ status: "DRAFT" }));
  const e2 = await markPreInquiryDownloaded(AUTHOR, "inq_1", { expectedUpdatedAt: null, db: nulled }).then(() => null, (e) => e);
  assert.equal(e2.status, 409);
  assert.equal(nulled.updates.length, 0);

  // malformed date
  const bad = fakeDb(inquiryRow({ status: "READY" }));
  const e3 = await markPreInquiryDownloaded(AUTHOR, "inq_1", { expectedUpdatedAt: "not-a-date", db: bad }).then(() => null, (e) => e);
  assert.equal(e3.status, 409);
  assert.equal(bad.updates.length, 0);
});

// --- updatePreInquiry: DOWNLOADED revert / side-channel (integration) -------

test("updatePreInquiry: editing a DOWNLOADED record's content reverts it to READY", async () => {
  const db = fakeDb(inquiryRow({ status: "DOWNLOADED" }));
  const result = await updatePreInquiry(
    AUTHOR,
    "inq_1",
    { topic: "Uus teema", situation: "Olukord.", userEditedDraft: "Mustand", status: "DRAFT", expectedUpdatedAt: db.state.updatedAt },
    { db }
  );
  assert.equal(result.status, "READY");
  assert.equal(db.state.status, "READY");
});

test("updatePreInquiry: re-saving a DOWNLOADED record without content changes keeps DOWNLOADED", async () => {
  const db = fakeDb(inquiryRow({ status: "DOWNLOADED" }));
  const result = await updatePreInquiry(
    AUTHOR,
    "inq_1",
    { topic: "Teema", situation: "Olukord.", userEditedDraft: "Mustand", status: "DRAFT", expectedUpdatedAt: db.state.updatedAt },
    { db }
  );
  assert.equal(result.status, "DOWNLOADED");
});

test("updatePreInquiry: changing a DOWNLOADED record's recipient name reverts it to READY", async () => {
  const db = fakeDb(inquiryRow({ status: "DOWNLOADED" }));
  const result = await updatePreInquiry(
    AUTHOR,
    "inq_1",
    { topic: "Teema", situation: "Olukord.", userEditedDraft: "Mustand", selectedRecipientName: "Uus Kontakt", status: "DRAFT", expectedUpdatedAt: db.state.updatedAt },
    { db }
  );
  assert.equal(result.status, "READY");
});

test("updatePreInquiry: an ordinary PATCH status:DOWNLOADED is rejected with 400 and no write", async () => {
  const db = fakeDb(inquiryRow({ status: "DRAFT" }));
  const error = await updatePreInquiry(
    AUTHOR,
    "inq_1",
    { topic: "Teema", situation: "Olukord.", userEditedDraft: "Mustand", status: "DOWNLOADED", expectedUpdatedAt: db.state.updatedAt },
    { db }
  ).then(() => null, (e) => e);
  assert.equal(error.status, 400);
  assert.equal(error.message, "api.common.invalid_request");
  assert.equal(db.updates.length, 0);
  assert.equal(db.state.status, "DRAFT");
});

// --- determinism: mark-before-edit ------------------------------------------

test("mark-before-edit: a marked record reverts to READY on a later substantive edit", async () => {
  const db = fakeDb(inquiryRow({ status: "READY" }));
  const marked = await markPreInquiryDownloaded(AUTHOR, "inq_1", { expectedUpdatedAt: SNAPSHOT_AT, db });
  assert.equal(marked.status, "DOWNLOADED");
  const edited = await updatePreInquiry(
    AUTHOR,
    "inq_1",
    { topic: "Uus teema", situation: "Olukord.", userEditedDraft: "Mustand", status: "DRAFT", expectedUpdatedAt: marked.updatedAt },
    { db }
  );
  assert.equal(edited.status, "READY");
});
