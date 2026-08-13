import assert from "node:assert/strict";
import test from "node:test";

import {
  createPracticeReflectionForUser,
  listPracticeReflectionsForUser,
  updatePracticeReflectionForUser
} from "../../lib/reflection/records.js";
import { REFLECTION_SOURCE_KINDS } from "../../lib/reflection/constants.js";

function oldShapePrisma(seed = []) {
  const rows = seed.map((row) => ({ ...row }));
  return {
    rows,
    practiceReflection: {
      create: async ({ data }) => {
        const row = {
          id: `reflection_${rows.length + 1}`,
          createdAt: new Date("2026-08-13T10:00:00.000Z"),
          updatedAt: new Date("2026-08-13T10:00:00.000Z"),
          ...data
        };
        rows.push(row);
        return { ...row };
      },
      findFirst: async ({ where = {} }) => rows.find((row) =>
        (where.id === undefined || row.id === where.id)
        && (where.ownerUserId === undefined || row.ownerUserId === where.ownerUserId)
      ) || null,
      findMany: async () => rows.map((row) => ({ ...row })),
      updateMany: async ({ where = {}, data }) => {
        const row = rows.find((candidate) =>
          candidate.id === where.id
          && candidate.ownerUserId === where.ownerUserId
          && (where.updatedAt === undefined || candidate.updatedAt.getTime() === where.updatedAt.getTime())
        );
        if (!row) return { count: 0 };
        Object.assign(row, data, { updatedAt: new Date("2026-08-13T10:01:00.000Z") });
        return { count: 1 };
      }
    },
    preInquiry: { findFirst: async () => ({ id: "pre_1" }) }
  };
}

test("REF-01 requires an expected version and rejects a stale update", async () => {
  const prisma = oldShapePrisma([{
    id: "reflection_1",
    ownerUserId: "user_1",
    method: "Serveri versioon",
    createdAt: new Date("2026-08-13T10:00:00.000Z"),
    updatedAt: new Date("2026-08-13T10:00:00.000Z")
  }]);

  await assert.rejects(
    updatePracticeReflectionForUser("user_1", "reflection_1", { method: "Pime ülekirjutus" }, { prisma }),
    (error) => error.status === 400 && error.message === "reflection.errors.expected_updated_at_required"
  );
  await assert.rejects(
    updatePracticeReflectionForUser("user_1", "reflection_1", {
      method: "Minu mustand",
      expectedUpdatedAt: "2026-08-13T09:59:00.000Z"
    }, { prisma }),
    (error) => error.status === 409 && error.details?.current?.method === "Serveri versioon"
  );
});

test("REF-02 exposes only the source kind with a real product entry point", () => {
  assert.deepEqual(REFLECTION_SOURCE_KINDS, ["PRE_INQUIRY"]);
});

test("REF-03 rejects partial and unknown source filters instead of broadening the query", async () => {
  const prisma = oldShapePrisma([]);
  for (const filters of [
    { sourceKind: "PRE_INQUIRY" },
    { sourceId: "pre_1" },
    { sourceKind: "CALL", sourceId: "call_1" }
  ]) {
    await assert.rejects(
      listPracticeReflectionsForUser("user_1", filters, { prisma }),
      (error) => error.status === 400
    );
  }
  const unfiltered = await listPracticeReflectionsForUser("user_1", {}, { prisma });
  assert.deepEqual(unfiltered.items, []);
});

test("REF-04 list contract returns a cursor page rather than an unpaged array", async () => {
  const prisma = oldShapePrisma([]);
  const result = await listPracticeReflectionsForUser("user_1", {}, { prisma });
  assert.ok(Array.isArray(result.items));
  assert.equal(typeof result.page, "object");
  assert.ok("nextCursor" in result.page);
});

test("REF-05 rejects empty content and requires a replay key", async () => {
  const prisma = oldShapePrisma([]);
  await assert.rejects(
    createPracticeReflectionForUser("user_1", {}, { prisma, idempotencyKey: "request-one" }),
    (error) => error.status === 400 && error.message === "reflection.errors.content_required"
  );
  await assert.rejects(
    createPracticeReflectionForUser("user_1", { method: "Vestlus" }, { prisma }),
    (error) => error.status === 400 && error.message === "reflection.errors.idempotency_key_required"
  );
});
