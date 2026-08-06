import test from "node:test";
import assert from "node:assert/strict";

import {
  assertWorkspaceDescriptor,
  WorkspaceDescriptorValidationError,
  WorkspaceLifecycle,
  WorkspaceVisibility
} from "../../lib/workspaces/descriptor.js";
import {
  RESERVED_WORKSPACE_KINDS,
  SUPPORTED_WORKSPACE_KINDS,
  WorkspaceKind,
  WorkspaceKindStatus,
  WORKSPACE_KIND_REGISTRY
} from "../../lib/workspaces/registry.js";
import {
  listWorkspaces as listCovisionWorkspaces,
  toCovisionWorkspaceDescriptor
} from "../../lib/workspaces/adapters/covisionAdapter.js";
import {
  listWorkspaces as listRoomWorkspaces
} from "../../lib/workspaces/adapters/roomAdapter.js";
import {
  listWorkspaces as listJourneyWorkspaces,
  toJourneyWorkspaceDescriptor
} from "../../lib/workspaces/adapters/journeyAdapter.js";
import {
  listWorkspaces as listFieldVisitWorkspaces
} from "../../lib/workspaces/adapters/fieldVisitAdapter.js";
import {
  listWorkspaces as listWellbeingSpaceWorkspaces
} from "../../lib/workspaces/adapters/wellbeingAdapter.js";

const OWNER = "user_owner";
const PARTICIPANT = "user_participant";
const MEMBER = "user_member";
const OUTSIDER = "user_outsider";

function validDescriptor(overrides = {}) {
  return {
    ref: { kind: WorkspaceKind.ROOM, id: "room_1" },
    title: "workspace.kind.room",
    ownerId: OWNER,
    responsibleId: OWNER,
    lifecycle: WorkspaceLifecycle.ACTIVE,
    phase: null,
    goal: null,
    nextAction: null,
    progress: null,
    visibility: WorkspaceVisibility.SHARED_PARTICIPANTS,
    participants: { active: 2, invited: 0 },
    lastMeaningfulActivityAt: "2026-07-17T09:00:00.000Z",
    href: { action: "open_workspace", target: "room:room_1" },
    ...overrides
  };
}

function assertDescriptorContract(descriptor) {
  assert.doesNotThrow(() => assertWorkspaceDescriptor(descriptor));
  assert.deepEqual(Object.keys(descriptor).sort(), [
    "goal",
    "href",
    "lastMeaningfulActivityAt",
    "lifecycle",
    "nextAction",
    "ownerId",
    "participants",
    "phase",
    "progress",
    "ref",
    "responsibleId",
    "title",
    "visibility"
  ]);
}

test("K1 registry contains every approved kind and separates supported adapters from reservations", () => {
  assert.deepEqual(Object.keys(WORKSPACE_KIND_REGISTRY), [
    "room",
    "covision_case",
    "journey",
    "pre_inquiry",
    "wellbeing_space",
    "supervision_process",
    "mentoring_process",
    "topic_seed",
    "meeting",
    "network_case",
    "field_visit",
    "org_space",
    "case_work",
    "practice_reflection"
  ]);
  /* T25 ORG-FOUNDATION-V1 (viil A, otsus O-E0-2): `org_space` liikus RESERVED →
     SUPPORTED. See on TEADLIK lepingumuudatus, mitte testi lõdvendus —
     organisatsioonikontekst vajab üht kanoonilist ajajoone- ja auditivõtit.
     JUHTUM-V1 E5 (06.08): `case_work` liikus samal põhjusel ja sama mustri järgi,
     kui juhtumi objekt ise koodi jõudis (CASEWORK-P7). */
  assert.deepEqual(SUPPORTED_WORKSPACE_KINDS, [
    "room",
    "covision_case",
    "journey",
    "wellbeing_space",
    "mentoring_process",
    "field_visit",
    "org_space",
    "case_work",
    "practice_reflection"
  ]);
  assert.deepEqual(RESERVED_WORKSPACE_KINDS, [
    "pre_inquiry",
    "supervision_process",
    "topic_seed",
    "meeting",
    "network_case"
  ]);
  assert.equal(WORKSPACE_KIND_REGISTRY.room.status, WorkspaceKindStatus.SUPPORTED);
  assert.equal(WORKSPACE_KIND_REGISTRY.meeting.status, WorkspaceKindStatus.RESERVED);
  assert.deepEqual(Object.values(WorkspaceLifecycle), [
    "DRAFT", "ACTIVE", "PAUSED", "CLOSED", "ARCHIVED", "PURGED", "DELETED"
  ]);
});

