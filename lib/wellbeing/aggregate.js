import { prisma as defaultPrisma } from "../prisma.js";
import { wellbeingParticipationWhere } from "./participation.js";

const DEFAULT_MINIMUM_GROUP_SIZE = 3;
const MAXIMUM_TAKE = 10000;

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

function normalizePositiveInteger(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  const integer = Math.trunc(number);
  return integer > 0 ? integer : fallback;
}

export function resolveWellbeingMinimumGroupSize(options = {}) {
  const env = options.env || process.env;
  return normalizePositiveInteger(env?.WELLBEING_MIN_GROUP_SIZE, DEFAULT_MINIMUM_GROUP_SIZE);
}

function parseDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeSignal(signal) {
  if (redSignals.has(signal)) return "red";
  if (yellowSignals.has(signal)) return "yellow";
  if (signal === "green" || signal === "manageable" || signal === "clear" || signal === "support_available" || signal === "no_immediate_danger") {
    return "green";
  }
  return null;
}

function increment(map, key, amount = 1) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + amount);
}

function metric(metricKey, metricValue, sampleSize, aggregationLevel) {
  return {
    metricKey,
    metricValue,
    sampleSize,
    aggregationLevel,
    exportEligible: true
  };
}

function countMetrics(prefix, counts, sampleSize, aggregationLevel) {
  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, count]) => metric(`${prefix}.${key}.count`, count, sampleSize, aggregationLevel));
}

function signalMetrics(signalCounts, totalRecords, sampleSize, aggregationLevel) {
  return ["green", "red", "yellow"].flatMap((signal) => {
    const count = signalCounts.get(signal) || 0;
    return [
      metric(`signal.${signal}.count`, count, sampleSize, aggregationLevel),
      metric(`signal.${signal}.share`, totalRecords > 0 ? count / totalRecords : 0, sampleSize, aggregationLevel)
    ];
  });
}

/* SOL-WB-01 ja SOL-WB-02: koond filtreerib AINULT külmutatud osaluse järgi
   (`lib/wellbeing/participation.js`). `roleGroup` veerg kirje peal on kasutaja
   enda kirjeldus ja teda siin ei küsita — vastasel juhul otsustaks kliendi
   saadetud string, millise piloodi koondisse kirje loetakse. Organisatsiooni-
   ja KOV-piir tuleb piloodi skoobist (`pilotAccess.js`) ja tema puudumine ei
   ole „kõik", vaid selle piloodi puhul teadlikult platvormiülene rollirühm. */
function buildWhere(filters = {}) {
  const periodStart = parseDate(filters.periodStart);
  const periodEnd = parseDate(filters.periodEnd);
  const createdAt = {
    ...(periodStart ? { gte: periodStart } : {}),
    ...(periodEnd ? { lt: periodEnd } : {})
  };
  const workflowType = String(filters.workflowType || "").trim();

  return {
    aggregationEligible: true,
    visibility: "private",
    ...wellbeingParticipationWhere({
      organizationId: filters.organizationId,
      municipalityId: filters.municipalityId,
      roleGroup: filters.roleGroup
    }),
    ...(workflowType ? { workflowType } : {}),
    ...(Object.keys(createdAt).length > 0 ? { createdAt } : {})
  };
}

/* Vastus peab ütlema, MILLIST hulka ta katab. SOL-WB-01 mõju oli osalt see, et
   platvormiülene valim kandis piloodi metaandmeid ja näis kohaliku asutuse
   tulemusena; seega organisatsiooni- ja KOV-piir käib vastusega kaasas ka siis,
   kui teda ei ole (`null` = piirat pole seatud). */
function publicFilters(filters = {}) {
  return {
    periodStart: filters.periodStart || null,
    periodEnd: filters.periodEnd || null,
    roleGroup: filters.roleGroup || null,
    workflowType: filters.workflowType || null,
    organizationId: filters.organizationId || null,
    municipalityId: filters.municipalityId || null,
    aggregationLevel: filters.aggregationLevel || "role_group"
  };
}

export async function buildWellbeingAggregateDataset(filters = {}, options = {}) {
  const prisma = options.prisma || defaultPrisma;
  const minimumGroupSize = resolveWellbeingMinimumGroupSize(options);
  const aggregationLevel = String(filters.aggregationLevel || "role_group");
  const records = await prisma.wellbeingRecord.findMany({
    where: buildWhere(filters),
    select: {
      ownerUserId: true,
      workflowType: true,
      computedSignal: true,
      loadFactors: true,
      resourceFactors: true,
      riskMarkers: true
    },
    take: MAXIMUM_TAKE
  });

  const sampleSize = new Set(records.map((record) => record.ownerUserId).filter(Boolean)).size;
  const base = {
    schemaVersion: "1.0",
    scoringVersion: "aggregate-v1",
    generatedAt: (parseDate(options.now) || new Date()).toISOString(),
    filters: publicFilters(filters),
    minimumGroupSize,
    sampleSize,
    recordCount: records.length,
    suppressed: sampleSize < minimumGroupSize,
    metrics: []
  };

  if (base.suppressed) {
    return {
      ...base,
      suppressionReason: "minimum_group_size"
    };
  }

  const signalCounts = new Map();
  const workflowCounts = new Map();
  const demandCounts = new Map();
  const resourceCounts = new Map();
  const riskCounts = new Map();

  for (const record of records) {
    increment(workflowCounts, record.workflowType);
    increment(signalCounts, normalizeSignal(record?.computedSignal?.signalLevel));
    for (const key of record.loadFactors || []) increment(demandCounts, key);
    for (const key of record.resourceFactors || []) increment(resourceCounts, key);
    for (const key of record.riskMarkers || []) increment(riskCounts, key);
  }

  return {
    ...base,
    metrics: [
      ...signalMetrics(signalCounts, records.length, sampleSize, aggregationLevel),
      ...countMetrics("workflow", workflowCounts, sampleSize, aggregationLevel),
      ...countMetrics("work_demand", demandCounts, sampleSize, aggregationLevel),
      ...countMetrics("work_resource", resourceCounts, sampleSize, aggregationLevel),
      ...countMetrics("risk_event", riskCounts, sampleSize, aggregationLevel)
    ]
  };
}
