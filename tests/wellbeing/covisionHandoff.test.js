import test from "node:test";
import assert from "node:assert/strict";

import { getCovisionSessionForUser } from "../../lib/covisionSession.js";
import {
  startCovisionFromWellbeingDraft,
  wellbeingCovisionHandoffPublicError
} from "../../lib/wellbeing/covisionHandoff.js";
import { buildWellbeingShareableDraft } from "../../lib/wellbeing/supportDraftText.js";
import { confirmWellbeingOutputDraftForUser } from "../../lib/wellbeing/supportDrafts.js";

const OWNER = "wellbeing_owner";
const OTHER = "invited_colleague";
const DRAFT_ID = "wellbeing_draft_1";
const DRAFT_AT = new Date("2026-07-14T12:00:00.000Z");
const SAFE_GENERATED = "Töökoormus on suur ning rollipiir vajab kolleegidega arutelu.";
const SAFE_EDITED = "Toimetatud üldistus keskendub töökoormusele ja järgmisele sammule.";

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function makeDraft(overrides = {}) {
  return {
    id: DRAFT_ID,
    userId: OWNER,
    sourceWorkflowType: "hard-case",
    sourceRecordId: "private_wellbeing_record_1",
    outputType: "covision_input",
    recipientType: "covision",
    generatedText: SAFE_GENERATED,
    editedText: SAFE_EDITED,
    userReviewed: true,
    userConfirmed: true,
    visibility: "private",
    status: "ready_to_share",
    covisionCaseId: null,
    handedOffAt: null,
    createdAt: DRAFT_AT,
    updatedAt: DRAFT_AT,
    ...overrides
  };
}

