import assert from "node:assert/strict";
import test from "node:test";
import {
  createEffectivePracticeService,
  createPracticeDraftFromClosureTx,
  serializeCandidate,
  serializePublishedPractice
} from "../../lib/effectivePractices.js";

const NOW = new Date("2026-07-14T12:00:00.000Z");

function applyData(target, data = {}) {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === "object" && Number.isFinite(value.increment)) {
      target[key] = Number(target[key] || 0) + value.increment;
    } else {
      target[key] = value;
    }
  }
  target.updatedAt = NOW;
  return target;
}

function basePractice(overrides = {}) {
  return {
    id: "practice-row-1",
    publicId: "practice-public-1",
    authorId: "author-1",
    sourceClosureId: null,
    sourceCovisionCaseId: null,
    title: "Koordineeritud võrgustikutöö",
    summary: "Üldistatud professionaalne tööviis.",
    background: "Üldine taust.",
    mainChallenge: "Koostöö vajas selget rollijaotust.",
    whatHelped: "Ühine rollikaart.",
    networkOrServiceRole: "Võrgustik leppis vastutuse kokku.",
    outcome: "Koostöö muutus selgemaks.",
    learningPoints: "Varane rollijaotus vähendab dubleerimist.",
    limitations: "Ei asenda kriisihindamist.",
    sources: "Asutuse kinnitatud juhend.",
    suitableContext: "Mitme osapoolega juhtumikorraldus.",
    conditions: ["Osapoolte nõusolek"],
    steps: ["Kaardista rollid", "Lepi kokku järelvaade"],
    practiceType: "Võrgustikutöö",
    targetGroups: ["Täiskasvanud"],
    environments: ["KOV"],
    maturityLevel: "practice_candidate",
    riskLevel: "LOW",
    topics: ["võrgustikutöö"],
    tags: [],
    status: "DRAFT",
    version: 0,
    contentVersion: 0,
    publishedVersion: null,
    ownerConfirmedNoIdentifiersAt: NOW,
    ownerConfirmedNoIdentifiersVersion: 0,
    anonymityCheckedAt: null,
    anonymityCheckedVersion: null,
    professionalReviewedAt: null,
    publishedAt: null,
    nextReviewAt: null,
    ragSourceId: null,
    ragMetadata: null,
    versions: [],
    reviews: [],
    reviewAssignments: [],
    applications: [],
    auditEvents: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
  };
}

function matchesValue(value, matcher) {
  if (matcher == null || typeof matcher !== "object" || matcher instanceof Date) return value === matcher;
  if (Object.hasOwn(matcher, "in")) return matcher.in.includes(value);
  if (Object.hasOwn(matcher, "not")) return value !== matcher.not;
  if (Object.hasOwn(matcher, "notIn")) return !matcher.notIn.includes(value);
  if (Object.hasOwn(matcher, "lte") && value > matcher.lte) return false;
  if (Object.hasOwn(matcher, "gt") && value <= matcher.gt) return false;
  return true;
}

