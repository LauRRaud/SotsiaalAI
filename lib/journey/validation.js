import {
  JOURNEY_DEFAULT_ROLE_CONTEXT,
  JOURNEY_DEFAULT_SHARING_STATUS,
  JOURNEY_DEFAULT_STATUS,
  JOURNEY_PRIMARY_PATHS,
  JOURNEY_ROLE_CONTEXTS,
  JOURNEY_SHARING_STATUSES,
  JOURNEY_STATUSES,
  JOURNEY_LIST_LIMITS,
  JOURNEY_TEXT_LIMITS
} from "./constants.js";

export const JOURNEY_CONTEXT_SCHEMA_VERSION = 1;

function publicError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function boundaryError(code, field, limit) {
  const error = publicError(
    code === "JOURNEY_LIST_TOO_LONG"
      ? "journeys.errors.list_too_long"
      : "journeys.errors.field_too_long",
    400
  );
  error.code = code;
  error.field = field;
  error.limit = limit;
  return error;
}

export function normalizeJourneyText(value, maxLength, fallback = "", field = "text") {
  const scalarValue = ["string", "number", "boolean"].includes(typeof value) ? value : "";
  const normalized = String(scalarValue || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
  if (!normalized) return fallback;
  if (normalized.length > maxLength) {
    throw boundaryError("JOURNEY_FIELD_TOO_LONG", field, maxLength);
  }
  return normalized;
}

function normalizeEnum(value, allowedValues, fallback) {
  const normalized = String(value || "").trim().toUpperCase();
  return allowedValues.includes(normalized) ? normalized : fallback;
}

function normalizeClientEnum(value, allowedValues, field) {
  const normalized = String(value || "").trim().toUpperCase();
  if (!allowedValues.includes(normalized)) {
    throw publicError(`journeys.errors.${field}_invalid`, 400);
  }
  return normalized;
}

function normalizeCreateEnum(input, field, allowedValues, fallback) {
  return Object.hasOwn(input, field)
    ? normalizeClientEnum(input[field], allowedValues, field)
    : fallback;
}

function normalizeStringArray(value, maxItems = 12, field = "items") {
  const source = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/\r?\n|,/)
        .map((item) => item.trim());
  const result = [];
  const seen = new Set();

  for (const item of source) {
    const normalized = normalizeJourneyText(item, JOURNEY_TEXT_LIMITS.shortItem, "", `${field}[]`);
    const key = normalized.toLocaleLowerCase("et");
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length > maxItems) throw boundaryError("JOURNEY_LIST_TOO_LONG", field, maxItems);
  }

  return result;
}

function normalizeSuggestedActions(value) {
  const source = Array.isArray(value)
    ? value
    : normalizeStringArray(value, JOURNEY_LIST_LIMITS.suggestedActions, "suggestedActions");
  const result = [];

  for (const item of source) {
    if (typeof item === "string") {
      const title = normalizeJourneyText(item, JOURNEY_TEXT_LIMITS.shortItem, "", "suggestedActions[].title");
      if (title) result.push({ title });
    } else if (item && typeof item === "object") {
      const id = normalizeContextText(item.id, 80, "suggestedActions[].id");
      const title = normalizeContextText(item.title, JOURNEY_TEXT_LIMITS.shortItem, "suggestedActions[].title");
      const description = normalizeContextText(item.description, JOURNEY_TEXT_LIMITS.shortItem, "suggestedActions[].description");
      const type = normalizeContextText(item.type, 60, "suggestedActions[].type");
      if (title) {
        result.push({
          ...(id ? { id } : {}),
          title,
          ...(description ? { description } : {}),
          ...(type ? { type } : {})
        });
      }
    }
    if (result.length > JOURNEY_LIST_LIMITS.suggestedActions) {
      throw boundaryError("JOURNEY_LIST_TOO_LONG", "suggestedActions", JOURNEY_LIST_LIMITS.suggestedActions);
    }
  }

  return result;
}

function normalizeContextText(value, maxLength = JOURNEY_TEXT_LIMITS.contextText, field = "context") {
  if (!["string", "number", "boolean"].includes(typeof value)) return "";
  return normalizeJourneyText(value, maxLength, "", field);
}

function normalizeContextStringArray(value, maxItems = JOURNEY_LIST_LIMITS.contextItems, field = "context.items") {
  if (!Array.isArray(value)) return [];
  const result = [];
  const seen = new Set();

  for (const item of value) {
    const normalized = normalizeContextText(item, JOURNEY_TEXT_LIMITS.shortItem, `${field}[]`);
    const key = normalized.toLocaleLowerCase("et");
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length > maxItems) throw boundaryError("JOURNEY_LIST_TOO_LONG", field, maxItems);
  }

  return result;
}

function assignText(result, source, key, maxLength = JOURNEY_TEXT_LIMITS.contextText) {
  if (!Object.hasOwn(source, key)) return;
  const normalized = normalizeContextText(source[key], maxLength, key);
  if (normalized) result[key] = normalized;
}

function assignBoolean(result, source, key) {
  if (typeof source[key] === "boolean" || source[key] === null) result[key] = source[key];
}

