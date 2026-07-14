import { prisma } from "./prisma.js";
import { covisionParticipantIdentityOr } from "./covisionAccessShared.js";

const MAX_TEXT = 8_000;
const MAX_SHORT = 240;
const MAX_LIST = 24;
const REVIEW_TYPES = new Set(["REVIEWER", "ETHICS", "EDITOR"]);
const CAPABILITY_TYPES = new Set(["REVIEWER", "ETHICS", "EDITOR", "APPROVER"]);
const EDITABLE_STATUSES = new Set(["DRAFT", "NEEDS_CHANGES"]);
const REVIEWABLE_STATUSES = new Set(["SUBMITTED", "IN_REVIEW", "RE_REVIEW"]);
const CONTENT_FIELDS = new Set([
  "title", "summary", "background", "mainChallenge", "whatHelped", "networkOrServiceRole",
  "outcome", "learningPoints", "limitations", "sources", "suitableContext", "conditions",
  "steps", "practiceType", "targetGroups", "environments", "maturityLevel", "riskLevel",
  "topics", "tags"
]);

export const EFFECTIVE_PRACTICE_PUBLIC_ERRORS = Object.freeze({
  "api.common.unauthorized": 401,
  "api.common.not_found": 404,
  "api.common.forbidden": 403,
  "api.common.invalid_request": 400,
  "effective_practices.errors.conflict": 409,
  "effective_practices.errors.incomplete": 409,
  "effective_practices.errors.capability_required": 403,
  "effective_practices.errors.self_review": 403,
  "effective_practices.errors.conflict_of_interest": 403,
  "effective_practices.errors.review_chain": 409
});

function fail(message, status, code = null) {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
}

function invalid() {
  return fail("api.common.invalid_request", 400, "INVALID_REQUEST");
}

function notFound() {
  return fail("api.common.not_found", 404, "NOT_FOUND");
}

function forbidden() {
  return fail("api.common.forbidden", 403, "FORBIDDEN");
}

function conflict(code = "VERSION_CONFLICT") {
  return fail("effective_practices.errors.conflict", 409, code);
}

function normalizeActor(actor) {
  const userId = normalizeId(actor?.userId ?? actor?.id);
  if (!userId) throw notFound();
  return {
    userId,
    email: normalizeShort(actor?.email, 320).toLowerCase(),
    role: normalizeShort(actor?.role).toUpperCase(),
    isAdmin: actor?.isAdmin === true
  };
}

function normalizeId(value) {
  return typeof value === "string" ? value.trim().slice(0, 200) : "";
}

function normalizeShort(value, max = MAX_SHORT) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function normalizeText(value, max = MAX_TEXT) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeList(value, { maxItems = MAX_LIST, maxLength = 120 } = {}) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,;]/)
      : [];
  const seen = new Set();
  const result = [];
  for (const item of source) {
    const normalized = normalizeShort(item, maxLength);
    const key = normalized.toLocaleLowerCase("et");
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= maxItems) break;
  }
  return result;
}

function normalizeCapabilityScope(value) {
  const scope = normalizeShort(value, 120);
  return !scope || scope === "*" ? "" : scope;
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertObject(value) {
  if (!isPlainObject(value)) throw invalid();
  return value;
}

function assertOnlyKeys(value, allowed) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw invalid();
  }
}

function normalizeExpectedVersion(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw invalid();
  return number;
}

function dateOrNull(value) {
  if (value == null || value === "") return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw invalid();
  return date;
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeCandidateInput(input, { partial = false } = {}) {
  assertObject(input);
  const allowed = new Set([
    "expectedVersion", "title", "summary", "background", "mainChallenge",
    "whatHelped", "networkOrServiceRole", "outcome", "learningPoints",
    "limitations", "sources", "suitableContext", "conditions", "steps",
    "practiceType", "targetGroups", "environments", "maturityLevel",
    "riskLevel", "topics", "tags", "ownerConfirmedNoIdentifiers"
  ]);
  assertOnlyKeys(input, allowed);
  const data = {};
  const textFields = [
    "summary", "background", "mainChallenge", "whatHelped", "networkOrServiceRole",
    "outcome", "learningPoints", "limitations", "sources", "suitableContext"
  ];
  if (!partial || hasOwn(input, "title")) {
    const title = normalizeShort(input.title, 180);
    if (!title) throw invalid();
    data.title = title;
  }
  for (const field of textFields) {
    if (!partial || hasOwn(input, field)) data[field] = normalizeText(input[field]) || null;
  }
  for (const [field, options] of [
    ["conditions", { maxItems: 12, maxLength: 220 }],
    ["steps", { maxItems: 16, maxLength: 500 }],
    ["targetGroups", { maxItems: 12, maxLength: 120 }],
    ["environments", { maxItems: 12, maxLength: 120 }],
    ["topics", { maxItems: 24, maxLength: 100 }],
    ["tags", { maxItems: 32, maxLength: 80 }]
  ]) {
    if (!partial || hasOwn(input, field)) data[field] = normalizeList(input[field], options);
  }
  if (!partial || hasOwn(input, "practiceType")) data.practiceType = normalizeShort(input.practiceType, 120) || null;
  if (!partial || hasOwn(input, "maturityLevel")) {
    data.maturityLevel = normalizeShort(input.maturityLevel, 80) || "practice_candidate";
  }
  if (!partial || hasOwn(input, "riskLevel")) {
    const riskLevel = normalizeShort(input.riskLevel || "LOW").toUpperCase();
    if (!new Set(["LOW", "HIGH"]).has(riskLevel)) throw invalid();
    data.riskLevel = riskLevel;
  }
  if (hasOwn(input, "ownerConfirmedNoIdentifiers")) {
    if (input.ownerConfirmedNoIdentifiers !== true && input.ownerConfirmedNoIdentifiers !== false) throw invalid();
    data.ownerConfirmedNoIdentifiersAt = input.ownerConfirmedNoIdentifiers ? new Date() : null;
  }
  return data;
}

function candidateReady(practice) {
  return Boolean(
    normalizeShort(practice?.title)
    && normalizeText(practice?.summary)
    && normalizeText(practice?.suitableContext)
    && normalizeText(practice?.limitations)
    && Array.isArray(practice?.conditions)
    && practice.conditions.length
    && Array.isArray(practice?.steps)
    && practice.steps.length
    && Boolean(
      normalizeText(practice?.sources)
      || normalizeText(practice?.learningPoints)
      || normalizeText(practice?.outcome)
      || normalizeText(practice?.whatHelped)
    )
    && practice?.ownerConfirmedNoIdentifiersAt
    && practice.ownerConfirmedNoIdentifiersVersion === practice.contentVersion
    && !containsDirectIdentifier(practice)
  );
}

function containsDirectIdentifier(practice) {
  const text = [
    practice?.title, practice?.summary, practice?.background, practice?.mainChallenge,
    practice?.whatHelped, practice?.networkOrServiceRole, practice?.outcome,
    practice?.learningPoints, practice?.limitations, practice?.sources,
    practice?.suitableContext, practice?.practiceType, practice?.maturityLevel, ...(practice?.conditions || []),
    ...(practice?.steps || []), ...(practice?.targetGroups || []),
    ...(practice?.environments || []), ...(practice?.topics || []), ...(practice?.tags || [])
  ].filter(Boolean).join(" ");
  return (
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text)
    || /(?:\+?372[\s-]?)?(?:5\d{6,7}|[67]\d{6})\b/.test(text)
    || /\b[1-6]\d{10}\b/.test(text)
  );
}

function capabilityIsActive(capability, now = new Date()) {
  if (!capability || capability.revokedAt) return false;
  const validFrom = capability.validFrom ? new Date(capability.validFrom) : null;
  const validUntil = capability.validUntil ? new Date(capability.validUntil) : null;
  return (!validFrom || validFrom <= now) && (!validUntil || validUntil > now);
}

function scopeMatchesPractice(scope, practice) {
  const normalized = normalizeShort(scope, 120).toLocaleLowerCase("et");
  if (!normalized || normalized === "*") return true;
  const values = [
    practice?.practiceType,
    ...(practice?.topics || []),
    ...(practice?.tags || []),
    ...(practice?.targetGroups || []),
    ...(practice?.environments || [])
  ].map((value) => normalizeShort(value, 140).toLocaleLowerCase("et"));
  return values.includes(normalized);
}

async function activeCapabilities(db, userId, now = new Date()) {
  const rows = await db.practiceCapability.findMany({
    where: {
      userId,
      revokedAt: null,
      validFrom: { lte: now },
      OR: [{ validUntil: null }, { validUntil: { gt: now } }]
    },
    orderBy: [{ type: "asc" }, { scope: "asc" }]
  });
  return (rows || []).filter((item) => capabilityIsActive(item, now));
}

async function assignReviewersTx(tx, practice, contentVersion, currentTime) {
  const capabilities = await tx.practiceCapability.findMany({
    where: {
      type: { in: ["REVIEWER", "ETHICS", "EDITOR"] },
      userId: { not: practice.authorId },
      revokedAt: null,
      validFrom: { lte: currentTime },
      OR: [{ validUntil: null }, { validUntil: { gt: currentTime } }]
    },
    orderBy: [{ type: "asc" }, { validUntil: "asc" }, { createdAt: "asc" }]
  });
  const selected = [];
  for (const type of ["REVIEWER", "ETHICS", "EDITOR"]) {
    const eligible = capabilities
      .filter((item) => item.type === type && scopeMatchesPractice(item.scope, practice))
      .filter((item, index, rows) => rows.findIndex((candidate) => candidate.userId === item.userId) === index);
    const take = practice.riskLevel === "HIGH" && type === "REVIEWER" ? 2 : 1;
    selected.push(...eligible.slice(0, take));
  }
  if (!selected.length) return [];
  await tx.effectivePracticeReviewAssignment.createMany({
    data: selected.map((item) => ({
      practiceId: practice.id,
      reviewerId: item.userId,
      capabilityType: item.type,
      scope: item.scope || "",
      contentVersion,
      status: "ASSIGNED",
      assignedAt: currentTime
    })),
    skipDuplicates: true
  });
  return selected;
}