function makeDb(initial = {}) {
  const state = {
    practice: initial.practice || basePractice(),
    capabilities: initial.capabilities || [],
    reviews: initial.reviews || [],
    assignments: initial.assignments || [],
    deletionJobs: initial.deletionJobs || [],
    applications: initial.applications || [],
    audits: [],
    versions: initial.versions || [],
    users: initial.users || [],
    closure: initial.closure || null,
    sourceCase: initial.sourceCase || null
    ,failRagLink: initial.failRagLink === true
  };
  const practiceValue = () => ({
    ...state.practice,
    reviews: state.reviews,
    reviewAssignments: state.assignments,
    versions: state.versions,
    applications: state.applications
  });
  const capabilityRows = (where = {}) => state.capabilities.filter((row) => {
    if (where.userId && !matchesValue(row.userId, where.userId)) return false;
    if (where.type && !matchesValue(row.type, where.type)) return false;
    if (where.revokedAt === null && row.revokedAt != null) return false;
    return true;
  });
  const selectedSourceCase = (select = {}) => {
    if (!state.sourceCase) return null;
    const identities = select?.participants?.where?.OR || [];
    const participants = (state.sourceCase.participants || []).filter((participant) => identities.some((identity) => (
      (identity.userId && participant.userId === identity.userId)
      || (identity.userId === null && participant.userId == null && participant.email === identity.email)
    )));
    return { ...state.sourceCase, participants };
  };
  const db = {
    state,
    $transaction: async (callback) => callback(db),
    effectivePractice: {
      findUnique: async () => practiceValue(),
      findMany: async ({ where = {} } = {}) => {
        if (where.status && !matchesValue(state.practice.status, where.status)) return [];
        if (where.riskLevel && !matchesValue(state.practice.riskLevel, where.riskLevel)) return [];
        return [practiceValue()];
      },
      create: async ({ data }) => {
        state.practice = basePractice({ ...data, id: "created-row", publicId: "created-public" });
        return practiceValue();
      },
      updateMany: async ({ where, data }) => {
        if (where.id && where.id !== state.practice.id) return { count: 0 };
        if (where.version != null && where.version !== state.practice.version) return { count: 0 };
        if (where.status && !matchesValue(state.practice.status, where.status)) return { count: 0 };
        if (where.authorId && where.authorId !== state.practice.authorId) return { count: 0 };
        if (where.ragSourceId && where.ragSourceId !== state.practice.ragSourceId) return { count: 0 };
        if (state.failRagLink && Boolean(data.ragSourceId)) return { count: 0 };
        applyData(state.practice, data);
        return { count: 1 };
      },
      update: async ({ data }) => applyData(state.practice, data)
    },
    practiceCapability: {
      findMany: async ({ where = {} } = {}) => capabilityRows(where),
      findFirst: async ({ where = {} } = {}) => capabilityRows(where)[0] || null,
      findUnique: async () => null,
      create: async ({ data }) => ({ id: `cap-${state.capabilities.length + 1}`, ...data }),
      update: async ({ data }) => data
    },
    effectivePracticeReview: {
      findMany: async () => state.reviews,
      create: async ({ data }) => {
        const row = { id: `review-${state.reviews.length + 1}`, createdAt: NOW, updatedAt: NOW, ...data };
        state.reviews.push(row);
        return row;
      }
    },
    effectivePracticeReviewAssignment: {
      findFirst: async ({ where = {} } = {}) => state.assignments.find((row) => (
        (!where.practiceId || row.practiceId === where.practiceId)
        && (!where.reviewerId || row.reviewerId === where.reviewerId)
        && (!where.capabilityType || row.capabilityType === where.capabilityType)
        && (!where.contentVersion || row.contentVersion === where.contentVersion)
        && (!where.status || matchesValue(row.status, where.status))
      )) || null,
      findMany: async ({ where = {} } = {}) => state.assignments.filter((row) => (
        (!where.practiceId || row.practiceId === where.practiceId)
        && (!where.capabilityType || row.capabilityType === where.capabilityType)
        && (!where.contentVersion || row.contentVersion === where.contentVersion)
        && (!where.status || matchesValue(row.status, where.status))
      )).map((row) => ({ ...row, practice: practiceValue() })),
      createMany: async ({ data }) => {
        for (const row of data) {
          if (!state.assignments.some((item) => item.practiceId === row.practiceId && item.reviewerId === row.reviewerId && item.capabilityType === row.capabilityType && item.contentVersion === row.contentVersion)) {
            state.assignments.push({ id: `assignment-${state.assignments.length + 1}`, ...row });
          }
        }
        return { count: data.length };
      },
      create: async ({ data }) => {
        const row = { id: `assignment-${state.assignments.length + 1}`, ...data };
        state.assignments.push(row);
        return row;
      },
      update: async ({ where, data }) => applyData(state.assignments.find((item) => item.id === where.id), data),
      updateMany: async ({ where, data }) => {
        const row = state.assignments.find((item) => item.id === where.id);
        if (!row || (where.status && row.status !== where.status)) return { count: 0 };
        applyData(row, data);
        return { count: 1 };
      }
    },
    effectivePracticeVersion: {
      create: async ({ data }) => {
        const row = { id: `version-${state.versions.length + 1}`, ...data };
        state.versions.unshift(row);
        return row;
      }
    },
    effectivePracticeAuditEvent: {
      create: async ({ data }) => { state.audits.push(data); return data; }
    },
    dataDeletionJob: {
      create: async ({ data }) => {
        const row = { id: `delete-${state.deletionJobs.length + 1}`, attempts: 0, ...data };
        state.deletionJobs.push(row);
        return row;
      },
      update: async ({ where, data }) => applyData(state.deletionJobs.find((item) => item.id === where.id), data),
      findFirst: async ({ where }) => state.deletionJobs.find((item) => (
        item.resourceType === where.resourceType
        && item.resourceId === where.resourceId
        && item.action === where.action
        && where.status.in.includes(item.status)
      )) || null
    },
    effectivePracticeApplication: {
      findMany: async () => state.applications.map((item) => ({ ...item, practice: practiceValue() })),
      findUnique: async ({ where }) => {
        const item = state.applications.find((row) => row.publicId === where.publicId || row.id === where.id);
        return item ? { ...item, practice: practiceValue() } : null;
      },
      create: async ({ data }) => {
        const row = { id: `application-${state.applications.length + 1}`, publicId: `application-public-${state.applications.length + 1}`, version: 0, createdAt: NOW, updatedAt: NOW, ...data };
        state.applications.push(row);
        return row;
      },
      updateMany: async ({ where, data }) => {
        const row = state.applications.find((item) => item.id === where.id);
        if (!row || (where.version != null && row.version !== where.version) || (where.status && !matchesValue(row.status, where.status))) return { count: 0 };
        applyData(row, data);
        return { count: 1 };
      }
    },
    covisionClosure: {
      findUnique: async ({ select = {} } = {}) => state.closure
        ? { ...state.closure, covisionCase: selectedSourceCase(select?.covisionCase?.select) }
        : null
    },
    covisionCase: { findUnique: async ({ select = {} } = {}) => selectedSourceCase(select) },
    user: { findUnique: async ({ where }) => state.users.find((item) => item.id === where.id) || null },
    practiceCapabilityAudit: { create: async ({ data }) => data }
  };
  return db;
}

