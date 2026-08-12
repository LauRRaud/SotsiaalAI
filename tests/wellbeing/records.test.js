import assert from "node:assert/strict";
import test from "node:test";

import {
  createHardCaseRecordForUser,
  createInterruptionsRecordForUser,
  createRecoveryRecordForUser,
  createRoleBoundariesRecordForUser,
  createStarterSupportRecordForUser,
  createWorkProcessesRecordForUser,
  createWorkplaceViolenceRecordForUser,
  createWorkBoundariesRecordForUser,
  createQuickCheckRecordForUser,
  listWellbeingRecordsForUser
} from "../../lib/wellbeing/records.js";

const quickCheckFields = {
  workloadLevel: "critical",
  caseComplexityLevel: "complex",
  emotionalLoad: "high",
  documentationLoad: "moderate",
  interruptionsLevel: "moderate",
  recoveryLevel: "none",
  afterHoursImpact: "low",
  decisionControl: "moderate",
  priorityClarity: "clear",
  supportAvailability: "partial",
  covisionNeed: false,
  workBoundaryClarity: "partly_clear",
  difficultCaseMarker: false,
  supportNeed: false
};

test("createQuickCheckRecordForUser stores a private standardized wellbeing record", async () => {
  const calls = [];
  const prisma = {
    wellbeingRecord: {
      findFirst: async () => null,
      create: async (args) => {
        calls.push(args);
        return { id: "rec_1", ...args.data };
      }
    }
  };

  const { record, deduplicated } = await createQuickCheckRecordForUser("user_1", {
    period: "2026-W22",
    roleGroup: "SOCIAL_WORKER",
    visibility: "organization",
    standardizedFields: quickCheckFields
  }, { prisma });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].data.ownerUserId, "user_1");
  assert.equal(calls[0].data.workflowType, "quick-check");
  assert.equal(calls[0].data.visibility, "private");
  assert.equal(calls[0].data.aggregationEligible, true);
  assert.equal(calls[0].data.computedSignal.signalLevel, "red");
  assert.deepEqual(calls[0].data.standardizedFields, quickCheckFields);
  assert.equal(deduplicated, false);
  assert.equal(record.id, "rec_1");
});

test("createQuickCheckRecordForUser rejects missing user and incomplete standardized fields", async () => {
  const prisma = { wellbeingRecord: { create: async () => ({}) } };

  await assert.rejects(
    () => createQuickCheckRecordForUser("", { standardizedFields: quickCheckFields }, { prisma }),
    /wellbeing.errors.unauthorized/
  );
  await assert.rejects(
    () => createQuickCheckRecordForUser("user_1", { standardizedFields: { workloadLevel: "low" } }, { prisma }),
    /wellbeing.errors.invalid_standardized_fields/
  );
});

test("listWellbeingRecordsForUser only lists the current user's private records with supported filters", async () => {
  const calls = [];
  const prisma = {
    wellbeingRecord: {
      findMany: async (args) => {
        calls.push(args);
        return [];
      }
    }
  };

  await listWellbeingRecordsForUser("user_1", {
    workflowType: "quick-check",
    periodStart: "2026-05-01T00:00:00.000Z",
    periodEnd: "2026-06-01T00:00:00.000Z",
    take: 80
  }, { prisma });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].where, {
    ownerUserId: "user_1",
    workflowType: "quick-check",
    createdAt: {
      gte: new Date("2026-05-01T00:00:00.000Z"),
      lt: new Date("2026-06-01T00:00:00.000Z")
    }
  });
  /* SOL-WB-15: üks rida üle küsitud lehe — nii saab „kas on veel" vastuse
     ilma teise päringuta, ja järjestus on totaalne (`id` teisese võtmena),
     muidu hüppaksid sama sekundi read lehtede vahel. */
  assert.equal(calls[0].take, 81);
  assert.deepEqual(calls[0].orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
});

