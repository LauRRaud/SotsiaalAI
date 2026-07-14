export const SERVICE_AVAILABILITY_STATUSES = Object.freeze([
  "accepting",
  "waitlist",
  "not_accepting"
]);

export const SERVICE_AVAILABILITY_DEFAULT_FRESH_DAYS = 28;
export const SERVICE_AVAILABILITY_DESCRIPTION_MAX_LENGTH = 500;

const LEGACY_STATUS_MAP = new Map([
  ["saadaval", "accepting"],
  ["järjekord", "waitlist"],
  ["jarjekord", "waitlist"],
  ["peatatud", "not_accepting"]
]);

function cleanStatus(value) {
  return String(value || "").normalize("NFKC").trim();
}

export function isCanonicalServiceAvailabilityStatus(value) {
  return SERVICE_AVAILABILITY_STATUSES.includes(cleanStatus(value).toLowerCase());
}

export function canonicalServiceAvailabilityStatus(value, { includeLegacy = true } = {}) {
  const raw = cleanStatus(value);
  const canonical = raw.toLowerCase();
  if (SERVICE_AVAILABILITY_STATUSES.includes(canonical)) return canonical;
  if (includeLegacy) return LEGACY_STATUS_MAP.get(canonical) || "unknown";
  return "unknown";
}

export function serviceAvailabilityFreshDays(value = process.env.SERVICE_AVAILABILITY_FRESH_DAYS) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 365) {
    return SERVICE_AVAILABILITY_DEFAULT_FRESH_DAYS;
  }
  return Math.trunc(parsed);
}

export function normalizeServiceAvailabilityDescription(value) {
  const normalized = String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
  return normalized ? normalized.slice(0, SERVICE_AVAILABILITY_DESCRIPTION_MAX_LENGTH) : null;
}

export function normalizeAvailabilityStatusForWrite(value, existingService = null) {
  const raw = cleanStatus(value).slice(0, 120) || null;
  if (!raw) return null;
  const canonical = raw.toLowerCase();
  if (isCanonicalServiceAvailabilityStatus(canonical)) return canonical;
  const existingRaw = cleanStatus(existingService?.availabilityStatus).slice(0, 120) || null;
  if (existingService?.id && existingRaw === raw) return existingRaw;
  const error = new Error("service_provider_profile.errors.availability_status_invalid");
  error.status = 400;
  throw error;
}

function validDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function getServiceAvailabilityState(service = {}, options = {}) {
  const now = validDate(options.now) || new Date();
  const freshDays = serviceAvailabilityFreshDays(options.freshDays);
  const rawStatus = cleanStatus(service.availabilityStatus);
  const status = canonicalServiceAvailabilityStatus(rawStatus);
  const isCanonical = isCanonicalServiceAvailabilityStatus(rawStatus);
  const checkedDate = validDate(service.availabilityCheckedAt);
  const ageMs = checkedDate ? Math.max(0, now.getTime() - checkedDate.getTime()) : null;
  const ageDays = ageMs === null ? null : Math.floor(ageMs / 86_400_000);
  const stale = Boolean(checkedDate && ageMs > freshDays * 86_400_000);
  const freshness = status === "unknown" || !checkedDate
    ? "unknown"
    : stale
      ? "stale"
      : "fresh";
  const reason = status === "unknown"
    ? "status_unknown"
    : !checkedDate
      ? "never_confirmed"
      : stale
        ? "expired"
        : "fresh";

  return {
    status,
    isCanonical,
    freshness,
    reason,
    stale,
    ageDays,
    freshDays,
    checkedAt: checkedDate?.toISOString() || null,
    description: normalizeServiceAvailabilityDescription(service.availabilityDescription),
    canConfirm: isCanonical
  };
}

export function serviceAvailabilityReminderDue(service = {}, options = {}) {
  const state = getServiceAvailabilityState(service, options);
  if (!state.isCanonical || state.freshness !== "stale" || !state.checkedAt) return false;
  const reminderSentAt = validDate(service.availabilityReminderSentAt);
  const checkedAt = validDate(service.availabilityCheckedAt);
  return !reminderSentAt || reminderSentAt.getTime() < checkedAt.getTime();
}

export function serializePublicServiceAvailability(service = {}, options = {}) {
  const state = getServiceAvailabilityState(service, options);
  return {
    status: state.status,
    freshness: state.freshness,
    reason: state.reason,
    stale: state.stale,
    ageDays: state.ageDays,
    freshDays: state.freshDays,
    checkedAt: state.checkedAt,
    description: state.description
  };
}

export function serviceAvailabilityRagFields(service = {}, options = {}) {
  const state = getServiceAvailabilityState(service, options);
  return {
    availability_status: state.status,
    availability_description: state.description,
    availability_checked_at: state.checkedAt,
    availability_freshness: state.freshness,
    availability_stale: state.stale
  };
}
