import assert from "node:assert/strict";
import test from "node:test";

import {
  createPracticeReflectionForUser,
  deletePracticeReflectionForUser,
  getPracticeReflectionForUser,
  listPracticeReflectionsForUser,
  updatePracticeReflectionForUser
} from "../../lib/reflection/records.js";
import {
  INTERIM_OUTCOME,
  REFLECTION_FIELD_PROVENANCE,
  REFLECTION_TEXT_MAX_LENGTH,
  SUPPORT_NEED
} from "../../lib/reflection/constants.js";
import { PROVENANCE } from "../../lib/workspaces/provenance.js";

/* Fake-prisma pood samas stiilis mis tests/wellbeing/recordsRead.test.js:
   elus massiiv, omanik-skoop where-filtriga. */
function createStore(seed = []) {
  const rows = seed.map((row) => ({ ...row }));
  let nextId = 1;
  const matches = (row, where = {}) =>
    (where.id === undefined || row.id === where.id)
    && (where.ownerUserId === undefined || row.ownerUserId === where.ownerUserId)
    && (where.sourceKind === undefined || row.sourceKind === where.sourceKind)
    && (where.sourceId === undefined || row.sourceId === where.sourceId);

  const practiceReflection = {
    create: async ({ data }) => {
      const row = {
        id: `pr_${nextId++}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data
      };
      rows.push(row);
      return { ...row };
    },
    findFirst: async ({ where = {}, orderBy, select } = {}) => {
      let candidates = rows.filter((row) => matches(row, where));
      if (orderBy?.updatedAt === "desc") {
        candidates = candidates.sort((a, b) => b.updatedAt - a.updatedAt);
      }
      const row = candidates[0] || null;
      if (!row) return null;
      if (select?.updatedAt) return { updatedAt: row.updatedAt };
      return { ...row };
    },
    findMany: async ({ where = {}, take } = {}) => {
      const found = rows.filter((row) => matches(row, where));
      return (take ? found.slice(0, take) : found).map((row) => ({ ...row }));
    },
    updateMany: async ({ where = {}, data }) => {
      let count = 0;
      for (const row of rows) {
        if (matches(row, where)) {
          Object.assign(row, data, { updatedAt: new Date() });
          count += 1;
        }
      }
      return { count };
    },
    deleteMany: async ({ where = {} }) => {
      let count = 0;
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        if (matches(rows[index], where)) {
          rows.splice(index, 1);
          count += 1;
        }
      }
      return { count };
    }
  };

  const agentArtifact = {
    findFirst: async ({ where = {} }) =>
      rows.artifacts?.find?.((row) => row.id === where.id && row.ownerId === where.ownerId) || null
  };

  const store = { rows, prisma: { practiceReflection, agentArtifact, preInquiry: { findFirst: async () => null } } };
  return store;
}

test("create validates enums and rejects unknown interim outcome / support need", async () => {
  const { prisma } = createStore();
  await assert.rejects(
    createPracticeReflectionForUser("user_1", { interimOutcome: "SCORE_9" }, { prisma }),
    (error) => error.status === 400 && error.message === "reflection.errors.invalid_interim_outcome"
  );
  await assert.rejects(
    createPracticeReflectionForUser("user_1", { supportNeed: "MANAGER_REVIEW" }, { prisma }),
    (error) => error.status === 400 && error.message === "reflection.errors.invalid_support_need"
  );
  const { reflection } = await createPracticeReflectionForUser("user_1", {
    method: "Motiveeriv intervjueerimine",
    interimOutcome: INTERIM_OUTCOME.NEEDS_TIME,
    supportNeed: SUPPORT_NEED.COVISION
  }, { prisma });
  assert.equal(reflection.ownerUserId, "user_1");
  assert.equal(reflection.interimOutcome, "NEEDS_TIME");
});

test("create rejects overlong text and unknown source kind; unknown payload keys never persist", async () => {
  const { prisma } = createStore();
  await assert.rejects(
    createPracticeReflectionForUser("user_1", { method: "x".repeat(REFLECTION_TEXT_MAX_LENGTH + 1) }, { prisma }),
    (error) => error.status === 400 && error.message === "reflection.errors.field_too_long"
  );
  await assert.rejects(
    createPracticeReflectionForUser("user_1", { sourceKind: "CHAT_LOG", sourceId: "x1" }, { prisma }),
    (error) => error.status === 400 && error.message === "reflection.errors.invalid_source_kind"
  );
  /* PRIVATE on invariant: ka pahatahtlik payload ei saa kirjele jagamis- ega
     nähtavusvälja külge kirjutada — tundmatud võtmed ei kandu andmebaasi. */
  const { reflection } = await createPracticeReflectionForUser("user_1", {
    method: "Võrgustikutöö",
    visibility: "SHARED",
    sharedWith: ["user_2"],
    score: 9
  }, { prisma });
  assert.equal("visibility" in reflection, false);
  assert.equal("sharedWith" in reflection, false);
  assert.equal("score" in reflection, false);
});

test("list and get are owner-scoped; a foreign id yields null without leaking existence", async () => {
  const { prisma } = createStore();
  await createPracticeReflectionForUser("user_1", { method: "A" }, { prisma });
  await createPracticeReflectionForUser("user_2", { method: "B" }, { prisma });

  const mine = await listPracticeReflectionsForUser("user_1", {}, { prisma });
  assert.equal(mine.length, 1);
  assert.equal(mine[0].method, "A");

  const theirs = await listPracticeReflectionsForUser("user_2", {}, { prisma });
  const foreign = await getPracticeReflectionForUser("user_1", theirs[0].id, { prisma });
  assert.equal(foreign, null);
});

test("update is owner-scoped, source ref is immutable, empty update rejected", async () => {
  const { prisma } = createStore();
  const { reflection } = await createPracticeReflectionForUser("user_1", {
    method: "A",
    sourceKind: "PRE_INQUIRY",
    sourceId: "pi_1"
  }, { prisma });

  await assert.rejects(
    updatePracticeReflectionForUser("user_2", reflection.id, { method: "Kaaperdatud" }, { prisma }),
    (error) => error.status === 404
  );
  await assert.rejects(
    updatePracticeReflectionForUser("user_1", reflection.id, { sourceKind: "CALL", sourceId: "c1" }, { prisma }),
    (error) => error.status === 400 && error.message === "reflection.errors.source_ref_immutable"
  );
  await assert.rejects(
    updatePracticeReflectionForUser("user_1", reflection.id, {}, { prisma }),
    (error) => error.status === 400 && error.message === "reflection.errors.empty_update"
  );

  const { reflection: updated } = await updatePracticeReflectionForUser(
    "user_1",
    reflection.id,
    { whatWorked: "Avatud küsimused", interimOutcome: INTERIM_OUTCOME.CONTINUE_ADAPTED },
    { prisma }
  );
  assert.equal(updated.whatWorked, "Avatud küsimused");
  assert.equal(updated.sourceKind, "PRE_INQUIRY");
});

test("delete is owner-scoped: foreign delete reports not-deleted and the row survives", async () => {
  const { prisma } = createStore();
  const { reflection } = await createPracticeReflectionForUser("user_1", { method: "A" }, { prisma });

  const foreign = await deletePracticeReflectionForUser("user_2", reflection.id, { prisma });
  assert.equal(foreign.deleted, false);
  const stillThere = await getPracticeReflectionForUser("user_1", reflection.id, { prisma });
  assert.equal(stillThere?.id, reflection.id);

  const own = await deletePracticeReflectionForUser("user_1", reflection.id, { prisma });
  assert.equal(own.deleted, true);
});

test("record keeps living when its source is gone: sourceState marks deletion, record stays readable", async () => {
  const { prisma } = createStore();
  const { reflection } = await createPracticeReflectionForUser("user_1", {
    method: "A",
    sourceKind: "PRE_INQUIRY",
    sourceId: "pi_gone"
  }, { prisma });

  const detail = await getPracticeReflectionForUser("user_1", reflection.id, { prisma });
  assert.equal(detail.sourceState, "deleted");
  assert.equal(detail.method, "A");
});

test("field-level provenance mapping is locked to the shared K2 dictionary", () => {
  /* Strukturaalne päritolu (doc ptk 3.3): kliendi-öeldud ≠ töötaja-tähelepanek
     ≠ tõlgendus. Kaardistuse muutmine PEAB selle testi kukutama. */
  assert.deepEqual(REFLECTION_FIELD_PROVENANCE, {
    clientGoal: PROVENANCE.KLIENDI_OELDUD,
    clientReaction: PROVENANCE.KLIENDI_OELDUD,
    workerObservation: PROVENANCE.TOOTAJA_TAHELEPANEK,
    interpretation: PROVENANCE.TOOTAJA_TOLGENDUS
  });
});