test("createRecoveryRecordForUser stores a private recovery workflow record", async () => {
  const calls = [];
  const prisma = {
    wellbeingRecord: {
      findFirst: async () => null,
      create: async (args) => {
        calls.push(args);
        return { id: "recovery_1", ...args.data };
      }
    }
  };

  const { record, deduplicated } = await createRecoveryRecordForUser("user_1", {
    period: "current",
    roleGroup: "SOCIAL_WORKER",
    standardizedFields: {
      recoveryReason: "heavy_week",
      recoveryLevel: "low",
      workCapacityNext72h: "reduced",
      unavoidableTasks: ["kriitiline juhtumikontakt"],
      deferrableTasks: ["aruande viimistlus"],
      redistributableTasks: ["partneri järelpärimine"],
      primaryLoadFactors: ["documentation"],
      supportNeed: "manager",
      covisionNeed: false,
      nextCheckpoint: "tomorrow"
    }
  }, { prisma });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].data.ownerUserId, "user_1");
  assert.equal(calls[0].data.workflowType, "recovery");
  assert.equal(calls[0].data.scoringVersion, "recovery-v1");
  assert.equal(calls[0].data.visibility, "private");
  assert.equal(calls[0].data.aggregationEligible, true);
  assert.equal(deduplicated, false);
  assert.equal(record.id, "recovery_1");
});

test("createWorkBoundariesRecordForUser stores a private boundary agreement record", async () => {
  const calls = [];
  const prisma = {
    wellbeingRecord: {
      findFirst: async () => null,
      create: async (args) => {
        calls.push(args);
        return { id: "boundaries_1", ...args.data };
      }
    }
  };

  const { record, deduplicated } = await createWorkBoundariesRecordForUser("user_1", {
    period: "current",
    roleGroup: "SOCIAL_WORKER",
    standardizedFields: {
      agreementType: "after_hours_availability",
      currentConcern: "Õhtused sõnumid katkestavad taastumist.",
      boundaryClarity: "unclear",
      afterHoursPressure: "high",
      pauseProtection: "partial",
      replacementCoverage: "unclear",
      urgentExceptionClarity: "unclear",
      counterpart: "manager",
      desiredPrinciple: "Töövälised kontaktid ainult kiire ohu korral.",
      exceptions: "Vahetu ohu olukord.",
      reviewTime: "two_weeks",
      supportNeed: "manager"
    }
  }, { prisma });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].data.ownerUserId, "user_1");
  assert.equal(calls[0].data.workflowType, "work-boundaries");
  assert.equal(calls[0].data.scoringVersion, "work-boundaries-v1");
  assert.equal(calls[0].data.visibility, "private");
  assert.equal(deduplicated, false);
  assert.equal(record.id, "boundaries_1");
});

test("createHardCaseRecordForUser stores a private hard case aftercare record", async () => {
  const calls = [];
  const prisma = {
    wellbeingRecord: {
      findFirst: async () => null,
      create: async (args) => {
        calls.push(args);
        return { id: "hard_case_1", ...args.data };
      }
    }
  };

  const { record, deduplicated } = await createHardCaseRecordForUser("user_1", {
    period: "current",
    roleGroup: "SOCIAL_WORKER",
    standardizedFields: {
      caseType: "emotionally_heavy",
      immediateDanger: "no",
      generalizedDescription: "Keeruline kohtumine, mis vajab järeltegevuse korrastamist.",
      professionalRole: "case_worker",
      mainLoad: "emotional_load",
      ethicalTension: "moderate",
      moralDistress: "some",
      traumaExposure: "indirect",
      roleClarity: "partly_clear",
      shouldNotCarryAlone: true,
      next24hNeeds: ["manager_check_in", "document_key_facts"],
      covisionNeed: true,
      recoveryNeed: "partial"
    }
  }, { prisma });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].data.ownerUserId, "user_1");
  assert.equal(calls[0].data.workflowType, "hard-case");
  assert.equal(calls[0].data.scoringVersion, "hard-case-v1");
  assert.equal(calls[0].data.visibility, "private");
  assert.equal(calls[0].data.aggregationEligible, true);
  assert.equal(deduplicated, false);
  assert.equal(record.id, "hard_case_1");
});

