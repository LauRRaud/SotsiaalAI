import test from "node:test";
import assert from "node:assert/strict";

import {
  PROVENANCE,
  PROVENANCES,
  isProvenance,
  provenanceLabelKey,
  CARRIER_CLASS,
  isCarrierClass,
  carrierClassForArtifactStatus,
  isShareableCarrierClass,
  STAR2_TRANSFER_STATES,
  isStar2TransferState,
  canTransitionStar2,
  isStar2Terminal,
  isStar2ReviewKind
} from "../../lib/workspaces/provenance.js";
import {
  FIELD_PROVENANCE,
  FIELD_PROVENANCES,
  isFieldProvenance
} from "../../lib/field/constants.js";
import {
  RESERVED_WORKSPACE_KINDS,
  SUPPORTED_WORKSPACE_KINDS,
  WorkspaceKind,
  WorkspaceKindStatus,
  WORKSPACE_KIND_REGISTRY
} from "../../lib/workspaces/registry.js";
import {
  assertWorkspaceDescriptor,
  WorkspaceLifecycle
} from "../../lib/workspaces/descriptor.js";
import {
  listReceivedCaseWork,
  toReceivedCaseWorkDescriptor,
  preInquiryLifecycle,
  PRE_INQUIRY_STATUSES,
  PRE_INQUIRY_K1_LIFECYCLE
} from "../../lib/workspaces/adapters/preInquiryReceiverAdapter.js";
import {
  listCaseArtifacts,
  toCaseArtifactShareDescriptor,
  assertCaseArtifactShareDescriptor,
  agentArtifactTypeLabelKey,
  isAgentArtifactType,
  AGENT_ARTIFACT_TYPES,
  AGENT_ARTIFACT_STATUSES,
  CaseArtifactShareDescriptorError
} from "../../lib/workspaces/adapters/caseArtifactAdapter.js";

const RECEIVER = "user_receiver";
const OWNER = "user_owner";
const OUTSIDER = "user_outsider";
const AUTHOR = "user_author";

// ---------------------------------------------------------------------------
// One dictionary — FIELD re-exports provenance (T24 duplication consolidated).
// ---------------------------------------------------------------------------

test("provenance is a single shared dictionary; FIELD re-exports it byte-identically", () => {
  assert.deepEqual(PROVENANCES, [
    "KLIENDI_OELDUD",
    "KLIENDI_KINNITATUD",
    "DOKUMENDIST",
    "TEISE_SPETSIALISTI_INFO",
    "TOOTAJA_TAHELEPANEK",
    "TOOTAJA_TOLGENDUS",
    "AI_MUSTAND",
    "AMETLIKULT_KONTROLLITUD"
  ]);
  // FIELD points at the SAME object and array — not a second copy.
  assert.equal(FIELD_PROVENANCE, PROVENANCE);
  assert.equal(FIELD_PROVENANCES, PROVENANCES);
  for (const value of PROVENANCES) {
    assert.equal(isProvenance(value), true);
    assert.equal(isFieldProvenance(value), true, `${value} must stay a valid FIELD provenance`);
    assert.equal(provenanceLabelKey(value), `casework.provenance.${value}`);
  }
  assert.equal(isProvenance("MADE_UP"), false);
  assert.equal(isFieldProvenance("MADE_UP"), false);
  assert.equal(provenanceLabelKey("MADE_UP"), null);
});

test("carrier class and STAR2 transfer dictionaries validate and fail closed on unknowns", () => {
  assert.deepEqual(Object.values(CARRIER_CLASS), [1, 2, 3]);
  assert.equal(carrierClassForArtifactStatus("DRAFT"), 1);
  assert.equal(carrierClassForArtifactStatus("FINAL"), 2);
  assert.equal(carrierClassForArtifactStatus("SOMETHING"), null);
  assert.equal(isShareableCarrierClass(2), true);
  assert.equal(isShareableCarrierClass(1), false);
  assert.equal(isCarrierClass(3), true);
  assert.equal(isCarrierClass(4), false);

  assert.deepEqual(STAR2_TRANSFER_STATES, [
    "MUSTAND",
    "VAJAB_KONTROLLI",
    "KONTROLLITUD",
    "VALMIS_ULEKANDEKS",
    "ULE_KANTUD",
    "EI_KANTA"
  ]);
  assert.equal(canTransitionStar2("MUSTAND", "VAJAB_KONTROLLI"), true);
  assert.equal(canTransitionStar2("VALMIS_ULEKANDEKS", "ULE_KANTUD"), true);
  assert.equal(canTransitionStar2("MUSTAND", "EI_KANTA"), true);
  assert.equal(canTransitionStar2("MUSTAND", "ULE_KANTUD"), false, "no state jump");
  assert.equal(canTransitionStar2("ULE_KANTUD", "MUSTAND"), false, "terminal is write-protected");
  assert.equal(isStar2Terminal("ULE_KANTUD"), true);
  assert.equal(isStar2Terminal("EI_KANTA"), true);
  assert.equal(isStar2Terminal("MUSTAND"), false);
  assert.equal(isStar2TransferState("NONSENSE"), false);
  assert.equal(isStar2ReviewKind("KLIENDIGA"), true);
  assert.equal(isStar2ReviewKind("DOKUMENDIGA"), true);
  assert.equal(isStar2ReviewKind("NONSENSE"), false);
});

