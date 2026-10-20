import { PILOT_STRENGTH_THEMES, PILOT_THEMES, humanizeMetricKey, pilotFactorEntry } from "./pilotFactorCatalog.js";
import { WELLBEING_STRENGTH_SOURCES } from "./strengths.js";
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

const demand = (key) => `work_demand.${key}.count`;
const resource = (key) => `work_resource.${key}.count`;
const risk = (key) => `risk_event.${key}.count`;

/* Iga koondi tegur (`pilotFactorCatalog.js`) viib vähemalt ühe kokkuleppeni:
   enne 20.10 oli soovitus ainult kaheksal teemal ja sagedasimad tegurid (töömaht,
   taastumine, emotsionaalne koormus) jäid ilma. Kokkulepped reastatakse tõendi
   järgi (suurim avaldatud lahter), et esimene kokkulepe vastaks esimesele
   fookusele; viigi korral kehtib see järjekord, ohutus enne töökorraldust. */
const recommendationRules = [
  {
    key: "violence_prevention",
    match: [
      risk("risk.workplace_violence"),
      demand("risk.workplace_violence"),
      ...["workplace", "aggression", "threat", "threatening_message", "physical_danger", "repeated_harassment", "insult_or_humiliation", "stalking_or_intimidation", "lone_work_risk"].map((value) => demand(`violence.${value}`)),
      demand("work_impact.elevated"),
      demand("safety_impact.present"),
      resource("safety.agreement_needed"),
      resource("documentation.needs_neutral_record"),
      ...["danger_ongoing", "danger_uncertain", "physical_danger", "threat", "safety_impact_high"].map((value) => risk(`workplace_violence.${value}`))
    ],
    title: "Vaadata üle töövägivalla ennetus ja järeltugi",
    description: "Kontrollida, kas töötajad teavad, kuidas juhtumist teatada, kes toetab pärast juhtumit ja millised turvameetmed on kasutusel (nt kodukülastus paaris, ohuteabe jagamine). Kliendi vägivalla oht kuulub töökeskkonna riskianalüüsi."
  },
  {
    key: "difficult_case_aftercare",
    match: [
      risk("risk.difficult_case"),
      demand("risk.difficult_case"),
      demand("case.difficult"),
      ...["emotional_load", "ethical_tension", "moral_distress", "role_conflict", "trauma_exposure", "workload_followup"].map((value) => demand(`hard_case.load.${value}`)),
      resource("support.do_not_carry_alone"),
      ...["immediate_danger", "immediate_danger_uncertain", "should_not_carry_alone"].map((value) => risk(`hard_case.${value}`))
    ],
    title: "Luua raske juhtumi järeltoe rutiin",
    description: "Leppida kokku 24 tunni järeltegevus, debrief ja tööjaotus emotsionaalselt koormavate juhtumite järel."
  },
  {
    key: "workload_review",
    match: [
      demand("workload.high"),
      demand("case_complexity.high"),
      risk("recovery.none_with_critical_workload"),
      risk("processes.unfinished_work_accumulates"),
      risk("processes.high_value_loss")
    ],
    title: "Vaadata üle töömaht ja juhtumite jaotus",
    description: "Kaardistada, kus töömaht ületab tööaja, ja leppida kokku juhtumite jaotus, keerukate juhtumite arv inimese kohta ning see, mis lükkub edasi või jääb tegemata."
  },
  {
    key: "recovery_protection",
    match: [
      resource("recovery.low_or_none"),
      resource("recovery.follow_up_needed"),
      demand("recovery.end_of_day_exhaustion"),
      risk("recovery.low_capacity_72h"),
      risk("recovery.no_recovery_with_low_capacity"),
      risk("boundaries.no_pause_protection"),
      risk("interruptions.recovery_impact_high")
    ],
    title: "Kaitsta pause ja taastumist",
    description: "Leppida kokku tööpäeva pausid ja vaikne aeg, koormavate päevade järel taastumisaeg ning see, kuidas tööd ümber jagatakse, kui kellegi töövõime on madal."
  },
  {
    key: "emotional_support",
    match: [
      demand("emotional_load.high"),
      demand("ethical_tension.elevated"),
      demand("moral_distress.present"),
      demand("trauma.exposure"),
      demand("role_boundaries.ethical_complexity_high"),
      risk("role_boundaries.ethical_tension"),
      risk("hard_case.direct_trauma_exposure"),
      risk("hard_case.high_ethical_tension")
    ],
    title: "Tagada regulaarne supervisioon või kovisioon",
    description: "Emotsionaalselt ja eetiliselt koormav töö vajab regulaarset arutelu. Leppida kokku supervisiooni või kovisiooni sagedus ja see, kuidas sinna pääseb ka kiirel ajal."
  },
  {
    key: "support_clarity",
    /* Kiirkontroll 1.1 annab juhi ja kolleegide toe eraldi; 1.0 kirjetes on ühine võti. */
    match: [
      resource("support.unclear_or_missing"),
      resource("support.manager_unclear_or_missing"),
      resource("support.colleague_unclear_or_missing"),
      resource("support.manager"),
      resource("support.colleague"),
      resource("support.supervisor")
    ],
    title: "Täpsustada toe ja eskalatsiooni kokkulepe",
    description: "Leppida kokku, millal juht, mentor või kolleeg tuleb appi ja milliseid juhtumeid ei kanta üksi."
  },
  {
    key: "starter_support",
    match: [
      ...["missing_support", "cases_not_carry_alone", "role_uncertainty", "documentation_uncertainty"].map((value) => demand(`starter_support.${value}`)),
      ...["mentor_needed", "manager_check_needed", "boundary_plan_needed", "covision_needed"].map((value) => resource(`starter_support.${value}`)),
      ...["early_role_uncertainty", "not_to_carry_alone", "support_agreement_needed_soon"].map((value) => risk(`starter_support.${value}`))
    ],
    title: "Kindlustada uue töötaja sisseelamise tugi",
    description: "Määrata mentor, leppida kokku juhi regulaarsed kohtumised esimestel kuudel ja juhtumid, mida alustaja üksi ei kanna."
  },
  {
    key: "role_clarity",
    match: [
      resource("clarity.unclear"),
      demand("clarity.unclear"),
      resource("role.clarity_partial_or_unclear"),
      resource("processes.owner_clarity_needed"),
      demand("role_boundaries.role_conflict_high"),
      demand("role_boundaries.role_conflict_moderate"),
      demand("interruptions.role_boundary"),
      resource("role_boundaries.manager_discussion_needed"),
      resource("role_boundaries.shared_responsibility_needed"),
      risk("role_boundaries.responsibility_shift")
    ],
    title: "Täpsustada prioriteedid, rollid ja vastutus",
    description: "Leppida kokku, mis on esmatähtis, mida võib edasi lükata, kes mille eest vastutab ja kes otsustab, kui kõike korraga teha ei jõua."
  },
  {
    key: "decision_participation",
    match: resource("decision_control.low"),
    title: "Kaasata töötajad töökorralduse otsustesse",
    description: "Leppida kokku, millistes töökorralduse küsimustes töötajad kaasa räägivad (nt juhtumite jaotus, tööajad, töövahendid) ja kuidas nende ettepanekutele vastatakse."
  },
  {
    key: "boundary_agreement",
    /* Taastumise 1.1 eemaldumise märk osutab samale kokkuleppele. */
    match: [
      demand("after_hours.impact"),
      resource("recovery.detachment_low"),
      risk("boundaries.after_hours_unclear"),
      resource("support.replacement_unclear"),
      demand("role_boundaries.availability_pressure_high")
    ],
    title: "Täpsustada töövälise kättesaadavuse piirid",
    description: "Kirjeldada, mis on kriisierand, kuidas toimub asendus ja millal vastamist ei eeldata."
  },
  /* Kaks järgmist ja töövahendid järgivad TLÜ 2024 uuringu soovitusi 1
     (paindlikkus, ületundide hüvitamine) ja töökeskkonna osa. */
  {
    key: "overtime_compensation",
    match: [demand("boundaries.overtime_regular"), resource("boundaries.overtime_uncompensated")],
    title: "Teha ületunnid nähtavaks ja hüvitada",
    description: "Leppida kokku ületundide arvestus ning hüvitamine rahas või vaba ajana; vaadata üle tööjaotus, kui ületunnid korduvad."
  },
  {
    key: "flexible_work",
    match: resource("boundaries.flexibility_missing"),
    title: "Kaaluda paindlikku tööaega",
    description: "Vaadata üle, kus klienditöö lubab tööaega või -kohta paindlikumaks muuta, ja leppida kokku selged reeglid."
  },
  {
    key: "interruption_agreement",
    match: [
      demand("interruptions.high"),
      ...["high_frequency", "work_impact", "wrong_channel"].map((value) => demand(`interruptions.${value}`)),
      risk("interruptions.very_frequent"),
      risk("interruptions.many_can_wait"),
      resource("focus_time.agreement_needed"),
      resource("channels.agreement_needed"),
      resource("urgency.criteria_unclear")
    ],
    title: "Kokkuleppida fookusaeg ja suhtluskanalid",
    description: "Eristada kiireloomulised katkestused, edasilükatavad küsimused ja kanalid, mis ei lõhu süvenemist."
  },
  {
    key: "documentation_simplification",
    match: [
      demand("documentation.high"),
      demand("interruptions.documentation_system"),
      ...["duplicate_entry", "documentation_load", "repetitive_tasks", "switching_load_high"].map((value) => demand(`processes.${value}`)),
      risk("processes.duplicate_documentation_high"),
      resource("process.documentation_simplification_needed"),
      resource("processes.single_entry_needed")
    ],
    title: "Lihtsustada dokumenteerimise töövoogu",
    description: "Vaadata üle dubleerivad sisestused, korduvad vormid ja kohad, kus sama info liigub mitmesse süsteemi."
  },
  {
    key: "information_flow",
    match: [
      demand("processes.information_search"),
      demand("processes.waiting"),
      resource("processes.shared_status_view_needed"),
      resource("processes.information_flow_needed")
    ],
    title: "Teha juhtumi seis ja info ühiselt nähtavaks",
    description: "Leppida kokku, kus on juhtumi ühine seis, kes on iga sammu omanik ja kust infot otsida, et seda ei peaks küsima ega ootama."
  },
  {
    key: "partner_roles",
    match: [
      demand("interruptions.partner_process"),
      demand("role_boundaries.partner_explanation_needed"),
      resource("role_boundaries.partner_clarification_needed"),
      risk("role_boundaries.partner_responsibility_gap")
    ],
    title: "Täpsustada koostööpartneritega rollid ja infovahetus",
    description: "Leppida partneritega kokku, kes mida teeb, kuidas infot vahetatakse ja kuhu pöördutakse, kui vastutus jääb kahe asutuse vahele."
  },
  {
    key: "tools_and_workspace",
    match: [demand("processes.tools_not_working"), demand("processes.workspace_unsuitable")],
    title: "Vaadata üle töövahendid ja ruumid",
    description: "Kontrollida, kas arvutid, telefonid, transport ja vestlusruumid võimaldavad tööd teha, sh privaatset vestlust kliendiga."
  },
  {
    key: "support_measures",
    match: Object.keys(SUPPORT_MEASURE_LABELS).map(supportMeasureGapMetric),
    title: "Teha tugimeetmed nähtavaks ja kättesaadavaks",
    description: "Teavitada töötajaid olemasolevatest tugimeetmetest ja leppida kokku, milliseid vajatud, kuid puuduvaid meetmeid saab pakkuda."
  },
  {
    key: "meaning_recognition",
    match: resource("meaning.low"),
    title: "Arutada töö mõtet ja tunnustamist",
    description: "Uurida meeskonnaga, mis tööst annab kõige rohkem väärtust ja mis seda segab, ning leppida kokku, kuidas tehtud tööd märgatakse ja tunnustatakse."
  }
];

