import test from "node:test";
import assert from "node:assert/strict";
import { memberSession, adminSession } from "./harness.js";
import { setupBase, sv, os1, makeActiveProcess } from "./scenario.js";
import { issueGrant } from "../../lib/supervision/grants.js";
import {
  createProcess,
  getProcessDetail,
  listMyProcesses,
  updateProcess
} from "../../lib/supervision/service.js";

test("protsessi loomine nõuab aktiivset granti (grandita → 403 GRANT_REQUIRED)", async () => {
  const db = setupBase();
  await assert.rejects(
    () => createProcess({ session: sv(), input: { type: "GROUP", title: "P" } }, { db }),
    (e) => e.status === 403 && e.message === "supervision.errors.grant_required"
  );
  assert.equal(db.store.supervisionProcess.length, 0);
});

test("grandiga SV loob DRAFT-protsessi + PROCESS_CREATED audit; loend näitab kaarti", async () => {
  const db = setupBase();
  await issueGrant({ actorUserId: "admin1", userId: "sv1", grantBasis: "x" }, { db });
  const process = await createProcess(
    { session: sv(), input: { type: "INDIVIDUAL", title: "Minu protsess", goal: "eesmärk" } },
    { db }
  );
  assert.equal(process.viewerRole, "SV");
  assert.equal(process.status, "DRAFT");
  assert.equal(process.title, "Minu protsess");
  assert.equal(process.version, 0);
  const audits = db.store.supervisionAuditEvent.filter((a) => a.action === "PROCESS_CREATED");
  assert.equal(audits.length, 1);
  assert.equal(audits[0].processId, process.id);

  const list = await listMyProcesses({ session: sv() }, { db });
  assert.equal(list.processes.length, 1);
  assert.equal(list.processes[0].viewerRole, "SV");
});

test("vale tüüp → 400; tühi pealkiri → 400", async () => {
  const db = setupBase();
  await issueGrant({ actorUserId: "admin1", userId: "sv1", grantBasis: "x" }, { db });
  await assert.rejects(
    () => createProcess({ session: sv(), input: { type: "SOLO", title: "P" } }, { db }),
    (e) => e.status === 400
  );
  await assert.rejects(
    () => createProcess({ session: sv(), input: { type: "GROUP", title: "   " } }, { db }),
    (e) => e.status === 400
  );
});

test("tundmatu kehaväli → 400 UNKNOWN_FIELD", async () => {
  const db = setupBase();
  await issueGrant({ actorUserId: "admin1", userId: "sv1", grantBasis: "x" }, { db });
  await assert.rejects(
    () => createProcess({ session: sv(), input: { type: "GROUP", title: "P", evil: 1 } }, { db }),
    (e) => e.status === 400 && e.code === "UNKNOWN_FIELD"
  );
});

test("loend/loomine on SW/SP värav: CLIENT ja ADMIN → 403", async () => {
  const db = setupBase();
  await assert.rejects(
    () => listMyProcesses({ session: memberSession("client1", "CLIENT") }, { db }),
    (e) => e.status === 403
  );
  await assert.rejects(
    () => createProcess({ session: adminSession("admin1"), input: { type: "GROUP", title: "P" } }, { db }),
    (e) => e.status === 403
  );
});

test("test #5: võõra ID ja olematu ID → baiditi sama 404 (getProcessDetail)", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db);
  let missingErr;
  let foreignErr;
  await getProcessDetail({ processId: "ghost", session: os1() }, { db }).catch((e) => { missingErr = e; });
  await getProcessDetail({ processId, session: memberSession("outsider", "SOCIAL_WORKER") }, { db })
    .catch((e) => { foreignErr = e; });
  assert.equal(missingErr.status, 404);
  assert.equal(foreignErr.status, 404);
  assert.equal(missingErr.message, foreignErr.message);
  assert.equal(missingErr.code, foreignErr.code);
});

test("CLIENT päring protsessile → 404 (mitte 403)", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db);
  await assert.rejects(
    () => getProcessDetail({ processId, session: memberSession("client1", "CLIENT") }, { db }),
    (e) => e.status === 404
  );
});

test("rollist eemaldatud protsessiliige ei saa vana seosega lugeda ega muuta", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db);

  await assert.rejects(
    () => getProcessDetail({ processId, session: memberSession("os1", "CLIENT") }, { db }),
    (e) => e.status === 404 && e.code === "NOT_FOUND"
  );
  await assert.rejects(
    () => updateProcess({
      processId,
      session: memberSession("sv1", "CLIENT"),
      input: { title: "Lubamatu muudatus", expectedVersion: 1 }
    }, { db }),
    (e) => e.status === 404 && e.code === "NOT_FOUND"
  );
});

test("test #10: stale expectedVersion → 409 JA ühtegi rida ei muudetud", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db);
  const before = await getProcessDetail({ processId, session: sv() }, { db });
  await assert.rejects(
    () => updateProcess(
      { processId, session: sv(), input: { title: "Uus", expectedVersion: before.version + 99 } },
      { db }
    ),
    (e) => e.status === 409 && e.message === "supervision.errors.stale_version"
  );
  const after = await getProcessDetail({ processId, session: sv() }, { db });
  assert.equal(after.title, before.title);
  assert.equal(after.version, before.version);
});

test("õige CAS-iga muutmine tõstab versiooni ja kirjutab PROCESS_UPDATED", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db);
  const before = await getProcessDetail({ processId, session: sv() }, { db });
  const updated = await updateProcess(
    { processId, session: sv(), input: { title: "Uus pealkiri", expectedVersion: before.version } },
    { db }
  );
  assert.equal(updated.title, "Uus pealkiri");
  assert.equal(updated.version, before.version + 1);
  assert.equal(db.store.supervisionAuditEvent.filter((a) => a.action === "PROCESS_UPDATED").length, 1);
});

test("osaleja ei saa protsessi muuta (OS → 404 PATCH-il)", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db);
  const before = await getProcessDetail({ processId, session: sv() }, { db });
  await assert.rejects(
    () => updateProcess(
      { processId, session: os1(), input: { title: "Häkk", expectedVersion: before.version } },
      { db }
    ),
    (e) => e.status === 404
  );
});
