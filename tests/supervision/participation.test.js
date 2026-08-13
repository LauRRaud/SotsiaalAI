import test from "node:test";
import assert from "node:assert/strict";
import { setupBase, sv, os1, os2, makeActiveProcess } from "./scenario.js";
import { issueGrant } from "../../lib/supervision/grants.js";
import {
  createProcess,
  createContractVersion,
  activateContractVersion,
  inviteParticipant,
  withdrawInvite,
  respondToInvite,
  acceptContractVersion,
  getProcessDetail
} from "../../lib/supervision/service.js";
import { closeProcess } from "../../lib/supervision/closure.js";

async function draftWithContract(db) {
  await issueGrant({ actorUserId: "admin1", userId: "sv1", grantBasis: "x" }, { db });
  const process = await createProcess({ session: sv(), input: { type: "GROUP", title: "P" } }, { db });
  const cv = await createContractVersion({ processId: process.id, session: sv(), input: { body: "C1" } }, { db });
  await activateContractVersion(
    { processId: process.id, versionId: cv.contractVersion.id, session: sv(), input: { expectedVersion: process.version } },
    { db }
  );
  return { processId: process.id, contractVersionId: cv.contractVersion.id };
}

test("test #3: kutse CLIENT-ile → 422 role_not_allowed; enda kutsumine → 422", async () => {
  const db = setupBase();
  const { processId } = await draftWithContract(db);
  await assert.rejects(
    () => inviteParticipant({ processId, session: sv(), input: { userId: "client1" } }, { db }),
    (e) => e.status === 422 && e.message === "supervision.errors.role_not_allowed"
  );
  await assert.rejects(
    () => inviteParticipant({ processId, session: sv(), input: { userId: "sv1" } }, { db }),
    (e) => e.status === 422
  );
  assert.equal(db.store.supervisionParticipation.length, 0);
});

test("tundmatu kasutaja kutse → 400; duplikaatkutse → 409", async () => {
  const db = setupBase();
  const { processId } = await draftWithContract(db);
  await assert.rejects(
    () => inviteParticipant({ processId, session: sv(), input: { userId: "ghost" } }, { db }),
    (e) => e.status === 400
  );
  await inviteParticipant({ processId, session: sv(), input: { userId: "os1" } }, { db });
  await assert.rejects(
    () => inviteParticipant({ processId, session: sv(), input: { userId: "os1" } }, { db }),
    (e) => e.status === 409
  );
  assert.equal(db.store.supervisionParticipation.length, 1);
});

test("accept nõuab AKTIIVSET kontraktiversiooni; vale/aegunud versioon → 409", async () => {
  const db = setupBase();
  const { processId, contractVersionId } = await draftWithContract(db);
  const detail = await inviteParticipant({ processId, session: sv(), input: { userId: "os1" } }, { db });
  const pid = detail.participants.find((p) => p.userId === "os1").id;
  await assert.rejects(
    () => respondToInvite({ participationId: pid, session: os1(), input: { action: "accept", contractVersionId: "vale" } }, { db }),
    (e) => e.status === 409
  );
  const ok = await respondToInvite(
    { participationId: pid, session: os1(), input: { action: "accept", contractVersionId } },
    { db }
  );
  assert.equal(ok.participation.status, "ACCEPTED");
  // Esimene accept viib protsessi DRAFT → ACTIVE.
  const after = await getProcessDetail({ processId, session: sv() }, { db });
  assert.equal(after.status, "ACTIVE");
});

test("test #11: topeltklikk accept ei loo teist acceptance't ega teist auditit", async () => {
  const db = setupBase();
  const { processId, contractVersionId } = await draftWithContract(db);
  const detail = await inviteParticipant({ processId, session: sv(), input: { userId: "os1" } }, { db });
  const pid = detail.participants.find((p) => p.userId === "os1").id;
  await respondToInvite({ participationId: pid, session: os1(), input: { action: "accept", contractVersionId } }, { db });
  await respondToInvite({ participationId: pid, session: os1(), input: { action: "accept", contractVersionId } }, { db });
  assert.equal(db.store.supervisionContractAcceptance.length, 1);
  assert.equal(db.store.supervisionAuditEvent.filter((a) => a.action === "CONTRACT_ACCEPTED").length, 1);
});

