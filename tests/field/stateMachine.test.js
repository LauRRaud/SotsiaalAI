import test from "node:test";
import assert from "node:assert/strict";

import {
  FIELD_ITEM_STATE,
  FIELD_SYNC_MAX_AUTO_ATTEMPTS,
  FIELD_VISIT_STATUS
} from "../../lib/field/constants.js";
import {
  applyFieldSyncEvent,
  FieldPurgeDecision,
  fieldItemPurgeDecision,
  fieldPackPurgeDue,
  FieldSyncEvent,
  isUploadDue,
  retryBackoffMs
} from "../../lib/field/syncMachine.js";

const NOW = new Date("2026-07-18T12:00:00.000Z");
const S = FIELD_ITEM_STATE;

function item(state, overrides = {}) {
  return { clientItemId: "fld_abc123", state, revision: 1, attempts: 0, createdAt: NOW.toISOString(), ...overrides };
}

test("the nine-state machine follows the doc 3.2 transitions and rejects illegal jumps", () => {
  assert.equal(applyFieldSyncEvent(item(S.DEVICE_ONLY), FieldSyncEvent.USER_APPROVED, { now: NOW }).state, S.QUEUED);
  assert.equal(applyFieldSyncEvent(item(S.QUEUED), FieldSyncEvent.UPLOAD_STARTED, { now: NOW }).state, S.UPLOADING);
  assert.equal(applyFieldSyncEvent(item(S.UPLOADING), FieldSyncEvent.UPLOAD_OK, { now: NOW }).state, S.SYNCED);
  assert.equal(applyFieldSyncEvent(item(S.UPLOADING), FieldSyncEvent.UPLOAD_CONFLICT, { now: NOW }).state, S.CONFLICT);
  assert.equal(applyFieldSyncEvent(item(S.CONFLICT), FieldSyncEvent.CONFLICT_RESOLVED, { now: NOW }).state, S.QUEUED);
  assert.equal(applyFieldSyncEvent(item(S.QUEUED), FieldSyncEvent.USER_CANCELLED, { now: NOW }).state, S.CANCELLED);
  assert.equal(applyFieldSyncEvent(item(S.SYNCED), FieldSyncEvent.PURGE_REQUESTED, { now: NOW }).state, S.PURGE_PENDING);
  assert.equal(applyFieldSyncEvent(item(S.PURGE_PENDING), FieldSyncEvent.PURGE_DONE, { now: NOW }).state, S.REMOVED);
  // Illegal jumps come back as null, never a silent overwrite.
  assert.equal(applyFieldSyncEvent(item(S.DEVICE_ONLY), FieldSyncEvent.UPLOAD_OK, { now: NOW }), null);
  assert.equal(applyFieldSyncEvent(item(S.SYNCED), FieldSyncEvent.UPLOAD_STARTED, { now: NOW }), null);
  assert.equal(applyFieldSyncEvent(item(S.REMOVED), FieldSyncEvent.USER_APPROVED, { now: NOW }), null);
});

test("retryable errors back off exponentially and stop at the automatic attempt cap", () => {
  let current = item(S.UPLOADING, { attempts: 0 });
  for (let attempt = 1; attempt < FIELD_SYNC_MAX_AUTO_ATTEMPTS; attempt += 1) {
    current = applyFieldSyncEvent(current, FieldSyncEvent.UPLOAD_RETRYABLE_ERROR, { now: NOW });
    assert.equal(current.state, S.QUEUED, `attempt ${attempt} keeps retrying`);
    assert.equal(current.attempts, attempt);
    assert.ok(new Date(current.nextAttemptAt).getTime() > NOW.getTime());
    current = applyFieldSyncEvent(current, FieldSyncEvent.UPLOAD_STARTED, { now: NOW });
  }
  const terminal = applyFieldSyncEvent(current, FieldSyncEvent.UPLOAD_RETRYABLE_ERROR, { now: NOW });
  assert.equal(terminal.state, S.FAILED, "the fifth automatic failure is terminal");
  // Manual retry resets the counter.
  const retried = applyFieldSyncEvent(terminal, FieldSyncEvent.USER_RETRY, { now: NOW });
  assert.equal(retried.state, S.QUEUED);
  assert.equal(retried.attempts, 0);
  assert.equal(retryBackoffMs(1), 5_000);
  assert.equal(retryBackoffMs(20), 5 * 60_000, "backoff is capped at five minutes");
});

test("reconcile treats UPLOADING as untrusted and resolves it from the server truth", () => {
  const found = applyFieldSyncEvent(item(S.UPLOADING), FieldSyncEvent.RECONCILE_FOUND_ON_SERVER, { now: NOW });
  assert.equal(found.state, S.SYNCED);
  const missing = applyFieldSyncEvent(item(S.UPLOADING), FieldSyncEvent.RECONCILE_NOT_ON_SERVER, { now: NOW });
  assert.equal(missing.state, S.QUEUED);
});

