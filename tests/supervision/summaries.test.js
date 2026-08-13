import test from "node:test";
import assert from "node:assert/strict";
import { setupBase, sv, os1, os2, makeActiveProcess } from "./scenario.js";
import { planMeeting } from "../../lib/supervision/meetings.js";
import {
  createContractVersion,
  activateContractVersion,
  getProcessDetail
} from "../../lib/supervision/service.js";
import {
  createSummary,
  discardSummary,
  updateSummary,
  submitSummary,
  approveSummary
} from "../../lib/supervision/summaries.js";
import { closeProcess } from "../../lib/supervision/closure.js";
import { assertNotificationRecipient } from "../../lib/notifications.js";

test("test #12 (grupp): APPROVED alles siis, kui KÕIK ACCEPTED kinnitasid; SUMMARY_APPROVED audit 1x", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db, { invite: ["os1", "os2"], accept: ["os1", "os2"] });
  const created = await createSummary({ processId, session: sv(), input: { kind: "FINAL", body: "Kokkuvõte" } }, { db });
  const sid = created.summary.id;
  assert.equal(created.summary.status, "DRAFT");

  await submitSummary({ summaryId: sid, session: sv(), input: { expectedVersion: created.summary.version } }, { db });

  // os1 kinnitab → veel PENDING (os2 puudu)
  let after = await approveSummary({ summaryId: sid, session: os1() }, { db });
  assert.equal(after.summary.status, "PENDING_APPROVAL");
  // os2 kinnitab → APPROVED
  after = await approveSummary({ summaryId: sid, session: os2() }, { db });
  assert.equal(after.summary.status, "APPROVED");
  assert.ok(after.summary.approvedAt);
  assert.equal(db.store.supervisionAuditEvent.filter((a) => a.action === "SUMMARY_APPROVED").length, 1);
});

test("test #20 (individuaal): 1 osaleja kinnitus viib APPROVED-iks", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db); // ainult os1 accepted
  const created = await createSummary({ processId, session: sv(), input: { kind: "FINAL", body: "K" } }, { db });
  const sid = created.summary.id;
  await submitSummary({ summaryId: sid, session: sv(), input: { expectedVersion: created.summary.version } }, { db });
  const after = await approveSummary({ summaryId: sid, session: os1() }, { db });
  assert.equal(after.summary.status, "APPROVED");
});

test("LEFT ei blokeeri läve; OS† ei saa kinnitada → 409", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db, { invite: ["os1", "os2"], accept: ["os1", "os2"] });
  const created = await createSummary({ processId, session: sv(), input: { kind: "FINAL", body: "K" } }, { db });
  const sid = created.summary.id;
  await submitSummary({ summaryId: sid, session: sv(), input: { expectedVersion: created.summary.version } }, { db });

  // os2 lahkub (LEFT) → ei blokeeri läve
  const os2Part = db.store.supervisionParticipation.find((p) => p.userId === "os2");
  os2Part.status = "LEFT";

  const after = await approveSummary({ summaryId: sid, session: os1() }, { db });
  assert.equal(after.summary.status, "APPROVED"); // ainult os1 loeb läves

  // Uus stend: OS† ei saa kinnitada
  const db2 = setupBase();
  const p2 = await makeActiveProcess(db2);
  const svView = await getProcessDetail({ processId: p2.processId, session: sv() }, { db: db2 });
  const cv2 = await createContractVersion({ processId: p2.processId, session: sv(), input: { body: "v2" } }, { db: db2 });
  await activateContractVersion(
    { processId: p2.processId, versionId: cv2.contractVersion.id, session: sv(), input: { expectedVersion: svView.version } },
    { db: db2 }
  );
  const sum2 = await createSummary({ processId: p2.processId, session: sv(), input: { kind: "FINAL", body: "K" } }, { db: db2 });
  await submitSummary({ summaryId: sum2.summary.id, session: sv(), input: { expectedVersion: sum2.summary.version } }, { db: db2 });
  await assert.rejects(
    () => approveSummary({ summaryId: sum2.summary.id, session: os1() }, { db: db2 }),
    (e) => e.status === 409
  );
});

test("DRAFT ainult SV-le; APPROVED muutumatu; topeltklikk approve ei loo teist kinnitust", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db);
  const created = await createSummary({ processId, session: sv(), input: { kind: "FINAL", body: "K" } }, { db });
  const sid = created.summary.id;

  // DRAFT: SV näeb, OS ei näe
  let svView = await getProcessDetail({ processId, session: sv() }, { db });
  let osView = await getProcessDetail({ processId, session: os1() }, { db });
  assert.equal(svView.summaries.length, 1);
  assert.equal(osView.summaries.length, 0);

  await submitSummary({ summaryId: sid, session: sv(), input: { expectedVersion: created.summary.version } }, { db });
  osView = await getProcessDetail({ processId, session: os1() }, { db });
  assert.equal(osView.summaries.length, 1); // PENDING nähtav

  // topeltklikk approve
  await approveSummary({ summaryId: sid, session: os1() }, { db });
  await approveSummary({ summaryId: sid, session: os1() }, { db });
  assert.equal(db.store.supervisionSummaryApproval.length, 1);

  // APPROVED muutumatu
  await assert.rejects(
    () => updateSummary({ summaryId: sid, session: sv(), input: { body: "muudetud", expectedVersion: 99 } }, { db }),
    (e) => e.status === 409
  );
});