test("createWorkplaceViolenceRecordForUser stores a private workplace violence safety record", async () => {
  const calls = [];
  const prisma = {
    wellbeingRecord: {
      findFirst: async () => null,
      create: async (args) => {
        calls.push(args);
        return { id: "violence_1", ...args.data };
      }
    }
  };

  const { record, deduplicated } = await createWorkplaceViolenceRecordForUser("user_1", {
    period: "current",
    roleGroup: "SOCIAL_WORKER",
    standardizedFields: {
      violenceType: "threat",
      dangerStatus: "uncertain",
      generalizedDescription: "Tööalane ähvardav suhtlus vajab neutraalset järelkirjeldust.",
      locationOrChannel: "phone",
      documentedStatus: "partial",
      workImpact: "high",
      safetyImpact: "high",
      nextStepNeed: "safety_followup",
      safetyAgreementNeed: "yes",
      covisionNeed: true,
      recoveryNeed: "high"
    }
  }, { prisma });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].data.ownerUserId, "user_1");
  assert.equal(calls[0].data.workflowType, "workplace-violence");
  assert.equal(calls[0].data.scoringVersion, "workplace-violence-v1");
  assert.equal(calls[0].data.visibility, "private");
  assert.equal(calls[0].data.aggregationEligible, true);
  assert.equal(deduplicated, false);
  assert.equal(record.id, "violence_1");
});

test("createInterruptionsRecordForUser stores a private interruptions workflow record", async () => {
  const calls = [];
  const prisma = {
    wellbeingRecord: {
      findFirst: async () => null,
      create: async (args) => {
        calls.push(args);
        return { id: "interruptions_1", ...args.data };
      }
    }
  };

  const { record, deduplicated } = await createInterruptionsRecordForUser("user_1", {
    period: "current",
    roleGroup: "SOCIAL_WORKER",
    standardizedFields: {
      interruptionClass: "negotiable",
      sources: ["phone", "colleague_questions"],
      frequency: "often",
      workImpact: "moderate",
      immediateResponseNeed: "partial",
      canWait: "many",
      neededAgreement: "focus_time",
      counterpart: "team",
      wrongChannelShare: "some",
      documentationInterruption: false,
      recoveryImpact: "some"
    }
  }, { prisma });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].data.ownerUserId, "user_1");
  assert.equal(calls[0].data.workflowType, "interruptions");
  assert.equal(calls[0].data.scoringVersion, "interruptions-v1");
  assert.equal(calls[0].data.visibility, "private");
  assert.equal(calls[0].data.aggregationEligible, true);
  assert.equal(deduplicated, false);
  assert.equal(record.id, "interruptions_1");
});

test("createWorkProcessesRecordForUser stores a private work processes workflow record", async () => {
  const calls = [];
  const prisma = {
    wellbeingRecord: {
      findFirst: async () => null,
      create: async (args) => {
        calls.push(args);
        return { id: "work_processes_1", ...args.data };
      }
    }
  };

  const { record, deduplicated } = await createWorkProcessesRecordForUser("user_1", {
    period: "current",
    roleGroup: "SOCIAL_WORKER",
    standardizedFields: {
      analysisFocus: "documentation_flow",
      categories: ["documentation", "duplicate_entry"],
      timeCostSources: ["same_data_multiple_places", "manual_status_updates"],
      lowValueActivities: ["manual_copying"],
      informationBlockers: ["unclear_owner"],
      unfinishedWork: ["case_notes"],
      simplificationNeeds: ["single_entry"],
      documentationDuplication: "high",
      switchingLoad: "moderate",
      processImpact: "high",
      counterpart: "manager"
    }
  }, { prisma });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].data.ownerUserId, "user_1");
  assert.equal(calls[0].data.workflowType, "work-processes");
  assert.equal(calls[0].data.scoringVersion, "work-processes-v1");
  assert.equal(calls[0].data.visibility, "private");
  assert.equal(calls[0].data.aggregationEligible, true);
  assert.equal(deduplicated, false);
  assert.equal(record.id, "work_processes_1");
});