// ---------------------------------------------------------------------------
// Registry — two new kinds reserved, supported list unchanged.
// ---------------------------------------------------------------------------

/* T21 P3: practice_reflection muutus SUPPORTED-iks (adapter olemas). case_work
   jääb RESERVED kuni P2 STAR2-ülekanne selle avab. */
test("registry keeps case_work reserved; practice_reflection is supported since P3", () => {
  assert.equal(WORKSPACE_KIND_REGISTRY[WorkspaceKind.CASE_WORK].status, WorkspaceKindStatus.RESERVED);
  assert.equal(WORKSPACE_KIND_REGISTRY[WorkspaceKind.PRACTICE_REFLECTION].status, WorkspaceKindStatus.SUPPORTED);
  assert.equal(WORKSPACE_KIND_REGISTRY[WorkspaceKind.CASE_WORK].adapter, null);
  assert.equal(WORKSPACE_KIND_REGISTRY[WorkspaceKind.PRACTICE_REFLECTION].adapter, "practiceReflection");
  assert.ok(RESERVED_WORKSPACE_KINDS.includes("case_work"));
  assert.ok(SUPPORTED_WORKSPACE_KINDS.includes("practice_reflection"));
  assert.equal(SUPPORTED_WORKSPACE_KINDS.includes("case_work"), false);
  assert.equal(RESERVED_WORKSPACE_KINDS.includes("practice_reflection"), false);
  // Kuus algset adapterit + practice_reflection (T21 P3) + org_space (T25 viil A).
  assert.deepEqual(SUPPORTED_WORKSPACE_KINDS, [
    "room",
    "covision_case",
    "journey",
    "wellbeing_space",
    "mentoring_process",
    "field_visit",
    "org_space",
    "practice_reflection"
  ]);
});

// ---------------------------------------------------------------------------
// preInquiryReceiverAdapter — receiver-scoped, descriptor-only, read-only.
// ---------------------------------------------------------------------------

function preInquiryRow(overrides = {}) {
  return {
    id: "pi_1",
    authorId: AUTHOR,
    recipientOwnerId: RECEIVER,
    status: "SENT",
    nextContactOn: "2026-08-01",
    recalledAt: null,
    updatedAt: "2026-07-18T09:00:00.000Z",
    // Content columns that must never surface through this K1 read-surface:
    topic: "PRIVATE_TOPIC",
    situation: "PRIVATE_SITUATION",
    receiverNote: "PRIVATE_NOTE",
    generatedDraft: "PRIVATE_DRAFT",
    ...overrides
  };
}

function preInquiryDb(rowsByReceiver, calls) {
  return {
    preInquiry: {
      async findMany(query) {
        calls.push(structuredClone(query));
        return structuredClone(rowsByReceiver[query.where.recipientOwnerId] || []);
      },
      create() {
        throw new Error("K1 pre-inquiry adapter must not write");
      },
      update() {
        throw new Error("K1 pre-inquiry adapter must not write");
      },
      delete() {
        throw new Error("K1 pre-inquiry adapter must not write");
      }
    }
  };
}

