import test from "node:test";
import assert from "node:assert/strict";
import { setupBase, sv, os1, makeActiveProcess } from "./scenario.js";
import { SUPERVISION_ACTIVITY_EVENTS } from "../../lib/supervision/shared.js";
import { createContractVersion } from "../../lib/supervision/service.js";
import { createSummary, updateSummary, submitSummary } from "../../lib/supervision/summaries.js";
import { shareTopic, withdrawTopic } from "../../lib/supervision/topics.js";
import { createPrivateItem, updatePrivateItem, deletePrivateItem } from "../../lib/supervision/privateItems.js";

const REQUIRED_ACTIVITY_EVENTS = [
  "process_created", "process_updated", "contract_version_created", "contract_activated",
  "invite_sent", "invite_withdrawn", "invite_responded", "contract_accepted", "participant_left",
  "topic_shared", "topic_withdrawn", "meeting_planned", "meeting_updated",
  "summary_created", "summary_updated", "summary_submitted", "summary_discarded", "summary_approved",
  "process_closed"
];

test("SUP-14: kanooniline tegevussündmuste loend on täielik ja privaatala teadlikult väljas", () => {
  assert.deepEqual([...SUPERVISION_ACTIVITY_EVENTS], REQUIRED_ACTIVITY_EVENTS);
  assert.ok(SUPERVISION_ACTIVITY_EVENTS.every((event) => !event.startsWith("private_")));
});

test("SUP-14: varem puudu olnud jagatud toimingud uuendavad lastActivityAt samas tehingus", async () => {
  const cases = [
    {
      name: "contract_version_created",
      prepare: async (db, processId) => ({ db, processId }),
      act: ({ db, processId }, now) => createContractVersion(
        { processId, session: sv(), input: { body: "Uus raam" } }, { db, now }
      )
    },
    {
      name: "summary_updated",
      prepare: async (db, processId) => ({
        db,
        processId,
        summary: (await createSummary(
          { processId, session: sv(), input: { kind: "FINAL", body: "Mustand" } }, { db }
        )).summary
      }),
      act: ({ db, summary }, now) => updateSummary(
        { summaryId: summary.id, session: sv(), input: { body: "Muudetud", expectedVersion: summary.version } },
        { db, now }
      )
    },
    {
      name: "summary_submitted",
      prepare: async (db, processId) => ({
        db,
        processId,
        summary: (await createSummary(
          { processId, session: sv(), input: { kind: "FINAL", body: "Mustand" } }, { db }
        )).summary
      }),
      act: ({ db, summary }, now) => submitSummary(
        { summaryId: summary.id, session: sv(), input: { expectedVersion: summary.version } }, { db, now }
      )
    },
    {
      name: "topic_withdrawn",
      prepare: async (db, processId) => ({
        db,
        processId,
        topic: (await shareTopic(
          { processId, session: os1(), input: { title: "Teema", body: "Sisu", audience: "PROCESS" } }, { db }
        )).topic
      }),
      act: ({ db, topic }, now) => withdrawTopic(
        { topicId: topic.id, session: os1(), input: { expectedVersion: topic.version } }, { db, now }
      )
    }
  ];

  for (const [index, row] of cases.entries()) {
    const db = setupBase();
    const { processId } = await makeActiveProcess(db);
    const ctx = await row.prepare(db, processId);
    const now = new Date(`2030-01-0${index + 1}T12:00:00.000Z`);
    await row.act(ctx, now);
    const process = await db.supervisionProcess.findUnique({ where: { id: processId } });
    assert.equal(process.lastActivityAt.toISOString(), now.toISOString(), row.name);
  }
});

test("SUP-14: M6 privaattoimingud ei muuda protsessi tegevusaega", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db);
  const before = (await db.supervisionProcess.findUnique({ where: { id: processId } })).lastActivityAt;
  const item = await createPrivateItem(
    { processId, session: os1(), input: { kind: "PRIVATE_NOTE", body: "Privaatne" } }, { db }
  );
  await updatePrivateItem(
    { itemId: item.item.id, session: os1(), input: { body: "Muudetud", expectedVersion: item.item.version } }, { db }
  );
  await deletePrivateItem({ itemId: item.item.id, session: os1() }, { db });
  const after = (await db.supervisionProcess.findUnique({ where: { id: processId } })).lastActivityAt;
  assert.equal(after.toISOString(), before.toISOString());
});
