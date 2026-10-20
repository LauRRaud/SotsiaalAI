/**
 * Piloodi aruande tegurite kataloog: iga koondi lahtri nimi ja teema.
 *
 * MIS PUUDU OLI. Aruande sildiloend kattis umbes 16 tegurit 136-st. Ülejäänud
 * (ka kõige sagedasem, „Töömaht on kõrge“) jõudsid otsustajani toorvõtmena
 * („work demand / workload / high“), ja kaks silti viitasid võtmetele, mida
 * ükski töövoog ei tekita. Siin on kõik tegurid, mida töövood koondisse
 * kirjutavad; uue teguri lisaja lisab siia ka rea.
 *
 * TEEMAD järgivad TÜ küsitluse „Sotsiaaltöötajate tööheaolu toetavad praktikad
 * ja tugisüsteemi arendamine“ jaotust (arendusettepanek ptk 8.5 „Partnerlus“):
 * organisatsiooniline (küsimus 24), sotsiaalne (25), psühholoogiline (26–27) ja
 * professionaalne heaolu (28) ning tööandja tugimeetmed (20–21). Nii saab
 * piloodi koondit lugeda uuringu kõrval. Küsitlust aruandes ei nimetata: kas ja
 * kuidas seda koostajatele pakkuda, otsustab omanik.
 *
 * Sildid on kolmandas isikus, sest lugeja on asutus. Töötaja enda vaate sildid
 * (`displayLabels.js`) on minavormis. Uut arvu siin ei teki: teema rühmitab
 * ainult juba avaldatud lahtreid.
 */

import { SUPPORT_MEASURE_LABELS, supportMeasureGapKey } from "./supportMeasureCatalog.js";

export const PILOT_THEMES = Object.freeze([
  { key: "organizational", label: "Organisatsiooniline heaolu", scope: "töökoormus, töökorraldus, töövahendid, töö- ja eraelu piir" },
  { key: "social", label: "Sotsiaalne heaolu", scope: "juhi ja kolleegide tugi, turvalisus ja kohtlemine" },
  { key: "psychological", label: "Psühholoogiline heaolu", scope: "emotsionaalne koormus, taastumine, rasked olukorrad" },
  { key: "professional", label: "Professionaalne heaolu", scope: "töö mõte" },
  { key: "support_measures", label: "Tööandja tugimeetmed", scope: "vajatud, aga kättesaamatud meetmed" }
]);

const ORG = "organizational";
const SOC = "social";
const PSY = "psychological";
const PRO = "professional";

