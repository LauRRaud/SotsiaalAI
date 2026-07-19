import test from "node:test";
import assert from "node:assert/strict";
import { setupBase, sv, os1, makeActiveProcess } from "./scenario.js";
import { planMeeting, updateMeeting } from "../../lib/supervision/meetings.js";
import { getProcessDetail } from "../../lib/supervision/service.js";

test("kohtumise plaanimine: SV, seq kasvab; OS → 404", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db);
  const m1 = await planMeeting({ processId, session: sv(), input: { plannedAt: "2026-08-01T10:00:00.000Z" } }, { db });
  const m2 = await planMeeting({ processId, session: sv(), input: {} }, { db });
  assert.equal(m1.meeting.seq, 1);
  assert.equal(m2.meeting.seq, 2);
  assert.equal(m1.meeting.status, "PLANNED");
  await assert.rejects(
    () => planMeeting({ processId, session: os1(), input: {} }, { db }),
    (e) => e.status === 404
  );
});

test("HELD-märge on lõplik: seab heldAt + MEETING_HELD audit; tagasi PLANNED → 409", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db);
  const m = await planMeeting({ processId, session: sv(), input: {} }, { db });
  const held = await updateMeeting(
    { meetingId: m.meeting.id, session: sv(), input: { status: "HELD", expectedVersion: 0 } }, { db }
  );
  assert.equal(held.meeting.status, "HELD");
  assert.ok(held.meeting.heldAt);
  assert.equal(db.store.supervisionAuditEvent.filter((a) => a.action === "MEETING_HELD").length, 1);

  await assert.rejects(
    () => updateMeeting({ meetingId: m.meeting.id, session: sv(), input: { status: "PLANNED", expectedVersion: 1 } }, { db }),
    (e) => e.status === 409
  );
});

test("kohtumise CAS: vale expectedVersion → 409; note ja agendaTopicIds salvestuvad", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db);
  const m = await planMeeting({ processId, session: sv(), input: {} }, { db });
  await assert.rejects(
    () => updateMeeting({ meetingId: m.meeting.id, session: sv(), input: { note: "x", expectedVersion: 5 } }, { db }),
    (e) => e.status === 409
  );
  const upd = await updateMeeting(
    { meetingId: m.meeting.id, session: sv(), input: { note: "Töömärge", agendaTopicIds: ["t1", "t2"], expectedVersion: 0 } },
    { db }
  );
  assert.equal(upd.meeting.note, "Töömärge");
  assert.deepEqual(upd.meeting.agendaTopicIds, ["t1", "t2"]);

  // Liikmed näevad kohtumise fakti
  const osView = await getProcessDetail({ processId, session: os1() }, { db });
  assert.equal(osView.meetings.length, 1);
  assert.equal(osView.meetings[0].seq, 1);
});