function makeDb({ draft = makeDraft(), failLinkCas = false } = {}) {
  let sequence = 0;
  let clock = DRAFT_AT.getTime();
  const nextId = (prefix) => `${prefix}_${++sequence}`;
  const now = () => new Date((clock += 1_000));
  const clone = (value) => structuredClone(value);
  const sameInstant = (left, right) => (
    new Date(left).getTime() === new Date(right).getTime()
  );

  const store = {
    users: [
      {
        id: OWNER,
        email: "owner@example.test",
        profile: { firstName: "Omanik", lastName: "Spetsialist" }
      },
      {
        id: OTHER,
        email: "colleague@example.test",
        profile: { firstName: "Kolleeg", lastName: "Spetsialist" }
      }
    ],
    drafts: [clone(draft)],
    cases: [],
    participants: [],
    sessions: [],
    participantStates: [],
    privateStates: [],
    workItems: [],
    snapshots: []
  };

  const calls = {
    draftFind: [],
    rawWellbeingReads: 0,
    transactions: 0,
    rollbacks: 0,
    advisoryLocks: 0
  };

  function replaceStore(snapshot) {
    for (const key of Object.keys(store)) delete store[key];
    Object.assign(store, clone(snapshot));
  }

  function selected(row, select) {
    if (!row) return null;
    if (!select) return clone(row);
    return Object.fromEntries(
      Object.entries(select)
        .filter(([, enabled]) => enabled === true)
        .map(([key]) => [key, clone(row[key])])
    );
  }

  const db = {
    store,
    calls,
    failLinkCas,

    async $transaction(callback) {
      calls.transactions += 1;
      const snapshot = clone(store);
      const sequenceBefore = sequence;
      const clockBefore = clock;
      try {
        return await callback(db);
      } catch (error) {
        replaceStore(snapshot);
        sequence = sequenceBefore;
        clock = clockBefore;
        calls.rollbacks += 1;
        throw error;
      }
    },

    async $executeRaw() {
      calls.advisoryLocks += 1;
      return 1;
    },

    wellbeingOutputDraft: {
      async findFirst(query) {
        calls.draftFind.push(clone(query));
        const row = store.drafts.find((item) => (
          item.id === query.where.id && item.userId === query.where.userId
        ));
        return selected(row || null, query.select);
      },

      async updateMany({ where, data }) {
        if (db.failLinkCas) return { count: 0 };
        const row = store.drafts.find((item) => (
          item.id === where.id
          && item.userId === where.userId
          && (where.status === undefined || item.status === where.status)
          && (where.covisionCaseId === undefined || item.covisionCaseId === where.covisionCaseId)
          && (where.updatedAt === undefined || sameInstant(item.updatedAt, where.updatedAt))
        ));
        if (!row) return { count: 0 };
        Object.assign(row, clone(data), { updatedAt: now() });
        return { count: 1 };
      }
    },

    covisionCase: {
      async create({ data }) {
        const timestamp = now();
        const row = {
          id: nextId("case"),
          createdAt: timestamp,
          updatedAt: timestamp,
          ...clone(data)
        };
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
            sessionState: clone(
              store.participantStates.find((state) => state.participantId === participant.id) || null
            )
          }));
        const session = store.sessions.find((item) => item.covisionCaseId === row.id) || null;
        const privateUserId = include?.sessionState?.include?.privateStates?.where?.userId;
        return {
          ...clone(row),
          owner: clone(store.users.find((user) => user.id === row.ownerId) || null),
          sourceTopicSeed: null,
          participants,
          sessionState: session ? {
            ...clone(session),
            workItems: clone(store.workItems.filter((item) => (
              item.sessionId === session.id && item.visibility === "shared"
            ))),
            privateStates: clone(store.privateStates.filter((item) => (
              item.sessionId === session.id && item.userId === privateUserId
            ))),
            stageSnapshots: clone(store.snapshots.filter((item) => item.sessionId === session.id))
          } : null
        };
      }
    },

    covisionParticipant: {
      async create({ data }) {
        const timestamp = now();
        const row = {
          id: nextId("participant"),
          createdAt: timestamp,
          updatedAt: timestamp,
          ...clone(data)
        };
        store.participants.push(row);
        return clone(row);
      }
    },

    covisionSessionState: {
      async create({ data }) {
        const timestamp = now();
        const row = {
          id: nextId("session"),
          startedAt: null,
          stageStartedAt: timestamp,
          pausedAt: null,
          totalPausedMs: 0,
          settings: null,
          caseConfirmedAt: null,
          settingsConfirmedAt: null,
          createdAt: timestamp,
          updatedAt: timestamp,
          ...clone(data)
        };
        store.sessions.push(row);
        return clone(row);
      }
    },

    covisionParticipantState: {
      async create({ data }) {
        const timestamp = now();
        const row = {
          id: nextId("participant_state"),
          presentAt: null,
          roleConfirmedAt: null,
          agreementConfirmedAt: null,
          readyAt: null,
          createdAt: timestamp,
          updatedAt: timestamp,
          ...clone(data)
        };
        store.participantStates.push(row);
        return clone(row);
      }
    },

    covisionPrivateState: {
      async create({ data }) {
        const timestamp = now();
        const row = {
          id: nextId("private"),
          createdAt: timestamp,
          updatedAt: timestamp,
          ...clone(data)
        };
        store.privateStates.push(row);
        return clone(row);
      }
    }
  };

  Object.defineProperty(db, "wellbeingRecord", {
    configurable: false,
    get() {
      calls.rawWellbeingReads += 1;
      throw new Error("The handoff must not read WellbeingRecord");
    }
  });

  return db;
}

function requestFor(draft = makeDraft()) {
  return {
    expectedUpdatedAt: new Date(draft.updatedAt).toISOString(),
    confirmedNoIdentifiers: true
  };
}

function ownerActor(overrides = {}) {
  return { userId: OWNER, role: "SOCIAL_WORKER", isAdmin: false, ...overrides };
}

async function expectPublicFailure(action, { status, message }) {
  await assert.rejects(action, (error) => {
    assert.equal(error?.status, status);
    assert.equal(error?.message, message);
    return true;
  });
}