/* Võti on koondi tegur ilma pere eesliiteta ja `.count` lõputa. */
const demand = {
  "workload.high": [ORG, "Töömaht on kõrge"],
  "case_complexity.high": [ORG, "Juhtumite keerukus on kõrge"],
  "documentation.high": [ORG, "Dokumenteerimise koormus on kõrge"],
  "interruptions.high": [ORG, "Katkestuste tase on kõrge"],
  "after_hours.impact": [ORG, "Töövälise kättesaadavuse surve on kõrge"],
  "boundaries.overtime_regular": [ORG, "Ületunnid on regulaarsed"],
  /* Taastumise „mis kurnab“ valik (`recovery.js`) kasutab samu võtmeid. */
  "clarity.unclear": [ORG, "Rollikonflikt või ebaselged ootused kurnavad"],
  "risk.difficult_case": [PSY, "Raske juhtum kurnab"],
  "risk.workplace_violence": [SOC, "Töövägivalla kogemus kurnab"],
  "interruptions.high_frequency": [ORG, "Katkestusi on sageli"],
  "interruptions.work_impact": [ORG, "Katkestused segavad tööd"],
  "interruptions.wrong_channel": [ORG, "Katkestused tulevad valest kanalist"],
  "interruptions.documentation_system": [ORG, "Dokumenteerimine või infosüsteem katkestab tööd"],
  "interruptions.role_boundary": [ORG, "Katkestused ületavad rollipiiri"],
  "interruptions.partner_process": [ORG, "Katkestused tulevad koostööpartneri protsessist"],
  "processes.duplicate_entry": [ORG, "Sama infot sisestatakse mitu korda"],
  "processes.documentation_load": [ORG, "Dokumenteerimine võtab palju aega"],
  "processes.information_search": [ORG, "Info otsimine võtab palju aega"],
  "processes.waiting": [ORG, "Ootamine võtab palju aega"],
  "processes.repetitive_tasks": [ORG, "Korduvad tegevused võtavad palju aega"],
  "processes.switching_load_high": [ORG, "Töövoogude ja süsteemide vahel liikumine koormab"],
  "processes.tools_not_working": [ORG, "Töövahendid takistavad tööd"],
  "processes.workspace_unsuitable": [ORG, "Füüsiline töökeskkond ei toeta tööd"],
  "role_boundaries.role_conflict_high": [ORG, "Rollikonflikt on tugev"],
  "role_boundaries.role_conflict_moderate": [ORG, "Rollikonflikt on mõõdukas"],
  "role_boundaries.partner_explanation_needed": [ORG, "Koostööpartner vajab rolli selgitust"],
  "role_boundaries.availability_pressure_high": [ORG, "Surve olla pidevalt kättesaadav on tugev"],
  "role_boundaries.ethical_complexity_high": [PSY, "Rollipiiri eetiline keerukus on kõrge"],
  "starter_support.role_uncertainty": [ORG, "Alustaja roll ja vastutus on ebaselged"],
  "starter_support.documentation_uncertainty": [ORG, "Alustajale on dokumenteerimine ebaselge"],
  "starter_support.missing_support": [SOC, "Alustajal puudub tööalane tugi"],
  "starter_support.cases_not_carry_alone": [SOC, "Alustajal on juhtumeid, mida ei peaks üksi kandma"],
  "emotional_load.high": [PSY, "Emotsionaalne koormus on kõrge"],
  "recovery.end_of_day_exhaustion": [PSY, "Tööpäeva lõpuks sageli vaimselt kurnatud"],
  "case.difficult": [PSY, "Raske juhtum"],
  "hard_case.load.emotional_load": [PSY, "Raske juhtum: põhikoormus on emotsionaalne"],
  "hard_case.load.ethical_tension": [PSY, "Raske juhtum: põhikoormus on eetiline pinge"],
  "hard_case.load.moral_distress": [PSY, "Raske juhtum: põhikoormus on moraalne stress"],
  "hard_case.load.role_conflict": [PSY, "Raske juhtum: põhikoormus on rollikonflikt"],
  "hard_case.load.trauma_exposure": [PSY, "Raske juhtum: põhikoormus on kokkupuude traumaga"],
  "hard_case.load.workload_followup": [PSY, "Raske juhtum: põhikoormus on järeltegevuste maht"],
  "ethical_tension.elevated": [PSY, "Eetiline pinge on kõrgenenud"],
  "moral_distress.present": [PSY, "Moraalne stress"],
  "trauma.exposure": [PSY, "Kokkupuude traumaga"],
  "violence.workplace": [SOC, "Töövägivalla olukord"],
  "violence.aggression": [SOC, "Töövägivald: agressioon"],
  "violence.threat": [SOC, "Töövägivald: ähvardus"],
  "violence.threatening_message": [SOC, "Töövägivald: ähvardav sõnum või e-kiri"],
  "violence.physical_danger": [SOC, "Töövägivald: füüsiline oht"],
  "violence.repeated_harassment": [SOC, "Töövägivald: korduv ahistav suhtlus"],
  "violence.insult_or_humiliation": [SOC, "Töövägivald: solvamine või alandamine"],
  "violence.stalking_or_intimidation": [SOC, "Töövägivald: jälitamine või hirmutamine"],
  "violence.lone_work_risk": [SOC, "Töövägivald: kodukülastuse või üksi töötamise risk"],
  "work_impact.elevated": [SOC, "Töövägivald mõjutab tööd"],
  "safety_impact.present": [SOC, "Töövägivald mõjutab turvatunnet"]
};

