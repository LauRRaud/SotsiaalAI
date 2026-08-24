import { RAG_SOURCE_FRESHNESS_POLICIES } from "../rag/sourceFreshness.js";

const CONTACT_CHECK_ACTION = "SERVICE_MAP_CONTACT_FRESHNESS_CHECK";
const CONTACT_CHECK_RESOURCE_TYPE = "ServiceMapContactRegistry";
export const CONTACT_VERIFICATION_VERSION = 2;
export const SERVICE_MAP_CONTACT_TYPES = ["KOV_SOCIAL_CONTACT", "KOV_GENERAL_CONTACT"];
export const SERVICE_MAP_PERSON_CONTACT_NAMESPACES = ["KOV_FILE_CONTACT", "RAG_KOV_CONTACT"];
export const SERVICE_MAP_CONTACT_CHECK_SCHEDULE = Object.freeze({
  cadence: "weekly",
  timer: "sotsiaalai-service-map-contact-check.timer"
});
const STRONG_MISSING_REASONS = [
  "contact_name_not_found",
  "email_not_found",
  "phone_not_found"
];

function cleanId(value) {
  return String(value || "").trim();
}

function validDate(value) {
  const parsed = new Date(value || "");
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function verificationCutoff(now = new Date()) {
  const maxAgeDays = Number(RAG_SOURCE_FRESHNESS_POLICIES.official_contact?.maxAgeDays || 90);
  return new Date(now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000);
}

export function isStronglyMissingContactCandidate(candidate = {}) {
  if (typeof candidate?.stronglyMissing === "boolean") {
    return candidate.stronglyMissing;
  }
  const reasons = new Set(Array.isArray(candidate?.reasons) ? candidate.reasons : []);
  return STRONG_MISSING_REASONS.every(reason => reasons.has(reason));
}

export function stronglyMissingContactIdsFromAuditMeta(meta = {}) {
  if (Array.isArray(meta?.stronglyMissingContactIds)) {
    return [...new Set(meta.stronglyMissingContactIds.map(cleanId).filter(Boolean))];
  }
  const candidateIds = (Array.isArray(meta?.candidates) ? meta.candidates : [])
    .filter(isStronglyMissingContactCandidate)
    .map(candidate => cleanId(candidate?.id))
    .filter(Boolean);
  return [...new Set(candidateIds)];
}

export function contactVerificationProjectionFromAuditMeta(meta = {}, { now = new Date() } = {}) {
  const cutoff = verificationCutoff(now);
  const decisionObservedAt = meta?.contactDecisionObservedAt && typeof meta.contactDecisionObservedAt === "object"
    ? meta.contactDecisionObservedAt
    : {};

  if (
    Number(meta?.contactVerificationVersion) === CONTACT_VERIFICATION_VERSION &&
    Array.isArray(meta?.verifiedContactIds)
  ) {
    const verifiedAtById = {};
    const idsByVerifiedAt = new Map();
    const verifiedContactIds = [...new Set(meta.verifiedContactIds.map(cleanId).filter(Boolean))]
      .filter((id) => {
        const observedAt = validDate(decisionObservedAt[id]);
        if (!observedAt || observedAt < cutoff || observedAt > now) return false;
        const verifiedAt = observedAt.toISOString();
        verifiedAtById[id] = verifiedAt;
        if (!idsByVerifiedAt.has(verifiedAt)) idsByVerifiedAt.set(verifiedAt, []);
        idsByVerifiedAt.get(verifiedAt).push(id);
        return true;
      });
    const verifiedGroups = [...idsByVerifiedAt.entries()].map(([verifiedAt, ids]) => ({
      id: { in: ids },
      checkedAt: { equals: new Date(verifiedAt) }
    }));
    return {
      mode: "per_contact_verification",
      verificationVersion: CONTACT_VERIFICATION_VERSION,
      verifiedContactIds,
      verifiedAtById,
      whereIdentity: verifiedGroups.length ? { OR: verifiedGroups } : { id: { in: [] } }
    };
  }

  return {
    mode: "unverified",
    verificationVersion: CONTACT_VERIFICATION_VERSION,
    verifiedContactIds: [],
    verifiedAtById: {},
    whereIdentity: { id: { in: [] } }
  };
}

export async function loadServiceMapContactVerificationProjection(db, { now = new Date() } = {}) {
  if (!db?.dataAuditLog?.findFirst) {
    return contactVerificationProjectionFromAuditMeta({}, { now });
  }
  const latest = await db.dataAuditLog.findFirst({
    where: {
      action: CONTACT_CHECK_ACTION,
      resourceType: CONTACT_CHECK_RESOURCE_TYPE
    },
    orderBy: { createdAt: "desc" },
    select: { meta: true }
  });
  return contactVerificationProjectionFromAuditMeta(latest?.meta, { now });
}

export async function buildFreshServiceMapContactWhere(db, options = {}) {
  const projection = await loadServiceMapContactVerificationProjection(db, options);
  return {
    type: { in: SERVICE_MAP_CONTACT_TYPES },
    sourceNamespace: { in: SERVICE_MAP_PERSON_CONTACT_NAMESPACES },
    status: "PUBLISHED",
    tombstonedAt: null,
    sourceUrl: { not: null },
    ...projection.whereIdentity
  };
}

export async function buildPublicServiceMapContactEligibilityClause(db, options = {}) {
  const contactWhere = await buildFreshServiceMapContactWhere(db, options);
  const { type: _type, status: _status, sourceNamespace: _sourceNamespace, ...freshnessWhere } = contactWhere;
  return {
    OR: [
      { type: { notIn: SERVICE_MAP_CONTACT_TYPES } },
      {
        type: { in: SERVICE_MAP_CONTACT_TYPES },
        sourceNamespace: "KOV_MUNICIPALITY",
        tombstonedAt: null
      },
      {
        type: { in: SERVICE_MAP_CONTACT_TYPES },
        sourceNamespace: { in: SERVICE_MAP_PERSON_CONTACT_NAMESPACES },
        ...freshnessWhere
      }
    ]
  };
}
