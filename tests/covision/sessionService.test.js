import test from "node:test";
import assert from "node:assert/strict";

import {
  applyCovisionSessionAction,
  assertCovisionCreator,
  getCovisionSessionForUser,
  normalizeCovisionSessionActionRequest,
  normalizeCovisionStartRequest,
  parseCovisionSessionJsonBody,
  startCovisionFromTopicSeed
} from "../../lib/covisionSession.js";

const OWNER = "user_owner";
const OTHER = "user_other";
const SEED_AT = new Date("2026-07-14T12:00:00.000Z");

function makeDb() {
  let sequence = 0;
  let clock = SEED_AT.getTime();
  const now = () => new Date((clock += 1000));
  const id = (prefix) => `${prefix}_${++sequence}`;
  const same = (a, b) => new Date(a).getTime() === new Date(b).getTime();
  const store = {
    users: [
      { id: OWNER, email: "mari@example.test", profile: { firstName: "Mari", lastName: "Maasikas" } },
      { id: OTHER, email: "aveli@example.test", profile: { firstName: "Aveli", lastName: "Saar" } }
    ],
    seeds: [{
      id: "seed_1",
      ownerId: OWNER,
      title: "Kooliskäimise tugi",
      status: "WAITING",
      sharedCardSnapshot: {
        title: "Kooliskäimise tugi",
        contextType: "child",
        caseType: "current",
        whyNow: "Puudumised on sagenenud.",
        requestedSupport: ["perspectives"],
        importance: 8,
        frozenAt: SEED_AT.toISOString()
      },
      ownerConfirmedAt: SEED_AT,
      sharedAt: SEED_AT,
      covisionCaseId: null,
      createdAt: SEED_AT,
      updatedAt: SEED_AT
    }],
    cases: [],
    participants: [],
    inviteDeliveries: [],
    auditEvents: [],
    sessions: [],
    participantStates: [],
    workItems: [],
    privateStates: [],
    snapshots: [],
    closures: [],
    followUps: [],
    packages: [],
    practices: [],
    journeySteps: [],
    parties: [],
    riskFactors: [],
    messages: [],
    summaries: [],
    calls: []
  };

  const clone = (value) => structuredClone(value);
  const applyData = (row, data) => {
    for (const [key, value] of Object.entries(data || {})) {
      if (value && typeof value === "object" && hasOwn(value, "increment")) {
        row[key] = (row[key] || 0) + value.increment;
      } else {
        row[key] = clone(value);
      }
    }
    row.updatedAt = now();
  };
  const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

  const db = {
    store,
    transactionActive: false,
    async $transaction(callback) {
      const before = structuredClone(store);
      db.transactionActive = true;
      try {
        return await callback(db);
      } catch (error) {
        for (const key of Object.keys(store)) store[key] = before[key];
        throw error;
      } finally {
        db.transactionActive = false;
      }
    },
    async $executeRaw() { return 1; },
    user: {
      async findUnique({ where }) {
        return clone(store.users.find((row) => row.email === where.email) || null);
      }
    },
    topicSeed: {
      async findFirst({ where }) {
        return clone(store.seeds.find((row) =>
          row.id === where.id && row.ownerId === where.ownerId) || null);
      },
      async updateMany({ where, data }) {
        const row = store.seeds.find((item) =>
          item.id === where.id
          && item.ownerId === where.ownerId
          && item.status === where.status
          && item.covisionCaseId === where.covisionCaseId
          && same(item.updatedAt, where.updatedAt));
        if (!row) return { count: 0 };
        applyData(row, data);
        return { count: 1 };
      },
      async update({ where, data }) {
        const row = store.seeds.find((item) => item.id === where.id);
        if (!row) throw new Error("seed missing");
        applyData(row, data);
        return clone(row);
      }
    },
    covisionCase: {
      async create({ data }) {
        const timestamp = now();
        const row = { id: id("case"), createdAt: timestamp, updatedAt: timestamp, ...clone(data) };
        store.cases.push(row);
        return clone(row);
      },
      async findUnique({ where, include }) {
        const row = store.cases.find((item) => item.id === where.id);
        if (!row) return null;
        const participants = store.participants
          .filter((item) => item.covisionCaseId === row.id)
          .map((participant) => ({
            ...clone(participant),
            user: clone(store.users.find((user) => user.id === participant.userId) || null),
            inviteDelivery: clone(store.inviteDeliveries.find((delivery) => delivery.participantId === participant.id) || null),
            sessionState: clone(
              store.participantStates.find((state) => state.participantId === participant.id) || null
            )
          }));
        const session = store.sessions.find((item) => item.covisionCaseId === row.id) || null;
        const privateUserId = include?.sessionState?.include?.privateStates?.where?.userId;
        return {
          ...clone(row),
          owner: clone(store.users.find((user) => user.id === row.ownerId) || null),
          sourceTopicSeed: clone(store.seeds.find((seed) => seed.covisionCaseId === row.id)
            ? { id: store.seeds.find((seed) => seed.covisionCaseId === row.id).id,
              status: store.seeds.find((seed) => seed.covisionCaseId === row.id).status }
            : null),
          participants,
          sessionState: session ? {
            ...clone(session),
            workItems: clone(store.workItems.filter((item) =>
              item.sessionId === session.id && item.visibility === "shared")),
            privateStates: clone(store.privateStates.filter((item) =>
              item.sessionId === session.id && item.userId === privateUserId)),
            stageSnapshots: clone(store.snapshots.filter((item) => item.sessionId === session.id))
          } : null
        };
      },
      async update({ where, data }) {
        const row = store.cases.find((item) => item.id === where.id);
        if (!row) throw new Error("case missing");
        applyData(row, data);
        return clone(row);
      }
    },
    covisionParticipant: {
      async create({ data }) {
        const timestamp = now();
        const row = { id: id("participant"), createdAt: timestamp, updatedAt: timestamp, ...clone(data) };
        store.participants.push(row);
        return clone(row);
      },
      async update({ where, data }) {
        const row = store.participants.find((item) => item.id === where.id);
        applyData(row, data);
        return clone(row);
      }
    },
    covisionInviteDelivery: {
      async findUnique({ where }) {
        return clone(store.inviteDeliveries.find((item) => (
          (where.participantId && item.participantId === where.participantId)
          || (where.id && item.id === where.id)
        )) || null);
      },
      async create({ data }) {
        const timestamp = now();
        const row = { id: id("invite_delivery"), createdAt: timestamp, updatedAt: timestamp, ...clone(data) };
        store.inviteDeliveries.push(row);
        return clone(row);
      },
      async update({ where, data }) {
        const row = store.inviteDeliveries.find((item) => (
          (where.participantId && item.participantId === where.participantId)
          || (where.id && item.id === where.id)
        ));
        applyData(row, data);
        return clone(row);
      },
      async updateMany({ where, data }) {
        const rows = store.inviteDeliveries.filter((item) => (
          (!where.participantId || item.participantId === where.participantId)
          && (!where.status?.in || where.status.in.includes(item.status))
        ));
        rows.forEach((row) => applyData(row, data));
        return { count: rows.length };
      }
    },
    covisionAuditEvent: {
      async upsert({ where, create }) {
        const existing = store.auditEvents.find((item) => item.idempotencyKey === where.idempotencyKey);
        if (existing) return clone(existing);
        const row = { id: id("audit"), ...clone(create) };
        store.auditEvents.push(row);
        return clone(row);
      }
    },
    covisionSessionState: {
      async create({ data }) {
        const timestamp = now();
        const row = {
          id: id("session"), startedAt: null, pausedAt: null, totalPausedMs: 0,
          settings: null, caseConfirmedAt: null, settingsConfirmedAt: null,
          createdAt: timestamp, updatedAt: timestamp, ...clone(data)
        };
        store.sessions.push(row);
        return clone(row);
      },
      async updateMany({ where, data }) {
        const row = store.sessions.find((item) => item.id === where.id && item.version === where.version);
        if (!row) return { count: 0 };
        applyData(row, data);
        return { count: 1 };
      },
      async update({ where, data }) {
        const row = store.sessions.find((item) => item.id === where.id);
        if (!row) throw new Error("session missing");
        applyData(row, data);
        return clone(row);
      }
    },
    covisionJourneyStep: {
      async deleteMany({ where }) {
        const before = store.journeySteps.length;
        store.journeySteps = store.journeySteps.filter((item) => item.covisionCaseId !== where.covisionCaseId);
        return { count: before - store.journeySteps.length };
      }
    },
    covisionParty: {
      async deleteMany({ where }) {
        const before = store.parties.length;
        store.parties = store.parties.filter((item) => item.covisionCaseId !== where.covisionCaseId);
        return { count: before - store.parties.length };
      }
    },
    covisionRiskFactor: {
      async deleteMany({ where }) {
        const before = store.riskFactors.length;
        store.riskFactors = store.riskFactors.filter((item) => item.covisionCaseId !== where.covisionCaseId);
        return { count: before - store.riskFactors.length };
      }
    },
    covisionMessage: {
      async deleteMany({ where }) {
        const before = store.messages.length;
        store.messages = store.messages.filter((item) => item.covisionCaseId !== where.covisionCaseId);
        return { count: before - store.messages.length };
      }
    },
    covisionSummary: {
      async deleteMany({ where }) {
        const before = store.summaries.length;
        store.summaries = store.summaries.filter((item) => item.covisionCaseId !== where.covisionCaseId);
        return { count: before - store.summaries.length };
      }
    },
    callSession: {
      async deleteMany({ where }) {
        const before = store.calls.length;
        store.calls = store.calls.filter((item) => item.contextType !== where.contextType || item.contextId !== where.contextId);
        return { count: before - store.calls.length };
      }
    },
    covisionParticipantState: {
      async create({ data }) {
        const timestamp = now();
        const row = {
          id: id("participant_state"), presentAt: null, roleConfirmedAt: null,
          agreementConfirmedAt: null, readyAt: null,
          createdAt: timestamp, updatedAt: timestamp, ...clone(data)
        };
        store.participantStates.push(row);
        return clone(row);
      },
      async update({ where, data }) {
        const row = store.participantStates.find((item) => item.participantId === where.participantId);
        applyData(row, data);
        return clone(row);
      }
    },
    covisionWorkItem: {
      async create({ data }) {
        const timestamp = now();
        const row = { id: id("work"), createdAt: timestamp, updatedAt: timestamp, ...clone(data) };
        store.workItems.push(row);
        return clone(row);
      },
      async findMany({ where }) {
        return clone(store.workItems.filter((item) =>
          item.sessionId === where.sessionId
          && item.stage === where.stage
          && item.visibility === where.visibility
          && item.status !== where.status?.not));
      },
      async findFirst({ where }) {
        return clone(store.workItems.find((item) =>
          (where.id === undefined
            || (typeof where.id === "object" ? item.id !== where.id.not : item.id === where.id))
          && item.sessionId === where.sessionId
          && item.stage === where.stage
          && (where.visibility === undefined || item.visibility === where.visibility)
          && (where.status === undefined || item.status === where.status)) || null);
      },
      async update({ where, data }) {
        const row = store.workItems.find((item) => item.id === where.id);
        applyData(row, data);
        return clone(row);
      },
      async deleteMany({ where }) {
        const before = store.workItems.length;
        store.workItems = store.workItems.filter((item) => item.sessionId !== where.sessionId);
        return { count: before - store.workItems.length };
      }
    },
    covisionPrivateState: {
      async findMany({ where }) {
        return clone(store.privateStates.filter((item) =>
          item.sessionId === where.sessionId && item.stage === where.stage));
      },
      async findFirst({ where }) {
        return clone(store.privateStates.find((item) =>
          item.sessionId === where.sessionId
          && item.userId === where.userId
          && item.stage === where.stage
          && (where.kind === undefined || item.kind === where.kind)) || null);
      },
      async create({ data }) {
        const timestamp = now();
        const row = {
          id: id("private"), version: 0, createdAt: timestamp, updatedAt: timestamp, ...clone(data)
        };
        store.privateStates.push(row);
        return clone(row);
      },
      async update({ where, data }) {
        const row = store.privateStates.find((item) => item.id === where.id);
        applyData(row, data);
        return clone(row);
      },
      async deleteMany({ where }) {
        const before = store.privateStates.length;
        store.privateStates = store.privateStates.filter((item) => item.sessionId !== where.sessionId);
        return { count: before - store.privateStates.length };
      }
    },
    covisionStageSnapshot: {
      async findFirst({ where }) {
        return clone(store.snapshots.find((item) =>
          item.sessionId === where.sessionId && item.stage === where.stage) || null);
      },
      async create({ data }) {
        const row = { id: id("snapshot"), completedAt: now(), ...clone(data) };
        store.snapshots.push(row);
        return clone(row);
      },
      async update({ where, data }) {
        const row = store.snapshots.find((item) => item.id === where.id);
        applyData(row, data);
        return clone(row);
      },
      async deleteMany({ where }) {
        const before = store.snapshots.length;
        store.snapshots = store.snapshots.filter((item) => {
          if (item.sessionId !== where.sessionId) return true;
          if (where.stage?.not != null) return item.stage === where.stage.not;
          if (where.stage?.lt != null) return item.stage >= where.stage.lt;
          return false;
        });
        return { count: before - store.snapshots.length };
      }
    },
    covisionClosure: {
      async findUnique({ where }) {
        return clone(store.closures.find((item) => (
          where.id ? item.id === where.id : item.covisionCaseId === where.covisionCaseId
        )) || null);
      },
      async create({ data }) {
        const timestamp = now();
        const { followUps, ownerPackage, ...fields } = data;
        const row = {
          id: id("closure"), version: 0, createdAt: timestamp, updatedAt: timestamp,
          ...clone(fields)
        };
        store.closures.push(row);
        if (followUps?.create) {
          store.followUps.push({
            id: id("followup"), closureId: row.id, createdAt: timestamp, updatedAt: timestamp,
            ...clone(followUps.create)
          });
        }
        if (ownerPackage?.create) {
          store.packages.push({
            id: id("package"), closureId: row.id, createdAt: timestamp, updatedAt: timestamp,
            ...clone(ownerPackage.create)
          });
        }
        return clone(row);
      }
    },
    effectivePractice: {
      async findUnique({ where }) {
        return clone(store.practices.find((item) => (
          item.sourceClosureId === where.sourceClosureId
        )) || null);
      },
      async create({ data }) {
        const timestamp = now();
        const row = {
          id: id("practice"),
          createdAt: timestamp,
          updatedAt: timestamp,
          ...clone(data)
        };
        store.practices.push(row);
        return clone(row);
      }
    }
  };
  return db;
}