function capability(userId, type) {
  return { id: `${userId}-${type}`, userId, type, scope: "", validFrom: new Date("2026-01-01"), validUntil: new Date("2027-01-01"), revokedAt: null, createdAt: NOW };
}

test("public serializer returns only the latest immutable snapshot and no identity, source, RAG or old-version fields", () => {
  const practice = basePractice({
    status: "PUBLISHED",
    authorId: null,
    ragSourceId: "private-rag-id",
    versions: [
      { version: 2, publicSnapshot: { publicId: "practice-public-1", title: "Safe current title", summary: "Safe", conditions: [], steps: [], targetGroups: [], environments: [], topics: [], tags: [], reviewRoles: ["REVIEWER"], version: 2, publishedAt: NOW.toISOString() }, professionalReviewRoles: ["REVIEWER"] },
      { version: 1, publicSnapshot: { title: "Old sensitive title" } }
    ]
  });
  const value = serializePublishedPractice(practice);
  assert.equal(value.title, "Safe current title");
  assert.equal(value.id, "practice-public-1");
  assert.equal(value.versionHistory, undefined);
  for (const forbidden of ["authorId", "ragSourceId", "sourceClosureId", "sourceCovisionCaseId", "reviews"]) assert.equal(value[forbidden], undefined);
  assert.doesNotMatch(JSON.stringify(value), /Old sensitive title|private-rag-id/);
});

