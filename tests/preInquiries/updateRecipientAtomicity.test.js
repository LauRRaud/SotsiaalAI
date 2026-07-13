import test from "node:test";
import assert from "node:assert/strict";

import { updatePreInquiry } from "../../lib/preInquiries.js";

// A2 stale-snapshot regression: updatePreInquiry must resolve the recipient from
// the record RE-READ under the advisory lock, not from the pre-lock snapshot.
// Otherwise a content-only PATCH racing after a recipient change would write the
// stale recipient back.

const AUTHOR = "user_author";
const OLD_RECIPIENT = "user_old_recipient";
const NEW_RECIPIENT = "user_new_recipient";

// Models the interleaving: B read the inquiry pre-lock (OLD recipient); meanwhile
// A changed the recipient to NEW and a room was created. B now runs a
// content-only PATCH: the pre-lock read is stale, the under-lock read is current.
function createStaleSnapshotDb() {
  const base = {
    id: "inq_1",
    authorId: AUTHOR,
    recipientEntryId: null,
    recipientType: "KOV_CONTACT",
    deliveryChannel: "INTERNAL",
    status: "DRAFT",
    situation: "Kliendi olukorra kirjeldus.",
    assessmentState: null,
    generatedDraft: "Tere",
    userEditedDraft: "Tere",
    receiverNote: null,
    receiverChecklist: null,
    sentAt: null,
    externalSendConfirmedAt: null,
    createdAt: new Date("2026-07-13T09:00:00.000Z"),
    updatedAt: new Date("2026-07-13T09:00:00.000Z"),
    recipientEntry: null,
    author: { id: AUTHOR, email: "author@example.test", role: "SOCIAL_WORKER" }
  };
  // What B saw before the lock (A had not changed the recipient yet):
  const stale = {
    ...base,
    recipientOwnerId: OLD_RECIPIENT,
    selectedRecipientEmail: "old@example.test",
    selectedRecipientName: "Vana kontakt",
    topic: "Teema",
    recipientOwner: { id: OLD_RECIPIENT, email: "old@example.test", role: "CLIENT" }
  };
  // Current authoritative state (A already moved the recipient to NEW):
  const current = {
    ...base,
    recipientOwnerId: NEW_RECIPIENT,
    selectedRecipientEmail: "new@example.test",
    selectedRecipientName: "Uus kontakt",
    topic: "Teema",
    recipientOwner: { id: NEW_RECIPIENT, email: "new@example.test", role: "CLIENT" }
  };
  const users = {
    "old@example.test": { id: OLD_RECIPIENT, acceptsPreInquiries: true },
    "new@example.test": { id: NEW_RECIPIENT, acceptsPreInquiries: true }
  };
  const updates = [];

  const client = {
    preInquiry: {
      async findFirst() {
        return { ...stale }; // getVisiblePreInquiry (pre-lock) sees the stale snapshot
      },
      async findUnique({ select }) {
        if (!select) return { ...current };
        return Object.fromEntries(Object.keys(select).map((k) => [k, current[k] ?? null]));
      },
      async update({ data }) {
        updates.push(data);
        Object.assign(current, data);
        return { ...current };
      }
    },
    user: {
      async findUnique({ where }) {
        return users[where.email] || null;
      }
    },
    serviceMapEntry: {
      async findUnique() {
        return null;
      }
    },
    room: {
      async findFirst() {
        return { id: "room_canonical" }; // the shared room already exists
      }
    },
    async $executeRaw() {
      return 1;
    },
    async $transaction(callback) {
      return callback(client);
    }
  };

  return { client, updates };
}

test("a content-only update resolves the recipient from the fresh record, never the stale snapshot", async () => {
  const { client, updates } = createStaleSnapshotDb();

  // B only changes the topic; it supplies no recipient input.
  const result = await updatePreInquiry(AUTHOR, "inq_1", { topic: "Uuendatud teema" }, { db: client });

  assert.equal(updates.length, 1);
  assert.equal(
    updates[0].recipientOwnerId,
    NEW_RECIPIENT,
    "the recipient must stay the fresh NEW owner, not be clobbered back to the stale OLD one"
  );
  assert.notEqual(updates[0].recipientOwnerId, OLD_RECIPIENT);
  assert.equal(updates[0].topic, "Uuendatud teema");
  assert.equal(result.recipientOwnerId, NEW_RECIPIENT, "the persisted + returned recipient is the fresh NEW owner");
});