async function start(db) {
  return startCovisionFromTopicSeed(OWNER, "seed_1", {
    expectedUpdatedAt: SEED_AT.toISOString(),
    db
  });
}

async function act(db, caseId, action, expectedVersion, payload = {}) {
  return applyCovisionSessionAction(OWNER, caseId, { action, expectedVersion, payload }, { db });
}

test("TopicSeed handoff creates one linked case, owner participant and version-zero session", async () => {
  const db = makeDb();
  const result = await start(db);
  assert.equal(result.created, true);
  assert.equal(db.store.seeds[0].status, "IN_COVISION");
  assert.equal(db.store.seeds[0].covisionCaseId, result.covisionCaseId);
  assert.equal(db.store.cases.length, 1);
  assert.equal(db.store.participants[0].role, "OWNER");
  assert.equal(db.store.participants[0].inviteStatus, "ACCEPTED");
  assert.equal(result.session.session.version, 0);
  assert.equal(result.session.session.phase, "waiting_room");
  assert.equal(result.session.participants[0].displayName, "Mari Maasikas");
  assert.equal(JSON.stringify(result.session.participants[0]).includes("email"), false);
  assert.equal(JSON.stringify(result.session).includes("userId"), false);
  assert.equal(JSON.stringify(result.session).includes("sourceTopicSeed"), false);
});