async function assignReplacementReviewerTx(tx, practice, capabilityType, contentVersion, currentTime, excluded = []) {
  const assignments = await tx.effectivePracticeReviewAssignment.findMany({
    where: { practiceId: practice.id, capabilityType, contentVersion }
  });
  const used = new Set([
    practice.authorId,
    ...excluded,
    ...(assignments || []).map((item) => item.reviewerId).filter(Boolean)
  ]);
  const capabilities = await tx.practiceCapability.findMany({
    where: {
      type: capabilityType,
      userId: { notIn: [...used] },
      revokedAt: null,
      validFrom: { lte: currentTime },
      OR: [{ validUntil: null }, { validUntil: { gt: currentTime } }]
    },
    orderBy: [{ createdAt: "asc" }]
  });
  const replacement = (capabilities || []).find((item) => scopeMatchesPractice(item.scope, practice));
  if (!replacement) return null;
  return tx.effectivePracticeReviewAssignment.create({
    data: {
      practiceId: practice.id,
      reviewerId: replacement.userId,
      capabilityType,
      scope: replacement.scope || "",
      contentVersion,
      status: "ASSIGNED",
      assignedAt: currentTime
    }
  });
}

async function chooseApplicationReviewerTx(tx, practice, authorId, currentTime) {
  const capabilities = await tx.practiceCapability.findMany({
    where: {
      type: { in: ["REVIEWER", "ETHICS", "EDITOR"] },
      userId: { notIn: [...new Set([authorId, practice.authorId].filter(Boolean))] },
      revokedAt: null,
      validFrom: { lte: currentTime },
      OR: [{ validUntil: null }, { validUntil: { gt: currentTime } }]
    },
    orderBy: [{ createdAt: "asc" }]
  });
  for (const type of ["REVIEWER", "ETHICS", "EDITOR"]) {
    const match = (capabilities || []).find((item) => (
      item.type === type && scopeMatchesPractice(item.scope, practice)
    ));
    if (match) return { userId: match.userId, type: match.type };
  }
  return null;
}

function requireCapability(capabilities, type, practice) {
  const normalizedType = normalizeShort(type).toUpperCase();
  if (!CAPABILITY_TYPES.has(normalizedType)) throw invalid();
  const match = (capabilities || []).find((item) => (
    item.type === normalizedType && scopeMatchesPractice(item.scope, practice)
  ));
  if (!match) throw fail("effective_practices.errors.capability_required", 403, "CAPABILITY_REQUIRED");
  return match;
}

async function recordAudit(tx, practice, actorId, action, fromStatus, toStatus, metadata = null) {
  await tx.effectivePracticeAuditEvent.create({
    data: {
      practiceId: practice.id,
      actorId,
      action,
      fromStatus: fromStatus || null,
      toStatus: toStatus || null,
      contentVersion: practice.contentVersion,
      metadata
    }
  });
}

function latestReviewDecisions(reviews) {
  const ordered = [...(reviews || [])].sort((a, b) => (
    new Date(a.decidedAt || a.createdAt || 0) - new Date(b.decidedAt || b.createdAt || 0)
  ));
  const latest = new Map();
  for (const review of ordered) latest.set(`${review.reviewerId}:${review.capabilityType}`, review);
  return [...latest.values()];
}

function snapshotFromPractice(practice, reviewRoles, releaseVersion, now, nextReviewAt) {
  return Object.freeze({
    publicId: practice.publicId,
    title: practice.title,
    summary: practice.summary,
    suitableContext: practice.suitableContext,
    conditions: [...(practice.conditions || [])],
    limitations: practice.limitations,
    steps: [...(practice.steps || [])],
    practiceType: practice.practiceType,
    targetGroups: [...(practice.targetGroups || [])],
    environments: [...(practice.environments || [])],
    maturityLevel: "confirmed",
    riskLevel: practice.riskLevel,
    topics: [...(practice.topics || [])],
    tags: [...(practice.tags || [])],
    expectedOutcome: practice.outcome,
    learningPoints: practice.learningPoints,
    sources: practice.sources,
    version: releaseVersion,
    publishedAt: now.toISOString(),
    professionalReviewedAt: (practice.professionalReviewedAt || now).toISOString(),
    nextReviewAt: nextReviewAt?.toISOString() || null,
    reviewRoles: [...reviewRoles]
  });
}

function publicSnapshotOf(practice) {
  const version = Array.isArray(practice?.versions) ? practice.versions[0] : null;
  return version?.publicSnapshot && typeof version.publicSnapshot === "object"
    ? { version, snapshot: version.publicSnapshot }
    : null;
}

function applicationPracticeSnapshot(application) {
  const snapshot = application?.practiceSnapshot;
  return snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) ? snapshot : {};
}

function applicationPracticeScope(application) {
  const snapshot = applicationPracticeSnapshot(application);
  return {
    ...snapshot,
    id: application?.practice?.id || application?.practiceId,
    publicId: snapshot.publicId || application?.practice?.publicId,
    authorId: application?.practice?.authorId || null
  };
}

function publicCounts(practice) {
  const applications = Array.isArray(practice?.applications) ? practice.applications : [];
  const documented = applications.filter((item) => item.status === "ACCEPTED");
  return {
    applicationCount: documented.length,
    followUpCount: documented.filter((item) => item.followUpAt).length
  };
}

export function serializePublishedPractice(practice) {
  if (!practice || practice.status !== "PUBLISHED") return null;
  const published = publicSnapshotOf(practice);
  if (!published) return null;
  const snapshot = published.snapshot;
  const counts = publicCounts(practice);
  return {
    id: snapshot.publicId || practice.publicId,
    title: snapshot.title,
    summary: snapshot.summary,
    suitableContext: snapshot.suitableContext,
    conditions: snapshot.conditions || [],
    limitations: snapshot.limitations,
    steps: snapshot.steps || [],
    practiceType: snapshot.practiceType,
    targetGroups: snapshot.targetGroups || [],
    environments: snapshot.environments || [],
    maturityLevel: snapshot.maturityLevel,
    riskLevel: snapshot.riskLevel,
    topics: snapshot.topics || [],
    tags: snapshot.tags || [],
    expectedOutcome: snapshot.expectedOutcome,
    learningPoints: snapshot.learningPoints,
    sources: snapshot.sources,
    status: "PUBLISHED",
    version: snapshot.version,
    updatedAt: snapshot.publishedAt,
    publishedAt: snapshot.publishedAt,
    professionalReviewedAt: snapshot.professionalReviewedAt,
    nextReviewAt: snapshot.nextReviewAt,
    reviewOverdue: Boolean(snapshot.nextReviewAt && new Date(snapshot.nextReviewAt).getTime() <= Date.now()),
    reviewRoles: snapshot.reviewRoles || published.version.professionalReviewRoles || [],
    ...counts
  };
}

function serializeReview(review, { includePrivate = false, includeAuthorFeedback = false } = {}) {
  const value = {
    capabilityType: review.capabilityType,
    reviewedVersion: review.reviewedVersion,
    decision: review.decision,
    decidedAt: review.decidedAt
  };
  if (includePrivate) {
    value.privateNotes = review.privateNotes || null;
    value.conflictNote = review.conflictNote || null;
  }
  if (includeAuthorFeedback) value.authorFeedback = review.authorFeedback || null;
  return value;
}

function serializeVersionHistory(versions) {
  return (versions || []).flatMap((version) => {
    const snapshot = version?.publicSnapshot;
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return [];
    return [{
      version: version.version,
      publishedAt: version.publishedAt || snapshot.publishedAt || null,
      nextReviewAt: version.nextReviewAt || snapshot.nextReviewAt || null,
      reviewRoles: version.professionalReviewRoles || snapshot.reviewRoles || [],
      snapshot: {
        title: snapshot.title,
        summary: snapshot.summary,
        suitableContext: snapshot.suitableContext,
        conditions: snapshot.conditions || [],
        limitations: snapshot.limitations,
        steps: snapshot.steps || [],
        practiceType: snapshot.practiceType,
        targetGroups: snapshot.targetGroups || [],
        environments: snapshot.environments || [],
        expectedOutcome: snapshot.expectedOutcome,
        learningPoints: snapshot.learningPoints,
        sources: snapshot.sources,
        topics: snapshot.topics || [],
        tags: snapshot.tags || []
      }
    }];
  });
}