test("published version history is visible only to the author or a scoped capability holder", async () => {
  const versions = [
    { version: 2, publicSnapshot: { publicId: "practice-public-1", title: "Safe v2", summary: "Current", practiceType: "Võrgustikutöö", topics: ["rollid"], version: 2, publishedAt: NOW.toISOString() }, professionalReviewRoles: ["REVIEWER"], publishedAt: NOW },
    { version: 1, publicSnapshot: { publicId: "practice-public-1", title: "Safe v1", summary: "Earlier", practiceType: "Võrgustikutöö", topics: ["rollid"], version: 1, publishedAt: "2026-06-01T00:00:00.000Z" }, professionalReviewRoles: ["REVIEWER"], publishedAt: new Date("2026-06-01") }
  ];
  const practice = basePractice({ status: "PUBLISHED", publishedVersion: 2, versions });
  const db = makeDb({ practice, versions, capabilities: [capability("auditor-1", "APPROVER")] });
  const service = createEffectivePracticeService(db, { now: () => NOW });
  const outsider = await service.getDetail({ userId: "outsider-1", role: "SOCIAL_WORKER" }, practice.publicId);
  assert.equal(outsider.practice.versionHistory, undefined);
  const owner = await service.getDetail({ userId: "author-1", role: "SOCIAL_WORKER" }, practice.publicId);
  assert.deepEqual(owner.practice.versionHistory.map((item) => item.version), [2, 1]);
  const auditor = await service.getDetail({ userId: "auditor-1", role: "SOCIAL_WORKER" }, practice.publicId);
  assert.equal(auditor.practice.versionHistory[1].snapshot.title, "Safe v1");
  assert.equal(auditor.practice.versionHistory[1].snapshot.authorId, undefined);
});

test("candidate serializer separates author feedback from reviewer-private notes and never emits source row ids", () => {
  const practice = basePractice({
    sourceClosureId: "closure-secret",
    reviews: [{ reviewerId: "reviewer-1", capabilityType: "REVIEWER", decision: "NEEDS_CHANGES", authorFeedback: "Täpsusta piirangut", privateNotes: "Internal", conflictNote: null }]
  });
  const author = serializeCandidate(practice);
  assert.equal(author.source.linked, true);
  assert.equal(author.sourceClosureId, undefined);
  assert.equal(author.reviews[0].authorFeedback, "Täpsusta piirangut");
  assert.equal(author.reviews[0].privateNotes, undefined);
  const reviewer = serializeCandidate(practice, { reviewerId: "reviewer-1", authorView: false });
  assert.equal(reviewer.reviews[0].authorFeedback, undefined);
  assert.equal(reviewer.reviews[0].privateNotes, "Internal");
});

test("candidate creation is always private DRAFT and technical admins cannot create content", async () => {
  const db = makeDb();
  const service = createEffectivePracticeService(db, { now: () => NOW });
  const candidate = await service.createCandidate({ userId: "author-1", role: "SOCIAL_WORKER" }, { title: "Uus tööviis" });
  assert.equal(candidate.status, "DRAFT");
  assert.equal(db.state.practice.ragSourceId, null);
  await assert.rejects(
    service.createCandidate({ userId: "admin-1", role: "ADMIN", isAdmin: true }, { title: "Admini sisu" }),
    (error) => error.status === 403
  );
});

test("submit locks a new content version and records the same reviewed version in audit", async () => {
  const practice = basePractice();
  const db = makeDb({ practice, capabilities: [capability("reviewer-1", "REVIEWER")] });
  const service = createEffectivePracticeService(db, { now: () => NOW });
  await service.actionCandidate({ userId: "author-1", role: "SOCIAL_WORKER" }, practice.publicId, { action: "submit", expectedVersion: 0 });
  assert.equal(db.state.practice.status, "SUBMITTED");
  assert.equal(db.state.practice.contentVersion, 1);
  assert.equal(db.state.audits.at(-1).contentVersion, 1);
  assert.equal(db.state.assignments[0].contentVersion, 1);
});

