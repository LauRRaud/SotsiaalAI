import { formatQuickCheckFactor } from "./quickCheck.js";
import { wellbeingLabel } from "./displayLabels.js";
import { listWellbeingRecordsForUser } from "./records.js";

const workflowLabels = {
  "quick-check": "Kiirkontroll",
  overview: "Ülevaade",
  "hard-case": "Raske juhtum",
  "workplace-violence": "Töövägivald",
  recovery: "Taastumine",
  "work-boundaries": "Tööpiirid",
  interruptions: "Katkestused",
  "work-processes": "Tööprotsessid",
  "role-boundaries": "Rollipiirid",
  "starter-support": "Alustaja tugi",
  covision: "Kovisioon"
};

const periodPresets = {
  all: { key: "all", label: "Kõik", dayCount: null },
  week: { key: "week", label: "Nädal", dayCount: 7 },
  month: { key: "month", label: "Kuu", dayCount: 30 }
};

const redSignals = new Set([
  "red",
  "urgent_attention",
  "needs_reorganization",
  "needs_organizational_change",
  "needs_network_discussion",
  "needs_urgent_support_agreement"
]);

const yellowSignals = new Set([
  "yellow",
  "needs_attention",
  "prioritize",
  "organizational_support",
  "needs_agreement",
  "needs_workflow_clarification",
  "needs_simplification",
  "needs_clarification",
  "needs_clearer_support_plan"
]);

function increment(map, key) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + 1);
}

function workflowLabel(workflowType) {
  return workflowLabels[workflowType] || workflowType;
}

function formatWellbeingFactor(value) {
  const quickCheckLabel = formatQuickCheckFactor(value);
  return quickCheckLabel === value ? wellbeingLabel(value) : quickCheckLabel;
}

function parseDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveOverviewPeriod(filters = {}, options = {}) {
  const requestedKey = String(filters.period || "all").trim().toLowerCase();
  const preset = periodPresets[requestedKey] || periodPresets.all;
  const explicitStart = parseDate(filters.periodStart);
  const explicitEnd = parseDate(filters.periodEnd);

  if (explicitStart || explicitEnd) {
    return {
      key: "custom",
      label: "Valitud periood",
      dayCount: null,
      periodStart: explicitStart,
      periodEnd: explicitEnd
    };
  }

  if (!preset.dayCount) {
    return {
      ...preset,
      periodStart: null,
      periodEnd: null
    };
  }

  const periodEnd = parseDate(options.now) || new Date();
  const periodStart = new Date(periodEnd.getTime() - preset.dayCount * 24 * 60 * 60 * 1000);

  return {
    ...preset,
    periodStart,
    periodEnd
  };
}

function normalizeSignal(signal) {
  if (redSignals.has(signal)) return "red";
  if (yellowSignals.has(signal)) return "yellow";
  if (signal === "green" || signal === "manageable" || signal === "clear" || signal === "support_available" || signal === "no_immediate_danger") {
    return "green";
  }
  return null;
}

function topCounts(map, limit = 5) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, count]) => ({
      key,
      label: formatWellbeingFactor(key),
      count
    }));
}

function workflowCounts(map) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([workflowType, count]) => ({
      workflowType,
      label: workflowLabel(workflowType),
      count
    }));
}

function markCategory(items, category) {
  return items.map((item) => ({
    ...item,
    category
  }));
}

function periodSignal(signalCounts, total) {
  if (total <= 0) return "insufficient_data";
  if (signalCounts.red > 0) return "red";
  if (signalCounts.yellow > 0) return "yellow";
  return "green";
}

