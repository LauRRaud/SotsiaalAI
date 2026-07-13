import test from "node:test";
import assert from "node:assert/strict";

import {
  ensureRoomForPreInquiry,
  preInquiryRoomOriginType,
  buildPreInquiryRoomTitle
} from "../../lib/rooms/preInquiryRoom.js";

// A2: room de-duplication by (originType, originId) instead of a description
// text marker. Dependency-injected fake-Prisma exercises the app-level dedup
// branches; the transaction/advisory-lock are infra details (the fake runs the
// callback and no-ops the lock).

const AUTHOR = "user_author";
const RECIPIENT = "user_recipient";
const OTHER = "user_other";

function createFakeDb({ rooms = [] } = {}) {
  const created = [];
  let seq = 0;
  return {
    rooms,
    created,
    async $transaction(callback) {
      const tx = {
        async $executeRaw() {
          return 1; // advisory lock is a no-op in tests
        },
        room: {
          async findFirst({ where }) {
            const originTypes = where.originType?.in || [];
            const memberUserId = where.members?.some?.userId;
            const row = rooms.find(
              (r) =>
                originTypes.includes(r.originType) &&
                r.originId === where.originId &&
                (r.members || []).some((m) => m.userId === memberUserId && m.leftAt == null)
            );
            return row ? { id: row.id, title: row.title } : null;
          },
          async create({ data }) {
            seq += 1;
            const row = {
              id: `room_${seq}`,
              title: data.title,
              description: data.description,
              originType: data.originType,
              originId: data.originId,
              originMeta: data.originMeta,
              members: (data.members?.create || []).map((m) => ({
                userId: m.userId,
                role: m.role,
                leftAt: null
              }))
            };
            rooms.push(row);
            created.push(row);
            return { id: row.id, title: row.title };
          }
        }
      };
      return callback(tx);
    }
  };
}

const kovInquiry = {
  id: "inq_1",
  authorId: AUTHOR,
  recipientOwnerId: RECIPIENT,
  recipientType: "KOV_CONTACT",
  topic: "Eluase"
};

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

test("creates a room with the structured origin when none exists", async () => {
  const db = createFakeDb();
  const { room, created } = await ensureRoomForPreInquiry(
    { userId: AUTHOR, inquiry: kovInquiry, participantIds: [AUTHOR, RECIPIENT] },
    { db }
  );

  assert.equal(created, true);
  assert.equal(db.created.length, 1);
  assert.equal(db.created[0].originType, "PRE_INQUIRY");
  assert.equal(db.created[0].originId, "inq_1");
  assert.deepEqual(db.created[0].members.map((m) => m.userId).sort(), [AUTHOR, RECIPIENT].sort());
  assert.ok(room.id);
});

test("service-provider inquiries create a SERVICE_PROVIDER_INQUIRY room", async () => {
  const db = createFakeDb();
  await ensureRoomForPreInquiry(
    { userId: AUTHOR, inquiry: { ...kovInquiry, recipientType: "SERVICE_PROVIDER" }, participantIds: [AUTHOR, RECIPIENT] },
    { db }
  );
  assert.equal(db.created[0].originType, "SERVICE_PROVIDER_INQUIRY");
  assert.equal(db.created[0].originId, "inq_1");
});

test("reuses the existing room for the same (originType, originId) — no duplicate", async () => {
  const db = createFakeDb({
    rooms: [
      {
        id: "room_existing",
        title: "Eelpoordumine: Eluase",
        originType: "PRE_INQUIRY",
        originId: "inq_1",
        members: [
          { userId: AUTHOR, role: "OWNER", leftAt: null },
          { userId: RECIPIENT, role: "MEMBER", leftAt: null }
        ]
      }
    ]
  });

  // recipient opens after author already created the room
  const { room, created } = await ensureRoomForPreInquiry(
    { userId: RECIPIENT, inquiry: kovInquiry, participantIds: [RECIPIENT, AUTHOR] },
    { db }
  );

  assert.equal(created, false);
  assert.equal(room.id, "room_existing");
  assert.equal(db.created.length, 0, "must not create a second room");
});

test("de-dupes by originId even if recipientType changed between opens", async () => {
  // Room was first created as PRE_INQUIRY; the inquiry later became a
  // SERVICE_PROVIDER inquiry. The second open must still find the same room by
  // originId within the pre-inquiry origin set, not spawn a duplicate.
  const db = createFakeDb({
    rooms: [
      {
        id: "room_existing",
        title: "Eelpoordumine: Eluase",
        originType: "PRE_INQUIRY",
        originId: "inq_1",
        members: [
          { userId: AUTHOR, role: "OWNER", leftAt: null },
          { userId: RECIPIENT, role: "MEMBER", leftAt: null }
        ]
      }
    ]
  });

  const { room, created } = await ensureRoomForPreInquiry(
    { userId: AUTHOR, inquiry: { ...kovInquiry, recipientType: "SERVICE_PROVIDER" }, participantIds: [AUTHOR, RECIPIENT] },
    { db }
  );

  assert.equal(created, false);
  assert.equal(room.id, "room_existing");
  assert.equal(db.created.length, 0);
});

test("dedup is membership-scoped: does not reuse a room the requester is not a member of", async () => {
  const db = createFakeDb({
    rooms: [
      {
        id: "room_existing",
        title: "Eelpoordumine",
        originType: "PRE_INQUIRY",
        originId: "inq_1",
        members: [
          { userId: AUTHOR, role: "OWNER", leftAt: null },
          { userId: RECIPIENT, role: "MEMBER", leftAt: null }
        ]
      }
    ]
  });

  const { created } = await ensureRoomForPreInquiry(
    { userId: OTHER, inquiry: kovInquiry, participantIds: [OTHER, AUTHOR] },
    { db }
  );

  assert.equal(created, true, "a non-member does not silently reuse someone else's room");
  assert.equal(db.created.length, 1);
});
