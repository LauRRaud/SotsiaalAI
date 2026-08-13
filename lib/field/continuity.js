import { FIELD_ITEM_STATE } from "./constants.js";
import { fieldPackPurgeDue } from "./syncMachine.js";

const CLOSE_BLOCKING_STATES = Object.freeze([
  FIELD_ITEM_STATE.DEVICE_ONLY,
  FIELD_ITEM_STATE.QUEUED,
  FIELD_ITEM_STATE.UPLOADING,
  FIELD_ITEM_STATE.FAILED,
  FIELD_ITEM_STATE.CONFLICT
]);

export function fieldCloseBlockers(items = [], { needsLogin = false } = {}) {
  const states = [...new Set(
    (Array.isArray(items) ? items : [])
      .map((item) => item?.state)
      .filter((state) => CLOSE_BLOCKING_STATES.includes(state))
  )];
  return {
    blocked: states.length > 0 || Boolean(needsLogin),
    count: (Array.isArray(items) ? items : []).filter((item) =>
      CLOSE_BLOCKING_STATES.includes(item?.state)
    ).length,
    states,
    needsLogin: Boolean(needsLogin)
  };
}

export function buildOfflineVisitList(packs = [], { now = new Date() } = {}) {
  return (Array.isArray(packs) ? packs : [])
    .filter((pack) => pack?.visitId && !fieldPackPurgeDue(pack, now))
    .map((pack) => ({
      id: String(pack.visitId),
      goal: pack.payload?.goal || null,
      status: pack.payload?.status || pack.status || "DRAFT",
      plannedStartAt: pack.payload?.plannedStartAt || null,
      plannedEndAt: pack.payload?.plannedEndAt || pack.plannedEndAt || null,
      updatedAt: pack.takenAt || null,
      offline: true
    }))
    .sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")));
}

export function mergeVisibleFieldNotes(serverNotes = [], localItems = []) {
  const byId = new Map();
  for (const note of Array.isArray(serverNotes) ? serverNotes : []) {
    if (!note?.clientItemId) continue;
    byId.set(note.clientItemId, { ...note, source: "server" });
  }
  for (const item of Array.isArray(localItems) ? localItems : []) {
    if (item?.itemType !== "note" || !item.clientItemId) continue;
    if (byId.has(item.clientItemId) && item.state === FIELD_ITEM_STATE.SYNCED) continue;
    byId.set(item.clientItemId, {
      clientItemId: item.clientItemId,
      revision: item.revision || 1,
      kind: item.payload?.kind || "note",
      provenance: item.payload?.provenance || null,
      body: item.payload?.body || "",
      conflict: item.serverConflict || null,
      state: item.state,
      source: "device"
    });
  }
  return [...byId.values()];
}

export const fieldContinuityInternals = Object.freeze({ CLOSE_BLOCKING_STATES });