test("owner handoff atomically creates a linked private case, owner session and stage-2 private prefill", async () => {
  const db = makeDb();
  const result = await startCovisionFromWellbeingDraft(
    ownerActor(),
    DRAFT_ID,
    requestFor(db.store.drafts[0]),
    { db }
  );

  assert.deepEqual(result, { covisionCaseId: db.store.cases[0].id, created: true });
  assert.equal(db.calls.transactions, 1);
  assert.equal(db.calls.advisoryLocks, 1);
  assert.equal(db.calls.rollbacks, 0);
  assert.equal(db.store.cases.length, 1);
  assert.equal(db.store.participants.length, 1);
  assert.equal(db.store.sessions.length, 1);
  assert.equal(db.store.participantStates.length, 1);
  assert.equal(db.store.privateStates.length, 1);
  assert.equal(db.store.workItems.length, 0);

  const covisionCase = db.store.cases[0];
  const participant = db.store.participants[0];
  const session = db.store.sessions[0];
  const participantState = db.store.participantStates[0];
  const prefill = db.store.privateStates[0];
  const linkedDraft = db.store.drafts[0];

  assert.equal(covisionCase.ownerId, OWNER);
  assert.equal(covisionCase.title, "Kovisioon");
  assert.deepEqual(covisionCase.expectedHelpTypes, ["perspectives", "next_step"]);
  assert.equal(covisionCase.status, "ACTIVE");
  assert.equal(covisionCase.visibility, "PRIVATE");
  assert.ok(covisionCase.anonymityConfirmedAt instanceof Date);
  assert.equal(participant.covisionCaseId, covisionCase.id);
  assert.equal(participant.userId, OWNER);
  assert.equal(participant.role, "OWNER");
  assert.equal(participant.inviteStatus, "ACCEPTED");
  assert.equal(session.covisionCaseId, covisionCase.id);
  assert.equal(session.stage, 1);
  assert.equal(session.phase, "waiting_room");
  assert.equal(session.version, 0);
  assert.equal(participantState.sessionId, session.id);
  assert.equal(participantState.participantId, participant.id);
  assert.equal(prefill.sessionId, session.id);
  assert.equal(prefill.userId, OWNER);
  assert.equal(prefill.stage, 2);
  assert.equal(prefill.kind, "case_anchor");
  assert.equal(prefill.content.text, SAFE_EDITED);
  assert.equal(linkedDraft.status, "in_covision");
  assert.equal(linkedDraft.covisionCaseId, covisionCase.id);
  assert.ok(linkedDraft.handedOffAt instanceof Date);
});

test("editedText wins, while a blank editedText falls back to the stored generatedText", async (t) => {
  await t.test("edited text wins", async () => {
    const db = makeDb();
    await startCovisionFromWellbeingDraft(ownerActor(), DRAFT_ID, requestFor(db.store.drafts[0]), { db });
    assert.equal(db.store.privateStates[0].content.text, SAFE_EDITED);
  });

  await t.test("blank edited text falls back", async () => {
    const db = makeDb({ draft: makeDraft({ editedText: " \n\t " }) });
    await startCovisionFromWellbeingDraft(ownerActor(), DRAFT_ID, requestFor(db.store.drafts[0]), { db });
    assert.equal(db.store.privateStates[0].content.text, SAFE_GENERATED);
  });
});

test("handoff reads only the selected output draft and never sourceRecordId or WellbeingRecord", async () => {
  const db = makeDb();
  await startCovisionFromWellbeingDraft(ownerActor(), DRAFT_ID, requestFor(db.store.drafts[0]), { db });

  assert.equal(db.calls.rawWellbeingReads, 0);
  assert.equal(db.calls.draftFind.length, 1);
  const query = db.calls.draftFind[0];
  assert.deepEqual(query.where, { id: DRAFT_ID, userId: OWNER });
  assert.equal(hasOwn(query.select, "sourceRecordId"), false);
  assert.equal(hasOwn(query.select, "sourceWorkflowType"), false);
  assert.equal(JSON.stringify(db.store.privateStates).includes("private_wellbeing_record_1"), false);
});