test("Journey adapter is owner-scoped, private, descriptor-only and read-only", async () => {
  const privateRow = {
    id: "journey_1",
    ownerUserId: OWNER,
    title: "My journey",
    status: "ACTIVE",
    updatedAt: "2026-07-17T09:00:00.000Z",
    summary: "PRIVATE_SUMMARY",
    riskSignals: ["PRIVATE_RISK"]
  };
  const calls = [];
  const db = { journey: { async findMany(query) { calls.push(query); return [privateRow]; } } };
  const [descriptor] = await listJourneyWorkspaces(OWNER, { db });
  assertDescriptorContract(descriptor);
  assert.equal(descriptor.visibility, "PRIVATE");
  assert.equal(descriptor.lifecycle, "ACTIVE");
  assert.doesNotMatch(JSON.stringify(descriptor), /PRIVATE_SUMMARY|PRIVATE_RISK/u);
  assert.deepEqual(calls[0].where, { ownerUserId: OWNER });
  assert.doesNotThrow(() => toJourneyWorkspaceDescriptor({ ...privateRow, status: "ARCHIVED" }));
});

test("FieldVisit adapter is owner-scoped, private, descriptor-only and read-only", async () => {
  const privateRow = {
    id: "visit_1",
    ownerUserId: OWNER,
    status: "IN_PROGRESS",
    goal: "Kodukülastus",
    updatedAt: "2026-07-18T09:00:00.000Z",
    locationText: "PRIVATE_LOCATION",
    safetyContactEmail: "PRIVATE_CONTACT"
  };
  const calls = [];
  const db = { fieldVisit: { async findMany(query) { calls.push(query); return [privateRow]; } } };
  const [descriptor] = await listFieldVisitWorkspaces(OWNER, { db });
  assertDescriptorContract(descriptor);
  assert.equal(descriptor.visibility, "PRIVATE");
  assert.equal(descriptor.lifecycle, "ACTIVE");
  assert.equal(descriptor.phase?.key, "on_site");
  assert.doesNotMatch(JSON.stringify(descriptor), /PRIVATE_LOCATION|PRIVATE_CONTACT/u);
  assert.deepEqual(calls[0].where, { ownerUserId: OWNER });
  const empty = await listFieldVisitWorkspaces("", { db });
  assert.deepEqual(empty, []);
});

test("Wellbeing space adapter is owner-scoped, private, contentless and descriptor-only", async () => {
  const calls = { record: [], draft: [], checkpoint: [] };
  const db = {
    wellbeingRecord: {
      async findFirst(query) {
        calls.record.push(query);
        // Fake honours `select`: only the requested column is returned, so if
        // the adapter ever asked for signal/answer columns they would surface.
        return { createdAt: "2026-07-15T09:00:00.000Z" };
      },
      async findMany(query) {
        calls.checkpoint.push(query);
        return [];
      }
    },
    wellbeingOutputDraft: {
      async findFirst(query) {
        calls.draft.push(query);
        return { updatedAt: "2026-07-18T09:00:00.000Z" };
      }
    }
  };

  const [descriptor] = await listWellbeingSpaceWorkspaces(OWNER, { db });
  assertDescriptorContract(descriptor);
  assert.deepEqual(descriptor.ref, { kind: "wellbeing_space", id: OWNER });
  assert.equal(descriptor.title, "workspace.kind.wellbeing_space");
  assert.equal(descriptor.ownerId, OWNER);
  assert.equal(descriptor.responsibleId, OWNER);
  assert.equal(descriptor.visibility, "PRIVATE");
  assert.equal(descriptor.lifecycle, "ACTIVE");
  assert.equal(descriptor.phase, null);
  assert.equal(descriptor.goal, null);
  assert.equal(descriptor.progress, null);
  assert.equal(descriptor.nextAction, null);
  assert.deepEqual(descriptor.participants, { active: 1, invited: 0 });
  // lastMeaningfulActivityAt = max(record.createdAt, draft.updatedAt).
  assert.equal(descriptor.lastMeaningfulActivityAt, "2026-07-18T09:00:00.000Z");
  assert.deepEqual(descriptor.href, { action: "open_workspace", target: "wellbeing_space:user_owner" });

  // Owner-scoped queries; only timestamp columns selected (W-INV-7 contentless).
  assert.deepEqual(calls.record[0].where, { ownerUserId: OWNER });
  assert.deepEqual(calls.record[0].select, { createdAt: true });
  assert.deepEqual(calls.draft[0].where, { userId: OWNER });
  assert.deepEqual(calls.draft[0].select, { updatedAt: true });
  // The checkpoint probe is owner-scoped and selects only the date + the JSON
  // it needs to tell answered from open — never the signal/answer columns.
  assert.deepEqual(calls.checkpoint[0].where, { ownerUserId: OWNER, checkpointDueOn: { not: null } });
  assert.deepEqual(calls.checkpoint[0].select, { checkpointDueOn: true, checkpoint: true });
  const queryText = JSON.stringify(calls);
  for (const forbidden of [
    "standardizedFields", "computedSignal", "loadFactors", "resourceFactors",
    "riskMarkers", "recommendedActions", "workflowType", "generatedText", "editedText"
  ]) {
    assert.equal(queryText.includes(forbidden), false, `${forbidden} must not be selected`);
  }
  const serialized = JSON.stringify(descriptor);
  assert.doesNotMatch(serialized, /workflowType|signal|loadFactor|riskMarker|quick-check/iu);
});