function assignStringArray(result, source, key, maxItems = JOURNEY_LIST_LIMITS.contextItems) {
  if (!Object.hasOwn(source, key)) return;
  result[key] = normalizeContextStringArray(source[key], maxItems, key);
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
    if (result.length > JOURNEY_LIST_LIMITS.assistiveDevices) {
      throw boundaryError("JOURNEY_LIST_TOO_LONG", "assistiveDevices", JOURNEY_LIST_LIMITS.assistiveDevices);
    }
  }

  return result;
}

function normalizeHelpMediation(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = {};
  assignText(result, value, "categoryCode", 80);
  assignText(result, value, "timing", 300);
  assignText(result, value, "conditions", 500);
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
  // Client-provided activity is not authoritative. Owner-scoped DomainEvent
  // rows are the only activity source returned by the service.
  const helpMediation = normalizeHelpMediation(source.helpMediation);
  if (helpMediation) result.helpMediation = helpMediation;
  const serviceContinuity = normalizeServiceContinuity(source.serviceContinuity);
  if (serviceContinuity) result.serviceContinuity = serviceContinuity;
  const healthContact = normalizeHealthContact(source.healthContact);
  if (healthContact) result.healthContact = healthContact;

  return result;
}

export function normalizeJourneyCreateInput(input = {}, options = {}) {
  const summary = normalizeJourneyText(input.summary, JOURNEY_TEXT_LIMITS.summary, "", "summary");
  if (!summary) {
    throw publicError("journeys.errors.summary_required", 400);
  }

  const title = normalizeJourneyText(input.title, JOURNEY_TEXT_LIMITS.title, "", "title")
    || summary.slice(0, 72)
    || "Teekond";

  const primaryPath = Object.hasOwn(input, "primaryPath")
    ? normalizeClientEnum(input.primaryPath, JOURNEY_PRIMARY_PATHS, "primaryPath")
    : null;

  return {
    roleContext: normalizeEnum(
      options.roleContext,
      JOURNEY_ROLE_CONTEXTS,
      JOURNEY_DEFAULT_ROLE_CONTEXT
    ),
    status: normalizeCreateEnum(input, "status", JOURNEY_STATUSES, JOURNEY_DEFAULT_STATUS),
    sharingStatus: normalizeCreateEnum(
      input,
      "sharingStatus",
      JOURNEY_SHARING_STATUSES,
      JOURNEY_DEFAULT_SHARING_STATUS
    ),
    title,
    summary,
    primaryPath,
    domains: normalizeStringArray(input.domains, JOURNEY_LIST_LIMITS.domains, "domains"),
    missingInfo: normalizeStringArray(input.missingInfo, JOURNEY_LIST_LIMITS.missingInfo, "missingInfo"),
    riskSignals: normalizeStringArray(input.riskSignals, JOURNEY_LIST_LIMITS.riskSignals, "riskSignals"),
    suggestedActions: normalizeSuggestedActions(input.suggestedActions),
    context: normalizeContext(input.context),
    conversationId: normalizeJourneyText(input.conversationId, JOURNEY_TEXT_LIMITS.conversationId, "", "conversationId") || null
  };
}

export function normalizeJourneyUpdateInput(input = {}) {
  const data = {};

  if (Object.hasOwn(input, "title")) {
    const title = normalizeJourneyText(input.title, JOURNEY_TEXT_LIMITS.title, "", "title");
    if (!title) throw publicError("journeys.errors.title_required", 400);
    data.title = title;
  }

  if (Object.hasOwn(input, "summary")) {
    const summary = normalizeJourneyText(input.summary, JOURNEY_TEXT_LIMITS.summary, "", "summary");
    if (!summary) throw publicError("journeys.errors.summary_required", 400);
    data.summary = summary;
  }

  if (Object.hasOwn(input, "primaryPath")) {
    data.primaryPath = normalizeClientEnum(input.primaryPath, JOURNEY_PRIMARY_PATHS, "primaryPath");
  }

  if (Object.hasOwn(input, "status")) {
    data.status = normalizeClientEnum(input.status, JOURNEY_STATUSES, "status");
  }

  if (Object.hasOwn(input, "sharingStatus")) {
    data.sharingStatus = normalizeClientEnum(
      input.sharingStatus,
      JOURNEY_SHARING_STATUSES,
      "sharingStatus"
    );
  }

  if (Object.hasOwn(input, "domains")) data.domains = normalizeStringArray(input.domains, JOURNEY_LIST_LIMITS.domains, "domains");
  if (Object.hasOwn(input, "missingInfo")) data.missingInfo = normalizeStringArray(input.missingInfo, JOURNEY_LIST_LIMITS.missingInfo, "missingInfo");
  if (Object.hasOwn(input, "riskSignals")) data.riskSignals = normalizeStringArray(input.riskSignals, JOURNEY_LIST_LIMITS.riskSignals, "riskSignals");
  if (Object.hasOwn(input, "suggestedActions")) data.suggestedActions = normalizeSuggestedActions(input.suggestedActions);
  if (Object.hasOwn(input, "context")) data.context = normalizeContext(input.context);

  return data;
}

export function normalizeJourneyDraftInput(input = {}) {
  const situation = normalizeJourneyText(input.situation || input.summary, JOURNEY_TEXT_LIMITS.summary, "", "situation");
  if (!situation) {
    throw publicError("journeys.errors.situation_required", 400);
  }
  return { situation };
}