test("missing and foreign drafts both return the same owner-scoped 404 without writes", async (t) => {
  for (const [name, id, actor] of [
    ["missing", "missing_draft", ownerActor()],
    ["foreign", DRAFT_ID, ownerActor({ userId: OTHER })]
  ]) {
    await t.test(name, async () => {
      const db = makeDb();
      await expectPublicFailure(
        () => startCovisionFromWellbeingDraft(actor, id, requestFor(db.store.drafts[0]), { db }),
        { status: 404, message: "api.common.not_found" }
      );
      assert.equal(db.store.cases.length, 0);
      assert.equal(db.store.drafts[0].covisionCaseId, null);
    });
  }
});

test("a non-social-worker cannot create a Covision owner case", async () => {
  const db = makeDb();
  await expectPublicFailure(
    () => startCovisionFromWellbeingDraft(
      ownerActor({ role: "SERVICE_PROVIDER" }),
      DRAFT_ID,
      requestFor(db.store.drafts[0]),
      { db }
    ),
    { status: 403, message: "api.common.forbidden" }
  );
  assert.equal(db.calls.draftFind.length, 0);
  assert.equal(db.store.cases.length, 0);
});

test("identifier confirmation is mandatory and must be true", async (t) => {
  for (const [name, request] of [
    ["missing", { expectedUpdatedAt: DRAFT_AT.toISOString() }],
    ["false", { expectedUpdatedAt: DRAFT_AT.toISOString(), confirmedNoIdentifiers: false }]
  ]) {
    await t.test(name, async () => {
      const db = makeDb();
      await expectPublicFailure(
        () => startCovisionFromWellbeingDraft(ownerActor(), DRAFT_ID, request, { db }),
        { status: 400, message: "wellbeing.errors.identifiers_confirmation_required" }
      );
      assert.equal(db.calls.draftFind.length, 0);
      assert.equal(db.store.cases.length, 0);
    });
  }
});

test("expectedUpdatedAt is mandatory, valid and current", async (t) => {
  const cases = [
    ["missing", { confirmedNoIdentifiers: true }, false],
    ["invalid", { expectedUpdatedAt: "not-a-date", confirmedNoIdentifiers: true }, false],
    ["stale", {
      expectedUpdatedAt: "2026-07-14T11:59:59.000Z",
      confirmedNoIdentifiers: true
    }, true]
  ];

  for (const [name, request, draftWasRead] of cases) {
    await t.test(name, async () => {
      const db = makeDb();
      await expectPublicFailure(
        () => startCovisionFromWellbeingDraft(ownerActor(), DRAFT_ID, request, { db }),
        { status: 409, message: "wellbeing.errors.covision_handoff_conflict" }
      );
      assert.equal(db.calls.draftFind.length, draftWasRead ? 1 : 0);
      assert.equal(db.store.cases.length, 0);
      assert.equal(db.store.drafts[0].covisionCaseId, null);
    });
  }
});

test("ineligible type, recipient, status, visibility or review flags fail closed", async (t) => {
  const variants = [
    ["output type", { outputType: "manager_memo" }],
    ["recipient", { recipientType: "manager" }],
    ["status", { status: "draft" }],
    ["visibility", { visibility: "shared" }],
    ["review flag", { userReviewed: false }],
    ["confirmation flag", { userConfirmed: false }]
  ];

  for (const [name, overrides] of variants) {
    await t.test(name, async () => {
      const db = makeDb({ draft: makeDraft(overrides) });
      await expectPublicFailure(
        () => startCovisionFromWellbeingDraft(
          ownerActor(),
          DRAFT_ID,
          requestFor(db.store.drafts[0]),
          { db }
        ),
        { status: 409, message: "wellbeing.errors.covision_handoff_conflict" }
      );
      assert.equal(db.store.cases.length, 0);
      assert.equal(db.store.privateStates.length, 0);
      assert.equal(db.store.drafts[0].covisionCaseId, null);
    });
  }
});

