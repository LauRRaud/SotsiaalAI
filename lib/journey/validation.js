import {
  JOURNEY_DEFAULT_ROLE_CONTEXT,
  JOURNEY_DEFAULT_SHARING_STATUS,
  JOURNEY_DEFAULT_STATUS,
  JOURNEY_PRIMARY_PATHS,
  JOURNEY_ROLE_CONTEXTS,
  JOURNEY_SHARING_STATUSES,
  JOURNEY_STATUSES,
  JOURNEY_TEXT_LIMITS
} from "./constants.js";

function publicError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function normalizeJourneyText(value, maxLength, fallback = "") {
  const normalized = String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
  if (!normalized) return fallback;
  return normalized.slice(0, maxLength);
}

function normalizeEnum(value, allowedValues, fallback) {
  const normalized = String(value || "").trim().toUpperCase();
  return allowedValues.includes(normalized) ? normalized : fallback;
}

function normalizeNullableEnum(value, allowedValues) {
  const normalized = String(value || "").trim().toUpperCase();
  return allowedValues.includes(normalized) ? normalized : null;
}

function normalizeStringArray(value, maxItems = 12) {
  const source = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/\r?\n|,/)
        .map((item) => item.trim());
  const result = [];
  const seen = new Set();

  for (const item of source) {
    const normalized = normalizeJourneyText(item, JOURNEY_TEXT_LIMITS.shortItem);
    const key = normalized.toLocaleLowerCase("et");
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= maxItems) break;
  }

  return result;
}

function normalizeSuggestedActions(value) {
  const source = Array.isArray(value) ? value : normalizeStringArray(value, 8);
  const result = [];

  for (const item of source) {
    if (typeof item === "string") {
      const title = normalizeJourneyText(item, JOURNEY_TEXT_LIMITS.shortItem);
      if (title) result.push({ title });
    } else if (item && typeof item === "object") {
      const title = normalizeJourneyText(item.title, JOURNEY_TEXT_LIMITS.shortItem);
      const description = normalizeJourneyText(item.description, JOURNEY_TEXT_LIMITS.shortItem);
      const type = normalizeJourneyText(item.type, 60);
      if (title) {
        result.push({
          title,
          ...(description ? { description } : {}),
          ...(type ? { type } : {})
        });
      }
    }
    if (result.length >= 8) break;
  }

  return result;
}

function normalizeContext(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result = {};

  for (const [key, item] of Object.entries(value)) {
    const normalizedKey = normalizeJourneyText(key, 80);
    if (!normalizedKey) continue;
    if (typeof item === "string") {
      result[normalizedKey] = normalizeJourneyText(item, JOURNEY_TEXT_LIMITS.contextText);
    } else if (typeof item === "number" || typeof item === "boolean" || item === null) {
      result[normalizedKey] = item;
    } else if (Array.isArray(item)) {
      result[normalizedKey] = normalizeStringArray(item, 20);
    } else if (item && typeof item === "object") {
      const nested = {};
      for (const [nestedKey, nestedValue] of Object.entries(item)) {
        const cleanNestedKey = normalizeJourneyText(nestedKey, 80);
        if (!cleanNestedKey) continue;
        if (typeof nestedValue === "string") {
          nested[cleanNestedKey] = normalizeJourneyText(nestedValue, JOURNEY_TEXT_LIMITS.shortItem);
        } else if (typeof nestedValue === "number" || typeof nestedValue === "boolean" || nestedValue === null) {
          nested[cleanNestedKey] = nestedValue;
        } else if (Array.isArray(nestedValue)) {
          nested[cleanNestedKey] = normalizeStringArray(nestedValue, 12);
        }
      }
      result[normalizedKey] = nested;
    }
  }

  return result;
}

export function normalizeJourneyCreateInput(input = {}, options = {}) {
  const summary = normalizeJourneyText(input.summary, JOURNEY_TEXT_LIMITS.summary);
  if (!summary) {
    throw publicError("journeys.errors.summary_required", 400);
  }

  const title = normalizeJourneyText(input.title, JOURNEY_TEXT_LIMITS.title)
    || summary.slice(0, 72)
    || "Teekond";

  const primaryPath = normalizeNullableEnum(input.primaryPath, JOURNEY_PRIMARY_PATHS);

  return {
    roleContext: normalizeEnum(
      input.roleContext || options.roleContext,
      JOURNEY_ROLE_CONTEXTS,
      JOURNEY_DEFAULT_ROLE_CONTEXT
    ),
    status: normalizeEnum(input.status, JOURNEY_STATUSES, JOURNEY_DEFAULT_STATUS),
    sharingStatus: normalizeEnum(
      input.sharingStatus,
      JOURNEY_SHARING_STATUSES,
      JOURNEY_DEFAULT_SHARING_STATUS
    ),
    title,
    summary,
    primaryPath,
    domains: normalizeStringArray(input.domains, 12),
    missingInfo: normalizeStringArray(input.missingInfo, 12),
    riskSignals: normalizeStringArray(input.riskSignals, 8),
    suggestedActions: normalizeSuggestedActions(input.suggestedActions),
    context: normalizeContext(input.context),
    conversationId: normalizeJourneyText(input.conversationId, 120) || null
  };
}

export function normalizeJourneyUpdateInput(input = {}) {
  const data = {};

  if (Object.hasOwn(input, "title")) {
    const title = normalizeJourneyText(input.title, JOURNEY_TEXT_LIMITS.title);
    if (!title) throw publicError("journeys.errors.title_required", 400);
    data.title = title;
  }

  if (Object.hasOwn(input, "summary")) {
    const summary = normalizeJourneyText(input.summary, JOURNEY_TEXT_LIMITS.summary);
    if (!summary) throw publicError("journeys.errors.summary_required", 400);
    data.summary = summary;
  }

  if (Object.hasOwn(input, "primaryPath")) {
    data.primaryPath = normalizeNullableEnum(input.primaryPath, JOURNEY_PRIMARY_PATHS);
  }

  if (Object.hasOwn(input, "status")) {
    data.status = normalizeEnum(input.status, JOURNEY_STATUSES, JOURNEY_DEFAULT_STATUS);
  }

  if (Object.hasOwn(input, "sharingStatus")) {
    data.sharingStatus = normalizeEnum(
      input.sharingStatus,
      JOURNEY_SHARING_STATUSES,
      JOURNEY_DEFAULT_SHARING_STATUS
    );
  }

  if (Object.hasOwn(input, "domains")) data.domains = normalizeStringArray(input.domains, 12);
  if (Object.hasOwn(input, "missingInfo")) data.missingInfo = normalizeStringArray(input.missingInfo, 12);
  if (Object.hasOwn(input, "riskSignals")) data.riskSignals = normalizeStringArray(input.riskSignals, 8);
  if (Object.hasOwn(input, "suggestedActions")) data.suggestedActions = normalizeSuggestedActions(input.suggestedActions);
  if (Object.hasOwn(input, "context")) data.context = normalizeContext(input.context);

  return data;
}

export function normalizeJourneyDraftInput(input = {}) {
  const situation = normalizeJourneyText(input.situation || input.summary, JOURNEY_TEXT_LIMITS.summary);
  if (!situation) {
    throw publicError("journeys.errors.situation_required", 400);
  }
  return { situation };
}