test("meetingId unikaalne (üks kokkuvõte kohtumise kohta → 409); FINAL max 1 → 409; submit idempotentne", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db);
  const m = await planMeeting({ processId, session: sv(), input: {} }, { db });
  await createSummary({ processId, session: sv(), input: { kind: "MEETING", meetingId: m.meeting.id, body: "A" } }, { db });
  await assert.rejects(
    () => createSummary({ processId, session: sv(), input: { kind: "MEETING", meetingId: m.meeting.id, body: "B" } }, { db }),
    (e) => e.status === 409
  );

  const f1 = await createSummary({ processId, session: sv(), input: { kind: "FINAL", body: "F1" } }, { db });
  await assert.rejects(
    () => createSummary({ processId, session: sv(), input: { kind: "FINAL", body: "F2" } }, { db }),
    (e) => e.status === 409
  );

  // submit idempotentne
  await submitSummary({ summaryId: f1.summary.id, session: sv(), input: { expectedVersion: f1.summary.version } }, { db });
  const again = await submitSummary({ summaryId: f1.summary.id, session: sv(), input: { expectedVersion: 999 } }, { db });
  assert.equal(again.summary.status, "PENDING_APPROVAL");
});

test("SUP-08: DISCARDED kokkuvõtte asemele saab luua uue MEETING- ja FINAL-kokkuvõtte", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db);
  const meeting = await planMeeting({ processId, session: sv(), input: {} }, { db });
  const firstMeeting = await createSummary(
    { processId, session: sv(), input: { kind: "MEETING", meetingId: meeting.meeting.id, body: "A" } },
    { db }
  );
  await discardSummary({ summaryId: firstMeeting.summary.id, session: sv() }, { db });
  const replacementMeeting = await createSummary(
    { processId, session: sv(), input: { kind: "MEETING", meetingId: meeting.meeting.id, body: "B" } },
    { db }
  );
  assert.equal(replacementMeeting.summary.body, "B");

  const firstFinal = await createSummary(
    { processId, session: sv(), input: { kind: "FINAL", body: "F1" } },
    { db }
  );
  await discardSummary({ summaryId: firstFinal.summary.id, session: sv() }, { db });
  const replacementFinal = await createSummary(
    { processId, session: sv(), input: { kind: "FINAL", body: "F2" } },
    { db }
  );
  assert.equal(replacementFinal.summary.body, "F2");
});

test("SUP-13: osaliselt kinnitatud PENDING tagasivõtt nullib ringi, lõpetab teavitused ja vabastab sulgemise", async () => {
  const db = setupBase();
  const { processId, participationIds } = await makeActiveProcess(
    db,
    { invite: ["os1", "os2"], accept: ["os1", "os2"] }
  );
  const created = await createSummary(
    { processId, session: sv(), input: { kind: "FINAL", body: "Tagasivõetav" } },
    { db }
  );
  await submitSummary(
    { summaryId: created.summary.id, session: sv(), input: { expectedVersion: created.summary.version } },
    { db }
  );
  await approveSummary({ summaryId: created.summary.id, session: os1() }, { db });
  assert.equal(db.store.supervisionSummaryApproval.length, 1);

  const discarded = await discardSummary({ summaryId: created.summary.id, session: sv() }, { db });
  assert.equal(discarded.summary.status, "DISCARDED");
  assert.deepEqual(discarded.summary.approvals, []);
  assert.equal(db.store.supervisionSummaryApproval.length, 0);
  const pendingEvents = db.store.notificationEvent.filter((event) => (
    event.type === "SUPERVISION_SUMMARY_PENDING" && event.sourceId === created.summary.id
  ));
  assert.equal(pendingEvents.length, 2);
  assert.ok(pendingEvents.every((event) => event.dismissedAt instanceof Date && event.readAt instanceof Date));
  assert.equal(db.store.supervisionAuditEvent.filter((event) => (
    event.action === "SUMMARY_DISCARDED" && event.targetId === created.summary.id
  )).length, 1);
  await assert.rejects(() => assertNotificationRecipient(db, {
    type: "SUPERVISION_SUMMARY_PENDING",
    userId: "os2",
    sourceId: created.summary.id,
    targetId: processId
  }), (error) => error.status === 404);

  const beforeClose = await getProcessDetail({ processId, session: sv() }, { db });
  await closeProcess(
    { processId, session: sv(), input: { expectedVersion: beforeClose.version, generalizedTitle: "Lõpetatud" } },
    { db }
  );
  assert.ok(db.store.supervisionClosure.some((row) => row.processId === processId));
  assert.ok(participationIds.os1 && participationIds.os2);
});
