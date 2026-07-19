import test from "node:test";
import assert from "node:assert/strict";
import { setupBase, sv, os1, os2, makeActiveProcess } from "./scenario.js";
import { getProcessDetail } from "../../lib/supervision/service.js";
import { planMeeting, updateMeeting } from "../../lib/supervision/meetings.js";
import { createSummary, submitSummary, approveSummary } from "../../lib/supervision/summaries.js";
import { createPrivateItem } from "../../lib/supervision/privateItems.js";
import { shareTopic } from "../../lib/supervision/topics.js";
import { closeProcess, closePreview } from "../../lib/supervision/closure.js";
import { listOutcomes, getOutcome } from "../../lib/supervision/outcomes.js";

/**
 * Ehitab rikkaliku ACTIVE grupiprotsessi sulgemistestideks: 2 teemat (PROCESS +
 * SUPERVISOR_ONLY), 1 M6 privaatkirje, 1 HELD-kohtumine märkme+agendaga, 1
 * APPROVED FINAL-kokkuvõte, 1 DRAFT MEETING-kokkuvõte.
 */
async function buildRichProcess(db) {
  const { processId } = await makeActiveProcess(db, { invite: ["os1", "os2"], accept: ["os1", "os2"] });
  await shareTopic({ processId, session: os1(), input: { audience: "PROCESS", title: "Avatud", body: "b1" } }, { db });
  await shareTopic({ processId, session: os2(), input: { audience: "SUPERVISOR_ONLY", title: "Priv", body: "b2" } }, { db });
  const item = await createPrivateItem({ processId, session: os1(), input: { kind: "PRIVATE_NOTE", body: "eeskamber jääb" } }, { db });

  const meeting = await planMeeting({ processId, session: sv(), input: {} }, { db });
  await updateMeeting(
    { meetingId: meeting.meeting.id, session: sv(), input: { status: "HELD", note: "kohtumise märge", agendaTopicIds: ["a1"], expectedVersion: 0 } },
    { db }
  );

  const finalSum = await createSummary({ processId, session: sv(), input: { kind: "FINAL", body: "Kinnitatud kokkuvõte" } }, { db });
  await submitSummary({ summaryId: finalSum.summary.id, session: sv(), input: { expectedVersion: finalSum.summary.version } }, { db });
  await approveSummary({ summaryId: finalSum.summary.id, session: os1() }, { db });
  await approveSummary({ summaryId: finalSum.summary.id, session: os2() }, { db });

  const draftSum = await createSummary(
    { processId, session: sv(), input: { kind: "MEETING", meetingId: meeting.meeting.id, body: "mustand" } }, { db }
  );

  return { processId, itemId: item.item.id, meetingId: meeting.meeting.id, finalSummaryId: finalSum.summary.id, draftSummaryId: draftSum.summary.id };
}

test("test #13: sulgemine ühes tehingus — APPROVED jääb, M7 kustub, M8.note NULL, DRAFT kustub, M12 loodud, M2 üldistatud", async () => {
  const db = setupBase();
  const { processId, itemId, meetingId, finalSummaryId, draftSummaryId } = await buildRichProcess(db);
  const before = await getProcessDetail({ processId, session: sv() }, { db });

  const closed = await closeProcess(
    { processId, session: sv(), input: { expectedVersion: before.version, generalizedTitle: "Grupisupervisioon, suvi 2026" } },
    { db }
  );

  // Protsess: CLOSED, üldistatud pealkiri, goal NULL
  assert.equal(closed.status, "CLOSED");
  assert.equal(closed.title, "Grupisupervisioon, suvi 2026");
  assert.equal(closed.goal, null);

  // M7 toorsisu KUSTUS täielikult
  assert.equal(db.store.supervisionSharedTopic.length, 0);
  // M8.note NULL, agenda [], topicCountAtClose salvestatud; fakt (HELD, seq) jääb
  const meetingRow = db.store.supervisionMeeting.find((m) => m.id === meetingId);
  assert.equal(meetingRow.note, null);
  assert.deepEqual(meetingRow.agendaTopicIds, []);
  assert.equal(meetingRow.topicCountAtClose, 1);
  assert.equal(meetingRow.status, "HELD");
  // DRAFT kokkuvõte KUSTUS; APPROVED jääb muutumatuna
  assert.equal(db.store.supervisionSummary.find((s) => s.id === draftSummaryId), undefined);
  const approvedRow = db.store.supervisionSummary.find((s) => s.id === finalSummaryId);
  assert.equal(approvedRow.status, "APPROVED");
  assert.equal(approvedRow.body, "Kinnitatud kokkuvõte");
  // M6 eeskamber JÄÄB puutumata
  assert.ok(db.store.supervisionPrivateItem.find((i) => i.id === itemId));

  // M12 pakid: SV + os1 + os2 = 3
  assert.equal(db.store.supervisionPersonalOutcome.length, 3);
  // Closure faktid + purgeReport
  const closureRow = db.store.supervisionClosure.find((c) => c.processId === processId);
  assert.equal(closureRow.retentionStatus, "AWAITING_POLICY");
  assert.deepEqual(closureRow.purgeReport, { sharedTopics: 2, draftSummaries: 1, meetingNotes: 1 });
  assert.equal(closureRow.factsJson.approvedSummaryCount, 1);
  assert.equal(closureRow.factsJson.meetingsHeld, 1);
  assert.equal(closureRow.factsJson.participantCount, 2);
});

