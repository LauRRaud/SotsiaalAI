import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const REPORT_SCHEMA_VERSION = "rag-qm-p0-baseline-v1";
export const FIXTURE_SCHEMA_VERSION = "rag-qm-p0-fixture-v1";
export const WORKBOOK_SCHEMA_VERSION = "rag-qm-p0-workbook-v1";
export const MINIMUM_GROUP_SIZE = 20;
export const PRIVACY_NOTICE = "Ämbrijaotus põhineb sünteetilisel valimil; produktsiooni-jaotus kinnitamata (Lisa A.3).";
export const ALLOWED_EVENTS = Object.freeze([
  "rag_trace",
  "rag_search",
  "chat_no_external_sources",
  "crisis_detected"
]);

export const USED_FIELDS = Object.freeze([
  "ChatLog.event",
  "ChatLog.createdAt",
  "ChatLog.role",
  "ChatLog.userId (COUNT DISTINCT only)",
  "rag_trace.retrieved_count",
  "rag_trace.selected_context_count",
  "rag_trace.selected_source_count",
  "rag_trace.answer_source_count",
  "rag_trace.displayed_source_count",
  "rag_trace.filtered_out_source_count",
  "rag_trace.displayed_sources_subset_of_selected",
  "rag_trace.displayed_sources_subset_of_answer",
  "rag_trace.package_aware_answering_used",
  "rag_trace.query_plan.mode",
  "rag_trace.retrieval_trace_level",
  "rag_trace.rag_risk_level",
  "rag_trace.retrievers_used",
  "rag_trace.hybrid_retrieval.merge_strategy.strategy",
  "rag_trace.hybrid_retrieval.channel_counts",
  "rag_search.ragMatchCount",
  "rag_search.chosenGroupCount",
  "rag_search.retrieversUsed",
  "rag_search.ragRiskLevel",
  "rag_search.queryPlanMode",
  "chat_no_external_sources.messageLength",
  "chat_no_external_sources.ragRiskLevel"
]);

const REPORT_TOP_LEVEL_KEYS = Object.freeze([
  "schema_version",
  "generated_at",
  "interval",
  "source",
  "privacy_notice",
  "used_fields",
  "privacy",
  "metrics",
  "classification",
  "coverage_gaps",
  "integrity"
]);

const SAFE_TOKEN_RE = /^[A-Za-z0-9_.:-]{1,80}$/;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const ELEVEN_DIGIT_RE = /(?<!\d)\d{11}(?!\d)/;
const AGENT_ID_RE = /agent::/i;
const FORBIDDEN_DIRECT_KEYS = new Set([
  "identifier",
  "email",
  "name",
  "query",
  "question",
  "answer",
  "content",
  "text",
  "message",
  "note",
  "planner_reason",
  "topics"
]);

const TRACE_DATA_KEYS = new Set([
  "retrieved_count",
  "selected_context_count",
  "selected_source_count",
  "answer_source_count",
  "displayed_source_count",
  "filtered_out_source_count",
  "displayed_sources_subset_of_selected",
  "displayed_sources_subset_of_answer",
  "package_aware_answering_used",
  "query_plan",
  "retrieval_trace_level",
  "rag_risk_level",
  "retrievers_used",
  "hybrid_retrieval"
]);
const SEARCH_DATA_KEYS = new Set([
  "ragMatchCount",
  "chosenGroupCount",
  "retrieversUsed",
  "ragRiskLevel",
  "queryPlanMode"
]);
const NO_SOURCE_DATA_KEYS = new Set(["messageLength", "ragRiskLevel"]);

export class BaselineError extends Error {
  constructor(code, message, exitCode) {
    super(message);
    this.name = "BaselineError";
    this.code = code;
    this.exitCode = exitCode;
  }
}

function fail(code, message, exitCode = 3) {
  throw new BaselineError(code, message, exitCode);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeDefensiveKey(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .replace(/_+/g, "_")
    .toLowerCase();
}

function isForbiddenKey(key) {
  const normalized = normalizeDefensiveKey(key);
  return FORBIDDEN_DIRECT_KEYS.has(normalized) ||
    /^(?:query|question|answer|content|text|message)_(?:text|body|value)$/.test(normalized) ||
    /^(?:planner_reason|topics)$/.test(normalized) ||
    /(?:^|_)(?:user|conversation|conv|message|author)_?ids?$/.test(normalized) ||
    /(?:^|_)identifier(?:s)?$/.test(normalized) ||
    /(?:^|_)source_?ids?$/.test(normalized);
}

function assertExactKeys(value, allowed, code) {
  if (!isPlainObject(value)) fail(code, "Invalid sanitized fixture structure");
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(code, "Sanitized fixture contains a forbidden field");
  }
}

function parseIsoInstant(value, code = "invalid_timestamp") {
  if (typeof value !== "string" || !/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    fail(code, "Timestamp must be an ISO-8601 instant with a timezone", 2);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) fail(code, "Timestamp must be a valid ISO-8601 instant", 2);
  return date;
}

export function parseInterval(fromValue, toValue) {
  if (!fromValue || !toValue) fail("missing_interval", "Both --from and --to are required", 2);
  const from = parseIsoInstant(fromValue, "invalid_from");
  const to = parseIsoInstant(toValue, "invalid_to");
  if (from.getTime() >= to.getTime()) fail("invalid_interval", "--from must be earlier than --to", 2);
  return { from, to };
}

function optionalNonNegativeInteger(value, code) {
  if (value == null) return null;
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(number) || number < 0) fail(code, "Counter must be a non-negative integer");
  return number;
}

function optionalBoolean(value, code) {
  if (value == null) return null;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  fail(code, "Boolean telemetry field is invalid");
}

function optionalSafeToken(value, code) {
  if (value == null || value === "") return null;
  const token = String(value);
  if (!SAFE_TOKEN_RE.test(token)) fail(code, "Structured telemetry token is invalid");
  return token;
}