test("submit refuses stale privacy confirmation and direct identifiers in any publishable field", async () => {
  const practice = basePractice({ contentVersion: 2, ownerConfirmedNoIdentifiersVersion: 1 });
  const db = makeDb({ practice });
  const service = createEffectivePracticeService(db, { now: () => NOW });
  await assert.rejects(
    service.actionCandidate({ userId: "author-1", role: "SOCIAL_WORKER" }, practice.publicId, { action: "submit", expectedVersion: 0 }),
    (error) => error.code === "CANDIDATE_INCOMPLETE"
  );
  practice.ownerConfirmedNoIdentifiersVersion = 2;
  practice.steps = ["Kirjuta aadressile client@example.ee"];
  await assert.rejects(
    service.actionCandidate({ userId: "author-1", role: "SOCIAL_WORKER" }, practice.publicId, { action: "submit", expectedVersion: 0 }),
    (error) => error.code === "CANDIDATE_INCOMPLETE"
  );
});

test("high-risk readiness needs two distinct REVIEWER approvals in addition to EDITOR and ETHICS", async () => {
  const practice = basePractice({ status: "SUBMITTED", contentVersion: 1, riskLevel: "HIGH" });
  const actors = [
    ["reviewer-1", "REVIEWER"],
    ["editor-1", "EDITOR"],
    ["ethics-1", "ETHICS"],
    ["reviewer-2", "REVIEWER"]
  ];
  const assignments = actors.map(([reviewerId, capabilityType], index) => ({ id: `assignment-${index}`, practiceId: practice.id, reviewerId, capabilityType, scope: "", contentVersion: 1, status: "ASSIGNED" }));
  const db = makeDb({ practice, assignments, capabilities: actors.map(([id, type]) => capability(id, type)) });
  const service = createEffectivePracticeService(db, { now: () => NOW });
  for (const [index, [userId, type]] of actors.entries()) {
    await service.actionCandidate({ userId, role: "SOCIAL_WORKER" }, practice.publicId, {
      action: "review", expectedVersion: index, capabilityType: type,
      decision: "APPROVED", conflictStatus: "NONE", authorFeedback: "", privateNotes: ""
    });
    if (index === 2) assert.equal(db.state.practice.status, "IN_REVIEW");
  }
  assert.equal(db.state.practice.status, "READY_TO_PUBLISH");
});

test("RAG delete adapter ok:false leaves the practice in re-review with a durable failed deletion job", async () => {
  const practice = basePractice({ status: "PUBLISHED", publishedVersion: 1, ragSourceId: "effective-practice::old::v1" });
  const db = makeDb({ practice, capabilities: [capability("ethics-1", "ETHICS"), capability("reviewer-1", "REVIEWER"), capability("editor-1", "EDITOR")] });
  const service = createEffectivePracticeService(db, {
    now: () => NOW,
    removePublishedSnapshot: async () => ({ ok: false, error: "upstream unavailable" })
  });
  await service.actionCandidate({ userId: "ethics-1", role: "SOCIAL_WORKER" }, practice.publicId, { action: "re_review", expectedVersion: 0 });
  assert.equal(db.state.practice.status, "RE_REVIEW");
  assert.equal(db.state.practice.ragSourceId, "effective-practice::old::v1");
  assert.equal(db.state.deletionJobs[0].action, "RAG_DELETE");
  assert.equal(db.state.deletionJobs[0].status, "failed");
  assert.equal(db.state.practice.ragMetadata.syncStatus, "removal_failed");
});

