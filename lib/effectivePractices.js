import { prisma } from "./prisma.js";
import { covisionParticipantIdentityOr } from "./covisionAccessShared.js";

const MAX_TEXT = 8_000;
const MAX_SHORT = 240;
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

function inputLimitExceeded(field, limit) {
  const error = fail("api.common.invalid_request", 400, "INPUT_LIMIT_EXCEEDED");
  error.field = field;
  error.limit = limit;
  return error;
}

function strictText(value, field, max, { short = false } = {}) {
  if (typeof value !== "string") return "";
  const normalized = short ? value.trim().replace(/\s+/g, " ") : value.trim();
  if (normalized.length > max) throw inputLimitExceeded(field, max);
  return normalized;
}

function strictList(value, field, { maxItems, maxLength }) {
  const source = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[\n,;]/) : [];
  const result = [];
  const seen = new Set();
  for (const raw of source) {
    const item = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
    if (!item) continue;
    if (item.length > maxLength) throw inputLimitExceeded(`${field}[]`, maxLength);
    const key = item.toLocaleLowerCase("et");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  if (result.length > maxItems) throw inputLimitExceeded(field, maxItems);
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
    const title = strictText(input.title, "title", 180, { short: true });
    if (!title) throw invalid();
    data.title = title;
  }
  for (const field of textFields) {
    if (!partial || hasOwn(input, field)) data[field] = strictText(input[field], field, 8_000) || null;
  }
  for (const [field, options] of [
    ["conditions", { maxItems: 12, maxLength: 220 }],
    ["steps", { maxItems: 16, maxLength: 500 }],
    ["targetGroups", { maxItems: 12, maxLength: 120 }],
    ["environments", { maxItems: 12, maxLength: 120 }],
    ["topics", { maxItems: 24, maxLength: 100 }],
    ["tags", { maxItems: 32, maxLength: 80 }]
  ]) {
    if (!partial || hasOwn(input, field)) data[field] = strictList(input[field], field, options);
  }
  if (!partial || hasOwn(input, "practiceType")) data.practiceType = strictText(input.practiceType, "practiceType", 120, { short: true }) || null;
  if (!partial || hasOwn(input, "maturityLevel")) {
    data.maturityLevel = strictText(input.maturityLevel, "maturityLevel", 80, { short: true }) || "practice_candidate";
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

export function assessEffectivePracticePrivacy(practice) {
  const text = [
    practice?.title, practice?.summary, practice?.background, practice?.mainChallenge,
    practice?.whatHelped, practice?.networkOrServiceRole, practice?.outcome,
    practice?.learningPoints, practice?.limitations, practice?.sources,
    practice?.suitableContext, practice?.practiceType, practice?.maturityLevel, ...(practice?.conditions || []),
    ...(practice?.steps || []), ...(practice?.targetGroups || []),
    ...(practice?.environments || []), ...(practice?.topics || []), ...(practice?.tags || [])
  ].filter(Boolean).join(" ");
  const directSignals = [
    ["email", /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i],
    ["phone", /(?:\+|00)\d{1,3}[\s().-]?(?:\d[\s().-]?){6,14}\b|(?:\+?372[\s-]?)?(?:5\d{6,7}|[67]\d{6})\b/],
    ["national_id", /\b[1-6]\d{10}\b/],
    ["case_number", /\b(?:juhtum|toimik|asi|case|ref(?:erence)?)\s*(?:nr|number|#|:)\s*[A-Z0-9][A-Z0-9/-]{3,}\b/i],
    ["address", /\b(?:tn|tänav|tee|mnt|maantee|pst|puiestee|krt|korter)\b[.,]?\s*\d{1,4}[a-z]?\b|\b[A-ZÕÄÖÜŠŽ][\p{L}-]+\s+(?:tn|tänav|tee|mnt|maantee|pst|puiestee)\s+\d{1,4}[a-z]?\b/iu]
  ].filter(([, pattern]) => pattern.test(text)).map(([kind]) => kind);
  const indirectSignals = [];
  if (/\b(?:hr|pr|härra|proua|klient|laps|ema|isa)\s+[A-ZÕÄÖÜŠŽ][\p{L}'’-]{2,}\s+[A-ZÕÄÖÜŠŽ][\p{L}'’-]{2,}\b/iu.test(text)) {
    indirectSignals.push("person_name_context");
  }
  if (/\b(?:haigla|kool|lasteaed|vald|vallavalitsus|linnavalitsus|osakond|varjupaik|hooldekodu|asutus)/iu.test(text)
      && /\b(?:ainus|esmakord|haruld|erandlik|surmajuhtum|tulekahju|plahvatus|kadumine)/iu.test(text)) {
    indirectSignals.push("institution_rare_event");
  }
  return {
    directSignals,
    indirectSignals,
    blocked: directSignals.length > 0,
    requiresManualDecision: indirectSignals.length > 0
  };
}

function containsDirectIdentifier(practice) {
  return assessEffectivePracticePrivacy(practice).blocked;
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

async function currentlyValidApprovals(tx, practice, reviews, currentTime) {
  const approvals = latestReviewDecisions(reviews).filter((item) => (
    item.decision === "APPROVED" && item.reviewerId && REVIEW_TYPES.has(item.capabilityType)
  ));
  if (!approvals.length) return [];
  const capabilities = await tx.practiceCapability.findMany({
    where: {
      userId: { in: [...new Set(approvals.map((item) => item.reviewerId))] },
      type: { in: [...new Set(approvals.map((item) => item.capabilityType))] },
      revokedAt: null,
      validFrom: { lte: currentTime },
      OR: [{ validUntil: null }, { validUntil: { gt: currentTime } }]
    }
  });
  return approvals.filter((approval) => capabilities.some((capability) => (
    capability.userId === approval.reviewerId
    && capability.type === approval.capabilityType
    && capabilityIsActive(capability, currentTime)
    && scopeMatchesPractice(capability.scope, practice)
  )));
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

// P1-D: append-only review-justification ledger. Each decision writes an immutable
// event (never updated), version-bound, with a visibility gate. "author" text is
// the feedback the author may read; "private" text is reviewer-only reasoning that
// must never reach the author or a public serializer.
const JUSTIFICATION_VISIBILITIES = new Set(["author", "private", "public"]);
async function recordJustification(tx, practice, actorId, { decisionType, justification, visibility }) {
  const text = normalizeText(justification, 4_000);
  if (!text) return;
  await tx.effectivePracticeAuditEvent.create({
    data: {
      practiceId: practice.id,
      actorId,
      action: "REVIEW_JUSTIFICATION",
      fromStatus: null,
      toStatus: null,
      contentVersion: practice.contentVersion,
      decisionType: decisionType ? String(decisionType).slice(0, 60) : null,
      justification: text,
      justificationVisibility: JUSTIFICATION_VISIBILITIES.has(visibility) ? visibility : "private"
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

function pageLimit(value, fallback = 50) {
  return Math.max(1, Math.min(Number(value) || fallback, 100));
}

async function ensureEthicsReviewAssignmentTx(tx, practice, contentVersion, currentTime) {
  const assignments = await tx.effectivePracticeReviewAssignment.findMany({
    where: {
      practiceId: practice.id,
      capabilityType: "ETHICS",
      contentVersion,
      status: "ASSIGNED",
      completedAt: null
    },
    orderBy: [{ assignedAt: "asc" }, { id: "asc" }]
  });
  let retained = null;
  for (const assignment of assignments || []) {
    const capability = assignment.reviewerId ? await tx.practiceCapability.findFirst({
      where: {
        userId: assignment.reviewerId,
        type: "ETHICS",
        revokedAt: null,
        validFrom: { lte: currentTime },
        OR: [{ validUntil: null }, { validUntil: { gt: currentTime } }]
      }
    }) : null;
    if (!retained && capability && scopeMatchesPractice(capability.scope, practice)) {
      retained = assignment;
      continue;
    }
    await tx.effectivePracticeReviewAssignment.updateMany({
      where: { id: assignment.id, status: "ASSIGNED" },
      data: { status: "DECLINED", completedAt: currentTime }
    });
  }
  if (retained) return { assignment: retained, created: false };
  const assignment = await assignReplacementReviewerTx(tx, practice, "ETHICS", contentVersion, currentTime);
  return { assignment, created: Boolean(assignment) };
}

function pageResult(rows, limit) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, hasMore, nextCursor: hasMore ? items.at(-1)?.id || null : null };
}

function cursorArgs(cursor) {
  const id = normalizeId(cursor);
  return id ? { cursor: { id }, skip: 1 } : {};
}

function publishedWhere(query = {}) {
  const q = normalizeShort(query.q, 200);
  const maturity = normalizeShort(query.maturity, 80);
  return {
    status: "PUBLISHED",
    versions: { some: {} },
    ...(query.practiceType ? { practiceType: normalizeShort(query.practiceType, 120) } : {}),
    ...(query.environment ? { environments: { has: normalizeShort(query.environment, 120) } } : {}),
    ...(maturity && maturity !== "confirmed" ? { id: "__no_published_maturity_match__" } : {}),
    ...(q ? {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { summary: { contains: q, mode: "insensitive" } },
        { suitableContext: { contains: q, mode: "insensitive" } },
        { limitations: { contains: q, mode: "insensitive" } },
        { practiceType: { contains: q, mode: "insensitive" } },
        { conditions: { has: q } }, { targetGroups: { has: q } },
        { environments: { has: q } }, { topics: { has: q } }, { tags: { has: q } }
      ]
    } : {})
  };
}

function publishedOrderBy(sort) {
  if (sort === "alphabetical") return [{ title: "asc" }, { id: "asc" }];
  if (sort === "reviewed") return [{ professionalReviewedAt: "desc" }, { id: "asc" }];
  if (sort === "applications") return [{ applications: { _count: "desc" } }, { id: "asc" }];
  if (sort === "review_due") return [{ nextReviewAt: "asc" }, { id: "asc" }];
  return [{ updatedAt: "desc" }, { id: "asc" }];
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

// P1-A: durable RAG ingest recovery. A published practice must never stay silently
// absent from RAG; a failed/incomplete ingest becomes a retry job on the same
// durable DataDeletionJob carrier (action RAG_INGEST). Retries re-ingest the
// IMMUTABLE published snapshot with the deterministic doc id (an upsert — a
// possible timed-out orphan is overwritten, never duplicated) and are version
// guarded so a re-reviewed/superseded version is abandoned rather than resurrected.
const DEFAULT_MAX_RAG_INGEST_ATTEMPTS = 8;
const RAG_INGEST_BACKOFF_BASE_MS = 60_000; // 1 min, doubling per attempt (capped)
const PRACTICE_REVIEW_SCHEDULER_LOCK_KEY = "effective-practice:review-scheduler";

function ragIngestBackoffMs(attempt) {
  const capped = Math.min(Math.max(Number(attempt) || 1, 1), 10);
  return RAG_INGEST_BACKOFF_BASE_MS * 2 ** (capped - 1);
}

/** Parses the release version off a job storagePath like "...:v3". */
function parseReleaseVersionFromStoragePath(storagePath) {
  const match = /:v(\d+)$/.exec(String(storagePath || ""));
  return match ? Number(match[1]) : null;
}

/** Short machine error code — NEVER practice text. */
function classifyRagIngestErrorCode(error) {
  const message = String(error?.message || "");
  if (/RAG_DOCUMENT_ID_MISMATCH/.test(message)) return "doc_id_mismatch";
  if (/PUBLISH_LINK_STALE/.test(message)) return "link_stale";
  if (/rag_key_missing/.test(message)) return "rag_key_missing";
  if (/snapshot/i.test(message)) return "snapshot_missing";
  return "ingest_failed";
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
          data: {
            status: "done",
            attempts: { increment: 1 },
            lastError: null,
            lastErrorCode: null,
            nextAttemptAt: null
          }
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
          data: { status: "failed", attempts: { increment: 1 }, lastError: message, lastErrorCode: "delete_failed" }
        }).catch(() => null);
        await tx.effectivePractice.update({
          where: { id: removal.practiceId },
          data: { ragMetadata: { syncStatus: "removal_failed", reason: removal.reason, checkedAt: now().toISOString() } }
        }).catch(() => null);
      }).catch(() => null);
      return { status: externallyRemoved ? "removed_unrecorded" : "failed" };
    }
  }

  // P1-A: re-ingest one RAG_INGEST retry job (or a crash-stale publish guard).
  // Idempotent + version guarded. Returns a machine status; never logs practice text.
  async function processRagIngest(job) {
    if (!job) return { status: "skipped" };
    const jobId = job.id;
    const practiceId = job.resourceId;
    const expectedDocId = normalizeText(job.externalRef, 500);
    const releaseVersion = parseReleaseVersionFromStoragePath(job.storagePath);
    if (!jobId || !practiceId || !expectedDocId || !releaseVersion) {
      await db.dataDeletionJob.update({
        where: { id: jobId },
        data: { status: "failed", lastErrorCode: "malformed_job", nextAttemptAt: null }
      }).catch(() => null);
      return { status: "failed" };
    }

    const practice = await db.effectivePractice.findUnique({
      where: { id: practiceId },
      select: { id: true, publicId: true, status: true, publishedVersion: true, ragSourceId: true }
    });
    // Superseded/stale: the remote ingest may already have succeeded before the
    // link response was lost. Convert this SAME durable row into a deletion job
    // and remove the deterministic document before the row can become done.
    if (!practice || practice.status !== "PUBLISHED" || Number(practice.publishedVersion) !== releaseVersion) {
      await db.dataDeletionJob.update({
        where: { id: jobId },
        data: {
          action: "RAG_DELETE",
          status: "pending",
          storagePath: `superseded_ingest_cleanup:v${releaseVersion}`,
          nextAttemptAt: null,
          lastError: null,
          lastErrorCode: "superseded_cleanup_pending"
        }
      }).catch(() => null);
      const cleanup = await processRagDeletion({
        jobId,
        practiceId,
        docId: expectedDocId,
        reason: "superseded_ingest_cleanup"
      }, { userId: null, role: "SYSTEM" });
      return {
        status: cleanup.status === "removed" ? "superseded_cleaned" : "cleanup_pending",
        cleanupStatus: cleanup.status
      };
    }
    // Already linked to this exact doc → idempotent success.
    if (practice.ragSourceId === expectedDocId) {
      await db.dataDeletionJob.update({
        where: { id: jobId },
        data: { status: "done", nextAttemptAt: null, lastError: null, lastErrorCode: null }
      }).catch(() => null);
      return { status: "already_linked" };
    }

    const attempts = Number(job.attempts || 0) + 1;
    const maxAttempts = Number(job.maxAttempts) || DEFAULT_MAX_RAG_INGEST_ATTEMPTS;
    const recordFailure = async (code, message) => {
      const exhausted = attempts >= maxAttempts;
      await db.dataDeletionJob.update({
        where: { id: jobId },
        data: {
          status: exhausted ? "failed" : "pending",
          action: "RAG_INGEST",
          attempts: { increment: 1 },
          lastError: message ? normalizeText(message, 500) : null,
          lastErrorCode: code,
          nextAttemptAt: exhausted ? null : new Date(now().getTime() + ragIngestBackoffMs(attempts))
        }
      }).catch(() => null);
      return { status: exhausted ? "failed" : "retry_scheduled" };
    };

    // Re-ingest the IMMUTABLE published snapshot, not the mutable practice.
    const version = await db.effectivePracticeVersion.findFirst({
      where: { practiceId: practice.id, version: releaseVersion },
      select: { publicSnapshot: true }
    });
    if (!version?.publicSnapshot) return recordFailure("snapshot_missing");

    try {
      const ragSync = await syncPublishedSnapshot(
        { publicId: practice.publicId, snapshot: version.publicSnapshot, version: releaseVersion },
        { userId: null, role: "SYSTEM" }
      );
      if (ragSync?.status === "skipped") {
        // Environment has no RAG key — keep pending without burning attempts.
        await db.dataDeletionJob.update({
          where: { id: jobId },
          data: { action: "RAG_INGEST", lastErrorCode: ragSync.reason || "rag_unavailable", nextAttemptAt: new Date(now().getTime() + ragIngestBackoffMs(1)) }
        }).catch(() => null);
        return { status: "skipped" };
      }
      if (ragSync?.docId && ragSync.docId !== expectedDocId) throw new Error("RAG_DOCUMENT_ID_MISMATCH");
      await db.$transaction(async (tx) => {
        const linked = await tx.effectivePractice.updateMany({
          where: { id: practice.id, status: "PUBLISHED", publishedVersion: releaseVersion },
          data: {
            ragSourceId: expectedDocId,
            ragMetadata: { syncStatus: "synced", publishedVersion: releaseVersion, checkedAt: now().toISOString() }
          }
        });
        if (!linked || linked.count !== 1) throw conflict("PUBLISH_LINK_STALE");
        await tx.dataDeletionJob.update({
          where: { id: jobId },
          data: { status: "done", attempts: { increment: 1 }, lastError: null, lastErrorCode: null, nextAttemptAt: null }
        });
      });
      return { status: "ingested" };
    } catch (error) {
      return recordFailure(classifyRagIngestErrorCode(error), error?.message);
    }
  }

  // P1-B: review-deadline + overdue-assignment scheduler tick. Idempotent (re-runs
  // never duplicate a marker), batched, server-time. The durable marker is an
  // append-only EffectivePracticeAuditEvent (REVIEW_DUE / ASSIGNMENT_OVERDUE) that
  // carries NO candidate text — only ids, versions and counts. The notification
  // delivery channel (email/in-app) is a separate follow-up.
  async function runPracticeReviewSchedulerTick({
    now: nowArg = null, batchSize = 50, dryRun = false, overdueDays = 14, dueWithinDays = 0, reviewGraceDays = 14
  } = {}) {
    const at = nowArg || now();
    const size = Math.max(1, Math.min(Math.trunc(Number(batchSize) || 50), 500));
    const dueBefore = new Date(at.getTime() + Math.max(0, Number(dueWithinDays) || 0) * 86_400_000);
    const overdueBefore = new Date(at.getTime() - Math.max(0, Number(overdueDays) || 0) * 86_400_000);
    const graceBefore = new Date(at.getTime() - Math.max(0, Number(reviewGraceDays) || 0) * 86_400_000);
    const execute = async (tx) => {
      // One scheduler writer across all processes. The lock is transaction-scoped,
      // so a second tick re-reads committed markers instead of racing find→create.
      if (typeof tx.$executeRaw === "function") {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${PRACTICE_REVIEW_SCHEDULER_LOCK_KEY}))`;
      }

      const reviews = [];
      const assignments = [];
      let reviewTasksCreated = 0;
      let movedToReReview = 0;
      const cycles = new Map();

      // batchSize is a page size, not a truncation limit. Stable unique cursors
      // ensure already-marked first pages cannot starve later due rows.
      let practiceCursor = null;
      do {
        const page = await tx.effectivePractice.findMany({
          where: { status: "PUBLISHED", nextReviewAt: { not: null, lte: dueBefore } },
          orderBy: [{ nextReviewAt: "asc" }, { id: "asc" }],
          take: size,
          ...(practiceCursor ? { cursor: { id: practiceCursor }, skip: 1 } : {}),
          select: {
            id: true, publicId: true, authorId: true, status: true, version: true, contentVersion: true,
            publishedVersion: true, publishedAt: true, nextReviewAt: true, ragSourceId: true,
            practiceType: true, topics: true, tags: true, targetGroups: true, environments: true, riskLevel: true
          }
        });
        for (const practice of page) {
          const already = await tx.effectivePracticeAuditEvent.findFirst({
            where: {
              practiceId: practice.id,
              action: "REVIEW_DUE",
              ...(practice.publishedAt ? { createdAt: { gte: practice.publishedAt } } : {})
            },
            select: { id: true }
          });
          if (!already) {
            reviews.push({ practiceId: practice.publicId, publishedVersion: practice.publishedVersion, nextReviewAt: practice.nextReviewAt });
          }
          if (!dryRun && !already) {
            await tx.effectivePracticeAuditEvent.create({
              data: {
                practiceId: practice.id,
                actorId: null,
                action: "REVIEW_DUE",
                contentVersion: practice.contentVersion,
                metadata: {
                  publishedVersion: practice.publishedVersion,
                  nextReviewAt: practice.nextReviewAt ? practice.nextReviewAt.toISOString() : null,
                  scheduledAt: at.toISOString()
                }
              }
            });
          }
          if (!dryRun && practice.nextReviewAt <= graceBefore) {
            const updated = await tx.effectivePractice.updateMany({
              where: { id: practice.id, version: practice.version, status: "PUBLISHED" },
              data: {
                status: "RE_REVIEW",
                version: { increment: 1 },
                contentVersion: { increment: 1 },
                anonymityCheckedAt: null,
                anonymityCheckedVersion: null,
                professionalReviewedAt: null,
                ragMetadata: { syncStatus: "removal_pending", reason: "review_grace_expired", checkedAt: at.toISOString() }
              }
            });
            if (updated?.count === 1) {
              await queueRagDeletionTx(tx, practice, "review_grace_expired", null);
              await tx.effectivePracticeReviewAssignment.updateMany({
                where: {
                  practiceId: practice.id,
                  contentVersion: practice.contentVersion,
                  status: "ASSIGNED"
                },
                data: { status: "DECLINED", completedAt: at }
              });
              await assignReviewersTx(tx, practice, practice.contentVersion + 1, at);
              await recordAudit(
                tx, { ...practice, contentVersion: practice.contentVersion + 1 }, null,
                "REVIEW_GRACE_EXPIRED", "PUBLISHED", "RE_REVIEW",
                { publishedVersion: practice.publishedVersion, graceDays: Number(reviewGraceDays) || 0 }
              );
              movedToReReview += 1;
            }
          } else if (!dryRun) {
            const task = await ensureEthicsReviewAssignmentTx(tx, practice, practice.contentVersion, at);
            if (task.created) reviewTasksCreated += 1;
          }
        }
        practiceCursor = page.length === size ? page.at(-1)?.id || null : null;
      } while (practiceCursor);

      let assignmentCursor = null;
      do {
        const page = await tx.effectivePracticeReviewAssignment.findMany({
          where: { status: "ASSIGNED", completedAt: null, assignedAt: { lte: overdueBefore } },
          orderBy: [{ assignedAt: "asc" }, { id: "asc" }],
          take: size,
          ...(assignmentCursor ? { cursor: { id: assignmentCursor }, skip: 1 } : {}),
          select: { id: true, practiceId: true, contentVersion: true }
        });
        for (const assignment of page) {
          const key = `${assignment.practiceId}:${assignment.contentVersion}`;
          if (!cycles.has(key)) cycles.set(key, { practiceId: assignment.practiceId, contentVersion: assignment.contentVersion, ids: [] });
          cycles.get(key).ids.push(assignment.id);
        }
        assignmentCursor = page.length === size ? page.at(-1)?.id || null : null;
      } while (assignmentCursor);

      for (const cycle of cycles.values()) {
        const already = await tx.effectivePracticeAuditEvent.findFirst({
          where: { practiceId: cycle.practiceId, action: "ASSIGNMENT_OVERDUE", contentVersion: cycle.contentVersion },
          select: { id: true }
        });
        if (already) continue;
        assignments.push({ practiceId: cycle.practiceId, contentVersion: cycle.contentVersion, overdueCount: cycle.ids.length });
        if (!dryRun) {
          await tx.effectivePracticeAuditEvent.create({
            data: {
              practiceId: cycle.practiceId,
              actorId: null,
              action: "ASSIGNMENT_OVERDUE",
              contentVersion: cycle.contentVersion,
              metadata: { overdueAssignmentIds: cycle.ids, overdueCount: cycle.ids.length, scheduledAt: at.toISOString() }
            }
          });
        }
      }

      return {
        dryRun, reviewsDue: reviews.length, assignmentsOverdue: assignments.length,
        reviewTasksCreated, movedToReReview, reviews, assignments
      };
    };

    return typeof db.$transaction === "function" ? db.$transaction(execute) : execute(db);
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
    const limit = pageLimit(query.limit);
    const publishedFilter = publishedWhere(query);
    const candidateWhere = { authorId: actor.userId };
    const applicationWhere = { authorId: actor.userId };
    const [capabilities, publishedRaw, candidateRaw, applicationRaw, publishedTotal, candidateTotal, applicationTotal] = await Promise.all([
      activeCapabilities(db, actor.userId, current),
      db.effectivePractice.findMany({
        where: publishedFilter,
        orderBy: publishedOrderBy(normalizeShort(query.sort, 40)),
        take: limit + 1,
        ...cursorArgs(query.practicesCursor),
        include: practiceInclude
      }),
      canCreate ? db.effectivePractice.findMany({
        where: candidateWhere,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: limit + 1,
        ...cursorArgs(query.candidatesCursor),
        include: practiceInclude
      }) : Promise.resolve([]),
      db.effectivePracticeApplication.findMany({
        where: applicationWhere,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: limit + 1,
        ...cursorArgs(query.applicationsCursor),
        include: { practice: true }
      }),
      db.effectivePractice.count?.({ where: publishedFilter }) ?? Promise.resolve(0),
      canCreate ? (db.effectivePractice.count?.({ where: candidateWhere }) ?? Promise.resolve(0)) : Promise.resolve(0),
      db.effectivePracticeApplication.count?.({ where: applicationWhere }) ?? Promise.resolve(0)
    ]);
    const publishedPage = pageResult(publishedRaw, limit);
    const candidatePage = pageResult(candidateRaw, limit);
    const applicationPage = pageResult(applicationRaw, limit);
    const reviewerCapabilities = capabilities.filter((item) => CAPABILITY_TYPES.has(item.type));
    let reviewQueue = [];
    let applicationQueue = [];
    let reviewPage = { items: [], hasMore: false, nextCursor: null };
    let applicationReviewPage = { items: [], hasMore: false, nextCursor: null };
    let reviewTotal = 0;
    let applicationReviewTotal = 0;
    if (reviewerCapabilities.some((item) => REVIEW_TYPES.has(item.type) || item.type === "APPROVER")) {
      const canApprove = reviewerCapabilities.some((item) => item.type === "APPROVER");
      const reviewWhere = {
        status: { in: ["SUBMITTED", "IN_REVIEW", "RE_REVIEW", "READY_TO_PUBLISH"] },
        authorId: { not: actor.userId },
        OR: [
          { reviewAssignments: { some: { reviewerId: actor.userId, status: "ASSIGNED" } } },
          ...(canApprove ? [{ status: "READY_TO_PUBLISH" }] : [])
        ]
      };
      const rows = await db.effectivePractice.findMany({
        where: reviewWhere,
        orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
        take: limit + 1,
        ...cursorArgs(query.reviewsCursor),
        include: practiceInclude
      });
      reviewPage = pageResult(rows, limit);
      reviewTotal = await (db.effectivePractice.count?.({ where: reviewWhere }) ?? Promise.resolve(reviewPage.items.length));
      reviewQueue = reviewPage.items.filter((practice) => (
        practice.authorId !== actor.userId
        && capabilityCanReadCandidate(reviewerCapabilities, practice, actor.userId)
      )).map((practice) => serializeCandidate(practice, { reviewerId: actor.userId, authorView: false }));
      if (reviewerCapabilities.some((item) => REVIEW_TYPES.has(item.type))) {
        const applicationReviewWhere = { status: "SUBMITTED", assignedReviewerId: actor.userId, authorId: { not: actor.userId } };
        const applications = await db.effectivePracticeApplication.findMany({
          where: applicationReviewWhere,
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: limit + 1,
          ...cursorArgs(query.applicationReviewsCursor),
          include: { practice: true }
        });
        applicationReviewPage = pageResult(applications, limit);
        applicationReviewTotal = await (db.effectivePracticeApplication.count?.({ where: applicationReviewWhere }) ?? Promise.resolve(applicationReviewPage.items.length));
        applicationQueue = applicationReviewPage.items.filter((item) => (
          reviewerCapabilities.some((capability) => (
            capability.type === item.assignedCapabilityType
            && REVIEW_TYPES.has(capability.type)
            && scopeMatchesPractice(capability.scope, applicationPracticeScope(item))
          ))
        )).map(serializeApplicationForReview);
      }
    }
    const published = publishedPage.items.map(serializePublishedPractice).filter(Boolean);
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
      candidates: candidatePage.items.map((item) => serializeCandidate(item)),
      myApplications: applicationPage.items.map(serializeOwnApplication),
      reviewQueue,
      applicationQueue,
      pageInfo: {
        practices: { hasMore: publishedPage.hasMore, nextCursor: publishedPage.nextCursor, total: Number(publishedTotal || published.length) },
        candidates: { hasMore: candidatePage.hasMore, nextCursor: candidatePage.nextCursor, total: Number(candidateTotal || candidatePage.items.length) },
        myApplications: { hasMore: applicationPage.hasMore, nextCursor: applicationPage.nextCursor, total: Number(applicationTotal || applicationPage.items.length) },
        reviewQueue: { hasMore: reviewPage.hasMore, nextCursor: reviewPage.nextCursor, total: Number(reviewTotal || reviewQueue.length) },
        applicationQueue: { hasMore: applicationReviewPage.hasMore, nextCursor: applicationReviewPage.nextCursor, total: Number(applicationReviewTotal || applicationQueue.length) }
      }
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
    const privacyDecisionJustification = normalizeText(request.privacyDecisionJustification, 2_000) || null;
    if (["NEEDS_CHANGES", "DECLINED"].includes(decision) && !authorFeedback) throw invalid();
    if (decision === "CONFLICT" && !privateNotes) throw invalid();
    if (conflictStatus !== "NONE" && !privateNotes) throw invalid();
    if (conflictStatus === "DECLINED" && decision !== "CONFLICT") throw invalid();
    if (conflictStatus === "NONE" && decision === "CONFLICT") throw invalid();
    if (capabilityType === "ETHICS" && decision === "APPROVED" && !privacyDecisionJustification) throw invalid();
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
        privateNotes: [privateNotes, privacyDecisionJustification ? `[PRIVACY_DECISION] ${privacyDecisionJustification}` : null].filter(Boolean).join("\n\n") || null,
        conflictNote: conflictStatus !== "NONE" ? privateNotes : null,
        decidedAt: now()
      }
    });
    // P1-D: append the immutable justification(s) for this decision. Author feedback
    // and reviewer-private reasoning are recorded as separate visibility-gated events.
    await recordJustification(tx, practice, actor.userId, { decisionType: decision, justification: authorFeedback, visibility: "author" });
    await recordJustification(tx, practice, actor.userId, { decisionType: decision, justification: privateNotes, visibility: "private" });
    await recordJustification(tx, practice, actor.userId, { decisionType: "PRIVACY_APPROVED", justification: privacyDecisionJustification, visibility: "private" });
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
    const currentReviews = await currentlyValidApprovals(tx, practice, reviews, now());
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
    const privacyAssessment = assessEffectivePracticePrivacy(practice);
    const ethicsReview = currentReviews.find((item) => item.capabilityType === "ETHICS");
    if (privacyAssessment.requiresManualDecision && !/\[PRIVACY_DECISION\]\s+\S/u.test(String(ethicsReview?.privateNotes || ""))) {
      throw fail("effective_practices.errors.incomplete", 409, "PRIVACY_DECISION_REQUIRED");
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
      "expectedVersion", "action", "capabilityType", "decision", "conflictStatus", "authorFeedback", "privateNotes",
      "privacyDecisionJustification", "nextReviewAt"
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
      } catch (error) {
        // The ingest failed — or succeeded and timed out before returning. Rather
        // than abandon the published practice outside RAG (the old compensate-and-
        // give-up path), convert the durable guard row into a RAG_INGEST retry job.
        // The worker re-ingests the immutable snapshot with the deterministic doc id
        // (an upsert, so a timed-out orphan is overwritten, never duplicated) and
        // links ragSourceId once it succeeds; it is version guarded and idempotent.
        await db.effectivePractice.updateMany({
          where: { id: resultId, status: "PUBLISHED", publishedVersion: publication.releaseVersion },
          data: {
            ragMetadata: {
              syncStatus: "ingest_retry_pending",
              reason: "rag_sync_failed",
              publishedVersion: publication.releaseVersion,
              checkedAt: now().toISOString()
            }
          }
        }).catch(() => null);
        await db.dataDeletionJob.update({
          where: { id: publication.guardId },
          data: {
            action: "RAG_INGEST",
            status: "pending",
            storagePath: `rag_ingest_retry:v${publication.releaseVersion}`,
            attempts: { increment: 1 },
            lastError: normalizeText(error?.message, 500),
            lastErrorCode: classifyRagIngestErrorCode(error),
            maxAttempts: DEFAULT_MAX_RAG_INGEST_ATTEMPTS,
            nextAttemptAt: new Date(now().getTime() + ragIngestBackoffMs(1))
          }
        }).catch(() => null);
        ragSync = { status: "ingest_retry_pending" };
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
      context: strictText(input.context, "context", 4_000),
      targetGroup: strictText(input.targetGroup, "targetGroup", 2_000),
      versionUsed: Number(input.versionUsed),
      adaptations: strictText(input.adaptations, "adaptations", 4_000),
      whatWorked: strictText(input.whatWorked, "whatWorked", 4_000),
      whatDidNot: strictText(input.whatDidNot, "whatDidNot", 4_000),
      limitationOrRisk: strictText(input.limitationOrRisk, "limitationOrRisk", 4_000),
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
        context: strictText(input.context, "context", 4_000),
        targetGroup: strictText(input.targetGroup, "targetGroup", 2_000),
        adaptations: strictText(input.adaptations, "adaptations", 4_000),
        whatWorked: strictText(input.whatWorked, "whatWorked", 4_000),
        whatDidNot: strictText(input.whatDidNot, "whatDidNot", 4_000),
        limitationOrRisk: strictText(input.limitationOrRisk, "limitationOrRisk", 4_000),
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
      // P1-D: the application review note is author-facing feedback — appended
      // immutably instead of relying on the overwritten Application.reviewNote.
      await recordJustification(tx, existing.practice, actor.userId, { decisionType: `APPLICATION_${action}`, justification: reviewNote, visibility: "author" });
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

  async function listCapabilities(actorValue, query = {}) {
    const actor = normalizeActor(actorValue);
    if (!(actor.isAdmin || actor.role === "ADMIN")) throw forbidden();
    const limit = pageLimit(query.limit, 100);
    const where = {};
    const rows = await db.practiceCapability.findMany({
      where,
      orderBy: [{ revokedAt: "asc" }, { validUntil: "asc" }, { type: "asc" }, { id: "asc" }],
      take: limit + 1,
      ...cursorArgs(query.cursor),
      select: {
        id: true,
        userId: true,
        type: true,
        scope: true,
        validFrom: true,
        validUntil: true,
        revokedAt: true,
        grantBasis: true
      }
    });
    const page = pageResult(rows, limit);
    const total = await (db.practiceCapability.count?.({ where }) ?? Promise.resolve(page.items.length));
    return {
      items: page.items.map((item) => ({ ...item, scope: item.scope || "*" })),
      pageInfo: { hasMore: page.hasMore, nextCursor: page.nextCursor, total: Number(total || page.items.length) }
    };
  }

  // P1-C: reviewer-assignment repair. `dryRun` splits a read-only audit from the
  // apply pass (same detection, no writes). Detects the broken shapes from the
  // spec: invalid/revoked/expired/wrong-scope capability, AUTHOR-is-reviewer,
  // stale review-cycle (contentVersion mismatch), and a contradictory ASSIGNED row
  // that already carries a completedAt. Repairs are optimistic (updateMany guards)
  // so a concurrent real review wins; when no replacement exists the row is left
  // visibly unassigned (attention), never silently mis-assigned.
  async function repairAssignments(actorValue, { dryRun = false, batchSize = 100 } = {}) {
    const actor = normalizeActor(actorValue);
    if (!(actor.isAdmin || actor.role === "ADMIN" || actor.role === "SYSTEM")) throw forbidden();
    return db.$transaction(async (tx) => {
      const currentTime = now();
      const findings = [];
      let candidateRepairs = 0;
      let applicationRepairs = 0;
      let unresolved = 0;
      const flag = (finding) => { findings.push(finding); };
      const auditActorId = actor.role === "SYSTEM" ? null : actor.userId;

      const repairBatchSize = Math.max(1, Math.min(Number(batchSize) || 100, 500));
      const candidateAssignments = await tx.effectivePracticeReviewAssignment.findMany({
        where: { status: "ASSIGNED" },
        orderBy: { id: "asc" },
        take: repairBatchSize,
        include: { practice: true }
      });
      for (const assignment of candidateAssignments) {
        // Contradictory: ASSIGNED yet already has a completion time → normalize.
        if (assignment.completedAt) {
          flag({ type: "assignment", issue: "contradictory_completed", assignmentId: assignment.id, practiceId: assignment.practiceId });
          if (dryRun) {
            candidateRepairs += 1;
            continue;
          }
          const updated = await tx.effectivePracticeReviewAssignment.updateMany({
            where: { id: assignment.id, status: "ASSIGNED" },
            data: { status: "COMPLETED" }
          });
          if (!updated || updated.count !== 1) continue;
          await recordAudit(tx, assignment.practice, auditActorId, "ASSIGNMENT_REPAIR_APPLIED", assignment.practice?.status, assignment.practice?.status, {
            assignmentId: assignment.id,
            issue: "contradictory_completed",
            result: "completed"
          });
          candidateRepairs += 1;
          continue;
        }
        // Dangling: an ASSIGNED row left on a superseded review cycle.
        if (Number(assignment.contentVersion) !== Number(assignment.practice?.contentVersion)) {
          flag({ type: "assignment", issue: "stale_content_version", assignmentId: assignment.id, practiceId: assignment.practiceId });
          if (dryRun) {
            candidateRepairs += 1;
            continue;
          }
          const updated = await tx.effectivePracticeReviewAssignment.updateMany({
            where: { id: assignment.id, status: "ASSIGNED" },
            data: { status: "DECLINED", completedAt: currentTime }
          });
          if (!updated || updated.count !== 1) continue;
          await recordAudit(tx, assignment.practice, auditActorId, "ASSIGNMENT_REPAIR_APPLIED", assignment.practice?.status, assignment.practice?.status, {
            assignmentId: assignment.id,
            issue: "stale_content_version",
            result: "declined"
          });
          candidateRepairs += 1;
          continue;
        }
        // The author must never review their own practice.
        const authorConflict = Boolean(assignment.reviewerId && assignment.reviewerId === assignment.practice?.authorId);
        const capability = (!authorConflict && assignment.reviewerId) ? await tx.practiceCapability.findFirst({
          where: {
            userId: assignment.reviewerId,
            type: assignment.capabilityType,
            revokedAt: null,
            validFrom: { lte: currentTime },
            OR: [{ validUntil: null }, { validUntil: { gt: currentTime } }]
          }
        }) : null;
        if (!authorConflict && capability && scopeMatchesPractice(capability.scope, assignment.practice)) continue;
        flag({
          type: "assignment",
          issue: authorConflict ? "author_is_reviewer" : (assignment.reviewerId ? "invalid_capability" : "unassigned_reviewer"),
          assignmentId: assignment.id,
          practiceId: assignment.practiceId
        });
        if (dryRun) {
          candidateRepairs += 1;
          continue;
        }
        // The real review may have completed after our read. Only the winner of
        // this CAS may mint a replacement or an audit event.
        const declined = await tx.effectivePracticeReviewAssignment.updateMany({
          where: { id: assignment.id, status: "ASSIGNED" },
          data: { status: "DECLINED", completedAt: currentTime }
        });
        if (!declined || declined.count !== 1) continue;
        const replacement = await assignReplacementReviewerTx(
          tx, assignment.practice, assignment.capabilityType, assignment.contentVersion, currentTime,
          [assignment.reviewerId].filter(Boolean)
        );
        if (!replacement) {
          unresolved += 1;
          flag({ type: "assignment", issue: "no_replacement", assignmentId: assignment.id, practiceId: assignment.practiceId });
        }
        await recordAudit(tx, assignment.practice, auditActorId, "ASSIGNMENT_REPAIR_APPLIED", assignment.practice?.status, assignment.practice?.status, {
          assignmentId: assignment.id,
          issue: authorConflict ? "author_is_reviewer" : (assignment.reviewerId ? "invalid_capability" : "unassigned_reviewer"),
          result: replacement ? "reassigned" : "declined_unassigned",
          replacementAssigned: Boolean(replacement)
        });
        candidateRepairs += 1;
      }

      const fragileReadyPractices = await tx.effectivePractice.findMany({
        where: { status: "READY_TO_PUBLISH" },
        orderBy: { id: "asc" },
        take: repairBatchSize,
        include: { reviews: true, reviewAssignments: true }
      });
      for (const practice of fragileReadyPractices) {
        const cycleReviews = (practice.reviews || []).filter(
          (item) => Number(item.reviewedVersion) === Number(practice.contentVersion)
        );
        const validApprovals = await currentlyValidApprovals(tx, practice, cycleReviews, currentTime);
        const validRoles = new Set(validApprovals.map((item) => item.capabilityType));
        const reviewerPeople = new Set(validApprovals
          .filter((item) => item.capabilityType === "REVIEWER")
          .map((item) => item.reviewerId)
          .filter(Boolean));
        const requiredReviewerCount = practice.riskLevel === "HIGH" ? 2 : 1;
        const missingRoles = ["EDITOR", "ETHICS"].filter((type) => !validRoles.has(type));
        if (reviewerPeople.size >= requiredReviewerCount && missingRoles.length === 0) continue;
        flag({
          type: practice.riskLevel === "HIGH" ? "high_risk_chain" : "review_chain",
          issue: "invalid_or_missing_current_approval",
          practiceId: practice.id,
          reviewerCount: reviewerPeople.size,
          missingRoles
        });
        if (!dryRun) {
          const updated = await tx.effectivePractice.updateMany({
            where: { id: practice.id, version: practice.version, status: "READY_TO_PUBLISH" },
            data: { status: "IN_REVIEW", version: { increment: 1 } }
          });
          if (!updated || updated.count !== 1) continue;
          const excludedReviewers = [...reviewerPeople];
          while (excludedReviewers.length < requiredReviewerCount) {
            const replacement = await assignReplacementReviewerTx(
              tx, practice, "REVIEWER", practice.contentVersion, currentTime, excludedReviewers
            );
            if (!replacement?.reviewerId) break;
            excludedReviewers.push(replacement.reviewerId);
          }
          for (const capabilityType of missingRoles) {
            await assignReplacementReviewerTx(tx, practice, capabilityType, practice.contentVersion, currentTime);
          }
          await recordAudit(
            tx, practice, auditActorId,
            practice.riskLevel === "HIGH" ? "HIGH_RISK_REVIEW_CHAIN_REPAIRED" : "REVIEW_CHAIN_REPAIRED",
            "READY_TO_PUBLISH", "IN_REVIEW",
            { missingRoles, reviewerCount: reviewerPeople.size }
          );
        }
        candidateRepairs += 1;
      }

      const applications = await tx.effectivePracticeApplication.findMany({
        where: { status: { in: ["WAITING_FOR_REVIEW", "SUBMITTED"] } },
        orderBy: { id: "asc" },
        take: repairBatchSize,
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
        flag({ type: "application", issue: application.assignedReviewerId ? "invalid_capability" : "unassigned_reviewer", applicationId: application.id });
        if (dryRun) {
          applicationRepairs += 1;
          continue;
        }
        const replacement = await chooseApplicationReviewerTx(tx, applicationScope, application.authorId, currentTime);
        const updated = await tx.effectivePracticeApplication.updateMany({
          where: {
            id: application.id,
            status: { in: ["WAITING_FOR_REVIEW", "SUBMITTED"] },
            assignedReviewerId: application.assignedReviewerId || null,
            assignedCapabilityType: application.assignedCapabilityType || null
          },
          data: {
            status: replacement ? "SUBMITTED" : "WAITING_FOR_REVIEW",
            assignedReviewerId: replacement?.userId || null,
            assignedCapabilityType: replacement?.type || null
          }
        });
        if (!updated || updated.count !== 1) continue;
        if (!replacement) unresolved += 1;
        await recordAudit(tx, application.practice, auditActorId, "APPLICATION_ASSIGNMENT_REPAIR_APPLIED", application.practice?.status, application.practice?.status, {
          applicationId: application.id,
          issue: application.assignedReviewerId ? "invalid_capability" : "unassigned_reviewer",
          result: replacement ? "reassigned" : "left_waiting",
          replacementAssigned: Boolean(replacement)
        });
        applicationRepairs += 1;
      }

      return { dryRun, candidateRepairs, applicationRepairs, unresolved, findings };
    });
  }

  // P1-D: read the gated, append-only justification ledger. The author sees only
  // author-facing feedback; a reviewer sees author feedback plus their OWN private
  // notes; another reviewer's private reasoning is never returned; an unrelated
  // user gets a generic 404 (and the public serializer never carries any of it).
  async function getJustificationHistory(actorValue, publicId) {
    const actor = normalizeActor(actorValue);
    const practice = await loadByPublicId(publicId, false);
    const isAuthor = practice.authorId === actor.userId;
    const capabilities = await activeCapabilities(db, actor.userId, now());
    // SOL-P1-4: a review capability only grants access if its SCOPE matches THIS
    // practice — a reviewer for another domain cannot read this practice's feedback.
    const isReviewer = capabilities.some((item) => CAPABILITY_TYPES.has(item.type) && scopeMatchesPractice(item.scope, practice));
    const events = await db.effectivePracticeAuditEvent.findMany({
      where: { practiceId: practice.id, action: "REVIEW_JUSTIFICATION" },
      orderBy: { createdAt: "asc" }
    });
    const ownsEvent = events.some((event) => event.actorId && event.actorId === actor.userId);
    if (!isAuthor && !isReviewer && !ownsEvent) throw notFound();
    return events
      .filter((event) => {
        if (event.actorId && event.actorId === actor.userId) return true; // your own note
        if (event.justificationVisibility === "author") return isAuthor || isReviewer;
        return false; // another reviewer's private reasoning is never returned
      })
      .map((event) => ({
        id: event.id,
        decisionType: event.decisionType,
        justification: event.justification,
        visibility: event.justificationVisibility,
        contentVersion: event.contentVersion,
        actorId: event.actorId && event.actorId === actor.userId ? event.actorId : null,
        createdAt: event.createdAt
      }));
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
    repairAssignments,
    processRagIngest,
    runPracticeReviewSchedulerTick,
    getJustificationHistory
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

export function buildEffectivePracticeRagText(snapshot) {
  const sections = [
    ["Practice", snapshot.title, 500],
    ["Summary", snapshot.summary, 2_500],
    ["Suitable context", snapshot.suitableContext, 1_500],
    ["Conditions", (snapshot.conditions || []).join("; "), 1_500],
    ["Limitations", snapshot.limitations, 1_500],
    ["Steps", (snapshot.steps || []).join("\n"), 3_500],
    ["Expected or observed outcome", snapshot.expectedOutcome, 2_000],
    ["Learning points", snapshot.learningPoints, 2_000],
    ["Sources and evidence", snapshot.sources, 2_500],
    ["Target groups", (snapshot.targetGroups || []).join(", "), 800],
    ["Environments", (snapshot.environments || []).join(", "), 800]
  ];
  return sections.filter(([, value]) => value).map(([label, value, budget]) => {
    const normalized = String(value).trim();
    const bounded = normalized.length > budget ? `${normalized.slice(0, budget - 20).trimEnd()}\n[section truncated]` : normalized;
    return `${label}: ${bounded}`;
  }).join("\n\n");
}

export async function syncEffectivePracticeSnapshot() {
  return { status: "skipped", reason: "rag_retired", docId: null };
}

async function defaultSyncPublishedSnapshot(publication, actor) {
  return syncEffectivePracticeSnapshot(publication, actor);
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
export const retryEffectivePracticeRagIngest = (...args) => defaultService.processRagIngest(...args);
export const runEffectivePracticeReviewScheduler = (...args) => defaultService.runPracticeReviewSchedulerTick(...args);
export const getEffectivePracticeJustificationHistory = (...args) => defaultService.getJustificationHistory(...args);
export { DEFAULT_MAX_RAG_INGEST_ATTEMPTS, deterministicRagDocumentId };
