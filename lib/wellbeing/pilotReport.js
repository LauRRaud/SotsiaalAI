const priorityPrefixes = [
  { prefix: "work_demand.", category: "work_demand", label: "Töö nõudmine" },
  { prefix: "work_resource.", category: "work_resource", label: "Puuduv või ebaselge ressurss" },
  { prefix: "risk_event.", category: "risk_event", label: "Riskisündmus" }
];

const metricLabels = {
  "work_demand.documentation.high.count": "Dokumenteerimise koormus on kõrge",
  "work_demand.interruptions.high.count": "Katkestuste tase on kõrge",
  "work_demand.after_hours.high.count": "Töövälise kättesaadavuse surve on kõrge",
  "work_resource.support.unclear_or_missing.count": "Juhi või kolleegi tugi on ebaselge või puudub",
  "work_resource.priority_unclear.count": "Prioriteedid on ebaselged",
  "work_resource.processes.single_entry_needed.count": "Vaja on selgemat ühtset töövoogu",
  "risk_event.risk.difficult_case.count": "Märgitud on raske juhtumi koormus",
  "risk_event.risk.workplace_violence.count": "Märgitud on töövägivalla risk"
};

const recommendationRules = [
  {
    key: "documentation_simplification",
    match: "work_demand.documentation.high.count",
    title: "Lihtsustada dokumenteerimise töövoogu",
    description: "Vaadata üle dubleerivad sisestused, korduvad vormid ja kohad, kus sama info liigub mitmesse süsteemi."
  },
  {
    key: "support_clarity",
    match: "work_resource.support.unclear_or_missing.count",
    title: "Täpsustada toe ja eskalatsiooni kokkulepe",
    description: "Leppida kokku, millal juht, mentor või kolleeg tuleb appi ja milliseid juhtumeid ei kanta üksi."
  },
  {
    key: "interruption_agreement",
    match: "work_demand.interruptions.high.count",
    title: "Kokkuleppida fookusaeg ja suhtluskanalid",
    description: "Eristada kiireloomulised katkestused, edasilükatavad küsimused ja kanalid, mis ei lõhu süvenemist."
  },
  {
    key: "boundary_agreement",
    match: "work_demand.after_hours.high.count",
    title: "Täpsustada töövälise kättesaadavuse piirid",
    description: "Kirjeldada, mis on kriisierand, kuidas toimub asendus ja millal vastamist ei eeldata."
  },
  {
    key: "difficult_case_aftercare",
    match: "risk_event.risk.difficult_case.count",
    title: "Luua raske juhtumi järeltoe rutiin",
    description: "Leppida kokku 24 tunni järeltegevus, debrief ja tööjaotus emotsionaalselt koormavate juhtumite järel."
  }
];

function metricValue(metrics, key) {
  return Number(metrics.find((metric) => metric.metricKey === key)?.metricValue || 0);
}

function humanizeMetricKey(metricKey) {
  return String(metricKey || "")
    .replace(/\.count$/u, "")
    .replaceAll("_", " ")
    .replaceAll(".", " / ");
}

function classifyMetric(metricKey) {
  return priorityPrefixes.find((item) => String(metricKey || "").startsWith(item.prefix));
}

function priorityFromMetric(metric) {
  const classification = classifyMetric(metric.metricKey);
  if (!classification || !String(metric.metricKey || "").endsWith(".count")) return null;
  const count = Number(metric.metricValue || 0);
  if (count <= 0) return null;
  return {
    metricKey: metric.metricKey,
    category: classification.category,
    categoryLabel: classification.label,
    label: metricLabels[metric.metricKey] || humanizeMetricKey(metric.metricKey),
    count,
    sampleSize: Number(metric.sampleSize || 0)
  };
}

function buildRecommendedAgreements(metrics) {
  const metricKeys = new Set(metrics.filter((metric) => Number(metric.metricValue || 0) > 0).map((metric) => metric.metricKey));
  return recommendationRules
    .filter((rule) => metricKeys.has(rule.match))
    .map(({ key, title, description }) => ({ key, title, description }));
}