test("test #13 rollback: M12 unique-konflikt keset tehingu tagasi — purge'i EI toimunud, protsess ACTIVE", async () => {
  const db = setupBase();
  const { processId, draftSummaryId } = await buildRichProcess(db);
  const before = await getProcessDetail({ processId, session: sv() }, { db });

  // Sea M12 pakk ette (processId, sv1) → sulgemise samm 4 create → P2002 → rollback
  db.store.supervisionPersonalOutcome.push({ id: "pre-pack", ownerUserId: "sv1", processId, processTitleGeneralized: "X", contentJson: {}, createdAt: new Date() });

  await assert.rejects(
    () => closeProcess({ processId, session: sv(), input: { expectedVersion: before.version, generalizedTitle: "X" } }, { db }),
    (e) => Boolean(e)
  );

  // Täisrollback: toorsisu alles, protsess ACTIVE, closure't pole, DRAFT tagasi
  assert.equal(db.store.supervisionSharedTopic.length, 2);
  assert.ok(db.store.supervisionSummary.find((s) => s.id === draftSummaryId));
  const proc = db.store.supervisionProcess.find((p) => p.id === processId);
  assert.equal(proc.status, "ACTIVE");
  assert.equal(db.store.supervisionClosure.length, 0);
  // Ainult eelseatud pakk, mitte uued
  assert.equal(db.store.supervisionPersonalOutcome.length, 1);
  const meetingRow = db.store.supervisionMeeting.find((m) => m.processId === processId);
  assert.equal(meetingRow.note, "kohtumise märge");
});

test("test #14: sulgemise kordus → 409 + sama closure; teist M12 pakki ei teki", async () => {
  const db = setupBase();
  const { processId } = await buildRichProcess(db);
  const before = await getProcessDetail({ processId, session: sv() }, { db });
  await closeProcess({ processId, session: sv(), input: { expectedVersion: before.version, generalizedTitle: "T" } }, { db });
  assert.equal(db.store.supervisionPersonalOutcome.length, 3);

  const after = await getProcessDetail({ processId, session: sv() }, { db });
  await assert.rejects(
    () => closeProcess({ processId, session: sv(), input: { expectedVersion: after.version, generalizedTitle: "T2" } }, { db }),
    (e) => e.status === 409 && e.message === "supervision.errors.already_closed"
  );
  assert.equal(db.store.supervisionPersonalOutcome.length, 3);
  assert.equal(db.store.supervisionClosure.length, 1);
});

test("PENDING-kokkuvõttega sulgemine → 409 pending_summaries; midagi ei kustu", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db);
  const sum = await createSummary({ processId, session: sv(), input: { kind: "FINAL", body: "K" } }, { db });
  await submitSummary({ summaryId: sum.summary.id, session: sv(), input: { expectedVersion: sum.summary.version } }, { db });
  // os1 shares a topic so there's raw content to check
  await shareTopic({ processId, session: os1(), input: { audience: "PROCESS", title: "t", body: "b" } }, { db });
  const before = await getProcessDetail({ processId, session: sv() }, { db });
  await assert.rejects(
    () => closeProcess({ processId, session: sv(), input: { expectedVersion: before.version, generalizedTitle: "X" } }, { db }),
    (e) => e.status === 409 && e.message === "supervision.errors.pending_summaries"
  );
  assert.equal(db.store.supervisionSharedTopic.length, 1);
  assert.equal(db.store.supervisionClosure.length, 0);
});

test("stale expectedVersion sulgemisel → 409, midagi ei kustu", async () => {
  const db = setupBase();
  const { processId } = await buildRichProcess(db);
  await assert.rejects(
    () => closeProcess({ processId, session: sv(), input: { expectedVersion: 999, generalizedTitle: "X" } }, { db }),
    (e) => e.status === 409 && e.message === "supervision.errors.stale_version"
  );
  assert.equal(db.store.supervisionSharedTopic.length, 2);
  assert.equal(db.store.supervisionClosure.length, 0);
});

test("close-preview näitab õigeid kustub/jääb arve; M12 pakk owner-only (võõras → 404)", async () => {
  const db = setupBase();
  const { processId } = await buildRichProcess(db);
  const preview = await closePreview({ processId, session: sv() }, { db });
  assert.equal(preview.preview.canClose, true);
  assert.equal(preview.preview.willDelete.sharedTopics, 2);
  assert.equal(preview.preview.willDelete.draftSummaries, 1);
  assert.equal(preview.preview.willDelete.meetingNotes, 1);
  assert.equal(preview.preview.willKeep.approvedSummaries, 1);

  const before = await getProcessDetail({ processId, session: sv() }, { db });
  await closeProcess({ processId, session: sv(), input: { expectedVersion: before.version, generalizedTitle: "T" } }, { db });

  // Igaüks näeb OMA pakki; teise oma → 404
  const os1Outcomes = await listOutcomes({ session: os1() }, { db });
  const os2Outcomes = await listOutcomes({ session: os2() }, { db });
  assert.equal(os1Outcomes.outcomes.length, 1);
  assert.equal(os2Outcomes.outcomes.length, 1);
  assert.ok(os1Outcomes.outcomes[0].content.approvedSummaries.length === 1);

  const os2OutcomeId = os2Outcomes.outcomes[0].id;
  await assert.rejects(() => getOutcome({ outcomeId: os2OutcomeId, session: os1() }, { db }), (e) => e.status === 404);
});
