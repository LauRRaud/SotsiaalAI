import test from "node:test";
import assert from "node:assert/strict";
import { setupBase, makeActiveProcess } from "./scenario.js";
import { tombstoneSupervisionForAccountDeletion } from "../../lib/supervision/accountDeletion.js";

test("SUP-09: superviisori ja osaleja identiteet tombstone'itakse jagatud ridu kustutamata", async () => {
  const db = setupBase();
  const { processId, participationIds } = await makeActiveProcess(db);
  const process = db.store.supervisionProcess.find((row) => row.id === processId);
  db.store.supervisionSharedTopic.push({
    id: "topic-sv",
    processId,
    authorParticipationId: null,
    authorSupervisorUserId: "sv1",
    authorErasedAt: null,
    status: "SHARED"
  });
  db.store.supervisionSharedTopic.push({
    id: "topic-os",
    processId,
    authorParticipationId: participationIds.os1,
    authorSupervisorUserId: null,
    authorErasedAt: null,
    status: "SHARED"
  });
  const erasedAt = new Date("2030-03-01T12:00:00.000Z");

  const supervisorResult = await tombstoneSupervisionForAccountDeletion("sv1", { db, now: erasedAt });
  const participantResult = await tombstoneSupervisionForAccountDeletion("os1", { db, now: erasedAt });

  assert.equal(supervisorResult.supervisedProcessesTombstoned, 1);
  assert.equal(supervisorResult.supervisorTopicsTombstoned, 1);
  assert.equal(participantResult.participationsTombstoned, 1);
  assert.equal(process.supervisorId, null);
  assert.equal(process.supervisorErasedAt.toISOString(), erasedAt.toISOString());
  const participation = db.store.supervisionParticipation.find((row) => row.id === participationIds.os1);
  assert.equal(participation.userId, null);
  assert.equal(participation.userErasedAt.toISOString(), erasedAt.toISOString());
  assert.equal(db.store.supervisionSharedTopic.length, 2);
  assert.equal(db.store.supervisionSharedTopic.find((row) => row.id === "topic-sv").authorSupervisorUserId, null);
  assert.equal(db.store.supervisionSharedTopic.find((row) => row.id === "topic-os").authorParticipationId,
    participationIds.os1);
  assert.ok(db.store.supervisionContractVersion.some((row) => row.processId === processId));
  assert.ok(db.store.supervisionContractAcceptance.some((row) => row.participationId === participationIds.os1));
  assert.ok(db.store.supervisionAuditEvent.some((row) => row.processId === processId));
});
