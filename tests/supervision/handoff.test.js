import test from "node:test";
import assert from "node:assert/strict";
import { setupBase, sv, os1, makeActiveProcess } from "./scenario.js";
import { startSupervisionHandoffFromWellbeingDraft } from "../../lib/supervision/wellbeingHandoff.js";
import { listPrivateItems } from "../../lib/supervision/privateItems.js";
import { getProcessDetail } from "../../lib/supervision/service.js";

function seedDraft(db, { id = "draft1", userId = "os1", updatedAt = new Date("2026-07-10T00:00:00.000Z") } = {}) {
  const draft = {
    id, userId, sourceWorkflowType: "overview", sourceRecordId: null,
    outputType: "support_request", recipientType: "supervisor",
    generatedText: "Toores mustanditekst", editedText: "Kinnitatud küsimus superviisorile",
    userReviewed: true, userConfirmed: true, visibility: "private", status: "ready_to_share",
    schemaVersion: "1.0", covisionCaseId: null, handedOffAt: null,
    createdAt: new Date("2026-07-09T00:00:00.000Z"), updatedAt
  };
  db.store.wellbeingOutputDraft.push(draft);
  return draft;
}

test("test #16: üleandmine loob AINULT M6 privaatkirje; superviisor ei näe midagi", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db);
  const draft = seedDraft(db, { userId: "os1" });
  const actor = { userId: "os1", role: "SERVICE_PROVIDER" };

  const res = await startSupervisionHandoffFromWellbeingDraft(
    actor, draft.id, { processId, expectedUpdatedAt: draft.updatedAt.toISOString(), title: "Toodud Tööheaolust" }, { db }
  );
  assert.equal(res.created, true);

  // M6 privaatkirje loodud os1-le, WELLBEING_HANDOFF päritoluga
  const list = await listPrivateItems({ processId, session: os1() }, { db });
  assert.equal(list.items.length, 1);
  assert.equal(list.items[0].body, "Kinnitatud küsimus superviisorile");
  assert.equal(list.items[0].sourceKind, "WELLBEING_HANDOFF");
  assert.equal(list.items[0].sourceWellbeingDraftId, draft.id);

  // Superviisor EI näe kirjet (ei jagatud vaates, ega tema eeskamber-loendis)
  const svDetail = await getProcessDetail({ processId, session: sv() }, { db });
  assert.ok(!JSON.stringify(svDetail).includes("Kinnitatud küsimus"));
  const svList = await listPrivateItems({ processId, session: sv() }, { db });
  assert.equal(svList.items.length, 0);

  // Toorkirje väljad ei liigu (M6 kannab ainult body/title/sourceKind/sourceWellbeingDraftId)
  const itemRow = db.store.supervisionPrivateItem[0];
  assert.equal(itemRow.body, "Kinnitatud küsimus superviisorile");
  assert.ok(!("generatedText" in itemRow));
  assert.ok(!("sourceRecordId" in itemRow));

  // Draft märgitud üle antuks
  const draftRow = db.store.wellbeingOutputDraft.find((d) => d.id === draft.id);
  assert.equal(draftRow.status, "in_supervision");
  assert.ok(draftRow.handedOffAt);

  // Üleandmine EI kirjuta M13 auditit (privaatala)
  assert.equal(db.store.supervisionAuditEvent.filter((a) => String(a.action).includes("HANDOFF")).length, 0);
});

test("fingerprint-mismatch → 409; topeltüleandmine → idempotentne (üks M6, created=false)", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db);
  const draft = seedDraft(db, { userId: "os1" });
  const actor = { userId: "os1", role: "SERVICE_PROVIDER" };

  await assert.rejects(
    () => startSupervisionHandoffFromWellbeingDraft(actor, draft.id, { processId, expectedUpdatedAt: "2020-01-01T00:00:00.000Z" }, { db }),
    (e) => e.status === 409
  );
  await startSupervisionHandoffFromWellbeingDraft(actor, draft.id, { processId, expectedUpdatedAt: draft.updatedAt.toISOString() }, { db });
  const again = await startSupervisionHandoffFromWellbeingDraft(actor, draft.id, { processId, expectedUpdatedAt: draft.updatedAt.toISOString() }, { db });
  assert.equal(again.created, false);
  assert.equal(db.store.supervisionPrivateItem.filter((i) => i.sourceWellbeingDraftId === draft.id).length, 1);
});

test("üleandmine ainult ACCEPTED-osalusega ACTIVE protsessi (INVITED os → 404)", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db, { invite: ["os1", "os2"], accept: ["os1"] });
  const draft = seedDraft(db, { userId: "os2" });
  const actor = { userId: "os2", role: "SOCIAL_WORKER" };
  await assert.rejects(
    () => startSupervisionHandoffFromWellbeingDraft(actor, draft.id, { processId, expectedUpdatedAt: draft.updatedAt.toISOString() }, { db }),
    (e) => e.status === 404
  );
  assert.equal(db.store.supervisionPrivateItem.length, 0);
});

test("mitte-kinnitatud mustand (userConfirmed=false) → 409 handoff_not_ready", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db);
  const draft = seedDraft(db, { userId: "os1" });
  draft.userConfirmed = false;
  const actor = { userId: "os1", role: "SERVICE_PROVIDER" };
  await assert.rejects(
    () => startSupervisionHandoffFromWellbeingDraft(actor, draft.id, { processId, expectedUpdatedAt: draft.updatedAt.toISOString() }, { db }),
    (e) => e.status === 409
  );
});
