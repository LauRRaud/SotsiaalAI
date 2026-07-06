const SECTION_ATTRIBUTION_SECTIONS = [
  "description",
  "eligibility",
  "application",
  "forms",
  "contacts",
  "legal_basis",
  "fees",
  "deadlines"
];

const CURRENT_EVIDENCE_SECTIONS = new Set(["forms", "contacts", "legal_basis", "fees", "deadlines"]);
const LEGAL_EXACT_SELECTION_STRATEGIES = new Set(["legal_exact", "legal_exact_paragraph"]);
const JOURNAL_SOURCE_TYPES = new Set(["journal_article", "article"]);
const SERVICE_SOURCE_TYPES = new Set(["kov_service", "kov_service_info", "kov_service_page", "kov_benefit_page", "kov_resource_page", "municipality_service", "municipality_web", "kov_web"]);
const FORM_SOURCE_TYPES = new Set(["application_form", "web_form", "pdf_form", "doc_form", "official_form", "form"]);
const CONTACT_SOURCE_TYPES = new Set(["official_contact", "contact_page", "contact"]);
const REGULATION_SOURCE_TYPES = new Set(["kov_regulation", "municipal_regulation"]);

function clean(value) {
  const text = String(value || "").trim();
  return text || null;
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values = []) {
  return [...new Set(values.map(clean).filter(Boolean))].sort();
}

function sourceId(source = {}) {
  return clean(source.source_id || source.sourceId || source.id);
}

function sourceType(source = {}) {
  return clean(source.source_type || source.sourceType);
}

function itemType(source = {}) {
  return clean(source.item_type || source.itemType);
}

function sourceStatus(source = {}) {
  return clean(source.source_status || source.sourceStatus);
}

function evidenceStrengthHint(source = {}) {
  return clean(source.evidence_strength || source.evidenceStrength);
}

function isHistorical(source = {}) {
  return source.historical === true;
}

function isInactiveOrHistorical(source = {}) {
  const status = sourceStatus(source);
  return isHistorical(source) || (!!status && status !== "active");
}

function isLegalExact(queryPlan = {}) {
  const strategy = clean(queryPlan.selection_strategy || queryPlan.selectionStrategy);
  const legalLookup = queryPlan.legalLookupPlan || queryPlan.legal_lookup_plan || queryPlan.legal_lookup;
  return LEGAL_EXACT_SELECTION_STRATEGIES.has(strategy) || (
    legalLookup?.enabled === true &&
    legalLookup?.mode === "explicit_paragraph"
  );
}

function sourceTypeAllowedForSection(section, source = {}) {
  const type = sourceType(source);
  const item = itemType(source);
  if (!type && !item) return false;
  if (section === "forms") {
    return FORM_SOURCE_TYPES.has(type) || item === "form" || (
      evidenceStrengthHint(source) === "partial" &&
      (SERVICE_SOURCE_TYPES.has(type) || item === "service" || item === "benefit" || item === "toetus")
    );
  }
  if (section === "contacts") {
    return CONTACT_SOURCE_TYPES.has(type) || item === "contact" || (
      evidenceStrengthHint(source) === "partial" &&
      (SERVICE_SOURCE_TYPES.has(type) || item === "service" || item === "benefit" || item === "toetus")
    );
  }
  if (section === "legal_basis" || section === "fees" || section === "deadlines") {
    return REGULATION_SOURCE_TYPES.has(type);
  }
  if (section === "description" || section === "eligibility" || section === "application") {
    return SERVICE_SOURCE_TYPES.has(type) || REGULATION_SOURCE_TYPES.has(type) || JOURNAL_SOURCE_TYPES.has(type) || item === "service" || item === "benefit" || item === "toetus";
  }
  return false;
}