test("createRoleBoundariesRecordForUser stores a private role boundaries workflow record", async () => {
  const calls = [];
  const prisma = {
    wellbeingRecord: {
      findFirst: async () => null,
      create: async (args) => {
        calls.push(args);
        return { id: "role_boundaries_1", ...args.data };
      }
    }
  };

  const { record, deduplicated } = await createRoleBoundariesRecordForUser("user_1", {
    period: "current",
    roleGroup: "SOCIAL_WORKER",
    standardizedFields: {
      expectationSource: "client_family",
      expectedAction: "solve_partner_delay",
      myRole: "case_worker",
      outsideRole: "make_other_agency_decision",
      neededResponsibility: "partner_agency",
      roleConflict: "high",
      partnerExplanationNeed: true,
      managerDiscussionNeed: true,
      availabilityPressure: "high",
      ethicalComplexity: "moderate",
      counterpart: "partner"
    }
  }, { prisma });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].data.ownerUserId, "user_1");
  assert.equal(calls[0].data.workflowType, "role-boundaries");
  assert.equal(calls[0].data.scoringVersion, "role-boundaries-v1");
  assert.equal(calls[0].data.visibility, "private");
  assert.equal(calls[0].data.aggregationEligible, true);
  assert.equal(deduplicated, false);
  assert.equal(record.id, "role_boundaries_1");
});

test("createStarterSupportRecordForUser stores a private starter support workflow record", async () => {
  const calls = [];
  const prisma = {
    wellbeingRecord: {
      findFirst: async () => null,
      create: async (args) => {
        calls.push(args);
        return { id: "starter_support_1", ...args.data };
      }
    }
  };

  const { record, deduplicated } = await createStarterSupportRecordForUser("user_1", {
    period: "current",
    roleGroup: "SOCIAL_WORKER",
    standardizedFields: {
      experienceStage: "first_month",
      roleArea: "child_protection",
      unclearTopics: ["role_boundaries", "documentation"],
      existingSupport: ["manager_check_in"],
      missingSupport: ["mentor", "covision"],
      casesNotCarryAlone: ["complex_family_case"],
      covisionNeedSigns: ["ethical_tension"],
      mentorDiscussionNeed: true,
      managerDiscussionNeed: true,
      workBoundaryNeed: true,
      supportUrgency: "soon"
    }
  }, { prisma });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].data.ownerUserId, "user_1");
  assert.equal(calls[0].data.workflowType, "starter-support");
  assert.equal(calls[0].data.scoringVersion, "starter-support-v1");
  assert.equal(calls[0].data.visibility, "private");
  assert.equal(calls[0].data.aggregationEligible, true);
  assert.equal(deduplicated, false);
  assert.equal(record.id, "starter_support_1");
});

/* ---- E0.3: salvestuse idempotentsus (dedupe-aken + advisory-lock) ---- */

function createDedupeStore() {
  const store = [];
  const recordApi = {
    findFirst: async (args) => {
      const gte = args?.where?.createdAt?.gte ?? new Date(0);
      return store
        .filter((row) => row.ownerUserId === args?.where?.ownerUserId
          && row.workflowType === args?.where?.workflowType
          && row.createdAt >= gte)
        .sort((a, b) => b.createdAt - a.createdAt)[0] || null;
    },
    create: async (args) => {
      const row = { id: `rec_${store.length + 1}`, createdAt: new Date(), ...args.data };
      store.push(row);
      return row;
    }
  };
  return { store, recordApi };
}

