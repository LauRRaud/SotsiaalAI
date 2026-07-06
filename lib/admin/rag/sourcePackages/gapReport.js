const SOURCE_PACKAGE_GAP_SECTIONS = [
  "forms",
  "contacts",
  "legal_basis",
  "fees",
  "deadlines"
];

const FORM_TYPES = new Set(["application_form", "web_form", "pdf_form", "official_form"]);
const CONTACT_TYPES = new Set(["official_contact", "contact_page"]);
const REGULATION_TYPES = new Set(["kov_regulation", "municipal_regulation"]);
const SERVICE_TYPES = new Set(["kov_service", "kov_service_info", "municipality_service", "municipality_web", "kov_web"]);

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

function sourceType(source = {}) {
  return clean(source.source_type || source.sourceType);
}

function itemType(source = {}) {
  return clean(source.item_type || source.itemType);
}

function sourceStatus(source = {}) {
  return clean(source.source_status || source.sourceStatus || source.status);
}

function sourceId(source = {}) {
  return clean(source.source_id || source.sourceId || source.id);
}

function sourceSections(source = {}) {
  return arrayValue(source.sections).map(clean).filter(Boolean);
}

function sourceHasSectionHint(source = {}, section) {
  const hints = [
    ...sourceSections(source),
    ...arrayValue(source.sections_present || source.sectionsPresent).map(clean).filter(Boolean)
  ];
  return hints.includes(section);
}

function sectionSummary(row = {}) {
  const summary = row.sectionSummary && typeof row.sectionSummary === "object" ? row.sectionSummary : {};
  return Object.fromEntries(Object.entries(summary).map(([section, value]) => [
    section,
    {
      count: Number(value?.count || 0),
      source_ids: unique(value?.source_ids)
    }
  ]));
}

function sourceMembership(row = {}) {
  return arrayValue(row.sourceMembership).map(source => ({
    source_id: sourceId(source),
    source_type: sourceType(source),
    resource_type: clean(source.resource_type || source.resourceType),
    item_type: itemType(source),
    municipality_id: clean(source.municipality_id || source.municipalityId),
    source_status: sourceStatus(source),
    historical: source.historical === true,
    sections: sourceSections(source),
    evidence_allowed: source.evidence_allowed !== false,
    evidence_strength: clean(source.evidence_strength || source.evidenceStrength)
  })).filter(source => source.source_id);
}

function missingSections(row = {}) {
  return arrayValue(row.missingSections || row.missing_sections).map(clean).filter(Boolean);
}

function sourceAllowedForSection(section, source = {}) {
  const type = sourceType(source);
  const item = itemType(source);
  const resourceType = clean(source.resource_type || source.resourceType);
  if (section === "forms") return FORM_TYPES.has(type) || FORM_TYPES.has(resourceType) || item === "form";
  if (section === "contacts") return CONTACT_TYPES.has(type) || CONTACT_TYPES.has(resourceType) || item === "contact";
  if (section === "legal_basis") return REGULATION_TYPES.has(type) || REGULATION_TYPES.has(resourceType);
  if (section === "fees" || section === "deadlines") return REGULATION_TYPES.has(type) || REGULATION_TYPES.has(resourceType);
  return SERVICE_TYPES.has(type) || REGULATION_TYPES.has(type);
}

function isInactiveOrHistorical(source = {}) {
  const status = sourceStatus(source);
  return source.historical === true || (!!status && status !== "active");
}

function evidenceStrengthFor(section, sources = []) {
  if (!sources.length) return "missing";
  if (sources.some(source => !isInactiveOrHistorical(source) && sourceAllowedForSection(section, source))) return "strong";
  return "unsupported";
}

function evidenceStatusesFor(section, sources = []) {
  if (!sources.length) return ["missing_section"];
  const statuses = new Set();
  for (const source of sources) {
    if (!sourceAllowedForSection(section, source)) statuses.add("wrong_source_type");
    if (isInactiveOrHistorical(source)) statuses.add("stale_or_historical");
  }
  if (!statuses.size) statuses.add("confirmed");
  return [...statuses].sort();
}

export function buildSectionAttributionSummary(row = {}) {
  const summary = sectionSummary(row);
  const membership = sourceMembership(row);
  return Object.fromEntries(SOURCE_PACKAGE_GAP_SECTIONS.map(section => {
    const sourceIds = unique(summary[section]?.source_ids);
    const sources = sourceIds.length
      ? membership.filter(source => sourceIds.includes(source.source_id))
      : [];
    return [section, {
      source_ids: sourceIds,
      evidence_strength: evidenceStrengthFor(section, sources),
      evidence_statuses: evidenceStatusesFor(section, sources)
    }];
  }));
}

