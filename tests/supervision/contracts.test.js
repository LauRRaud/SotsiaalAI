import test from "node:test";
import assert from "node:assert/strict";
import { setupBase, sv, os1, makeActiveProcess } from "./scenario.js";
import {
  createContractVersion,
  activateContractVersion,
  acceptContractVersion,
  getProcessDetail
} from "../../lib/supervision/service.js";

test("test #9: uue kontraktiversiooni aktiveerimine muudab OS → OS†; taaskinnitus taastab OS", async () => {
  const db = setupBase();
  const { processId, contractVersionId } = await makeActiveProcess(db);

  // OS näeb kehtivat kinnitust
  let osView = await getProcessDetail({ processId, session: os1() }, { db });
  assert.equal(osView.viewerRole, "OS");
  assert.equal(osView.myParticipation.hasAcceptedActiveContract, true);
  assert.equal(osView.capabilities.canShareTopic, true);

  // SV loob ja aktiveerib uue versiooni
  const svView = await getProcessDetail({ processId, session: sv() }, { db });
  const cv2 = await createContractVersion({ processId, session: sv(), input: { body: "Kontrakt v2" } }, { db });
  await activateContractVersion(
    { processId, versionId: cv2.contractVersion.id, session: sv(), input: { expectedVersion: svView.version } },
    { db }
  );

  // Vana kinnitus ei loe enam → OS†
  osView = await getProcessDetail({ processId, session: os1() }, { db });
  assert.equal(osView.viewerRole, "OS_STALE");
  assert.equal(osView.myParticipation.hasAcceptedActiveContract, false);
  assert.equal(osView.capabilities.canShareTopic, false);
  assert.equal(osView.capabilities.canApproveSummary, false);

  // Vana versiooni ei tohi enam kinnitada (aegunud → 409)
  await assert.rejects(
    () => acceptContractVersion({ processId, session: os1(), input: { contractVersionId } }, { db }),
    (e) => e.status === 409
  );

  // Uue versiooni kinnitus taastab OS
  await acceptContractVersion({ processId, session: os1(), input: { contractVersionId: cv2.contractVersion.id } }, { db });
  osView = await getProcessDetail({ processId, session: os1() }, { db });
  assert.equal(osView.viewerRole, "OS");
  assert.equal(osView.myParticipation.hasAcceptedActiveContract, true);
});

test("aktiveerimine supersede'ib eelmise aktiivse versiooni ja on idempotentne", async () => {
  const db = setupBase();
  const { processId, contractVersionId } = await makeActiveProcess(db);
  const svView = await getProcessDetail({ processId, session: sv() }, { db });

  const cv2 = await createContractVersion({ processId, session: sv(), input: { body: "v2" } }, { db });
  await activateContractVersion(
    { processId, versionId: cv2.contractVersion.id, session: sv(), input: { expectedVersion: svView.version } },
    { db }
  );

  const v1 = db.store.supervisionContractVersion.find((v) => v.id === contractVersionId);
  const v2 = db.store.supervisionContractVersion.find((v) => v.id === cv2.contractVersion.id);
  assert.equal(v1.status, "SUPERSEDED");
  assert.equal(v2.status, "ACTIVE");

  // Idempotentne: sama versiooni uuesti aktiveerimine ei viska CAS-viga
  const after = await getProcessDetail({ processId, session: sv() }, { db });
  const repeat = await activateContractVersion(
    { processId, versionId: cv2.contractVersion.id, session: sv(), input: { expectedVersion: after.version } },
    { db }
  );
  assert.equal(repeat.activeContract.id, cv2.contractVersion.id);
});

test("kontraktiversiooni loob ainult SV (OS → 404)", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db);
  await assert.rejects(
    () => createContractVersion({ processId, session: os1(), input: { body: "häkk" } }, { db }),
    (e) => e.status === 404
  );
});
