import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWellbeingShareableDraft,
  confirmWellbeingOutputDraftForUser,
  createWellbeingOutputDraftForUser,
  listWellbeingOutputDraftsForUser,
  saveWellbeingOutputDraftForUser
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
  const prisma = {
    drafts,
    locks: 0,
    $transaction: async (callback) => callback(prisma),
    $executeRaw: async () => {
      prisma.locks += 1;
      return 1;
    },
    wellbeingOutputDraft: {
      create: async ({ data }) => {
        const row = {
          id: `draft-${drafts.length + 1}`,
          createdAt: new Date("2026-05-26T09:00:00.000Z"),
          updatedAt: new Date("2026-05-26T09:00:00.000Z"),
          covisionCaseId: null,
          handedOffAt: null,
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
          if (
            draft.id === where.id
            && draft.userId === where.userId
            && (where.covisionCaseId === undefined || draft.covisionCaseId === where.covisionCaseId)
            && (where.updatedAt === undefined
              || new Date(draft.updatedAt).getTime() === new Date(where.updatedAt).getTime())
          ) {
            Object.assign(draft, data, { updatedAt: new Date("2026-05-26T09:05:00.000Z") });
            count += 1;
          }
        }
        return { count };
      },
      findFirst: async ({ where }) => drafts.find((item) => item.id === where.id && item.userId === where.userId) || null
    }
  };
  return prisma;
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
      userConfirmed: false,
      expectedUpdatedAt: draft.updatedAt.toISOString()
    }, { prisma }),
    /wellbeing.errors.output_review_required/
  );

  const confirmed = await confirmWellbeingOutputDraftForUser("user-1", draft.id, {
    editedText: "Palun arutame töökoormust.",
    userReviewed: true,
    userConfirmed: true,
    expectedUpdatedAt: draft.updatedAt.toISOString()
  }, { prisma });

  assert.equal(confirmed.status, "ready_to_share");
  assert.equal(confirmed.visibility, "private");
  assert.equal(confirmed.userReviewed, true);
  assert.equal(confirmed.userConfirmed, true);
  assert.equal(confirmed.editedText, "Palun arutame töökoormust.");
  assert.equal(prisma.locks, 1);
});

test("confirmWellbeingOutputDraftForUser rejects missing, stale and handed-off snapshots without writes", async () => {
  const prisma = createMockPrisma();
  const draft = await createWellbeingOutputDraftForUser("user-1", {
    sourceWorkflowType: "quick-check",
    outputType: "covision_input",
    recipientType: "covision",
    context: quickCheckResult
  }, { prisma });

  for (const expectedUpdatedAt of [undefined, null, "not-a-date", "2026-05-26T09:00:01.000Z"]) {
    const error = await confirmWellbeingOutputDraftForUser("user-1", draft.id, {
      editedText: "Uus tekst",
      userReviewed: true,
      userConfirmed: true,
      expectedUpdatedAt
    }, { prisma }).then(() => null, (caught) => caught);
    assert.equal(error?.status, 409);
    assert.equal(draft.status, "draft");
    assert.equal(draft.editedText, null);
  }

  draft.covisionCaseId = "case-1";
  draft.status = "in_covision";
  const linked = await confirmWellbeingOutputDraftForUser("user-1", draft.id, {
    editedText: "Ei tohi üle kirjutada",
    userReviewed: true,
    userConfirmed: true,
    expectedUpdatedAt: draft.updatedAt.toISOString()
  }, { prisma }).then(() => null, (caught) => caught);
  assert.equal(linked?.status, 409);
  assert.equal(draft.editedText, null);
});

test("confirmWellbeingOutputDraftForUser rejects a blank visible version instead of falling back later", async () => {
  const prisma = createMockPrisma();
  const draft = await createWellbeingOutputDraftForUser("user-1", {
    sourceWorkflowType: "quick-check",
    outputType: "covision_input",
    recipientType: "covision",
    context: quickCheckResult
  }, { prisma });

  const error = await confirmWellbeingOutputDraftForUser("user-1", draft.id, {
    editedText: "  \n\t  ",
    userReviewed: true,
    userConfirmed: true,
    expectedUpdatedAt: draft.updatedAt.toISOString()
  }, { prisma }).then(() => null, (caught) => caught);

  assert.equal(error?.status, 400);
  assert.equal(error?.message, "wellbeing.errors.output_text_required");
  assert.equal(draft.status, "draft");
  assert.equal(draft.editedText, null);
  assert.equal(prisma.locks, 0);
});

test("saveWellbeingOutputDraftForUser updates the same private row and invalidates earlier attestations", async () => {
  const prisma = createMockPrisma();
  const draft = await createWellbeingOutputDraftForUser("user-1", {
    sourceWorkflowType: "quick-check",
    outputType: "covision_input",
    recipientType: "covision",
    context: quickCheckResult
  }, { prisma });
  const confirmed = await confirmWellbeingOutputDraftForUser("user-1", draft.id, {
    editedText: "Esimene kinnitatud üldistus.",
    userReviewed: true,
    userConfirmed: true,
    expectedUpdatedAt: draft.updatedAt.toISOString()
  }, { prisma });

  const saved = await saveWellbeingOutputDraftForUser("user-1", draft.id, {
    editedText: "Parandatud privaatne üldistus.",
    expectedUpdatedAt: confirmed.updatedAt.toISOString()
  }, { prisma });

  assert.equal(prisma.drafts.length, 1);
  assert.equal(saved.id, draft.id);
  assert.equal(saved.editedText, "Parandatud privaatne üldistus.");
  assert.equal(saved.status, "draft");
  assert.equal(saved.visibility, "private");
  assert.equal(saved.userReviewed, false);
  assert.equal(saved.userConfirmed, false);
  assert.equal(prisma.locks, 2);
});

test("saveWellbeingOutputDraftForUser rejects stale or handed-off rows without changing text", async () => {
  const prisma = createMockPrisma();
  const draft = await createWellbeingOutputDraftForUser("user-1", {
    sourceWorkflowType: "overview",
    outputType: "manager_memo",
    recipientType: "manager",
    generatedText: "Algne memo"
  }, { prisma });

  const stale = await saveWellbeingOutputDraftForUser("user-1", draft.id, {
    editedText: "Ei tohi salvestuda",
    expectedUpdatedAt: "2026-05-26T09:00:01.000Z"
  }, { prisma }).then(() => null, (caught) => caught);
  assert.equal(stale?.status, 409);
  assert.equal(draft.editedText, null);

  draft.covisionCaseId = "case-1";
  draft.status = "in_covision";
  const linked = await saveWellbeingOutputDraftForUser("user-1", draft.id, {
    editedText: "Samuti ei tohi salvestuda",
    expectedUpdatedAt: draft.updatedAt.toISOString()
  }, { prisma }).then(() => null, (caught) => caught);
  assert.equal(linked?.status, 409);
  assert.equal(draft.editedText, null);
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

  /* SOL-WB-15: loend tagastab nüüd ka kursori ja `hasMore`-i — vaikne lõpp 50
     rea juures oli leid. */
  const { drafts, hasMore, nextCursor } = await listWellbeingOutputDraftsForUser("user-1", {
    outputType: "covision_input",
    recipientType: "covision"
  }, { prisma });

  assert.equal(hasMore, false);
  assert.equal(nextCursor, null);
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].userId, "user-1");
  assert.equal(drafts[0].outputType, "covision_input");
});
