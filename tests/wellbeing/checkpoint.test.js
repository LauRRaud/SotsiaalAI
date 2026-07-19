import assert from "node:assert/strict";
import test from "node:test";

import {
  CHECKPOINT_FOLLOW_UP_STATES,
  clearWellbeingCheckpointForUser,
  describeWellbeingCheckpoint,
  listDueWellbeingCheckpoints,
  markWellbeingRecommendationForUser,
  recordWellbeingCheckpointFollowUpForUser,
  setWellbeingCheckpointForUser
} from "../../lib/wellbeing/checkpoint.js";
import { createWellbeingRecordCorrectionForUser } from "../../lib/wellbeing/records.js";

function createLiveStore(seed = []) {
  const rows = seed.map((row) => ({ ...row }));
  let sequence = 0;

  function matches(row, where = {}) {
    if (where.id !== undefined && row.id !== where.id) return false;
    if (where.ownerUserId !== undefined && row.ownerUserId !== where.ownerUserId) return false;
    if (where.checkpointDueOn !== undefined) {
      const filter = where.checkpointDueOn;
      if (!row.checkpointDueOn) return false;
      if (filter.lte && new Date(row.checkpointDueOn) > filter.lte) return false;
    }
    return true;
  }

  const wellbeingRecord = {
    findFirst: async ({ where = {}, include = {} } = {}) => {
      const row = rows.find((candidate) => matches(candidate, where)) || null;
      if (!row || !include.supersededBy) return row ? { ...row } : null;
      const corrector = rows.find((candidate) => candidate.supersedesRecordId === row.id) || null;
      return { ...row, supersededBy: corrector ? { id: corrector.id } : null };
    },
    findMany: async ({ where = {} } = {}) => rows.filter((row) => matches(row, where)).map((row) => ({ ...row })),
    updateMany: async ({ where, data }) => {
      let count = 0;
      for (const row of rows) {
        if (matches(row, where)) {
          Object.assign(row, data);
          count += 1;
        }
      }
      return { count };
    },
    update: async ({ where, data }) => {
      const row = rows.find((candidate) => candidate.id === where.id);
      if (!row) throw new Error("row not found");
      Object.assign(row, data);
      return { ...row };
    },
    create: async ({ data }) => {
      sequence += 1;
      const row = { id: `rec_new_${sequence}`, createdAt: new Date("2026-07-20T09:00:00.000Z"), ...data };
      rows.push(row);
      return { ...row };
    }
  };

  return { rows, prisma: { wellbeingRecord } };
}

function storedRecord(id, ownerUserId, overrides = {}) {
  return {
    id,
    ownerUserId,
    workflowType: "quick-check",
    period: "2026-W29",
    roleGroup: "child_protection",
    visibility: "private",
    aggregationEligible: true,
    standardizedFields: {},
    computedSignal: { signalLevel: "yellow" },
    loadFactors: [],
    resourceFactors: [],
    riskMarkers: [],
    recommendedActions: [{ workflowType: "recovery", label: "x", reason: "y" }],
    supersedesRecordId: null,
    checkpointDueOn: null,
    checkpoint: null,
    createdAt: new Date("2026-07-10T09:00:00.000Z"),
    ...overrides
  };
}

test("setting a checkpoint is owner-scoped and stores the plan beside the answers", async () => {
  const { rows, prisma } = createLiveStore([
    storedRecord("rec_mine", "user_1"),
    storedRecord("rec_theirs", "user_2")
  ]);

  await assert.rejects(
    () => setWellbeingCheckpointForUser("user_1", "rec_theirs", {
      nextStep: "Räägin juhiga koormusest",
      dueOn: "2026-07-27T09:00:00.000Z"
    }, { prisma }),
    /wellbeing.errors.record_missing/,
    "võõras kirje annab sama vea mis olematu"
  );

  await setWellbeingCheckpointForUser("user_1", "rec_mine", {
    nextStep: "Räägin juhiga koormusest",
    dueOn: "2026-07-27T09:00:00.000Z"
  }, { prisma });

  const mine = rows.find((row) => row.id === "rec_mine");
  assert.equal(mine.checkpoint.nextStep, "Räägin juhiga koormusest");
  assert.equal(mine.checkpoint.followUp, null);
  assert.deepEqual(mine.standardizedFields, {}, "plaan ei tohi vastuste plokki puutuda");

  const theirs = rows.find((row) => row.id === "rec_theirs");
  assert.equal(theirs.checkpoint, null, "ebaõnnestunud kirjutus ei muuda võõrast kirjet");
});

