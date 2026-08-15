import assert from "node:assert/strict";
import test from "node:test";

import { runPracticeReflectionRetention } from "../../lib/reflection/retention.js";

test("retention rechecks and purges an active null-deadline reflection after cancellation", async () => {
  const candidate = {
    id: "reflection-null-deadline",
    ownerUserId: "owner-cancelled",
    retentionState: "ACTIVE",
    retentionDeadline: null,
    undoUntil: null
  };
  let candidateQuery;
  let deleteQuery;
  const prisma = {
    practiceReflectionRetentionRun: {
      create: async () => ({ id: "run-1" }),
      update: async () => ({ id: "run-1" })
    },
    practiceReflection: {
      findMany: async (args) => {
        candidateQuery = args;
        return [candidate];
      },
      deleteMany: async (args) => {
        deleteQuery = args;
        return { count: 1 };
      },
      updateMany: async () => ({ count: 0 })
    },
    subscription: {
      findMany: async () => []
    }
  };

  const result = await runPracticeReflectionRetention({
    prisma,
    now: new Date("2026-08-15T12:00:00.000Z")
  });

  assert.equal(result.purged, 1);
  assert.deepEqual(candidateQuery.where.OR[1], {
    retentionState: "ACTIVE",
    OR: [
      { retentionDeadline: null },
      { retentionDeadline: { lte: new Date("2026-08-15T12:00:00.000Z") } }
    ]
  });
  assert.deepEqual(deleteQuery.where, {
    id: candidate.id,
    retentionState: "ACTIVE",
    OR: [
      { retentionDeadline: null },
      { retentionDeadline: { lte: new Date("2026-08-15T12:00:00.000Z") } }
    ]
  });
});