test("preInquiryReceiverAdapter is receiver-scoped, descriptor-only and read-only", async () => {
  const calls = [];
  const db = preInquiryDb({ [RECEIVER]: [preInquiryRow()] }, calls);
  const rows = await listReceivedCaseWork(RECEIVER, { db });
  const outsider = await listReceivedCaseWork(OUTSIDER, { db });

  assert.equal(rows.length, 1);
  assert.deepEqual(outsider, []);

  const descriptor = rows[0];
  assert.doesNotThrow(() => assertWorkspaceDescriptor(descriptor));
  assert.deepEqual(descriptor.ref, { kind: "pre_inquiry", id: "pi_1" });
  assert.equal(descriptor.title, "workspace.kind.pre_inquiry");
  assert.equal(descriptor.ownerId, RECEIVER, "receiver owns the received item");
  assert.equal(descriptor.responsibleId, RECEIVER);
  assert.equal(descriptor.lifecycle, "ACTIVE");
  assert.equal(descriptor.visibility, "SHARED_PARTICIPANTS");
  assert.equal(descriptor.goal, null);
  assert.deepEqual(descriptor.nextAction, {
    labelKey: "casework.next_action.contact",
    dueOn: "2026-08-01",
    assigneeId: RECEIVER
  });
  assert.deepEqual(descriptor.participants, { active: 2, invited: 0 });
  assert.deepEqual(descriptor.href, { action: "open_workspace", target: "pre_inquiry:pi_1" });

  // Receiver-scoped query, only fact columns selected, unsent + recalled excluded.
  assert.equal(calls[0].where.recipientOwnerId, RECEIVER);
  assert.equal(calls[0].where.recalledAt, null);
  assert.deepEqual(calls[0].where.status, { in: ["SENT", "DOWNLOADED", "ARCHIVED"] });
  const queryText = JSON.stringify(calls[0]);
  for (const forbidden of ["topic", "situation", "receiverNote", "generatedDraft", "assessmentState"]) {
    assert.equal(queryText.includes(forbidden), false, `${forbidden} must not be selected`);
  }
  // No author identity and no content in the descriptor.
  assert.doesNotMatch(
    JSON.stringify(descriptor),
    /PRIVATE_TOPIC|PRIVATE_SITUATION|PRIVATE_NOTE|PRIVATE_DRAFT|user_author/u
  );

  // Missing viewer id never touches the database.
  let touched = false;
  const guardDb = { preInquiry: { async findMany() { touched = true; return []; } } };
  assert.deepEqual(await listReceivedCaseWork("", { db: guardDb }), []);
  assert.equal(touched, false);
});

test("every PreInquiryStatus maps to a lifecycle; recall maps to PURGED; unknown fails closed", () => {
  assert.deepEqual(PRE_INQUIRY_STATUSES, ["DRAFT", "READY", "SENT", "DOWNLOADED", "ARCHIVED"]);
  const expected = {
    DRAFT: "DRAFT",
    READY: "ACTIVE",
    SENT: "ACTIVE",
    DOWNLOADED: "CLOSED",
    ARCHIVED: "CLOSED"
  };
  for (const status of PRE_INQUIRY_STATUSES) {
    const lifecycle = preInquiryLifecycle({ status });
    assert.equal(lifecycle, expected[status], `${status} lifecycle`);
    assert.ok(Object.values(WorkspaceLifecycle).includes(lifecycle));
    assert.equal(PRE_INQUIRY_K1_LIFECYCLE[status], expected[status]);
  }
  // Recall before opening → PURGED, regardless of the underlying status.
  assert.equal(
    preInquiryLifecycle({ status: "SENT", recalledAt: "2026-07-18T10:00:00.000Z" }),
    "PURGED"
  );
  assert.throws(() => preInquiryLifecycle({ status: "MADE_UP" }), /Unsupported pre-inquiry status/u);

  // No / invalid nextContactOn → nextAction null.
  const noDate = toReceivedCaseWorkDescriptor(
    {
      id: "pi_2",
      recipientOwnerId: RECEIVER,
      status: "DOWNLOADED",
      nextContactOn: null,
      updatedAt: "2026-07-18T09:00:00.000Z"
    },
    RECEIVER
  );
  assert.equal(noDate.nextAction, null);
  assert.equal(noDate.lifecycle, "CLOSED");
});

// ---------------------------------------------------------------------------
// caseArtifactAdapter — owner-scoped sharing descriptors, content-free.
// ---------------------------------------------------------------------------

function artifactRow(overrides = {}) {
  return {
    id: "art_1",
    ownerId: OWNER,
    type: "CASE_BRIEF",
    status: "DRAFT",
    title: "Kliendi ülevaade",
    updatedAt: "2026-07-18T09:00:00.000Z",
    // Content that must never surface:
    content: "PRIVATE_ARTIFACT_BODY",
    metadata: { secret: "PRIVATE_META" },
    ...overrides
  };
}

