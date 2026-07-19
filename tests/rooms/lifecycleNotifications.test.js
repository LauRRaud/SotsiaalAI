import assert from "node:assert/strict";
import test from "node:test";

import { notifyRoomOwnershipTransferred } from "../../lib/rooms/lifecycleNotifications.js";

/* T20 COLLAB-P3 (O-CO-3 b) — omanikuvahetuse üleminekuteade. */

const ROOM_ID = "room1";
const OLD_OWNER = "user_old";
const NEW_OWNER = "user_new";
const MEMBER = "user_member";

function createDb({ members = [], failFor = null } = {}) {
  const notifications = [];
  return {
    notifications,
    roomMember: {
      async findMany({ where } = {}) {
        return members
          .filter(row => row.roomId === where.roomId &&
            (where.leftAt === null ? row.leftAt == null : true) &&
            (!where.userId?.not || row.userId !== where.userId.not))
          .map(row => ({ userId: row.userId }));
      },
      async findFirst({ where } = {}) {
        return members.find(row => row.roomId === where.roomId &&
          row.userId === where.userId &&
          (where.leftAt === null ? row.leftAt == null : true)) || null;
      }
    },
    notificationEvent: {
      async create({ data } = {}) {
        if (failFor && data.userId === failFor) throw new Error("db down");
        if (notifications.some(row => row.dedupeKey === data.dedupeKey)) {
          throw Object.assign(new Error("duplicate"), { code: "P2002" });
        }
        const row = { id: `n${notifications.length + 1}`, ...data };
        notifications.push(row);
        return row;
      },
      async findUnique({ where } = {}) {
        return notifications.find(row => row.dedupeKey === where.dedupeKey) || null;
      }
    }
  };
}

test("üleminekuteade läheb uuele omanikule ja liikmetele, mitte vanale omanikule", async () => {
  const db = createDb({
    members: [
      { roomId: ROOM_ID, userId: OLD_OWNER, leftAt: null },
      { roomId: ROOM_ID, userId: NEW_OWNER, leftAt: null },
      { roomId: ROOM_ID, userId: MEMBER, leftAt: null },
      { roomId: ROOM_ID, userId: "user_left", leftAt: new Date() }
    ]
  });
  const counters = await notifyRoomOwnershipTransferred({
    db, roomId: ROOM_ID, previousOwnerId: OLD_OWNER, newOwnerId: NEW_OWNER
  });
  assert.equal(counters.created, 2);
  const recipients = db.notifications.map(n => n.userId).sort();
  assert.deepEqual(recipients, [MEMBER, NEW_OWNER].sort());
  assert.ok(db.notifications.every(n => n.type === "ROOM_OWNERSHIP_TRANSFERRED"));
  assert.ok(db.notifications.every(n => n.targetId === ROOM_ID));
});

test("ühe saaja tõrge ei kuku teisi ega viska", async () => {
  const db = createDb({
    members: [
      { roomId: ROOM_ID, userId: NEW_OWNER, leftAt: null },
      { roomId: ROOM_ID, userId: MEMBER, leftAt: null }
    ],
    failFor: NEW_OWNER
  });
  const counters = await notifyRoomOwnershipTransferred({
    db, roomId: ROOM_ID, previousOwnerId: OLD_OWNER, newOwnerId: NEW_OWNER
  });
  assert.equal(counters.failed, 1);
  assert.equal(counters.created, 1);
  assert.equal(db.notifications[0].userId, MEMBER);
});

test("puuduv sisend on ohutu no-op", async () => {
  const counters = await notifyRoomOwnershipTransferred({ db: {}, roomId: "", newOwnerId: "" });
  assert.equal(counters.skipped, 1);
});
