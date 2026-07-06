import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authConfig } from "@/auth";
import { assertAdmin } from "@/lib/authz";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
import { prisma } from "@/lib/prisma";
import {
  COST_STT_PER_MINUTE_EUR,
  COST_TTS_PER_MINUTE_EUR,
  getMonthlyCostBudgetForRole
} from "@/lib/usageBudget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BASE_INCLUDED_EVENTS = ["openai_usage", "tts_cost_usage", "stt_cost_usage"];
const DEFAULT_PERIOD_DAYS = 30;
const MAX_PERIOD_DAYS = 180;
const TOP_LIMIT = 10;
const COVERAGE_NOTE_EXCLUDED =
  "RAG/embedding cost is not yet included because rag_cost_usage has not been mirrored into ChatLog yet.";
const COVERAGE_NOTE_INCLUDED =
  "RAG/embedding cost is included from mirrored rag_cost_usage events stored in ChatLog.";
const PARTIAL_COVERAGE_ROUTES = [
  "api/chat",
  "api/documents/artifacts",
  "api/documents/artifacts/generate",
  "api/documents/artifacts/refine",
  "api/research/jobs"
];
const INTERNAL_OPENAI_USAGE_ROUTES = ["api/rag/selftest"];
const THRESHOLDS = {
  warning_pct: 70,
  high_pct: 85,
  exceeded_pct: 100
};

const INTERNAL_USAGE_UNITS_PER_BUDGET_EUR = 100000;
const OPENAI_INPUT_TOKEN_EUR_EQ = 0.00000125;
const OPENAI_CACHED_TOKEN_EUR_EQ = 0.000000125;
const OPENAI_OUTPUT_TOKEN_EUR_EQ = 0.000005;
const OPENAI_REASONING_TOKEN_EUR_EQ = 0.000005;
const STT_DIRECT_TOTAL_TOKEN_EUR_EQ = 0.0000008;
const STT_DURATION_SECOND_EUR_EQ = COST_STT_PER_MINUTE_EUR / 60;
const TTS_DURATION_SECOND_EUR_EQ = COST_TTS_PER_MINUTE_EUR / 60;
const RAG_PROMPT_TOKEN_EUR_EQ = OPENAI_INPUT_TOKEN_EUR_EQ;

const UNIT_MODEL = {
  version: "v2",
  note: "internal_usage_units are normalized internal analytics units for budget tracking. They are not exact provider billing.",
  scale: {
    internal_usage_units_per_budget_eur: INTERNAL_USAGE_UNITS_PER_BUDGET_EUR
  },
  weights: {
    openai_input_token_units: round6(OPENAI_INPUT_TOKEN_EUR_EQ * INTERNAL_USAGE_UNITS_PER_BUDGET_EUR),
    openai_cached_token_units: round6(OPENAI_CACHED_TOKEN_EUR_EQ * INTERNAL_USAGE_UNITS_PER_BUDGET_EUR),
    openai_output_token_units: round6(OPENAI_OUTPUT_TOKEN_EUR_EQ * INTERNAL_USAGE_UNITS_PER_BUDGET_EUR),
    openai_reasoning_token_units: round6(OPENAI_REASONING_TOKEN_EUR_EQ * INTERNAL_USAGE_UNITS_PER_BUDGET_EUR),
    tts_duration_second_units: round6(TTS_DURATION_SECOND_EUR_EQ * INTERNAL_USAGE_UNITS_PER_BUDGET_EUR),
    stt_direct_total_token_units: round6(STT_DIRECT_TOTAL_TOKEN_EUR_EQ * INTERNAL_USAGE_UNITS_PER_BUDGET_EUR),
    stt_duration_second_units: round6(STT_DURATION_SECOND_EUR_EQ * INTERNAL_USAGE_UNITS_PER_BUDGET_EUR),
    rag_prompt_token_units: round6(RAG_PROMPT_TOKEN_EUR_EQ * INTERNAL_USAGE_UNITS_PER_BUDGET_EUR)
  }
};

function localeFromRequest(req) {
  const url = new URL(req.url);
  const fromQuery = normalizeServerLocale(url.searchParams.get("locale"));
  if (fromQuery) return fromQuery;

  const fromHeader =
    normalizeServerLocale(req.headers.get("x-ui-locale")) ||
    normalizeServerLocale(req.headers.get("x-locale")) ||
    normalizeServerLocale(req.headers.get("accept-language"));

  return fromHeader || "en";
}

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0"
    }
  });
}

