import assert from "node:assert/strict";
import test from "node:test";

import { deleteJourneyForUser, updateJourneyForUser } from "../../lib/journey/service.js";

const UPDATED_AT = new Date("2026-07-17T10:00:00.000Z");

function lifecycleDb() {
  const events = [];
  let deleted = false;
  const row = {
    id: "journey_1",
    ownerUserId: "owner_1",
    status: "ACTIVE",
    context: {},
    title: "Journey",
    summary: "Summary",
    domains: [], missingInfo: [], riskSignals: [], suggestedActions: [],
    roleContext: "CLIENT", sharingStatus: "PRIVATE",
    conversationId: null, createdAt: UPDATED_AT, updatedAt: UPDATED_AT
  };
  const tx = {
    journey: {
      async updateMany({ data }) { Object.assign(row, data); row.updatedAt = new Date("2026-07-17T10:01:00.000Z"); return { count: 1 }; },
      async findUnique() { return row; },
      async delete() { deleted = true; return row; }
    },
    domainEvent: {
      async create({ data }) { events.push(data); return data; },
      async findUnique() { return null; }
    }
  };
  const db = {
    journey: { async findFirst() { return structuredClone(row); } },
    preInquiry: { async findMany() { return []; } },
    async $transaction(callback) { return callback(tx); }
  };
  return { db, events, isDeleted: () => deleted };
}

test("journey update uses CAS, records archive activity and emits content-free event", async () => {
  const old = process.env.U1_OUTBOX_ENABLED;
  process.env.U1_OUTBOX_ENABLED = "true";
  try {
    const state = lifecycleDb();
    const journey = await updateJourneyForUser("owner_1", "journey_1", {
      status: "ARCHIVED",
      expectedUpdatedAt: UPDATED_AT.toISOString()
    }, { db: state.db });
    assert.equal(journey.status, "ARCHIVED");
    assert.equal(journey.context.activityLog.at(-1).type, "archived");
    assert.equal(state.events[0].type, "workspace.archived");
    assert.deepEqual(state.events[0].meta, { kind: "journey" });
    assert.doesNotMatch(JSON.stringify(state.events[0]), /Summary|Journey/u);
  } finally {
    process.env.U1_OUTBOX_ENABLED = old;
  }
});

test("journey update rejects stale expectedUpdatedAt", async () => {
  const state = lifecycleDb();
  await assert.rejects(
    updateJourneyForUser("owner_1", "journey_1", {
      title: "Changed",
      expectedUpdatedAt: "2026-07-17T09:59:00.000Z"
    }, { db: state.db }),
    { status: 409, message: "journeys.errors.conflict" }
  );
});

test("permanent deletion requires explicit second-step confirmation and emits no content", async () => {
  const state = lifecycleDb();
  await assert.rejects(deleteJourneyForUser("owner_1", "journey_1", "", { db: state.db }), { status: 400 });
  await deleteJourneyForUser("owner_1", "journey_1", "DELETE", { db: state.db });
  assert.equal(state.isDeleted(), true);
});