test("email-invited observer gets only a minimal confirm view, then accepted shared access", async () => {
  const db = makeDb();
  const started = await start(db);
  const caseId = started.covisionCaseId;
  Object.assign(db.store.cases[0], {
    title: "Salajane juhtum",
    summary: "Tundlik kokkuvõte",
    centralQuestion: "Tundlik küsimus"
  });
  db.store.participants.push({
    id: "participant_observer",
    covisionCaseId: caseId,
    userId: null,
    email: "aveli@example.test",
    role: "OBSERVER",
    inviteStatus: "INVITED",
    createdAt: SEED_AT,
    updatedAt: SEED_AT
  });
  db.store.sessions[0].settingsConfirmedAt = SEED_AT;
  db.store.workItems.push({
    id: "secret_work",
    sessionId: db.store.sessions[0].id,
    authorParticipantId: db.store.participants[0].id,
    stage: 1,
    kind: "agreement",
    status: "shared",
    visibility: "shared",
    content: { secret: "not before acceptance" },
    order: 0,
    createdAt: SEED_AT,
    updatedAt: SEED_AT
  });

  const actor = { userId: OTHER, email: "aveli@example.test" };
  const invited = await getCovisionSessionForUser(actor, caseId, { db });
  assert.deepEqual(invited.case, { id: caseId });
  assert.equal(invited.me.inviteStatus, "INVITED");
  assert.deepEqual(invited.me.allowedActions, ["CONFIRM_PARTICIPANT"]);
  assert.equal(invited.participants.length, 1);
  assert.equal(invited.participants[0].displayName, null);
  assert.deepEqual(Object.keys(invited.session).sort(), ["serverNow", "version"]);
  assert.equal("workItems" in invited.session, false);
  assert.equal(JSON.stringify(invited).includes("Salajane juhtum"), false);
  assert.equal(JSON.stringify(invited).includes("not before acceptance"), false);
  assert.equal(JSON.stringify(invited).includes("aveli@example.test"), false);
  assert.equal(db.store.participants.find((item) => item.id === "participant_observer")?.userId, null);

  const roleConfirmed = await applyCovisionSessionAction(actor, caseId, {
    action: "CONFIRM_PARTICIPANT",
    expectedVersion: 0,
    payload: {
      present: true,
      roleConfirmed: true
    }
  }, { db });
  assert.equal(roleConfirmed.me.inviteStatus, "INVITED");
  assert.equal(db.store.participants.find((item) => item.id === "participant_observer")?.userId, null);

  const accepted = await applyCovisionSessionAction(actor, caseId, {
    action: "CONFIRM_PARTICIPANT",
    expectedVersion: 1,
    payload: {
      agreementConfirmed: true,
      ready: true
    }
  }, { db });
  assert.equal(accepted.me.inviteStatus, "ACCEPTED");
  assert.equal(accepted.me.readOnly, true);
  assert.equal(accepted.case.title, "Salajane juhtum");
  assert.equal(accepted.participants.find((item) => item.id === "participant_observer")?.displayName, "Aveli Saar");
  assert.equal(db.store.participants.find((item) => item.id === "participant_observer")?.userId, OTHER);
  assert.equal(JSON.stringify(accepted).includes("userId"), false);
  assert.equal(JSON.stringify(accepted).includes("aveli@example.test"), false);
  assert.equal(JSON.stringify(accepted).includes("sourceTopicSeed"), false);

  const forbidden = await applyCovisionSessionAction(actor, caseId, {
    action: "SUBMIT_WORK_ITEM",
    expectedVersion: 2,
    payload: { kind: "agreement", content: { label: "Ei tohi" } }
  }, { db }).then(() => null, (error) => error);
  assert.equal(forbidden.status, 403);

  const hidden = await getCovisionSessionForUser({
    userId: "user_stranger",
    email: "stranger@example.test"
  }, caseId, { db }).then(() => null, (error) => error);
  assert.equal(hidden.status, 404);
});