/* „Mis toimib" (ideed 21.2, arendusettepanek ptk 8.19): koondi pere
   `work_strength.*`. Sildid on kolmandas isikus, sest lugeja on asutus; töötaja
   Ülevaate sildid (`displayLabels.js`) on minavormis. Tugevus ei ole prioriteet
   ega muuda soovitusi. */
const STRENGTH_METRIC_PREFIX = "work_strength.";

const strengthLabels = {
  recovery: "Taastumine on piisav",
  decision_control: "Oma töö üle saab otsustada",
  priorities_clear: "Prioriteedid on selged",
  boundaries_clear: "Tööpiirid on selged",
  manager_support: "Juhi tugi on kättesaadav",
  colleague_support: "Kolleegide tugi on kättesaadav",
  work_meaning: "Tööl on mõte",
  flexible_hours: "Paindlik tööaeg on võimalik",
  support_in_use: "Vajatud tugimeetmed on olemas"
};

const strengthSourceLabels = {
  "quick-check": "kiirkontroll",
  "weekly-reflection": "nädala peegeldus",
  "work-boundaries": "tööpiirid",
  "support-measures": "minu tugivõimalused"
};

function strengthKeyOf(metricKey) {
  const key = String(metricKey || "");
  if (!key.startsWith(STRENGTH_METRIC_PREFIX) || !key.endsWith(".count")) return null;
  const strength = key.slice(STRENGTH_METRIC_PREFIX.length, -".count".length);
  return WELLBEING_STRENGTH_SOURCES[`strength.${strength}`] ? strength : null;
}

