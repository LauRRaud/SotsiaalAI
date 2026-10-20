import { SUPPORT_MEASURE_LABELS, lowerFirstLabel, supportMeasureGapKey } from "./supportMeasureCatalog.js";

const priorityPrefixes = [
  { prefix: "work_demand.", category: "work_demand", label: "Töö nõudmine" },
  { prefix: "work_resource.", category: "work_resource", label: "Puuduv või ebaselge ressurss" },
  { prefix: "risk_event.", category: "risk_event", label: "Riskisündmus" }
];

const supportMeasureGapMetric = (value) => `work_resource.${supportMeasureGapKey(value)}.count`;

/* „Võimaldab × vajan" (TÜ võrdlus ptk 8.2 p 4): koondi tegur ütleb „vajan, aga minu
   teada ei ole". Kui piloot on asutuse oma ja asutus on oma meetmed kirjeldanud
   (`OrganizationSupportMeasure`), saab sellest kaks eri asja: asutus pakub, aga
   vajajad ei tea (teavitus), või asutus ei paku (puuduv meede). Asutuse kirjeldus on
   asutuse enda andmestik, mitte töötaja vastus — risti pannakse ainult avaldatud
   (k-läve ületanud) lahtrid. */
const GAP_METRIC_PREFIX = "work_resource.measures.gap.";

function gapMeasureOf(metricKey) {
  const key = String(metricKey || "");
  if (!key.startsWith(GAP_METRIC_PREFIX) || !key.endsWith(".count")) return null;
  const value = key.slice(GAP_METRIC_PREFIX.length, -".count".length);
  return SUPPORT_MEASURE_LABELS[value] ? value : null;
}

function measureList(values) {
  return values.map((value) => lowerFirstLabel(SUPPORT_MEASURE_LABELS[value])).join(", ");
}