test("owner and accepted co-moderator invite participants under the session lock", async () => {
  const db = makeDb();
  const started = await start(db);
  const caseId = started.covisionCaseId;
  let state = await applyCovisionSessionAction({
    userId: OWNER,
    email: "mari@example.test"
  }, caseId, {
    action: "INVITE_PARTICIPANT",
    expectedVersion: 0,
    payload: { email: "aveli@example.test", role: "CO_MODERATOR" }
  }, { db });
  assert.equal(state.session.version, 1);
  assert.equal(state.participants.find((item) => item.displayName === "Aveli Saar")?.role, "CO_MODERATOR");
  assert.equal(JSON.stringify(state.participants).includes("aveli@example.test"), false);
  assert.equal(state.participants.find((item) => item.displayName === "Aveli Saar")?.deliveryStatus, "PENDING");
  assert.equal(db.store.inviteDeliveries.length, 1);
  assert.equal(db.store.inviteDeliveries[0].recipientEmail, "aveli@example.test");
  assert.equal(db.store.inviteDeliveries[0].status, "PENDING");

  const duplicate = await applyCovisionSessionAction(OWNER, caseId, {
    action: "INVITE_PARTICIPANT",
    expectedVersion: 1,
    payload: { email: "aveli@example.test", role: "PARTICIPANT" }
  }, { db }).then(() => null, (error) => error);
  assert.equal(duplicate.status, 409);
  assert.equal(db.store.participants.filter((item) => item.userId === OTHER).length, 1);
  assert.equal(db.store.sessions[0].version, 1);
  assert.equal(db.store.inviteDeliveries.length, 1);

  db.store.sessions[0].settingsConfirmedAt = SEED_AT;

  state = await applyCovisionSessionAction({
    userId: OTHER,
    email: "aveli@example.test"
  }, caseId, {
    action: "CONFIRM_PARTICIPANT",
    expectedVersion: 1,
    payload: {
      present: true,
      roleConfirmed: true,
      agreementConfirmed: true,
      ready: true
    }
  }, { db });
  assert.equal(state.me.inviteStatus, "ACCEPTED");

  state = await applyCovisionSessionAction({
    userId: OTHER,
    email: "aveli@example.test"
  }, caseId, {
    action: "INVITE_PARTICIPANT",
    expectedVersion: 2,
    payload: { email: "new.person@example.test", role: "OBSERVER" }
  }, { db });
  assert.equal(state.session.version, 3);
  assert.equal(db.store.participants.find((item) => item.email === "new.person@example.test")?.userId, null);
  assert.equal(db.store.inviteDeliveries.length, 2);
  assert.equal(db.store.inviteDeliveries.find((item) => item.recipientEmail === "new.person@example.test")?.status, "PENDING");

  const ownerInvite = await applyCovisionSessionAction({
    userId: OTHER,
    email: "aveli@example.test"
  }, caseId, {
    action: "INVITE_PARTICIPANT",
    expectedVersion: 3,
    payload: { email: "mari@example.test", role: "PARTICIPANT" }
  }, { db }).then(() => null, (error) => error);
  assert.equal(ownerInvite.status, 409);
  assert.equal(db.store.sessions[0].version, 3);

  assert.throws(() => normalizeCovisionSessionActionRequest({
    action: "INVITE_PARTICIPANT",
    expectedVersion: 3,
    payload: { email: "person@example.test", role: "OWNER" }
  }));
});

test("SOL-COV-08: audit failure rolls the mutating command and outbox back", async () => {
  const db = makeDb();
  const started = await start(db);
  const before = {
    participants: db.store.participants.length,
    deliveries: db.store.inviteDeliveries.length,
    version: db.store.sessions[0].version
  };
  db.covisionAuditEvent.upsert = async () => {
    throw Object.assign(new Error("audit unavailable"), { code: "AUDIT_WRITE_FAILED" });
  };
  const error = await applyCovisionSessionAction({
    userId: OWNER,
    email: "mari@example.test"
  }, started.covisionCaseId, {
    action: "INVITE_PARTICIPANT",
    expectedVersion: 0,
    payload: { email: "rollback@example.test", role: "PARTICIPANT" }
  }, { db }).then(() => null, (caught) => caught);
  assert.equal(error.code, "AUDIT_WRITE_FAILED");
  assert.equal(db.store.participants.length, before.participants);
  assert.equal(db.store.inviteDeliveries.length, before.deliveries);
  assert.equal(db.store.sessions[0].version, before.version);
});

test("SOL-COV-05: private_draft can never enter the shared work-item command", async () => {
  const db = makeDb();
  const started = await start(db);
  const error = await applyCovisionSessionAction(OWNER, started.covisionCaseId, {
    action: "SUBMIT_WORK_ITEM",
    expectedVersion: 0,
    payload: {
      stage: 1,
      kind: "agreement",
      status: "private_draft",
      content: { marker: "PRIVATE_MARKER_MUST_NOT_PERSIST_SHARED" }
    }
  }, { db }).then(() => null, (caught) => caught);
  assert.equal(error?.code, "INVALID_WORK_STATUS");
  assert.equal(db.store.workItems.length, 0);
  assert.equal(JSON.stringify(db.store).includes("PRIVATE_MARKER_MUST_NOT_PERSIST_SHARED"), false);
});

test("SOL-COV-02/03: invite lifecycle and readiness are server-enforced", async () => {
  const db = makeDb();
  const started = await start(db);
  const caseId = started.covisionCaseId;
  db.store.sessions[0].settingsConfirmedAt = SEED_AT;
  db.store.participants.push({
    id: "participant_pending",
    covisionCaseId: caseId,
    userId: null,
    email: "aveli@example.test",
    role: "PARTICIPANT",
    inviteStatus: "INVITED",
    inviteExpiresAt: new Date("2026-09-01T00:00:00.000Z"),
    createdAt: SEED_AT,
    updatedAt: SEED_AT
  });
  db.store.participantStates.push({
    id: "state_pending",
    sessionId: db.store.sessions[0].id,
    participantId: "participant_pending",
    roleConfirmedAt: null,
    agreementConfirmedAt: null,
    readyAt: null,
    createdAt: SEED_AT,
    updatedAt: SEED_AT
  });
  const actor = { userId: OTHER, email: "aveli@example.test" };

  const skippedRole = await applyCovisionSessionAction(actor, caseId, {
    action: "CONFIRM_PARTICIPANT",
    expectedVersion: 0,
    payload: { agreementConfirmed: true }
  }, { db }).then(() => null, (error) => error);
  assert.equal(skippedRole?.status, 400);
  assert.equal(db.store.participants.find((row) => row.id === "participant_pending")?.inviteStatus, "INVITED");
  assert.equal(db.store.sessions[0].version, 0);

  db.store.participants.find((row) => row.id === "participant_pending").inviteStatus = "ACCEPTED";
  Object.assign(db.store.participantStates.find((row) => row.participantId === "participant_pending"), {
    roleConfirmedAt: SEED_AT,
    agreementConfirmedAt: SEED_AT,
    readyAt: null
  });
  const restricted = await getCovisionSessionForUser(actor, caseId, { db });
  assert.deepEqual(restricted.case, { id: caseId });
  assert.equal("workItems" in restricted.session, false);
  const prematureWrite = await applyCovisionSessionAction(actor, caseId, {
    action: "SUBMIT_WORK_ITEM",
    expectedVersion: 0,
    payload: { stage: 1, kind: "agreement", content: { label: "too early" } }
  }, { db }).then(() => null, (error) => error);
  assert.equal(prematureWrite?.status, 403);
  assert.equal(db.store.workItems.length, 0);

  db.store.participants.find((row) => row.id === "participant_pending").inviteStatus = "INVITED";
  db.store.participants.find((row) => row.id === "participant_pending").inviteExpiresAt = new Date("2026-01-01T00:00:00.000Z");
  const expired = await getCovisionSessionForUser(actor, caseId, { db })
    .then(() => null, (error) => error);
  assert.equal(expired?.status, 404);

  assert.deepEqual(normalizeCovisionSessionActionRequest({
    action: "REVOKE_PARTICIPANT",
    expectedVersion: 0,
    payload: { participantId: "participant_pending" }
  }), {
    action: "REVOKE_PARTICIPANT",
    expectedVersion: 0,
    payload: { participantId: "participant_pending" }
  });
});