test("publication is blocked while an old RAG deletion job is pending or failed", async () => {
  const practice = basePractice({
    status: "READY_TO_PUBLISH", version: 4, contentVersion: 2,
    anonymityCheckedAt: NOW, anonymityCheckedVersion: 2, professionalReviewedAt: NOW
  });
  const reviews = [
    ["reviewer-1", "REVIEWER"], ["editor-1", "EDITOR"], ["ethics-1", "ETHICS"]
  ].map(([reviewerId, capabilityType], index) => ({ id: `r-${index}`, practiceId: practice.id, reviewerId, capabilityType, reviewedVersion: 2, decision: "APPROVED", decidedAt: NOW }));
  const db = makeDb({
    practice, reviews, capabilities: [capability("approver-1", "APPROVER")],
    deletionJobs: [{ id: "pending-delete", action: "RAG_DELETE", resourceType: "EffectivePractice", resourceId: practice.id, externalRef: "old", status: "failed" }]
  });
  const service = createEffectivePracticeService(db, { now: () => NOW });
  await assert.rejects(
    service.actionCandidate({ userId: "approver-1", role: "SOCIAL_WORKER" }, practice.publicId, { action: "publish", expectedVersion: 4, nextReviewAt: "2027-01-01" }),
    (error) => error.code === "RAG_REMOVAL_PENDING"
  );
  assert.equal(db.state.versions.length, 0);
});

test("P1-A: a failed/timed-out publish ingest becomes a durable RAG_INGEST retry job", async () => {
  const practice = basePractice({
    status: "READY_TO_PUBLISH", version: 4, contentVersion: 2,
    anonymityCheckedAt: NOW, anonymityCheckedVersion: 2, professionalReviewedAt: NOW
  });
  const reviews = [
    ["reviewer-1", "REVIEWER"], ["editor-1", "EDITOR"], ["ethics-1", "ETHICS"]
  ].map(([reviewerId, capabilityType], index) => ({ id: `r-${index}`, practiceId: practice.id, reviewerId, capabilityType, reviewedVersion: 2, decision: "APPROVED", decidedAt: NOW }));
  const db = makeDb({ practice, reviews, capabilities: [capability("approver-1", "APPROVER")] });
  const service = createEffectivePracticeService(db, {
    now: () => NOW,
    syncPublishedSnapshot: async () => { throw new Error("ingested_then_timeout"); }
  });
  const result = await service.actionCandidate(
    { userId: "approver-1", role: "SOCIAL_WORKER" },
    practice.publicId,
    { action: "publish", expectedVersion: 4, nextReviewAt: "2027-01-01" }
  );
  // P1-A: instead of abandoning the published practice outside RAG, the durable
  // guard row is converted into a version-guarded RAG_INGEST retry job.
  assert.equal(result.publication.ragSync, "ingest_retry_pending");
  const job = db.state.deletionJobs[0];
  assert.equal(job.action, "RAG_INGEST");
  assert.equal(job.status, "pending");
  assert.equal(job.externalRef, "effective-practice::practice-public-1::v1");
  assert.ok(job.nextAttemptAt, "retry is scheduled");
});

test("successful RAG link and publish guard completion commit together", async () => {
  const practice = basePractice({
    status: "READY_TO_PUBLISH", version: 4, contentVersion: 2,
    anonymityCheckedAt: NOW, anonymityCheckedVersion: 2, professionalReviewedAt: NOW
  });
  const reviews = [["reviewer-1", "REVIEWER"], ["editor-1", "EDITOR"], ["ethics-1", "ETHICS"]]
    .map(([reviewerId, capabilityType], index) => ({ id: `r-${index}`, practiceId: practice.id, reviewerId, capabilityType, reviewedVersion: 2, decision: "APPROVED", decidedAt: NOW }));
  const db = makeDb({ practice, reviews, capabilities: [capability("approver-1", "APPROVER")] });
  const service = createEffectivePracticeService(db, {
    now: () => NOW,
    syncPublishedSnapshot: async () => ({ status: "synced", docId: "effective-practice::practice-public-1::v1" })
  });
  const result = await service.actionCandidate({ userId: "approver-1", role: "SOCIAL_WORKER" }, practice.publicId, {
    action: "publish", expectedVersion: 4, nextReviewAt: "2027-01-01"
  });
  assert.equal(result.publication.ragSync, "synced");
  assert.equal(db.state.practice.ragSourceId, "effective-practice::practice-public-1::v1");
  assert.equal(db.state.deletionJobs[0].status, "done");
});

