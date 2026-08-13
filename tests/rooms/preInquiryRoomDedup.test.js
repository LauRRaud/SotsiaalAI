import test from "node:test";
import assert from "node:assert/strict";

import {
  ensureRoomForPreInquiry,
  preInquiryRoomOriginType,
  buildPreInquiryRoomTitle,
  withPreInquiryRoomLock
} from "../../lib/rooms/preInquiryRoom.js";
import { assertRecipientChangeAllowed } from "../../lib/preInquiries.js";

// A2: one CANONICAL room per (originType, originId), guaranteed at the DB by the
// partial UNIQUE index. Room creation and recipient reassignment share a
// transaction-scoped advisory lock; the authoritative inquiry parties are re-read
// under the lock. Dependency-injected fake-Prisma models the inquiry, rooms and
// memberships in one shared store.
//
// NOTE: the fake `$executeRaw` is a no-op — it does NOT model the advisory lock.
// The "ordering" tests therefore verify the DETERMINISTIC OUTCOME of each order
// run SEQUENTIALLY, not real concurrency. Actual mutual exclusion is provided by
// the Postgres advisory lock + partial-unique index, exercised against a real DB
// via `npm run db:migrate:check` and the migration SQL — not here.

const AUTHOR = "user_author";
const RECIPIENT = "user_recipient";
const OTHER = "user_other";
const OLD_RECIPIENT = "user_old_recipient";
const NEW_RECIPIENT = "user_new_recipient";

function defaultInquiry(overrides = {}) {
  return {
    id: "inq_1",
    authorId: AUTHOR,
    recipientOwnerId: RECIPIENT,
    recipientType: "KOV_CONTACT",
    deliveryChannel: "INTERNAL",
    status: "READY",
    sentAt: new Date("2026-08-13T08:00:00.000Z"),
    openedAt: new Date("2026-08-13T08:05:00.000Z"),
    recalledAt: null,
    topic: "Eluase",
    selectedRecipientName: "",
    ...overrides
  };
}

for (const [label, inquiry] of [
  ["author on DRAFT", defaultInquiry({ status: "DRAFT", sentAt: null, openedAt: null })],
  ["author on SENT before recipient accept", defaultInquiry({ status: "SENT", openedAt: null })],
  ["recipient before accept", defaultInquiry({ status: "SENT", openedAt: null })]
]) {
  test(`${label} cannot create a shared room`, async () => {
    const db = createFakeDb({ inquiry });
    const userId = label.startsWith("recipient") ? RECIPIENT : AUTHOR;
    const error = await ensureRoomForPreInquiry({ userId, inquiry: { id: "inq_1" } }, { db }).then(
      () => null,
      (reason) => reason
    );
    assert.equal(error?.status, 409);
    assert.equal(db.created.length, 0);
    assert.equal(db.members.length, 0);
  });
}

test("recipient after explicit accept can create the room without a second state update", async () => {
  const db = createFakeDb();
  let inquiryUpdates = 0;
  db.preInquiry.updateMany = async () => {
    inquiryUpdates += 1;
    throw new Error("room flow must not mutate accepted inquiry state");
  };

  const result = await ensureRoomForPreInquiry({ userId: RECIPIENT, inquiry: { id: "inq_1" } }, { db });
  assert.equal(result.created, true);
  assert.equal(inquiryUpdates, 0);
  assert.equal(db.created.length, 1);
});