test("Wellbeing space adapter returns an empty list for outsiders and empty rooms", async () => {
  const emptyRoomDb = {
    wellbeingRecord: { async findFirst() { return null; }, async findMany() { return []; } },
    wellbeingOutputDraft: { async findFirst() { return null; } }
  };
  // A user with no records and no drafts yields no descriptor (canonical
  // ISO timestamp required; empty-room-null is not representable).
  assert.deepEqual(await listWellbeingSpaceWorkspaces(OWNER, { db: emptyRoomDb }), []);
  // Missing user id never touches the database.
  let touched = false;
  const guardDb = {
    wellbeingRecord: { async findFirst() { touched = true; return null; }, async findMany() { touched = true; return []; } },
    wellbeingOutputDraft: { async findFirst() { touched = true; return null; } }
  };
  assert.deepEqual(await listWellbeingSpaceWorkspaces("", { db: guardDb }), []);
  assert.equal(touched, false);
});

test("Wellbeing space nextAction carries an open checkpoint's date only — no content, answered ones excluded", async () => {
  // Candidates ordered by dueOn asc (as the adapter queries). The earliest is
  // already answered (follow-up recorded) so it is NOT the next action; the
  // next unanswered one is what surfaces.
  const db = {
    wellbeingRecord: {
      async findFirst() { return { createdAt: "2026-07-15T09:00:00.000Z" }; },
      async findMany() {
        return [
          {
            checkpointDueOn: "2026-07-20T00:00:00.000Z",
            checkpoint: { nextStep: "Räägin juhiga", setAt: "2026-07-15T09:00:00.000Z", followUp: { state: "kept", notedAt: "2026-07-21T09:00:00.000Z" } }
          },
          {
            checkpointDueOn: "2026-07-25T00:00:00.000Z",
            checkpoint: { nextStep: "Vaatan koormuse üle", setAt: "2026-07-16T09:00:00.000Z", followUp: null }
          }
        ];
      }
    },
    wellbeingOutputDraft: { async findFirst() { return null; } }
  };

  const [descriptor] = await listWellbeingSpaceWorkspaces(OWNER, { db });
  assertDescriptorContract(descriptor);
  assert.deepEqual(descriptor.nextAction, {
    labelKey: "wellbeing.space.checkpoint",
    dueOn: "2026-07-25",
    assigneeId: OWNER
  });
  // The plan text must never reach the descriptor (W-INV-7).
  const serialized = JSON.stringify(descriptor);
  assert.equal(serialized.includes("Vaatan koormuse üle"), false);
  assert.equal(serialized.includes("Räägin juhiga"), false);

  // All checkpoints answered → no next action.
  const answeredDb = {
    wellbeingRecord: {
      async findFirst() { return { createdAt: "2026-07-15T09:00:00.000Z" }; },
      async findMany() {
        return [{
          checkpointDueOn: "2026-07-20T00:00:00.000Z",
          checkpoint: { nextStep: "x", setAt: "2026-07-15T09:00:00.000Z", followUp: { state: "unclear", notedAt: "2026-07-21T09:00:00.000Z" } }
        }];
      }
    },
    wellbeingOutputDraft: { async findFirst() { return null; } }
  };
  const [answered] = await listWellbeingSpaceWorkspaces(OWNER, { db: answeredDb });
  assert.equal(answered.nextAction, null);
});