function safeTokenArray(value, code) {
  if (value == null) return [];
  if (!Array.isArray(value)) fail(code, "Structured telemetry list is invalid");
  return [...new Set(value.map(item => optionalSafeToken(item, code)).filter(Boolean))];
}

function safeCountObject(value, code) {
  if (value == null) return {};
  if (!isPlainObject(value)) fail(code, "Structured telemetry count object is invalid");
  const out = {};
  for (const [key, count] of Object.entries(value)) {
    const token = optionalSafeToken(key, code);
    out[token] = optionalNonNegativeInteger(count, code);
  }
  return out;
}

function scanInputForSensitiveValues(value, keyPath = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanInputForSensitiveValues(item, [...keyPath, String(index)]));
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, entry] of Object.entries(value)) {
      if (isForbiddenKey(key)) {
        fail("fixture_forbidden_field", "Sanitized fixture contains a forbidden field");
      }
      scanInputForSensitiveValues(entry, [...keyPath, key]);
    }
    return;
  }
  if (typeof value !== "string") return;
  if (EMAIL_RE.test(value)) fail("fixture_email_value", "Sanitized fixture contains a forbidden value");
  if (ELEVEN_DIGIT_RE.test(value)) fail("fixture_personal_code_value", "Sanitized fixture contains a forbidden value");
  if (AGENT_ID_RE.test(value)) fail("fixture_agent_id_value", "Sanitized fixture contains a forbidden value");
}

function normalizeTraceData(data) {
  assertExactKeys(data, TRACE_DATA_KEYS, "fixture_trace_field");
  const queryPlan = data.query_plan == null ? {} : data.query_plan;
  assertExactKeys(queryPlan, new Set(["mode"]), "fixture_query_plan_field");
  const hybrid = data.hybrid_retrieval == null ? {} : data.hybrid_retrieval;
  assertExactKeys(hybrid, new Set(["merge_strategy", "channel_counts"]), "fixture_hybrid_field");
  const mergeStrategy = hybrid.merge_strategy == null ? {} : hybrid.merge_strategy;
  assertExactKeys(mergeStrategy, new Set(["strategy"]), "fixture_hybrid_strategy_field");
  return {
    retrieved_count: optionalNonNegativeInteger(data.retrieved_count, "fixture_counter"),
    selected_context_count: optionalNonNegativeInteger(data.selected_context_count, "fixture_counter"),
    selected_source_count: optionalNonNegativeInteger(data.selected_source_count, "fixture_counter"),
    answer_source_count: optionalNonNegativeInteger(data.answer_source_count, "fixture_counter"),
    displayed_source_count: optionalNonNegativeInteger(data.displayed_source_count, "fixture_counter"),
    filtered_out_source_count: optionalNonNegativeInteger(data.filtered_out_source_count, "fixture_counter"),
    displayed_sources_subset_of_selected: optionalBoolean(data.displayed_sources_subset_of_selected, "fixture_boolean"),
    displayed_sources_subset_of_answer: optionalBoolean(data.displayed_sources_subset_of_answer, "fixture_boolean"),
    package_aware_answering_used: optionalBoolean(data.package_aware_answering_used, "fixture_boolean"),
    query_plan: { mode: optionalSafeToken(queryPlan.mode, "fixture_planner_mode") },
    retrieval_trace_level: optionalSafeToken(data.retrieval_trace_level, "fixture_trace_level"),
    rag_risk_level: optionalSafeToken(data.rag_risk_level, "fixture_risk_level"),
    retrievers_used: safeTokenArray(data.retrievers_used, "fixture_retriever"),
    hybrid_retrieval: {
      merge_strategy: { strategy: optionalSafeToken(mergeStrategy.strategy, "fixture_hybrid_strategy") },
      channel_counts: safeCountObject(hybrid.channel_counts, "fixture_hybrid_channel")
    }
  };
}

function normalizeSearchData(data) {
  assertExactKeys(data, SEARCH_DATA_KEYS, "fixture_search_field");
  return {
    ragMatchCount: optionalNonNegativeInteger(data.ragMatchCount, "fixture_counter"),
    chosenGroupCount: optionalNonNegativeInteger(data.chosenGroupCount, "fixture_counter"),
    retrieversUsed: safeTokenArray(data.retrieversUsed, "fixture_retriever"),
    ragRiskLevel: optionalSafeToken(data.ragRiskLevel, "fixture_risk_level"),
    queryPlanMode: optionalSafeToken(data.queryPlanMode, "fixture_planner_mode")
  };
}

function normalizeNoSourceData(data) {
  assertExactKeys(data, NO_SOURCE_DATA_KEYS, "fixture_no_source_field");
  return {
    messageLength: optionalNonNegativeInteger(data.messageLength, "fixture_counter"),
    ragRiskLevel: optionalSafeToken(data.ragRiskLevel, "fixture_risk_level")
  };
}

function normalizeEventData(event, data) {
  if (!isPlainObject(data)) fail("fixture_event_data", "Sanitized fixture event data is invalid");
  if (event === "rag_trace") return normalizeTraceData(data);
  if (event === "rag_search") return normalizeSearchData(data);
  if (event === "chat_no_external_sources") return normalizeNoSourceData(data);
  assertExactKeys(data, new Set(), "fixture_crisis_field");
  return {};
}

function normalizeFixtureGroup(group) {
  assertExactKeys(group, new Set(["repeat", "event", "created_at", "role", "data"]), "fixture_group_field");
  if (!Number.isInteger(group.repeat) || group.repeat < 1 || group.repeat > 10000) {
    fail("fixture_repeat", "Sanitized fixture repeat must be between 1 and 10000");
  }
  if (!ALLOWED_EVENTS.includes(group.event)) fail("fixture_event", "Sanitized fixture contains a forbidden event");
  const createdAt = parseIsoInstant(group.created_at, "fixture_created_at").toISOString();
  const role = optionalSafeToken(group.role, "fixture_role");
  if (!role) fail("fixture_role", "Sanitized fixture role is required");
  const data = normalizeEventData(group.event, group.data);
  return { repeat: group.repeat, event: group.event, created_at: createdAt, role, data };
}