test("P1-A: a failed publish LINK also becomes a durable RAG_INGEST retry job", async () => {
  const practice = basePractice({
    status: "READY_TO_PUBLISH", version: 4, contentVersion: 2,
    anonymityCheckedAt: NOW, anonymityCheckedVersion: 2, professionalReviewedAt: NOW
  });
  const reviews = [["reviewer-1", "REVIEWER"], ["editor-1", "EDITOR"], ["ethics-1", "ETHICS"]]
    .map(([reviewerId, capabilityType], index) => ({ id: `r-${index}`, practiceId: practice.id, reviewerId, capabilityType, reviewedVersion: 2, decision: "APPROVED", decidedAt: NOW }));
  const db = makeDb({ practice, reviews, capabilities: [capability("approver-1", "APPROVER")], failRagLink: true });
  const service = createEffectivePracticeService(db, {
    now: () => NOW,
    syncPublishedSnapshot: async () => ({ status: "synced", docId: "effective-practice::practice-public-1::v1" })
  });
  const result = await service.actionCandidate({ userId: "approver-1", role: "SOCIAL_WORKER" }, practice.publicId, {
    action: "publish", expectedVersion: 4, nextReviewAt: "2027-01-01"
  });
  // The ingest succeeded but the DB link failed (count!==1). The retry re-ingests
  // (idempotent upsert) and links on a later run rather than giving up.
  assert.equal(result.publication.ragSync, "ingest_retry_pending");
  const job = db.state.deletionJobs[0];
  assert.equal(job.action, "RAG_INGEST");
  assert.equal(job.status, "pending");
  assert.equal(job.externalRef, "effective-practice::practice-public-1::v1");
});

test("application keeps the immutable published version even after the live candidate fields change", async () => {
  const snapshot = {
    publicId: "practice-public-1", title: "Avaldatud versioon", practiceType: "Võrgustikutöö",
    topics: ["rollid"], version: 1, publishedAt: NOW.toISOString()
  };
  const practice = basePractice({ status: "PUBLISHED", publishedVersion: 1, versions: [{ version: 1, publicSnapshot: snapshot }] });
  const db = makeDb({ practice, versions: practice.versions });
  const service = createEffectivePracticeService(db, { now: () => NOW });
  await service.addApplication({ userId: "applier-1", role: "SOCIAL_WORKER" }, practice.publicId, {
    context: "KOV", targetGroup: "Täiskasvanud", versionUsed: 1, adaptations: "Kohandasin ajakava",
    whatWorked: "Rollikaart", whatDidNot: "Kiire tempo", limitationOrRisk: "Vajab järelvaadet",
    followUpAt: "2027-01-01", needsReview: false, submit: true
  });
  db.state.practice.title = "Privaatne järgmise versiooni pealkiri";
  db.state.practice.practiceType = "Salajane uus tüüp";
  const workspace = await service.listWorkspace({ userId: "applier-1", role: "SOCIAL_WORKER" });
  assert.equal(workspace.myApplications[0].practice.title, "Avaldatud versioon");
  assert.equal(workspace.myApplications[0].practice.practiceType, "Võrgustikutöö");
  assert.doesNotMatch(JSON.stringify(workspace.myApplications[0]), /Privaatne|Salajane/);
});

test("practice author cannot review an application about their own practice even with a corrupted assignment", async () => {
  const practice = basePractice({ status: "PUBLISHED", publishedVersion: 1 });
  const application = {
    id: "app-1", publicId: "app-public-1", practiceId: practice.id, authorId: "applier-1",
    assignedReviewerId: "author-1", assignedCapabilityType: "REVIEWER", practiceSnapshot: { publicId: practice.publicId, title: practice.title },
    status: "SUBMITTED", version: 0, needsReview: false
  };
  const db = makeDb({ practice, applications: [application], capabilities: [capability("author-1", "REVIEWER")] });
  const service = createEffectivePracticeService(db, { now: () => NOW });
  await assert.rejects(
    service.reviewApplication({ userId: "author-1", role: "SOCIAL_WORKER" }, application.publicId, {
      expectedVersion: 0, action: "ACCEPTED", capabilityType: "REVIEWER", reviewNote: ""
    }),
    (error) => error.status === 403 && error.code === "SELF_APPLICATION_REVIEW"
  );
});