test("descriptor validation rejects unknown kinds and invalid or extra fields fail closed", () => {
  assert.throws(
    () => assertWorkspaceDescriptor(validDescriptor({
      ref: { kind: "unknown_workspace", id: "unknown_1" },
      href: { action: "open_workspace", target: "unknown_workspace:unknown_1" }
    })),
    (error) => error instanceof WorkspaceDescriptorValidationError && error.code === "INVALID_WORKSPACE_DESCRIPTOR"
  );
  assert.throws(
    () => assertWorkspaceDescriptor({ ...validDescriptor(), privateModuleContent: "must never pass" }),
    (error) => error instanceof WorkspaceDescriptorValidationError && error.code === "INVALID_WORKSPACE_DESCRIPTOR"
  );
  assert.throws(
    () => assertWorkspaceDescriptor(validDescriptor({
      participants: { active: 2, invited: 0, privateCount: 1 }
    })),
    (error) => error instanceof WorkspaceDescriptorValidationError && error.code === "INVALID_WORKSPACE_DESCRIPTOR"
  );
  assert.throws(
    () => assertWorkspaceDescriptor(validDescriptor({
      nextAction: { labelKey: "workspace.next", dueOn: "17-07-2026", assigneeId: OWNER }
    })),
    (error) => error instanceof WorkspaceDescriptorValidationError && error.code === "INVALID_WORKSPACE_DESCRIPTOR"
  );
});

function covisionRow(overrides = {}) {
  return {
    id: "covision_1",
    ownerId: OWNER,
    status: "ACTIVE",
    lastActivityAt: "2026-07-17T08:00:00.000Z",
    updatedAt: "2026-07-17T08:00:00.000Z",
    summary: "PRIVATE_CASE_SUMMARY",
    centralQuestion: "PRIVATE_CASE_QUESTION",
    messages: [{ body: "PRIVATE_CASE_MESSAGE" }],
    sessionState: {
      stage: 3,
      phase: "question_queue",
      pausedAt: null
    },
    participants: [
      { inviteStatus: "ACCEPTED" },
      { inviteStatus: "ACCEPTED" },
      { inviteStatus: "INVITED" }
    ],
    closure: {
      assignedFollowUpUserId: PARTICIPANT,
      lifecycleStatus: "FOLLOW_UP_PENDING",
      retentionStatus: "RETAINED_SELECTED_OUTPUT",
      updatedAt: "2026-07-17T09:00:00.000Z",
      nextStep: "PRIVATE_NEXT_STEP",
      followUps: [{
        status: "SCHEDULED",
        scheduledFor: "2026-07-28T12:00:00.000Z",
        assignedToUserId: PARTICIPANT,
        whatWasDone: "PRIVATE_FOLLOW_UP_CONTENT"
      }]
    },
    ...overrides
  };
}

function covisionDb(rowsByViewer, calls) {
  return {
    covisionCase: {
      async findMany(query) {
        calls.push(structuredClone(query));
        const ownerWhere = query.where.OR[0].ownerId;
        const participantWhere = query.where.OR[1].participants.some.userId;
        assert.equal(ownerWhere, participantWhere, "owner and participant alternatives scope the same viewer");
        return structuredClone(rowsByViewer[ownerWhere] || []);
      },
      create() {
        throw new Error("K1 Covision adapter must not write");
      },
      update() {
        throw new Error("K1 Covision adapter must not write");
      },
      delete() {
        throw new Error("K1 Covision adapter must not write");
      }
    }
  };
}

test("Covision adapter is owner-or-accepted-participant scoped, descriptor-only, and read-only", async () => {
  const calls = [];
  const db = covisionDb({ [OWNER]: [covisionRow()], [PARTICIPANT]: [covisionRow()] }, calls);
  const ownerRows = await listCovisionWorkspaces(OWNER, { db });
  const participantRows = await listCovisionWorkspaces(PARTICIPANT, { db });
  const outsiderRows = await listCovisionWorkspaces(OUTSIDER, { db });

  assert.equal(ownerRows.length, 1);
  assert.equal(participantRows.length, 1);
  assert.deepEqual(outsiderRows, []);
  const descriptor = ownerRows[0];
  assertDescriptorContract(descriptor);
  assert.equal(descriptor.lifecycle, "ACTIVE");
  assert.deepEqual(descriptor.phase, {
    stage: 3,
    key: "question_queue",
    labelKey: "covision.stage.3"
  });
  assert.deepEqual(descriptor.nextAction, {
    labelKey: "covision.next_action.follow_up",
    dueOn: "2026-07-28",
    assigneeId: PARTICIPANT
  });
  assert.deepEqual(descriptor.participants, { active: 2, invited: 1 });
  const serialized = JSON.stringify(descriptor);
  for (const privateMarker of [
    "PRIVATE_CASE_SUMMARY",
    "PRIVATE_CASE_QUESTION",
    "PRIVATE_CASE_MESSAGE",
    "PRIVATE_NEXT_STEP",
    "PRIVATE_FOLLOW_UP_CONTENT"
  ]) {
    assert.equal(serialized.includes(privateMarker), false);
  }

  const queryText = JSON.stringify(calls[0]);
  assert.match(queryText, /"ownerId":"user_owner"/u);
  assert.match(queryText, /"inviteStatus":"ACCEPTED"/u);
  for (const privateField of ["summary", "centralQuestion", "messages", "privateStates", "nextStep", "whatWasDone"]) {
    assert.equal(queryText.includes(privateField), false, `${privateField} must not be selected`);
  }
});