export function validateFixturePayload(payload, expectedInterval) {
  scanInputForSensitiveValues(payload);
  assertExactKeys(
    payload,
    new Set(["fixture_schema_version", "synthetic", "interval", "unique_user_count", "groups"]),
    "fixture_top_level"
  );
  if (payload.fixture_schema_version !== FIXTURE_SCHEMA_VERSION || payload.synthetic !== true) {
    fail("fixture_contract", "Fixture must declare the sanitized synthetic contract");
  }
  assertExactKeys(payload.interval, new Set(["from", "to"]), "fixture_interval_field");
  const fixtureInterval = parseInterval(payload.interval.from, payload.interval.to);
  if (
    fixtureInterval.from.getTime() !== expectedInterval.from.getTime() ||
    fixtureInterval.to.getTime() !== expectedInterval.to.getTime()
  ) {
    fail("fixture_interval_mismatch", "Fixture interval must match --from and --to");
  }
  const uniqueUserCount = optionalNonNegativeInteger(payload.unique_user_count, "fixture_unique_user_count");
  if (!Array.isArray(payload.groups) || payload.groups.length === 0) {
    fail("fixture_groups", "Sanitized fixture must contain event groups");
  }
  const groups = payload.groups.map(normalizeFixtureGroup);
  const rows = [];
  for (const group of groups) {
    const timestamp = new Date(group.created_at).getTime();
    if (timestamp < expectedInterval.from.getTime() || timestamp >= expectedInterval.to.getTime()) {
      fail("fixture_row_outside_interval", "Fixture event is outside the requested interval");
    }
    for (let index = 0; index < group.repeat; index += 1) {
      rows.push({ event: group.event, created_at: group.created_at, role: group.role, data: structuredClone(group.data) });
    }
  }
  return { rows, uniqueUserCount };
}

export async function loadSanitizedFixture(filePath, expectedInterval, fsImpl = fs) {
  let payload;
  try {
    payload = JSON.parse(await fsImpl.readFile(filePath, "utf8"));
  } catch {
    fail("fixture_read_failed", "Sanitized fixture could not be read");
  }
  return validateFixturePayload(payload, expectedInterval);
}

function objectWithoutNulls(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== null && typeof entry !== "undefined"));
}