function candidatesForPackage(candidates = [], row = {}, section) {
  const canonicalItemId = clean(row.canonicalItemId || row.canonical_item_id);
  const packageId = clean(row.packageId || row.package_id);
  const municipalityId = clean(row.municipalityId || row.municipality_id);
  return arrayValue(candidates).filter(candidate => {
    if (clean(candidate.section) !== section) return false;
    const candidateMunicipalityId = clean(candidate.municipality_id || candidate.municipalityId);
    if (candidateMunicipalityId && municipalityId && candidateMunicipalityId !== municipalityId) return false;
    if (candidate.global_current_evidence === true && section === "legal_basis") return true;
    if (clean(candidate.canonical_item_id || candidate.canonicalItemId) === canonicalItemId) return true;
    if (clean(candidate.package_id || candidate.packageId) === packageId) return true;
    const related = arrayValue(candidate.related_canonical_item_ids || candidate.relatedCanonicalItemIds).map(clean);
    return related.includes(canonicalItemId);
  });
}

function likelyReasonForMissing(row = {}, section, candidates = []) {
  const samePackageCandidates = candidatesForPackage(candidates, row, section);
  const membership = sourceMembership(row);
  const packageSources = membership.filter(source =>
    !sourceSections(source).includes(section) &&
    sourceHasSectionHint(source, section)
  );
  const possibleSources = [...samePackageCandidates, ...packageSources];

  if (possibleSources.some(source => isInactiveOrHistorical(source))) return "inactive_or_historical";
  if (samePackageCandidates.some(source => sourceAllowedForSection(section, source))) return "mapping_missing";
  if (packageSources.some(source => sourceAllowedForSection(section, source))) return "mapping_missing";
  if (possibleSources.length) return "source_type_mismatch";
  return "input_missing";
}

function candidateSourceIdsForMissing(row = {}, section, candidates = []) {
  const samePackageCandidates = candidatesForPackage(candidates, row, section);
  const membership = sourceMembership(row).filter(source =>
    !sourceSections(source).includes(section) &&
    sourceHasSectionHint(source, section)
  );
  return unique([...samePackageCandidates, ...membership].map(sourceId));
}

function gapForSection(row = {}, section, candidates = []) {
  const summary = sectionSummary(row);
  const sourceIds = unique(summary[section]?.source_ids);
  if (sourceIds.length) {
    return {
      status: "present",
      likelyReason: null,
      sourceIds
    };
  }
  return {
    status: "missing",
    likelyReason: likelyReasonForMissing(row, section, candidates),
    candidate_source_ids: candidateSourceIdsForMissing(row, section, candidates),
    sourceIds: []
  };
}

function recommendedNextStep(gaps = {}) {
  const reasons = new Set(Object.values(gaps).map(gap => gap.likelyReason).filter(Boolean));
  if (reasons.has("mapping_missing")) return "check KOV source metadata and SourcePackage section mapping";
  if (reasons.has("source_type_mismatch")) return "check source_type/resource_type values for package evidence roles";
  if (reasons.has("inactive_or_historical")) return "refresh stale or historical source metadata before current evidence use";
  if (reasons.has("input_missing")) return "add or ingest missing KOV form/contact/legal basis sources";
  return "no gap action needed";
}

export function buildSourcePackageGapItem(row = {}, options = {}) {
  const gaps = Object.fromEntries(SOURCE_PACKAGE_GAP_SECTIONS.map(section => [
    section,
    gapForSection(row, section, options.candidateSources)
  ]));
  return {
    packageId: row.packageId,
    title: row.title,
    packageType: row.packageType,
    status: row.status,
    reviewStatus: row.reviewStatus || "pending",
    missingSections: missingSections(row),
    sectionSummary: sectionSummary(row),
    sourceMembership: sourceMembership(row).map(source => ({
      source_id: source.source_id,
      source_type: source.source_type,
      resource_type: source.resource_type,
      item_type: source.item_type,
      source_status: source.source_status,
      historical: source.historical,
      sections: source.sections,
      evidence_allowed: source.evidence_allowed,
      evidence_strength: source.evidence_strength
    })),
    sectionAttributionSummary: buildSectionAttributionSummary(row),
    gaps,
    recommendedNextStep: recommendedNextStep(gaps)
  };
}

export function buildSourcePackageGapReport(rows = [], options = {}) {
  const packages = arrayValue(rows).map(row => buildSourcePackageGapItem(row, options));
  const missingCounts = Object.fromEntries(SOURCE_PACKAGE_GAP_SECTIONS.map(section => [
    section,
    packages.filter(pkg => pkg.gaps?.[section]?.status === "missing").length
  ]));
  const reasons = {};
  for (const pkg of packages) {
    for (const gap of Object.values(pkg.gaps || {})) {
      if (!gap?.likelyReason) continue;
      reasons[gap.likelyReason] = (reasons[gap.likelyReason] || 0) + 1;
    }
  }
  return {
    ok: true,
    municipality_id: options.municipalityId || "jogeva_vald",
    summary: {
      package_count: packages.length,
      missing_counts: missingCounts,
      likely_reasons: reasons
    },
    packages
  };
}