export function serializeCandidate(practice, { reviewerId = "", authorView = true, includeVersionHistory = false } = {}) {
  if (!practice) return null;
  return {
    id: practice.publicId,
    title: practice.title,
    summary: practice.summary,
    background: practice.background,
    mainChallenge: practice.mainChallenge,
    whatHelped: practice.whatHelped,
    networkOrServiceRole: practice.networkOrServiceRole,
    outcome: practice.outcome,
    learningPoints: practice.learningPoints,
    limitations: practice.limitations,
    sources: practice.sources,
    suitableContext: practice.suitableContext,
    conditions: practice.conditions || [],
    steps: practice.steps || [],
    practiceType: practice.practiceType,
    targetGroups: practice.targetGroups || [],
    environments: practice.environments || [],
    maturityLevel: practice.maturityLevel,
    riskLevel: practice.riskLevel,
    topics: practice.topics || [],
    tags: practice.tags || [],
    status: practice.status,
    version: practice.version,
    contentVersion: practice.contentVersion,
    publishedVersion: practice.publishedVersion,
    identifiersConfirmed: Boolean(
      practice.ownerConfirmedNoIdentifiersAt
      && practice.ownerConfirmedNoIdentifiersVersion === practice.contentVersion
    ),
    professionalReviewedAt: practice.professionalReviewedAt,
    publishedAt: practice.publishedAt,
    nextReviewAt: practice.nextReviewAt,
    source: practice.sourceClosureId
      ? { type: "completed_case", linked: true }
      : { type: "professional_experience", linked: false },
    reviews: (practice.reviews || []).map((item) => serializeReview(item, {
      includePrivate: Boolean(reviewerId) && item.reviewerId === reviewerId,
      includeAuthorFeedback: authorView
    })),
    ...(includeVersionHistory ? { versionHistory: serializeVersionHistory(practice.versions) } : {}),
    assignedReviewRoles: [...new Set((practice.reviewAssignments || [])
      .filter((item) => item.status === "ASSIGNED" && item.contentVersion === practice.contentVersion)
      .map((item) => item.capabilityType))],
    createdAt: practice.createdAt,
    updatedAt: practice.updatedAt
  };
}

const practiceInclude = Object.freeze({
  versions: { orderBy: { version: "desc" }, take: 1 },
  reviews: { orderBy: { updatedAt: "desc" } },
  reviewAssignments: { orderBy: { assignedAt: "asc" } },
  applications: {
    where: { status: { in: ["SUBMITTED", "ACCEPTED"] } },
    select: { status: true, followUpAt: true }
  }
});

const practiceDetailInclude = Object.freeze({
  ...practiceInclude,
  versions: { orderBy: { version: "desc" }, take: 20 }
});

function sortPublished(items, sort) {
  const result = [...items];
  if (sort === "alphabetical") return result.sort((a, b) => a.title.localeCompare(b.title, "et"));
  if (sort === "reviewed") {
    return result.sort((a, b) => new Date(b.professionalReviewedAt || 0) - new Date(a.professionalReviewedAt || 0));
  }
  if (sort === "applications") return result.sort((a, b) => b.applicationCount - a.applicationCount);
  if (sort === "review_due") {
    return result.sort((a, b) => new Date(a.nextReviewAt || 8640000000000000) - new Date(b.nextReviewAt || 8640000000000000));
  }
  return result.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
}

function matchesSearch(practice, query) {
  if (!query) return true;
  const haystack = [
    practice.title, practice.summary, practice.suitableContext, practice.limitations,
    practice.practiceType, ...(practice.conditions || []), ...(practice.targetGroups || []),
    ...(practice.environments || []), ...(practice.topics || []), ...(practice.tags || [])
  ].join(" ").toLocaleLowerCase("et");
  return haystack.includes(query.toLocaleLowerCase("et"));
}

function matchesFilters(practice, query = {}) {
  if (!matchesSearch(practice, normalizeShort(query.q, 200))) return false;
  if (query.practiceType && practice.practiceType !== normalizeShort(query.practiceType, 120)) return false;
  if (query.maturity && practice.maturityLevel !== normalizeShort(query.maturity, 80)) return false;
  if (query.environment && !(practice.environments || []).includes(normalizeShort(query.environment, 120))) return false;
  return true;
}

function capabilityCanReadCandidate(capabilities, practice, actorId) {
  const matching = (capabilities || []).filter((item) => scopeMatchesPractice(item.scope, practice));
  const assigned = (practice.reviewAssignments || []).some((item) => (
    item.reviewerId === actorId
    && ["ASSIGNED", "COMPLETED", "DECLINED"].includes(item.status)
    && item.contentVersion === practice.contentVersion
    && matching.some((capability) => capability.type === item.capabilityType)
  ));
  if (practice.status === "READY_TO_PUBLISH") {
    return assigned || matching.some((item) => item.type === "APPROVER");
  }
  if (REVIEWABLE_STATUSES.has(practice.status) || practice.status === "NEEDS_CHANGES") return assigned;
  return false;
}

function serializeApplicationForReview(application) {
  const snapshot = applicationPracticeSnapshot(application);
  return {
    id: application.publicId,
    status: application.status,
    version: application.version,
    versionUsed: application.versionUsed,
    context: application.context,
    targetGroup: application.targetGroup,
    adaptations: application.adaptations,
    whatWorked: application.whatWorked,
    whatDidNot: application.whatDidNot,
    limitationOrRisk: application.limitationOrRisk,
    followUpAt: application.followUpAt,
    needsReview: application.needsReview,
    assignedCapabilityType: application.assignedCapabilityType,
    createdAt: application.createdAt,
    practice: {
      id: snapshot.publicId,
      title: snapshot.title,
      practiceType: snapshot.practiceType,
      topics: snapshot.topics || []
    }
  };
}

function serializeOwnApplication(application) {
  const snapshot = applicationPracticeSnapshot(application);
  return {
    id: application.publicId,
    status: application.status,
    version: application.version,
    versionUsed: application.versionUsed,
    context: application.context,
    targetGroup: application.targetGroup,
    adaptations: application.adaptations,
    whatWorked: application.whatWorked,
    whatDidNot: application.whatDidNot,
    limitationOrRisk: application.limitationOrRisk,
    followUpAt: application.followUpAt,
    needsReview: application.needsReview,
    reviewNote: application.reviewNote || null,
    reviewedAt: application.reviewedAt || null,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
    practice: {
      id: snapshot.publicId,
      title: snapshot.title,
      practiceType: snapshot.practiceType
    }
  };
}

async function queueRagDeletionTx(tx, practice, reason, actorUserId = null) {
  if (!practice?.ragSourceId) return null;
  const job = await tx.dataDeletionJob.create({
    data: {
      actorUserId,
      action: "RAG_DELETE",
      resourceType: "EffectivePractice",
      resourceId: practice.id,
      externalRef: practice.ragSourceId,
      storagePath: reason,
      status: "pending"
    }
  });
  return { jobId: job.id, practiceId: practice.id, docId: practice.ragSourceId, reason };
}

async function sourceCaseParticipantTx(tx, practice, actor) {
  if (!practice?.sourceClosureId && !practice?.sourceCovisionCaseId) return false;
  const participantWhere = { OR: covisionParticipantIdentityOr(actor) };
  const selectCase = {
    ownerId: true,
    participants: { where: participantWhere, select: { id: true }, take: 1 }
  };
  let sourceCase = null;
  if (practice.sourceClosureId) {
    const source = await tx.covisionClosure.findUnique({
      where: { id: practice.sourceClosureId },
      select: { covisionCase: { select: selectCase } }
    });
    sourceCase = source?.covisionCase || null;
  } else {
    sourceCase = await tx.covisionCase.findUnique({
      where: { id: practice.sourceCovisionCaseId },
      select: selectCase
    });
  }
  return sourceCase?.ownerId === actor.userId || Boolean(sourceCase?.participants?.length);
}

function deterministicRagDocumentId(publicId, version) {
  return `effective-practice::${normalizeId(publicId)}::v${Number(version)}`;
}