function normalizeJsonValue(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeLiveRow(row) {
  const event = String(row.event || "");
  if (!ALLOWED_EVENTS.includes(event)) fail("database_event_contract", "Database returned an event outside the allowlist", 4);
  const createdAt = new Date(row.createdAt);
  if (Number.isNaN(createdAt.getTime())) fail("database_timestamp_contract", "Database returned an invalid timestamp", 4);
  const role = optionalSafeToken(row.role, "database_role_contract") || "UNSPECIFIED";
  if (event === "rag_trace") {
    return {
      event,
      created_at: createdAt.toISOString(),
      role,
      data: normalizeTraceData(objectWithoutNulls({
        retrieved_count: row.retrievedCount,
        selected_context_count: row.selectedContextCount,
        selected_source_count: row.selectedSourceCount,
        answer_source_count: row.answerSourceCount,
        displayed_source_count: row.displayedSourceCount,
        filtered_out_source_count: row.filteredOutSourceCount,
        displayed_sources_subset_of_selected: row.subsetSelected,
        displayed_sources_subset_of_answer: row.subsetAnswer,
        package_aware_answering_used: row.packageAware,
        query_plan: objectWithoutNulls({ mode: row.plannerMode }),
        retrieval_trace_level: row.retrievalTraceLevel,
        rag_risk_level: row.ragRiskLevel,
        retrievers_used: normalizeJsonValue(row.retrieversUsed),
        hybrid_retrieval: {
          merge_strategy: objectWithoutNulls({ strategy: row.hybridStrategy }),
          channel_counts: normalizeJsonValue(row.hybridChannelCounts)
        }
      }))
    };
  }
  if (event === "rag_search") {
    return {
      event,
      created_at: createdAt.toISOString(),
      role,
      data: normalizeSearchData(objectWithoutNulls({
        ragMatchCount: row.ragMatchCount,
        chosenGroupCount: row.chosenGroupCount,
        retrieversUsed: normalizeJsonValue(row.searchRetrieversUsed),
        ragRiskLevel: row.searchRiskLevel,
        queryPlanMode: row.searchPlannerMode
      }))
    };
  }
  if (event === "chat_no_external_sources") {
    return {
      event,
      created_at: createdAt.toISOString(),
      role,
      data: normalizeNoSourceData(objectWithoutNulls({
        messageLength: row.messageLength,
        ragRiskLevel: row.noSourceRiskLevel
      }))
    };
  }
  return { event, created_at: createdAt.toISOString(), role, data: {} };
}

export async function loadLiveTelemetry(prisma, interval) {
  if (!prisma || typeof prisma.$queryRaw !== "function") {
    fail("database_unavailable", "Read-only database client is unavailable", 4);
  }
  try {
    const rows = await prisma.$queryRaw`
      SELECT
        "event",
        "createdAt",
        "role",
        "data" ->> 'retrieved_count' AS "retrievedCount",
        "data" ->> 'selected_context_count' AS "selectedContextCount",
        "data" ->> 'selected_source_count' AS "selectedSourceCount",
        "data" ->> 'answer_source_count' AS "answerSourceCount",
        "data" ->> 'displayed_source_count' AS "displayedSourceCount",
        "data" ->> 'filtered_out_source_count' AS "filteredOutSourceCount",
        "data" ->> 'displayed_sources_subset_of_selected' AS "subsetSelected",
        "data" ->> 'displayed_sources_subset_of_answer' AS "subsetAnswer",
        "data" ->> 'package_aware_answering_used' AS "packageAware",
        "data" #>> '{query_plan,mode}' AS "plannerMode",
        "data" ->> 'retrieval_trace_level' AS "retrievalTraceLevel",
        "data" ->> 'rag_risk_level' AS "ragRiskLevel",
        "data" -> 'retrievers_used' AS "retrieversUsed",
        "data" #>> '{hybrid_retrieval,merge_strategy,strategy}' AS "hybridStrategy",
        "data" #> '{hybrid_retrieval,channel_counts}' AS "hybridChannelCounts",
        "data" ->> 'ragMatchCount' AS "ragMatchCount",
        "data" ->> 'chosenGroupCount' AS "chosenGroupCount",
        "data" -> 'retrieversUsed' AS "searchRetrieversUsed",
        "data" ->> 'ragRiskLevel' AS "searchRiskLevel",
        "data" ->> 'queryPlanMode' AS "searchPlannerMode",
        "data" ->> 'messageLength' AS "messageLength",
        "data" ->> 'ragRiskLevel' AS "noSourceRiskLevel"
      FROM "ChatLog"
      WHERE "createdAt" >= ${interval.from}
        AND "createdAt" < ${interval.to}
        AND "event" IN ('rag_trace', 'rag_search', 'chat_no_external_sources', 'crisis_detected')
      ORDER BY "createdAt" ASC
    `;
    const cardinalityRows = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT "userId")::integer AS "uniqueUserCount"
      FROM "ChatLog"
      WHERE "createdAt" >= ${interval.from}
        AND "createdAt" < ${interval.to}
        AND "event" IN ('rag_trace', 'rag_search', 'chat_no_external_sources', 'crisis_detected')
    `;
    const uniqueUserCount = optionalNonNegativeInteger(cardinalityRows?.[0]?.uniqueUserCount ?? 0, "database_cardinality_contract");
    return { rows: rows.map(normalizeLiveRow), uniqueUserCount };
  } catch (error) {
    if (error instanceof BaselineError) throw error;
    fail("database_read_failed", "Read-only telemetry query failed", 4);
  }
}

function publicCount(count) {
  if (!Number.isInteger(count) || count < 0) fail("internal_count_contract", "Internal aggregate count is invalid");
  if (count >= MINIMUM_GROUP_SIZE) {
    return { status: "reported", count, minimum_group_size: MINIMUM_GROUP_SIZE };
  }
  return { status: count === 0 ? "unavailable" : "suppressed", count: null, minimum_group_size: MINIMUM_GROUP_SIZE };
}

function publicRate(metric, numeratorCount, denominatorCount) {
  const numerator = publicCount(numeratorCount);
  const denominator = publicCount(denominatorCount);
  const reportable = numerator.status === "reported" && denominator.status === "reported" && denominatorCount > 0;
  const status = denominatorCount === 0 ? "unavailable" : reportable ? "reported" : "suppressed";
  return {
    metric,
    status,
    numerator,
    denominator,
    rate: reportable ? Number((numeratorCount / denominatorCount).toFixed(6)) : null
  };
}

function publicNumericSummary(metric, values) {
  const numericValues = values.filter(value => Number.isInteger(value) && value >= 0);
  const records = publicCount(numericValues.length);
  if (numericValues.length < MINIMUM_GROUP_SIZE) {
    return {
      metric,
      status: numericValues.length === 0 ? "unavailable" : "suppressed",
      records,
      total: null,
      average: null
    };
  }
  const total = numericValues.reduce((sum, value) => sum + value, 0);
  return {
    metric,
    status: "reported",
    records,
    total,
    average: Number((total / numericValues.length).toFixed(6))
  };
}

function countBy(values) {
  const counts = new Map();
  for (const value of values) {
    if (!value) continue;
    if (!SAFE_TOKEN_RE.test(value)) fail("dimension_token_contract", "Aggregate dimension token is invalid");
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([value, count]) => ({ value, measurement: publicCount(count) }));
}

function dimension(dimensionName, values) {
  return { dimension: dimensionName, groups: countBy(values) };
}

function addCountMetric(target, metric, count) {
  target.push({ metric, measurement: publicCount(count) });
}

function canonicalHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function buildBaselineReport({ rows, uniqueUserCount, interval, generatedAt, sourceKind }) {
  if (!Array.isArray(rows)) fail("rows_contract", "Telemetry rows must be an array");
  if (!new Set(["sanitized_fixture", "chatlog_read_only"]).has(sourceKind)) {
    fail("source_contract", "Baseline source kind is invalid");
  }
  const normalizedRows = rows.map(row => {
    if (!ALLOWED_EVENTS.includes(row.event)) fail("row_event_contract", "Telemetry row event is outside the allowlist");
    return row;
  });
  const traces = normalizedRows.filter(row => row.event === "rag_trace");
  const searches = normalizedRows.filter(row => row.event === "rag_search");
  const noSources = normalizedRows.filter(row => row.event === "chat_no_external_sources");
  const crises = normalizedRows.filter(row => row.event === "crisis_detected");

  const hybridTraceRows = traces.filter(row => {
    const hybrid = row.data.hybrid_retrieval;
    return Boolean(hybrid?.merge_strategy?.strategy) || Object.values(hybrid?.channel_counts || {}).some(count => count > 0);
  });
  const counts = [];
  addCountMetric(counts, "event_records", normalizedRows.length);
  addCountMetric(counts, "unique_users", uniqueUserCount);
  addCountMetric(counts, "rag_trace_records", traces.length);
  addCountMetric(counts, "rag_search_records", searches.length);
  addCountMetric(counts, "no_external_source_events", noSources.length);
  addCountMetric(counts, "crisis_detected_events", crises.length);
  addCountMetric(counts, "hybrid_trace_records", hybridTraceRows.length);

  const zeroResultSearches = searches.filter(row => row.data.ragMatchCount === 0).length;
  const subsetSelectedViolations = traces.filter(row => row.data.displayed_sources_subset_of_selected === false).length;
  const subsetAnswerViolations = traces.filter(row => row.data.displayed_sources_subset_of_answer === false).length;
  const selectedWithoutDisplay = traces.filter(row => row.data.selected_source_count > 0 && row.data.displayed_source_count === 0).length;
  const packageAware = traces.filter(row => row.data.package_aware_answering_used === true).length;
  const requestLikeDenominator = searches.length + noSources.length;
  const rates = [
    publicRate("zero_result_search_rate", zeroResultSearches, searches.length),
    publicRate("no_external_source_rate", noSources.length, requestLikeDenominator),
    publicRate("subset_selected_violation_rate", subsetSelectedViolations, traces.length),
    publicRate("subset_answer_violation_rate", subsetAnswerViolations, traces.length),
    publicRate("selected_without_display_rate", selectedWithoutDisplay, traces.length),
    publicRate("package_aware_use_rate", packageAware, traces.length),
    publicRate("crisis_detected_rate", crises.length, requestLikeDenominator)
  ];

  const numericSummaries = [
    publicNumericSummary("retrieved_count", traces.map(row => row.data.retrieved_count)),
    publicNumericSummary("selected_context_count", traces.map(row => row.data.selected_context_count)),
    publicNumericSummary("selected_source_count", traces.map(row => row.data.selected_source_count)),
    publicNumericSummary("answer_source_count", traces.map(row => row.data.answer_source_count)),
    publicNumericSummary("displayed_source_count", traces.map(row => row.data.displayed_source_count)),
    publicNumericSummary("filtered_out_source_count", traces.map(row => row.data.filtered_out_source_count)),
    publicNumericSummary("rag_match_count", searches.map(row => row.data.ragMatchCount)),
    publicNumericSummary("chosen_group_count", searches.map(row => row.data.chosenGroupCount)),
    publicNumericSummary("message_length", noSources.map(row => row.data.messageLength))
  ];

  const hybridChannels = hybridTraceRows.flatMap(row => Object.entries(row.data.hybrid_retrieval?.channel_counts || {})
    .filter(([, count]) => count > 0)
    .map(([channel]) => channel));

  const distributions = [
    dimension("events", normalizedRows.map(row => row.event)),
    dimension("event_roles", normalizedRows.map(row => row.role)),
    dimension("trace_planner_modes", traces.map(row => row.data.query_plan?.mode)),
    dimension("search_planner_modes", searches.map(row => row.data.queryPlanMode)),
    dimension("trace_risk_levels", traces.map(row => row.data.rag_risk_level)),
    dimension("search_risk_levels", searches.map(row => row.data.ragRiskLevel)),
    dimension("no_source_risk_levels", noSources.map(row => row.data.ragRiskLevel)),
    dimension("trace_retrievers", traces.flatMap(row => row.data.retrievers_used || [])),
    dimension("search_retrievers", searches.flatMap(row => row.data.retrieversUsed || [])),
    dimension("retrieval_trace_levels", traces.map(row => row.data.retrieval_trace_level)),
    dimension("hybrid_strategies", hybridTraceRows.map(row => row.data.hybrid_retrieval?.merge_strategy?.strategy)),
    dimension("hybrid_channels", hybridChannels),
    dimension("days", normalizedRows.map(row => row.created_at.slice(0, 10)))
  ];

  const reportCore = {
    schema_version: REPORT_SCHEMA_VERSION,
    generated_at: generatedAt.toISOString(),
    interval: {
      from: interval.from.toISOString(),
      to: interval.to.toISOString(),
      semantics: "from_inclusive_to_exclusive"
    },
    source: sourceKind,
    privacy_notice: PRIVACY_NOTICE,
    used_fields: [...USED_FIELDS],
    privacy: {
      minimum_group_size: MINIMUM_GROUP_SIZE,
      output_validated: true,
      temp_files_created: 0,
      raw_conversations_read: 0,
      database_writes: 0,
      external_services_used: 0
    },
    metrics: {
      counts,
      rates,
      numeric_summaries: numericSummaries,
      distributions
    },
    classification: {
      status: "not_run",
      golden_37: "not_run",
      catalog_35: "not_run",
      allowed_reference_count: 72,
      bucket_distribution: null
    },
    coverage_gaps: [
      { metric: "coverage_retrieval_split", status: "unmeasurable" },
      { metric: "lifecycle_gap_rate", status: "unmeasurable" },
      { metric: "answer_outcome", status: "unmeasurable" },
      { metric: "retrieval_latency", status: "unmeasurable" },
      { metric: "production_bucket_split", status: "unconfirmed" },
      { metric: "golden_live_run", status: "not_run" }
    ]
  };
  const report = { ...reportCore, integrity: { data_sha256: canonicalHash(reportCore) } };
  validateReportOutput(report);
  return report;
}

function assertMeasurementShape(measurement) {
  if (!isPlainObject(measurement)) fail("report_schema", "Report measurement is invalid");
  const keys = Object.keys(measurement).sort().join(",");
  if (keys !== "count,minimum_group_size,status") fail("report_schema", "Report measurement keys are invalid");
  if (!new Set(["reported", "suppressed", "unavailable"]).has(measurement.status)) fail("report_schema", "Report measurement status is invalid");
  if (measurement.minimum_group_size !== MINIMUM_GROUP_SIZE) fail("report_schema", "Report minimum group size is invalid");
  if (measurement.status === "reported" && (!Number.isInteger(measurement.count) || measurement.count < MINIMUM_GROUP_SIZE)) {
    fail("report_schema", "Reported group is below the privacy minimum");
  }
  if (measurement.status !== "reported" && measurement.count !== null) fail("report_schema", "Suppressed count must be null");
}

function assertGroupShape(group, message = "Report distribution group is invalid") {
  assertReportObjectKeys(group, new Set(["value", "measurement"]), message);
  assertMetricToken(group.value, "Report distribution value is invalid");
  assertMeasurementShape(group.measurement);
}

function assertReportObjectKeys(value, keys, message) {
  if (!isPlainObject(value)) fail("report_schema", message);
  if (Object.keys(value).sort().join(",") !== [...keys].sort().join(",")) fail("report_schema", message);
}

function assertMetricToken(value, message) {
  if (typeof value !== "string" || !SAFE_TOKEN_RE.test(value)) fail("report_schema", message);
}

export function validateReportShape(report) {
  if (!isPlainObject(report)) fail("report_schema", "Report must be an object");
  const keys = Object.keys(report).sort();
  const expected = [...REPORT_TOP_LEVEL_KEYS].sort();
  if (keys.join(",") !== expected.join(",")) fail("report_schema", "Report top-level keys are invalid");
  if (report.schema_version !== REPORT_SCHEMA_VERSION) fail("report_schema", "Report schema version is invalid");
  if (report.privacy_notice !== PRIVACY_NOTICE) fail("report_schema", "Report privacy notice is invalid");
  if (Number.isNaN(new Date(report.generated_at).getTime())) fail("report_schema", "Report generated timestamp is invalid");
  assertReportObjectKeys(report.interval, new Set(["from", "to", "semantics"]), "Report interval is invalid");
  const interval = parseInterval(report.interval.from, report.interval.to);
  if (interval.from.toISOString() !== report.interval.from || interval.to.toISOString() !== report.interval.to) {
    fail("report_schema", "Report interval timestamps must be canonical");
  }
  if (report.interval.semantics !== "from_inclusive_to_exclusive") fail("report_schema", "Report interval semantics are invalid");
  if (!new Set(["sanitized_fixture", "chatlog_read_only"]).has(report.source)) fail("report_schema", "Report source is invalid");
  if (!Array.isArray(report.used_fields) || report.used_fields.join("|") !== USED_FIELDS.join("|")) {
    fail("report_schema", "Report used-field contract is invalid");
  }
  assertReportObjectKeys(
    report.privacy,
    new Set(["minimum_group_size", "output_validated", "temp_files_created", "raw_conversations_read", "database_writes", "external_services_used"]),
    "Report privacy metadata is invalid"
  );
  if (
    report.privacy.minimum_group_size !== MINIMUM_GROUP_SIZE ||
    report.privacy.output_validated !== true ||
    report.privacy.temp_files_created !== 0 ||
    report.privacy.raw_conversations_read !== 0 ||
    report.privacy.database_writes !== 0 ||
    report.privacy.external_services_used !== 0
  ) fail("report_schema", "Report privacy metadata is invalid");
  assertReportObjectKeys(report.metrics, new Set(["counts", "rates", "numeric_summaries", "distributions"]), "Report metrics are invalid");
  if (![report.metrics.counts, report.metrics.rates, report.metrics.numeric_summaries, report.metrics.distributions].every(Array.isArray)) {
    fail("report_schema", "Report metric collections are invalid");
  }
  for (const item of report.metrics.counts) {
    assertReportObjectKeys(item, new Set(["metric", "measurement"]), "Report count metric is invalid");
    assertMetricToken(item.metric, "Report count metric token is invalid");
    assertMeasurementShape(item.measurement);
  }
  for (const item of report.metrics.rates) {
    assertReportObjectKeys(item, new Set(["metric", "status", "numerator", "denominator", "rate"]), "Report rate metric is invalid");
    assertMetricToken(item.metric, "Report rate metric token is invalid");
    assertMeasurementShape(item.numerator);
    assertMeasurementShape(item.denominator);
    if (!new Set(["reported", "suppressed", "unavailable"]).has(item.status)) fail("report_schema", "Report rate status is invalid");
    if (item.status !== "reported" && item.rate !== null) fail("report_schema", "Suppressed rate must be null");
    if (item.status === "reported" && (typeof item.rate !== "number" || item.rate < 0 || item.rate > 1)) {
      fail("report_schema", "Reported rate is invalid");
    }
  }
  for (const item of report.metrics.numeric_summaries) {
    assertReportObjectKeys(item, new Set(["metric", "status", "records", "total", "average"]), "Report numeric summary is invalid");
    assertMetricToken(item.metric, "Report numeric metric token is invalid");
    assertMeasurementShape(item.records);
    if (!new Set(["reported", "suppressed", "unavailable"]).has(item.status)) fail("report_schema", "Report numeric status is invalid");
    if (item.status !== "reported" && (item.total !== null || item.average !== null)) {
      fail("report_schema", "Suppressed numeric summary must be null");
    }
    if (item.status === "reported" && (!Number.isInteger(item.total) || item.total < 0 || typeof item.average !== "number" || item.average < 0)) {
      fail("report_schema", "Reported numeric summary is invalid");
    }
  }
  for (const item of report.metrics.distributions) {
    assertReportObjectKeys(item, new Set(["dimension", "groups"]), "Report distribution is invalid");
    assertMetricToken(item.dimension, "Report dimension token is invalid");
    if (!Array.isArray(item.groups)) fail("report_schema", "Report distribution groups are invalid");
    for (const group of item.groups) {
      assertGroupShape(group);
    }
  }
  assertReportObjectKeys(
    report.classification,
    new Set(["status", "golden_37", "catalog_35", "allowed_reference_count", "bucket_distribution"]),
    "Report classification metadata is invalid"
  );
  if (
    !new Set(["not_run", "complete"]).has(report.classification.status) ||
    !new Set(["not_run", "complete"]).has(report.classification.golden_37) ||
    !new Set(["not_run", "complete"]).has(report.classification.catalog_35) ||
    report.classification.allowed_reference_count !== 72 ||
    (report.classification.bucket_distribution !== null && !Array.isArray(report.classification.bucket_distribution))
  ) fail("report_schema", "Report classification metadata is invalid");
  for (const group of report.classification.bucket_distribution || []) {
    assertGroupShape(group, "Report classification bucket distribution is invalid");
  }
  if (!Array.isArray(report.coverage_gaps)) fail("report_schema", "Report coverage gaps are invalid");
  for (const gap of report.coverage_gaps) {
    assertReportObjectKeys(gap, new Set(["metric", "status"]), "Report coverage gap is invalid");
    assertMetricToken(gap.metric, "Report coverage metric is invalid");
    if (!new Set(["unmeasurable", "unconfirmed", "not_run"]).has(gap.status)) fail("report_schema", "Report coverage status is invalid");
  }
  const { integrity, ...reportCore } = report;
  assertReportObjectKeys(integrity, new Set(["data_sha256"]), "Report integrity metadata is invalid");
  if (!/^[a-f0-9]{64}$/.test(integrity?.data_sha256 || "")) fail("report_schema", "Report integrity hash is invalid");
  if (canonicalHash(reportCore) !== integrity.data_sha256) fail("report_schema", "Report integrity hash does not match data");
  return true;
}

function isValidatedIntegrityHashPath(keyPath, validatedReport) {
  return validatedReport === true && keyPath.length === 2 && keyPath[0] === "integrity" && keyPath[1] === "data_sha256";
}

function isLongStringAllowed(keyPath, value, validatedReport) {
  const key = keyPath.at(-1) || "";
  if (key === "privacy_notice" || isValidatedIntegrityHashPath(keyPath, validatedReport)) return true;
  if (keyPath.includes("used_fields")) return true;
  if (new Set(["metric", "dimension", "value"]).has(key)) return SAFE_TOKEN_RE.test(value);
  return false;
}

function scanReportValue(value, keyPath = [], { validatedReport = false } = {}) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanReportValue(item, [...keyPath, String(index)], { validatedReport }));
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, entry] of Object.entries(value)) {
      if (isForbiddenKey(key)) {
        fail("privacy_forbidden_key", "Report privacy validation failed");
      }
      scanReportValue(entry, [...keyPath, key], { validatedReport });
    }
    return;
  }
  if (typeof value !== "string") return;
  if (EMAIL_RE.test(value)) fail("privacy_email_value", "Report privacy validation failed");
  if (!isValidatedIntegrityHashPath(keyPath, validatedReport) && ELEVEN_DIGIT_RE.test(value)) {
    fail("privacy_personal_code_value", "Report privacy validation failed");
  }
  if (AGENT_ID_RE.test(value)) fail("privacy_agent_id_value", "Report privacy validation failed");
  if (value.length > 30 && !isLongStringAllowed(keyPath, value, validatedReport)) {
    fail("privacy_long_text_value", "Report privacy validation failed");
  }
}

export function validateReportOutput(report) {
  validateReportShape(report);
  scanReportValue(report, [], { validatedReport: true });
  return true;
}

export function validatePrivacySafeOutputValue(value) {
  scanReportValue(value);
  return true;
}

export function validateClassificationWorkbook(workbook) {
  assertExactKeys(
    workbook,
    new Set(["schema_version", "status", "privacy_notice", "allowed_sources", "row_count", "rows"]),
    "workbook_top_level"
  );
  if (workbook.schema_version !== WORKBOOK_SCHEMA_VERSION || workbook.status !== "not_run") {
    fail("workbook_contract", "Classification workbook contract is invalid");
  }
  if (workbook.privacy_notice !== PRIVACY_NOTICE) fail("workbook_privacy_notice", "Classification workbook privacy notice is invalid");
  if (JSON.stringify(workbook.allowed_sources) !== JSON.stringify(["golden_37", "catalog_35", "pilot_explicit"])) {
    fail("workbook_sources", "Classification workbook source allowlist is invalid");
  }
  if (!Array.isArray(workbook.rows) || workbook.row_count !== workbook.rows.length) {
    fail("workbook_rows", "Classification workbook row count is invalid");
  }
  const sampleIds = new Set();
  const rowKeys = new Set([
    "sample_id",
    "query_kind",
    "role",
    "language",
    "planner_mode",
    "selected_count",
    "displayed_count",
    "answer_outcome",
    "bucket",
    "confidence",
    "evidence_ref",
    "note"
  ]);
  const buckets = new Set([
    "COVERAGE_GAP",
    "RETRIEVAL_GAP",
    "LIFECYCLE_GAP",
    "ATTRIBUTION_GAP",
    "INSUFFICIENT_EVIDENCE_CORRECT",
    "QUERY_UNDERSTANDING_GAP",
    "AUDIENCE_OR_SCOPE_BLOCK",
    "GENERATION_GAP",
    "UNKNOWN"
  ]);
  const outcomes = new Set(["answered", "refused_no_evidence", "degraded_partial", "crisis_redirect"]);
  for (const row of workbook.rows) {
    assertExactKeys(row, rowKeys, "workbook_row_field");
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(row.sample_id)) {
      fail("workbook_sample_id", "Workbook sample ID must be a random UUID");
    }
    if (sampleIds.has(row.sample_id)) fail("workbook_sample_id_duplicate", "Workbook sample IDs must be unique");
    sampleIds.add(row.sample_id);
    if (!/^(?:golden:[a-z0-9_]+|catalog:(?:[1-9]|[12][0-9]|3[0-5])|pilot:[A-Za-z0-9_.-]+)$/.test(row.query_kind)) {
      fail("workbook_query_kind", "Workbook query reference is invalid");
    }
    if (/user|conv|message/i.test(row.sample_id)) fail("workbook_sample_id_source", "Workbook sample ID is identifier-derived");
    if (!new Set(["SOCIAL_WORKER", "CLIENT"]).has(row.role)) fail("workbook_role", "Workbook role is invalid");
    if (!new Set(["et", "ru", "en"]).has(row.language)) fail("workbook_language", "Workbook language is invalid");
    if (row.planner_mode !== "not_run" && !SAFE_TOKEN_RE.test(row.planner_mode || "")) fail("workbook_planner_mode", "Workbook planner mode is invalid");
    for (const count of [row.selected_count, row.displayed_count]) {
      if (count !== null && (!Number.isInteger(count) || count < 0)) fail("workbook_count", "Workbook count is invalid");
    }
    if (row.answer_outcome !== null && !outcomes.has(row.answer_outcome)) fail("workbook_outcome", "Workbook answer outcome is invalid");
    if (!buckets.has(row.bucket)) fail("workbook_bucket", "Workbook bucket is invalid");
    if (!new Set(["high", "medium", "low"]).has(row.confidence)) fail("workbook_confidence", "Workbook confidence is invalid");
    if (!new Set(["trace_present", "trace_missing", "corpus_checked", "corpus_not_checked"]).has(row.evidence_ref)) {
      fail("workbook_evidence", "Workbook evidence reference is invalid");
    }
    if (row.note !== "not_run") fail("workbook_note", "Unrun workbook rows may not contain free text");
  }
  scanInputForSensitiveValues(workbook.rows.map(row => ({
    sample_id: row.sample_id,
    query_kind: row.query_kind,
    role: row.role,
    language: row.language,
    planner_mode: row.planner_mode,
    selected_count: row.selected_count,
    displayed_count: row.displayed_count,
    answer_outcome: row.answer_outcome,
    bucket: row.bucket,
    confidence: row.confidence,
    evidence_ref: row.evidence_ref
  })));
  return true;
}

function measurementLabel(measurement) {
  return measurement.status === "reported" ? String(measurement.count) : measurement.status;
}

export function renderReportMarkdown(report) {
  validateReportOutput(report);
  const lines = [
    "# RAG-QM-P0 privaatsuskindel kvaliteedi baasjoon",
    "",
    report.privacy_notice,
    "",
    "## Ulatus",
    "",
    `- Ajavahemik: \`${report.interval.from}\` kuni \`${report.interval.to}\` (lõpp välistatud)`,
    `- Allikas: \`${report.source}\``,
    `- Minimaalne avaldatav rühm: \`${report.privacy.minimum_group_size}\``,
    `- Andmeräsi: \`${report.integrity.data_sha256}\``,
    "",
    "## Ohutud koondloendurid",
    "",
    "| Mõõdik | Tulemus |",
    "|---|---:|",
    ...report.metrics.counts.map(item => `| \`${item.metric}\` | ${measurementLabel(item.measurement)} |`),
    "",
    "## Määrad",
    "",
    "| Mõõdik | Staatus | Määr |",
    "|---|---|---:|",
    ...report.metrics.rates.map(item => `| \`${item.metric}\` | ${item.status} | ${item.rate ?? "—"} |`),
    "",
    "## Mõõdetavusaugud",
    "",
    ...report.coverage_gaps.map(item => `- \`${item.metric}\`: ${item.status}`),
    "",
    "## Kanooniline raportiandmestik",
    "",
    "JSON- ja Markdown-väljund on loodud samast valideeritud objektist; allolev plokk on JSON-faili täpne sisu.",
    "",
    "```json",
    JSON.stringify(report, null, 2),
    "```",
    ""
  ];
  const markdown = lines.join("\n");
  const markdownWithoutValidatedHash = markdown.replaceAll(report.integrity.data_sha256, "");
  if (EMAIL_RE.test(markdownWithoutValidatedHash) || ELEVEN_DIGIT_RE.test(markdownWithoutValidatedHash) || AGENT_ID_RE.test(markdownWithoutValidatedHash)) {
    fail("privacy_rendered_output", "Rendered report privacy validation failed");
  }
  return markdown;
}

