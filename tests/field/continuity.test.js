import test from "node:test";
import assert from "node:assert/strict";

import { FIELD_ITEM_STATE } from "../../lib/field/constants.js";
import {
  buildOfflineVisitList,
  fieldCloseBlockers,
  mergeVisibleFieldNotes
} from "../../lib/field/continuity.js";

test("close blockers include failed, conflict and authentication-parked content", () => {
  const items = Object.values(FIELD_ITEM_STATE).map((state, index) => ({
    clientItemId: `item-${index}`,
    state
  }));

  const blockers = fieldCloseBlockers(items, { needsLogin: true });

  for (const state of [
    FIELD_ITEM_STATE.DEVICE_ONLY,
    FIELD_ITEM_STATE.QUEUED,
    FIELD_ITEM_STATE.UPLOADING,
    FIELD_ITEM_STATE.FAILED,
    FIELD_ITEM_STATE.CONFLICT
  ]) {
    assert.ok(blockers.states.includes(state), `${state} must block close`);
  }
  assert.equal(blockers.needsLogin, true);
  assert.equal(blockers.blocked, true);
});

test("offline visit list is built from decrypted, non-expired pack projections", () => {
  const now = new Date("2026-08-13T12:00:00.000Z");
  const rows = buildOfflineVisitList(
    [
      {
        visitId: "visit-current",
        status: "IN_PROGRESS",
        plannedEndAt: "2026-08-13T11:00:00.000Z",
        takenAt: "2026-08-13T10:00:00.000Z",
        payload: { goal: "Praegune külastus", status: "IN_PROGRESS" }
      },
      {
        visitId: "visit-expired",
        status: "PLANNED",
        plannedEndAt: "2026-08-01T10:00:00.000Z",
        takenAt: "2026-07-20T10:00:00.000Z",
        payload: { goal: "Aegunud", status: "PLANNED" }
      }
    ],
    { now }
  );

  assert.deepEqual(rows, [
    {
      id: "visit-current",
      goal: "Praegune külastus",
      status: "IN_PROGRESS",
      plannedStartAt: null,
      plannedEndAt: "2026-08-13T11:00:00.000Z",
      updatedAt: "2026-08-13T10:00:00.000Z",
      offline: true
    }
  ]);
});

test("server notes stay visible after the local synced copy is purged", () => {
  const visible = mergeVisibleFieldNotes(
    [
      {
        clientItemId: "server-note-1",
        revision: 2,
        kind: "note",
        provenance: "KLIENDI_OELDUD",
        body: "Serveris alles",
        conflict: null
      }
    ],
    []
  );

  assert.equal(visible.length, 1);
  assert.equal(visible[0].source, "server");
  assert.equal(visible[0].body, "Serveris alles");
  assert.equal(visible[0].revision, 2);
});