export function createEffectivePracticeService(db = prisma, dependencies = {}) {
  const now = dependencies.now || (() => new Date());
  const syncPublishedSnapshot = dependencies.syncPublishedSnapshot || defaultSyncPublishedSnapshot;
  const removePublishedSnapshot = dependencies.removePublishedSnapshot || defaultRemovePublishedSnapshot;

  async function processRagDeletion(removal, actor) {
    if (!removal) return { status: "skipped" };
    let externallyRemoved = false;
    try {
      const result = await removePublishedSnapshot(removal.docId, actor);
      if (result?.ok === false || result?.status === "failed") {
        throw new Error(normalizeText(result?.error, 500) || "RAG_DELETE_FAILED");
      }
      externallyRemoved = true;
      await db.$transaction(async (tx) => {
        await tx.dataDeletionJob.update({
          where: { id: removal.jobId },
          data: { status: "done", attempts: { increment: 1 }, lastError: null }
        });
        await tx.effectivePractice.updateMany({
          where: { id: removal.practiceId, ragSourceId: removal.docId },
          data: {
            ragSourceId: null,
            ragMetadata: { syncStatus: "removed", reason: removal.reason, checkedAt: now().toISOString() }
          }
        });
      });
      return { status: "removed" };
    } catch (error) {
      const message = normalizeText(error?.message, 500) || "RAG_DELETE_FAILED";
      await db.$transaction(async (tx) => {
        await tx.dataDeletionJob.update({
          where: { id: removal.jobId },
          data: { status: "failed", attempts: { increment: 1 }, lastError: message }
        }).catch(() => null);
        await tx.effectivePractice.update({
          where: { id: removal.practiceId },
          data: { ragMetadata: { syncStatus: "removal_failed", reason: removal.reason, checkedAt: now().toISOString() } }
        }).catch(() => null);
      }).catch(() => null);
      return { status: externallyRemoved ? "removed_unrecorded" : "failed" };
    }
  }

  async function loadByPublicId(publicId, include = practiceInclude) {
    const id = normalizeId(publicId);
    if (!id) throw notFound();
    const practice = await db.effectivePractice.findUnique({
      where: { publicId: id },
      ...(include ? { include } : {})
    });
    if (!practice) throw notFound();
    return practice;
  }

  async function listWorkspace(actorValue, query = {}) {
    const actor = normalizeActor(actorValue);
    const current = now();
    const canCreate = ["SOCIAL_WORKER", "SERVICE_PROVIDER"].includes(actor.role);
    const [capabilities, publishedRows, candidates, ownApplications] = await Promise.all([
      activeCapabilities(db, actor.userId, current),
      db.effectivePractice.findMany({
        where: { status: "PUBLISHED", versions: { some: {} } },
        orderBy: { updatedAt: "desc" },
        take: 200,
        include: practiceInclude
      }),
      canCreate ? db.effectivePractice.findMany({
        where: { authorId: actor.userId },
        orderBy: { updatedAt: "desc" },
        take: 100,
        include: practiceInclude
      }) : Promise.resolve([]),
      db.effectivePracticeApplication.findMany({
        where: { authorId: actor.userId },
        orderBy: { updatedAt: "desc" },
        take: 100,
        include: { practice: true }
      })
    ]);
    const reviewerCapabilities = capabilities.filter((item) => CAPABILITY_TYPES.has(item.type));
    let reviewQueue = [];
    let applicationQueue = [];
    if (reviewerCapabilities.some((item) => REVIEW_TYPES.has(item.type) || item.type === "APPROVER")) {
      const rows = await db.effectivePractice.findMany({
        where: { status: { in: ["SUBMITTED", "IN_REVIEW", "RE_REVIEW", "READY_TO_PUBLISH"] } },
        orderBy: { updatedAt: "asc" },
        take: 200,
        include: practiceInclude
      });
      reviewQueue = rows.filter((practice) => (
        practice.authorId !== actor.userId
        && capabilityCanReadCandidate(reviewerCapabilities, practice, actor.userId)
      )).map((practice) => serializeCandidate(practice, { reviewerId: actor.userId, authorView: false }));
      if (reviewerCapabilities.some((item) => REVIEW_TYPES.has(item.type))) {
        const applications = await db.effectivePracticeApplication.findMany({
          where: { status: "SUBMITTED", assignedReviewerId: actor.userId, authorId: { not: actor.userId } },
          orderBy: { createdAt: "asc" },
          take: 100,
          include: { practice: true }
        });
        applicationQueue = applications.filter((item) => (
          reviewerCapabilities.some((capability) => (
            capability.type === item.assignedCapabilityType
            && REVIEW_TYPES.has(capability.type)
            && scopeMatchesPractice(capability.scope, applicationPracticeScope(item))
          ))
        )).map(serializeApplicationForReview);
      }
    }
    const published = sortPublished(
      publishedRows.map(serializePublishedPractice).filter(Boolean).filter((item) => matchesFilters(item, query)),
      normalizeShort(query.sort, 40)
    );
    return {
      profile: {
        professionalRole: actor.role || "PROFESSIONAL",
        capabilities: reviewerCapabilities.map((item) => ({
          type: item.type,
          scope: item.scope || "*",
          validUntil: item.validUntil || null
        }))
      },
      capabilities: {
        canCreate,
        canReview: reviewerCapabilities.length > 0,
        types: [...new Set(reviewerCapabilities.map((item) => item.type))]
      },
      practices: published,
      candidates: candidates.map((item) => serializeCandidate(item)),
      myApplications: ownApplications.map(serializeOwnApplication),
      reviewQueue,
      applicationQueue
    };
  }

  async function createCandidate(actorValue, input) {
    const actor = normalizeActor(actorValue);
    if (!["SOCIAL_WORKER", "SERVICE_PROVIDER"].includes(actor.role)) throw forbidden();
    const data = normalizeCandidateInput(input || {});
    const practice = await db.effectivePractice.create({
      data: {
        authorId: actor.userId,
        ...data,
        status: "DRAFT",
        version: 0,
        contentVersion: 0,
        ownerConfirmedNoIdentifiersVersion: data.ownerConfirmedNoIdentifiersAt ? 0 : null,
        publishedVersion: null,
        ragSourceId: null,
        ragMetadata: null,
        sourceCovisionCaseId: null,
        sourceClosureId: null
      },
      include: practiceInclude
    });
    return serializeCandidate(practice);
  }

  async function updateCandidate(actorValue, publicId, input) {
    const actor = normalizeActor(actorValue);
    if (!["SOCIAL_WORKER", "SERVICE_PROVIDER"].includes(actor.role)) throw forbidden();
    assertObject(input);
    const expectedVersion = normalizeExpectedVersion(input.expectedVersion);
    const data = normalizeCandidateInput(input, { partial: true });
    delete data.expectedVersion;
    const existing = await loadByPublicId(publicId, false);
    if (existing.authorId !== actor.userId) throw notFound();
    if (!EDITABLE_STATUSES.has(existing.status)) throw conflict("CANDIDATE_LOCKED");
    const contentChanged = Object.keys(input).some((key) => CONTENT_FIELDS.has(key));
    const nextContentVersion = existing.contentVersion + (contentChanged ? 1 : 0);
    const explicitlyConfirmed = input.ownerConfirmedNoIdentifiers === true;
    if (contentChanged) {
      data.contentVersion = { increment: 1 };
      data.anonymityCheckedAt = null;
      data.anonymityCheckedVersion = null;
    }
    if (explicitlyConfirmed) {
      data.ownerConfirmedNoIdentifiersAt = now();
      data.ownerConfirmedNoIdentifiersVersion = nextContentVersion;
    } else if (contentChanged || input.ownerConfirmedNoIdentifiers === false) {
      data.ownerConfirmedNoIdentifiersAt = null;
      data.ownerConfirmedNoIdentifiersVersion = null;
    }
    const updated = await db.effectivePractice.updateMany({
      where: { id: existing.id, authorId: actor.userId, version: expectedVersion, status: existing.status },
      data: { ...data, version: { increment: 1 } }
    });
    if (!updated || updated.count !== 1) throw conflict();
    return serializeCandidate(await loadByPublicId(publicId));
  }

  async function getDetail(actorValue, publicId) {
    const actor = normalizeActor(actorValue);
    const practice = await loadByPublicId(publicId, practiceDetailInclude);
    if (practice.status === "PUBLISHED") {
      const published = serializePublishedPractice(practice);
      const ownerCanAudit = practice.authorId === actor.userId && ["SOCIAL_WORKER", "SERVICE_PROVIDER"].includes(actor.role);
      const capabilities = ownerCanAudit ? [] : await activeCapabilities(db, actor.userId, now());
      const capabilityCanAudit = capabilities.some((item) => (
        CAPABILITY_TYPES.has(item.type) && scopeMatchesPractice(item.scope, published)
      ));
      return {
        kind: "published",
        practice: ownerCanAudit || capabilityCanAudit
          ? { ...published, versionHistory: serializeVersionHistory(practice.versions) }
          : published
      };
    }
    if (practice.authorId === actor.userId && ["SOCIAL_WORKER", "SERVICE_PROVIDER"].includes(actor.role)) {
      return { kind: "candidate", practice: serializeCandidate(practice, { includeVersionHistory: true }) };
    }
    const capabilities = await activeCapabilities(db, actor.userId, now());
    const canReview = capabilityCanReadCandidate(capabilities, practice, actor.userId);
    if (!canReview) throw notFound();
    return { kind: "review", practice: serializeCandidate(practice, { reviewerId: actor.userId, authorView: false, includeVersionHistory: true }) };
  }

  async function submitCandidate(tx, actor, practice, request) {
    if (!["SOCIAL_WORKER", "SERVICE_PROVIDER"].includes(actor.role)) throw forbidden();
    if (practice.authorId !== actor.userId) throw notFound();
    if (!EDITABLE_STATUSES.has(practice.status)) throw conflict("CANDIDATE_LOCKED");
    if (!candidateReady(practice)) throw fail("effective_practices.errors.incomplete", 409, "CANDIDATE_INCOMPLETE");
    const updated = await tx.effectivePractice.updateMany({
      where: { id: practice.id, version: request.expectedVersion, status: practice.status },
      data: {
        status: "SUBMITTED",
        version: { increment: 1 },
        contentVersion: { increment: 1 },
        ownerConfirmedNoIdentifiersVersion: practice.contentVersion + 1,
        anonymityCheckedAt: null,
        anonymityCheckedVersion: null
      }
    });
    if (!updated || updated.count !== 1) throw conflict();
    await assignReviewersTx(tx, practice, practice.contentVersion + 1, now());
    await recordAudit(
      tx,
      { ...practice, contentVersion: practice.contentVersion + 1 },
      actor.userId,
      "SUBMITTED",
      practice.status,
      "SUBMITTED"
    );
  }

  async function reviewCandidate(tx, actor, practice, request, capabilities) {
    if (practice.authorId === actor.userId) {
      throw fail("effective_practices.errors.self_review", 403, "SELF_REVIEW_FORBIDDEN");
    }
    if (!REVIEWABLE_STATUSES.has(practice.status)) throw conflict("NOT_REVIEWABLE");
    const capabilityType = normalizeShort(request.capabilityType).toUpperCase();
    if (!REVIEW_TYPES.has(capabilityType)) throw invalid();
    const capability = requireCapability(capabilities, capabilityType, practice);
    const assignment = await tx.effectivePracticeReviewAssignment.findFirst({
      where: {
        practiceId: practice.id,
        reviewerId: actor.userId,
        capabilityType,
        contentVersion: practice.contentVersion,
        status: "ASSIGNED"
      }
    });
    if (!assignment) throw forbidden();
    const decision = normalizeShort(request.decision).toUpperCase();
    if (!new Set(["APPROVED", "NEEDS_CHANGES", "DECLINED", "CONFLICT"]).has(decision)) throw invalid();
    const conflictStatus = normalizeShort(request.conflictStatus).toUpperCase();
    if (!new Set(["NONE", "MANAGEABLE", "DECLINED"]).has(conflictStatus)) throw invalid();
    const privateNotes = normalizeText(request.privateNotes, 4_000) || null;
    const authorFeedback = normalizeText(request.authorFeedback, 4_000) || null;
    if (["NEEDS_CHANGES", "DECLINED"].includes(decision) && !authorFeedback) throw invalid();
    if (decision === "CONFLICT" && !privateNotes) throw invalid();
    if (conflictStatus !== "NONE" && !privateNotes) throw invalid();
    if (conflictStatus === "DECLINED" && decision !== "CONFLICT") throw invalid();
    if (conflictStatus === "NONE" && decision === "CONFLICT") throw invalid();
    if (await sourceCaseParticipantTx(tx, practice, actor) && conflictStatus !== "DECLINED") {
      throw fail("effective_practices.errors.conflict_of_interest", 403, "SOURCE_CASE_PARTICIPANT");
    }
    await tx.effectivePracticeReview.create({
      data: {
        practiceId: practice.id,
        reviewerId: actor.userId,
        capabilityType,
        scope: capability.scope || "",
        reviewedVersion: practice.contentVersion,
        decision,
        conflictStatus,
        authorFeedback,
        privateNotes,
        conflictNote: conflictStatus !== "NONE" ? privateNotes : null,
        decidedAt: now()
      }
    });
    await tx.effectivePracticeReviewAssignment.update({
      where: { id: assignment.id },
      data: {
        status: decision === "CONFLICT" ? "DECLINED" : "COMPLETED",
        completedAt: now()
      }
    });
    if (decision === "NEEDS_CHANGES" || decision === "DECLINED") {
      const updated = await tx.effectivePractice.updateMany({
        where: { id: practice.id, version: request.expectedVersion },
        data: { status: "NEEDS_CHANGES", version: { increment: 1 } }
      });
      if (!updated || updated.count !== 1) throw conflict();
      await recordAudit(tx, practice, actor.userId, `REVIEW_${decision}`, practice.status, "NEEDS_CHANGES", {
        capabilityType,
        conflictStatus
      });
      return;
    }
    if (decision === "CONFLICT") {
      await assignReplacementReviewerTx(
        tx,
        practice,
        capabilityType,
        practice.contentVersion,
        now(),
        [actor.userId]
      );
      const updated = await tx.effectivePractice.updateMany({
        where: { id: practice.id, version: request.expectedVersion },
        data: { status: "IN_REVIEW", version: { increment: 1 } }
      });
      if (!updated || updated.count !== 1) throw conflict();
      await recordAudit(tx, practice, actor.userId, "REVIEW_CONFLICT", practice.status, "IN_REVIEW", {
        capabilityType,
        conflictStatus
      });
      return;
    }
    const reviews = await tx.effectivePracticeReview.findMany({
      where: { practiceId: practice.id, reviewedVersion: practice.contentVersion }
    });
    const approvals = latestReviewDecisions(reviews).filter((item) => item.decision === "APPROVED");
    const roles = new Set(approvals.map((item) => item.capabilityType));
    const lowReady = roles.has("REVIEWER") && roles.has("EDITOR") && roles.has("ETHICS");
    const reviewerPeople = new Set(approvals
      .filter((item) => item.capabilityType === "REVIEWER")
      .map((item) => item.reviewerId)
      .filter(Boolean));
    const highReady = lowReady && reviewerPeople.size >= 2;
    const ready = practice.riskLevel === "HIGH" ? highReady : lowReady;
    const ethicsApproved = capabilityType === "ETHICS" || roles.has("ETHICS");
    const reviewedAt = now();
    const updated = await tx.effectivePractice.updateMany({
      where: { id: practice.id, version: request.expectedVersion },
      data: {
        status: ready ? "READY_TO_PUBLISH" : "IN_REVIEW",
        professionalReviewedAt: ready ? reviewedAt : practice.professionalReviewedAt,
        reviewedAt: ready ? reviewedAt : practice.reviewedAt,
        anonymityCheckedAt: ethicsApproved ? reviewedAt : practice.anonymityCheckedAt,
        anonymityCheckedVersion: ethicsApproved ? practice.contentVersion : practice.anonymityCheckedVersion,
        version: { increment: 1 }
      }
    });
    if (!updated || updated.count !== 1) throw conflict();
    await recordAudit(tx, practice, actor.userId, "REVIEW_APPROVED", practice.status, ready ? "READY_TO_PUBLISH" : "IN_REVIEW", {
      capabilityType,
      conflictStatus
    });
  }

  async function publishCandidate(tx, actor, practice, request, capabilities) {
    if (practice.authorId === actor.userId) {
      throw fail("effective_practices.errors.self_review", 403, "SELF_PUBLISH_FORBIDDEN");
    }
    requireCapability(capabilities, "APPROVER", practice);
    if (await sourceCaseParticipantTx(tx, practice, actor)) {
      throw fail("effective_practices.errors.conflict_of_interest", 403, "SOURCE_CASE_PARTICIPANT_APPROVER");
    }
    if (practice.status !== "READY_TO_PUBLISH") throw conflict("NOT_READY_TO_PUBLISH");
    const nextReviewAt = dateOrNull(request.nextReviewAt);
    if (!nextReviewAt || nextReviewAt <= now()) throw invalid();
    const reviews = await tx.effectivePracticeReview.findMany({
      where: { practiceId: practice.id, reviewedVersion: practice.contentVersion },
      orderBy: { decidedAt: "desc" }
    });
    const currentReviews = latestReviewDecisions(reviews).filter((item) => item.decision === "APPROVED");
    const roles = [...new Set(currentReviews.map((item) => item.capabilityType))];
    const reviewerPeople = new Set(currentReviews
      .filter((item) => item.capabilityType === "REVIEWER")
      .map((item) => item.reviewerId)
      .filter(Boolean));
    if (!roles.includes("REVIEWER") || !roles.includes("EDITOR") || !roles.includes("ETHICS")) {
      throw fail("effective_practices.errors.review_chain", 409, "REVIEW_CHAIN_INCOMPLETE");
    }
    if (practice.riskLevel === "HIGH" && (!roles.includes("ETHICS") || reviewerPeople.size < 2)) {
      throw fail("effective_practices.errors.review_chain", 409, "HIGH_RISK_REVIEW_CHAIN_INCOMPLETE");
    }
    if (
      !practice.anonymityCheckedAt
      || practice.anonymityCheckedVersion !== practice.contentVersion
      || containsDirectIdentifier(practice)
    ) {
      throw fail("effective_practices.errors.incomplete", 409, "PRIVACY_CHECK_INCOMPLETE");
    }
    const pendingDeletion = await tx.dataDeletionJob.findFirst({
      where: {
        resourceType: "EffectivePractice",
        resourceId: practice.id,
        action: "RAG_DELETE",
        status: { in: ["guard", "pending", "failed"] }
      },
      select: { id: true }
    });
    if (pendingDeletion) throw conflict("RAG_REMOVAL_PENDING");
    const releaseVersion = Number(practice.publishedVersion || 0) + 1;
    const publishedAt = now();
    const snapshot = snapshotFromPractice(practice, roles, releaseVersion, publishedAt, nextReviewAt);
    await tx.effectivePracticeVersion.create({
      data: {
        practiceId: practice.id,
        version: releaseVersion,
        publicSnapshot: snapshot,
        professionalReviewRoles: roles,
        publishedById: actor.userId,
        publishedAt,
        nextReviewAt
      }
    });
    const updated = await tx.effectivePractice.updateMany({
      where: { id: practice.id, version: request.expectedVersion, status: "READY_TO_PUBLISH" },
      data: {
        status: "PUBLISHED",
        publishedVersion: releaseVersion,
        publishedAt,
        nextReviewAt,
        professionalReviewedAt: practice.professionalReviewedAt || publishedAt,
        version: { increment: 1 },
        ragSourceId: null,
        ragMetadata: { syncStatus: "pending", publishedVersion: releaseVersion, checkedAt: publishedAt.toISOString() }
      }
    });
    if (!updated || updated.count !== 1) throw conflict();
    await recordAudit(tx, practice, actor.userId, "PUBLISHED", practice.status, "PUBLISHED", {
      publishedVersion: releaseVersion,
      reviewRoles: roles
    });
    const expectedDocId = deterministicRagDocumentId(practice.publicId, releaseVersion);
    const guard = await tx.dataDeletionJob.create({
      data: {
        actorUserId: actor.userId,
        action: "RAG_DELETE",
        resourceType: "EffectivePractice",
        resourceId: practice.id,
        externalRef: expectedDocId,
        storagePath: `publish_link_guard:v${releaseVersion}`,
        status: "guard"
      }
    });
    return { snapshot, releaseVersion, expectedDocId, guardId: guard.id };
  }

  async function actionCandidate(actorValue, publicId, input) {
    const actor = normalizeActor(actorValue);
    assertObject(input);
    assertOnlyKeys(input, new Set([
      "expectedVersion", "action", "capabilityType", "decision", "conflictStatus", "authorFeedback", "privateNotes", "nextReviewAt"
    ]));
    const request = {
      ...input,
      action: normalizeShort(input.action).toLowerCase(),
      expectedVersion: normalizeExpectedVersion(input.expectedVersion)
    };
    let publication = null;
    let removal = null;
    const resultId = await db.$transaction(async (tx) => {
      const practice = await tx.effectivePractice.findUnique({
        where: { publicId: normalizeId(publicId) },
        include: practiceInclude
      });
      if (!practice) throw notFound();
      if (practice.version !== request.expectedVersion) throw conflict();
      const capabilities = await activeCapabilities(tx, actor.userId, now());
      if (request.action === "submit") {
        await submitCandidate(tx, actor, practice, request);
      } else if (request.action === "review") {
        await reviewCandidate(tx, actor, practice, request, capabilities);
      } else if (request.action === "publish") {
        publication = await publishCandidate(tx, actor, practice, request, capabilities);
      } else if (request.action === "archive") {
        if (!["SOCIAL_WORKER", "SERVICE_PROVIDER"].includes(actor.role)) throw forbidden();
        if (practice.authorId !== actor.userId) throw notFound();
        if (practice.status === "PUBLISHED") throw conflict("PUBLISHED_ARCHIVE_REQUIRES_REVIEW");
        const updated = await tx.effectivePractice.updateMany({
          where: { id: practice.id, version: request.expectedVersion },
          data: { status: "ARCHIVED", version: { increment: 1 } }
        });
        if (!updated || updated.count !== 1) throw conflict();
        await recordAudit(tx, practice, actor.userId, "ARCHIVED", practice.status, "ARCHIVED");
      } else if (request.action === "re_review") {
        requireCapability(capabilities, "ETHICS", practice);
        if (practice.status !== "PUBLISHED") throw conflict("NOT_PUBLISHED");
        removal = await queueRagDeletionTx(tx, practice, "re_review", actor.userId);
        const updated = await tx.effectivePractice.updateMany({
          where: { id: practice.id, version: request.expectedVersion },
          data: {
            status: "RE_REVIEW",
            version: { increment: 1 },
            contentVersion: { increment: 1 },
            ownerConfirmedNoIdentifiersVersion: practice.ownerConfirmedNoIdentifiersAt
              ? practice.contentVersion + 1
              : null,
            anonymityCheckedAt: null,
            anonymityCheckedVersion: null,
            professionalReviewedAt: null,
            ragMetadata: { syncStatus: "removal_pending", reason: "re_review", checkedAt: now().toISOString() }
          }
        });
        if (!updated || updated.count !== 1) throw conflict();
        await assignReviewersTx(tx, practice, practice.contentVersion + 1, now());
        await recordAudit(
          tx,
          { ...practice, contentVersion: practice.contentVersion + 1 },
          actor.userId,
          "RE_REVIEW_STARTED",
          practice.status,
          "RE_REVIEW"
        );
      } else {
        throw invalid();
      }
      return practice.id;
    });

    let ragSync = null;
    if (removal) await processRagDeletion(removal, actor);
    if (publication) {
      const expectedDocId = publication.expectedDocId;
      try {
        ragSync = await syncPublishedSnapshot({
          publicId: normalizeId(publicId),
          snapshot: publication.snapshot,
          version: publication.releaseVersion
        }, actor);
        if (ragSync?.docId && ragSync.docId !== expectedDocId) throw new Error("RAG_DOCUMENT_ID_MISMATCH");
        await db.$transaction(async (tx) => {
          const linked = await tx.effectivePractice.updateMany({
            where: {
              id: resultId,
              status: "PUBLISHED",
              publishedVersion: publication.releaseVersion
            },
            data: {
              ragSourceId: ragSync?.docId || null,
              ragMetadata: {
                syncStatus: ragSync?.status || "skipped",
                reason: ragSync?.reason || null,
                publishedVersion: publication.releaseVersion,
                checkedAt: now().toISOString()
              }
            }
          });
          if (!linked || linked.count !== 1) throw conflict("PUBLISH_LINK_STALE");
          await tx.dataDeletionJob.update({
            where: { id: publication.guardId },
            data: { status: "done", attempts: { increment: 1 }, lastError: null }
          });
        });
      } catch {
        // The external service can ingest successfully and still time out before
        // returning a response. The id is deterministic, so always compensate
        // that possible orphan instead of relying on an unavailable response.
        const orphanDocId = expectedDocId;
        await db.effectivePractice.updateMany({
          where: { id: resultId, status: "PUBLISHED", publishedVersion: publication.releaseVersion },
          data: {
            ragMetadata: {
              syncStatus: "failed",
              reason: "rag_sync_failed",
              publishedVersion: publication.releaseVersion,
              checkedAt: now().toISOString()
            }
          }
        }).catch(() => null);
        const compensation = await processRagDeletion({
          jobId: publication.guardId,
          practiceId: resultId,
          docId: orphanDocId,
          reason: "publish_response_unknown"
        }, actor);
        ragSync = {
          status: compensation.status === "removed"
            ? "compensated"
            : compensation.status === "removed_unrecorded"
              ? "compensation_pending"
              : "compensation_failed"
        };
      }
    }
    try {
      const detail = await getDetail(actor, publicId);
      return { ...detail, publication: publication ? { published: true, ragSync: ragSync?.status || "skipped" } : null };
    } catch (error) {
      if (error?.status !== 404) throw error;
      const fresh = await loadByPublicId(publicId, false);
      return {
        kind: "action_result",
        completed: true,
        practice: { id: fresh.publicId, status: fresh.status, version: fresh.version },
        publication: publication ? { published: true, ragSync: ragSync?.status || "skipped" } : null
      };
    }
  }

  async function addApplication(actorValue, publicId, input) {
    const actor = normalizeActor(actorValue);
    assertObject(input);
    assertOnlyKeys(input, new Set([
      "context", "targetGroup", "versionUsed", "adaptations", "whatWorked",
      "whatDidNot", "limitationOrRisk", "followUpAt", "needsReview", "submit"
    ]));
    const practice = await loadByPublicId(publicId);
    if (practice.status !== "PUBLISHED" || !publicSnapshotOf(practice)) throw notFound();
    const data = {
      context: normalizeText(input.context, 4_000),
      targetGroup: normalizeText(input.targetGroup, 2_000),
      versionUsed: Number(input.versionUsed),
      adaptations: normalizeText(input.adaptations, 4_000),
      whatWorked: normalizeText(input.whatWorked, 4_000),
      whatDidNot: normalizeText(input.whatDidNot, 4_000),
      limitationOrRisk: normalizeText(input.limitationOrRisk, 4_000),
      followUpAt: dateOrNull(input.followUpAt),
      needsReview: input.needsReview === true,
      status: input.submit === true ? "SUBMITTED" : "DRAFT"
    };
    if (
      !data.context || !data.targetGroup || !Number.isInteger(data.versionUsed)
      || data.versionUsed !== practice.publishedVersion || !data.adaptations
      || !data.whatWorked || !data.whatDidNot || !data.limitationOrRisk || !data.followUpAt
    ) throw invalid();
    const application = await db.$transaction(async (tx) => {
      const fresh = await tx.effectivePractice.findUnique({
        where: { id: practice.id },
        include: { versions: { orderBy: { version: "desc" }, take: 1 } }
      });
      if (!fresh || fresh.status !== "PUBLISHED" || fresh.publishedVersion !== data.versionUsed) throw conflict();
      const published = publicSnapshotOf(fresh);
      if (!published || Number(published.snapshot?.version) !== data.versionUsed) throw conflict();
      const frozenPractice = {
        ...published.snapshot,
        authorId: fresh.authorId,
        id: fresh.id,
        publicId: published.snapshot.publicId || fresh.publicId
      };
      const assignment = data.status === "SUBMITTED"
        ? await chooseApplicationReviewerTx(tx, frozenPractice, actor.userId, now())
        : null;
      return tx.effectivePracticeApplication.create({
        data: {
          practiceId: fresh.id,
          authorId: actor.userId,
          practiceSnapshot: published.snapshot,
          assignedReviewerId: assignment?.userId || null,
          assignedCapabilityType: assignment?.type || null,
          ...data,
          status: data.status === "SUBMITTED" && !assignment ? "WAITING_FOR_REVIEW" : data.status
        }
      });
    });
    return {
      id: application.publicId,
      status: application.status,
      version: application.version,
      versionUsed: application.versionUsed,
      needsReview: application.needsReview,
      followUpAt: application.followUpAt,
      createdAt: application.createdAt
    };
  }

  async function reviewApplication(actorValue, applicationPublicId, input) {
    const actor = normalizeActor(actorValue);
    assertObject(input);
    assertOnlyKeys(input, new Set([
      "expectedVersion", "action", "capabilityType", "reviewNote", "context", "targetGroup",
      "adaptations", "whatWorked", "whatDidNot", "limitationOrRisk", "followUpAt", "needsReview"
    ]));
    const expectedVersion = normalizeExpectedVersion(input.expectedVersion);
    const action = normalizeShort(input.action).toUpperCase();
    if (!new Set(["ACCEPTED", "NEEDS_CHANGES", "REJECTED", "RESUBMIT"]).has(action)) throw invalid();
    if (action === "RESUBMIT") {
      const data = {
        context: normalizeText(input.context, 4_000),
        targetGroup: normalizeText(input.targetGroup, 2_000),
        adaptations: normalizeText(input.adaptations, 4_000),
        whatWorked: normalizeText(input.whatWorked, 4_000),
        whatDidNot: normalizeText(input.whatDidNot, 4_000),
        limitationOrRisk: normalizeText(input.limitationOrRisk, 4_000),
        followUpAt: dateOrNull(input.followUpAt),
        needsReview: input.needsReview === true
      };
      if (
        !data.context || !data.targetGroup || !data.adaptations || !data.whatWorked
        || !data.whatDidNot || !data.limitationOrRisk || !data.followUpAt
      ) throw invalid();
      const resubmitted = await db.$transaction(async (tx) => {
        const existing = await tx.effectivePracticeApplication.findUnique({
          where: { publicId: normalizeId(applicationPublicId) },
          include: { practice: true }
        });
        if (!existing || existing.authorId !== actor.userId || existing.status !== "NEEDS_CHANGES") throw notFound();
        const assignment = await chooseApplicationReviewerTx(tx, applicationPracticeScope(existing), actor.userId, now());
        const updated = await tx.effectivePracticeApplication.updateMany({
          where: { id: existing.id, version: expectedVersion, status: "NEEDS_CHANGES", authorId: actor.userId },
          data: {
            ...data,
            status: assignment ? "SUBMITTED" : "WAITING_FOR_REVIEW",
            version: { increment: 1 },
            assignedReviewerId: assignment?.userId || null,
            assignedCapabilityType: assignment?.type || null,
            reviewedById: null,
            reviewNote: null,
            reviewedAt: null
          }
        });
        if (!updated || updated.count !== 1) throw conflict();
        await recordAudit(tx, existing.practice, actor.userId, "APPLICATION_RESUBMITTED", existing.practice.status, existing.practice.status, {
          applicationPublicId: existing.publicId
        });
        return tx.effectivePracticeApplication.findUnique({ where: { id: existing.id } });
      });
      return {
        id: resubmitted.publicId,
        status: resubmitted.status,
        version: resubmitted.version,
        reviewedAt: resubmitted.reviewedAt
      };
    }
    const capabilityType = normalizeShort(input.capabilityType).toUpperCase();
    if (!REVIEW_TYPES.has(capabilityType)) throw invalid();
    const reviewNote = normalizeText(input.reviewNote, 4_000) || null;
    if (action !== "ACCEPTED" && !reviewNote) throw invalid();
    let removal = null;
    const application = await db.$transaction(async (tx) => {
      const existing = await tx.effectivePracticeApplication.findUnique({
        where: { publicId: normalizeId(applicationPublicId) },
        include: { practice: true }
      });
      if (!existing || existing.status !== "SUBMITTED") throw notFound();
      if (existing.authorId === actor.userId || existing.practice.authorId === actor.userId) {
        throw fail("effective_practices.errors.self_review", 403, "SELF_APPLICATION_REVIEW");
      }
      if (existing.assignedReviewerId !== actor.userId || existing.assignedCapabilityType !== capabilityType) throw notFound();
      const capabilities = await activeCapabilities(tx, actor.userId, now());
      requireCapability(capabilities, capabilityType, applicationPracticeScope(existing));
      const updated = await tx.effectivePracticeApplication.updateMany({
        where: { id: existing.id, version: expectedVersion, status: "SUBMITTED" },
        data: {
          status: action,
          version: { increment: 1 },
          reviewedById: actor.userId,
          reviewNote,
          reviewedAt: now()
        }
      });
      if (!updated || updated.count !== 1) throw conflict();
      await recordAudit(tx, existing.practice, actor.userId, `APPLICATION_${action}`, existing.practice.status, existing.practice.status, {
        applicationPublicId: existing.publicId,
        capabilityType
      });
      if (action === "ACCEPTED" && existing.needsReview && existing.practice.status === "PUBLISHED") {
        removal = await queueRagDeletionTx(tx, existing.practice, "accepted_application_risk", actor.userId);
        const practiceUpdated = await tx.effectivePractice.updateMany({
          where: { id: existing.practice.id, version: existing.practice.version, status: "PUBLISHED" },
          data: {
            status: "RE_REVIEW",
            version: { increment: 1 },
            contentVersion: { increment: 1 },
            ownerConfirmedNoIdentifiersVersion: existing.practice.ownerConfirmedNoIdentifiersAt
              ? existing.practice.contentVersion + 1
              : null,
            anonymityCheckedAt: null,
            anonymityCheckedVersion: null,
            professionalReviewedAt: null,
            ragMetadata: {
              syncStatus: "removal_pending",
              reason: "accepted_application_risk",
              checkedAt: now().toISOString()
            }
          }
        });
        if (!practiceUpdated || practiceUpdated.count !== 1) throw conflict();
        await assignReviewersTx(tx, existing.practice, existing.practice.contentVersion + 1, now());
        await recordAudit(tx, { ...existing.practice, contentVersion: existing.practice.contentVersion + 1 }, actor.userId, "APPLICATION_RISK_REVIEW", "PUBLISHED", "RE_REVIEW", {
          applicationPublicId: existing.publicId,
          capabilityType
        });
      }
      return tx.effectivePracticeApplication.findUnique({ where: { id: existing.id } });
    });
    if (removal) await processRagDeletion(removal, actor);
    return {
      id: application.publicId,
      status: application.status,
      version: application.version,
      reviewedAt: application.reviewedAt
    };
  }

  async function manageCapability(actorValue, input) {
    const actor = normalizeActor(actorValue);
    if (!(actor.isAdmin || actor.role === "ADMIN")) throw forbidden();
    assertObject(input);
    assertOnlyKeys(input, new Set(["action", "userId", "type", "scope", "validUntil", "grantBasis"]));
    const action = normalizeShort(input.action).toUpperCase();
    if (!new Set(["GRANT", "REVOKE"]).has(action)) throw invalid();
    const targetUserId = normalizeId(input.userId);
    const type = normalizeShort(input.type).toUpperCase();
    const scope = normalizeCapabilityScope(input.scope);
    if (!targetUserId || !CAPABILITY_TYPES.has(type)) throw invalid();
    const validUntil = action === "GRANT" ? dateOrNull(input.validUntil) : null;
    const grantBasis = normalizeText(input.grantBasis, 2_000) || null;
    if (action === "GRANT" && (!validUntil || validUntil <= now() || !grantBasis)) throw invalid();
    const capability = await db.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
      if (!target) throw notFound();
      const unique = { userId_type_scope: { userId: targetUserId, type, scope } };
      const existing = await tx.practiceCapability.findUnique({ where: unique });
      if (action === "REVOKE" && !existing) throw notFound();
      const value = action === "GRANT"
        ? existing
          ? await tx.practiceCapability.update({
            where: { id: existing.id },
            data: { grantedByUserId: actor.userId, validFrom: now(), validUntil, revokedAt: null, grantBasis }
          })
          : await tx.practiceCapability.create({
            data: { userId: targetUserId, grantedByUserId: actor.userId, type, scope, validFrom: now(), validUntil, grantBasis }
          })
        : await tx.practiceCapability.update({
          where: { id: existing.id },
          data: { revokedAt: now() }
        });
      await tx.practiceCapabilityAudit.create({
        data: {
          targetUserId,
          actorUserId: actor.userId,
          action: action === "GRANT" ? "GRANTED" : "REVOKED",
          type,
          scope,
          validUntil: action === "GRANT" ? validUntil : existing.validUntil,
          grantBasis: action === "GRANT" ? grantBasis : normalizeText(input.grantBasis, 2_000) || "Manual revocation"
        }
      });
      if (action === "GRANT" && REVIEW_TYPES.has(type)) {
        const activeForType = await tx.practiceCapability.findMany({
          where: {
            type,
            revokedAt: null,
            validFrom: { lte: now() },
            OR: [{ validUntil: null }, { validUntil: { gt: now() } }]
          }
        });
        const backlog = await tx.effectivePractice.findMany({
          where: { status: { in: ["SUBMITTED", "IN_REVIEW", "RE_REVIEW"] }, authorId: { not: targetUserId } },
          include: { reviewAssignments: true }
        });
        const assignments = backlog.filter((practice) => {
          if (!scopeMatchesPractice(scope, practice)) return false;
          const current = (practice.reviewAssignments || []).filter((item) => (
            item.contentVersion === practice.contentVersion
            && item.capabilityType === type
            && item.status === "ASSIGNED"
            && item.reviewerId
            && activeForType.some((capability) => (
              capability.userId === item.reviewerId && scopeMatchesPractice(capability.scope, practice)
            ))
          ));
          const required = practice.riskLevel === "HIGH" && type === "REVIEWER" ? 2 : 1;
          return current.length < required && !current.some((item) => item.reviewerId === targetUserId);
        }).map((practice) => ({
          practiceId: practice.id,
          reviewerId: targetUserId,
          capabilityType: type,
          scope,
          contentVersion: practice.contentVersion,
          status: "ASSIGNED",
          assignedAt: now()
        }));
        if (assignments.length) {
          await tx.effectivePracticeReviewAssignment.createMany({ data: assignments, skipDuplicates: true });
        }
        const applicationBacklog = await tx.effectivePracticeApplication.findMany({
          where: {
            status: { in: ["WAITING_FOR_REVIEW", "SUBMITTED"] },
            assignedReviewerId: null,
            authorId: { not: targetUserId }
          },
          include: { practice: true }
        });
        for (const application of applicationBacklog) {
          const applicationScope = applicationPracticeScope(application);
          if (application.practice.authorId === targetUserId || !scopeMatchesPractice(scope, applicationScope)) continue;
          await tx.effectivePracticeApplication.updateMany({
            where: { id: application.id, status: { in: ["WAITING_FOR_REVIEW", "SUBMITTED"] }, assignedReviewerId: null },
            data: { status: "SUBMITTED", assignedReviewerId: targetUserId, assignedCapabilityType: type }
          });
        }
      }
      if (action === "REVOKE" && REVIEW_TYPES.has(type)) {
        const assignedCandidateReviews = await tx.effectivePracticeReviewAssignment.findMany({
          where: { status: "ASSIGNED", reviewerId: targetUserId, capabilityType: type },
          include: { practice: true }
        });
        for (const assignment of assignedCandidateReviews) {
          await tx.effectivePracticeReviewAssignment.updateMany({
            where: { id: assignment.id, status: "ASSIGNED", reviewerId: targetUserId },
            data: { status: "DECLINED", completedAt: now() }
          });
          await assignReplacementReviewerTx(
            tx,
            assignment.practice,
            type,
            assignment.contentVersion,
            now(),
            [targetUserId]
          );
        }
        const assignedApplications = await tx.effectivePracticeApplication.findMany({
          where: { status: "SUBMITTED", assignedReviewerId: targetUserId, assignedCapabilityType: type },
          include: { practice: true }
        });
        for (const application of assignedApplications) {
          const replacement = await chooseApplicationReviewerTx(tx, applicationPracticeScope(application), application.authorId, now());
          await tx.effectivePracticeApplication.updateMany({
            where: { id: application.id, status: "SUBMITTED", assignedReviewerId: targetUserId },
            data: {
              status: replacement ? "SUBMITTED" : "WAITING_FOR_REVIEW",
              assignedReviewerId: replacement?.userId || null,
              assignedCapabilityType: replacement?.type || null
            }
          });
        }
      }
      return value;
    });
    return {
      userId: capability.userId,
      type: capability.type,
      scope: capability.scope || "*",
      validFrom: capability.validFrom,
      validUntil: capability.validUntil,
      revokedAt: capability.revokedAt
    };
  }

  async function listCapabilities(actorValue) {
    const actor = normalizeActor(actorValue);
    if (!(actor.isAdmin || actor.role === "ADMIN")) throw forbidden();
    const rows = await db.practiceCapability.findMany({
      orderBy: [{ revokedAt: "asc" }, { validUntil: "asc" }, { type: "asc" }],
      take: 500,
      select: {
        userId: true,
        type: true,
        scope: true,
        validFrom: true,
        validUntil: true,
        revokedAt: true,
        grantBasis: true
      }
    });
    return rows.map((item) => ({ ...item, scope: item.scope || "*" }));
  }

  async function repairAssignments(actorValue) {
    const actor = normalizeActor(actorValue);
    if (!(actor.isAdmin || actor.role === "ADMIN" || actor.role === "SYSTEM")) throw forbidden();
    return db.$transaction(async (tx) => {
      const currentTime = now();
      let candidateRepairs = 0;
      let applicationRepairs = 0;
      const candidateAssignments = await tx.effectivePracticeReviewAssignment.findMany({
        where: { status: "ASSIGNED" },
        include: { practice: true }
      });
      for (const assignment of candidateAssignments) {
        const capability = assignment.reviewerId ? await tx.practiceCapability.findFirst({
          where: {
            userId: assignment.reviewerId,
            type: assignment.capabilityType,
            revokedAt: null,
            validFrom: { lte: currentTime },
            OR: [{ validUntil: null }, { validUntil: { gt: currentTime } }]
          }
        }) : null;
        if (capability && scopeMatchesPractice(capability.scope, assignment.practice)) continue;
        await tx.effectivePracticeReviewAssignment.updateMany({
          where: { id: assignment.id, status: "ASSIGNED" },
          data: { status: "DECLINED", completedAt: currentTime }
        });
        await assignReplacementReviewerTx(
          tx,
          assignment.practice,
          assignment.capabilityType,
          assignment.contentVersion,
          currentTime,
          [assignment.reviewerId].filter(Boolean)
        );
        candidateRepairs += 1;
      }
      const fragileReadyPractices = await tx.effectivePractice.findMany({
        where: { status: "READY_TO_PUBLISH", riskLevel: "HIGH" },
        include: { reviews: true, reviewAssignments: true }
      });
      for (const practice of fragileReadyPractices) {
        const reviewerPeople = new Set(latestReviewDecisions(practice.reviews)
          .filter((item) => item.decision === "APPROVED" && item.capabilityType === "REVIEWER")
          .map((item) => item.reviewerId)
          .filter(Boolean));
        if (reviewerPeople.size >= 2) continue;
        const updated = await tx.effectivePractice.updateMany({
          where: { id: practice.id, version: practice.version, status: "READY_TO_PUBLISH" },
          data: { status: "IN_REVIEW", version: { increment: 1 } }
        });
        if (!updated || updated.count !== 1) continue;
        await assignReplacementReviewerTx(
          tx,
          practice,
          "REVIEWER",
          practice.contentVersion,
          currentTime,
          [...reviewerPeople]
        );
        await recordAudit(
          tx,
          practice,
          actor.role === "SYSTEM" ? null : actor.userId,
          "HIGH_RISK_REVIEW_CHAIN_REPAIRED",
          "READY_TO_PUBLISH",
          "IN_REVIEW"
        );
        candidateRepairs += 1;
      }
      const applications = await tx.effectivePracticeApplication.findMany({
        where: { status: { in: ["WAITING_FOR_REVIEW", "SUBMITTED"] } },
        include: { practice: true }
      });
      for (const application of applications) {
        let capability = null;
        if (application.assignedReviewerId && application.assignedCapabilityType) {
          capability = await tx.practiceCapability.findFirst({
            where: {
              userId: application.assignedReviewerId,
              type: application.assignedCapabilityType,
              revokedAt: null,
              validFrom: { lte: currentTime },
              OR: [{ validUntil: null }, { validUntil: { gt: currentTime } }]
            }
          });
        }
        const applicationScope = applicationPracticeScope(application);
        if (capability && scopeMatchesPractice(capability.scope, applicationScope)) continue;
        const replacement = await chooseApplicationReviewerTx(tx, applicationScope, application.authorId, currentTime);
        await tx.effectivePracticeApplication.updateMany({
          where: { id: application.id, status: { in: ["WAITING_FOR_REVIEW", "SUBMITTED"] } },
          data: {
            status: replacement ? "SUBMITTED" : "WAITING_FOR_REVIEW",
            assignedReviewerId: replacement?.userId || null,
            assignedCapabilityType: replacement?.type || null
          }
        });
        applicationRepairs += 1;
      }
      return { candidateRepairs, applicationRepairs };
    });
  }

  return {
    listWorkspace,
    createCandidate,
    updateCandidate,
    getDetail,
    actionCandidate,
    addApplication,
    reviewApplication,
    manageCapability,
    listCapabilities,
    repairAssignments
  };
}