test("Covision lifecycle maps paused, closed-and-purged, and archived states without raw closure text", () => {
  const paused = toCovisionWorkspaceDescriptor(covisionRow({
    sessionState: { stage: 4, phase: "paused", pausedAt: "2026-07-17T08:30:00.000Z" }
  }));
  assert.equal(paused.lifecycle, "PAUSED");

  const purged = toCovisionWorkspaceDescriptor(covisionRow({
    status: "CLOSED",
    closure: {
      assignedFollowUpUserId: null,
      lifecycleStatus: "CLOSED",
      retentionStatus: "DELETED",
      closedAt: "2026-07-17T09:00:00.000Z",
      updatedAt: "2026-07-17T09:00:00.000Z",
      followUps: []
    }
  }));
  assert.equal(purged.lifecycle, "PURGED");
  assert.equal(purged.nextAction, null);

  const archived = toCovisionWorkspaceDescriptor(covisionRow({ status: "ARCHIVED" }));
  assert.equal(archived.lifecycle, "ARCHIVED");
});

function roomMembership(overrides = {}) {
  return {
    roomId: "room_1",
    room: {
      id: "room_1",
      ownerId: OWNER,
      title: "Turvaline ühisruum",
      description: "PRIVATE_ROOM_DESCRIPTION",
      messages: [{ content: "PRIVATE_ROOM_MESSAGE" }],
      recordings: [{ content: "PRIVATE_RECORDING" }],
      createdAt: "2026-07-16T08:00:00.000Z",
      updatedAt: "2026-07-17T08:00:00.000Z",
      members: [{ id: "member_1" }, { id: "member_2" }]
    },
    ...overrides
  };
}

function roomDb(rowsByViewer, calls) {
  return {
    roomMember: {
      async findMany(query) {
        calls.push(structuredClone(query));
        return structuredClone(rowsByViewer[query.where.userId] || []);
      },
      create() {
        throw new Error("K1 Room adapter must not write");
      },
      update() {
        throw new Error("K1 Room adapter must not write");
      },
      delete() {
        throw new Error("K1 Room adapter must not write");
      }
    }
  };
}

test("Room adapter requires active membership, reports the honest current lifecycle, and returns no content", async () => {
  const calls = [];
  const db = roomDb({ [MEMBER]: [roomMembership()] }, calls);
  const memberRows = await listRoomWorkspaces(MEMBER, { db });
  const outsiderRows = await listRoomWorkspaces(OUTSIDER, { db });

  assert.equal(memberRows.length, 1);
  assert.deepEqual(outsiderRows, []);
  const descriptor = memberRows[0];
  assertDescriptorContract(descriptor);
  assert.equal(descriptor.lifecycle, "ACTIVE");
  assert.equal(descriptor.visibility, "SHARED_PARTICIPANTS");
  assert.equal(descriptor.phase, null);
  assert.equal(descriptor.progress, null);
  assert.equal(descriptor.nextAction, null);
  assert.deepEqual(descriptor.participants, { active: 2, invited: 0 });
  const serialized = JSON.stringify(descriptor);
  for (const privateMarker of ["PRIVATE_ROOM_DESCRIPTION", "PRIVATE_ROOM_MESSAGE", "PRIVATE_RECORDING"]) {
    assert.equal(serialized.includes(privateMarker), false);
  }

  assert.deepEqual(calls[0].where, { userId: MEMBER, leftAt: null });
  const queryText = JSON.stringify(calls[0]);
  for (const privateField of ["description", "messages", "recordings", "summary", "content"]) {
    assert.equal(queryText.includes(privateField), false, `${privateField} must not be selected`);
  }
});
