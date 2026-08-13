import test from "node:test";
import assert from "node:assert/strict";
import { setupBase, sv, os1, os2, makeActiveProcess } from "./scenario.js";
import {
  createContractVersion,
  activateContractVersion,
  getProcessDetail
} from "../../lib/supervision/service.js";
import { createPrivateItem, updatePrivateItem } from "../../lib/supervision/privateItems.js";
import { shareTopic, withdrawTopic } from "../../lib/supervision/topics.js";
import { closeProcess } from "../../lib/supervision/closure.js";

test("test #8: jagamine on külmutatud koopia (hilisem M6 muudatus ei muuda M7); tundmatu väli → 400", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db);
  const item = await createPrivateItem(
    { processId, session: os1(), input: { kind: "PREP_TOPIC", title: "T1", body: "keha1" } }, { db }
  );
  const shared = await shareTopic(
    { processId, session: os1(), input: { audience: "PROCESS", sourcePrivateItemId: item.item.id } }, { db }
  );
  assert.equal(shared.topic.title, "T1");
  assert.equal(shared.topic.body, "keha1");
  assert.equal(shared.topic.audience, "PROCESS");

  // Allika M6 kirje sai lingi jagatud teemale
  const sourceRow = db.store.supervisionPrivateItem.find((i) => i.id === item.item.id);
  assert.equal(sourceRow.sharedTopicId, shared.topic.id);

  // Hilisem M6 muudatus EI muuda M7-t (külmutatud koopia)
  await updatePrivateItem(
    { itemId: item.item.id, session: os1(), input: { body: "keha2", expectedVersion: item.item.version } }, { db }
  );
  const topicRow = db.store.supervisionSharedTopic.find((t) => t.id === shared.topic.id);
  assert.equal(topicRow.body, "keha1");

  // Sama M6 kirje teistkordne jagamine → 409 ALREADY_SHARED
  await assert.rejects(
    () => shareTopic({ processId, session: os1(), input: { audience: "PROCESS", sourcePrivateItemId: item.item.id } }, { db }),
    (e) => e.status === 409
  );

  // Tundmatu kehaväli → 400
  await assert.rejects(
    () => shareTopic({ processId, session: os1(), input: { audience: "PROCESS", title: "y", body: "x", evil: 1 } }, { db }),
    (e) => e.status === 400
  );
});

test("SUPERVISOR_ONLY teemat näevad ainult autor + SV; teine OS ei näe", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db, { invite: ["os1", "os2"], accept: ["os1", "os2"] });
  await shareTopic({ processId, session: os1(), input: { audience: "SUPERVISOR_ONLY", title: "priv", body: "ainult sv" } }, { db });

  const svView = await getProcessDetail({ processId, session: sv() }, { db });
  const os1View = await getProcessDetail({ processId, session: os1() }, { db });
  const os2View = await getProcessDetail({ processId, session: os2() }, { db });
  assert.equal(svView.topics.length, 1);
  assert.equal(os1View.topics.length, 1);
  assert.equal(os2View.topics.length, 0);
});

test("PROCESS-teemat näevad kõik ACCEPTED liikmed", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db, { invite: ["os1", "os2"], accept: ["os1", "os2"] });
  await shareTopic({ processId, session: os1(), input: { audience: "PROCESS", title: "kõigile", body: "b" } }, { db });
  const os2View = await getProcessDetail({ processId, session: os2() }, { db });
  assert.equal(os2View.topics.length, 1);
  assert.equal(os2View.topics[0].title, "kõigile");
});

test("SUP-03: SV autoreerib ilma võltsosaluseta; OS† ei saa jagada → 409", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db);

  const supervisorTopic = await shareTopic(
    { processId, session: sv(), input: { audience: "PROCESS", title: "SV teema", body: "y" } },
    { db }
  );
  const supervisorRow = db.store.supervisionSharedTopic.find((row) => row.id === supervisorTopic.topic.id);
  assert.equal(supervisorRow.authorParticipationId, null);
  assert.equal(supervisorRow.authorSupervisorUserId, "sv1");
  assert.equal(supervisorTopic.topic.authorType, "SUPERVISOR");
  const withdrawn = await withdrawTopic(
    { topicId: supervisorTopic.topic.id, session: sv(), input: { expectedVersion: supervisorTopic.topic.version } },
    { db }
  );
  assert.equal(withdrawn.topic.status, "WITHDRAWN");

  // Aktiveeri uus versioon → os1 muutub OS†
  const svView = await getProcessDetail({ processId, session: sv() }, { db });
  const cv2 = await createContractVersion({ processId, session: sv(), input: { body: "v2" } }, { db });
  await activateContractVersion(
    { processId, versionId: cv2.contractVersion.id, session: sv(), input: { expectedVersion: svView.version } }, { db }
  );
  await assert.rejects(
    () => shareTopic({ processId, session: os1(), input: { audience: "PROCESS", title: "x", body: "y" } }, { db }),
    (e) => e.status === 409
  );
});

test("CLOSED protsessi ei saa pärast purge'i uue jagatud teemaga täita", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db);
  const beforeClose = await getProcessDetail({ processId, session: sv() }, { db });
  await closeProcess(
    { processId, session: sv(), input: { expectedVersion: beforeClose.version, generalizedTitle: "Suletud" } },
    { db }
  );
  const auditsBefore = db.store.supervisionAuditEvent.length;

  await assert.rejects(
    () => shareTopic({ processId, session: os1(), input: { audience: "PROCESS", title: "pärast", body: "ei tohi" } }, { db }),
    (error) => error.status === 409 && error.code === "ALREADY_CLOSED"
  );
  assert.equal(db.store.supervisionSharedTopic.length, 0);
  assert.equal(db.store.supervisionAuditEvent.length, auditsBefore);
});

test("teema tagasivõtt: ainult autor; mitte-autor → 404; idempotentne; pärast withdraw teised ei näe", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db, { invite: ["os1", "os2"], accept: ["os1", "os2"] });
  const shared = await shareTopic({ processId, session: os1(), input: { audience: "PROCESS", title: "t", body: "b" } }, { db });

  await assert.rejects(
    () => withdrawTopic({ topicId: shared.topic.id, session: os2(), input: { expectedVersion: 0 } }, { db }),
    (e) => e.status === 404
  );
  const w = await withdrawTopic({ topicId: shared.topic.id, session: os1(), input: { expectedVersion: 0 } }, { db });
  assert.equal(w.topic.status, "WITHDRAWN");
  const w2 = await withdrawTopic({ topicId: shared.topic.id, session: os1(), input: { expectedVersion: 1 } }, { db });
  assert.equal(w2.topic.status, "WITHDRAWN");

  const os2View = await getProcessDetail({ processId, session: os2() }, { db });
  assert.equal(os2View.topics.length, 0);
});