function createFakeDb({ inquiry = defaultInquiry(), rooms = [], members = [], createThrows = null } = {}) {
  const created = [];
  const inquiries = inquiry ? [{ ...inquiry }] : [];
  let roomSeq = 0;
  let memberSeq = 0;

  const preInquiryOps = {
    async findUnique({ where, select }) {
      const row = inquiries.find((i) => i.id === where.id);
      if (!row) return null;
      if (!select) return { ...row };
      return Object.fromEntries(Object.keys(select).map((k) => [k, row[k] ?? null]));
    },
    async update({ where, data }) {
      const row = inquiries.find((i) => i.id === where.id);
      if (row) Object.assign(row, data);
      return row ? { ...row } : null;
    },
    async updateMany({ where, data }) {
      const row = inquiries.find((i) =>
        i.id === where.id &&
        i.recipientOwnerId === where.recipientOwnerId &&
        (where.openedAt !== null || i.openedAt == null) &&
        (where.recalledAt !== null || i.recalledAt == null)
      );
      if (!row) return { count: 0 };
      Object.assign(row, data);
      return { count: 1 };
    }
  };

  const roomOps = {
    async findFirst({ where }) {
      const originTypes = where.originType?.in || [];
      const row = rooms.find((r) => originTypes.includes(r.originType) && r.originId === where.originId);
      return row ? { id: row.id, title: row.title } : null;
    },
    async create({ data }) {
      if (createThrows) throw createThrows;
      roomSeq += 1;
      const roomId = `room_${roomSeq}`;
      const row = { id: roomId, title: data.title, originType: data.originType, originId: data.originId, ownerId: data.ownerId };
      rooms.push(row);
      created.push(row);
      (data.members?.create || []).forEach((m) => {
        memberSeq += 1;
        members.push({ id: `mem_${memberSeq}`, roomId, userId: m.userId, role: m.role, leftAt: null });
      });
      return { id: row.id, title: row.title };
    }
  };

  const memberOps = {
    async findFirst({ where }) {
      const row = members.find((m) => m.roomId === where.roomId && m.userId === where.userId);
      return row ? { id: row.id, leftAt: row.leftAt } : null;
    },
    async update({ where, data }) {
      const row = members.find((m) => m.id === where.id);
      if (row) Object.assign(row, data);
      return row;
    },
    async create({ data }) {
      memberSeq += 1;
      const row = { id: `mem_${memberSeq}`, roomId: data.roomId, userId: data.userId, role: data.role, leftAt: null };
      members.push(row);
      return row;
    }
  };

  const txClient = { preInquiry: preInquiryOps, room: roomOps, roomMember: memberOps, async $executeRaw() { return 1; } };

  return {
    inquiries,
    rooms,
    members,
    created,
    preInquiry: preInquiryOps,
    room: roomOps,
    roomMember: memberOps,
    async $executeRaw() { return 1; },
    async $transaction(callback) {
      return callback(txClient);
    }
  };
}

function canonicalRoom(overrides = {}) {
  return { id: "room_canonical", title: "Eelpoordumine: Eluase", originType: "PRE_INQUIRY", originId: "inq_1", ...overrides };
}

// Mirrors updatePreInquiry's atomic recipient change: same lock + transaction.
function simulateRecipientChange(db, { inquiryId, previousRecipientOwnerId, nextRecipientOwnerId }) {
  return withPreInquiryRoomLock(inquiryId, async (tx) => {
    await assertRecipientChangeAllowed(tx, { inquiryId, previousRecipientOwnerId, nextRecipientOwnerId });
    await tx.preInquiry.update({ where: { id: inquiryId }, data: { recipientOwnerId: nextRecipientOwnerId } });
  }, { db });
}

test("preInquiryRoomOriginType maps recipient type to the room origin", () => {
  assert.equal(preInquiryRoomOriginType({ recipientType: "KOV_CONTACT" }), "PRE_INQUIRY");
  assert.equal(preInquiryRoomOriginType({ recipientType: "SERVICE_PROVIDER" }), "SERVICE_PROVIDER_INQUIRY");
  assert.equal(preInquiryRoomOriginType({}), "PRE_INQUIRY");
});

test("buildPreInquiryRoomTitle prefers topic, then author email, then fallback", () => {
  assert.equal(buildPreInquiryRoomTitle({ topic: "Eluase" }), "Eelpoordumine: Eluase");
  assert.equal(buildPreInquiryRoomTitle({ author: { email: "a@b.test" } }), "Eelpoordumine: a@b.test");
  assert.equal(buildPreInquiryRoomTitle({}), "Eelpoordumine");
});

test("creates the author-owned canonical room with both parties when none exists", async () => {
  const db = createFakeDb();
  const { room, created } = await ensureRoomForPreInquiry({ userId: AUTHOR, inquiry: { id: "inq_1" } }, { db });

  assert.equal(created, true);
  assert.equal(db.created.length, 1);
  assert.equal(db.created[0].originType, "PRE_INQUIRY");
  assert.equal(db.created[0].originId, "inq_1");
  assert.equal(db.created[0].ownerId, AUTHOR, "canonical room is owned by the author, deterministically");
  assert.deepEqual(db.members.map((m) => m.userId).sort(), [AUTHOR, RECIPIENT].sort());
  assert.ok(room.id);
});

