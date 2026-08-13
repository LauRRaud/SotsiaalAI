import test from "node:test";
import assert from "node:assert/strict";
import { setupBase, sv, os1, os2, makeActiveProcess } from "./scenario.js";
import { closeProcess } from "../../lib/supervision/closure.js";
import {
  activateContractVersion,
  createContractVersion,
  getProcessDetail
} from "../../lib/supervision/service.js";
import { POST as respondPost } from "../../app/api/supervision/participations/[id]/respond/route.js";
import { POST as leavePost } from "../../app/api/supervision/participations/[id]/leave/route.js";
import { POST as acceptContractPost } from "../../app/api/supervision/processes/[id]/contract-acceptance/route.js";
import { POST as shareTopicPost } from "../../app/api/supervision/processes/[id]/topics/route.js";
import { POST as activateContractPost } from "../../app/api/supervision/processes/[id]/contract-versions/[vid]/activate/route.js";

function request(path, body = {}) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

test("HTTP: CLOSED protsessi kutse-, kontrakti- ja teemakirjutused annavad 409", async () => {
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

  const respond = await respondPost(
    request(`/api/supervision/participations/${participationIds.os2}/respond`, {
      action: "accept",
      contractVersionId
    }),
    { params: Promise.resolve({ id: participationIds.os2 }) },
    { db, session: os2() }
  );
  const accept = await acceptContractPost(
    request(`/api/supervision/processes/${processId}/contract-acceptance`, { contractVersionId }),
    { params: Promise.resolve({ id: processId }) },
    { db, session: os1() }
  );
  const topic = await shareTopicPost(
    request(`/api/supervision/processes/${processId}/topics`, {
      audience: "PROCESS",
      title: "pärast",
      body: "ei tohi"
    }),
    { params: Promise.resolve({ id: processId }) },
    { db, session: os1() }
  );

  assert.equal(respond.status, 409);
  assert.equal(accept.status, 409);
  assert.equal(topic.status, 409);
});

test("HTTP: SUPERSEDED versiooni aktiveerimine annab 409", async () => {
  const db = setupBase();
  const { processId, contractVersionId } = await makeActiveProcess(db);
  const before = await getProcessDetail({ processId, session: sv() }, { db });
  const v2 = await createContractVersion({ processId, session: sv(), input: { body: "v2" } }, { db });
  await activateContractVersion(
    { processId, versionId: v2.contractVersion.id, session: sv(), input: { expectedVersion: before.version } },
    { db }
  );
  const current = await getProcessDetail({ processId, session: sv() }, { db });

  const response = await activateContractPost(
    request(`/api/supervision/processes/${processId}/contract-versions/${contractVersionId}/activate`, {
      expectedVersion: current.version
    }),
    { params: Promise.resolve({ id: processId, vid: contractVersionId }) },
    { db, session: sv() }
  );
  assert.equal(response.status, 409);
});

test("HTTP: osaleja saab lahkuda, võõras sama osalust muuta ei saa", async () => {
  const db = setupBase();
  const { participationIds } = await makeActiveProcess(db, {
    invite: ["os1", "os2"],
    accept: ["os1", "os2"]
  });
  const response = await leavePost(
    request(`/api/supervision/participations/${participationIds.os1}/leave`),
    { params: Promise.resolve({ id: participationIds.os1 }) },
    { db, session: os1() }
  );
  const foreign = await leavePost(
    request(`/api/supervision/participations/${participationIds.os1}/leave`),
    { params: Promise.resolve({ id: participationIds.os1 }) },
    { db, session: os2() }
  );
  assert.equal(response.status, 200);
  assert.equal(foreign.status, 404);
});
