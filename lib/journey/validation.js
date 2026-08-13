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

export const JOURNEY_CONTEXT_SCHEMA_VERSION = 1;

function publicError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function normalizeJourneyText(value, maxLength, fallback = "") {
  const scalarValue = ["string", "number", "boolean"].includes(typeof value) ? value : "";
  const normalized = String(scalarValue || "")
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
      const id = normalizeContextText(item.id, 80);
      const title = normalizeContextText(item.title, JOURNEY_TEXT_LIMITS.shortItem);
      const description = normalizeContextText(item.description, JOURNEY_TEXT_LIMITS.shortItem);
      const type = normalizeContextText(item.type, 60);
      if (title) {
        result.push({
          ...(id ? { id } : {}),
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

function normalizeContextText(value, maxLength = JOURNEY_TEXT_LIMITS.contextText) {
  if (!["string", "number", "boolean"].includes(typeof value)) return "";
  return normalizeJourneyText(value, maxLength);
}

function normalizeContextStringArray(value, maxItems = 20) {
  if (!Array.isArray(value)) return [];
  const result = [];
  const seen = new Set();

  for (const item of value) {
    const normalized = normalizeContextText(item, JOURNEY_TEXT_LIMITS.shortItem);
    const key = normalized.toLocaleLowerCase("et");
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= maxItems) break;
  }

  return result;
}

function assignText(result, source, key, maxLength = JOURNEY_TEXT_LIMITS.contextText) {
  if (!Object.hasOwn(source, key)) return;
  const normalized = normalizeContextText(source[key], maxLength);
  if (normalized) result[key] = normalized;
}

function assignBoolean(result, source, key) {
  if (typeof source[key] === "boolean" || source[key] === null) result[key] = source[key];
}

function assignStringArray(result, source, key, maxItems = 20) {
  if (!Object.hasOwn(source, key)) return;
  result[key] = normalizeContextStringArray(source[key], maxItems);
}

function normalizeAssistiveDevices(value) {
  if (!Array.isArray(value)) return [];
  const result = [];

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const device = {};
    assignText(device, item, "id", 80);
    assignText(device, item, "name", 120);
    assignText(device, item, "status", 40);
    assignText(device, item, "useContext", 40);
    assignText(device, item, "issue", 300);
    assignText(device, item, "supportNeed", 300);
    assignStringArray(device, item, "relatedNeedTags", 20);
    assignStringArray(device, item, "relatedLifeDomains", 20);
    assignStringArray(device, item, "relatedDocuments", 20);
    assignStringArray(device, item, "suggestedActions", 20);
    if (Object.keys(device).length) result.push(device);
    if (result.length >= 8) break;
  }

  return result;
}

function normalizeActivityLog(value) {
  if (!Array.isArray(value)) return [];
  const result = [];

  for (const item of value) {
    if (typeof item === "string") {
      const title = normalizeContextText(item, JOURNEY_TEXT_LIMITS.shortItem);
      if (title) result.push({ title });
    } else if (item && typeof item === "object" && !Array.isArray(item)) {
      const entry = {};
      assignText(entry, item, "id", 80);
      assignText(entry, item, "type", 80);
      assignText(entry, item, "title", JOURNEY_TEXT_LIMITS.shortItem);
      assignText(entry, item, "description", JOURNEY_TEXT_LIMITS.contextText);
      assignText(entry, item, "date", 80);
      assignText(entry, item, "createdAt", 80);
      if (Object.keys(entry).length) result.push(entry);
    }
    if (result.length >= 50) break;
  }

  return result;
}

function normalizeHelpMediation(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = {};
  assignText(result, value, "categoryCode", 80);
  assignStringArray(result, value, "needTags", 20);
  assignStringArray(result, value, "lifeDomains", 20);
  assignStringArray(result, value, "relatedServiceCategories", 20);
  return Object.keys(result).length ? result : null;
}

function normalizeServiceContinuity(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = {};
  for (const key of ["serviceName", "currentProvider", "municipality", "userGoal"]) {
    assignText(result, value, key, JOURNEY_TEXT_LIMITS.contextText);
  }
  for (const key of ["endDate", "updatedAt"]) assignText(result, value, key, 80);
  for (const key of [
    "hasExistingService",
    "knownEndDate",
    "hasDecisionOrPlan",
    "documentAttached",
    "kovAlreadyInvolved",
    "providerAlreadyInvolved"
  ]) {
    assignBoolean(result, value, key);
  }
  return Object.keys(result).length ? result : null;
}

function normalizeHealthContact(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = {};
  assignText(result, value, "userQuestion", JOURNEY_TEXT_LIMITS.contextText);
  assignText(result, value, "goal", JOURNEY_TEXT_LIMITS.contextText);
  return Object.keys(result).length ? result : null;
}

function normalizeContext(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const result = { schemaVersion: JOURNEY_CONTEXT_SCHEMA_VERSION };
  for (const key of [
    "source",
    "overviewType",
    "personWish",
    "personContext",
    "contextNote",
    "municipalityName",
    "municipalityText",
    "municipalityId",
    "municipality",
    "county",
    "region",
    "kov"
  ]) {
    assignText(result, source, key);
  }
  for (const key of ["lifeDomains", "needTags", "keywords"]) {
    assignStringArray(result, source, key, 20);
  }
  if (Object.hasOwn(source, "assistiveDevices")) {
    result.assistiveDevices = normalizeAssistiveDevices(source.assistiveDevices);
  }
  if (Object.hasOwn(source, "activityLog")) {
    result.activityLog = normalizeActivityLog(source.activityLog);
  }
  const helpMediation = normalizeHelpMediation(source.helpMediation);
  if (helpMediation) result.helpMediation = helpMediation;
  const serviceContinuity = normalizeServiceContinuity(source.serviceContinuity);
  if (serviceContinuity) result.serviceContinuity = serviceContinuity;
  const healthContact = normalizeHealthContact(source.healthContact);
  if (healthContact) result.healthContact = healthContact;

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