test("service-provider inquiries create a SERVICE_PROVIDER_INQUIRY canonical room (from the fresh state)", async () => {
  const db = createFakeDb({ inquiry: defaultInquiry({ recipientType: "SERVICE_PROVIDER" }) });
  await ensureRoomForPreInquiry({ userId: AUTHOR, inquiry: { id: "inq_1" } }, { db });
  assert.equal(db.created[0].originType, "SERVICE_PROVIDER_INQUIRY");
  assert.equal(db.created[0].originId, "inq_1");
});

test("reuses the canonical room for an active member — no second room", async () => {
  const db = createFakeDb({
    rooms: [canonicalRoom()],
    members: [
      { id: "m_a", roomId: "room_canonical", userId: AUTHOR, role: "OWNER", leftAt: null },
      { id: "m_r", roomId: "room_canonical", userId: RECIPIENT, role: "MEMBER", leftAt: null }
    ]
  });

  const { room, created } = await ensureRoomForPreInquiry({ userId: RECIPIENT, inquiry: { id: "inq_1" } }, { db });

  assert.equal(created, false);
  assert.equal(room.id, "room_canonical");
  assert.equal(db.created.length, 0);
});

test("de-dupes by originId even if recipientType changed between opens", async () => {
  const db = createFakeDb({
    inquiry: defaultInquiry({ recipientType: "SERVICE_PROVIDER" }),
    rooms: [canonicalRoom()], // recorded earlier as PRE_INQUIRY
    members: [{ id: "m_a", roomId: "room_canonical", userId: AUTHOR, role: "OWNER", leftAt: null }]
  });

  const { room, created } = await ensureRoomForPreInquiry({ userId: AUTHOR, inquiry: { id: "inq_1" } }, { db });

  assert.equal(created, false);
  assert.equal(room.id, "room_canonical");
  assert.equal(db.created.length, 0);
});

test("a departed party reactivates their membership and returns the canonical room (no new room)", async () => {
  const db = createFakeDb({
    rooms: [canonicalRoom()],
    members: [
      { id: "m_a", roomId: "room_canonical", userId: AUTHOR, role: "OWNER", leftAt: null },
      { id: "m_r", roomId: "room_canonical", userId: RECIPIENT, role: "MEMBER", leftAt: new Date("2026-07-13T10:00:00Z") }
    ]
  });

  const { room, created } = await ensureRoomForPreInquiry({ userId: RECIPIENT, inquiry: { id: "inq_1" } }, { db });

  assert.equal(created, false);
  assert.equal(room.id, "room_canonical");
  assert.equal(db.created.length, 0);
  assert.equal(db.members.find((m) => m.id === "m_r").leftAt, null, "the left membership is reactivated");
});

test("an outsider (not party, not member) is denied 403 and no room is created or leaked", async () => {
  const db = createFakeDb({
    rooms: [canonicalRoom()],
    members: [
      { id: "m_a", roomId: "room_canonical", userId: AUTHOR, role: "OWNER", leftAt: null },
      { id: "m_r", roomId: "room_canonical", userId: RECIPIENT, role: "MEMBER", leftAt: null }
    ]
  });

  const error = await ensureRoomForPreInquiry({ userId: OTHER, inquiry: { id: "inq_1" } }, { db }).then(() => null, (err) => err);

  assert.ok(error instanceof Error);
  assert.equal(error.status, 403);
  assert.equal(db.created.length, 0);
  assert.ok(!db.members.some((m) => m.userId === OTHER));
});

test("a reassigned recipient with no prior membership cannot enter the previous recipient's room", async () => {
  // The inquiry now names NEW_RECIPIENT, but the canonical room was created for
  // OLD_RECIPIENT. The current recipient is a party but has no membership — it is
  // NOT minted, so the previous recipient's room and history stay private.
  const db = createFakeDb({
    inquiry: defaultInquiry({ recipientOwnerId: NEW_RECIPIENT }),
    rooms: [canonicalRoom()],
    members: [
      { id: "m_a", roomId: "room_canonical", userId: AUTHOR, role: "OWNER", leftAt: null },
      { id: "m_old", roomId: "room_canonical", userId: OLD_RECIPIENT, role: "MEMBER", leftAt: null }
    ]
  });

  const error = await ensureRoomForPreInquiry({ userId: NEW_RECIPIENT, inquiry: { id: "inq_1" } }, { db }).then(() => null, (err) => err);

  assert.ok(error instanceof Error);
  assert.equal(error.status, 403);
  assert.equal(db.created.length, 0);
  assert.ok(!db.members.some((m) => m.userId === NEW_RECIPIENT), "the reassigned recipient is not minted a membership");
});

