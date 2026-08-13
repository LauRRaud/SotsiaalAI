import {
  MENTOR_CONSENT_STATUS,
  MENTOR_PROFILE_ORIGIN,
  MENTOR_PROFILE_STATUS,
  MENTORING_LIMITS
} from "./constants.js";

const SNAPSHOT_FIELDS = Object.freeze([
  "displayName",
  "title",
  "organization",
  "fields",
  "topics",
  "languages",
  "formats",
  "bioShort",
  "bioFull",
  "experienceSummary"
]);

export const MENTOR_CONSENT_EVIDENCE_TYPES = Object.freeze([
  "EMAIL",
  "WRITTEN",
  "RECORDED_CALL",
  "IN_PERSON"
]);

export function mentorProfileSnapshot(profile) {
  return Object.fromEntries(SNAPSHOT_FIELDS.map((field) => [field, profile?.[field] ?? null]));
}

function validDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function subtractUtcMonths(value, months) {
  const date = new Date(value.getTime());
  date.setUTCMonth(date.getUTCMonth() - months);
  return date;
}

export function hasCurrentExternalConsent(profile, now = new Date()) {
  if (profile?.origin !== MENTOR_PROFILE_ORIGIN.ESTA_IMPORT || profile?.userId) return false;
  if (profile.consentStatus !== MENTOR_CONSENT_STATUS.CONSENTED) return false;
  if (!MENTOR_CONSENT_EVIDENCE_TYPES.includes(String(profile.consentEvidenceType || ""))) return false;
  if (!String(profile.consentEvidenceRef || "").trim()) return false;
  const checkedAt = validDate(profile.checkedAt);
  const capturedAt = validDate(profile.consentCapturedAt);
  if (!checkedAt || !capturedAt) return false;
  if (checkedAt > now || capturedAt > now || capturedAt > checkedAt) return false;
  return checkedAt >= subtractUtcMonths(now, MENTORING_LIMITS.STALE_EXTERNAL_MONTHS);
}

export function publicMentorProfile(profile, now = new Date()) {
  if (!profile) return null;
  const external = profile.origin === MENTOR_PROFILE_ORIGIN.ESTA_IMPORT && !profile.userId;
  if (external) return hasCurrentExternalConsent(profile, now) ? profile : null;
  const publishableStatus = profile.status === MENTOR_PROFILE_STATUS.ACTIVE
    || profile.status === MENTOR_PROFILE_STATUS.PENDING_REVIEW;
  if (!publishableStatus || profile.approvedSnapshotVisible !== true) return null;
  const snapshot = profile.approvedSnapshot;
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  return { ...profile, ...snapshot };
}