test("TopicSeed handoff is owner-only, fingerprint-safe and idempotent", async () => {
  const foreignDb = makeDb();
  const foreign = await startCovisionFromTopicSeed(OTHER, "seed_1", {
    expectedUpdatedAt: SEED_AT.toISOString(), db: foreignDb
  }).then(() => null, (error) => error);
  assert.equal(foreign.status, 404);
  assert.equal(foreignDb.store.cases.length, 0);

  const staleDb = makeDb();
  const stale = await startCovisionFromTopicSeed(OWNER, "seed_1", {
    expectedUpdatedAt: "2026-01-01T00:00:00.000Z", db: staleDb
  }).then(() => null, (error) => error);
  assert.equal(stale.status, 409);
  assert.equal(staleDb.store.cases.length, 0);

  const db = makeDb();
  const first = await start(db);
  const second = await startCovisionFromTopicSeed(OWNER, "seed_1", {
    expectedUpdatedAt: SEED_AT.toISOString(), db
  });
  assert.equal(second.created, false);
  assert.equal(second.covisionCaseId, first.covisionCaseId);
  assert.equal(db.store.cases.length, 1);
});

test("stage 1 lifecycle is persisted, versioned and snapshotted without closing the case", async () => {
  const db = makeDb();
  const started = await start(db);
  const caseId = started.covisionCaseId;
  let state = await act(db, caseId, "START_SESSION", 0);
  assert.ok(state.session.startedAt);
  state = await act(db, caseId, "CONFIRM_SETTINGS", 1, {
    settings: { noRecording: true, hasBlockingSafetyOrPrivacyIssue: false }
  });
  state = await act(db, caseId, "CONFIRM_PARTICIPANT", 2, {
    present: true, roleConfirmed: true, agreementConfirmed: true, ready: true
  });
  state = await act(db, caseId, "CONFIRM_CASE", 3);
  state = await act(db, caseId, "SET_PHASE", 4, { phase: "confirmations_pending" });
  state = await act(db, caseId, "SET_PHASE", 5, { phase: "ready_to_open_case" });
  state = await act(db, caseId, "COMPLETE_STAGE", 6, {
    stage: 1, phase: "ready_to_open_case", evidence: {}
  });
  assert.equal(state.session.version, 7);
  assert.equal(state.session.stage, 2);
  assert.equal(state.session.phase, "ready_to_share_story");
  assert.equal(state.session.stageSnapshots.length, 1);
  assert.equal(state.case.status, "ACTIVE");
});

test("agreements require confirmed immutable stage-1 settings", async () => {
  const db = makeDb();
  const started = await start(db);
  const caseId = started.covisionCaseId;
  await act(db, caseId, "START_SESSION", 0);

  const tooEarly = await act(db, caseId, "CONFIRM_PARTICIPANT", 1, {
    present: true,
    roleConfirmed: true,
    agreementConfirmed: true,
    ready: true
  }).then(() => null, (error) => error);
  assert.equal(tooEarly.status, 409);
  assert.equal(db.store.sessions[0].version, 1);
  assert.equal(db.store.participantStates[0].agreementConfirmedAt, null);

  await act(db, caseId, "CONFIRM_SETTINGS", 1, {
    settings: { noRecording: true, hasBlockingSafetyOrPrivacyIssue: false }
  });
  const repeated = await act(db, caseId, "CONFIRM_SETTINGS", 2, {
    settings: { noRecording: false, hasBlockingSafetyOrPrivacyIssue: false }
  }).then(() => null, (error) => error);
  assert.equal(repeated.status, 409);
  assert.equal(db.store.sessions[0].settings.noRecording, true);

  Object.assign(db.store.sessions[0], { stage: 2, phase: "ready_to_share_story" });
  const later = await act(db, caseId, "CONFIRM_SETTINGS", 2, {
    settings: { noRecording: false, hasBlockingSafetyOrPrivacyIssue: false }
  }).then(() => null, (error) => error);
  assert.equal(later.status, 409);
  assert.equal(db.store.sessions[0].version, 2);
});

test("COMPLETE_STAGE ignores client claims and gates from fresh server state", async () => {
  const db = makeDb();
  const started = await start(db);
  const session = db.store.sessions[0];
  session.stage = 2;
  session.phase = "ready_to_explore";
  session.version = 7;
  const error = await act(db, started.covisionCaseId, "COMPLETE_STAGE", 7, {
    stage: 2,
    phase: "ready_to_explore",
    evidence: {
      workObjects: [{
        id: "forged", kind: "case_anchor", status: "shared", visibility: "shared"
      }],
      ownerPictureConfirmed: true,
      ownerFocusConfirmed: true,
      privacyReviewed: true
    }
  }).then(() => null, (failure) => failure);
  assert.equal(error.status, 409);
  assert.equal(db.store.snapshots.length, 0);
  assert.equal(session.stage, 2);
});

test("server-created shared/private state satisfies stage 2 while private data stays user-scoped", async () => {
  const db = makeDb();
  const started = await start(db);
  const caseId = started.covisionCaseId;
  const ownerParticipant = db.store.participants[0];
  db.store.participants.push({
    id: "participant_other", covisionCaseId: caseId, userId: OTHER,
    role: "PARTICIPANT", inviteStatus: "ACCEPTED",
    createdAt: SEED_AT, updatedAt: SEED_AT
  });
  db.store.participantStates.push({
    id: "participant_state_other", sessionId: db.store.sessions[0].id,
    participantId: "participant_other", presentAt: SEED_AT,
    roleConfirmedAt: SEED_AT, agreementConfirmedAt: SEED_AT, readyAt: SEED_AT,
    createdAt: SEED_AT, updatedAt: SEED_AT
  });
  assert.ok(ownerParticipant);
  Object.assign(db.store.sessions[0], { stage: 2, phase: "ready_to_explore", version: 10 });

  let state = await act(db, caseId, "SUBMIT_WORK_ITEM", 10, {
    kind: "case_anchor", status: "shared", content: { label: "Üldistatud ankur" }
  });
  state = await act(db, caseId, "SAVE_PRIVATE_STATE", 11, {
    kind: "case_core",
    content: {
      ownerPictureConfirmed: true,
      ownerFocusConfirmed: true,
      privacyReviewed: true,
      privateNote: "ainult omanikule"
    }
  });
  assert.equal(state.session.privateStates.length, 1);
  const otherView = await getCovisionSessionForUser(OTHER, caseId, { db });
  assert.deepEqual(otherView.session.privateStates, []);
  state = await act(db, caseId, "COMPLETE_STAGE", 12, {
    stage: 2, phase: "ready_to_explore", evidence: {}
  });
  assert.equal(state.session.stage, 3);
  assert.equal(state.session.stageSnapshots[0].payload.evidence.ownerPictureConfirmed, true);
  assert.equal(JSON.stringify(state.session.stageSnapshots[0].payload).includes("privateNote"), false);
});

