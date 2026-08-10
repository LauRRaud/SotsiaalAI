import assert from "node:assert/strict";
import test from "node:test";
import {
  deleteUserAfterFinalPracticeSweep,
  scrubOrDeleteEffectivePractices
} from "../../lib/privacy/effectivePracticeAccountCleanup.js";

test("account deletion deletes private candidates and atomically scrubs formerly published rows", async () => {
  const safeSnapshot = {
    title: "Avaldatud turvaline pealkiri",
    summary: "Avalik kokkuvõte",
    expectedOutcome: "Üldistatud tulemus",
    learningPoints: "Üldine õppetund",
    suitableContext: "KOV",
    conditions: ["Nõusolek"],
    steps: ["Kaardista rollid"],
    targetGroups: ["Täiskasvanud"],
    environments: ["KOV"],
    topics: ["rollid"],
    riskLevel: "LOW"
  };
  const rows = [
    {
      id: "private-1", authorId: "user-1", publicId: "private-public", status: "DRAFT",
      publishedVersion: null, versions: [], title: "Privaatne juhtum"
    },
    {
      id: "historical-1", authorId: "user-1", publicId: "historical-public", status: "RE_REVIEW",
      publishedVersion: 2, ragSourceId: "effective-practice::historical-public::v2",
      versions: [{ publicSnapshot: safeSnapshot }], title: "Privaatne v3 pealkiri",
      background: "Tundlik v3 taust", mainChallenge: "Tundlik detail", whatHelped: "Tundlik detail"
    }
  ];
  const deleted = [];
  const jobs = [];
  const scrubbedReviews = [];
  const auditEvents = [
    {
      id: "audit-1",
      practiceId: "historical-1",
      action: "REVIEW_JUSTIFICATION",
      decisionType: "NEEDS_CHANGES",
      contentVersion: 2,
      justification: "Autori tagasiside vabatekst"
    },
    {
      id: "audit-2",
      practiceId: "historical-1",
      action: "REVIEW_APPROVED",
      decisionType: null,
      contentVersion: 2,
      justification: null
    }
  ];
  const tx = {
    effectivePractice: {
      findMany: async () => rows.map(({ id }) => ({ id })),
      findUnique: async ({ where }) => rows.find((item) => item.id === where.id) || null,
      deleteMany: async ({ where }) => {
        const row = rows.find((item) => item.id === where.id);
        if (!row || row.authorId !== where.authorId || row.status !== where.status || row.version !== where.version) return { count: 0 };
        deleted.push(where.id);
        return { count: 1 };
      },
      updateMany: async ({ where, data }) => {
        const row = rows.find((item) => item.id === where.id);
        if (!row || row.authorId !== where.authorId || row.status !== where.status || row.version !== where.version) return { count: 0 };
        Object.assign(row, data, {
          version: Number(row.version || 0) + Number(data.version?.increment || 0),
          contentVersion: Number(row.contentVersion || 0) + Number(data.contentVersion?.increment || 0)
        });
        return { count: 1 };
      }
    },
    dataDeletionJob: {
      findFirst: async () => null,
      create: async ({ data }) => { jobs.push(data); return { id: `job-${jobs.length}`, ...data }; }
    },
    effectivePracticeReview: {
      updateMany: async ({ where, data }) => { scrubbedReviews.push({ where, data }); return { count: 1 }; }
    },
    effectivePracticeAuditEvent: {
      updateMany: async ({ where, data }) => {
        const matches = auditEvents.filter((event) => (
          event.practiceId === where.practiceId &&
          event.action === where.action &&
          event.justification !== null
        ));
        for (const event of matches) Object.assign(event, data);
        return { count: matches.length };
      }
    }
  };
  const db = {
    $transaction: async (callback) => callback(tx)
  };

  await scrubOrDeleteEffectivePractices("user-1", db);

  assert.deepEqual(deleted, ["private-1"]);
  const historical = rows[1];
  assert.equal(historical.authorId, null);
  assert.equal(historical.status, "ARCHIVED");
  assert.equal(historical.title, safeSnapshot.title);
  assert.equal(historical.background, null);
  assert.equal(historical.mainChallenge, null);
  assert.equal(historical.whatHelped, null);
  assert.equal(historical.sourceClosureId, null);
  assert.equal(historical.sourceCovisionCaseId, null);
  assert.ok(jobs.some((job) => job.action === "RAG_DELETE" && job.externalRef === historical.ragSourceId));
  assert.ok(jobs.every((job) => job.status === "pending" && job.targetUserId == null));
  assert.deepEqual(scrubbedReviews[0], {
    where: { practiceId: "historical-1" },
    data: { authorFeedback: null, privateNotes: null, conflictNote: null }
  });
  assert.equal(auditEvents[0].justification, null, "retained practice loses copied review free text");
  assert.equal(auditEvents[0].decisionType, "NEEDS_CHANGES", "decision audit survives text redaction");
  assert.equal(auditEvents[0].contentVersion, 2, "version audit survives text redaction");
  assert.equal(auditEvents[1].action, "REVIEW_APPROVED", "unrelated audit rows survive unchanged");
  assert.notEqual(historical.authorId, "user-1", "an in-flight author update can no longer match after scrub commit");
});