test("source-case participant is blocked by bound user id or accepted email identity on both source links", async (t) => {
  for (const sourceField of ["sourceClosureId", "sourceCovisionCaseId"]) {
    await t.test(sourceField, async () => {
      const practice = basePractice({ status: "SUBMITTED", contentVersion: 1, [sourceField]: `source-${sourceField}` });
      const assignment = { id: "assignment-source", practiceId: practice.id, reviewerId: "reviewer-1", capabilityType: "REVIEWER", scope: "", contentVersion: 1, status: "ASSIGNED" };
      const sourceCase = { ownerId: "owner-x", participants: [{ id: "participant-1", userId: null, email: "bound@example.ee" }] };
      const db = makeDb({
        practice,
        assignments: [assignment],
        capabilities: [capability("reviewer-1", "REVIEWER")],
        sourceCase,
        closure: { covisionCase: sourceCase }
      });
      const service = createEffectivePracticeService(db, { now: () => NOW });
      await assert.rejects(
        service.actionCandidate({ userId: "reviewer-1", email: "bound@example.ee", role: "SOCIAL_WORKER" }, practice.publicId, {
          action: "review", expectedVersion: 0, capabilityType: "REVIEWER", decision: "APPROVED",
          conflictStatus: "NONE", authorFeedback: "", privateNotes: ""
        }),
        (error) => error.status === 403 && error.code === "SOURCE_CASE_PARTICIPANT"
      );
    });
  }
});

test("high-risk publishing ignores approvals whose reviewer identity was deleted", async () => {
  const practice = basePractice({
    status: "READY_TO_PUBLISH", version: 4, contentVersion: 2, riskLevel: "HIGH",
    anonymityCheckedAt: NOW, anonymityCheckedVersion: 2, professionalReviewedAt: NOW
  });
  const reviews = [
    ["reviewer-1", "REVIEWER"], [null, "REVIEWER"], ["editor-1", "EDITOR"], ["ethics-1", "ETHICS"]
  ].map(([reviewerId, capabilityType], index) => ({ id: `r-${index}`, practiceId: practice.id, reviewerId, capabilityType, reviewedVersion: 2, decision: "APPROVED", decidedAt: NOW }));
  const db = makeDb({ practice, reviews, capabilities: [capability("approver-1", "APPROVER")] });
  const service = createEffectivePracticeService(db, { now: () => NOW });
  await assert.rejects(
    service.actionCandidate({ userId: "approver-1", role: "SOCIAL_WORKER" }, practice.publicId, {
      action: "publish", expectedVersion: 4, nextReviewAt: "2027-01-01"
    }),
    (error) => error.code === "HIGH_RISK_REVIEW_CHAIN_INCOMPLETE"
  );
  assert.equal(db.state.versions.length, 0);
});

test("closure-to-practice helper is idempotent, private and copies only whitelisted generalisations", async () => {
  let stored = null;
  const tx = {
    effectivePractice: {
      findUnique: async () => stored,
      create: async ({ data }) => { stored = { id: "practice-row", ...data }; return stored; }
    }
  };
  const closure = { id: "closure-1", ownerId: "owner-1", generalizedTitle: "Üldistatud suund", selectedDirection: "Koostöö", workFocus: "Rolliselgus", nextStep: "Koosta rollikaart", progressMarker: "Vastutus on selge", secretTranscript: "must never copy" };
  const first = await createPracticeDraftFromClosureTx(tx, closure);
  const second = await createPracticeDraftFromClosureTx(tx, closure);
  assert.equal(first, second);
  assert.equal(first.status, "DRAFT");
  assert.equal(first.sourceClosureId, "closure-1");
  assert.doesNotMatch(JSON.stringify(first), /must never copy/);
});
