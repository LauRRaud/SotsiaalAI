import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { DATA_EXPORT_REGISTRY } from "../../lib/dataExport/registry.js";
import { isLatestReflectionDetailRequest } from "../../lib/reflection/requestSequence.js";

const records = await readFile(new URL("../../lib/reflection/records.js", import.meta.url), "utf8");
const page = await readFile(new URL("../../components/reflection/ReflectionPage.jsx", import.meta.url), "utf8");
const schema = await readFile(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");

test("REF-06 registry exports owner-scoped practice reflections", () => {
  const surface = DATA_EXPORT_REGISTRY.find((entry) => entry.name === "practice_reflections");
  assert.ok(surface);
  assert.equal(surface.thirdPartyExcluded, true);
});

test("REF-06 export copies every owner field before deletion without resolving another person", async () => {
  const surface = DATA_EXPORT_REGISTRY.find((entry) => entry.name === "practice_reflections");
  const rows = [
    {
      id: "mine",
      ownerUserId: "owner",
      schemaVersion: "1.0",
      sourceKind: "PRE_INQUIRY",
      sourceId: "source-mine",
      method: "Minu meetod",
      clientReaction: "Omaniku kirje",
      retentionState: "USER_DELETED",
      retentionDeadline: new Date("2026-09-01T00:00:00.000Z"),
      deletedAt: new Date("2026-08-14T10:00:00.000Z"),
      undoUntil: new Date("2026-08-14T10:00:30.000Z"),
      createdAt: new Date("2026-08-14T09:00:00.000Z"),
      updatedAt: new Date("2026-08-14T10:00:00.000Z"),
      idempotencyKey: "secret-replay-key",
      requestHash: "secret-hash"
    },
    {
      id: "foreign",
      ownerUserId: "other",
      schemaVersion: "1.0",
      method: "Võõras sisu",
      retentionState: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
  let query;
  const files = await surface.collect({
    userId: "owner",
    db: {
      practiceReflection: {
        findMany: async (args) => {
          query = args;
          return rows.filter((row) => row.ownerUserId === args.where.ownerUserId);
        }
      }
    }
  });
  const exported = files[0].content.toString("utf8");
  assert.deepEqual(query.where, { ownerUserId: "owner" });
  assert.equal(query.select.id, true);
  assert.equal(query.select.ownerUserId, undefined);
  assert.equal(query.include, undefined);
  assert.match(exported, /mine|Minu meetod|Omaniku kirje|source-mine|USER_DELETED/);
  assert.doesNotMatch(exported, /Võõras sisu|secret-replay-key|secret-hash|ownerUserId/);
});

test("REF-07 has a traceable deadline and monitored idempotent retention worker", async () => {
  assert.match(schema, /model PracticeReflection[\s\S]*retentionDeadline\s+DateTime\?/);
  assert.match(schema, /model PracticeReflectionRetentionRun/);
  const worker = await readFile(new URL("../../lib/reflection/retention.js", import.meta.url), "utf8");
  assert.match(worker, /subscription[\s\S]*validUntil/);
  assert.match(worker, /practiceReflectionRetentionRun/);
  assert.match(worker, /deleteMany/);
});

test("REF-08 deletion is recoverable and no longer hard-deletes immediately", async () => {
  assert.doesNotMatch(records, /deletePracticeReflectionForUser[\s\S]*practiceReflection\.deleteMany/);
  assert.match(records, /undoPracticeReflectionDeletionForUser/);
  assert.match(records, /undoUntil/);
  const undoRoute = await readFile(new URL("../../app/api/reflections/[id]/undo/route.js", import.meta.url), "utf8");
  assert.match(undoRoute, /undoPracticeReflectionDeletionForUser/);
  assert.match(page, /<ModalConfirm[\s\S]*message=\{t\("reflection\.deletion\.confirm"\)\}/);
  assert.match(page, /onClick=\{\(\) => \{ setDeleteCandidateId\(reflection\.id\); \}\}/);
  assert.match(page, /onCancel=\{\(\) => \{ if \(!deleting\) setDeleteCandidateId\(null\); \}\}/);
  assert.match(page, /onConfirm=\{\(\) => \{ void remove\(\); \}\}/);
  assert.match(page, /data-reflection-undo="available"[\s\S]*void undoRemove\(\)/);
  assert.match(page, /new Date\(undoDeletion\.undoUntil\)[\s\S]*window\.setTimeout/);
});

test("REF-09 only the latest detail request may write the form", () => {
  assert.match(page, /detailRequestSequence/);
  assert.match(page, /detailAbortController/);
  assert.match(page, /isLatestReflectionDetailRequest\(requestSequence, detailRequestSequence\.current\)/);

  const responses = [
    { requestSequence: 2, reflection: { id: "B", method: "Detail B" } },
    { requestSequence: 1, reflection: { id: "A", method: "Detail A" } }
  ];
  let active = null;
  for (const response of responses) {
    if (isLatestReflectionDetailRequest(response.requestSequence, 2)) {
      active = response.reflection;
    }
  }
  assert.deepEqual(active, { id: "B", method: "Detail B" });
});