const resource = {
  /* Kiirkontroll 1.0 kirjetes on juhi ja kolleegide tugi üks võti. */
  "support.unclear_or_missing": [SOC, "Juhi või kolleegi tugi on ebaselge või puudub"],
  "support.manager_unclear_or_missing": [SOC, "Juhi tugi on ebaselge või puudub"],
  "support.colleague_unclear_or_missing": [SOC, "Kolleegide tugi on ebaselge või puudub"],
  "support.manager": [SOC, "Taastumiseks on vaja kokkulepet juhiga"],
  "support.colleague": [SOC, "Taastumiseks on vaja kolleegi tuge"],
  "support.supervisor": [SOC, "Taastumiseks on vaja supervisiooni või muud kokkulepitud tuge"],
  "support.do_not_carry_alone": [SOC, "Rasket juhtumit ei peaks üksi kandma"],
  "support.replacement_unclear": [ORG, "Asendus või info liikumine on ebaselge"],
  "starter_support.mentor_needed": [SOC, "Alustaja vajab mentori tuge"],
  "starter_support.manager_check_needed": [SOC, "Alustaja vajab arutelu juhiga"],
  "starter_support.covision_needed": [SOC, "Alustaja vajab kovisiooni"],
  "starter_support.boundary_plan_needed": [ORG, "Alustaja vajab tööpiiride kokkulepet"],
  "safety.agreement_needed": [SOC, "Vaja on turvalisuse kokkulepet"],
  "documentation.needs_neutral_record": [SOC, "Töövägivalla juhtum vajab neutraalset kirjapanekut"],
  "clarity.unclear": [ORG, "Prioriteedid või tööpiirid on ebaselged"],
  "decision_control.low": [ORG, "Otsustusruum oma töö üle on väike"],
  "boundaries.overtime_uncompensated": [ORG, "Ületunnid ei ole täielikult hüvitatud"],
  "boundaries.flexibility_missing": [ORG, "Paindlik tööaeg ei ole võimalik"],
  "focus_time.agreement_needed": [ORG, "Vaja on fookusaja kokkulepet"],
  "channels.agreement_needed": [ORG, "Vaja on suhtluskanalite kokkulepet"],
  "urgency.criteria_unclear": [ORG, "Ei ole selge, millal tuleb kohe reageerida"],
  "process.documentation_simplification_needed": [ORG, "Dokumenteerimine vajab lihtsustamist"],
  "processes.single_entry_needed": [ORG, "Vaja on üht sisestuskohta"],
  "processes.shared_status_view_needed": [ORG, "Vaja on ühist seisuvaadet"],
  "processes.owner_clarity_needed": [ORG, "Vaja on selget vastutajat"],
  "processes.information_flow_needed": [ORG, "Vaja on paremat info liikumist"],
  "role_boundaries.manager_discussion_needed": [ORG, "Rollipiir vajab arutelu juhiga"],
  "role_boundaries.partner_clarification_needed": [ORG, "Rollipiir vajab selgitust koostööpartnerile"],
  "role_boundaries.shared_responsibility_needed": [ORG, "Vastutus vajab jagamist"],
  "role.clarity_partial_or_unclear": [ORG, "Raske juhtumi roll või vastutus ei ole selge"],
  "recovery.low_or_none": [PSY, "Taastumisvõimalus on vähene või puudub"],
  "recovery.detachment_low": [PSY, "Töö tuleb sageli vabasse aega kaasa"],
  "recovery.follow_up_needed": [PSY, "Taastumine vajab plaani või tuge"],
  "meaning.low": [PRO, "Töö tähenduslikkuse tunne on madal"]
};

const risk = {
  "risk.difficult_case": [PSY, "Märgitud on raske juhtumi koormus"],
  "risk.workplace_violence": [SOC, "Märgitud on kliendi ähvardus või vägivald"],
  "recovery.none_with_critical_workload": [PSY, "Kriitiline töömaht koos puuduva taastumisega"],
  "recovery.low_capacity_72h": [PSY, "Töövõime on järgmise 72 tunni vaates madal"],
  "recovery.no_recovery_with_low_capacity": [PSY, "Taastumisvõimalus puudub ja töövõime on madal"],
  "boundaries.after_hours_unclear": [ORG, "Töövälise kättesaadavuse piir on ebaselge"],
  "boundaries.no_pause_protection": [PSY, "Pausid ei ole kaitstud"],
  "interruptions.very_frequent": [ORG, "Katkestusi on väga sageli"],
  "interruptions.many_can_wait": [ORG, "Paljud katkestused saaksid oodata"],
  "interruptions.recovery_impact_high": [PSY, "Katkestused mõjutavad tugevalt taastumist"],
  "processes.high_value_loss": [ORG, "Oluline töö jääb vähem olulise taha"],
  "processes.duplicate_documentation_high": [ORG, "Dubleerivat dokumenteerimist on palju"],
  "processes.unfinished_work_accumulates": [ORG, "Lõpetamata töö kuhjub"],
  "role_boundaries.responsibility_shift": [ORG, "Töötajalt oodatakse tööd, mis ei ole tema roll"],
  "role_boundaries.partner_responsibility_gap": [ORG, "Koostööpartneri panus on puudu"],
  "role_boundaries.ethical_tension": [PSY, "Rollipiiriga seotud eetiline pinge"],
  "starter_support.early_role_uncertainty": [ORG, "Alustaja rolli ebaselgus töö alguses"],
  "starter_support.not_to_carry_alone": [SOC, "Alustaja olukorda ei peaks üksi kandma"],
  "starter_support.support_agreement_needed_soon": [SOC, "Alustaja vajab peagi toe kokkulepet"],
  "hard_case.immediate_danger": [SOC, "Raske juhtum: vahetu oht võib jätkuda"],
  "hard_case.immediate_danger_uncertain": [SOC, "Raske juhtum: vahetu ohu kohta ei ole kindlust"],
  "hard_case.should_not_carry_alone": [SOC, "Raske juhtum: ei peaks üksi kandma"],
  "hard_case.direct_trauma_exposure": [PSY, "Raske juhtum: otsene kokkupuude traumaga"],
  "hard_case.high_ethical_tension": [PSY, "Raske juhtum: kõrge eetiline pinge"],
  "workplace_violence.danger_ongoing": [SOC, "Töövägivald: oht võib jätkuda"],
  "workplace_violence.danger_uncertain": [SOC, "Töövägivald: ohu kestmise kohta ei ole kindlust"],
  "workplace_violence.physical_danger": [SOC, "Töövägivald: füüsiline oht"],
  "workplace_violence.threat": [SOC, "Töövägivald: ähvardus"],
  "workplace_violence.safety_impact_high": [SOC, "Töövägivald: tugev mõju turvatundele"]
};