function artifactDb(rowsByOwner, calls) {
  return {
    agentArtifact: {
      async findMany(query) {
        calls.push(structuredClone(query));
        return structuredClone(rowsByOwner[query.where.ownerId] || []);
      },
      create() {
        throw new Error("K1 case artifact adapter must not write");
      },
      update() {
        throw new Error("K1 case artifact adapter must not write");
      },
      delete() {
        throw new Error("K1 case artifact adapter must not write");
      }
    }
  };
}

test("caseArtifactAdapter is owner-scoped, maps DRAFT->1 / FINAL->2 and leaks no content", async () => {
  const calls = [];
  const db = artifactDb(
    {
      [OWNER]: [
        artifactRow(),
        artifactRow({ id: "art_2", type: "MEETING_SUMMARY", status: "FINAL", title: null })
      ]
    },
    calls
  );
  const rows = await listCaseArtifacts(OWNER, { db });
  const outsider = await listCaseArtifacts(OUTSIDER, { db });

  assert.equal(rows.length, 2);
  assert.deepEqual(outsider, []);

  const [draft, final] = rows;
  assert.doesNotThrow(() => assertCaseArtifactShareDescriptor(draft));
  assert.equal(draft.carrierClass, 1);
  assert.equal(draft.shareable, false, "a work draft is not shareable");
  assert.equal(draft.type, "CASE_BRIEF");
  assert.equal(draft.typeKey, "casework.artifact_type.CASE_BRIEF");
  assert.equal(draft.carrierClassKey, "casework.carrier_class.1");
  assert.equal(draft.title, "Kliendi ülevaade");
  assert.equal(draft.ownerId, OWNER);
  assert.equal(final.carrierClass, 2);
  assert.equal(final.shareable, true, "a confirmed summary is shareable as a frozen copy");
  assert.equal(final.title, null);

  // Owner-scoped query; body/metadata never selected or serialized.
  assert.deepEqual(calls[0].where, { ownerId: OWNER });
  const queryText = JSON.stringify(calls[0]);
  for (const forbidden of ["content", "metadata"]) {
    assert.equal(queryText.includes(forbidden), false, `${forbidden} must not be selected`);
  }
  assert.doesNotMatch(JSON.stringify(rows), /PRIVATE_ARTIFACT_BODY|PRIVATE_META/u);

  let touched = false;
  const guardDb = { agentArtifact: { async findMany() { touched = true; return []; } } };
  assert.deepEqual(await listCaseArtifacts("", { db: guardDb }), []);
  assert.equal(touched, false);
});

test("every AgentArtifactType maps to a label key; the share descriptor validator fails closed", () => {
  assert.equal(AGENT_ARTIFACT_TYPES.length, 11);
  for (const type of AGENT_ARTIFACT_TYPES) {
    assert.equal(isAgentArtifactType(type), true);
    assert.equal(agentArtifactTypeLabelKey(type), `casework.artifact_type.${type}`);
  }
  assert.equal(isAgentArtifactType("NOT_A_TYPE"), false);
  assert.equal(agentArtifactTypeLabelKey("NOT_A_TYPE"), null);
  assert.deepEqual(AGENT_ARTIFACT_STATUSES, ["DRAFT", "FINAL"]);

  const base = toCaseArtifactShareDescriptor(artifactRow());
  // An extra field fails closed (no accidental content passthrough).
  assert.throws(
    () => assertCaseArtifactShareDescriptor({ ...base, leaked: "x" }),
    (error) => error instanceof CaseArtifactShareDescriptorError
  );
  // Unknown enum values fail closed at map time.
  assert.throws(() => toCaseArtifactShareDescriptor(artifactRow({ type: "MADE_UP" })), /Unsupported agent artifact type/u);
  assert.throws(() => toCaseArtifactShareDescriptor(artifactRow({ status: "PUBLISHED" })), /Unsupported agent artifact status/u);
  // A carrier class that disagrees with the status fails closed.
  assert.throws(
    () =>
      assertCaseArtifactShareDescriptor({
        ...base,
        carrierClass: 2,
        carrierClassKey: "casework.carrier_class.2",
        shareable: true
      }),
    (error) => error instanceof CaseArtifactShareDescriptorError
  );
});
