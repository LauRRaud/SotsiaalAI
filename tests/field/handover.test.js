import test from "node:test";
import assert from "node:assert/strict";

import { FIELD_PROVENANCE } from "../../lib/field/constants.js";
import { handoverFieldVisit } from "../../lib/field/service.js";
import { createFieldDb, makeVisit } from "../helpers/fieldDb.mjs";

const NOW = new Date("2026-07-18T12:00:00.000Z");
let actionSequence = 0;
const handoverInput = (payload, clientActionId = `field-action-${String(++actionSequence).padStart(4, "0")}`) => ({
  clientActionId,
  ...payload
});

function note(overrides = {}) {
  return {
    id: "note-1",
    visitId: "visit-1",
    clientItemId: "fld-note-000001",
    revision: 1,
    kind: "note",
    provenance: FIELD_PROVENANCE.KLIENDI_OELDUD,
    body: "Klient ütles, et küte töötab.",
    contentSha256: "sha",
    consentKind: null,
    consentSubject: null,
    consentForm: null,
    consentWithdrawnAt: null,
    aiConfirmedAt: null,
    conflictState: null,
    conflictRevision: null,
    conflictBody: null,
    conflictProvenance: null,
    deviceCreatedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
  };
}

function inquiry(overrides = {}) {
  return {
    id: "inq-1",
    recipientOwnerId: "user-1",
    recalledAt: null,
    receiverNote: null,
    receiverChecklist: null,
    nextContactOn: null,
    status: "SENT",
    updatedAt: NOW,
    ...overrides
  };
}

function recordingWorkflow() {
  const calls = [];
  const workflow = async (userId, inquiryId, patch) => {
    calls.push({ userId, inquiryId, patch });
    return { id: inquiryId, ...patch };
  };
  workflow.calls = calls;
  return workflow;
}

async function status(promise) {
  try {
    await promise;
    return null;
  } catch (error) {
    return { status: error.status, message: error.message };
  }
}

test("artifact handover writes one CASE_SUMMARY draft and stamps the visit in the same transaction", async () => {
  const db = createFieldDb({ visits: [makeVisit()], notes: [note()] });

  const result = await handoverFieldVisit("user-1", "visit-1", handoverInput({ toArtifact: true }), { db, now: NOW });

  assert.equal(db.store.artifacts.length, 1);
  const artifact = db.store.artifacts[0];
  assert.equal(artifact.ownerId, "user-1");
  assert.equal(artifact.type, "CASE_SUMMARY");
  assert.equal(artifact.status, "DRAFT");
  assert.equal(artifact.metadata.source, "FIELD_VISIT");
  assert.equal(artifact.metadata.fieldVisitId, "visit-1");
  assert.ok(artifact.metadata.handoverId);
  assert.equal(result.visit.handoverArtifactAt, NOW.toISOString());
  assert.equal(db.store.visits[0].handoverArtifactAt.toISOString(), NOW.toISOString());
});

test("the artifact carries provenance, flags unconfirmed AI text and never silently promotes it", async () => {
  const db = createFieldDb({
    visits: [makeVisit()],
    notes: [
      note(),
      note({
        id: "note-2",
        clientItemId: "fld-note-000002",
        provenance: FIELD_PROVENANCE.AI_MUSTAND,
        body: "AI pakkus kokkuvõtte.",
        aiConfirmedAt: null
      }),
      note({
        id: "note-3",
        clientItemId: "fld-note-000003",
        kind: "consent",
        consentKind: "photo",
        body: "Nõusolek pildistamiseks."
      })
    ]
  });

  await handoverFieldVisit("user-1", "visit-1", handoverInput({ toArtifact: true }), { db, now: NOW });
  const content = db.store.artifacts[0].content;

  assert.match(content, /\[KLIENDI_OELDUD\] Klient ütles, et küte töötab\./);
  assert.match(content, /\[AI_MUSTAND \(kinnitamata\)\] AI pakkus kokkuvõtte\./);
  // Consent records are evidence, not case narrative: they stay out of the draft.
  assert.equal(content.includes("Nõusolek pildistamiseks."), false);
  assert.match(content, /See on töömustand \(klass 1\), mitte ametlik dokument\./);
});

test("only the selected notes reach the draft when the worker narrows the selection", async () => {
  const db = createFieldDb({
    visits: [makeVisit()],
    notes: [note(), note({ id: "note-2", clientItemId: "fld-note-000002", body: "Teine märge." })]
  });

  await handoverFieldVisit(
    "user-1",
    "visit-1",
    handoverInput({ toArtifact: true, noteClientItemIds: ["fld-note-000002"] }),
    { db, now: NOW }
  );

  const content = db.store.artifacts[0].content;
  assert.match(content, /Teine märge\./);
  assert.equal(content.includes("Klient ütles, et küte töötab."), false);
});

test("pre-inquiry handover APPENDS and never overwrites the receiver's existing text", async () => {
  const db = createFieldDb({
    visits: [makeVisit({ preInquiryId: "inq-1" })],
    preInquiries: [inquiry({ receiverNote: "Vastuvõtja varasem plaan: helistada esmaspäeval." })]
  });
  const workflow = recordingWorkflow();

  await handoverFieldVisit(
    "user-1",
    "visit-1",
    handoverInput({ toPreInquiry: true, preInquiryNote: "Külastus tehtud, küte korras." }),
    { db, now: NOW, workflow }
  );

  assert.equal(workflow.calls.length, 1);
  const written = workflow.calls[0].patch.receiverNote;
  assert.match(written, /^Vastuvõtja varasem plaan: helistada esmaspäeval\./);
  assert.match(written, /--- Välitöö üleandmine 2026-07-18 ---/);
  assert.match(written, /Külastus tehtud, küte korras\.$/);
  // Optimistic concurrency: the receiver's own concurrent edit still wins.
  assert.equal(workflow.calls[0].patch.expectedUpdatedAt.getTime(), NOW.getTime());
});