function errorJson(messageKey, status = 400, locale = "en", extras = {}) {
  const translated = serverT(locale, messageKey, undefined, messageKey);
  return json(
    {
      ok: false,
      messageKey,
      message: translated,
      ...extras
    },
    status
  );
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toText(value, fallback = "unknown") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function round6(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function createUsageAccumulator() {
  return {
    events: 0,
    direct_usage_events: 0,
    estimated_usage_events: 0,
    openai_responses: 0,
    rag_jobs: 0,
    tts_jobs: 0,
    stt_jobs: 0,
    openai_input_tokens: 0,
    openai_cached_tokens: 0,
    openai_output_tokens: 0,
    openai_reasoning_tokens: 0,
    rag_prompt_tokens: 0,
    rag_total_tokens: 0,
    tts_text_chars: 0,
    tts_duration_seconds: 0,
    stt_total_tokens: 0,
    stt_duration_seconds: 0,
    stt_file_size_bytes: 0,
    internal_usage_units: 0,
    internal_usage_units_direct: 0,
    internal_usage_units_estimated: 0,
    approximate_cost_eur: 0,
    approximate_cost_eur_direct: 0,
    approximate_cost_eur_estimated: 0,
    openai_approximate_cost_eur: 0,
    rag_approximate_cost_eur: 0,
    tts_approximate_cost_eur: 0,
    stt_approximate_cost_eur: 0,
    samples: {
      openai_input_tokens: 0,
      openai_cached_tokens: 0,
      openai_output_tokens: 0,
      openai_reasoning_tokens: 0,
      rag_prompt_tokens: 0,
      rag_total_tokens: 0,
      tts_text_chars: 0,
      tts_duration_seconds: 0,
      stt_total_tokens: 0,
      stt_duration_seconds: 0,
      stt_file_size_bytes: 0
    },
    models: new Set(),
    user_ids: new Set(),
    routes: new Set(),
    stages: new Set()
  };
}

function createBucket(key, label = key) {
  return {
    key,
    label,
    ...createUsageAccumulator()
  };
}

function asTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  const ts = date.getTime();
  return Number.isFinite(ts) ? ts : null;
}

function resolvePackageForEvent(userId, eventCreatedAt, subscriptionsByUser) {
  const id = String(userId || "").trim();
  if (!id) return "none";

  const subscriptions = subscriptionsByUser.get(id) || [];
  if (!subscriptions.length) return "none";

  const eventTs = asTimestamp(eventCreatedAt);
  if (eventTs == null) {
    return toText(subscriptions[subscriptions.length - 1]?.plan, "none");
  }

  for (let index = subscriptions.length - 1; index >= 0; index -= 1) {
    const subscription = subscriptions[index];
    const createdAtTs = asTimestamp(subscription?.createdAt);
    if (createdAtTs == null || createdAtTs > eventTs) continue;

    const validUntilTs = asTimestamp(subscription?.validUntil);
    if (validUntilTs != null && validUntilTs < eventTs) continue;

    return toText(subscription?.plan, "none");
  }

  return "none";
}

function addMetric(target, name, value) {
  const parsed = toNumber(value);
  if (parsed == null) return;
  target[name] += parsed;
  target.samples[name] += 1;
}

function isDirectUsageEvent(event, data) {
  if (event === "openai_usage") return true;
  return data?.cost_read_directly === true;
}

function computeInternalUsageUnits(row) {
  const data = isObject(row?.data) ? row.data : {};
  const event = String(row?.event || "");

  if (event === "openai_usage") {
    return round6(
      toCount(data?.input_tokens) * UNIT_MODEL.weights.openai_input_token_units +
        toCount(data?.cached_tokens) * UNIT_MODEL.weights.openai_cached_token_units +
        toCount(data?.output_tokens) * UNIT_MODEL.weights.openai_output_token_units +
        toCount(data?.reasoning_tokens) * UNIT_MODEL.weights.openai_reasoning_token_units
    );
  }

  if (event === "tts_cost_usage") {
    const durationSeconds = toNumber(data?.duration_seconds);
    if (durationSeconds != null && durationSeconds > 0) {
      return round6(durationSeconds * UNIT_MODEL.weights.tts_duration_second_units);
    }
    return 0;
  }

  if (event === "stt_cost_usage") {
    const totalTokens = toNumber(data?.total_tokens);
    if (data?.cost_read_directly === true && totalTokens != null) {
      return round6(totalTokens * UNIT_MODEL.weights.stt_direct_total_token_units);
    }

    const durationSeconds = toNumber(data?.duration_seconds);
    if (durationSeconds != null && durationSeconds > 0) {
      return round6(durationSeconds * UNIT_MODEL.weights.stt_duration_second_units);
    }
    return 0;
  }

  if (event === "rag_cost_usage") {
    return round6(toCount(data?.prompt_tokens) * UNIT_MODEL.weights.rag_prompt_token_units);
  }

  return 0;
}

function computeApproximateCostEur(row) {
  const data = isObject(row?.data) ? row.data : {};
  const event = String(row?.event || "");

  if (event === "openai_usage") {
    return round6(
      toCount(data?.input_tokens) * OPENAI_INPUT_TOKEN_EUR_EQ +
        toCount(data?.cached_tokens) * OPENAI_CACHED_TOKEN_EUR_EQ +
        toCount(data?.output_tokens) * OPENAI_OUTPUT_TOKEN_EUR_EQ +
        toCount(data?.reasoning_tokens) * OPENAI_REASONING_TOKEN_EUR_EQ
    );
  }

  if (event === "tts_cost_usage") {
    const durationSeconds = toNumber(data?.duration_seconds);
    if (durationSeconds != null && durationSeconds > 0) {
      return round6(durationSeconds * TTS_DURATION_SECOND_EUR_EQ);
    }
    return 0;
  }

  if (event === "stt_cost_usage") {
    const totalTokens = toNumber(data?.total_tokens);
    if (data?.cost_read_directly === true && totalTokens != null) {
      return round6(totalTokens * STT_DIRECT_TOTAL_TOKEN_EUR_EQ);
    }

    const durationSeconds = toNumber(data?.duration_seconds);
    if (durationSeconds != null && durationSeconds > 0) {
      return round6(durationSeconds * STT_DURATION_SECOND_EUR_EQ);
    }
    return 0;
  }

  if (event === "rag_cost_usage") {
    return round6(toCount(data?.prompt_tokens) * RAG_PROMPT_TOKEN_EUR_EQ);
  }

  return 0;
}

function addRowToAccumulator(target, row) {
  const data = isObject(row?.data) ? row.data : {};
  const event = String(row?.event || "");
  const route = toText(data?.route, "unknown");
  const stage = toText(data?.stage, "unknown");
  const units = computeInternalUsageUnits(row);
  const approximateCostEur = computeApproximateCostEur(row);
  const directUsage = isDirectUsageEvent(event, data);

  target.events += 1;
  if (directUsage) {
    target.direct_usage_events += 1;
    target.internal_usage_units_direct += units;
    target.approximate_cost_eur_direct += approximateCostEur;
  } else {
    target.estimated_usage_events += 1;
    target.internal_usage_units_estimated += units;
    target.approximate_cost_eur_estimated += approximateCostEur;
  }
  target.internal_usage_units += units;
  target.approximate_cost_eur += approximateCostEur;

  if (row?.userId) target.user_ids.add(row.userId);
  if (data?.model) target.models.add(String(data.model));
  if (route) target.routes.add(route);
  if (stage) target.stages.add(stage);

  if (event === "openai_usage") {
    target.openai_responses += 1;
    target.openai_approximate_cost_eur += approximateCostEur;
    addMetric(target, "openai_input_tokens", data?.input_tokens);
    addMetric(target, "openai_cached_tokens", data?.cached_tokens);
    addMetric(target, "openai_output_tokens", data?.output_tokens);
    addMetric(target, "openai_reasoning_tokens", data?.reasoning_tokens);
    return;
  }

  if (event === "rag_cost_usage") {
    target.rag_jobs += 1;
    target.rag_approximate_cost_eur += approximateCostEur;
    addMetric(target, "rag_prompt_tokens", data?.prompt_tokens);
    addMetric(target, "rag_total_tokens", data?.total_tokens);
    return;
  }

  if (event === "tts_cost_usage") {
    target.tts_jobs += 1;
    target.tts_approximate_cost_eur += approximateCostEur;
    addMetric(target, "tts_text_chars", data?.text_chars);
    addMetric(target, "tts_duration_seconds", data?.duration_seconds);
    return;
  }

  if (event === "stt_cost_usage") {
    target.stt_jobs += 1;
    target.stt_approximate_cost_eur += approximateCostEur;
    addMetric(target, "stt_total_tokens", data?.total_tokens);
    addMetric(target, "stt_duration_seconds", data?.duration_seconds);
    addMetric(target, "stt_file_size_bytes", data?.file_size_bytes);
  }
}

function average(total, count) {
  if (!count) return null;
  return round2(total / count);
}

function buildCoverage(routeSet, options = {}) {
  const forceIncomplete = Boolean(options?.forceIncomplete);
  const ragCostIncluded = options?.ragCostIncluded === true;
  const partialCoverageRoutes = ragCostIncluded ? [] : PARTIAL_COVERAGE_ROUTES;
  const includedRoutes = Array.from(routeSet || []).sort();
  const partialRoutes = includedRoutes.filter(route => partialCoverageRoutes.includes(route));
  const coverageComplete = !forceIncomplete && partialRoutes.length === 0;
  return {
    coverage_complete: coverageComplete,
    coverage_note: coverageComplete ? null : COVERAGE_NOTE_EXCLUDED,
    included_routes: includedRoutes,
    partial_routes: partialRoutes
  };
}

function isInternalOpenAIUsageRow(row) {
  const data = isObject(row?.data) ? row.data : {};
  const route = toText(data?.route, "");
  return INTERNAL_OPENAI_USAGE_ROUTES.includes(route);
}

function buildAttributionCompleteness(rows = []) {
  const relevantRows = (Array.isArray(rows) ? rows : []).filter(row => {
    if (String(row?.event || "") !== "openai_usage") return false;
    return !isInternalOpenAIUsageRow(row);
  });

  const total = relevantRows.length;
  const withUserId = relevantRows.filter(row => Boolean(String(row?.userId || "").trim())).length;
  const withRole = relevantRows.filter(row => Boolean(String(row?.role || "").trim())).length;

  return {
    scope: "standard_text_user_facing",
    excluded_internal_routes: INTERNAL_OPENAI_USAGE_ROUTES,
    openai_usage_events: total,
    with_userId: withUserId,
    with_role: withRole,
    missing_userId: Math.max(0, total - withUserId),
    missing_role: Math.max(0, total - withRole),
    pct_with_userId: total > 0 ? round2((withUserId / total) * 100) : null,
    pct_with_role: total > 0 ? round2((withRole / total) * 100) : null
  };
}

function buildThreshold(utilizationPct) {
  const safePct = Number.isFinite(Number(utilizationPct)) ? Number(utilizationPct) : 0;
  const at70 = safePct >= THRESHOLDS.warning_pct;
  const at85 = safePct >= THRESHOLDS.high_pct;
  const at100 = safePct >= THRESHOLDS.exceeded_pct;

  let state = "normal";
  if (at100) state = "exceeded";
  else if (at85) state = "high";
  else if (at70) state = "warning";

  return {
    threshold_state: state,
    threshold_flags: {
      at_or_above_70: at70,
      at_or_above_85: at85,
      at_or_above_100: at100
    }
  };
}

function bucketToJson(bucket, extras = {}, coverageOptions = {}) {
  const coverage = buildCoverage(bucket.routes, coverageOptions);
  return {
    key: bucket.key,
    label: bucket.label,
    events: bucket.events,
    direct_usage_events: bucket.direct_usage_events,
    estimated_usage_events: bucket.estimated_usage_events,
    openai_responses: bucket.openai_responses,
    rag_jobs: bucket.rag_jobs,
    tts_jobs: bucket.tts_jobs,
    stt_jobs: bucket.stt_jobs,
    openai_input_tokens: toCount(bucket.openai_input_tokens),
    openai_cached_tokens: toCount(bucket.openai_cached_tokens),
    openai_output_tokens: toCount(bucket.openai_output_tokens),
    openai_reasoning_tokens: toCount(bucket.openai_reasoning_tokens),
    rag_prompt_tokens: toCount(bucket.rag_prompt_tokens),
    rag_total_tokens: toCount(bucket.rag_total_tokens),
    tts_text_chars: toCount(bucket.tts_text_chars),
    stt_total_tokens: toCount(bucket.stt_total_tokens),
    stt_duration_seconds: round2(bucket.stt_duration_seconds),
    stt_file_size_bytes: toCount(bucket.stt_file_size_bytes),
    internal_usage_units: round2(bucket.internal_usage_units),
    internal_usage_units_direct: round2(bucket.internal_usage_units_direct),
    internal_usage_units_estimated: round2(bucket.internal_usage_units_estimated),
    approximate_cost_eur: round2(bucket.approximate_cost_eur),
    approximate_cost_eur_direct: round2(bucket.approximate_cost_eur_direct),
    approximate_cost_eur_estimated: round2(bucket.approximate_cost_eur_estimated),
    openai_approximate_cost_eur: round2(bucket.openai_approximate_cost_eur),
    rag_approximate_cost_eur: round2(bucket.rag_approximate_cost_eur),
    tts_approximate_cost_eur: round2(bucket.tts_approximate_cost_eur),
    stt_approximate_cost_eur: round2(bucket.stt_approximate_cost_eur),
    model_count: bucket.models.size,
    models: Array.from(bucket.models).sort(),
    unique_users: bucket.user_ids.size,
    routes: coverage.included_routes,
    stages: Array.from(bucket.stages).sort(),
    coverage_complete: coverage.coverage_complete,
    coverage_note: coverage.coverage_note,
    ...extras
  };
}

function getOrCreate(map, key, label = key) {
  if (!map.has(key)) {
    map.set(key, createBucket(key, label));
  }
  return map.get(key);
}

function buildFeatureSpotlight(byFeature, key, coverageOptions = {}) {
  if (!byFeature.has(key)) return null;

  const bucket = byFeature.get(key);
  const [route = "unknown", stage = "unknown"] = String(bucket?.key || key).split("::");

  return bucketToJson(
    bucket,
    {
      route,
      stage
    },
    coverageOptions
  );
}

function createEmptyFeatureSpotlight(route, stage, coverageOptions = {}) {
  return {
    ...bucketToJson(createBucket(`${route}::${stage}`, `${route} / ${stage}`), { route, stage }, coverageOptions),
    route,
    stage
  };
}

function sortBuckets(rows) {
  return rows.sort((a, b) => {
    if (toCount(b.internal_usage_units) !== toCount(a.internal_usage_units)) {
      return toCount(b.internal_usage_units) - toCount(a.internal_usage_units);
    }
    if (b.events !== a.events) return b.events - a.events;
    return String(a.label || a.key).localeCompare(String(b.label || b.key));
  });
}

function buildThresholdCounts(rows) {
  const out = {
    users_at_or_above_70_pct: 0,
    users_at_or_above_85_pct: 0,
    users_at_or_above_100_pct: 0,
    packages_at_or_above_70_pct: 0,
    packages_at_or_above_85_pct: 0,
    packages_at_or_above_100_pct: 0
  };

  for (const row of rows.user_budget_tracking || []) {
    if (row?.threshold_flags?.at_or_above_70) out.users_at_or_above_70_pct += 1;
    if (row?.threshold_flags?.at_or_above_85) out.users_at_or_above_85_pct += 1;
    if (row?.threshold_flags?.at_or_above_100) out.users_at_or_above_100_pct += 1;
  }

  for (const row of rows.package_budget_tracking || []) {
    if (row?.threshold_flags?.at_or_above_70) out.packages_at_or_above_70_pct += 1;
    if (row?.threshold_flags?.at_or_above_85) out.packages_at_or_above_85_pct += 1;
    if (row?.threshold_flags?.at_or_above_100) out.packages_at_or_above_100_pct += 1;
  }

  return out;
}

export async function GET(req) {
  const locale = localeFromRequest(req);
  const session = await getServerSession(authConfig).catch(() => null);
  const authz = assertAdmin(session);

  if (!authz.ok) {
    return errorJson(authz.message || "api.common.forbidden", authz.status || 403, locale);
  }

  try {
    const url = new URL(req.url);
    const daysRaw = Number(url.searchParams.get("days"));
    const periodDays = Math.min(
      MAX_PERIOD_DAYS,
      Math.max(1, Number.isFinite(daysRaw) ? daysRaw : DEFAULT_PERIOD_DAYS)
    );
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    const ragMirroredCount = await prisma.chatLog.count({
      where: {
        event: "rag_cost_usage",
        createdAt: { gte: since }
      }
    });
    const ragCostIncluded = ragMirroredCount > 0;
    const includedEvents = ragCostIncluded
      ? [...BASE_INCLUDED_EVENTS, "rag_cost_usage"]
      : BASE_INCLUDED_EVENTS;
    const coverageNote = ragCostIncluded ? COVERAGE_NOTE_INCLUDED : COVERAGE_NOTE_EXCLUDED;
    const knownPartialRoutes = ragCostIncluded ? [] : PARTIAL_COVERAGE_ROUTES;

    const rows = await prisma.chatLog.findMany({
      where: {
        createdAt: { gte: since },
        event: { in: includedEvents }
      },
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        userId: true,
        role: true,
        event: true,
        data: true
      }
    });

    const careerRunRows = await prisma.chatLog.findMany({
      where: {
        createdAt: { gte: since },
        event: "career_agent_run"
      },
      orderBy: { createdAt: "desc" },
      select: {
        userId: true,
        role: true,
        data: true
      }
    });

    const eventCounts = {
      openai_usage: 0,
      tts_cost_usage: 0,
      stt_cost_usage: 0,
      rag_cost_usage: 0
    };
    const attributionCompleteness = buildAttributionCompleteness(rows);

    const userIds = Array.from(new Set(rows.map(row => String(row?.userId || "").trim()).filter(Boolean)));

    const [subscriptions, users] = await Promise.all([
      userIds.length
        ? prisma.subscription.findMany({
            where: { userId: { in: userIds } },
            orderBy: [{ createdAt: "asc" }, { updatedAt: "asc" }],
            select: {
              userId: true,
              plan: true,
              status: true,
              createdAt: true,
              updatedAt: true,
              validUntil: true
            }
          })
        : Promise.resolve([]),
      userIds.length
        ? prisma.user.findMany({
            where: { id: { in: userIds } },
            select: {
              id: true,
              email: true,
              role: true,
              isAdmin: true
            }
          })
        : Promise.resolve([])
    ]);

    const subscriptionsByUser = new Map();
    for (const row of subscriptions) {
      if (!row?.userId) continue;
      if (!subscriptionsByUser.has(row.userId)) {
        subscriptionsByUser.set(row.userId, []);
      }
      subscriptionsByUser.get(row.userId).push(row);
    }

    const userById = {};
    for (const row of users) {
      if (!row?.id) continue;
      userById[row.id] = row;
    }

    const summary = createUsageAccumulator();
    const byRole = new Map();
    const byPackage = new Map();
    const byRoute = new Map();
    const byStage = new Map();
    const byModel = new Map();
    const byFeature = new Map();
    const byUser = new Map();

    for (const row of rows) {
      const data = isObject(row?.data) ? row.data : {};
      const event = String(row?.event || "");
      const userId = String(row?.userId || "").trim();
      const user = userById[userId];
      const role = toText(row?.role || user?.role, "unknown");
      const pkg = resolvePackageForEvent(userId, row?.createdAt, subscriptionsByUser);
      const route = toText(data?.route, "unknown");
      const stage = toText(data?.stage, "unknown");
      const model = toText(data?.model, "unknown");
      const userLabel = user?.email || userId || "anonymous";
      const featureKey = `${route}::${stage}`;

      if (eventCounts[event] != null) eventCounts[event] += 1;

      addRowToAccumulator(summary, row);
      addRowToAccumulator(getOrCreate(byRole, role, role), row);
      addRowToAccumulator(getOrCreate(byPackage, pkg, pkg), row);
      addRowToAccumulator(getOrCreate(byRoute, route, route), row);
      addRowToAccumulator(getOrCreate(byStage, stage, stage), row);
      addRowToAccumulator(getOrCreate(byModel, model, model), row);
      addRowToAccumulator(getOrCreate(byFeature, featureKey, `${route} / ${stage}`), row);

      if (userId) {
        const userBucket = getOrCreate(byUser, userId, userLabel);
        userBucket.email = user?.email || null;
        userBucket.role = role;
        userBucket.isAdmin = Boolean(user?.isAdmin);
        if (!userBucket.packageKeys) userBucket.packageKeys = new Set();
        userBucket.packageKeys.add(pkg);
        addRowToAccumulator(userBucket, row);
      }
    }

    const coverageOptions = { ragCostIncluded };
    const byRoleRows = sortBuckets(Array.from(byRole.values()).map(bucket => bucketToJson(bucket, {}, coverageOptions)));
    const byPackageRows = sortBuckets(Array.from(byPackage.values()).map(bucket => bucketToJson(bucket, {}, coverageOptions)));
    const byRouteRows = sortBuckets(Array.from(byRoute.values()).map(bucket => bucketToJson(bucket, {}, coverageOptions)));
    const byStageRows = sortBuckets(Array.from(byStage.values()).map(bucket => bucketToJson(bucket, {}, coverageOptions)));
    const byModelRows = sortBuckets(Array.from(byModel.values()).map(bucket => bucketToJson(bucket, {}, coverageOptions)));

    const topFeatures = sortBuckets(
      Array.from(byFeature.values()).map(bucket => {
        const [route = "unknown", stage = "unknown"] = String(bucket.key || "").split("::");
        return bucketToJson(bucket, { route, stage }, coverageOptions);
      })
    ).slice(0, TOP_LIMIT);

    const careerAiExtractorBase =
      buildFeatureSpotlight(byFeature, "api/career-agent/run::career_ai_extractor", coverageOptions) ||
      createEmptyFeatureSpotlight("api/career-agent/run", "career_ai_extractor", coverageOptions);

    const careerRunsResolved = careerRunRows.filter(row => {
      const data = isObject(row?.data) ? row.data : {};
      return toText(data?.route, "") === "api/career-agent/run";
    });
    const careerAiExtractorActivated = careerRunsResolved.filter(row => {
      const data = isObject(row?.data) ? row.data : {};
      return data?.ai_extractor_used === true;
    });
    const careerAiExtractorActivationRatePct =
      careerRunsResolved.length > 0
        ? round2((careerAiExtractorActivated.length / careerRunsResolved.length) * 100)
        : 0;

    const featureSpotlights = {
      career_ai_extractor: {
        ...careerAiExtractorBase,
        total_turns: careerRunsResolved.length,
        activated_turns: careerAiExtractorActivated.length,
        activation_rate_pct: careerAiExtractorActivationRatePct
      }
    };

    const userBudgetTracking = sortBuckets(
      Array.from(byUser.values()).map(bucket => {
        const role = bucket.role || "unknown";
        const isAdmin = Boolean(bucket.isAdmin);
        const packageKeys = Array.from(bucket.packageKeys || []);
        const packageName =
          packageKeys.length <= 1
            ? toText(packageKeys[0], "none")
            : "mixed";
        const budgetEur = getMonthlyCostBudgetForRole(role, isAdmin);
        const budgetUnitsMonthly = round2(budgetEur * INTERNAL_USAGE_UNITS_PER_BUDGET_EUR);
        const utilizationPct =
          budgetUnitsMonthly > 0 ? round2((bucket.internal_usage_units / budgetUnitsMonthly) * 100) : 0;
        const coverage = buildCoverage(bucket.routes, coverageOptions);
        const threshold = buildThreshold(utilizationPct);

        return {
          ...bucketToJson(bucket, {
            user_id: bucket.key,
            email: bucket.email || null,
            role,
            package: packageName,
            is_admin: isAdmin,
            budget_eur_monthly: round2(budgetEur),
            budget_units_monthly: budgetUnitsMonthly,
            utilization_pct: utilizationPct
          }),
          coverage_complete: coverage.coverage_complete,
          coverage_note: coverage.coverage_note,
          ...threshold
        };
      })
    );

    const packageBudgetMap = new Map();
    for (const row of userBudgetTracking) {
      const pkg = toText(row?.package, "none");
      if (!packageBudgetMap.has(pkg)) {
        packageBudgetMap.set(pkg, {
          package: pkg,
          users: 0,
          events: 0,
          direct_usage_events: 0,
          estimated_usage_events: 0,
          internal_usage_units: 0,
          internal_usage_units_direct: 0,
          internal_usage_units_estimated: 0,
          approximate_cost_eur: 0,
          approximate_cost_eur_direct: 0,
          approximate_cost_eur_estimated: 0,
          budget_units_monthly: 0,
          coverage_complete: true,
          coverage_note: null,
          routes: new Set()
        });
      }

      const bucket = packageBudgetMap.get(pkg);
      bucket.users += 1;
      bucket.events += toCount(row?.events);
      bucket.direct_usage_events += toCount(row?.direct_usage_events);
      bucket.estimated_usage_events += toCount(row?.estimated_usage_events);
      bucket.internal_usage_units += toCount(row?.internal_usage_units);
      bucket.internal_usage_units_direct += toCount(row?.internal_usage_units_direct);
      bucket.internal_usage_units_estimated += toCount(row?.internal_usage_units_estimated);
      bucket.approximate_cost_eur += toNumber(row?.approximate_cost_eur) || 0;
      bucket.approximate_cost_eur_direct += toNumber(row?.approximate_cost_eur_direct) || 0;
      bucket.approximate_cost_eur_estimated += toNumber(row?.approximate_cost_eur_estimated) || 0;
      bucket.budget_units_monthly += toCount(row?.budget_units_monthly);
      bucket.coverage_complete = bucket.coverage_complete && row?.coverage_complete === true;
      if (!row?.coverage_complete) {
        bucket.coverage_note = row?.coverage_note || coverageNote;
      }
      for (const route of row?.routes || []) bucket.routes.add(route);
    }

    const packageBudgetTracking = Array.from(packageBudgetMap.values())
      .map(bucket => {
        const utilizationPct =
          bucket.budget_units_monthly > 0
            ? round2((bucket.internal_usage_units / bucket.budget_units_monthly) * 100)
            : 0;
        const threshold = buildThreshold(utilizationPct);
        return {
          package: bucket.package,
          users: bucket.users,
          events: bucket.events,
          direct_usage_events: bucket.direct_usage_events,
          estimated_usage_events: bucket.estimated_usage_events,
          internal_usage_units: round2(bucket.internal_usage_units),
          internal_usage_units_direct: round2(bucket.internal_usage_units_direct),
          internal_usage_units_estimated: round2(bucket.internal_usage_units_estimated),
          approximate_cost_eur: round2(bucket.approximate_cost_eur),
          approximate_cost_eur_direct: round2(bucket.approximate_cost_eur_direct),
          approximate_cost_eur_estimated: round2(bucket.approximate_cost_eur_estimated),
          budget_units_monthly: round2(bucket.budget_units_monthly),
          utilization_pct: utilizationPct,
          coverage_complete: bucket.coverage_complete,
          coverage_note: bucket.coverage_complete ? null : bucket.coverage_note || coverageNote,
          routes: Array.from(bucket.routes).sort(),
          ...threshold
        };
      })
      .sort((a, b) => {
        if (toCount(b.internal_usage_units) !== toCount(a.internal_usage_units)) {
          return toCount(b.internal_usage_units) - toCount(a.internal_usage_units);
        }
        return String(a.package).localeCompare(String(b.package));
      });

    const thresholdCounts = buildThresholdCounts({
      user_budget_tracking: userBudgetTracking,
      package_budget_tracking: packageBudgetTracking
    });

    return json({
      ok: true,
      periodDays,
      filters: {
        days: periodDays,
        included_events: includedEvents
      },
      unit_model: UNIT_MODEL,
      thresholds: THRESHOLDS,
      coverage: {
        included_events: includedEvents,
        excluded_events: ragCostIncluded ? [] : ["rag_cost_usage"],
        rag_cost_included: ragCostIncluded,
        known_partial_routes: knownPartialRoutes,
        coverage_complete: ragCostIncluded,
        note: coverageNote
      },
      summary: {
        total_events: summary.events,
        unique_users: summary.user_ids.size,
        direct_usage_events: summary.direct_usage_events,
        estimated_usage_events: summary.estimated_usage_events,
        openai_responses: summary.openai_responses,
        rag_jobs: summary.rag_jobs,
        tts_jobs: summary.tts_jobs,
        stt_jobs: summary.stt_jobs,
        event_counts: eventCounts,
        totals: {
          openai_input_tokens: toCount(summary.openai_input_tokens),
          openai_cached_tokens: toCount(summary.openai_cached_tokens),
          openai_output_tokens: toCount(summary.openai_output_tokens),
          openai_reasoning_tokens: toCount(summary.openai_reasoning_tokens),
          rag_prompt_tokens: toCount(summary.rag_prompt_tokens),
          rag_total_tokens: toCount(summary.rag_total_tokens),
          tts_text_chars: toCount(summary.tts_text_chars),
          tts_duration_seconds: round2(summary.tts_duration_seconds),
          stt_total_tokens: toCount(summary.stt_total_tokens),
          stt_duration_seconds: round2(summary.stt_duration_seconds),
          stt_file_size_bytes: toCount(summary.stt_file_size_bytes)
        },
        averages: {
          openai_per_response: {
            input_tokens: average(summary.openai_input_tokens, summary.samples.openai_input_tokens),
            cached_tokens: average(summary.openai_cached_tokens, summary.samples.openai_cached_tokens),
            output_tokens: average(summary.openai_output_tokens, summary.samples.openai_output_tokens),
            reasoning_tokens: average(summary.openai_reasoning_tokens, summary.samples.openai_reasoning_tokens)
          },
          tts_per_job: {
            text_chars: average(summary.tts_text_chars, summary.samples.tts_text_chars),
            duration_seconds: average(summary.tts_duration_seconds, summary.samples.tts_duration_seconds)
          },
          stt_per_job: {
            total_tokens: average(summary.stt_total_tokens, summary.samples.stt_total_tokens),
            duration_seconds: average(summary.stt_duration_seconds, summary.samples.stt_duration_seconds),
            file_size_bytes: average(summary.stt_file_size_bytes, summary.samples.stt_file_size_bytes)
          }
        },
        internal_usage_units: {
          total: round2(summary.internal_usage_units),
          direct: round2(summary.internal_usage_units_direct),
          estimated: round2(summary.internal_usage_units_estimated)
        },
        approximate_cost_eur: {
          total: round2(summary.approximate_cost_eur),
          direct: round2(summary.approximate_cost_eur_direct),
          estimated: round2(summary.approximate_cost_eur_estimated),
          openai: round2(summary.openai_approximate_cost_eur),
          rag: round2(summary.rag_approximate_cost_eur),
          tts: round2(summary.tts_approximate_cost_eur),
          stt: round2(summary.stt_approximate_cost_eur)
        },
        attribution_completeness: attributionCompleteness,
        threshold_counts: thresholdCounts,
        coverage_complete: ragCostIncluded,
        coverage_note: coverageNote
      },
      breakdowns: {
        by_role: byRoleRows,
        by_package: byPackageRows,
        by_route: byRouteRows,
        by_stage: byStageRows,
        by_model: byModelRows
      },
      feature_spotlights: featureSpotlights,
      top_features: topFeatures,
      top_users: userBudgetTracking.slice(0, TOP_LIMIT),
      user_budget_tracking: userBudgetTracking,
      package_budget_tracking: packageBudgetTracking
    });
  } catch (error) {
    console.error("admin analytics ai-costs GET failed", error);
    return errorJson("api.admin.analytics.summary_load_failed", 500, locale, {
      debugCode: "ADMIN_ANALYTICS_AI_COSTS_GET_FAILED"
    });
  }
}
