import { RAG_SOURCE_FRESHNESS_POLICIES } from "../rag/sourceFreshness.js";

const CONTACT_CHECK_ACTION = "SERVICE_MAP_CONTACT_FRESHNESS_CHECK";
const CONTACT_CHECK_RESOURCE_TYPE = "ServiceMapContactRegistry";
export const CONTACT_VERIFICATION_VERSION = 4;
export const SERVICE_MAP_CONTACT_TYPES = ["KOV_SOCIAL_CONTACT", "KOV_GENERAL_CONTACT"];
export const SERVICE_MAP_SYNC_OWNED_CONTACT_NAMESPACES = Object.freeze([
  "KOV_FILE_CONTACT",
  "RAG_KOV_CONTACT"
]);
export const SERVICE_MAP_VERIFIABLE_CONTACT_NAMESPACES = Object.freeze([
  ...SERVICE_MAP_SYNC_OWNED_CONTACT_NAMESPACES,
  // These compatibility namespaces contain the owner-authorized public
  // restoration. They are not sync owners: every row still has to pass the
  // current per-contact web check before public or chat projection can use it.
  "LEGACY_KOV_CONTACT",
  "OFFICIAL_KOV_CONTACT"
]);
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

function buildContactIdentityProjection(
  rawIds,
  decisionObservedAt,
  decisionRevision,
  { cutoff, now, requireCheckedAt }
) {
  const verifiedAtById = {};
  const verifiedRevisionById = {};
  const idsByIdentity = new Map();
  const verifiedContactIds = [...new Set((Array.isArray(rawIds) ? rawIds : []).map(cleanId).filter(Boolean))]
    .filter((id) => {
      const observedAt = validDate(decisionObservedAt[id]);
      const revision = Number(decisionRevision[id]);
      if (
        !observedAt || observedAt < cutoff || observedAt > now ||
        !Number.isSafeInteger(revision) || revision < 1
      ) return false;
      const verifiedAt = observedAt.toISOString();
      verifiedAtById[id] = verifiedAt;
      verifiedRevisionById[id] = revision;
      const identity = `${verifiedAt}:${revision}`;
      if (!idsByIdentity.has(identity)) idsByIdentity.set(identity, { verifiedAt, revision, ids: [] });
      idsByIdentity.get(identity).ids.push(id);
      return true;
    });
  const verifiedGroups = [...idsByIdentity.values()].map(({ verifiedAt, revision, ids }) => ({
    id: { in: ids },
    ...(requireCheckedAt ? { checkedAt: { equals: new Date(verifiedAt) } } : {}),
    revision
  }));
  return {
    verifiedContactIds,
    verifiedAtById,
    verifiedRevisionById,
    whereIdentity: verifiedGroups.length ? { OR: verifiedGroups } : { id: { in: [] } }
  };
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
  const decisionRevision = meta?.contactDecisionRevision && typeof meta.contactDecisionRevision === "object"
    ? meta.contactDecisionRevision
    : {};

  if (
    Number(meta?.contactVerificationVersion) === CONTACT_VERIFICATION_VERSION &&
    Array.isArray(meta?.verifiedContactIds)
  ) {
    const full = buildContactIdentityProjection(
      meta.verifiedContactIds,
      decisionObservedAt,
      decisionRevision,
      { cutoff, now, requireCheckedAt: true }
    );
    const identity = buildContactIdentityProjection(
      meta.verifiedContactIdentityIds,
      decisionObservedAt,
      decisionRevision,
      { cutoff, now, requireCheckedAt: false }
    );
    const rawFieldVerification = meta?.contactFieldVerification && typeof meta.contactFieldVerification === "object"
      ? meta.contactFieldVerification
      : {};
    const contactFieldVerificationById = Object.fromEntries(
      identity.verifiedContactIds.map(id => [id, {
        phone: rawFieldVerification[id]?.phone === true,
        email: rawFieldVerification[id]?.email === true
      }])
    );
    return {
      mode: "per_contact_verification",
      verificationVersion: CONTACT_VERIFICATION_VERSION,
      ...full,
      verifiedContactIdentityIds: identity.verifiedContactIds,
      verifiedIdentityAtById: identity.verifiedAtById,
      verifiedIdentityRevisionById: identity.verifiedRevisionById,
      whereContactIdentity: identity.whereIdentity,
      contactFieldVerificationById
    };
  }

  return {
    mode: "unverified",
    verificationVersion: CONTACT_VERIFICATION_VERSION,
    verifiedContactIds: [],
    verifiedAtById: {},
    verifiedRevisionById: {},
    whereIdentity: { id: { in: [] } },
    verifiedContactIdentityIds: [],
    verifiedIdentityAtById: {},
    verifiedIdentityRevisionById: {},
    whereContactIdentity: { id: { in: [] } },
    contactFieldVerificationById: {}
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
    sourceNamespace: { in: SERVICE_MAP_VERIFIABLE_CONTACT_NAMESPACES },
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
        sourceNamespace: { in: SERVICE_MAP_VERIFIABLE_CONTACT_NAMESPACES },
        ...freshnessWhere
      }
    ]
  };
}
