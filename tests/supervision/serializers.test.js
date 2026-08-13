import test from "node:test";
import assert from "node:assert/strict";
import { setupBase, sv, os1, os2, makeActiveProcess } from "./scenario.js";
import { getProcessDetail } from "../../lib/supervision/service.js";

const KUT_KEYS = ["id", "viewerRole", "title", "type", "supervisorName", "activeContract", "myParticipation"].sort();
const MEMBER_KEYS = [
  "id", "viewerRole", "title", "type", "status", "goal", "plannedMeetingCount", "version",
  "supervisorName", "myParticipation", "activeContract", "contractVersions", "participants",
  "topics", "meetings", "summaries", "closure", "capabilities"
].sort();

function keys(obj) {
  return Object.keys(obj).sort();
}

test("test #4: KUT-kaardi võtmehulk on TÄPNE piiratud komplekt (ei osalejaid/teemasid/kohtumisi/kokkuvõtteid)", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db, { invite: ["os1", "os2"], accept: ["os1"] });
  const card = await getProcessDetail({ processId, session: os2() }, { db });
  assert.deepEqual(keys(card), KUT_KEYS);
});

test("liikmevaate võtmehulk on identne SV ja OS lõikes (uus väli ei leki vaikimisi)", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db);
  const svView = await getProcessDetail({ processId, session: sv() }, { db });
  const osView = await getProcessDetail({ processId, session: os1() }, { db });
  assert.deepEqual(keys(svView), MEMBER_KEYS);
  assert.deepEqual(keys(osView), MEMBER_KEYS);
});

test("OS näeb kaas-liikmete nimekirja; contractVersions ainult SV-le", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db, { invite: ["os1", "os2"], accept: ["os1", "os2"] });
  const svView = await getProcessDetail({ processId, session: sv() }, { db });
  const osView = await getProcessDetail({ processId, session: os1() }, { db });

  assert.equal(svView.participants.length, 2);
  assert.equal(osView.participants.length, 2);
  // versiooniajalugu ainult SV-le
  assert.ok(svView.contractVersions.length >= 1);
  assert.equal(osView.contractVersions.length, 0);

  // Osaleja kirje kannab ainult id/userId/name/status/respondedAt/leftAt
  assert.deepEqual(
    Object.keys(osView.participants[0]).sort(),
    ["id", "userId", "name", "status", "respondedAt", "leftAt"].sort()
  );
});

test("SV capabilities lubab hallata; OS lubab jagada/kinnitada; kumbki roll õige", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db);
  const svView = await getProcessDetail({ processId, session: sv() }, { db });
  const osView = await getProcessDetail({ processId, session: os1() }, { db });

  assert.equal(svView.capabilities.canInvite, true);
  assert.equal(svView.capabilities.canClose, true);
  // SV EI jaga teemasid: M7 autor on alati osalus (schema NOT NULL FK) ja
  // topics.js viskab superviisorile 403. Lipp peab jõustusega kokku langema,
  // muidu kannaks UI nuppu, mis alati ebaõnnestub.
  assert.equal(svView.capabilities.canShareTopic, true);
  assert.equal(svView.capabilities.canApproveSummary, false);

  assert.equal(osView.capabilities.canInvite, false);
  assert.equal(osView.capabilities.canClose, false);
  assert.equal(osView.capabilities.canShareTopic, true);
  assert.equal(osView.capabilities.canApproveSummary, true);
});