export async function createPracticeDraftFromClosureTx(tx, closure) {
  if (!tx?.effectivePractice || !closure?.id || !closure?.ownerId) throw invalid();
  const existing = await tx.effectivePractice.findUnique({ where: { sourceClosureId: closure.id } });
  if (existing) return existing;
  return tx.effectivePractice.create({
    data: {
      authorId: closure.ownerId,
      sourceClosureId: closure.id,
      sourceCovisionCaseId: null,
      title: normalizeShort(closure.generalizedTitle, 180) || "Üldistatud praktikakandidaat",
      summary: normalizeText(closure.selectedDirection) || null,
      suitableContext: normalizeText(closure.workFocus) || null,
      whatHelped: normalizeText(closure.selectedDirection) || null,
      outcome: normalizeText(closure.progressMarker) || null,
      conditions: [],
      steps: normalizeText(closure.nextStep) ? [normalizeText(closure.nextStep, 500)] : [],
      limitations: null,
      maturityLevel: "practice_candidate",
      riskLevel: "LOW",
      topics: [],
      tags: [],
      status: "DRAFT",
      version: 0,
      ownerConfirmedNoIdentifiersAt: null,
      ragSourceId: null,
      ragMetadata: null
    }
  });
}

function ragText(snapshot) {
  return [
    ["Practice", snapshot.title],
    ["Summary", snapshot.summary],
    ["Suitable context", snapshot.suitableContext],
    ["Conditions", (snapshot.conditions || []).join("; ")],
    ["Limitations", snapshot.limitations],
    ["Steps", (snapshot.steps || []).join("\n")],
    ["Target groups", (snapshot.targetGroups || []).join(", ")],
    ["Environments", (snapshot.environments || []).join(", ")]
  ].filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`).join("\n\n").slice(0, 16_000);
}

async function defaultSyncPublishedSnapshot(publication, actor) {
  if (!String(process.env.RAG_SERVICE_API_KEY || "").trim()) {
    return { status: "skipped", reason: "rag_key_missing", docId: null };
  }
  const docId = deterministicRagDocumentId(publication.publicId, publication.version);
  const snapshot = publication.snapshot;
  const { buildRagHeaders, ragServiceRequest } = await import("./documents/ragService.js");
  await ragServiceRequest(
    "/ingest/text",
    {
      method: "POST",
      headers: buildRagHeaders("application/json", {
        route: "effective-practices/publish",
        stage: "public_snapshot",
        role: actor.role
      }),
      body: JSON.stringify({
        doc_id: docId,
        text: ragText(snapshot),
        metadata: {
          source_type: "practice_example",
          resource_type: "practice_example",
          evidence_role: "practice_guidance",
          title: snapshot.title,
          topics: snapshot.topics || [],
          tags: snapshot.tags || [],
          practice_type: snapshot.practiceType || null,
          maturity_level: snapshot.maturityLevel,
          risk_level: snapshot.riskLevel,
          version: publication.version,
          language: "et",
          collection_id: process.env.EFFECTIVE_PRACTICE_RAG_COLLECTION_ID || "effective_practices"
        }
      })
    },
    "effective_practices.errors.rag_sync_failed"
  );
  return { status: "synced", reason: null, docId };
}

async function defaultRemovePublishedSnapshot(docId, actor) {
  const { deleteRagDocument } = await import("./documents/ragService.js");
  const result = await deleteRagDocument(docId, {
    route: "effective-practices/review",
    stage: "public_snapshot_remove",
    userId: actor.userId,
    role: actor.role
  });
  if (!result?.ok) throw new Error(normalizeText(result?.error, 500) || "RAG_DELETE_FAILED");
  return { status: "removed", ok: true };
}

const defaultService = createEffectivePracticeService(prisma);

export const listEffectivePracticeWorkspace = (...args) => defaultService.listWorkspace(...args);
export const createEffectivePracticeCandidate = (...args) => defaultService.createCandidate(...args);
export const updateEffectivePracticeCandidate = (...args) => defaultService.updateCandidate(...args);
export const getEffectivePracticeDetail = (...args) => defaultService.getDetail(...args);
export const actOnEffectivePractice = (...args) => defaultService.actionCandidate(...args);
export const addEffectivePracticeApplication = (...args) => defaultService.addApplication(...args);
export const reviewEffectivePracticeApplication = (...args) => defaultService.reviewApplication(...args);
export const manageEffectivePracticeCapability = (...args) => defaultService.manageCapability(...args);
export const listEffectivePracticeCapabilities = (...args) => defaultService.listCapabilities(...args);
export const repairEffectivePracticeAssignments = (...args) => defaultService.repairAssignments(...args);
