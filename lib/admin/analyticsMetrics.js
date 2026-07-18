export const ADMIN_ANALYTICS_WINDOW_DAYS = 30;
export const CRISIS_SUPPRESSION_THRESHOLD = 5;

function iso(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function createMetricBasis({
  source,
  window,
  computedAt = new Date(),
  sampleLimit,
  degraded = false,
  degradationReason = null,
  suppressed = false,
  suppressionReason = null,
  stale = false
}) {
  return {
    source: String(source || "unknown"),
    window: String(window || "live"),
    computedAt: iso(computedAt),
    ...(Number.isFinite(Number(sampleLimit)) ? { sampleLimit: Number(sampleLimit) } : {}),
    degraded: Boolean(degraded),
    degradationReason: degradationReason || null,
    suppressed: Boolean(suppressed),
    suppressionReason: suppressionReason || null,
    stale: Boolean(stale)
  };
}

export function createMetric(value, basis) {
  const numeric = value == null ? null : Number(value);
  return {
    value: Number.isFinite(numeric) ? numeric : null,
    basis
  };
}

export function createCrisisCountMetric(count, { computedAt = new Date(), window = "30d" } = {}) {
  const numeric = Math.max(0, Number(count || 0));
  const suppressed = numeric > 0 && numeric < CRISIS_SUPPRESSION_THRESHOLD;
  return createMetric(suppressed ? null : numeric, createMetricBasis({
    source: "ChatLog crisis_detected or isCrisis=true",
    window,
    computedAt,
    degraded: true,
    degradationReason: "operational_log_without_retention_contract",
    suppressed,
    suppressionReason: suppressed ? `count_below_${CRISIS_SUPPRESSION_THRESHOLD}` : null
  }));
}

export function buildExclusiveRequestSplit({ totalRequests, ragSearchCount, noContextCount }) {
  const total = Math.max(0, Number(totalRequests || 0));
  const noContext = Math.min(total, Math.max(0, Number(noContextCount || 0)));
  const ragWithContext = Math.min(
    Math.max(0, total - noContext),
    Math.max(0, Number(ragSearchCount || 0) - noContext)
  );
  const other = Math.max(0, total - noContext - ragWithContext);
  return {
    total,
    counts: { ragWithContext, noContext, other },
    percentages: total > 0
      ? {
          ragWithContext: Math.round((ragWithContext / total) * 100),
          noContext: Math.round((noContext / total) * 100),
          other: 100 - Math.round((ragWithContext / total) * 100) - Math.round((noContext / total) * 100)
        }
      : { ragWithContext: 0, noContext: 0, other: 0 },
    classification: "no_context_then_rag_with_context_then_other"
  };
}

export function countServiceAvailabilityStates(rows = [], getState) {
  const counts = { fresh: 0, stale: 0, unknown: 0, total: 0 };
  for (const row of rows) {
    const freshness = String(getState(row)?.freshness || "unknown");
    counts[freshness === "fresh" || freshness === "stale" ? freshness : "unknown"] += 1;
    counts.total += 1;
  }
  return counts;
}

export function buildCrisisSafeEventWhere(baseWhere = {}, crisisParam = "all") {
  const crisisConditions = [
    { event: "crisis_detected" },
    { data: { path: ["isCrisis"], equals: true } }
  ];
  const safeWhere = { AND: [baseWhere, { NOT: { OR: crisisConditions } }] };
  if (crisisParam === "true") safeWhere.AND.push({ id: "__count_only_crisis__" });
  if (crisisParam === "false") {
    safeWhere.AND.push({ data: { path: ["isCrisis"], equals: false } });
  }
  return {
    safeWhere,
    crisisWhere: crisisParam === "false" ? null : { AND: [baseWhere, { OR: crisisConditions }] }
  };
}
