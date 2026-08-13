import test from "node:test";
import assert from "node:assert/strict";
import { setupBase, sv, os1, os2, makeActiveProcess } from "./scenario.js";
import * as supervisionService from "../../lib/supervision/service.js";
import { shareTopic } from "../../lib/supervision/topics.js";
import { createSummary, submitSummary } from "../../lib/supervision/summaries.js";
import { closeProcess } from "../../lib/supervision/closure.js";

const leaveProcess = supervisionService.leaveProcess;

test("osaleja lahkub atomaarse LEFT-oleku, auditi ja liikmeteavitustega", async () => {
  const db = setupBase();
  const { processId, participationIds } = await makeActiveProcess(db, {
    invite: ["os1", "os2"],
    accept: ["os1", "os2"]
  });
  await shareTopic({ processId, session: os2(), input: { audience: "PROCESS", title: "enne", body: "nähtav" } }, { db });

  const result = await leaveProcess({ participationId: participationIds.os1, session: os1() }, { db });
  assert.equal(result.participation.status, "LEFT");
  assert.ok(result.participation.leftAt);
  assert.equal(db.store.supervisionAuditEvent.filter((row) => row.action === "PARTICIPANT_LEFT").length, 1);

  const notifications = db.store.notificationEvent.filter((row) => row.type === "SUPERVISION_PARTICIPANT_LEFT");
  assert.deepEqual(notifications.map((row) => row.userId).sort(), ["os2", "sv1"]);

  const afterTopic = await shareTopic(
    { processId, session: os2(), input: { audience: "PROCESS", title: "pärast", body: "peidetud" } },
    { db }
  );
  db.store.supervisionSharedTopic.find((row) => row.id === afterTopic.topic.id).createdAt =
    new Date(new Date(result.participation.leftAt).getTime() + 1);
  const leftView = await supervisionService.getProcessDetail({ processId, session: os1() }, { db });
  assert.equal(leftView.viewerRole, "LAHK");
  assert.equal(leftView.capabilities.canLeave, false);
  assert.deepEqual(leftView.topics.map((row) => row.title), ["enne"]);
});

test("viimase osaleja lahkumine ei jäta pooleliolevat kokkuvõtet sulgemist blokeerima", async () => {
  const db = setupBase();
  const { processId, participationIds } = await makeActiveProcess(db);
  const created = await createSummary(
    { processId, session: sv(), input: { kind: "FINAL", body: "lõpp" } },
    { db }
  );
  await submitSummary(
    { summaryId: created.summary.id, session: sv(), input: { expectedVersion: created.summary.version } },
    { db }
  );

  await leaveProcess({ participationId: participationIds.os1, session: os1() }, { db });
  const summary = db.store.supervisionSummary.find((row) => row.id === created.summary.id);
  assert.equal(summary.status, "APPROVED");
  assert.ok(summary.approvedAt);
});

test("võõras ei saa teist osalejat lahkuma sundida ning CLOSED protsess ei muutu", async () => {
  const db = setupBase();
  const { processId, participationIds } = await makeActiveProcess(db, {
    invite: ["os1", "os2"],
    accept: ["os1", "os2"]
  });
  await assert.rejects(
    () => leaveProcess({ participationId: participationIds.os1, session: os2() }, { db }),
    (error) => error.status === 404
  );

  const beforeClose = await supervisionService.getProcessDetail({ processId, session: sv() }, { db });
  await closeProcess(
    { processId, session: sv(), input: { expectedVersion: beforeClose.version, generalizedTitle: "Suletud" } },
    { db }
  );
  const auditsBefore = db.store.supervisionAuditEvent.length;
  await assert.rejects(
    () => leaveProcess({ participationId: participationIds.os1, session: os1() }, { db }),
    (error) => error.status === 409 && error.code === "ALREADY_CLOSED"
  );
  assert.equal(db.store.supervisionParticipation.find((row) => row.id === participationIds.os1).status, "ACCEPTED");
  assert.equal(db.store.supervisionAuditEvent.length, auditsBefore);
});