test("saving the same quick check twice in a row returns the first record (double click)", async () => {
  const { store, recordApi } = createDedupeStore();
  const prisma = { wellbeingRecord: recordApi };
  const payload = { period: "current", roleGroup: "SOCIAL_WORKER", standardizedFields: quickCheckFields };

  const first = await createQuickCheckRecordForUser("user_1", payload, { prisma });
  const second = await createQuickCheckRecordForUser("user_1", payload, { prisma });

  assert.equal(first.deduplicated, false);
  assert.equal(second.deduplicated, true);
  assert.equal(second.record.id, first.record.id);
  assert.equal(store.length, 1);
});

test("parallel identical saves are serialized by the advisory lock and create one record", async () => {
  const { store, recordApi } = createDedupeStore();
  let locked = false;
  const waiters = [];
  const tx = {
    wellbeingRecord: recordApi,
    $executeRaw: async () => undefined
  };
  const prisma = {
    wellbeingRecord: recordApi,
    $transaction: async (fn) => {
      while (locked) await new Promise((resolve) => waiters.push(resolve));
      locked = true;
      try {
        return await fn(tx);
      } finally {
        locked = false;
        const next = waiters.shift();
        if (next) next();
      }
    }
  };
  const payload = { period: "current", roleGroup: "SOCIAL_WORKER", standardizedFields: quickCheckFields };

  const [a, b] = await Promise.all([
    createQuickCheckRecordForUser("user_1", payload, { prisma }),
    createQuickCheckRecordForUser("user_1", payload, { prisma })
  ]);

  assert.equal(store.length, 1);
  assert.equal(a.record.id, b.record.id);
  assert.equal([a.deduplicated, b.deduplicated].filter(Boolean).length, 1);
});

test("the dedupe window never returns another user's record", async () => {
  const { store, recordApi } = createDedupeStore();
  const prisma = { wellbeingRecord: recordApi };
  const payload = { period: "current", roleGroup: "SOCIAL_WORKER", standardizedFields: quickCheckFields };

  const first = await createQuickCheckRecordForUser("user_1", payload, { prisma });
  const second = await createQuickCheckRecordForUser("user_2", payload, { prisma });

  assert.equal(second.deduplicated, false);
  assert.notEqual(second.record.id, first.record.id);
  assert.equal(second.record.ownerUserId, "user_2");
  assert.equal(store.length, 2);
});

test("a changed answer within the window creates a new record", async () => {
  const { store, recordApi } = createDedupeStore();
  const prisma = { wellbeingRecord: recordApi };

  const first = await createQuickCheckRecordForUser("user_1", {
    period: "current",
    roleGroup: "SOCIAL_WORKER",
    standardizedFields: quickCheckFields
  }, { prisma });
  const second = await createQuickCheckRecordForUser("user_1", {
    period: "current",
    roleGroup: "SOCIAL_WORKER",
    standardizedFields: { ...quickCheckFields, workloadLevel: "moderate" }
  }, { prisma });

  assert.equal(second.deduplicated, false);
  assert.notEqual(second.record.id, first.record.id);
  assert.equal(store.length, 2);
});

test("an identical save after the dedupe window creates a new record", async () => {
  const { store, recordApi } = createDedupeStore();
  const prisma = { wellbeingRecord: recordApi };
  const payload = { period: "current", roleGroup: "SOCIAL_WORKER", standardizedFields: quickCheckFields };

  const first = await createQuickCheckRecordForUser("user_1", payload, { prisma });
  store[0].createdAt = new Date(Date.now() - 31_000);
  const second = await createQuickCheckRecordForUser("user_1", payload, { prisma });

  assert.equal(second.deduplicated, false);
  assert.notEqual(second.record.id, first.record.id);
  assert.equal(store.length, 2);
});