test("a new plan clears the previous follow-up answer", async () => {
  const { rows, prisma } = createLiveStore([storedRecord("rec_a", "user_1")]);

  await setWellbeingCheckpointForUser("user_1", "rec_a", {
    nextStep: "Esimene plaan",
    dueOn: "2026-07-20T09:00:00.000Z"
  }, { prisma });
  await recordWellbeingCheckpointFollowUpForUser("user_1", "rec_a", { state: "kept" }, { prisma });
  assert.equal(rows[0].checkpoint.followUp.state, "kept");

  await setWellbeingCheckpointForUser("user_1", "rec_a", {
    nextStep: "Teine plaan",
    dueOn: "2026-08-03T09:00:00.000Z"
  }, { prisma });

  assert.equal(rows[0].checkpoint.nextStep, "Teine plaan");
  assert.equal(rows[0].checkpoint.followUp, null,
    "vana vastus ei tohi uue kokkuleppe külge jääda");
});

test("checkpoint input is validated before anything is written", async () => {
  const { rows, prisma } = createLiveStore([storedRecord("rec_a", "user_1")]);

  await assert.rejects(
    () => setWellbeingCheckpointForUser("user_1", "rec_a", { nextStep: "  ", dueOn: "2026-07-27" }, { prisma }),
    /wellbeing.errors.checkpoint_step_missing/
  );
  await assert.rejects(
    () => setWellbeingCheckpointForUser("user_1", "rec_a", { nextStep: "ok", dueOn: "eile" }, { prisma }),
    /wellbeing.errors.checkpoint_due_invalid/
  );
  await assert.rejects(
    () => setWellbeingCheckpointForUser("user_1", "rec_a", {
      nextStep: "x".repeat(501),
      dueOn: "2026-07-27T09:00:00.000Z"
    }, { prisma }),
    /wellbeing.errors.checkpoint_step_too_long/
  );

  assert.equal(rows[0].checkpoint, null, "vigane sisend ei kirjuta midagi");
});

test("follow-up accepts only the three honest states and needs an existing checkpoint", async () => {
  const { prisma } = createLiveStore([storedRecord("rec_a", "user_1")]);

  assert.deepEqual([...CHECKPOINT_FOLLOW_UP_STATES], ["kept", "not_kept", "unclear"]);

  await assert.rejects(
    () => recordWellbeingCheckpointFollowUpForUser("user_1", "rec_a", { state: "kept" }, { prisma }),
    /wellbeing.errors.checkpoint_missing/,
    "ilma kokkuleppeta ei ole millegi kohta vastata"
  );

  await setWellbeingCheckpointForUser("user_1", "rec_a", {
    nextStep: "Plaan",
    dueOn: "2026-07-20T09:00:00.000Z"
  }, { prisma });

  await assert.rejects(
    () => recordWellbeingCheckpointFollowUpForUser("user_1", "rec_a", { state: "streak_broken" }, { prisma }),
    /wellbeing.errors.checkpoint_follow_up_invalid/
  );

  for (const state of CHECKPOINT_FOLLOW_UP_STATES) {
    await recordWellbeingCheckpointFollowUpForUser("user_1", "rec_a", { state }, { prisma });
  }
});

test("clearing a checkpoint removes both the date and the plan", async () => {
  const { rows, prisma } = createLiveStore([storedRecord("rec_a", "user_1")]);
  await setWellbeingCheckpointForUser("user_1", "rec_a", {
    nextStep: "Plaan",
    dueOn: "2026-07-27T09:00:00.000Z"
  }, { prisma });

  await clearWellbeingCheckpointForUser("user_1", "rec_a", { prisma });
  assert.equal(rows[0].checkpoint, null);
  assert.equal(rows[0].checkpointDueOn, null);
});

/* Badge tähendab „siin ootab sinu vastus", MITTE „sa oled hiljaks jäänud".
   Tulevikus olev kokkulepe ei tohi märki tekitada, vastatud kokkulepe samuti
   mitte — vahelejätmine on võrdväärne tulemus (W-INV-4). */
test("a checkpoint only asks for an answer once it is due and still unanswered", () => {
  const now = new Date("2026-07-25T09:00:00.000Z");

  const none = describeWellbeingCheckpoint(storedRecord("r", "u"), now);
  assert.equal(none.hasCheckpoint, false);
  assert.equal(none.needsFollowUp, false);

  const future = describeWellbeingCheckpoint(storedRecord("r", "u", {
    checkpointDueOn: new Date("2026-08-01T09:00:00.000Z"),
    checkpoint: { nextStep: "Plaan", followUp: null }
  }), now);
  assert.equal(future.isDue, false);
  assert.equal(future.needsFollowUp, false, "tulevane kokkulepe ei nõua veel midagi");

  const due = describeWellbeingCheckpoint(storedRecord("r", "u", {
    checkpointDueOn: new Date("2026-07-20T09:00:00.000Z"),
    checkpoint: { nextStep: "Plaan", followUp: null }
  }), now);
  assert.equal(due.needsFollowUp, true);

  const answered = describeWellbeingCheckpoint(storedRecord("r", "u", {
    checkpointDueOn: new Date("2026-07-20T09:00:00.000Z"),
    checkpoint: { nextStep: "Plaan", followUp: { state: "not_kept" } }
  }), now);
  assert.equal(answered.needsFollowUp, false,
    "vastus 'ei pidanud' on samuti vastus, mitte võlg — märk kaob");
});

