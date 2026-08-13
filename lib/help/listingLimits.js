export const HELP_LISTING_TEXT_LIMITS = Object.freeze({
  title: 160,
  description: 5000,
  structuredSummary: 280,
  roleLabel: 120,
  beneficiaryLabel: 120,
  urgency: 120,
  providerScopeOrConditions: 500,
  availabilityOrStart: 240,
  compensationDetails: 240,
  conditions: 500,
  skillsOrBackground: 500,
  rawPlace: 160
});

export function helpListingFieldTooLong(field, limit, actual) {
  const error = new Error("HELP_LISTING_FIELD_TOO_LONG");
  error.code = "HELP_LISTING_FIELD_TOO_LONG";
  error.field = field;
  error.limit = limit;
  error.actual = actual;
  return error;
}

export function normalizeHelpListingText(value, {
  field,
  limit = HELP_LISTING_TEXT_LIMITS[field],
  preserveNewlines = false
} = {}) {
  const raw = String(value || "");
  const normalized = preserveNewlines
    ? raw.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
    : raw.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (!Number.isFinite(limit) || limit < 1) throw new Error(`Unknown help listing text limit: ${field}`);
  if (normalized.length > limit) throw helpListingFieldTooLong(field, limit, normalized.length);
  return normalized;
}

export function truncateDerivedHelpText(value, limit) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, limit) : null;
}