function buildExecutiveSummary({ suppressed, sampleSize, recordCount, minimumGroupSize, signal }) {
  if (suppressed) {
    return {
      statusLabel: "Valim liiga väike",
      tone: "suppressed",
      summary: `Valim ${sampleSize} on alla miinimumgrupi ${minimumGroupSize}; detailseid otsuseid ei tohiks sellest koondist teha.`
    };
  }

  const redCount = Number(signal?.redCount || 0);
  const yellowCount = Number(signal?.yellowCount || 0);
  const statusLabel = redCount > 0 || yellowCount > 0 ? "Tähelepanu vajav" : "Juhitav";
  return {
    statusLabel,
    tone: redCount > 0 ? "risk" : yellowCount > 0 ? "watch" : "stable",
    summary: `${sampleSize} töötaja ja ${recordCount} kirje põhjal on koondis ${statusLabel.toLowerCase()}: ${redCount} punast ja ${yellowCount} kollast signaali.`
  };
}

function buildDecisionSummary({ suppressed, sampleSize, minimumGroupSize, signal, priorities }) {
  if (suppressed) {
    return `Valim on alla miinimumgrupi ${minimumGroupSize}, seega kuvatakse ainult privaatsust kaitsev üldseis.`;
  }

  const firstPriority = priorities[0]?.label;
  const suffix = firstPriority ? ` Esimene arutelu fookus: ${firstPriority}.` : "";
  return `${sampleSize} töötaja koondis sisaldab ${Number(signal.redCount || 0)} punast ja ${Number(signal.yellowCount || 0)} kollast signaali.${suffix}`;
}

export function buildWellbeingPilotReport(dataset = {}) {
  const privacyNotice =
    "Aruanne ei sisalda üksiktöötajate vastuseid, vabatekste, kliendiandmeid ega väikese grupi detaile.";
  const base = {
    reportType: "wellbeing_pilot_report",
    generatedAt: dataset.generatedAt || null,
    sampleSize: Number(dataset.sampleSize || 0),
    recordCount: Number(dataset.recordCount || 0),
    minimumGroupSize: Number(dataset.minimumGroupSize || 0),
    privacyNotice,
    status: dataset.suppressed ? "suppressed" : "open",
    signal: {
      redCount: 0,
      yellowCount: 0,
      greenCount: 0
    },
    priorities: [],
    recommendedAgreements: [],
    executiveSummary: null,
    decisionSummary: "",
    decisionFocus: [],
    primaryRecommendation: null
  };

  if (dataset.suppressed) {
    return {
      ...base,
      executiveSummary: buildExecutiveSummary({
        suppressed: true,
        sampleSize: base.sampleSize,
        recordCount: base.recordCount,
        minimumGroupSize: base.minimumGroupSize,
        signal: base.signal
      }),
      decisionSummary: buildDecisionSummary({
        suppressed: true,
        sampleSize: base.sampleSize,
        minimumGroupSize: base.minimumGroupSize,
        signal: base.signal,
        priorities: []
      })
    };
  }

  const metrics = Array.isArray(dataset.metrics) ? dataset.metrics : [];
  const priorities = metrics
    .map(priorityFromMetric)
    .filter(Boolean)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const signal = {
    redCount: metricValue(metrics, "signal.red.count"),
    yellowCount: metricValue(metrics, "signal.yellow.count"),
    greenCount: metricValue(metrics, "signal.green.count")
  };
  const recommendedAgreements = buildRecommendedAgreements(metrics);

  return {
    ...base,
    signal,
    priorities,
    recommendedAgreements,
    executiveSummary: buildExecutiveSummary({
      suppressed: false,
      sampleSize: base.sampleSize,
      recordCount: base.recordCount,
      minimumGroupSize: base.minimumGroupSize,
      signal
    }),
    decisionSummary: buildDecisionSummary({
      suppressed: false,
      sampleSize: base.sampleSize,
      minimumGroupSize: base.minimumGroupSize,
      signal,
      priorities
    }),
    decisionFocus: priorities.slice(0, 3).map((priority) => priority.label),
    primaryRecommendation: recommendedAgreements[0]
      ? {
          title: recommendedAgreements[0].title,
          description: recommendedAgreements[0].description
        }
      : null
  };
}