test("the due-checkpoint source skips answered and future checkpoints", async () => {
  const now = new Date("2026-07-25T09:00:00.000Z");
  const { prisma } = createLiveStore([
    storedRecord("rec_due", "user_1", {
      checkpointDueOn: new Date("2026-07-20T09:00:00.000Z"),
      checkpoint: { nextStep: "Plaan", followUp: null }
    }),
    storedRecord("rec_answered", "user_2", {
      checkpointDueOn: new Date("2026-07-21T09:00:00.000Z"),
      checkpoint: { nextStep: "Plaan", followUp: { state: "kept" } }
    }),
    storedRecord("rec_future", "user_3", {
      checkpointDueOn: new Date("2026-08-10T09:00:00.000Z"),
      checkpoint: { nextStep: "Plaan", followUp: null }
    }),
    storedRecord("rec_none", "user_4")
  ]);

  const due = await listDueWellbeingCheckpoints({ prisma, now });
  assert.deepEqual(due.map((row) => row.id), ["rec_due"]);
});

test("marking a recommendation done is reversible and leaves other actions alone", async () => {
  const { rows, prisma } = createLiveStore([storedRecord("rec_a", "user_1", {
    recommendedActions: [
      { workflowType: "recovery", label: "a", reason: "b" },
      { workflowType: "interruptions", label: "c", reason: "d" }
    ]
  })]);

  await markWellbeingRecommendationForUser("user_1", "rec_a", { workflowType: "recovery" }, { prisma });
  const [recovery, interruptions] = rows[0].recommendedActions;
  assert.ok(recovery.doneAt, "märgitud soovitus kannab aega");
  assert.equal(interruptions.doneAt, undefined, "teine soovitus jääb puutumata");

  await markWellbeingRecommendationForUser("user_1", "rec_a", { workflowType: "recovery", done: false }, { prisma });
  assert.equal(rows[0].recommendedActions[0].doneAt, undefined, "märke saab tagasi võtta");
  assert.equal(rows[0].recommendedActions[0].label, "a", "tagasivõtmine ei kaota soovituse sisu");

  await assert.rejects(
    () => markWellbeingRecommendationForUser("user_1", "rec_a", { workflowType: "puudub" }, { prisma }),
    /wellbeing.errors.recommendation_not_found/
  );
});

/* Kaks viilu peavad kokku klappima: parandus kirjeldab sama hetke, seega ka
   sama kokkulepet. Kui plaan ei tuleks kaasa, kaoks badge iga paranduse peale. */
test("a correction inherits the checkpoint of the record it corrects", async () => {
  const { prisma } = createLiveStore([storedRecord("rec_a", "user_1", {
    checkpointDueOn: new Date("2026-07-27T09:00:00.000Z"),
    checkpoint: { nextStep: "Räägin juhiga", setAt: "2026-07-10T09:00:00.000Z", followUp: null },
    standardizedFields: {
      workloadLevel: "high",
      caseComplexityLevel: "moderate",
      emotionalLoad: "moderate",
      documentationLoad: "moderate",
      interruptionsLevel: "moderate",
      recoveryLevel: "partial",
      afterHoursImpact: "low",
      decisionControl: "moderate",
      priorityClarity: "clear",
      supportAvailability: "available",
      covisionNeed: false,
      workBoundaryClarity: "clear",
      difficultCaseMarker: false,
      supportNeed: false
    }
  })]);

  const { record } = await createWellbeingRecordCorrectionForUser("user_1", "rec_a", {
    standardizedFields: {
      workloadLevel: "moderate",
      caseComplexityLevel: "moderate",
      emotionalLoad: "moderate",
      documentationLoad: "moderate",
      interruptionsLevel: "moderate",
      recoveryLevel: "partial",
      afterHoursImpact: "low",
      decisionControl: "moderate",
      priorityClarity: "clear",
      supportAvailability: "available",
      covisionNeed: false,
      workBoundaryClarity: "clear",
      difficultCaseMarker: false,
      supportNeed: false
    }
  }, { prisma });

  assert.equal(record.checkpoint.nextStep, "Räägin juhiga", "plaan tuleb parandusega kaasa");
  assert.ok(record.checkpointDueOn, "kontrollkuupäev tuleb parandusega kaasa");
});