const metricLabels = {
  /* „Minu tugivõimalused": meede, mida vajatakse, aga mida töötaja teada ei ole. */
  ...Object.fromEntries(
    Object.entries(SUPPORT_MEASURE_LABELS).map(([value, label]) => [supportMeasureGapMetric(value), `Vajatakse, aga ei ole kättesaadav: ${label}`])
  ),
  "work_demand.documentation.high.count": "Dokumenteerimise koormus on kõrge",
  "work_demand.interruptions.high.count": "Katkestuste tase on kõrge",
  "work_demand.after_hours.high.count": "Töövälise kättesaadavuse surve on kõrge",
  "work_resource.support.unclear_or_missing.count": "Juhi või kolleegi tugi on ebaselge või puudub",
  "work_resource.support.manager_unclear_or_missing.count": "Juhi tugi on ebaselge või puudub",
  "work_resource.support.colleague_unclear_or_missing.count": "Kolleegide tugi on ebaselge või puudub",
  "work_resource.meaning.low.count": "Töö tähenduslikkuse tunne on madal",
  "work_resource.recovery.detachment_low.count": "Töö tuleb sageli vabasse aega kaasa",
  "work_demand.recovery.end_of_day_exhaustion.count": "Tööpäeva lõpuks sageli vaimselt kurnatud",
  "work_demand.processes.tools_not_working.count": "Töövahendid takistavad tööd",
  "work_demand.processes.workspace_unsuitable.count": "Füüsiline töökeskkond ei toeta tööd",
  "work_demand.boundaries.overtime_regular.count": "Ületunnid on regulaarsed",
  "work_resource.boundaries.overtime_uncompensated.count": "Ületunnid ei ole täielikult hüvitatud",
  "work_resource.boundaries.flexibility_missing.count": "Paindlik tööaeg ei ole võimalik",
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
    /* Kiirkontroll 1.1 annab juhi ja kolleegide toe eraldi; 1.0 kirjetes on ühine võti. */
    match: [
      "work_resource.support.unclear_or_missing.count",
      "work_resource.support.manager_unclear_or_missing.count",
      "work_resource.support.colleague_unclear_or_missing.count"
    ],
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
    /* Taastumise 1.1 eemaldumise märk osutab samale kokkuleppele. */
    match: ["work_demand.after_hours.high.count", "work_resource.recovery.detachment_low.count"],
    title: "Täpsustada töövälise kättesaadavuse piirid",
    description: "Kirjeldada, mis on kriisierand, kuidas toimub asendus ja millal vastamist ei eeldata."
  },
  /* Kolm järgmist järgivad TLÜ 2024 uuringu soovitusi 1 (paindlikkus, ületundide
     hüvitamine) ja töökeskkonna osa (töövahendid, ruumid). */
  {
    key: "overtime_compensation",
    match: ["work_demand.boundaries.overtime_regular.count", "work_resource.boundaries.overtime_uncompensated.count"],
    title: "Teha ületunnid nähtavaks ja hüvitada",
    description: "Leppida kokku ületundide arvestus ning hüvitamine rahas või vaba ajana; vaadata üle tööjaotus, kui ületunnid korduvad."
  },
  {
    key: "flexible_work",
    match: "work_resource.boundaries.flexibility_missing.count",
    title: "Kaaluda paindlikku tööaega",
    description: "Vaadata üle, kus klienditöö lubab tööaega või -kohta paindlikumaks muuta, ja leppida kokku selged reeglid."
  },
  {
    key: "support_measures",
    match: Object.keys(SUPPORT_MEASURE_LABELS).map(supportMeasureGapMetric),
    title: "Teha tugimeetmed nähtavaks ja kättesaadavaks",
    description: "Teavitada töötajaid olemasolevatest tugimeetmetest ja leppida kokku, milliseid vajatud, kuid puuduvaid meetmeid saab pakkuda."
  },
  {
    key: "tools_and_workspace",
    match: ["work_demand.processes.tools_not_working.count", "work_demand.processes.workspace_unsuitable.count"],
    title: "Vaadata üle töövahendid ja ruumid",
    description: "Kontrollida, kas arvutid, telefonid, transport ja vestlusruumid võimaldavad tööd teha, sh privaatset vestlust kliendiga."
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

/* SOL-WB-06 saba: summutatud lahtri puudumine EI ole null. Vana `metricValue`
   andis puuduva rea eest `0` ja aruanne oleks öelnud „0 punast signaali" seal,
   kus tegelik arv oli 1–4 ja kinni pandud — täpselt see vaikimine, mille vastu
   summutus üldse käib. Teadmata arv on `null` ja ta ütleb ennast sõnadega
   välja. */
function readCellSuppression(dataset) {
  const summary = dataset?.cellSuppression;
  const families = Array.isArray(summary?.families) ? summary.families : [];
  const signalFamily = families.find((family) => family.family === "signal");
  return {
    withheldCellCount: Number(summary?.withheldCellCount || 0),
    withheldFamilies: families.map((family) => family.family),
    withheldSignals: new Set(signalFamily?.withheldKeys || [])
  };
}

function signalCount(metrics, signal, withheldSignals) {
  if (withheldSignals.has(signal)) return null;
  return metricValue(metrics, `signal.${signal}.count`);
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

/** Mõõdiku silt; tugimeetme puudujääk saab asutuse kirjelduse korral täpsema sildi. */
function metricLabelOf(metricKey, offered) {
  const measure = offered ? gapMeasureOf(metricKey) : null;
  if (measure) {
    return offered.has(measure)
      ? `Vajatakse; asutus pakub, aga vajajad ei tea sellest: ${SUPPORT_MEASURE_LABELS[measure]}`
      : `Vajatakse; asutus ei paku: ${SUPPORT_MEASURE_LABELS[measure]}`;
  }
  return metricLabels[metricKey] || humanizeMetricKey(metricKey);
}

function priorityFromMetric(metric, offered = null) {
  const classification = classifyMetric(metric.metricKey);
  if (!classification || !String(metric.metricKey || "").endsWith(".count")) return null;
  const count = Number(metric.metricValue || 0);
  if (count <= 0) return null;
  return {
    metricKey: metric.metricKey,
    category: classification.category,
    categoryLabel: classification.label,
    label: metricLabelOf(metric.metricKey, offered),
    count,
    sampleSize: Number(metric.sampleSize || 0),
    /* SOL-WB-04: osakaalu nimetaja on SAMA ühik mis lugejal. Varem jagati
       kirjete arv inimeste arvuga ja tulemus võis ületada 100%. */
    denominator: Number(metric.denominator || metric.sampleSize || 0)
  };
}

/* Asutuse kirjelduse korral asendub üldine tugimeetmete soovitus kahe täpsemaga. */
function supportMeasureAgreements(metricKeys, offered) {
  const gaps = Object.keys(SUPPORT_MEASURE_LABELS).filter((value) => metricKeys.has(supportMeasureGapMetric(value)));
  const unaware = gaps.filter((value) => offered.has(value));
  const missing = gaps.filter((value) => !offered.has(value));
  return [
    ...(unaware.length
      ? [{
          key: "support_measures_awareness",
          title: "Teavitada töötajaid olemasolevatest tugimeetmetest",
          description: `Asutus pakub neid meetmeid, aga neid vajavad töötajad ei tea sellest: ${measureList(unaware)}. Tutvustage meetmeid ja kontrollige, kas kasutamise juhis on selge.`
        }]
      : []),
    ...(missing.length
      ? [{
          key: "support_measures_missing",
          title: "Kaaluda puuduvate tugimeetmete pakkumist",
          description: `Neid meetmeid vajatakse, aga asutus neid ei paku: ${measureList(missing)}. Leppige kokku, mida saab pakkuda või millega asendada.`
        }]
      : [])
  ];
}

function buildRecommendedAgreements(metrics, offered = null) {
  const metricKeys = new Set(metrics.filter((metric) => Number(metric.metricValue || 0) > 0).map((metric) => metric.metricKey));
  return recommendationRules
    .filter((rule) => [rule.match].flat().some((key) => metricKeys.has(key)))
    .flatMap(({ key, title, description }) =>
      key === "support_measures" && offered ? supportMeasureAgreements(metricKeys, offered) : [{ key, title, description }]
    );
}

function buildExecutiveSummary({ suppressed, sampleSize, recordCount, minimumGroupSize, signal }) {
  if (suppressed) {
    return {
      statusLabel: "Valim liiga väike",
      tone: "suppressed",
      summary: `Valim ${sampleSize} on alla miinimumgrupi ${minimumGroupSize}; detailseid otsuseid ei tohiks sellest koondist teha.`
    };
  }

  const redCount = signal?.redCount ?? null;
  const yellowCount = signal?.yellowCount ?? null;
  /* Teadmata signaal EI ole rahulik signaal. `null > 0` on väär, seega
     tähelepanu tuleb ainult TEADAOLEVAST arvust — aga „Juhitav" nõuab, et
     mõlemad oleksid teada. Muidu ütleks aruanne rahu seal, kus ta lihtsalt ei
     näe. */
  const attention = redCount > 0 || yellowCount > 0;
  const unknown = redCount === null || yellowCount === null;
  const statusLabel = attention ? "Tähelepanu vajav" : unknown ? "Osaliselt avaldamata" : "Juhitav";
  const known = [
    redCount === null ? null : `${redCount} punast`,
    yellowCount === null ? null : `${yellowCount} kollast`
  ].filter(Boolean);
  const signalSentence = known.length > 0
    ? `${known.join(" ja ")} signaali`
    : "signaalijaotus on avaldamata";
  const unknownSuffix = unknown
    ? " Osa signaalilahtreid jäi väiksuse tõttu avaldamata, seega puuduv arv ei tähenda nulli."
    : "";
  return {
    statusLabel,
    tone: redCount > 0 ? "risk" : yellowCount > 0 ? "watch" : unknown ? "incomplete" : "stable",
    summary: `${sampleSize} töötaja ja ${recordCount} kirje põhjal on koondis ${statusLabel.toLowerCase()}: ${signalSentence}.${unknownSuffix}`
  };
}

function buildDecisionSummary({ suppressed, sampleSize, minimumGroupSize, signal, priorities }) {
  if (suppressed) {
    return `Valim on alla miinimumgrupi ${minimumGroupSize}, seega kuvatakse ainult privaatsust kaitsev üldseis.`;
  }

  const firstPriority = priorities[0]?.label;
  const suffix = firstPriority ? ` Esimene arutelu fookus: ${firstPriority}.` : "";
  if (signal.redCount === null || signal.yellowCount === null) {
    return `${sampleSize} töötaja koondis: osa signaalilahtreid on väiksuse tõttu avaldamata, seega punase ja kollase arvu siit lugeda ei saa.${suffix}`;
  }
  return `${sampleSize} töötaja koondis sisaldab ${signal.redCount} punast ja ${signal.yellowCount} kollast signaali.${suffix}`;
}

/* SOL-WB-04: ühik ei tohi elada ainult JSON-andmestikus. Aruande loomulik keel
   („N töötajast X-l on punane signaal") loeb lugejale ALATI inimeste osakaaluna,
   ükskõik kumb ühik tegelikult kehtib — seega peab ühik olema aruande enda peal
   sõnadega väljas, mitte tuletatav. Sama tekst läheb kaasa ka eksportidesse. */
export const WELLBEING_ANALYSIS_UNIT_LABELS = Object.freeze({
  record: "kirje (iga sisestus loeb)",
  latest_per_person: "inimene (üks kirje inimese ja töövoo kohta)"
});

export function describeAnalysisUnit(analysisUnit) {
  if (analysisUnit === "latest_per_person") {
    return (
      "Analüüsiühik on INIMENE: arvesse läheb üks, kõige värskem kirje inimese ja " +
      "töövoo kohta. Arvud näitavad inimeste seisu, mitte sisestuste sagedust. Sama " +
      "inimene võib esineda mitmes töövoos, seega ta ei ole tingimata üks kirje kogu " +
      "aruande peale."
    );
  }
  return (
    "Analüüsiühik on KIRJE: iga sisestus loeb eraldi. Arvud näitavad sündmuste " +
    "sagedust, mitte inimeste osakaalu — üks väga aktiivne vastaja võib " +
    "prioriteedijärjestuse üksi paika panna."
  );
}

/**
 * `offeredMeasures`: asutuse kirjeldatud tugimeetmete võtmed, kui piloot on asutuse
 * oma ja asutus on meetmed kirjeldanud; muidu null (tugimeetmete puudujääk jääb
 * töötaja teadmise põhiseks, nagu enne).
 */
export function buildWellbeingPilotReport(dataset = {}, { offeredMeasures = null } = {}) {
  const offered = Array.isArray(offeredMeasures) && offeredMeasures.length ? new Set(offeredMeasures) : null;
  const privacyNotice =
    "Aruanne ei sisalda üksiktöötajate vastuseid, vabatekste, kliendiandmeid ega väikese grupi detaile.";
  /* SOL-WB-05: kärbe peab jõudma RAPORTINI, mitte jääma andmestiku külge.
     Juhtimisotsus tehakse selle teksti, mitte JSON-i pealt. */
  const truncated = Boolean(dataset.truncated);
  const analysisUnit =
    dataset.analysisUnit === "latest_per_person" ? "latest_per_person" : "record";
  const base = {
    reportType: "wellbeing_pilot_report",
    generatedAt: dataset.generatedAt || null,
    sampleSize: Number(dataset.sampleSize || 0),
    recordCount: Number(dataset.recordCount || 0),
    /* Nimetaja, mille peal osakaalud tegelikult arvutatakse. `recordCount` on
       kõigi leitud ridade arv ja need kaks lahknevad `latest_per_person` all —
       just see vahe tegi vanast reast „100/3" 3333%. */
    countedRecordCount: Number(dataset.countedRecordCount || 0),
    analysisUnit: analysisUnit,
    analysisUnitLabel: WELLBEING_ANALYSIS_UNIT_LABELS[analysisUnit] || analysisUnit,
    analysisUnitNotice: describeAnalysisUnit(analysisUnit),
    minimumGroupSize: Number(dataset.minimumGroupSize || 0),
    truncated,
    ...(truncated
      ? {
        completenessNotice:
            "Koond tabas kaitsepiiri ja EI SISALDA kõiki perioodi kirjeid. Arvud on alampiirid; ära tee neist osakaalu- ega võrdlusotsuseid enne, kui periood või filter on kitsam."
      }
      : {}),
    privacyNotice,
    /* Mille põhjal on tugimeetmete puudujääk hinnatud. */
    supportMeasuresBasis: offered ? "organization" : "worker_knowledge",
    status: dataset.suppressed ? "suppressed" : "open",
    signal: {
      redCount: 0,
      yellowCount: 0,
      greenCount: 0,
      withheldKeys: []
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
  const suppression = readCellSuppression(dataset);
  const priorities = metrics
    .map((metric) => priorityFromMetric(metric, offered))
    .filter(Boolean)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const signal = {
    redCount: signalCount(metrics, "red", suppression.withheldSignals),
    yellowCount: signalCount(metrics, "yellow", suppression.withheldSignals),
    greenCount: signalCount(metrics, "green", suppression.withheldSignals),
    withheldKeys: [...suppression.withheldSignals]
  };
  const recommendedAgreements = buildRecommendedAgreements(metrics, offered);
  const hasMeasureGaps = metrics.some((metric) => gapMeasureOf(metric.metricKey) && Number(metric.metricValue || 0) > 0);
  const supportMeasuresNotice = !hasMeasureGaps
    ? null
    : offered
      ? `Tugimeetmete puudujäägid on võrreldud asutuse enda kirjeldusega (${offered.size} ${offered.size === 1 ? "meede" : "meedet"}): „asutus pakub, aga vajajad ei tea“ on teavituse küsimus, „asutus ei paku“ on puuduv meede.`
      : "Tugimeetmete puudujääk tähendab, et töötaja vajab meedet ja tema teada seda ei ole. Asutus ei ole oma meetmeid kirjeldanud, seega ei saa siit eristada teadmatust ja puuduvat meedet.";

  return {
    ...base,
    signal,
    /* SOL-WB-06 saba: prioriteedid ja kokkuleppesoovitused sünnivad AVALDATUD
       lahtritest, seega summutatud rühm ei jõua siia kunagi. Ilma selle
       lauseta loeks juht lühikest prioriteedinimekirja „muud muret ei ole"
       vastuseks. */
    cellSuppression: {
      withheldCellCount: suppression.withheldCellCount,
      families: suppression.withheldFamilies
    },
    ...(suppression.withheldCellCount > 0
      ? {
        cellSuppressionNotice:
            `Väikesed lahtrid on privaatsuse tõttu avaldamata (miinimumgrupp ${base.minimumGroupSize}); ` +
            "puuduv rida EI tähenda nulli. Kui üks lahter jäi kinni, läks kinni ka teine, " +
            "et esimest ei saaks üldsummast lahutades tagasi arvutada — seega ka mõni suur " +
            "rühm võib olla varjatud."
      }
      : {}),
    priorities,
    recommendedAgreements,
    ...(supportMeasuresNotice ? { supportMeasuresNotice } : {}),
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