test("participant private flags cannot forge the owner's stage 2 or stage 6 checkpoint", async () => {
  for (const scenario of [{
    stage: 2,
    phase: "ready_to_explore",
    kind: "case_anchor",
    ownerContent: { ownerPictureConfirmed: true, ownerFocusConfirmed: true },
    participantContent: { privacyReviewed: true }
  }, {
    stage: 6,
    phase: "ready_for_selection",
    kind: "resource",
    ownerContent: { ownerReady: true },
    participantContent: { impactReviewed: true }
  }]) {
    const db = makeDb();
    const started = await start(db);
    const session = db.store.sessions[0];
    Object.assign(session, { stage: scenario.stage, phase: scenario.phase, version: 20 });
    db.store.workItems.push({
      id: `work_${scenario.stage}`,
      sessionId: session.id,
      stage: scenario.stage,
      kind: scenario.kind,
      status: "shared",
      visibility: "shared",
      order: 0,
      content: { label: "Jagatud kaart" },
      createdAt: SEED_AT,
      updatedAt: SEED_AT
    });
    db.store.privateStates.push({
      id: `owner_${scenario.stage}`,
      sessionId: session.id,
      userId: OWNER,
      stage: scenario.stage,
      kind: "owner_checkpoint",
      content: scenario.ownerContent,
      createdAt: SEED_AT,
      updatedAt: SEED_AT
    }, {
      id: `participant_${scenario.stage}`,
      sessionId: session.id,
      userId: OTHER,
      stage: scenario.stage,
      kind: "participant_forge",
      content: scenario.participantContent,
      createdAt: SEED_AT,
      updatedAt: SEED_AT
    });
    const error = await act(db, started.covisionCaseId, "COMPLETE_STAGE", 20, {
      stage: scenario.stage,
      phase: scenario.phase,
      evidence: {}
    }).then(() => null, (failure) => failure);
    assert.equal(error.status, 409);
    assert.equal(session.stage, scenario.stage);
    assert.equal(db.store.snapshots.length, 0);
  }
});

test("an accepted summary reviewer owns the stage 2 privacy checkpoint", async () => {
  const db = makeDb();
  const started = await start(db);
  const session = db.store.sessions[0];
  Object.assign(session, { stage: 2, phase: "ready_to_explore", version: 20 });
  db.store.participants.push({
    id: "participant_reviewer",
    covisionCaseId: started.covisionCaseId,
    userId: "user_reviewer",
    role: "SUMMARY_REVIEWER",
    inviteStatus: "ACCEPTED",
    createdAt: SEED_AT,
    updatedAt: SEED_AT
  });
  db.store.workItems.push({
    id: "work_2",
    sessionId: session.id,
    stage: 2,
    kind: "case_anchor",
    status: "shared",
    visibility: "shared",
    order: 0,
    content: { label: "Üldistatud ankur" },
    createdAt: SEED_AT,
    updatedAt: SEED_AT
  });
  db.store.privateStates.push({
    id: "owner_2",
    sessionId: session.id,
    userId: OWNER,
    stage: 2,
    kind: "owner_checkpoint",
    content: {
      ownerPictureConfirmed: true,
      ownerFocusConfirmed: true,
      privacyReviewed: true
    },
    createdAt: SEED_AT,
    updatedAt: SEED_AT
  }, {
    id: "participant_forge_2",
    sessionId: session.id,
    userId: OTHER,
    stage: 2,
    kind: "participant_forge",
    content: { privacyReviewed: true },
    createdAt: SEED_AT,
    updatedAt: SEED_AT
  });

  const beforeReview = await act(db, started.covisionCaseId, "COMPLETE_STAGE", 20, {
    stage: 2,
    phase: "ready_to_explore",
    evidence: {}
  }).then(() => null, (failure) => failure);
  assert.equal(beforeReview.status, 409);
  assert.equal(session.stage, 2);

  db.store.privateStates.push({
    id: "reviewer_2",
    sessionId: session.id,
    userId: "user_reviewer",
    stage: 2,
    kind: "case_anchor",
    content: { privacyReviewed: true, privateReview: "ei lähe hetkepilti" },
    createdAt: new Date(SEED_AT.getTime() + 1_000),
    updatedAt: new Date(SEED_AT.getTime() + 1_000)
  });
  const ownerView = await getCovisionSessionForUser(OWNER, started.covisionCaseId, { db });
  assert.equal(ownerView.session.privateStates.length, 1);
  assert.doesNotMatch(JSON.stringify(ownerView), /privateReview/);
  const completed = await act(db, started.covisionCaseId, "COMPLETE_STAGE", 20, {
    stage: 2,
    phase: "ready_to_explore",
    evidence: {}
  });
  assert.equal(completed.session.stage, 3);
  assert.equal(completed.session.stageSnapshots[0].payload.evidence.privacyReviewed, true);
  assert.equal(JSON.stringify(completed.session.stageSnapshots[0].payload).includes("privateReview"), false);
});

test("editing the stage 7 owner package invalidates confirmation until it is confirmed again", async () => {
  const db = makeDb();
  const started = await start(db);
  const session = db.store.sessions[0];
  Object.assign(session, { stage: 7, phase: "case_work_completed", version: 60 });

  await act(db, started.covisionCaseId, "SAVE_PRIVATE_STATE", 60, {
    kind: "selected_direction",
    content: {
      selectedDirection: "Alustan jõukohasest osalusest.",
      privateReasoning: "omaniku privaatne kaalutlus"
    }
  });
  await act(db, started.covisionCaseId, "SAVE_PRIVATE_STATE", 61, {
    kind: "next_step",
    content: {
      nextStep: { text: "Küsin inimese eelistust.", actorType: "owner", withinOwnerInfluence: true },
      timeframe: "2026-07-24"
    }
  });
  await act(db, started.covisionCaseId, "SAVE_PRIVATE_STATE", 62, {
    kind: "progress_marker",
    content: { progressMarker: "Inimene sai oma eelistust väljendada." }
  });
  await act(db, started.covisionCaseId, "SAVE_PRIVATE_STATE", 63, {
    kind: "follow_up",
    content: {
      followUp: { when: "2026-07-24", responsibleParty: "owner", channel: "platform" },
      ownerConfirmed: true,
      privateSorting: "ei lähe hetkepilti"
    }
  });
  await act(db, started.covisionCaseId, "SAVE_PRIVATE_STATE", 64, {
    kind: "selected_direction",
    content: {
      selectedDirection: "Alustan kokkulepitud väikesest sammust.",
      privateReasoning: "muudetud privaatne kaalutlus"
    }
  });

  const staleConfirmation = await act(
    db,
    started.covisionCaseId,
    "COMPLETE_STAGE",
    65,
    { stage: 7, phase: "case_work_completed", evidence: {} }
  ).then(() => null, (failure) => failure);
  assert.equal(staleConfirmation.status, 409);
  assert.equal(session.stage, 7);

  await act(db, started.covisionCaseId, "SAVE_PRIVATE_STATE", 65, {
    kind: "follow_up",
    content: {
      followUp: { when: "2026-07-24", responsibleParty: "owner", channel: "platform" },
      ownerConfirmed: true,
      privateSorting: "jätkuvalt privaatne"
    }
  });
  const completed = await act(db, started.covisionCaseId, "COMPLETE_STAGE", 66, {
    stage: 7,
    phase: "case_work_completed",
    evidence: {}
  });
  const payload = completed.session.stageSnapshots[0].payload;
  assert.equal(completed.session.stage, 8);
  assert.equal(payload.evidence.ownerConfirmed, true);
  assert.equal(payload.evidence.selectedDirection, "Alustan kokkulepitud väikesest sammust.");
  assert.equal(JSON.stringify(payload).includes("privateReasoning"), false);
  assert.equal(JSON.stringify(payload).includes("privateSorting"), false);
});