test("server-side identifier detection blocks a confirmed draft before any Covision write", async () => {
  const db = makeDb({
    draft: makeDraft({ editedText: "Palun kirjutada aadressile mari@example.test." })
  });

  await expectPublicFailure(
    () => startCovisionFromWellbeingDraft(
      ownerActor(),
      DRAFT_ID,
      requestFor(db.store.drafts[0]),
      { db }
    ),
    { status: 400, message: "wellbeing.errors.identifiers_detected" }
  );
  assert.equal(db.store.cases.length, 0);
  assert.equal(db.store.privateStates.length, 0);
  assert.equal(db.store.drafts[0].covisionCaseId, null);
});

/* ---- E0: V17 regressioon + lekketa tuvastaja-detailid ---- */

test("the unedited standard covision template passes the gate end-to-end (V17 regression)", async () => {
  const template = buildWellbeingShareableDraft({
    sourceWorkflowType: "quick-check",
    outputType: "covision_input",
    recipientType: "covision",
    context: {}
  }).generatedText;
  const db = makeDb({ draft: makeDraft({ generatedText: template, editedText: null }) });

  const result = await startCovisionFromWellbeingDraft(
    ownerActor(), DRAFT_ID, requestFor(db.store.drafts[0]), { db }
  );

  assert.equal(result.created, true);
  assert.equal(db.store.cases.length, 1);
  assert.equal(db.store.privateStates[0].content.text, template);
  assert.equal(db.store.drafts[0].status, "in_covision");
});

test("identifier rejection exposes only issue types and count, never the detected value", async () => {
  const db = makeDb({
    draft: makeDraft({ editedText: "Klient Mari Mets helistas ja jättis numbri +372 5123 4567." })
  });

  const error = await startCovisionFromWellbeingDraft(
    ownerActor(), DRAFT_ID, requestFor(db.store.drafts[0]), { db }
  ).then(() => null, (caught) => caught);

  assert.equal(error?.status, 400);
  assert.equal(error?.message, "wellbeing.errors.identifiers_detected");
  assert.equal(Array.isArray(error?.details?.issueTypes), true);
  assert.equal(error.details.issueTypes.includes("name"), true);
  assert.equal(error.details.issueTypes.includes("phone"), true);
  assert.equal(Number(error.details.issueCount) >= 2, true);
  assert.deepEqual(Object.keys(error.details).sort(), ["issueCount", "issueTypes"]);
  const serialized = JSON.stringify(error.details);
  assert.equal(serialized.includes("Mari"), false);
  assert.equal(serialized.includes("Mets"), false);
  assert.equal(serialized.includes("5123"), false);

  const publicPayload = wellbeingCovisionHandoffPublicError(error);
  assert.equal(publicPayload.status, 400);
  assert.equal(publicPayload.messageKey, "wellbeing.errors.identifiers_detected");
  assert.deepEqual(Object.keys(publicPayload).sort(), ["details", "messageKey", "status"]);
  assert.deepEqual(Object.keys(publicPayload.details).sort(), ["issueCount", "issueTypes"]);
  assert.equal(JSON.stringify(publicPayload).includes("Mari"), false);
  assert.equal(db.store.cases.length, 0);
});

