import { prisma as defaultPrisma } from "../prisma.js";
import { readWellbeingRecordsPaged } from "./pagedRecords.js";
import { wellbeingParticipationWhere } from "./participation.js";

const DEFAULT_MINIMUM_GROUP_SIZE = 3;
/* SOL-WB-05: kaitsepiir jääb (üks päring ei tohi kogu mälu ära süüa), aga ta ei
   ole enam vaikne ega järjestuseta. Vana `take: 10000` ilma `orderBy`-ta
   tähendas, et suurema hulga korral otsustas valimi andmebaasi määramata
   reajärjestus — kaks järjestikust päringut võisid anda eri vastuse. */
const MAXIMUM_RECORDS = 100000;

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

/* SOL-WB-06: künnis on ALAMPIIRIGA jõustatud koodis. Varem võttis ta
   keskkonnamuutuja väärtuse vastu ka siis, kui see oli `1` — ja
   `WELLBEING_MIN_GROUP_SIZE=1` eemaldas privaatsuskaitse täielikult, ilma et
   ükski logirida oleks seda öelnud. Env saab künnist tõsta, mitte langetada. */
export function resolveWellbeingMinimumGroupSize(options = {}) {
  const env = options.env || process.env;
  const configured = normalizePositiveInteger(env?.WELLBEING_MIN_GROUP_SIZE, DEFAULT_MINIMUM_GROUP_SIZE);
  return Math.max(configured, DEFAULT_MINIMUM_GROUP_SIZE);
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

/* Üks inimene, üks hääl töövoo kohta: viimane kirje võidab, sest ta kirjeldab
   kõige värskemat seisu. `createdAt` puudumisel jääb esimene nähtud rida —
   fake-andmetel ei ole see määrav, päris ridadel on `createdAt` alati olemas. */
function latestPerPerson(records) {
  const newest = new Map();
  for (const record of records) {
    const key = `${record.ownerUserId}:${record.workflowType}`;
    const current = newest.get(key);
    if (!current || new Date(record.createdAt || 0) > new Date(current.createdAt || 0)) {
      newest.set(key, record);
    }
  }
  return [...newest.values()];
}

function increment(map, key, amount = 1) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + amount);
}

/* SOL-WB-04: `sampleSize` on INIMESTE arv, aga loendurid kasvavad iga KIRJE
   pealt. Ilma ühise nimetajata võis „esinemus / valim" ületada 100% ja üks väga
   aktiivne kasutaja määras kogu prioriteedijärjestuse, kuigi raporti keel
   rääkis töötajate osakaalust. Mõõdik kannab nüüd MÕLEMAT arvu ja ütleb, kumb
   on tema nimetaja. */
function metric(metricKey, metricValue, sampleSize, aggregationLevel, denominator) {
  return {
    metricKey,
    metricValue,
    sampleSize,
    denominator,
    aggregationLevel,
    exportEligible: true
  };
}

function countMetrics(prefix, counts, sampleSize, aggregationLevel, denominator) {
  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, count]) => metric(`${prefix}.${key}.count`, count, sampleSize, aggregationLevel, denominator));
}

function signalMetrics(signalCounts, totalRecords, sampleSize, aggregationLevel) {
  return ["green", "red", "yellow"].flatMap((signal) => {
    const count = signalCounts.get(signal) || 0;
    return [
      metric(`signal.${signal}.count`, count, sampleSize, aggregationLevel, totalRecords),
      /* Osakaalu nimetaja on SAMA ühik mis lugejal — mitte inimeste arv. */
      metric(`signal.${signal}.share`, totalRecords > 0 ? count / totalRecords : 0, sampleSize, aggregationLevel, totalRecords)
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
    /* SOL-WB-06: vastus ütleb, MILLISE lubatud perioodiga ta arvutati — mitte
       ainult kaks kuupäeva, mille tagant ei ole näha, kas piir oli lubatud. */
    periodKind: filters.periodKind || "all",
    periodLabel: filters.periodLabel || null,
    periodStart: filters.periodStart ? new Date(filters.periodStart).toISOString() : null,
    periodEnd: filters.periodEnd ? new Date(filters.periodEnd).toISOString() : null,
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
  /* Piir on serveri oma: ta tuleb `options`-ist (kutsuja kood), MITTE
     `filters`-ist (päringustring). Kliendi seatav kaitsepiir ei ole kaitsepiir. */
  const maxRecords = Number(options.maxRecords) > 0 ? Math.trunc(options.maxRecords) : MAXIMUM_RECORDS;
  const { records, truncated } = await readWellbeingRecordsPaged(prisma, {
    where: buildWhere(filters),
    select: {
      ownerUserId: true,
      workflowType: true,
      computedSignal: true,
      loadFactors: true,
      resourceFactors: true,
      riskMarkers: true
    },
    maxRecords,
    ...(Number(options.pageSize) > 0 ? { pageSize: Math.trunc(options.pageSize) } : {})
  });

  const sampleSize = new Set(records.map((record) => record.ownerUserId).filter(Boolean)).size;
  /* SOL-WB-04: ANALÜÜSIÜHIK on nüüd valik, mitte vaikimisi tekkinud tagajärg.
     `record` = iga sisestus loeb (sündmuspõhine trend); `latest_per_person` =
     üks inimene annab ühe hääle töövoo kohta, seega sada korda sisestanu ei
     määra enam kogu prioriteedijärjestust. Vaikeväärtus jääb senine, sest
     ühiku VALIK on omaniku oma (vt raporti KATMATA-lõiku) — aga ta on nüüd
     nähtav ja vahetatav ühest kohast. */
  const analysisUnit = String(options.analysisUnit || filters.analysisUnit || "record");
  const counted = analysisUnit === "latest_per_person" ? latestPerPerson(records) : records;
  const base = {
    schemaVersion: "1.0",
    scoringVersion: "aggregate-v1",
    generatedAt: (parseDate(options.now) || new Date()).toISOString(),
    filters: publicFilters(filters),
    minimumGroupSize,
    sampleSize,
    recordCount: records.length,
    analysisUnit,
    /* Mitu rida jõudis LOENDURITESSE — `recordCount` on endiselt kõik leitud
       read, et kärbe ja ühik ei segaks teineteist. */
    countedRecordCount: analysisUnit === "latest_per_person" ? latestPerPerson(records).length : records.length,
    /* SOL-WB-05: „poolik" on vastuse OMADUS, mitte kommentaar kuskil logis.
       Ilma selleta esitas kärbitud valim end täieliku juhtimisraportina. */
    truncated,
    ...(truncated ? { truncationReason: "record_limit", recordLimit: maxRecords } : {}),
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

  for (const record of counted) {
    increment(workflowCounts, record.workflowType);
    increment(signalCounts, normalizeSignal(record?.computedSignal?.signalLevel));
    for (const key of record.loadFactors || []) increment(demandCounts, key);
    for (const key of record.resourceFactors || []) increment(resourceCounts, key);
    for (const key of record.riskMarkers || []) increment(riskCounts, key);
  }

  return {
    ...base,
    metrics: [
      ...signalMetrics(signalCounts, counted.length, sampleSize, aggregationLevel),
      ...countMetrics("workflow", workflowCounts, sampleSize, aggregationLevel, counted.length),
      ...countMetrics("work_demand", demandCounts, sampleSize, aggregationLevel, counted.length),
      ...countMetrics("work_resource", resourceCounts, sampleSize, aggregationLevel, counted.length),
      ...countMetrics("risk_event", riskCounts, sampleSize, aggregationLevel, counted.length)
    ]
  };
}