/* Lähtetöövoogude ühikute arv tuleb AINULT juba avaldatud töövoo arvudest: kui
   mõni töövoo lahter on kinni, ei tea aruanne, kas puuduv töövoog on null või
   summutatud, ja jätab arvu ära. Uut arvu, mille kaudu summutatud lahter tagasi
   tuleks, siin ei teki. Vanade kirjete korral (tugevused arvutamata) oleks
   osakaal alahinnatud, seega ka siis arvu ei ole. */
function strengthSourceTotal(strength, metrics, dataset, suppression) {
  if (dataset.strengthCoverage !== "complete" || suppression.withheldFamilies.includes("workflow")) return null;
  return WELLBEING_STRENGTH_SOURCES[`strength.${strength}`].reduce(
    (total, workflowType) => total + metricValue(metrics, `workflow.${workflowType}.count`),
    0
  );
}

function buildStrengths(metrics, dataset, suppression) {
  return metrics
    .map((metric) => {
      const strength = strengthKeyOf(metric.metricKey);
      const count = Number(metric.metricValue || 0);
      if (!strength || count <= 0) return null;
      return {
        metricKey: metric.metricKey,
        key: strength,
        label: strengthLabels[strength] || humanizeMetricKey(metric.metricKey),
        count,
        sourceTotal: strengthSourceTotal(strength, metrics, dataset, suppression),
        sourceLabel: WELLBEING_STRENGTH_SOURCES[`strength.${strength}`]
          .map((workflowType) => strengthSourceLabels[workflowType] || workflowType)
          .join(", ")
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "et"));
}

function buildStrengthsNotice(strengths, dataset) {
  const partial = dataset.strengthCoverage === "partial"
    ? " Osa perioodi kirjetest on salvestatud enne, kui tugevusi hakati koondi jaoks salvestama; neid tugevuste arvus ei ole."
    : "";
  if (!strengths.length) {
    return "Selgelt toimivaid ressursse ei ole avaldatud. See ei tähenda, et neid ei ole: lahtrid võivad olla väiksuse tõttu avaldamata." + partial;
  }
  return (
    "Mis toimib näitab ainult selgelt positiivseid vastuseid (nt tugi „kättesaadav“, mitte „osaline“). " +
    "Puuduv rida ei tähenda, et see ei toimi: lahter jääb avaldamata, kui see on väike või kui teisiti " +
    "vastanute rühm on väike." + partial
  );
}

/* Teemade kaupa (`pilotFactorCatalog.js`): kõik avaldatud tegurilahtrid, mitte
   ainult kuus suurimat prioriteeti, ja tugevused sama teema all. Uut arvu ei
   teki, rühmitatakse ainult avaldatud lahtreid. Kataloogist puuduv tegur läheb
   teema „Muu“ alla, et ta vaikselt ei kaoks. */
const OTHER_THEME = { key: "other", label: "Muu", scope: "tegurid, millel ei ole veel teemat" };

function buildThemes(metrics, strengths, offered) {
  const concerns = new Map();
  for (const metric of metrics) {
    const item = priorityFromMetric(metric, offered);
    if (!item) continue;
    const theme = pilotFactorEntry(metric.metricKey)?.theme || OTHER_THEME.key;
    if (!concerns.has(theme)) concerns.set(theme, []);
    concerns.get(theme).push(item);
  }
  return [...PILOT_THEMES, OTHER_THEME]
    .map((theme) => ({
      key: theme.key,
      label: theme.label,
      scope: theme.scope,
      concerns: (concerns.get(theme.key) || []).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "et")),
      strengths: strengths.filter((item) => PILOT_STRENGTH_THEMES[item.key] === theme.key)
    }))
    .filter((theme) => theme.concerns.length || theme.strengths.length);
}