test("only the identifiers error can carry details through the public error mapper", () => {
  const conflict = new Error("wellbeing.errors.covision_handoff_conflict");
  conflict.status = 409;
  conflict.details = { issueTypes: ["name"], issueCount: 1 };

  assert.deepEqual(
    wellbeingCovisionHandoffPublicError(conflict),
    { messageKey: "wellbeing.errors.covision_handoff_conflict", status: 409 }
  );

  const malformed = new Error("wellbeing.errors.identifiers_detected");
  malformed.status = 400;
  malformed.details = { issueTypes: [42, "", null], issueCount: "paljud" };

  assert.deepEqual(
    wellbeingCovisionHandoffPublicError(malformed),
    { messageKey: "wellbeing.errors.identifiers_detected", status: 400 }
  );
});

test("an idempotent retry returns the already linked case without minting duplicates", async () => {
  const db = makeDb();
  const originalRequest = requestFor(db.store.drafts[0]);
  const first = await startCovisionFromWellbeingDraft(
    ownerActor(), DRAFT_ID, originalRequest, { db }
  );
  const second = await startCovisionFromWellbeingDraft(
    ownerActor(), DRAFT_ID, originalRequest, { db }
  );

  assert.deepEqual(first, { covisionCaseId: first.covisionCaseId, created: true });
  assert.deepEqual(second, { covisionCaseId: first.covisionCaseId, created: false });
  assert.equal(db.store.cases.length, 1);
  assert.equal(db.store.participants.length, 1);
  assert.equal(db.store.sessions.length, 1);
  assert.equal(db.store.participantStates.length, 1);
  assert.equal(db.store.privateStates.length, 1);
});

test("confirmation-before-handoff requires the fresh version and transfers the newly confirmed text", async () => {
  const db = makeDb();
  const staleRequest = requestFor(db.store.drafts[0]);
  const confirmed = await confirmWellbeingOutputDraftForUser(OWNER, DRAFT_ID, {
    editedText: "Värskelt kinnitatud üldistus töökoormusest.",
    userReviewed: true,
    userConfirmed: true,
    expectedUpdatedAt: staleRequest.expectedUpdatedAt
  }, { prisma: db });

  await expectPublicFailure(
    () => startCovisionFromWellbeingDraft(ownerActor(), DRAFT_ID, staleRequest, { db }),
    { status: 409, message: "wellbeing.errors.covision_handoff_conflict" }
  );
  assert.equal(db.store.cases.length, 0);

  await startCovisionFromWellbeingDraft(
    ownerActor(),
    DRAFT_ID,
    { expectedUpdatedAt: new Date(confirmed.updatedAt).toISOString(), confirmedNoIdentifiers: true },
    { db }
  );
  assert.equal(db.store.privateStates[0].content.text, "Värskelt kinnitatud üldistus töökoormusest.");
});

test("a whitespace-only visible version cannot be confirmed and can never trigger hidden generated-text handoff", async () => {
  const db = makeDb({ draft: makeDraft({ status: "draft", editedText: null, userReviewed: false, userConfirmed: false }) });
  const fingerprint = new Date(db.store.drafts[0].updatedAt).toISOString();
  const error = await confirmWellbeingOutputDraftForUser(OWNER, DRAFT_ID, {
    editedText: "   \n ",
    userReviewed: true,
    userConfirmed: true,
    expectedUpdatedAt: fingerprint
  }, { prisma: db }).then(() => null, (caught) => caught);

  assert.equal(error?.status, 400);
  assert.equal(error?.message, "wellbeing.errors.output_text_required");
  assert.equal(db.store.drafts[0].status, "draft");
  assert.equal(db.store.cases.length, 0);
  assert.equal(db.store.privateStates.length, 0);
});

test("handoff-before-confirmation freezes the transferred text and blocks later draft overwrite", async () => {
  const db = makeDb();
  const fingerprint = requestFor(db.store.drafts[0]).expectedUpdatedAt;
  await startCovisionFromWellbeingDraft(
    ownerActor(), DRAFT_ID, { expectedUpdatedAt: fingerprint, confirmedNoIdentifiers: true }, { db }
  );

  const error = await confirmWellbeingOutputDraftForUser(OWNER, DRAFT_ID, {
    editedText: "Liiga hiline asendus.",
    userReviewed: true,
    userConfirmed: true,
    expectedUpdatedAt: new Date(db.store.drafts[0].updatedAt).toISOString()
  }, { prisma: db }).then(() => null, (caught) => caught);

  assert.equal(error?.status, 409);
  assert.equal(db.store.privateStates[0].content.text, SAFE_EDITED);
  assert.equal(db.store.drafts[0].editedText, SAFE_EDITED);
  assert.equal(db.store.cases.length, 1);
});

