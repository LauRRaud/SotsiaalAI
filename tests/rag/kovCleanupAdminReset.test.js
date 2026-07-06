import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  buildKovAdminStatusResetPlan,
  serializeKovAdminCleanupState
} from "../../scripts/lib/kov-rag-state.mjs";

const fixtureMunicipality = {
  municipality_id: "jogeva_vald",
  municipality_name: "Jogeva vald",
  slug: "jogeva-vald"
};

function adminRow(overrides = {}) {
  return {
    id: "admin-1",
    municipalityId: "jogeva_vald",
    status: "INGESTED",
    readyForIngest: true,
    ingestStatus: "INGESTED",
    lastIngestedAt: new Date("2026-04-27T14:48:00.000Z"),
    lastIngestError: "old error",
    rtIngestStatus: "INGESTED",
    rtLastIngestedAt: new Date("2026-04-27T14:51:00.000Z"),
    rtLastIngestError: "old rt error",
    ragDocId: "kov-jogeva-vald",
    rtRagDocId: "kov-rt-jogeva-vald",
    municipality: {
      slug: "jogeva-vald",
      displayName: "Jogeva vald"
    },
    ...overrides
  };
}

test("KOV cleanup admin reset moves stale INGESTED workflow state back to manual review", () => {
  const plan = buildKovAdminStatusResetPlan({
    row: adminRow(),
    municipality: fixtureMunicipality,
    bundleReadiness: {
      bundle_exists: true,
      source_package_readiness_ok: true,
      ingest_ready: true,
      ready_for_admin_reset: true
    },
    webDocumentExists: false,
    rtDocumentExists: false
  });

  assert.equal(plan.staleAdminIngested, true);
  assert.equal(plan.removes_top_level_ingested_status, true);
  assert.equal(plan.after.adminStatus, "NEEDS_REVIEW");
  assert.equal(plan.after.readyForIngest, false);
  assert.equal(plan.after.ingestStatus, "NOT_INGESTED");
  assert.equal(plan.after.rtIngestStatus, "NOT_INGESTED");
  assert.equal(plan.after.lastIngestedAt, null);
  assert.equal(plan.after.rtLastIngestedAt, null);
  assert.equal(plan.after.ragDocId, "kov-jogeva-vald");
  assert.equal(plan.after.rtRagDocId, "kov-rt-jogeva-vald");
  assert.equal(plan.will_update, true);
});

test("KOV cleanup admin reset uses NEEDS_REVIEW when source bundle is not ready", () => {
  const plan = buildKovAdminStatusResetPlan({
    row: adminRow({ status: "INGESTED", readyForIngest: true }),
    municipality: fixtureMunicipality,
    bundleReadiness: {
      bundle_exists: false,
      ready_for_admin_reset: false
    }
  });

  assert.equal(plan.after.adminStatus, "NEEDS_REVIEW");
  assert.equal(plan.after.readyForIngest, false);
  assert.equal(plan.after.ingestStatus, "NOT_INGESTED");
});

test("KOV cleanup admin serialization treats ragDocId as expected deterministic id", () => {
  const state = serializeKovAdminCleanupState(adminRow({ ragDocId: null, rtRagDocId: null }), fixtureMunicipality);

  assert.equal(state.ragDocId, "kov-jogeva-vald");
  assert.equal(state.expectedWebDocId, "kov-jogeva-vald");
  assert.equal(state.rtRagDocId, "kov-rt-jogeva-vald");
  assert.equal(state.expectedRtDocId, "kov-rt-jogeva-vald");
});

test("KOV cleanup script keeps destructive write behind confirm guard and does not delete repo files", () => {
  const source = fs.readFileSync("scripts/cleanup-kov-rag-state.mjs", "utf8");

  assert.match(source, /args\.write && !args\.confirmCleanup/);
  assert.match(source, /Refusing destructive cleanup/);
  assert.doesNotMatch(source, /rm\s+-rf\s+KOV/u);
  assert.doesNotMatch(source, /Remove-Item[^"\n']+KOV/u);
});