test("auth loss parks the queue without losing data and editing a synced item bumps its revision", () => {
  const parked = applyFieldSyncEvent(item(S.UPLOADING), FieldSyncEvent.AUTH_REQUIRED, { now: NOW });
  assert.equal(parked.state, S.QUEUED);
  assert.equal(parked.needsLogin, true);
  assert.equal(isUploadDue(parked, NOW), false, "a parked item is not auto-picked");
  const edited = applyFieldSyncEvent(item(S.SYNCED, { revision: 3 }), FieldSyncEvent.USER_EDITED, { now: NOW });
  assert.equal(edited.state, S.DEVICE_ONLY);
  assert.equal(edited.revision, 4);
});

test("local retention: synced copies purge after 7 days; unsent content only warns and needs 3 warnings", () => {
  const syncedOld = item(S.SYNCED, { syncedAt: new Date(NOW.getTime() - 8 * 24 * 3600 * 1000).toISOString() });
  assert.equal(fieldItemPurgeDecision(syncedOld, NOW), FieldPurgeDecision.PURGE);
  const syncedFresh = item(S.SYNCED, { syncedAt: NOW.toISOString() });
  assert.equal(fieldItemPurgeDecision(syncedFresh, NOW), FieldPurgeDecision.KEEP);

  const unsent31d = item(S.DEVICE_ONLY, {
    createdAt: new Date(NOW.getTime() - 31 * 24 * 3600 * 1000).toISOString()
  });
  assert.equal(fieldItemPurgeDecision(unsent31d, NOW), FieldPurgeDecision.WARN);

  const unsent38d = item(S.DEVICE_ONLY, {
    createdAt: new Date(NOW.getTime() - 38 * 24 * 3600 * 1000).toISOString()
  });
  assert.equal(
    fieldItemPurgeDecision(unsent38d, NOW),
    FieldPurgeDecision.WARN,
    "even past day 37, unsent content is NOT purged before three warnings"
  );
  /* SOL-FIELD-01: kolm hoiatust EI OLE kustutusluba. Varem lõppes see test siin
     ja `warnCount: 3` andis `PURGE` — aga loendurit täitis TAUSTAKÄIK, mida
     keegi ei kuvanud. Nüüd on vaja ka viimast eksplitsiitset kinnitust.
     Käiku ennast mõõdab `tests/field/localRetention.test.js`. */
  assert.equal(
    fieldItemPurgeDecision({ ...unsent38d, warnCount: 3 }, NOW),
    FieldPurgeDecision.WARN,
    "kolm hoiatust ilma kinnituseta ei kustuta"
  );
  assert.equal(
    fieldItemPurgeDecision(
      { ...unsent38d, warnCount: 3, purgeConfirmedAt: new Date(NOW.getTime() - 1000).toISOString() },
      NOW
    ),
    FieldPurgeDecision.PURGE
  );
});

test("visit pack expiry: 72h after the planned window or 7 days for drafts", () => {
  const afterWindow = { plannedEndAt: new Date(NOW.getTime() - 73 * 3600 * 1000).toISOString() };
  assert.equal(fieldPackPurgeDue(afterWindow, NOW), true);
  const insideWindow = { plannedEndAt: new Date(NOW.getTime() - 10 * 3600 * 1000).toISOString() };
  assert.equal(fieldPackPurgeDue(insideWindow, NOW), false);
  const draftOld = { takenAt: new Date(NOW.getTime() - 8 * 24 * 3600 * 1000).toISOString() };
  assert.equal(fieldPackPurgeDue(draftOld, NOW), true);
});

/* SOL-FIELD-02: sulgemine on lepingu ESIMENE tähtaeg, mitte kolmas. Ilma selleta
   elaks suletud külastuse pakett veel kuni 72 h — ja külastus, mis planeeriti
   kaugele ette, veel kauem. */
test("visit pack expiry: a closed or cancelled visit drops its pack immediately", () => {
  const future = { plannedEndAt: new Date(NOW.getTime() + 30 * 24 * 3600 * 1000).toISOString() };
  assert.equal(fieldPackPurgeDue({ ...future, status: FIELD_VISIT_STATUS.PLANNED }, NOW), false);
  assert.equal(fieldPackPurgeDue({ ...future, status: FIELD_VISIT_STATUS.CLOSED }, NOW), true);
  assert.equal(fieldPackPurgeDue({ ...future, status: FIELD_VISIT_STATUS.CANCELLED }, NOW), true);
  /* Tundmatu olek ei ole lõpetatud — vale pool oleks vaikne kustutus. */
  assert.equal(fieldPackPurgeDue({ ...future, status: "MIDAGI_UUT" }, NOW), false);
});