const entries = (prefix, table) =>
  Object.entries(table).map(([factor, [theme, label]]) => [`${prefix}.${factor}.count`, Object.freeze({ theme, label })]);

const FACTOR_CATALOG = Object.freeze(Object.fromEntries([
  ...entries("work_demand", demand),
  ...entries("work_resource", resource),
  ...entries("risk_event", risk),
  /* „Minu tugivõimalused“: meede, mida vajatakse, aga mida töötaja teada ei ole. */
  ...Object.entries(SUPPORT_MEASURE_LABELS).map(([value, label]) => [
    `work_resource.${supportMeasureGapKey(value)}.count`,
    Object.freeze({ theme: "support_measures", label: `Vajatakse, aga ei ole kättesaadav: ${label}` })
  ])
]));

export const PILOT_FACTOR_METRIC_KEYS = Object.freeze(Object.keys(FACTOR_CATALOG));

/* Tugevuse (`work_strength.<võti>`) teema. */
export const PILOT_STRENGTH_THEMES = Object.freeze({
  recovery: PSY,
  decision_control: ORG,
  priorities_clear: ORG,
  boundaries_clear: ORG,
  flexible_hours: ORG,
  manager_support: SOC,
  colleague_support: SOC,
  work_meaning: PRO,
  support_in_use: "support_measures"
});

const familyLabels = {
  signal: { red: "Punane signaal", yellow: "Kollane signaal", green: "Roheline signaal" },
  workflow: {
    "quick-check": "Kiirkontroll",
    "weekly-reflection": "Nädala peegeldus",
    "hard-case": "Raske juhtum",
    "workplace-violence": "Töövägivald",
    recovery: "Taastumine",
    "work-boundaries": "Tööpiirid",
    interruptions: "Katkestused",
    "work-processes": "Tööprotsessid",
    "role-boundaries": "Rollipiirid",
    "starter-support": "Alustaja tugi",
    "support-measures": "Minu tugivõimalused"
  }
};

export function humanizeMetricKey(metricKey) {
  return String(metricKey || "")
    .replace(/\.count$/u, "")
    .replaceAll("_", " ")
    .replaceAll(".", " / ");
}

/** Koondi teguri kirje `{ theme, label }` või null (tundmatu tegur). */
export function pilotFactorEntry(metricKey) {
  return FACTOR_CATALOG[String(metricKey || "")] || null;
}

/**
 * Mõõdikutabeli silt. Tegurid tulevad kataloogist; signaal, töövoog ja tugevus
 * saavad nime; tundmatu võti jääb loetavaks toorvõtmeks, mitte ei kao.
 * `strengthLabels` tuleb aruandest, et tugevuse nimi oleks kirjas ühes kohas.
 */
export function pilotMetricLabel(metricKey, { strengthLabels = {} } = {}) {
  const key = String(metricKey || "");
  const factor = pilotFactorEntry(key);
  if (factor) return factor.label;
  const [family, ...rest] = key.split(".");
  const unit = rest.at(-1);
  const name = rest.slice(0, -1).join(".");
  if (family === "signal" && familyLabels.signal[name]) {
    return unit === "share" ? `${familyLabels.signal[name]} (osakaal)` : familyLabels.signal[name];
  }
  if (family === "workflow" && familyLabels.workflow[name]) return `Töövoog: ${familyLabels.workflow[name]}`;
  if (family === "work_strength" && strengthLabels[name]) return `Mis toimib: ${strengthLabels[name]}`;
  return humanizeMetricKey(key);
}