test("P2002 falls back to the canonical room created by the racing writer", async () => {
  const p2002 = new Error("Unique constraint failed on Room_origin_singleton_unique");
  p2002.code = "P2002";
  const db = createFakeDb({
    rooms: [canonicalRoom()],
    members: [
      { id: "m_a", roomId: "room_canonical", userId: AUTHOR, role: "OWNER", leftAt: null },
      { id: "m_r", roomId: "room_canonical", userId: RECIPIENT, role: "MEMBER", leftAt: null }
    ],
    createThrows: p2002
  });
  // Force the transaction's lookup to miss (race window) while the fallback finds it.
  let firstLookup = true;
  const realFindFirst = db.room.findFirst;
  db.room.findFirst = async (args) => {
    if (firstLookup) { firstLookup = false; return null; }
    return realFindFirst(args);
  };

  const { room, created } = await ensureRoomForPreInquiry({ userId: RECIPIENT, inquiry: { id: "inq_1" } }, { db });

  assert.equal(created, false);
  assert.equal(room.id, "room_canonical");
});

test("P2002 is re-thrown when no canonical room can be resolved afterwards", async () => {
  const p2002 = new Error("Unique constraint failed");
  p2002.code = "P2002";
  const db = createFakeDb({ rooms: [], createThrows: p2002 });

  await assert.rejects(
    ensureRoomForPreInquiry({ userId: AUTHOR, inquiry: { id: "inq_1" } }, { db }),
    (error) => error?.code === "P2002"
  );
});

// --- deterministic outcome per ordering (sequential; the fake lock is a no-op,
//     so this is NOT a concurrency test — see the file header) -----------------

test("ordering A: room created first -> a later recipient change is rejected with 409", async () => {
  const db = createFakeDb({ inquiry: defaultInquiry({ recipientOwnerId: OLD_RECIPIENT }) });

  const { created } = await ensureRoomForPreInquiry({ userId: AUTHOR, inquiry: { id: "inq_1" } }, { db });
  assert.equal(created, true);

  const error = await simulateRecipientChange(db, {
    inquiryId: "inq_1",
    previousRecipientOwnerId: OLD_RECIPIENT,
    nextRecipientOwnerId: NEW_RECIPIENT
  }).then(() => null, (err) => err);

  assert.ok(error instanceof Error);
  assert.equal(error.status, 409);
  assert.equal(error.message, "pre_inquiries.errors.recipient_locked_by_room");
  // recipient stayed OLD; the room keeps the original parties
  assert.equal(db.inquiries[0].recipientOwnerId, OLD_RECIPIENT);
  assert.deepEqual(db.members.map((m) => m.userId).sort(), [AUTHOR, OLD_RECIPIENT].sort());
});

test("ordering B: recipient changed first -> the room is created with the FRESH recipient", async () => {
  const db = createFakeDb({ inquiry: defaultInquiry({ recipientOwnerId: OLD_RECIPIENT }) });

  await simulateRecipientChange(db, {
    inquiryId: "inq_1",
    previousRecipientOwnerId: OLD_RECIPIENT,
    nextRecipientOwnerId: NEW_RECIPIENT
  });
  assert.equal(db.inquiries[0].recipientOwnerId, NEW_RECIPIENT, "recipient change applied (no room yet)");

  const { created } = await ensureRoomForPreInquiry({ userId: AUTHOR, inquiry: { id: "inq_1" } }, { db });

  assert.equal(created, true);
  assert.deepEqual(db.members.map((m) => m.userId).sort(), [AUTHOR, NEW_RECIPIENT].sort());
  assert.ok(!db.members.some((m) => m.userId === OLD_RECIPIENT), "the stale recipient is not a member");
});
