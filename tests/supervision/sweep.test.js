import test from "node:test";
import assert from "node:assert/strict";
import { setupBase, makeActiveProcess } from "./scenario.js";
import { runSupervisionSweep } from "../../lib/supervision/sweep.js";

const now = new Date("2026-08-13T08:00:00.000Z");

async function seedMeeting(db, processId, seq, plannedAt, status = "PLANNED") {
  return db.supervisionMeeting.create({
    data: { processId, seq, plannedAt, status, agendaTopicIds: [], version: 0 }
  });
}

test("SUP-05: stable pagination covers 2.5 batches and repeat is deduplicated", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db, { invite: ["os1", "os2"], accept: ["os1", "os2"] });
  for (let seq = 1; seq <= 5; seq += 1) {
    await seedMeeting(db, processId, seq, new Date(now.getTime() + seq * 60_000));
  }

  const first = await runSupervisionSweep({ db, now, batchSize: 2 });
  assert.equal(first.meetingsConsidered, 5);
  assert.equal(first.meetingsNotified, 5);
  assert.equal(first.notificationsCreated, 15);
  const second = await runSupervisionSweep({ db, now, batchSize: 2 });
  assert.equal(second.notificationsCreated, 0);
  assert.equal(second.notificationsExisting, 15);
});

test("SUP-05: reschedule emits a new reminder; cancelled and CLOSED are skipped", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db);
  const meeting = await seedMeeting(db, processId, 1, new Date(now.getTime() + 60_000));
  await seedMeeting(db, processId, 2, new Date(now.getTime() + 120_000), "CANCELLED");

  await runSupervisionSweep({ db, now, batchSize: 1 });
  assert.equal(db.store.notificationEvent.filter((row) => row.sourceId === meeting.id).length, 2);
  const moved = new Date(now.getTime() + 180_000);
  await db.supervisionMeeting.update({ where: { id: meeting.id }, data: { plannedAt: moved } });
  await runSupervisionSweep({ db, now, batchSize: 1 });
  assert.equal(db.store.notificationEvent.filter((row) => row.sourceId === meeting.id).length, 4);

  await db.supervisionProcess.update({ where: { id: processId }, data: { status: "CLOSED" } });
  await seedMeeting(db, processId, 3, new Date(now.getTime() + 240_000));
  const closed = await runSupervisionSweep({ db, now, batchSize: 1 });
  assert.equal(closed.notificationsCreated, 0);
});

test("SUP-05: recipients are derived fresh", async () => {
  const db = setupBase();
  const { processId, participationIds } = await makeActiveProcess(
    db,
    { invite: ["os1", "os2"], accept: ["os1", "os2"] }
  );
  await seedMeeting(db, processId, 1, new Date(now.getTime() + 60_000));
  await db.supervisionParticipation.update({
    where: { id: participationIds.os2 }, data: { status: "LEFT", leftAt: now }
  });
  await runSupervisionSweep({ db, now });
  assert.deepEqual(
    db.store.notificationEvent
      .filter((row) => row.type === "SUPERVISION_MEETING_UPCOMING")
      .map((row) => row.userId)
      .sort(),
    ["os1", "sv1"]
  );
});
