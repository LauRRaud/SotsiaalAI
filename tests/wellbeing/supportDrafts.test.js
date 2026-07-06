import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWellbeingShareableDraft,
  confirmWellbeingOutputDraftForUser,
  createWellbeingOutputDraftForUser,
  listWellbeingOutputDraftsForUser
} from "../../lib/wellbeing/supportDrafts.js";

const quickCheckResult = Object.freeze({
  computedSignal: { signalLevel: "red" },
  loadFactors: ["documentation.high", "interruptions.high"],
  resourceFactors: ["support.unclear_or_missing"],
  riskMarkers: ["risk.difficult_case"],
  recommendedActions: [
    { workflowType: "covision", label: "Valmista kovisiooni sisend" }
  ],
  standardizedFields: {
    workloadLevel: "critical",
    recoveryLevel: "none"
  }
});

function createMockPrisma() {
  const drafts = [];
  return {
    drafts,
    wellbeingOutputDraft: {
      create: async ({ data }) => {
        const row = {
          id: `draft-${drafts.length + 1}`,
          createdAt: new Date("2026-05-26T09:00:00.000Z"),
          updatedAt: new Date("2026-05-26T09:00:00.000Z"),
          ...data
        };
        drafts.push(row);
        return row;
      },
      findMany: async ({ where, orderBy, take }) => {
        const rows = drafts.filter((item) => {
          if (where.userId && item.userId !== where.userId) return false;
          if (where.outputType && item.outputType !== where.outputType) return false;
          if (where.recipientType && item.recipientType !== where.recipientType) return false;
          return true;
        });
        if (orderBy?.createdAt === "desc") rows.reverse();
        return rows.slice(0, take || rows.length);
      },
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const draft of drafts) {
          if (draft.id === where.id && draft.userId === where.userId) {
            Object.assign(draft, data, { updatedAt: new Date("2026-05-26T09:05:00.000Z") });
            count += 1;
          }
        }
        return { count };
      },
      findFirst: async ({ where }) => drafts.find((item) => item.id === where.id && item.userId === where.userId) || null
    }
  };
}

test("buildWellbeingShareableDraft creates an editable private support request without raw fields", () => {
  const draft = buildWellbeingShareableDraft({
    sourceWorkflowType: "quick-check",
    sourceRecordId: "record-1",
    outputType: "covision_input",
    recipientType: "covision",
    context: quickCheckResult
  });

  assert.equal(draft.visibility, "private");
  assert.equal(draft.status, "draft");
  assert.equal(draft.userReviewed, false);
  assert.equal(draft.userConfirmed, false);
  assert.equal(draft.sourceWorkflowType, "quick-check");
  assert.equal(draft.outputType, "covision_input");
  assert.match(draft.generatedText, /Kovisiooni sisend/);
  assert.match(draft.generatedText, /Peamised tööalased koormustegurid/);
  assert.doesNotMatch(draft.generatedText, /standardizedFields/);
  assert.doesNotMatch(draft.generatedText, /workloadLevel/);
});

test("createWellbeingOutputDraftForUser stores a private draft that is not shared automatically", async () => {
  const prisma = createMockPrisma();

  const draft = await createWellbeingOutputDraftForUser("user-1", {
    sourceWorkflowType: "quick-check",
    sourceRecordId: "record-1",
    outputType: "manager_memo",
    recipientType: "manager",
    context: quickCheckResult
  }, { prisma });

  assert.equal(draft.userId, "user-1");
  assert.equal(draft.visibility, "private");
  assert.equal(draft.status, "draft");
  assert.equal(draft.userReviewed, false);
  assert.equal(draft.userConfirmed, false);
});

test("confirmWellbeingOutputDraftForUser requires explicit review and confirmation", async () => {
  const prisma = createMockPrisma();
  const draft = await createWellbeingOutputDraftForUser("user-1", {
    sourceWorkflowType: "quick-check",
    outputType: "support_request",
    recipientType: "pilot_support_contact",
    context: quickCheckResult
  }, { prisma });

  await assert.rejects(
    () => confirmWellbeingOutputDraftForUser("user-1", draft.id, {
      editedText: "Palun arutame töökoormust.",
      userReviewed: true,
      userConfirmed: false
    }, { prisma }),
    /wellbeing.errors.output_review_required/
  );

  const confirmed = await confirmWellbeingOutputDraftForUser("user-1", draft.id, {
    editedText: "Palun arutame töökoormust.",
    userReviewed: true,
    userConfirmed: true
  }, { prisma });

  assert.equal(confirmed.status, "ready_to_share");
  assert.equal(confirmed.visibility, "private");
  assert.equal(confirmed.userReviewed, true);
  assert.equal(confirmed.userConfirmed, true);
  assert.equal(confirmed.editedText, "Palun arutame töökoormust.");
});

test("listWellbeingOutputDraftsForUser only returns the current user's filtered drafts", async () => {
  const prisma = createMockPrisma();
  await createWellbeingOutputDraftForUser("user-1", {
    sourceWorkflowType: "quick-check",
    outputType: "covision_input",
    recipientType: "covision",
    context: quickCheckResult
  }, { prisma });
  await createWellbeingOutputDraftForUser("user-2", {
    sourceWorkflowType: "quick-check",
    outputType: "covision_input",
    recipientType: "covision",
    context: quickCheckResult
  }, { prisma });

  const drafts = await listWellbeingOutputDraftsForUser("user-1", {
    outputType: "covision_input",
    recipientType: "covision"
  }, { prisma });

  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].userId, "user-1");
  assert.equal(drafts[0].outputType, "covision_input");
});
