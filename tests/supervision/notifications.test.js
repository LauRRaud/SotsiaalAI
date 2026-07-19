import test from "node:test";
import assert from "node:assert/strict";
import { setupBase, sv, makeActiveProcess } from "./scenario.js";
import {
  createContractVersion,
  activateContractVersion,
  getProcessDetail
} from "../../lib/supervision/service.js";
import { createSummary, submitSummary } from "../../lib/supervision/summaries.js";
import { assertNotificationRecipient } from "../../lib/notifications.js";
import { buildSupervisionContinuity } from "../../lib/supervision/notifications.js";

const ALLOWED_EVENT_FIELDS = new Set([
  "id", "userId", "type", "sourceType", "sourceId", "dedupeKey", "targetKind", "targetId",
  "eventId", "workspaceKind", "workspaceId", "expiresAt", "emailPolicy", "emailStatus",
  "emailNextAttemptAt", "emailMessageId", "createdAt", "readAt", "dismissedAt"
]);

test("test #15: ükski supervisiooni NotificationEvent ei kanna vabateksti", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db, { invite: ["os1", "os2"], accept: ["os1", "os2"] });
  const sum = await createSummary({ processId, session: sv(), input: { kind: "FINAL", body: "Salajane kokkuvõttetekst" } }, { db });
  await submitSummary({ summaryId: sum.summary.id, session: sv(), input: { expectedVersion: sum.summary.version } }, { db });

  const events = db.store.notificationEvent;
  assert.ok(events.length > 0, "teavitusi peaks olema tekkinud");
  for (const event of events) {
    for (const key of Object.keys(event)) {
      assert.ok(ALLOWED_EVENT_FIELDS.has(key), `ootamatu väli teavituses: ${key}`);
    }
    const blob = JSON.stringify(event);
    assert.ok(!blob.includes("Salajane"), "kokkuvõtte tekst ei tohi lekkida");
    assert.ok(!blob.includes("Kevadgrupp"), "protsessi pealkiri ei tohi lekkida");
    assert.ok(!blob.includes("Kontrakt"), "kontrakti tekst ei tohi lekkida");
  }
});

test("saaja-verifitseerimine: kutse ainult kutsutule; sulgemine liikmele; võõras → 404", async () => {
  const db = setupBase();
  const { processId, participationIds } = await makeActiveProcess(db, { invite: ["os1", "os2"], accept: ["os1"] });
  // os2 on INVITED
  await assert.doesNotReject(() => assertNotificationRecipient(db, {
    type: "SUPERVISION_INVITE", userId: "os2", sourceId: participationIds.os2, targetId: processId
  }));
  await assert.rejects(() => assertNotificationRecipient(db, {
    type: "SUPERVISION_INVITE", userId: "outsider", sourceId: participationIds.os2, targetId: processId
  }), (e) => e.status === 404);

  await assert.doesNotReject(() => assertNotificationRecipient(db, {
    type: "SUPERVISION_CLOSED", userId: "sv1", sourceId: processId, targetId: processId
  }));
  await assert.rejects(() => assertNotificationRecipient(db, {
    type: "SUPERVISION_CLOSED", userId: "outsider", sourceId: processId, targetId: processId
  }), (e) => e.status === 404);
});

test("continuity-allikas: OS† kontrakt-kinnitus annab kirje; kuni 2 kirjet", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db);
  // Kinnitatud OS → tühi continuity
  let items = await buildSupervisionContinuity(db, "os1", {});
  assert.equal(items.length, 0);

  // Aktiveeri uus versioon → os1 muutub OS†
  const svView = await getProcessDetail({ processId, session: sv() }, { db });
  const cv2 = await createContractVersion({ processId, session: sv(), input: { body: "v2" } }, { db });
  await activateContractVersion(
    { processId, versionId: cv2.contractVersion.id, session: sv(), input: { expectedVersion: svView.version } }, { db }
  );

  items = await buildSupervisionContinuity(db, "os1", {});
  assert.ok(items.length >= 1 && items.length <= 2);
  assert.equal(items[0].kind, "supervision");
  assert.ok(items[0].labelKey.includes("contract_pending"));
  assert.ok(items[0].href.includes("ala=kontrakt"));
});
