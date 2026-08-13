import assert from "node:assert/strict";
import test from "node:test";

import { deleteJourneyForUser, updateJourneyForUser } from "../../lib/journey/service.js";

const UPDATED_AT = new Date("2026-07-17T10:00:00.000Z");

function lifecycleDb() {
  const events = [];
  let deleted = false;
  let updateCount = 0;
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
      async updateMany({ where, data }) {
        if (new Date(where.updatedAt).getTime() !== row.updatedAt.getTime()) return { count: 0 };
        Object.assign(row, data);
        updateCount += 1;
        row.updatedAt = new Date(UPDATED_AT.getTime() + updateCount * 60_000);
        return { count: 1 };
      },
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
    preInquiry: { async findMany() { return []; }, async count() { return 0; } },
    domainEvent: {
      async findMany({ take }) {
        return events.slice().reverse().slice(0, take).map((event, index) => ({ id: `event-${index}`, ...event }));
      },
      async count() { return events.length; }
    },
    async $transaction(callback) { return callback(tx); }
  };
  return { db, events, isDeleted: () => deleted, row: () => structuredClone(row) };
}

test("journey update uses CAS and exposes owner-scoped archive activity", async () => {
  const old = process.env.U1_OUTBOX_ENABLED;
  process.env.U1_OUTBOX_ENABLED = "true";
  try {
    const state = lifecycleDb();
    const journey = await updateJourneyForUser("owner_1", "journey_1", {
      status: "ARCHIVED",
      expectedUpdatedAt: UPDATED_AT.toISOString()
    }, { db: state.db });
    assert.equal(journey.status, "ARCHIVED");
    assert.equal(journey.activity[0].type, "workspace.archived");
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

test("SOL-JOUR-05: every journey PATCH requires the client-visible version", async () => {
  const state = lifecycleDb();
  await assert.rejects(
    updateJourneyForUser("owner_1", "journey_1", { title: "Changed" }, { db: state.db }),
    { status: 409, message: "journeys.errors.version_required" }
  );
  assert.equal(state.row().title, "Journey");
});

test("SOL-JOUR-06: archived content is read-only until a versioned reopen", async () => {
  const state = lifecycleDb();
  const archived = await updateJourneyForUser("owner_1", "journey_1", {
    status: "ARCHIVED",
    expectedUpdatedAt: UPDATED_AT.toISOString()
  }, { db: state.db });

  await assert.rejects(
    updateJourneyForUser("owner_1", "journey_1", {
      status: "TYPO",
      expectedUpdatedAt: archived.updatedAt
    }, { db: state.db }),
    { status: 400, message: "journeys.errors.status_invalid" }
  );
  assert.equal(state.row().status, "ARCHIVED");

  await assert.rejects(
    updateJourneyForUser("owner_1", "journey_1", {
      title: "Silent archived edit",
      expectedUpdatedAt: archived.updatedAt
    }, { db: state.db }),
    { status: 409, message: "journeys.errors.archived" }
  );
  await assert.rejects(
    updateJourneyForUser("owner_1", "journey_1", {
      status: "ACTIVE",
      expectedUpdatedAt: UPDATED_AT.toISOString()
    }, { db: state.db }),
    { status: 409, message: "journeys.errors.conflict" }
  );

  const reopened = await updateJourneyForUser("owner_1", "journey_1", {
    status: "ACTIVE",
    expectedUpdatedAt: archived.updatedAt
  }, { db: state.db });
  const edited = await updateJourneyForUser("owner_1", "journey_1", {
    title: "Edited after reopen",
    expectedUpdatedAt: reopened.updatedAt
  }, { db: state.db });

  assert.equal(edited.status, "ACTIVE");
  assert.equal(edited.title, "Edited after reopen");
  assert.deepEqual(edited.activity.map((item) => item.type), [
    "workspace.updated", "workspace.activated", "workspace.archived"
  ]);
});

test("permanent deletion requires explicit second-step confirmation and emits no content", async () => {
  const state = lifecycleDb();
  await assert.rejects(deleteJourneyForUser("owner_1", "journey_1", "", { db: state.db }), { status: 400 });
  await deleteJourneyForUser("owner_1", "journey_1", "DELETE", { db: state.db });
  assert.equal(state.isDeleted(), true);
});