async function pathExists(filePath, fsImpl) {
  try {
    await fsImpl.access(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function writeSyncedTemp(filePath, contents, fsImpl) {
  const handle = await fsImpl.open(filePath, "wx");
  try {
    await handle.writeFile(contents, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function writeReportPairAtomic(outputDir, report, { fsImpl = fs } = {}) {
  validateReportOutput(report);
  const jsonContents = `${JSON.stringify(report, null, 2)}\n`;
  const markdownContents = renderReportMarkdown(report);
  const day = report.generated_at.slice(0, 10);
  const baseName = `rag-quality-baseline-${day}`;
  const reportDir = path.join(outputDir, baseName);
  const jsonFile = `${baseName}.json`;
  const markdownFile = `${baseName}.md`;
  const jsonPath = path.join(reportDir, jsonFile);
  const markdownPath = path.join(reportDir, markdownFile);
  const legacyJsonPath = path.join(outputDir, jsonFile);
  const legacyMarkdownPath = path.join(outputDir, markdownFile);
  const nonce = crypto.randomUUID();
  const tempDir = path.join(outputDir, `.${baseName}.${nonce}.tmp`);
  const jsonTemp = path.join(tempDir, jsonFile);
  const markdownTemp = path.join(tempDir, markdownFile);
  let tempCreated = false;
  try {
    await fsImpl.mkdir(outputDir, { recursive: true });
    if (
      await pathExists(reportDir, fsImpl) ||
      await pathExists(legacyJsonPath, fsImpl) ||
      await pathExists(legacyMarkdownPath, fsImpl)
    ) {
      fail("output_exists", "Refusing to replace an existing baseline report", 5);
    }
    await fsImpl.mkdir(tempDir, { mode: 0o700 });
    tempCreated = true;
    await writeSyncedTemp(jsonTemp, jsonContents, fsImpl);
    await writeSyncedTemp(markdownTemp, markdownContents, fsImpl);
    await fsImpl.rename(tempDir, reportDir);
    tempCreated = false;
    return {
      reportDir,
      jsonPath,
      markdownPath,
      jsonFile: path.join(baseName, jsonFile),
      markdownFile: path.join(baseName, markdownFile)
    };
  } catch (error) {
    if (tempCreated) {
      try {
        await fsImpl.rm(tempDir, { recursive: true, force: true });
      } catch {
        fail("output_cleanup_failed", "Temporary report cleanup failed", 5);
      }
    }
    if (error instanceof BaselineError) throw error;
    fail("output_write_failed", "Atomic report write failed", 5);
  }
}