test("stale expectedVersion and unsafe action bodies fail before a write", async () => {
  const db = makeDb();
  const started = await start(db);
  const before = db.store.sessions[0].version;
  const stale = await act(db, started.covisionCaseId, "START_SESSION", 99)
    .then(() => null, (error) => error);
  assert.equal(stale.status, 409);
  assert.equal(db.store.sessions[0].version, before);

  for (const body of [null, [], { action: "DROP_TABLE", expectedVersion: 0 }, {
    action: "PAUSE", expectedVersion: "0"
  }, {
    action: "PAUSE", expectedVersion: 0, payload: { raw: "must not cross" }
  }, {
    action: "PAUSE", expectedVersion: 0, payload: {}, userId: OTHER
  }]) {
    assert.throws(() => normalizeCovisionSessionActionRequest(body));
  }
  assert.throws(() => normalizeCovisionStartRequest({ expectedUpdatedAt: null }));
  assert.throws(() => normalizeCovisionStartRequest({
    expectedUpdatedAt: SEED_AT.toISOString(), ownerId: OTHER
  }));
});

test("advisory-locked work-item actions keep at most one active object", async () => {
  const db = makeDb();
  const started = await start(db);
  Object.assign(db.store.sessions[0], { stage: 5, phase: "active_possibility", version: 20 });
  await act(db, started.covisionCaseId, "SUBMIT_WORK_ITEM", 20, {
    kind: "possibility", status: "active", content: { label: "Esimene" }
  });
  const error = await act(db, started.covisionCaseId, "SUBMIT_WORK_ITEM", 21, {
    kind: "possibility", status: "active", content: { label: "Teine" }
  }).then(() => null, (failure) => failure);
  assert.equal(error.status, 409);
  assert.equal(db.store.workItems.filter((item) => item.status === "active").length, 1);
});

test("owner can manage another participant's shared work item", async () => {
  const db = makeDb();
  const started = await start(db);
  const caseId = started.covisionCaseId;
  db.store.participants.push({
    id: "participant_other", covisionCaseId: caseId, userId: OTHER,
    role: "PARTICIPANT", inviteStatus: "ACCEPTED",
    createdAt: SEED_AT, updatedAt: SEED_AT
  });
  Object.assign(db.store.sessions[0], { stage: 5, phase: "active_possibility", version: 50 });
  db.store.workItems.push({
    id: "other_work", sessionId: db.store.sessions[0].id, stage: 5,
    kind: "possibility", status: "shared", visibility: "shared",
    authorParticipantId: "participant_other", content: { label: "Osaleja idee" },
    sourceLabel: null, order: 0, createdAt: SEED_AT, updatedAt: SEED_AT
  });
  const state = await act(db, caseId, "UPDATE_WORK_ITEM", 50, {
    id: "other_work", status: "parked"
  });
  assert.equal(state.session.version, 51);
  assert.equal(db.store.workItems.find((item) => item.id === "other_work")?.status, "parked");
});

test("SET_PHASE permits the same or the next canonical phase, never a forward skip or rewind", async () => {
  const db = makeDb();
  const started = await start(db);
  const caseId = started.covisionCaseId;
  let state = await act(db, caseId, "START_SESSION", 0);
  assert.equal(state.session.phase, "meeting_started");
  state = await act(db, caseId, "SET_PHASE", 1, { phase: "meeting_started" });
  assert.equal(state.session.phase, "meeting_started");
  const skipped = await act(db, caseId, "SET_PHASE", 2, { phase: "ready_to_open_case" })
    .then(() => null, (error) => error);
  assert.equal(skipped.status, 409);
  assert.equal(db.store.sessions[0].phase, "meeting_started");
  const rewound = await act(db, caseId, "SET_PHASE", 2, { phase: "waiting_room" })
    .then(() => null, (error) => error);
  assert.equal(rewound.status, 409);
  assert.equal(db.store.sessions[0].phase, "meeting_started");
});

test("stage 2 normal progress skips the optional story-paused branch", async () => {
  const db = makeDb();
  const started = await start(db);
  Object.assign(db.store.sessions[0], { stage: 2, phase: "story_sharing", version: 30 });
  const state = await act(db, started.covisionCaseId, "SET_PHASE", 30, {
    phase: "story_complete"
  });
  assert.equal(state.session.phase, "story_complete");
  assert.equal(state.session.version, 31);
});

test("complete session is immutable even if retained snapshots were removed", async () => {
  const db = makeDb();
  const started = await start(db);
  const caseId = started.covisionCaseId;
  Object.assign(db.store.sessions[0], {
    stage: 8,
    phase: "complete",
    version: 40
  });
  db.store.snapshots.length = 0;
  const commands = [{
    action: "INVITE_PARTICIPANT",
    payload: { email: "later@example.test", role: "PARTICIPANT" }
  }, {
    action: "SUBMIT_WORK_ITEM",
    payload: { kind: "learning_share", content: { label: "Ei tohi" } }
  }, {
    action: "SAVE_PRIVATE_STATE",
    payload: { kind: "learning_reflection", content: { label: "Ei tohi" } }
  }, {
    action: "SET_PHASE",
    payload: { phase: "final_review" }
  }];
  for (const command of commands) {
    const error = await applyCovisionSessionAction(OWNER, caseId, {
      ...command,
      expectedVersion: 40
    }, { db }).then(() => null, (failure) => failure);
    assert.equal(error.status, 409);
    assert.equal(db.store.sessions[0].version, 40);
  }
});

test("an archived case is terminal even if its session phase is stale", async () => {
  const db = makeDb();
  const started = await start(db);
  Object.assign(db.store.cases[0], { status: "ARCHIVED" });
  Object.assign(db.store.sessions[0], { stage: 3, phase: "exploration_plan", version: 12 });
  const error = await act(db, started.covisionCaseId, "SET_PHASE", 12, {
    phase: "silent_preparation"
  }).then(() => null, (failure) => failure);
  assert.equal(error.status, 409);
  assert.equal(db.store.sessions[0].version, 12);
  assert.equal(db.store.sessions[0].phase, "exploration_plan");
});