function sectionEvidenceStrength(section, source = {}) {
  const type = sourceType(source);
  if (CURRENT_EVIDENCE_SECTIONS.has(section)) {
    if (JOURNAL_SOURCE_TYPES.has(type)) return "unsupported";
    if (isInactiveOrHistorical(source)) return "unsupported";
    if (!sourceTypeAllowedForSection(section, source)) return "unsupported";
    return evidenceStrengthHint(source) === "partial" ? "partial" : "strong";
  }
  if (isInactiveOrHistorical(source)) return "unsupported";
  if (!sourceTypeAllowedForSection(section, source)) return "unsupported";
  if (evidenceStrengthHint(source) === "partial") return "partial";
  return JOURNAL_SOURCE_TYPES.has(type) ? "partial" : "strong";
}

function sourceStatusesForSection(section, source = {}) {
  const out = [];
  const type = sourceType(source);
  if (!sourceTypeAllowedForSection(section, source)) out.push("wrong_source_type");
  if (CURRENT_EVIDENCE_SECTIONS.has(section) && JOURNAL_SOURCE_TYPES.has(type)) out.push("disallowed_evidence_role");
  if (isInactiveOrHistorical(source)) out.push("stale_or_historical");
  if (!out.length) {
    const strength = sectionEvidenceStrength(section, source);
    out.push(strength === "partial" ? "weak_or_indirect_section" : "confirmed");
  }
  return unique(out);
}

function buildSectionEntry(pkg = {}, section) {
  const sources = arrayValue(pkg.sections?.[section]);
  const ids = unique(sources.map(sourceId));
  if (!sources.length || !ids.length) {
    return {
      package_id: clean(pkg.package_id),
      section,
      source_ids: [],
      evidence_strength: "missing",
      evidence_statuses: ["missing_section"]
    };
  }

  const statuses = unique(sources.flatMap(source => sourceStatusesForSection(section, source)));
  const strengths = sources.map(source => sectionEvidenceStrength(section, source));
  const evidenceStrength = strengths.every(strength => strength === "unsupported")
    ? "unsupported"
    : strengths.some(strength => strength === "strong")
      ? "strong"
      : "partial";

  return {
    package_id: clean(pkg.package_id),
    section,
    source_ids: ids,
    evidence_strength: evidenceStrength,
    evidence_statuses: statuses
  };
}

function attributionFlags(entries = []) {
  const flags = new Set();
  for (const entry of entries) {
    if (entry.evidence_strength === "missing") flags.add(`missing_${entry.section}`);
    for (const status of entry.evidence_statuses || []) {
      if (status !== "confirmed") flags.add(status);
    }
  }
  return [...flags].sort();
}

export function buildSectionAttribution({
  sourcePackages = [],
  packageAwareAnswering = {},
  ragRiskPolicy = {},
  queryPlan = {}
} = {}) {
  if (isLegalExact(queryPlan)) {
    return {
      package_attribution_checked: false,
      high_risk_attribution_checked: false,
      section_attribution: [],
      attribution_flags: ["legal_exact_opt_out"]
    };
  }

  const packageAwareUsed = packageAwareAnswering?.used === true;
  const highRisk = String(ragRiskPolicy?.riskLevel || "").toLowerCase() === "high";
  if (!packageAwareUsed && !highRisk) {
    return {
      package_attribution_checked: false,
      high_risk_attribution_checked: false,
      section_attribution: [],
      attribution_flags: []
    };
  }

  const packages = arrayValue(sourcePackages).filter(pkg => clean(pkg?.package_id));
  const entries = packages.flatMap(pkg => SECTION_ATTRIBUTION_SECTIONS.map(section => buildSectionEntry(pkg, section)));

  return {
    package_attribution_checked: packageAwareUsed,
    high_risk_attribution_checked: highRisk,
    section_attribution: entries,
    attribution_flags: packages.length ? attributionFlags(entries) : ["no_source_packages"]
  };
}

export function allowedSectionAttributionSourceIds(sectionAttribution = []) {
  return unique(arrayValue(sectionAttribution)
    .filter(entry => entry?.evidence_strength === "strong" || entry?.evidence_strength === "partial")
    .flatMap(entry => entry?.source_ids || []));
}