test("account scrub never republishes a row when concurrent re-review wins the first CAS", async () => {
  const row = {
    id: "practice-1", authorId: "user-1", publicId: "practice-public", status: "PUBLISHED",
    version: 4, contentVersion: 2, publishedVersion: 1, ragSourceId: "effective-practice::practice-public::v1",
    title: "Safe v1", background: "Private v2",
    versions: [{ publicSnapshot: { title: "Safe v1", summary: "Safe", version: 1, riskLevel: "LOW" } }]
  };
  const jobs = [];
  let firstCas = true;
  const tx = {
    effectivePractice: {
      findMany: async () => [{ id: row.id }],
      findUnique: async () => ({ ...row, versions: row.versions }),
      deleteMany: async () => ({ count: 0 }),
      updateMany: async ({ where, data }) => {
        if (firstCas) {
          firstCas = false;
          row.status = "RE_REVIEW";
          row.version += 1;
          return { count: 0 };
        }
        assert.equal(where.status, "RE_REVIEW");
        assert.equal(where.version, 5);
        Object.assign(row, data, {
          version: row.version + Number(data.version?.increment || 0),
          contentVersion: row.contentVersion + Number(data.contentVersion?.increment || 0)
        });
        return { count: 1 };
      }
    },
    dataDeletionJob: {
      findFirst: async () => null,
      create: async ({ data }) => { jobs.push(data); return { id: `job-${jobs.length}`, ...data }; }
    },
    effectivePracticeReview: { updateMany: async () => ({ count: 1 }) },
    effectivePracticeAuditEvent: { updateMany: async () => ({ count: 1 }) }
  };
  await scrubOrDeleteEffectivePractices("user-1", { $transaction: async (callback) => callback(tx) });
  assert.equal(row.status, "ARCHIVED");
  assert.equal(row.authorId, null);
  assert.equal(row.background, null);
  assert.ok(jobs.some((job) => job.externalRef === "effective-practice::practice-public::v1"));
});

test("final user-row lock sweeps pre-lock candidates and prevents post-delete private orphans", async () => {
  const rows = [];
  const deletedPractices = [];
  let userExists = true;
  let locked = false;
  const preInquiryUpdates = [];
  const urgentUpdates = [];
  const preInquiryDeletes = [];
  const tx = {
    $queryRaw: async () => {
      rows.push({
        id: "created-before-lock", authorId: "user-1", status: "DRAFT", version: 0,
        publishedVersion: null, versions: []
      });
      locked = true;
      return [{ id: "user-1" }];
    },
    effectivePractice: {
      findMany: async () => rows.filter((row) => row.authorId === "user-1").map(({ id }) => ({ id })),
      findUnique: async ({ where }) => rows.find((row) => row.id === where.id) || null,
      deleteMany: async ({ where }) => {
        const row = rows.find((item) => item.id === where.id && item.authorId === where.authorId);
        if (!row) return { count: 0 };
        deletedPractices.push(row.id);
        rows.splice(rows.indexOf(row), 1);
        return { count: 1 };
      },
      updateMany: async () => ({ count: 0 })
    },
    dataDeletionJob: { findFirst: async () => null, create: async ({ data }) => data },
    effectivePracticeReview: { updateMany: async () => ({ count: 1 }) },
    preInquiry: {
      updateMany: async (input) => {
        preInquiryUpdates.push(input);
        return { count: 1 };
      },
      // SOL-PRE-01: saatmata mustandid kustutatakse samas tehingus.
      deleteMany: async (input) => {
        preInquiryDeletes.push(input);
        return { count: 3 };
      }
    },
    /* SOL-URG-02: kiire abi pöördumiste anonümiseerimine käib samas tehingus.
       Enne oli see mudel siit puudu ja kutse oleks vaikselt vahele jäänud —
       nüüd ta EI JÄÄ, sest kood ei valva enam mudeli olemasolu. */
    urgentRequest: {
      updateMany: async (input) => {
        urgentUpdates.push(input);
        return { count: 2 };
      }
    },
    user: {
      delete: async ({ where }) => {
        assert.equal(locked, true);
        assert.equal(where.id, "user-1");
        userExists = false;
        return { id: where.id };
      }
    }
  };
  const db = { $transaction: async (callback) => callback(tx) };
  const deleted = await deleteUserAfterFinalPracticeSweep("user-1", db);
  assert.deepEqual(deletedPractices, ["created-before-lock"]);
  assert.equal(userExists, false);
  // SOL-URG-02: kiire abi read anonümiseeritakse samas tehingus, enne User rea kustutust.
  assert.deepEqual(urgentUpdates[0].where, { authorId: "user-1" });
  assert.equal(urgentUpdates[0].data.situationVerbatim, "");
  assert.equal(urgentUpdates[0].data.contactName, "");
  assert.equal(urgentUpdates[0].data.contactPhone, "");
  assert.equal(urgentUpdates[0].data.authorId, null);
  assert.ok(urgentUpdates[0].data.authorErasedAt instanceof Date);
  assert.equal(deleted.privacyCounts.anonymizedUrgentRequests, 2);
  // SOL-PRE-01: saatmata mustandid kustutatakse, mitte ei puhastata.
  assert.deepEqual(preInquiryDeletes[0].where, { authorId: "user-1", sentAt: null });
  assert.equal(deleted.privacyCounts.deletedUnsentPreInquiries, 3);
  assert.deepEqual(preInquiryUpdates[0].where, { authorId: "user-1", sentAt: { not: null } });
  assert.equal(preInquiryUpdates[0].data.authorId, null);
  assert.equal(preInquiryUpdates[0].data.situation, "");
  assert.ok(preInquiryUpdates[0].data.assessmentState);
  assert.deepEqual(preInquiryUpdates[1].where, { recipientOwnerId: "user-1" });
  assert.deepEqual(preInquiryUpdates[1].data, {
    receiverNote: null,
    receiverChecklist: null,
    nextContactOn: null
  });
  const createAfterDelete = () => {
    if (!userExists) throw Object.assign(new Error("foreign_key_violation"), { code: "P2003" });
  };
  assert.throws(createAfterDelete, (error) => error.code === "P2003");
});