test("stage 8 completion atomically freezes the closure and lifecycle states", async () => {
  const db = makeDb();
  const started = await start(db);
  const caseId = started.covisionCaseId;
  const session = db.store.sessions[0];
  const participantId = db.store.participants[0].id;
  Object.assign(db.store.cases[0], {
    title: "Üldistatud juhtum",
    summary: "RAW_CASE_SUMMARY",
    anonymizedDescription: "RAW_CASE_DESCRIPTION",
    centralQuestion: "RAW_CASE_QUESTION",
    expectedHelpTypes: ["RAW_HELP"],
    topics: ["RAW_TOPIC"],
    tags: ["RAW_TAG"],
    sourcePreInquiryId: "RAW_SOURCE_PRE_INQUIRY"
  });
  Object.assign(session, {
    stage: 8,
    phase: "final_review",
    version: 70,
    startedAt: SEED_AT,
    settings: { privateAgreement: "RAW_SETTINGS" }
  });
  db.store.journeySteps.push({ id: "journey_raw", covisionCaseId: caseId });
  db.store.parties.push({ id: "party_raw", covisionCaseId: caseId });
  db.store.riskFactors.push({ id: "risk_raw", covisionCaseId: caseId });
  db.store.messages.push({ id: "message_raw", covisionCaseId: caseId });
  db.store.summaries.push({ id: "summary_raw", covisionCaseId: caseId });
  db.store.calls.push({ id: "call_raw", contextType: "COVISION", contextId: caseId });
  db.store.snapshots.push({
    id: "snapshot_2", sessionId: session.id, stage: 2, phase: "ready_to_explore",
    completedAt: SEED_AT,
    payload: {
      evidence: {},
      sharedWorkItems: [{ kind: "case_anchor", content: { text: "Üldistatud juhtumipilt" } }]
    }
  }, {
    id: "snapshot_3", sessionId: session.id, stage: 3, phase: "ready_to_continue",
    completedAt: SEED_AT,
    payload: {
      evidence: {},
      sharedWorkItems: [{ kind: "question", content: { question: "Kuidas hoida osalus nähtaval?" } }]
    }
  }, {
    id: "snapshot_7", sessionId: session.id, stage: 7, phase: "case_work_completed",
    completedAt: SEED_AT,
    payload: {
      evidence: {
        selectedDirection: "Alustada jõukohasest osalusest.",
        nextStep: {
          text: "Küsida inimeselt, kuidas ta soovib osaleda.",
          actorType: "owner",
          withinOwnerInfluence: true
        },
        timeframe: "2026-07-24",
        progressMarker: "Inimene sai oma eelistust väljendada.",
        followUp: { when: "2026-07-24", responsibleParty: "owner", channel: "platform" },
        ownerConfirmed: true
      },
      sharedWorkItems: []
    }
  });
  for (const [kind, status, content] of [[
    "owner_package", "owner_confirmed", { title: "Omaniku pakett" }
  ], [
    "group_generalization", "shared", { title: "Üldistatud juhtum" }
  ], [
    "practice_candidate_decision", "shared", { decision: "create_draft" }
  ]]) {
    db.store.workItems.push({
      id: `work_${kind}`, sessionId: session.id, stage: 8, kind, status,
      visibility: "shared", authorParticipantId: participantId, content,
      sourceLabel: null, order: 0, createdAt: SEED_AT, updatedAt: SEED_AT
    });
  }
  db.store.privateStates.push({
    id: "private_stage_8", sessionId: session.id, userId: OWNER, stage: 8,
    kind: "owner_package", version: 0,
    content: {
      packageConfirmed: true,
      followUpConfirmed: true,
      generalizationDecision: "completed",
      learningDecision: "completed",
      retentionDecision: "retain",
      practiceDecision: "create_draft",
      ownerFinalConfirmed: true
    },
    createdAt: SEED_AT, updatedAt: SEED_AT
  });

  const state = await act(db, caseId, "COMPLETE_STAGE", 70, {
    stage: 8, phase: "final_review", evidence: {}
  });
  assert.equal(state.session.phase, "complete");
  assert.equal(state.session.version, 71);
  assert.equal(state.case.status, "CLOSED");
  assert.equal(db.store.seeds[0].status, "FOLLOW_UP");
  assert.equal(db.store.closures.length, 1);
  assert.equal(db.store.followUps.length, 1);
  assert.equal(db.store.packages.length, 1);
  assert.equal(db.store.practices.length, 1);
  assert.equal(db.store.practices[0].status, "DRAFT");
  assert.equal(db.store.practices[0].sourceClosureId, db.store.closures[0].id);
  assert.equal(db.store.closures[0].closedById, OWNER);
  assert.equal(db.store.closures[0].selectedDirection, "Alustada jõukohasest osalusest.");
  assert.equal(db.store.workItems.length, 0);
  assert.equal(db.store.privateStates.length, 0);
  assert.equal(db.store.journeySteps.length, 0);
  assert.equal(db.store.parties.length, 0);
  assert.equal(db.store.riskFactors.length, 0);
  assert.equal(db.store.messages.length, 0);
  assert.equal(db.store.summaries.length, 0);
  assert.equal(db.store.calls.length, 0);
  assert.equal(db.store.sessions[0].settings, null);
  assert.equal(db.store.cases[0].summary, null);
  assert.equal(db.store.cases[0].anonymizedDescription, null);
  assert.equal(db.store.cases[0].centralQuestion, null);
  assert.equal(db.store.cases[0].sourcePreInquiryId, null);
  assert.deepEqual(db.store.cases[0].expectedHelpTypes, []);
  assert.deepEqual(db.store.cases[0].topics, []);
  assert.deepEqual(db.store.cases[0].tags, []);
  assert.equal(db.store.snapshots.length, 1);
  assert.deepEqual(db.store.snapshots[0].payload, { stage: 8, closureCreated: true });
});

test("JSON parser rejects malformed JSON, null and arrays", async () => {
  for (const request of [
    { async json() { throw new SyntaxError("bad"); } },
    { async json() { return null; } },
    { async json() { return []; } }
  ]) {
    const error = await parseCovisionSessionJsonBody(request).then(() => null, (failure) => failure);
    assert.equal(error.status, 400);
    assert.equal(error.message, "api.common.invalid_request");
  }
});

test("both specialist roles can own a newly started Covision case, the client cannot", () => {
  // Omaniku otsus 02.08: teenuseosutaja EI ole enam ainult kutsutud osaleja.
  assert.equal(assertCovisionCreator({ role: "SOCIAL_WORKER" }).role, "SOCIAL_WORKER");
  assert.equal(assertCovisionCreator({ role: "SERVICE_PROVIDER" }).role, "SERVICE_PROVIDER");
  assert.equal(assertCovisionCreator({ role: "SERVICE_PROVIDER", isAdmin: true }).isAdmin, true);
  // Piir, mis EI liikunud: klient ja tundmatu roll jäävad välja.
  for (const role of ["CLIENT", "", "SOMETHING_ELSE"]) {
    assert.throws(
      () => assertCovisionCreator({ role }),
      (error) => error.status === 403 && error.message === "covision.errors.role_forbidden",
      `role ${role} must not be able to own a case`
    );
  }
});