test("a repeated pre-inquiry handover with the same action key returns the same append", async () => {
  const db = createFieldDb({
    visits: [makeVisit({ preInquiryId: "inq-1" })],
    preInquiries: [inquiry({ receiverNote: "Algne plaan." })]
  });
  const workflow = recordingWorkflow();
  // The workflow is the writer, so mirror its effect back into the fake row.
  const applying = async (userId, inquiryId, patch) => {
    const result = await workflow(userId, inquiryId, patch);
    db.store.preInquiries[0].receiverNote = patch.receiverNote;
    return result;
  };

  await handoverFieldVisit(
    "user-1",
    "visit-1",
    handoverInput({ toPreInquiry: true, preInquiryNote: "Esimene üleandmine." }, "field-action-retry-0001"),
    { db, now: NOW, workflow: applying }
  );
  await handoverFieldVisit(
    "user-1",
    "visit-1",
    handoverInput({ toPreInquiry: true, preInquiryNote: "Esimene üleandmine." }, "field-action-retry-0001"),
    { db, now: NOW, workflow: applying }
  );

  const final = db.store.preInquiries[0].receiverNote;
  assert.match(final, /Algne plaan\./);
  assert.match(final, /Esimene üleandmine\./);
  assert.equal((final.match(/Esimene üleandmine\./g) || []).length, 1);
  assert.equal(workflow.calls.length, 1);
});

test("a lost pre-inquiry right explains itself with 404 and leaves the visit intact", async () => {
  const db = createFieldDb({
    visits: [makeVisit({ preInquiryId: "inq-1" })],
    // The inquiry was recalled (or reassigned) between preparation and handover.
    preInquiries: [inquiry({ recalledAt: NOW })]
  });
  const workflow = recordingWorkflow();

  const result = await handoverFieldVisit(
    "user-1",
    "visit-1",
    handoverInput({ toPreInquiry: true, preInquiryNote: "Külastus tehtud." }),
    { db, now: NOW, workflow }
  );

  assert.equal(result.handover.targets.preInquiry.status, "FAILED");
  assert.equal(result.handover.targets.preInquiry.httpStatus, 404);
  assert.equal(result.handover.targets.preInquiry.errorCode, "api.common.not_found");
  assert.equal(workflow.calls.length, 0);
  // The field work itself survives — nothing is discarded because a downstream
  // carrier disappeared.
  assert.equal(db.store.visits[0].handoverPreInquiryAt, null);
  assert.equal(db.store.visits[0].status, "IN_PROGRESS");
});

test("a visit with no linked pre-inquiry refuses that target instead of inventing one", async () => {
  const db = createFieldDb({ visits: [makeVisit()] });

  const result = await handoverFieldVisit(
    "user-1",
    "visit-1",
    handoverInput({ toPreInquiry: true, preInquiryNote: "Tekst." }),
    { db, now: NOW }
  );

  assert.equal(result.handover.targets.preInquiry.status, "FAILED");
  assert.equal(result.handover.targets.preInquiry.httpStatus, 409);
  assert.equal(result.handover.targets.preInquiry.errorCode, "field.errors.no_pre_inquiry");
});

test("handover requires a target and refuses a cancelled visit", async () => {
  const db = createFieldDb({ visits: [makeVisit()] });
  const noTarget = await status(handoverFieldVisit("user-1", "visit-1", handoverInput({}), { db, now: NOW }));
  assert.equal(noTarget.status, 400);
  assert.equal(noTarget.message, "field.errors.no_handover_target");

  const cancelledDb = createFieldDb({ visits: [makeVisit({ status: "CANCELLED", cancelledAt: NOW })] });
  const cancelled = await status(
    handoverFieldVisit("user-1", "visit-1", handoverInput({ toArtifact: true }), { db: cancelledDb, now: NOW })
  );
  assert.equal(cancelled.status, 409);
  assert.equal(cancelled.message, "field.errors.visit_read_only");
  assert.equal(cancelledDb.store.artifacts.length, 0);
});

test("a foreign owner cannot hand over someone else's visit", async () => {
  const db = createFieldDb({ visits: [makeVisit()], notes: [note()] });

  const failure = await status(handoverFieldVisit("user-2", "visit-1", handoverInput({ toArtifact: true }), { db, now: NOW }));

  assert.equal(failure.status, 404);
  assert.equal(db.store.artifacts.length, 0);
});

test("a failed artifact write leaves no handover stamp behind", async () => {
  const db = createFieldDb({ visits: [makeVisit()], notes: [note()] });
  db.agentArtifact.create = async () => {
    throw new Error("write_failed");
  };

  await handoverFieldVisit("user-1", "visit-1", handoverInput({ toArtifact: true }), { db, now: NOW });

  assert.equal(db.store.visits[0].handoverArtifactAt, null);
  assert.equal(db.store.handovers[0].targetStates.artifact.status, "FAILED");
});

test("same handover key with different canonical content is rejected", async () => {
  const db = createFieldDb({ visits: [makeVisit()], notes: [note()] });
  await handoverFieldVisit("user-1", "visit-1", handoverInput({ toArtifact: true }, "field-action-conflict-1"), { db, now: NOW });
  await assert.rejects(
    handoverFieldVisit(
      "user-1",
      "visit-1",
      handoverInput({ toArtifact: true, artifactTitle: "Teine" }, "field-action-conflict-1"),
      { db, now: NOW }
    ),
    (error) => error.status === 409 && error.message === "field.errors.handover_idempotency_conflict"
  );
  assert.equal(db.store.artifacts.length, 1);
});
