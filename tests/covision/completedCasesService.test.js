import test from "node:test";
import assert from "node:assert/strict";

import {
  archiveCompletedCase,
  closeCovisionCase,
  covisionCompletedCasePublicError,
  decideCompletedCase,
  deriveCompletedCaseAttention,
  getCompletedCaseDetail,
  listCompletedCases,
  parseCompletedCaseJsonBody,
  parseScheduledFor,
  updateCompletedCaseFollowUp
} from "../../lib/covisionCompletedCases.js";

const OWNER = "owner_1";
const PARTICIPANT = "participant_1";
const PARTICIPANT_B = "participant_2";
const OUTSIDER = "outsider_1";

function makeDb() {
  let sequence = 0;
  let clock = new Date("2026-07-14T10:00:00.000Z").getTime();
  const now = () => new Date((clock += 1000));
  const id = (prefix) => `${prefix}_${++sequence}`;
  const store = {
    users: [
      { id: OWNER, profile: { firstName: "Mari", lastName: "Mets" } },
      { id: PARTICIPANT, profile: { firstName: "Jaanika", lastName: "Kask" } },
      { id: PARTICIPANT_B, profile: { firstName: "Kati", lastName: "Põld" } },
      { id: OUTSIDER, profile: { firstName: "Võõras", lastName: "Kasutaja" } }
    ],
    seeds: [{ id: "seed_1", ownerId: OWNER, status: "IN_COVISION" }],
    cases: [{
      id: "case_1",
      ownerId: OWNER,
      title: "Katkendlik kooliskäimine",
      summary: "RAW_SUMMARY_MARKER",
      anonymizedDescription: "RAW_DESCRIPTION_MARKER",
      centralQuestion: "RAW_QUESTION_MARKER",
      expectedHelpTypes: ["RAW_HELP_MARKER"],
      topics: ["RAW_TOPIC_MARKER"],
      tags: ["RAW_TAG_MARKER"],
      sourcePreInquiryId: "RAW_PRE_INQUIRY_MARKER",
      status: "ACTIVE",
      sourceTopicSeed: { id: "seed_1" },
      participants: [
        { userId: OWNER, inviteStatus: "ACCEPTED" },
        { userId: PARTICIPANT, inviteStatus: "ACCEPTED" },
        { userId: PARTICIPANT_B, inviteStatus: "ACCEPTED" }
      ],
      sessionState: {
        id: "session_1",
        stage: 8,
        phase: "complete",
        version: 44,
        settings: { supportRule: "RAW_SETTINGS_MARKER" },
        startedAt: new Date("2026-07-10T09:00:00.000Z"),
        stageSnapshots: [
          {
            id: "snapshot_2",
            stage: 2,
            completedAt: new Date("2026-07-10T09:20:00.000Z"),
            payload: { sharedWorkItems: [{ kind: "case_anchor", content: { text: "Üldistatud juhtumipilt" } }] }
          },
          {
            id: "snapshot_3",
            stage: 3,
            completedAt: new Date("2026-07-10T09:35:00.000Z"),
            payload: { sharedWorkItems: [{ kind: "question", content: { question: "Kuidas hoida lapse kogemus nähtaval?" } }] }
          },
          {
            id: "snapshot_7",
            stage: 7,
            completedAt: new Date("2026-07-10T10:40:00.000Z"),
            payload: {
              evidence: {
                selectedDirection: "Alustada lapse jõukohasest osalusest.",
                nextStep: { text: "Küsida lapselt, kuidas ta soovib osaleda.", actorType: "owner", withinOwnerInfluence: true },
                timeframe: "24.07.2026",
                progressMarker: "Laps on saanud oma eelistust väljendada.",
                followUp: { when: "24.07.2026", responsibleParty: "owner", channel: "platform" },
                ownerConfirmed: true
              },
              sharedWorkItems: []
            }
          },
          {
            id: "snapshot_8",
            stage: 8,
            completedAt: new Date("2026-07-10T11:00:00.000Z"),
            payload: {
              evidence: {
                packageConfirmed: true,
                followUpConfirmed: true,
                generalizationDecision: "completed",
                learningDecision: "completed",
                retentionDecision: "do_not_retain",
                practiceDecision: "create_draft",
                ownerFinalConfirmed: true
              },
              sharedWorkItems: [{ kind: "group_generalization", content: { title: "Katkendlik kooliskäimine" } }]
            }
          }
        ]
      }
    }],
    closures: [],
    followUps: [],
    packages: [],
    practices: [],
    journeySteps: [{ id: "journey_raw", covisionCaseId: "case_1", note: "RAW_JOURNEY_MARKER" }],
    parties: [{ id: "party_raw", covisionCaseId: "case_1", note: "RAW_PARTY_MARKER" }],
    riskFactors: [{ id: "risk_raw", covisionCaseId: "case_1", note: "RAW_RISK_MARKER" }],
    messages: [{ id: "message_raw", covisionCaseId: "case_1", body: "RAW_MESSAGE_MARKER" }],
    summaries: [{ id: "summary_raw", covisionCaseId: "case_1", content: "RAW_SUMMARY_RECORD_MARKER" }],
    calls: [{ id: "call_raw", contextType: "COVISION", contextId: "case_1", marker: "RAW_CALL_MARKER" }],
    privateStates: [{ id: "private_raw", sessionId: "session_1", content: { secret: "private" } }],
    workItems: [{ id: "work_raw", sessionId: "session_1", content: { detail: "raw" } }]
  };

  const clone = (value) => structuredClone(value);
  const touch = (row, data) => {
    for (const [key, value] of Object.entries(data || {})) {
      row[key] = value && typeof value === "object" && value.increment
        ? (row[key] || 0) + value.increment
        : clone(value);
    }
    row.updatedAt = now();
  };
  const user = (userId) => clone(store.users.find((item) => item.id === userId) || null);
  const hydrate = (row, { detail = true } = {}) => {
    if (!row) return null;
    const covisionCase = store.cases.find((item) => item.id === row.covisionCaseId);
    const followUps = store.followUps
      .filter((item) => item.closureId === row.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return {
      ...clone(row),
      owner: user(row.ownerId),
      assignedFollowUpUser: user(row.assignedFollowUpUserId),
      continuationTopicSeed: row.continuationTopicSeedId
        ? clone(store.seeds.find((item) => item.id === row.continuationTopicSeedId) || null)
        : null,
      effectivePractice: clone(store.practices.find((item) => item.sourceClosureId === row.id) || null),
      covisionCase: { participants: clone(covisionCase?.participants || []) },
      followUps: clone(detail ? followUps : followUps.slice(0, 1))
    };
  };
  const requestedUserId = (where) => {
    const branches = where?.OR || [];
    for (const branch of branches) {
      if (typeof branch.ownerId === "string") return branch.ownerId;
      if (typeof branch.assignedFollowUpUserId === "string") return branch.assignedFollowUpUserId;
      const participant = branch.covisionCase?.participants?.some?.userId;
      if (participant) return participant;
    }
    return null;
  };
  const visible = (row, userId) => {
    if (!userId) return true;
    const covisionCase = store.cases.find((item) => item.id === row.covisionCaseId);
    const hasActiveAssignment = row.lifecycleStatus === "FOLLOW_UP_PENDING"
      && row.assignedFollowUpUserId === userId
      && store.followUps.some((followUp) => (
        followUp.closureId === row.id
        && followUp.status === "SCHEDULED"
        && followUp.assignedToUserId === userId
      ));
    return row.ownerId === userId
      || hasActiveAssignment
      || covisionCase?.participants.some((item) => item.userId === userId && item.inviteStatus === "ACCEPTED");
  };

  const db = {
    store,
    async $transaction(callback) { return callback(db); },
    async $executeRaw() { return 1; },
    covisionCase: {
      async findFirst({ where }) {
        return clone(store.cases.find((item) => item.id === where.id && item.ownerId === where.ownerId) || null);
      },
      async update({ where, data }) {
        const row = store.cases.find((item) => item.id === where.id);
        touch(row, data);
        return clone(row);
      }
    },
    covisionClosure: {
      async findUnique({ where }) {
        const row = store.closures.find((item) => (
          where.id ? item.id === where.id : item.covisionCaseId === where.covisionCaseId
        ));
        return clone(row || null);
      },
      async findFirst({ where }) {
        const row = store.closures.find((item) => item.id === where.id);
        const userId = requestedUserId(where);
        return visible(row, userId) ? hydrate(row) : null;
      },
      async findMany({ where }) {
        const userId = requestedUserId(where);
        return store.closures.filter((item) => visible(item, userId)).map((item) => hydrate(item, { detail: false }));
      },
      async create({ data }) {
        const timestamp = now();
        const followUpData = data.followUps?.create;
        const packageData = data.ownerPackage?.create;
        const { followUps: _followUps, ownerPackage: _ownerPackage, ...fields } = data;
        const row = {
          id: id("closure"),
          version: 0,
          closedAt: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp,
          continuationTopicSeedId: null,
          ...clone(fields)
        };
        store.closures.push(row);
        if (followUpData) {
          store.followUps.push({
            id: id("followup"), closureId: row.id, completedAt: null,
            whatWasDone: null, whatChanged: null, learning: null,
            resourceUsed: null, conditionChanged: null,
            createdAt: timestamp, updatedAt: timestamp, ...clone(followUpData)
          });
        }
        if (packageData) {
          store.packages.push({
            id: id("package"), closureId: row.id,
            createdAt: timestamp, updatedAt: timestamp, ...clone(packageData)
          });
        }
        return clone(row);
      },
      async updateMany({ where, data }) {
        const row = store.closures.find((item) => item.id === where.id && item.version === where.version);
        if (!row) return { count: 0 };
        touch(row, data);
        return { count: 1 };
      }
    },
    covisionSessionState: {
      async update({ where, data }) {
        const row = store.cases.map((item) => item.sessionState).find((item) => item?.id === where.id);
        touch(row, data);
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
    covisionFollowUp: {
      async update({ where, data }) {
        const row = store.followUps.find((item) => item.id === where.id);
        touch(row, data);
        return clone(row);
      },
      async create({ data }) {
        const timestamp = now();
        const row = {
          id: id("followup"), completedAt: null, whatWasDone: null,
          whatChanged: null, learning: null, resourceUsed: null,
          conditionChanged: null, createdAt: timestamp, updatedAt: timestamp,
          ...clone(data)
        };
        store.followUps.push(row);
        return clone(row);
      }
    },
    covisionOwnerPackage: {
      async findUnique({ where }) {
        return clone(store.packages.find((item) => item.closureId === where.closureId) || null);
      }
    },
    effectivePractice: {
      async findUnique({ where }) {
        return clone(store.practices.find((item) => item.sourceClosureId === where.sourceClosureId) || null);
      },
      async create({ data }) {
        const practiceId = id("practice");
        const row = { id: practiceId, publicId: `practice_public_${practiceId}`, createdAt: now(), updatedAt: now(), ...clone(data) };
        store.practices.push(row);
        return clone(row);
      }
    },
    covisionPrivateState: {
      async deleteMany({ where }) {
        const before = store.privateStates.length;
        store.privateStates = store.privateStates.filter((item) => item.sessionId !== where.sessionId);
        return { count: before - store.privateStates.length };
      }
    },
    covisionWorkItem: {
      async deleteMany({ where }) {
        const before = store.workItems.length;
        store.workItems = store.workItems.filter((item) => item.sessionId !== where.sessionId);
        return { count: before - store.workItems.length };
      }
    },
    covisionStageSnapshot: {
      async deleteMany({ where }) {
        const session = store.cases[0].sessionState;
        const before = session.stageSnapshots.length;
        session.stageSnapshots = session.stageSnapshots.filter((item) => (
          item.stage === where.stage.not || item.id === undefined
        ));
        return { count: before - session.stageSnapshots.length };
      },
      async update({ where, data }) {
        const row = store.cases[0].sessionState.stageSnapshots.find((item) => item.id === where.id);
        touch(row, data);
        return clone(row);
      }
    },
    topicSeed: {
      async update({ where, data }) {
        const row = store.seeds.find((item) => item.id === where.id);
        touch(row, data);
        return clone(row);
      },
      async create({ data }) {
        const timestamp = now();
        const row = { id: id("seed"), createdAt: timestamp, updatedAt: timestamp, ...clone(data) };
        store.seeds.push(row);
        return clone(row);
      }
    }
  };
  return db;
}

async function close(db, version = 44) {
  return closeCovisionCase(OWNER, "case_1", { expectedVersion: version }, { db });
}

async function completeFollowUp(db, closed) {
  return updateCompletedCaseFollowUp(OWNER, closed.id, {
    expectedVersion: closed.version,
    action: "complete",
    whatWasDone: "Kokkulepitud samm vaadati üle.",
    learning: "Jätkuotsus vajab nüüd teadlikku valikut."
  }, { db });
}

test("stage 8 closure freezes only whitelisted generalized output and separate state axes", async () => {
  const db = makeDb();
  const result = await close(db);
  assert.equal(result.lifecycleStatus, "FOLLOW_UP_PENDING");
  assert.equal(result.practiceStatus, "PRIVATE_DRAFT");
  assert.equal(result.packageStatus, "CONFIRMED");
  assert.equal(result.retentionStatus, "DELETED");
  assert.equal(result.workFocus, "Kuidas hoida lapse kogemus nähtaval?");
  assert.equal(result.followUp.scheduleLabel, "24.07.2026");
  assert.equal(db.store.cases[0].status, "CLOSED");
  assert.equal(db.store.seeds[0].status, "FOLLOW_UP");
  assert.equal(db.store.practices.length, 1);
  assert.equal(db.store.practices[0].status, "DRAFT");
  assert.equal(db.store.practices[0].sourceClosureId, result.id);
  assert.equal(db.store.practices[0].sourceCovisionCaseId, null);
  const persisted = JSON.stringify(db.store.closures[0]);
  assert.doesNotMatch(persisted, /messages|transcript|anonymizedDescription|sharedWorkItems/);
  assert.deepEqual(db.store.privateStates, []);
  assert.deepEqual(db.store.workItems, []);
  assert.deepEqual(db.store.journeySteps, []);
  assert.deepEqual(db.store.parties, []);
  assert.deepEqual(db.store.riskFactors, []);
  assert.deepEqual(db.store.messages, []);
  assert.deepEqual(db.store.summaries, []);
  assert.deepEqual(db.store.calls, []);
  assert.equal(db.store.cases[0].sessionState.settings, null);
  assert.equal(db.store.cases[0].title, "Katkendlik kooliskäimine");
  for (const key of ["summary", "anonymizedDescription", "centralQuestion", "sourcePreInquiryId"]) {
    assert.equal(db.store.cases[0][key], null);
  }
  for (const key of ["expectedHelpTypes", "topics", "tags"]) {
    assert.deepEqual(db.store.cases[0][key], []);
  }
  assert.doesNotMatch(JSON.stringify(db.store), /RAW_[A-Z_]+_MARKER/);
  assert.deepEqual(db.store.cases[0].sessionState.stageSnapshots.map((item) => item.stage), [8]);
  assert.deepEqual(db.store.cases[0].sessionState.stageSnapshots[0].payload, {
    stage: 8,
    closureCreated: true
  });
});

test("closure is owner-only, version-safe and idempotent", async () => {
  const outsiderDb = makeDb();
  const outsider = await closeCovisionCase(OUTSIDER, "case_1", { expectedVersion: 44 }, { db: outsiderDb })
    .then(() => null, (error) => error);
  assert.equal(outsider.status, 404);
  assert.equal(outsiderDb.store.closures.length, 0);

  const staleDb = makeDb();
  const stale = await closeCovisionCase(OWNER, "case_1", { expectedVersion: 43 }, { db: staleDb })
    .then(() => null, (error) => error);
  assert.equal(stale.status, 409);
  assert.equal(staleDb.store.closures.length, 0);

  const db = makeDb();
  const first = await close(db);
  const second = await close(db);
  assert.equal(second.id, first.id);
  assert.equal(db.store.closures.length, 1);
  assert.equal(db.store.followUps.length, 1);
  assert.equal(db.store.packages.length, 1);
});

test("closure refuses incomplete or non-final snapshots", async () => {
  const db = makeDb();
  db.store.cases[0].sessionState.phase = "final_reflection";
  const error = await close(db).then(() => null, (failure) => failure);
  assert.equal(error.status, 409);
  assert.equal(db.store.closures.length, 0);
});

test("accepted participant can read generalized detail but never owner package content", async () => {
  const db = makeDb();
  const ownerView = await close(db);
  const participantView = await getCompletedCaseDetail(PARTICIPANT, ownerView.id, { db });
  assert.equal(ownerView.package.contentVisible, true);
  assert.ok(ownerView.package.content.nextStep);
  assert.match(ownerView.practice.id, /^practice_public_/);
  assert.equal(ownerView.practiceStatus, "PRIVATE_DRAFT");
  assert.deepEqual(participantView.package, { status: "CONFIRMED", contentVisible: false });
  assert.equal("practiceStatus" in participantView, false);
  assert.equal("practice" in participantView, false);
  const participantJson = JSON.stringify(participantView);
  for (const forbiddenValue of ["case_1", "seed_1", OWNER, PARTICIPANT]) {
    assert.doesNotMatch(participantJson, new RegExp(forbiddenValue));
  }
  const outsider = await getCompletedCaseDetail(OUTSIDER, ownerView.id, { db })
    .then(() => null, (error) => error);
  assert.equal(outsider.status, 404);
});

test("list returns only visible closure snapshots and derived counts", async () => {
  const db = makeDb();
  await close(db);
  const participant = await listCompletedCases(PARTICIPANT, { scope: "visible" }, { db });
  const outsider = await listCompletedCases(OUTSIDER, { scope: "visible" }, { db });
  assert.equal(participant.cases.length, 1);
  assert.equal(participant.counts.followUp, 1);
  assert.equal(outsider.cases.length, 0);
});

test("owner or assigned follow-up person can complete follow-up; group participant alone cannot", async () => {
  const db = makeDb();
  const closed = await close(db);
  const forbiddenError = await updateCompletedCaseFollowUp(PARTICIPANT, closed.id, {
    expectedVersion: 0,
    action: "complete",
    whatWasDone: "Samm tehti osaliselt.",
    learning: "Väiksem samm oli realistlikum."
  }, { db }).then(() => null, (error) => error);
  assert.equal(forbiddenError.status, 403);

  const result = await updateCompletedCaseFollowUp(OWNER, closed.id, {
    expectedVersion: 0,
    action: "complete",
    whatWasDone: "Samm tehti osaliselt.",
    whatChanged: "Vestlus muutus rahulikumaks.",
    learning: "Väiksem samm oli realistlikum."
  }, { db });
  assert.equal(result.lifecycleStatus, "DECISION_PENDING");
  assert.equal(result.followUp.status, "COMPLETED");
  assert.equal(result.version, 1);
});

test("accepted participant sees follow-up status but not the owner/assignee reflection", async () => {
  const db = makeDb();
  const closed = await close(db);
  await updateCompletedCaseFollowUp(OWNER, closed.id, {
    expectedVersion: 0,
    action: "complete",
    whatWasDone: "Tundlik töödetail ainult vastutajale.",
    whatChanged: "Tundlik muutuse kirjeldus.",
    learning: "Tundlik professionaalne refleksioon.",
    resourceUsed: "Tundlik ressurss.",
    conditionChanged: "Tundlik tingimus."
  }, { db });
  const participantView = await getCompletedCaseDetail(PARTICIPANT, closed.id, { db });
  assert.equal(participantView.followUp.status, "COMPLETED");
  const serialized = JSON.stringify(participantView);
  for (const field of ["whatWasDone", "whatChanged", "learning", "resourceUsed", "conditionChanged"]) {
    assert.doesNotMatch(serialized, new RegExp(field));
  }
  assert.doesNotMatch(serialized, /Tundlik/);
});

test("rescheduling keeps follow-up lifecycle separate and can assign an accepted participant", async () => {
  const db = makeDb();
  const closed = await close(db);
  const result = await updateCompletedCaseFollowUp(OWNER, closed.id, {
    expectedVersion: 0,
    action: "reschedule",
    scheduleLabel: "2026-08-02",
    assignedToUserId: PARTICIPANT
  }, { db });
  assert.equal(result.lifecycleStatus, "FOLLOW_UP_PENDING");
  assert.equal(result.assignedFollowUpUser.name, "Jaanika Kask");
  assert.equal(db.store.closures[0].assignedFollowUpUserId, PARTICIPANT);
  assert.equal(db.store.followUps.filter((item) => item.status === "RESCHEDULED").length, 1);
});

test("reassignment removes the former assignee's mutation and reflection privileges", async () => {
  const db = makeDb();
  const closed = await close(db);
  const assignedA = await updateCompletedCaseFollowUp(OWNER, closed.id, {
    expectedVersion: 0,
    action: "reschedule",
    scheduleLabel: "2026-08-01",
    assignedToUserId: PARTICIPANT
  }, { db });
  const assignedB = await updateCompletedCaseFollowUp(OWNER, closed.id, {
    expectedVersion: assignedA.version,
    action: "reschedule",
    scheduleLabel: "2026-08-08",
    assignedToUserId: PARTICIPANT_B
  }, { db });

  const before = structuredClone(db.store.followUps);
  const denied = await updateCompletedCaseFollowUp(PARTICIPANT, closed.id, {
    expectedVersion: assignedB.version,
    action: "complete",
    whatWasDone: "Vana vastutaja ei tohi kirjutada.",
    learning: "Vana vastutaja ei tohi kirjutada."
  }, { db }).then(() => null, (error) => error);
  assert.equal(denied.status, 403);
  assert.deepEqual(db.store.followUps, before);

  const formerView = await getCompletedCaseDetail(PARTICIPANT, closed.id, { db });
  assert.equal(formerView.myAccessRole, "PARTICIPANT");
  assert.doesNotMatch(JSON.stringify(formerView), /whatWasDone|whatChanged|learning|resourceUsed|conditionChanged/);
  assert.equal((await getCompletedCaseDetail(PARTICIPANT_B, closed.id, { db })).myAccessRole, "FOLLOW_UP_ASSIGNEE");
});

test("follow-up completion and terminal decisions end assignee authority", async () => {
  const db = makeDb();
  const closed = await close(db);
  const assigned = await updateCompletedCaseFollowUp(OWNER, closed.id, {
    expectedVersion: 0,
    action: "reschedule",
    scheduleLabel: "2026-08-01",
    assignedToUserId: PARTICIPANT
  }, { db });
  assert.equal(assigned.myAccessRole, "OWNER");

  const completed = await updateCompletedCaseFollowUp(PARTICIPANT, closed.id, {
    expectedVersion: assigned.version,
    action: "complete",
    whatWasDone: "Tundlik vastutaja töödetail.",
    whatChanged: "Tundlik muutuse kirjeldus.",
    learning: "Tundlik vastutaja refleksioon."
  }, { db });
  assert.equal(db.store.closures[0].assignedFollowUpUserId, null);
  assert.equal(completed.myAccessRole, "PARTICIPANT");
  assert.doesNotMatch(JSON.stringify(completed), /Tundlik/);

  const ownerView = await getCompletedCaseDetail(OWNER, closed.id, { db });
  const decided = await decideCompletedCase(OWNER, closed.id, {
    expectedVersion: ownerView.version,
    decision: "close",
    reason: "Järelvaade on tehtud ja eraldi jätkuteemat praegu ei ole vaja."
  }, { db });
  assert.equal(decided.lifecycleStatus, "CLOSED");
  assert.equal(db.store.closures[0].assignedFollowUpUserId, null);
  const afterClose = await getCompletedCaseDetail(PARTICIPANT, closed.id, { db });
  assert.equal(afterClose.myAccessRole, "PARTICIPANT");
  assert.doesNotMatch(JSON.stringify(afterClose), /Tundlik/);

  await archiveCompletedCase(OWNER, closed.id, { expectedVersion: decided.version }, { db });
  const afterArchive = await getCompletedCaseDetail(PARTICIPANT, closed.id, { db });
  assert.equal(afterArchive.myAccessRole, "PARTICIPANT");
  assert.doesNotMatch(JSON.stringify(afterArchive), /Tundlik/);
});

test("scheduled dates accept leap day and reject calendar overflow without changing the label", async () => {
  assert.equal(parseScheduledFor("29.02.2028")?.toISOString(), "2028-02-29T12:00:00.000Z");
  assert.equal(parseScheduledFor("31.02.2028"), null);
  assert.equal(parseScheduledFor("not-a-date"), null);

  const db = makeDb();
  const closed = await close(db);
  const result = await updateCompletedCaseFollowUp(OWNER, closed.id, {
    expectedVersion: 0,
    action: "reschedule",
    scheduleLabel: "31.02.2028"
  }, { db });
  assert.equal(result.followUp.scheduleLabel, "31.02.2028");
  assert.equal(result.followUp.scheduledFor, null);
});

test("continuation decision creates a minimal new private TopicSeed without copying case history", async () => {
  const db = makeDb();
  const closed = await close(db);
  const followed = await completeFollowUp(db, closed);
  const result = await decideCompletedCase(OWNER, closed.id, {
    expectedVersion: followed.version,
    decision: "continue",
    newQuestion: "Kuidas toetada järgmist väikest sammu?"
  }, { db });
  assert.equal(result.lifecycleStatus, "CONTINUATION_PENDING");
  assert.equal(result.links.continuationTopicSeed.status, "DRAFT");
  const continuation = db.store.seeds.find((seed) => seed.id === result.links.continuationTopicSeed.id);
  assert.deepEqual(continuation.requestedSupport, ["perspectives"]);
  assert.equal("sharedCardSnapshot" in continuation, false);
  assert.equal("anonymizedDescription" in continuation, false);
});

test("practice decision changes only the practice axis", async () => {
  const db = makeDb();
  db.store.cases[0].sessionState.stageSnapshots[3].payload.evidence.practiceDecision = "skip";
  const closed = await close(db);
  const followed = await completeFollowUp(db, closed);
  const result = await decideCompletedCase(OWNER, closed.id, {
    expectedVersion: followed.version,
    decision: "practice_candidate"
  }, { db });
  assert.equal(result.practiceStatus, "PRIVATE_DRAFT");
  assert.equal(result.lifecycleStatus, "DECISION_PENDING");
  assert.equal(db.store.practices.length, 1);
  assert.equal(db.store.practices[0].status, "DRAFT");
  assert.match(db.store.practices[0].publicId, /^practice_public_/);
  const repeated = await decideCompletedCase(OWNER, closed.id, {
    expectedVersion: result.version,
    decision: "practice_candidate"
  }, { db });
  assert.equal(db.store.practices.length, 1);
  assert.equal(repeated.version, result.version);
});

test("archive is owner-only and never deletes the record", async () => {
  const db = makeDb();
  const closed = await close(db);
  const followed = await completeFollowUp(db, closed);
  const missingReason = await decideCompletedCase(OWNER, closed.id, {
    expectedVersion: followed.version,
    decision: "close"
  }, { db }).then(() => null, (error) => error);
  assert.equal(missingReason.status, 400);
  assert.equal(db.store.closures[0].version, followed.version);
  const decided = await decideCompletedCase(OWNER, closed.id, {
    expectedVersion: followed.version,
    decision: "close",
    reason: "Järelvaade kinnitas, et eraldi jätkuteemat praegu ei ole vaja."
  }, { db });
  assert.match(decided.decisionNote, /Järelvaade kinnitas/);
  const participantView = await getCompletedCaseDetail(PARTICIPANT, closed.id, { db });
  assert.equal("decisionNote" in participantView, false);
  assert.doesNotMatch(JSON.stringify(participantView), /Järelvaade kinnitas/);
  const denied = await archiveCompletedCase(PARTICIPANT, closed.id, {
    expectedVersion: decided.version
  }, { db }).then(() => null, (error) => error);
  assert.equal(denied.status, 403);
  const archived = await archiveCompletedCase(OWNER, closed.id, {
    expectedVersion: decided.version
  }, { db });
  assert.equal(archived.lifecycleStatus, "ARCHIVED");
  assert.equal(db.store.closures.length, 1);
  assert.equal(db.store.cases[0].status, "ARCHIVED");
  const before = structuredClone({
    closures: db.store.closures,
    followUps: db.store.followUps,
    seeds: db.store.seeds,
    practices: db.store.practices
  });
  const resurrect = await decideCompletedCase(OWNER, closed.id, {
    expectedVersion: archived.version,
    decision: "new_follow_up",
    scheduleLabel: "2026-09-01"
  }, { db }).then(() => null, (error) => error);
  assert.equal(resurrect.status, 409);
  assert.deepEqual({
    closures: db.store.closures,
    followUps: db.store.followUps,
    seeds: db.store.seeds,
    practices: db.store.practices
  }, before);
});

test("attention is derived from due date and lifecycle, not stored", () => {
  const base = { lifecycleStatus: "FOLLOW_UP_PENDING", followUps: [{ status: "SCHEDULED" }] };
  assert.equal(deriveCompletedCaseAttention({ ...base, followUps: [{ status: "SCHEDULED", scheduledFor: "2026-07-13" }] }, new Date("2026-07-14")), "OVERDUE");
  assert.equal(deriveCompletedCaseAttention({ ...base, followUps: [{ status: "SCHEDULED", scheduledFor: "2026-07-14" }] }, new Date("2026-07-14")), "DUE_TODAY");
  assert.equal(deriveCompletedCaseAttention({ lifecycleStatus: "DECISION_PENDING", followUps: [] }), "DECISION_REQUIRED");
  assert.equal(deriveCompletedCaseAttention({ lifecycleStatus: "CLOSED", followUps: [] }), "NONE");
});

test("JSON parser and public error mapper expose only fixed keys", async () => {
  for (const request of [
    { async json() { throw new Error("bad"); } },
    { async json() { return null; } },
    { async json() { return []; } }
  ]) {
    const error = await parseCompletedCaseJsonBody(request).then(() => null, (failure) => failure);
    assert.equal(error.status, 400);
  }
  assert.deepEqual(
    covisionCompletedCasePublicError(Object.assign(new Error("database secret"), { status: 500 })),
    { messageKey: "completed_cases.errors.request_failed", status: 500 }
  );
});
