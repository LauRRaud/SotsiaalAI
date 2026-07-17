import test from "node:test";
import assert from "node:assert/strict";

import { createHelpMatchAndRoom, decideHelpMatch } from "../../lib/help/matches.js";

const request = {
  id: "request-1", userId: "requester", status: "OPEN", primaryCategoryId: "daily",
  primaryCategory: { code: "DAILY_TASKS" }, municipality: { displayName: "Tartu" },
  title: "Poeabi", description: "Vajan abi poes", structuredSummary: "Poeabi",
  categoryLinks: [], targetGroupLinks: [], helpType: null, timeType: null
};
const offer = {
  id: "offer-1", userId: "offerer", status: "OPEN", primaryCategoryId: "daily",
  primaryCategory: { code: "DAILY_TASKS" }, municipality: { displayName: "Tartu" },
  title: "Aitan poes", description: "Saan poes aidata", structuredSummary: "Poeabi",
  categoryLinks: [], targetGroupLinks: [], helpType: null, timeType: null
};

function createPrisma() {
  const matches = [];
  const rooms = [];
  const client = {
    async $transaction(run) { return run(client); },
    helpRequest: { async findUnique({ where }) { return where.id === request.id ? request : null; } },
    helpOffer: { async findUnique({ where }) { return where.id === offer.id ? offer : null; } },
    helpMatch: {
      async findUnique({ where }) {
        if (where.id) return matches.find((row) => row.id === where.id) || null;
        const pair = where.requestId_offerId;
        return matches.find((row) => row.requestId === pair.requestId && row.offerId === pair.offerId) || null;
      },
      async create({ data }) {
        const row = { id: `match-${matches.length + 1}`, roomId: null, createdAt: new Date(), updatedAt: new Date(), ...data };
        matches.push(row);
        return row;
      },
      async update({ where, data }) {
        const row = matches.find((item) => item.id === where.id);
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      }
    },
    room: {
      async findUnique({ where }) { return rooms.find((room) => room.id === where.id) || null; },
      async create({ data }) {
        const row = { id: `room-${rooms.length + 1}`, ...data };
        rooms.push(row);
        return row;
      },
      async update({ where, data }) {
        const row = rooms.find((room) => room.id === where.id);
        Object.assign(row, data);
        return row;
      }
    }
  };
  return { client, matches, rooms };
}

test("peer match stays pending without a room until the other participant accepts", async () => {
  const { client, rooms } = createPrisma();
  const pending = await createHelpMatchAndRoom({ requestId: request.id, offerId: offer.id, initiatedByUserId: request.userId }, client);
  assert.equal(pending.status, "PENDING");
  assert.equal(pending.roomId, null);
  assert.equal(rooms.length, 0);

  const accepted = await decideHelpMatch({ matchId: pending.id, decidedByUserId: offer.userId, decision: "ACCEPT" }, client);
  assert.equal(accepted.status, "ACCEPTED");
  assert.ok(accepted.roomId);
  assert.equal(rooms.length, 1);
});

test("initiator cannot decide and decline never creates a room", async () => {
  const { client, rooms } = createPrisma();
  const pending = await createHelpMatchAndRoom({ requestId: request.id, offerId: offer.id, initiatedByUserId: offer.userId }, client);
  await assert.rejects(() => decideHelpMatch({ matchId: pending.id, decidedByUserId: offer.userId, decision: "ACCEPT" }, client), { code: "HELP_MATCH_INITIATOR_CANNOT_DECIDE" });
  const declined = await decideHelpMatch({ matchId: pending.id, decidedByUserId: request.userId, decision: "DECLINE" }, client);
  assert.equal(declined.status, "DECLINED");
  assert.equal(declined.roomId, null);
  assert.equal(rooms.length, 0);
});

test("a match without a recorded participant initiator is rejected", async () => {
  const { client } = createPrisma();
  await assert.rejects(
    () => createHelpMatchAndRoom({ requestId: request.id, offerId: offer.id }, client),
    { code: "HELP_MATCH_INITIATOR_REQUIRED" }
  );
});