function buildManagerMemo({ recordCount, signalCounts, topLoadFactors, topResourceFactors, riskMarkers, workflowCounts: workflows }) {
  const signal = wellbeingLabel(periodSignal(signalCounts, recordCount));
  const signalLine = `Perioodi signaal: ${signal}. Punaseid signaale: ${signalCounts.red}, kollaseid: ${signalCounts.yellow}, rohelisi: ${signalCounts.green}.`;
  const workflowLine = workflows.length
    ? workflows.map((item) => `${item.label}: ${item.count}`).join("; ")
    : "andmeid ei ole veel piisavalt";
  const loadLines = topLoadFactors.length
    ? topLoadFactors.map((item) => `- ${item.label}: ${item.count}`).join("\n")
    : "- korduvaid koormustegureid ei ole veel piisavalt";
  const resourceLines = topResourceFactors.length
    ? topResourceFactors.map((item) => `- ${item.label}: ${item.count}`).join("\n")
    : "- korduvaid ressursivajadusi ei ole veel piisavalt";
  const riskLines = riskMarkers.length
    ? riskMarkers.map((item) => `- ${item.label}: ${item.count}`).join("\n")
    : "- riskimustreid ei ole veel piisavalt";

  return {
    title: "Juhiga jagatav memo",
    text: [
      "Juhiga jagatav memo",
      "",
      "Koondatud tööheaolu ülevaade",
      "",
      `Töövoogude arv: ${recordCount}.`,
      signalLine,
      `Kasutatud töövood: ${workflowLine}.`,
      "",
      "Korduvad koormustegurid",
      loadLines,
      "",
      "Puuduvad või vajatavad ressursid",
      resourceLines,
      "",
      "Riskimustrid",
      riskLines,
      "",
      "Memo on koostatud koondatud markeritest ega sisalda üksikute sisestuste vabateksti või toorvälju."
    ].join("\n")
  };
}

export async function buildWellbeingOverviewForUser(userId, filters = {}, options = {}) {
  const period = resolveOverviewPeriod(filters, options);
  const records = await listWellbeingRecordsForUser(userId, {
    ...filters,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    take: filters.take || 100
  }, options);

  const signalCounts = { green: 0, yellow: 0, red: 0 };
  const workflowCountMap = new Map();
  const loadCounts = new Map();
  const resourceCounts = new Map();
  const riskCounts = new Map();
  const actionTypes = [];

  for (const record of records) {
    increment(workflowCountMap, record?.workflowType);
    const signal = normalizeSignal(record?.computedSignal?.signalLevel);
    if (signal in signalCounts) signalCounts[signal] += 1;
    for (const factor of record?.loadFactors || []) increment(loadCounts, factor);
    for (const factor of record?.resourceFactors || []) increment(resourceCounts, factor);
    for (const marker of record?.riskMarkers || []) increment(riskCounts, marker);
    for (const action of record?.recommendedActions || []) {
      const workflowType = action?.workflowType;
      if (workflowType && !actionTypes.includes(workflowType)) actionTypes.push(workflowType);
    }
  }

  const topLoadFactors = topCounts(loadCounts);
  const topResourceFactors = topCounts(resourceCounts);
  const riskMarkers = topCounts(riskCounts);
  const workDemands = markCategory(topLoadFactors, "work_demand");
  const workResources = markCategory(topResourceFactors, "work_resource");
  const riskEvents = markCategory(riskMarkers, "risk_event");
  const workflowCountList = workflowCounts(workflowCountMap);

  return {
    schemaVersion: "1.0",
    scoringVersion: "overview-v2",
    generatedAt: new Date().toISOString(),
    period: {
      key: period.key,
      label: period.label,
      dayCount: period.dayCount,
      periodStart: period.periodStart ? period.periodStart.toISOString() : null,
      periodEnd: period.periodEnd ? period.periodEnd.toISOString() : null
    },
    recordCount: records.length,
    quickCheckCount: records.filter((record) => record?.workflowType === "quick-check").length,
    workflowCounts: workflowCountList,
    periodSignal: periodSignal(signalCounts, records.length),
    signalCounts,
    topLoadFactors,
    topResourceFactors,
    riskMarkers,
    workDemands,
    workResources,
    riskEvents,
    recommendedWorkflowTypes: actionTypes,
    managerMemo: buildManagerMemo({
      recordCount: records.length,
      signalCounts,
      topLoadFactors,
      topResourceFactors,
      riskMarkers,
      workflowCounts: workflowCountList
    })
  };
}