const THEMES_NOTICE =
  "Teemad: organisatsiooniline, sotsiaalne, psühholoogiline ja professionaalne heaolu ning tööandja tugimeetmed. " +
  "Iga teema all on kõik avaldatud lahtrid, mitte ainult suurimad prioriteedid, ja sama teema tugevused. " +
  "Puuduv rida ei tähenda nulli: väike lahter jääb avaldamata.";

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
  return pilotFactorEntry(metricKey)?.label || humanizeMetricKey(metricKey);
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
  const counts = new Map(
    metrics.filter((metric) => Number(metric.metricValue || 0) > 0).map((metric) => [metric.metricKey, Number(metric.metricValue)])
  );
  const metricKeys = new Set(counts.keys());
  /* Tõend = suurim avaldatud lahter, mis reegli käivitas; viigi korral jääb reeglite järjekord. */
  const evidence = (rule) => Math.max(0, ...[rule.match].flat().map((key) => counts.get(key) || 0));
  return recommendationRules
    .map((rule, order) => ({ rule, order, weight: evidence(rule) }))
    .filter((item) => item.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.order - b.order)
    .flatMap(({ rule: { key, title, description } }) =>
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

function buildDecisionSummary({ suppressed, sampleSize, minimumGroupSize, signal, priorities, strengths = [] }) {
  if (suppressed) {
    return `Valim on alla miinimumgrupi ${minimumGroupSize}, seega kuvatakse ainult privaatsust kaitsev üldseis.`;
  }

  const firstPriority = priorities[0]?.label;
  /* Ideed 21.2: tugevused ei tohi jääda riskide varju. */
  const firstStrength = strengths[0]?.label;
  const suffix = (firstPriority ? ` Esimene arutelu fookus: ${firstPriority}.` : "") +
    (firstStrength ? ` Mis toimib: ${lowerFirstLabel(firstStrength)}.` : "");
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
    strengths: [],
    themes: [],
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
  const strengths = buildStrengths(metrics, dataset, suppression);
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
    strengths,
    strengthsNotice: buildStrengthsNotice(strengths, dataset),
    themes: buildThemes(metrics, strengths, offered),
    themesNotice: THEMES_NOTICE,
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
      priorities,
      strengths
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