test("a failed final link CAS rolls the transaction back without orphan case state", async () => {
  const db = makeDb({ failLinkCas: true });
  const originalDraft = structuredClone(db.store.drafts[0]);

  await expectPublicFailure(
    () => startCovisionFromWellbeingDraft(
      ownerActor(),
      DRAFT_ID,
      requestFor(db.store.drafts[0]),
      { db }
    ),
    { status: 409, message: "wellbeing.errors.covision_handoff_conflict" }
  );

  assert.equal(db.calls.rollbacks, 1);
  assert.deepEqual(db.store.drafts[0], originalDraft);
  assert.equal(db.store.cases.length, 0);
  assert.equal(db.store.participants.length, 0);
  assert.equal(db.store.sessions.length, 0);
  assert.equal(db.store.participantStates.length, 0);
  assert.equal(db.store.privateStates.length, 0);
});

test("invited and accepted colleagues never receive the owner's private stage-2 prefill", async () => {
  const db = makeDb();
  const handoff = await startCovisionFromWellbeingDraft(
    ownerActor(), DRAFT_ID, requestFor(db.store.drafts[0]), { db }
  );
  const session = db.store.sessions[0];
  db.store.participants.push({
    id: "participant_colleague",
    covisionCaseId: handoff.covisionCaseId,
    userId: OTHER,
    email: null,
    role: "PARTICIPANT",
    inviteStatus: "INVITED",
    createdAt: new Date("2026-07-14T12:10:00.000Z"),
    updatedAt: new Date("2026-07-14T12:10:00.000Z")
  });
  db.store.participantStates.push({
    id: "participant_state_colleague",
    sessionId: session.id,
    participantId: "participant_colleague",
    presentAt: null,
    roleConfirmedAt: null,
    agreementConfirmedAt: null,
    readyAt: null,
    createdAt: new Date("2026-07-14T12:10:00.000Z"),
    updatedAt: new Date("2026-07-14T12:10:00.000Z")
  });

  const invited = await getCovisionSessionForUser(
    { userId: OTHER, email: "colleague@example.test" },
    handoff.covisionCaseId,
    { db }
  );
  assert.deepEqual(invited.case, { id: handoff.covisionCaseId });
  assert.equal("privateStates" in (invited.session || {}), false);
  assert.equal(JSON.stringify(invited).includes(SAFE_EDITED), false);

  db.store.participants.find((item) => item.id === "participant_colleague").inviteStatus = "ACCEPTED";
  const colleagueState = db.store.participantStates.find((item) => item.participantId === "participant_colleague");
  colleagueState.roleConfirmedAt = new Date("2026-07-14T12:11:00.000Z");
  colleagueState.agreementConfirmedAt = new Date("2026-07-14T12:12:00.000Z");
  colleagueState.readyAt = new Date("2026-07-14T12:13:00.000Z");
  const accepted = await getCovisionSessionForUser(
    { userId: OTHER, email: "colleague@example.test" },
    handoff.covisionCaseId,
    { db }
  );
  assert.deepEqual(accepted.session.privateStates, []);
  assert.equal(JSON.stringify(accepted).includes(SAFE_EDITED), false);

  const owner = await getCovisionSessionForUser(OWNER, handoff.covisionCaseId, { db });
  assert.equal(owner.session.privateStates.length, 1);
  assert.equal(owner.session.privateStates[0].content.text, SAFE_EDITED);
});
