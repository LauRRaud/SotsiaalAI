export const SERVICE_MAP_ACCESS_TYPES = Object.freeze([
  "DIRECT_CONTACT",
  "KOV_ASSESSMENT",
  "KOV_DECISION",
  "PROVIDER_CONTACT",
  "DOCUMENT_REVIEW",
  "HEALTH_CONTACT_FIRST",
  "UNKNOWN"
]);

export const SERVICE_MAP_FIRST_STEPS = Object.freeze([
  "CONTACT_KOV",
  "CONTACT_PROVIDER",
  "CREATE_PRE_INQUIRY",
  "OPEN_SERVICE_MAP",
  "ANALYZE_DOCUMENT",
  "CHECK_SOURCE",
  "CONTACT_HEALTH_PROVIDER",
  "UNKNOWN"
]);

export const SERVICE_MAP_DECISION_BY = Object.freeze([
  "KOV",
  "SERVICE_PROVIDER",
  "HEALTHCARE_PROVIDER",
  "OTHER_AUTHORITY",
  "UNKNOWN"
]);

export const SERVICE_MAP_SOURCE_STATUSES = Object.freeze([
  "CONFIRMED",
  "PARTIAL",
  "NEEDS_CHECK",
  "UNKNOWN"
]);

function text(value, limit = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function enumValue(value, allowed, fallback = "UNKNOWN") {
  const normalized = text(value, 80).toUpperCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function nullableBoolean(value) {
  if (value === true || value === false) return value;
  return null;
}

export function normalizeServiceMapAccessPath(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      accessType: "UNKNOWN",
      firstStep: "CHECK_SOURCE",
      decisionBy: "UNKNOWN",
      requiresAssessment: null,
      requiresDecision: null,
      requiresReferral: null,
      userExplanation: "",
      specialistNote: "",
      sourceStatus: "UNKNOWN",
      checkedAt: null,
      sourceUrl: null
    };
  }

  return {
    accessType: enumValue(value.accessType, SERVICE_MAP_ACCESS_TYPES),
    firstStep: enumValue(value.firstStep, SERVICE_MAP_FIRST_STEPS, "CHECK_SOURCE"),
    decisionBy: enumValue(value.decisionBy, SERVICE_MAP_DECISION_BY),
    requiresAssessment: nullableBoolean(value.requiresAssessment),
    requiresDecision: nullableBoolean(value.requiresDecision),
    requiresReferral: nullableBoolean(value.requiresReferral),
    userExplanation: text(value.userExplanation, 700),
    specialistNote: text(value.specialistNote, 700),
    sourceStatus: enumValue(value.sourceStatus, SERVICE_MAP_SOURCE_STATUSES),
    checkedAt: text(value.checkedAt, 40) || null,
    sourceUrl: text(value.sourceUrl, 600) || null
  };
}

export function serviceMapAccessPathHasDetails(value = {}) {
  const accessPath = normalizeServiceMapAccessPath(value);
  return Boolean(
    accessPath.userExplanation ||
    accessPath.specialistNote ||
    accessPath.accessType !== "UNKNOWN" ||
    accessPath.firstStep !== "CHECK_SOURCE" ||
    accessPath.decisionBy !== "UNKNOWN" ||
    accessPath.sourceStatus !== "UNKNOWN" ||
    accessPath.checkedAt ||
    accessPath.sourceUrl ||
    accessPath.requiresAssessment !== null ||
    accessPath.requiresDecision !== null ||
    accessPath.requiresReferral !== null
  );
}