test("keeldumine töötab ja on idempotentne; ainult kutsutu ise saab vastata (võõras → 404)", async () => {
  const db = setupBase();
  const { processId, contractVersionId } = await draftWithContract(db);
  const detail = await inviteParticipant({ processId, session: sv(), input: { userId: "os1" } }, { db });
  const pid = detail.participants.find((p) => p.userId === "os1").id;
  // võõras (os2) ei saa os1 kutsele vastata
  await assert.rejects(
    () => respondToInvite({ participationId: pid, session: os2(), input: { action: "accept", contractVersionId } }, { db }),
    (e) => e.status === 404
  );
  const declined = await respondToInvite({ participationId: pid, session: os1(), input: { action: "decline" } }, { db });
  assert.equal(declined.participation.status, "DECLINED");
  const again = await respondToInvite({ participationId: pid, session: os1(), input: { action: "decline" } }, { db });
  assert.equal(again.participation.status, "DECLINED");
});

test("kutse tagasivõtt: SV võtab INVITED tagasi (WITHDRAWN, idempotentne); ACCEPTED ei saa tagasi võtta", async () => {
  const db = setupBase();
  const { processId, contractVersionId } = await draftWithContract(db);
  const detail = await inviteParticipant({ processId, session: sv(), input: { userId: "os1" } }, { db });
  const pid = detail.participants.find((p) => p.userId === "os1").id;
  const w = await withdrawInvite({ participationId: pid, session: sv() }, { db });
  assert.equal(w.participation.status, "WITHDRAWN");
  const w2 = await withdrawInvite({ participationId: pid, session: sv() }, { db });
  assert.equal(w2.participation.status, "WITHDRAWN");
  // Pärast tagasivõttu kutsutu ei näe enam protsessi (→ 404).
  await assert.rejects(
    () => getProcessDetail({ processId, session: os1() }, { db }),
    (e) => e.status === 404
  );

  // ACCEPTED osalust ei saa "kutsena" tagasi võtta
  const d2 = await inviteParticipant({ processId, session: sv(), input: { userId: "os2" } }, { db });
  const pid2 = d2.participants.find((p) => p.userId === "os2").id;
  await respondToInvite({ participationId: pid2, session: os2(), input: { action: "accept", contractVersionId } }, { db });
  await assert.rejects(
    () => withdrawInvite({ participationId: pid2, session: sv() }, { db }),
    (e) => e.status === 409
  );
});

test("kutsutu (KUT) ligipääsuenne accept'i: piiratud kaart, ilma osalejate/teemadeta", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db, { invite: ["os1", "os2"], accept: ["os1"] });
  // os2 on KUT (kutsutud, vastamata)
  const card = await getProcessDetail({ processId, session: os2() }, { db });
  assert.equal(card.viewerRole, "KUT");
  assert.equal(card.myParticipation.status, "INVITED");
  assert.ok(card.activeContract && typeof card.activeContract.body === "string");
  assert.equal(card.participants, undefined);
  assert.equal(card.topics, undefined);
  assert.equal(card.meetings, undefined);
  assert.equal(card.summaries, undefined);
});

test("CLOSED protsessis ei saa kutsele vastata ega kontrakti uuesti kinnitada", async () => {
  const db = setupBase();
  const { processId, contractVersionId, participationIds } = await makeActiveProcess(db, {
    invite: ["os1", "os2"],
    accept: ["os1"]
  });
  const beforeClose = await getProcessDetail({ processId, session: sv() }, { db });
  await closeProcess(
    { processId, session: sv(), input: { expectedVersion: beforeClose.version, generalizedTitle: "Suletud" } },
    { db }
  );
  const auditsBefore = db.store.supervisionAuditEvent.length;
  const acceptancesBefore = db.store.supervisionContractAcceptance.length;

  await assert.rejects(
    () => respondToInvite({
      participationId: participationIds.os2,
      session: os2(),
      input: { action: "accept", contractVersionId }
    }, { db }),
    (error) => error.status === 409 && error.code === "ALREADY_CLOSED"
  );
  await assert.rejects(
    () => acceptContractVersion({ processId, session: os1(), input: { contractVersionId } }, { db }),
    (error) => error.status === 409 && error.code === "ALREADY_CLOSED"
  );

  assert.equal(db.store.supervisionParticipation.find((row) => row.id === participationIds.os2).status, "INVITED");
  assert.equal(db.store.supervisionContractAcceptance.length, acceptancesBefore);
  assert.equal(db.store.supervisionAuditEvent.length, auditsBefore);
});
