import assert from "node:assert/strict";
import test from "node:test";

import { endExpiredNetworkShares } from "../../lib/network/shareExpiry.js";

const ACTIVE = new Set(["DRAFT", "AWAITING_CLIENT", "CONFIRMED", "SENT", "OPENED", "RESPONDED"]);

function makeDb({ failRoomOnce = false } = {}) {
  const rows = [
    { id: "expired", roomId: "room-expired", status: "SENT", participationEndsOn: new Date("2026-08-12") },
    { id: "boundary", roomId: "room-boundary", status: "OPENED", participationEndsOn: new Date("2026-08-13") }
  ];
  const members = [
    { roomId: "room-expired", userId: "u1", leftAt: null },
    { roomId: "room-expired", userId: "u2", leftAt: null },
    { roomId: "room-boundary", userId: "u3", leftAt: null }
  ];
  const rooms = [
    { id: "room-expired", archivedAt: null },
    { id: "room-boundary", archivedAt: null }
  ];
  let shouldFail = failRoomOnce;

  const client = {
    networkShare: {
      async findMany() {
        return rows.filter((row) => ACTIVE.has(row.status)
          && row.participationEndsOn < new Date("2026-08-13"))
          .map(({ id, roomId }) => ({ id, roomId }));
      },
      async updateMany({ where, data }) {
        const row = rows.find((item) => item.id === where.id);
        if (!row || !ACTIVE.has(row.status) || row.participationEndsOn >= new Date("2026-08-13")) {
          return { count: 0 };
        }
        Object.assign(row, data);
        return { count: 1 };
      }
    },
    roomMember: {
      async updateMany({ where, data }) {
        if (shouldFail) {
          shouldFail = false;
          throw new Error("INJECTED_REVOKE_FAILURE");
        }
        const matched = members.filter((item) => item.roomId === where.roomId && item.leftAt === null);
        matched.forEach((item) => Object.assign(item, data));
        return { count: matched.length };
      }
    },
    room: {
      async updateMany({ where, data }) {
        const room = rooms.find((item) => item.id === where.id && item.archivedAt === null);
        if (room) Object.assign(room, data);
        return { count: room ? 1 : 0 };
      }
    }
  };
  client.$transaction = async (work) => {
    const snapshot = {
      rows: structuredClone(rows),
      members: structuredClone(members),
      rooms: structuredClone(rooms)
    };
    try {
      return await work(client);
    } catch (error) {
      rows.splice(0, rows.length, ...snapshot.rows);
      members.splice(0, members.length, ...snapshot.members);
      rooms.splice(0, rooms.length, ...snapshot.rooms);
      throw error;
    }
  };
  return { db: client, rows, members, rooms };
}

test("SOL-NET-05: sweep lõpetab ainult tähtaja ületanud jagamise ja kogu ruumipääsu", async () => {
  const state = makeDb();
  const result = await endExpiredNetworkShares({
    db: state.db,
    now: new Date("2026-08-13T23:59:59.000Z")
  });
  assert.deepEqual(result, { considered: 1, ended: 1, accessRevoked: 2, failed: 0 });
  assert.equal(state.rows.find((row) => row.id === "expired").status, "ENDED");
  assert.equal(state.rows.find((row) => row.id === "boundary").status, "OPENED");
  assert.ok(state.members.filter((row) => row.roomId === "room-expired").every((row) => row.leftAt));
  assert.equal(state.members.find((row) => row.roomId === "room-boundary").leftAt, null);
  assert.ok(state.rooms.find((room) => room.id === "room-expired").archivedAt);
});

test("SOL-NET-05: kukkunud ligipääsu eemaldus pöörab oleku tagasi ja järgmine sweep parandab", async () => {
  const state = makeDb({ failRoomOnce: true });
  const first = await endExpiredNetworkShares({ db: state.db, now: new Date("2026-08-13") });
  assert.equal(first.failed, 1);
  assert.equal(state.rows.find((row) => row.id === "expired").status, "SENT");

  const retry = await endExpiredNetworkShares({ db: state.db, now: new Date("2026-08-13") });
  assert.equal(retry.ended, 1);
  assert.equal(retry.failed, 0);
  assert.equal(state.rows.find((row) => row.id === "expired").status, "ENDED");
});
