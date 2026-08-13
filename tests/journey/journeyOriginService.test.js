import assert from "node:assert/strict";
import test from "node:test";

import { createJourneyForUser } from "../../lib/journey/service.js";

function journeyDb() {
  const conversations = [
    { id: "conversation-own", userId: "owner-a" },
    { id: "conversation-foreign", userId: "owner-b" }
  ];
  const journeys = [];
  const tx = {
    async $executeRawUnsafe() {},
    journey: {
      async findUnique({ where }) { return journeys.find((row) => row.id === where.id) || null; },
      async count({ where }) {
        return journeys.filter((row) => row.ownerUserId === where.ownerUserId).length;
      },
      async create({ data }) {
        const row = {
          id: `journey-${journeys.length + 1}`,
          ...data,
          createdAt: new Date("2026-08-13T10:00:00.000Z"),
          updatedAt: new Date("2026-08-13T10:00:00.000Z")
        };
        journeys.push(row);
        return row;
      }
    },
    domainEvent: {
      async findUnique() { return null; },
      async create({ data }) { return { id: "event-1", ...data }; }
    }
  };
  return {
    db: {
      conversation: {
        async findFirst({ where }) {
          return conversations.find(
            (conversation) => conversation.id === where.id && conversation.userId === where.userId
          ) || null;
        }
      },
      async $transaction(callback) { return callback(tx); }
    },
    journeys
  };
}

test("SOL-JOUR-09: Journey stores only an owner-scoped conversation origin", async () => {
  const state = journeyDb();
  const created = await createJourneyForUser("owner-a", {
    summary: "Sünteetiline teekond",
    clientActionId: "origin-own",
    conversationId: "conversation-own"
  }, { db: state.db, roleContext: "CLIENT" });

  assert.equal(created.conversationId, "conversation-own");
  assert.equal(state.journeys.length, 1);

  await assert.rejects(
    createJourneyForUser("owner-a", {
      summary: "Võõra vestluse katse",
      clientActionId: "origin-foreign",
      conversationId: "conversation-foreign"
    }, { db: state.db, roleContext: "CLIENT" }),
    { status: 400, message: "journeys.errors.conversation_not_found" }
  );
  assert.equal(state.journeys.length, 1);
});
