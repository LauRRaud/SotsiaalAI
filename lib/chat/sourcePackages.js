import fs from "node:fs";
import path from "node:path";

const PACKAGE_SECTION_KEYS = [
  "description",
  "eligibility",
  "application",
  "forms",
  "contacts",
  "legal_basis",
  "fees",
  "deadlines"
];

const JOURNAL_SOURCE_TYPES = new Set(["journal_article", "article"]);
const LEGAL_BASIS_SOURCE_TYPES = new Set(["kov_regulation", "municipal_regulation"]);
const FORM_SOURCE_TYPES = new Set(["application_form", "web_form", "pdf_form", "doc_form", "official_form", "form"]);
const CONTACT_SOURCE_TYPES = new Set(["official_contact", "contact_page", "contact"]);
const SERVICE_SOURCE_TYPES = new Set([
  "kov_service",
  "kov_service_info",
  "kov_service_page",
  "kov_benefit_page",
  "kov_resource_page",
  "municipality_service",
  "municipality_web",
  "kov_web"
]);

const GENERAL_SOCIAL_ASSISTANCE_REGULATION_TERMS = [
  "sotsiaalhoolekandelise abi andmise kord",
  "sotsiaalhoolekandelise abi",
  "sotsiaalabi andmise kord",
  "sotsiaalhoolekande kord"
];
const KOV_CANONICAL_RELATION_ROOTS = {
  jogeva_vald: ["KOV", "jogeva-vald"]
};
const canonicalRelationCache = new Map();

function slugFromMunicipalityId(value) {
  return clean(value)?.replace(/_/g, "-") || null;
}

function clean(value) {
  const text = String(value || "").trim();
  return text || null;
}

function cleanArray(value) {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  if (typeof value === "string") return value.split(/[,;]/).map(clean).filter(Boolean);
  return [];
}

export function normalizeSourcePackageCanonicalItemId(value) {
  let text = clean(value);
  if (!text) return null;
  const colonCanonical = text.match(/^([a-z0-9_]+):(service|benefit|resource|contact|form):(.+)$/);
  if (colonCanonical) {
    return `${colonCanonical[1]}_${colonCanonical[2]}_${slug(colonCanonical[3])}`;
  }
  const genericDuplicate = text.match(/^(.+?_(?:vald|linn))_(service|benefit|resource|contact|form)_\1_\2_(.+)$/);
  if (genericDuplicate) {
    return `${genericDuplicate[1]}_${genericDuplicate[2]}_${genericDuplicate[3]}`;
  }
  const duplicatePrefixes = [
    "jogeva_vald_service_jogeva_vald_service_",
    "jogeva_vald_benefit_jogeva_vald_benefit_"
  ];
  for (const prefix of duplicatePrefixes) {
    if (text.startsWith(prefix)) {
      return `${prefix.slice(0, prefix.indexOf("_jogeva_vald_"))}_${text.slice(prefix.length)}`;
    }
  }
  return text;
}

function slug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function sourceId(entry = {}, index = 0) {
  return clean(
    entry.source_id ||
    entry.id ||
    entry.sourceId ||
    entry.raw_source_id ||
    entry.chunkId ||
    entry.chunk_id ||
    entry.canonicalItemId ||
    entry.canonical_item_id ||
    `source-${index}`
  );
}

function sourceType(entry = {}) {
  return clean(entry.source_type || entry.sourceType);
}

function itemType(entry = {}) {
  return clean(entry.item_type || entry.itemType);
}

function canonicalItemId(entry = {}) {
  return clean(entry.canonical_item_id || entry.canonicalItemId);
}

function municipalityId(entry = {}) {
  return clean(entry.municipality_id || entry.municipalityId);
}

function municipalityName(entry = {}) {
  return clean(entry.municipality_name || entry.municipalityName);
}

function lastChecked(entry = {}) {
  return clean(entry.last_checked || entry.lastChecked);
}

function sourceStatus(entry = {}) {
  return clean(entry.source_status || entry.sourceStatus);
}

function historicalFlag(entry = {}) {
  if (entry.historical === true) return true;
  if (entry.is_current_version === false || entry.isCurrentVersion === false) return true;
  return undefined;
}

function currentAwareSourceStatus(entry = {}) {
  return sourceStatus(entry) ||
    (entry.is_current_version === true || entry.isCurrentVersion === true ? "active" : null);
}

function sectionHints(entry = {}) {
  return cleanArray(entry.sections_present || entry.sectionsPresent);
}

function relatedCanonicalItemIds(entry = {}) {
  return cleanArray(
    entry.related_canonical_item_ids ||
    entry.relatedCanonicalItemIds ||
    entry.related_to ||
    entry.relatedTo
  );
}

function relatedFormIds(entry = {}) {
  return cleanArray(
    entry.related_forms ||
    entry.relatedForms ||
    entry.related_form_ids ||
    entry.relatedFormIds
  );
}

function relatedContactIds(entry = {}) {
  return cleanArray(
    entry.related_contacts ||
    entry.relatedContacts ||
    entry.related_contact_ids ||
    entry.relatedContactIds
  );
}

function explicitEvidenceStrength(entry = {}) {
  return clean(entry.evidence_strength || entry.evidenceStrength);
}

function hasSourceType(entry, set) {
  const type = sourceType(entry);
  return type ? set.has(type) : false;
}

function packageTypeFromItem(type) {
  if (type === "benefit" || type === "toetus") return "kov_benefit";
  if (type === "form") return "kov_form";
  if (type === "contact") return "kov_contact";
  return "kov_service";
}

function packageIdFor(muniId, canonicalId) {
  const muniSlug = slug(muniId);
  const itemSlug = slug(canonicalId);
  const base = muniSlug && itemSlug && !itemSlug.startsWith(`${muniSlug}_`)
    ? `${muniSlug}_${itemSlug}`
    : itemSlug || muniSlug || "source_package";
  return `${base}_package`;
}

function readJsonIfExists(filePath) {
  try {
    return JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ filePath, "utf8"));
  } catch {
    return null;
  }
}

function sourceKey(source = {}) {
  return clean(source.key || source.source_key || source.sourceKey || source.id);
}

function sourceUrl(source = {}) {
  return clean(source.url_canonical || source.urlCanonical || source.url || source.official_url || source.officialUrl);
}

function sourceInRelationMunicipality(source = {}, relationData = null) {
  if (!relationData?.municipality_id) return false;
  const sourceMuni = municipalityId(source);
  return !sourceMuni || sourceMuni === relationData.municipality_id;
}

function sourceMatchesItemSourceKey(source = {}, item = {}) {
  const keys = cleanArray(item.sourceKeys || item.source_keys);
  return keys.includes(sourceKey(source)) || keys.includes(sourceId(source));
}

function sourceMatchesItemUrl(source = {}, item = {}) {
  const url = sourceUrl(source);
  return !!url && !!item?.officialUrl && url === clean(item.officialUrl);
}

function normalizedTitle(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceMatchesItemTitle(source = {}, item = {}) {
  const sourceTitle = normalizedTitle(source.title || source.name);
  const itemTitle = normalizedTitle(item.title || item.name);
  if (!sourceTitle || !itemTitle) return false;
  return sourceTitle === itemTitle || sourceTitle.includes(itemTitle) || itemTitle.includes(sourceTitle);
}

function isFormEvidenceSource(source = {}) {
  return FORM_SOURCE_TYPES.has(sourceType(source)) || itemType(source) === "form";
}

function isContactEvidenceSource(source = {}) {
  return CONTACT_SOURCE_TYPES.has(sourceType(source)) || itemType(source) === "contact";
}

function normalizeCanonicalSource(source = {}, fallback = {}) {
  const explicitMunicipalityId = municipalityId(source);
  return {
    source_id: sourceId(source) || clean(fallback.source_id),
    title: clean(source.title || source.name || fallback.title),
    url: clean(source.url || source.url_canonical || source.officialUrl || fallback.url),
    source_type: sourceType(source) || clean(fallback.source_type),
    collection_id: clean(source.collection_id || source.collectionId || fallback.collection_id),
    item_type: itemType(source) || clean(fallback.item_type),
    resource_type: clean(source.resource_type || source.resourceType || fallback.resource_type),
    municipality_id: explicitMunicipalityId || clean(fallback.municipality_id),
    municipality_id_inferred: !explicitMunicipalityId && !!clean(fallback.municipality_id),
    municipality_name: municipalityName(source) || clean(source.municipality || fallback.municipality_name),
    source_status: currentAwareSourceStatus(source) || clean(source.status) || clean(fallback.source_status) || "active",
    last_checked: lastChecked(source) || clean(source.checkedAt || source.checked_at || fallback.last_checked),
    historical: historicalFlag(source) ?? false,
    evidence_strength: clean(fallback.evidence_strength)
  };
}

function loadKovCanonicalRelations(muniId) {
  const id = clean(muniId);
  if (!id) return null;
  if (canonicalRelationCache.has(id)) return canonicalRelationCache.get(id);

  const slugName = slugFromMunicipalityId(id);
  const candidateRoots = [
    ...(KOV_CANONICAL_RELATION_ROOTS[id] ? [KOV_CANONICAL_RELATION_ROOTS[id]] : []),
    slugName ? ["KOV", slugName] : null
  ].filter(Boolean);
  let root = null;
  let data = null;
  let sourcesData = null;
  for (const parts of candidateRoots) {
    const candidateRoot = path.join(/*turbopackIgnore: true*/ process.cwd(), ...parts);
    const candidateSlug = parts[parts.length - 1];
    const candidateData = readJsonIfExists(path.join(/*turbopackIgnore: true*/ candidateRoot, `${candidateSlug}.json`));
    const candidateSources = readJsonIfExists(path.join(/*turbopackIgnore: true*/ candidateRoot, `${candidateSlug}.sources.json`));
    if (candidateData?.items && Array.isArray(candidateData.items)) {
      root = candidateRoot;
      data = candidateData;
      sourcesData = candidateSources;
      break;
    }
  }
  if (!data?.items || !Array.isArray(data.items)) {
    return null;
  }

  const items = data.items;
  const sources = Array.isArray(sourcesData?.sources) ? sourcesData.sources : [];
  const itemById = new Map(items.map(item => [clean(item.id), item]).filter(([itemId]) => itemId));
  const contactPage = sources.find(source =>
    sourceInRelationMunicipality(source, { municipality_id: id }) &&
    CONTACT_SOURCE_TYPES.has(sourceType(source))
  ) || null;
  const relationData = {
    municipality_id: id,
    root,
    itemById,
    sources,
    contactPage
  };
  canonicalRelationCache.set(id, relationData);
  return relationData;
}

function serviceSourcesFromCanonical(pkg = {}, relationData = null) {
  if (!relationData || relationData.municipality_id !== pkg.municipality_id) return [];
  const service = relationData.itemById.get(normalizeSourcePackageCanonicalItemId(pkg.canonical_item_id));
  if (!service) return [];
  const candidates = relationData.sources.filter(source =>
    sourceInRelationMunicipality(source, relationData) &&
    (sourceMatchesItemSourceKey(source, service) || sourceMatchesItemUrl(source, service))
  );
  return candidates.map(source => normalizeCanonicalSource(source, {
    source_id: clean(service.id),
    source_type: "kov_service_info",
    item_type: itemType(service) || "service",
    resource_type: "service_page",
    municipality_id: pkg.municipality_id,
    municipality_name: pkg.municipality_name,
    source_status: service.status || "active",
    last_checked: source.last_checked || service.checkedAt,
    evidence_strength: "strong"
  }));
}

function relatedFormSourcesFromCanonical(pkg = {}, relationData = null) {
  if (!relationData || relationData.municipality_id !== pkg.municipality_id) return [];
  const service = relationData.itemById.get(normalizeSourcePackageCanonicalItemId(pkg.canonical_item_id));
  if (!service) return [];
  return cleanArray(service.relatedForms).flatMap(formId => {
    const form = relationData.itemById.get(formId);
    if (!form || itemType(form) !== "form") return [];
    const candidates = relationData.sources.filter(source =>
      sourceInRelationMunicipality(source, relationData) &&
      isFormEvidenceSource(source) &&
      (
        sourceMatchesItemSourceKey(source, form) ||
        sourceMatchesItemTitle(source, form)
      )
    );
    return candidates.length
      ? candidates.map(source => normalizeCanonicalSource(source, {
          source_id: formId,
          source_type: "application_form",
          item_type: "form",
          resource_type: "form",
          municipality_id: pkg.municipality_id,
          municipality_name: pkg.municipality_name,
          source_status: form.status || "active",
          last_checked: source.last_checked || form.checkedAt,
          evidence_strength: "strong"
        }))
      : [];
  });
}

function relatedContactSourcesFromCanonical(pkg = {}, relationData = null) {
  if (!relationData || relationData.municipality_id !== pkg.municipality_id) return [];
  const service = relationData.itemById.get(normalizeSourcePackageCanonicalItemId(pkg.canonical_item_id));
  if (!service) return [];
  return cleanArray(service.relatedContacts).flatMap(contactId => {
    const contact = relationData.itemById.get(contactId);
    if (!contact || itemType(contact) !== "contact") return [];
    const candidates = relationData.sources.filter(source =>
      sourceInRelationMunicipality(source, relationData) &&
      isContactEvidenceSource(source) &&
      (sourceMatchesItemSourceKey(source, contact) || sourceMatchesItemUrl(source, contact))
    );
    if (candidates.length) {
      return candidates.map(source => normalizeCanonicalSource(source, {
        source_id: contactId,
        source_type: "official_contact",
        item_type: "contact",
        resource_type: "contact",
        municipality_id: pkg.municipality_id,
        municipality_name: pkg.municipality_name,
        source_status: contact.status || "active",
        last_checked: source.last_checked || contact.checkedAt,
        evidence_strength: sourceType(source) === "contact_page" ? "partial" : "strong"
      }));
    }
    if (relationData.contactPage) {
      return [normalizeCanonicalSource(relationData.contactPage, {
        source_type: "contact_page",
        item_type: "contact",
        resource_type: "contact",
        municipality_id: pkg.municipality_id,
        municipality_name: pkg.municipality_name,
        source_status: contact.status || "active",
        evidence_strength: "partial"
      })];
    }
    const servicePageCandidates = serviceSourcesFromCanonical(pkg, relationData);
    if (servicePageCandidates.length) {
      return servicePageCandidates.map(source => normalizeCanonicalSource(source, {
        source_type: sourceType(source) || "kov_service_info",
        item_type: "contact",
        resource_type: clean(source.resource_type || source.resourceType) || "service_page",
        municipality_id: pkg.municipality_id,
        municipality_name: pkg.municipality_name,
        source_status: contact.status || "active",
        evidence_strength: "partial"
      }));
    }
    return [];
  });
}

function enrichPackageFromCanonicalRelations(pkg = {}) {
  const relationData = loadKovCanonicalRelations(pkg.municipality_id);
  if (!relationData) return;
  for (const source of serviceSourcesFromCanonical(pkg, relationData)) {
    for (const section of ["description", "eligibility", "application"]) {
      if (!Array.isArray(pkg.sections?.[section])) continue;
      if (pkg.sections[section].length && source.municipality_id_inferred !== true) continue;
      addSectionSource(pkg, section, source);
    }
  }
  if (!Array.isArray(pkg.sections?.forms) || !pkg.sections.forms.length) {
    for (const source of relatedFormSourcesFromCanonical(pkg, relationData)) {
      addSectionSource(pkg, "forms", source);
    }
  }
  if (!Array.isArray(pkg.sections?.contacts) || !pkg.sections.contacts.length) {
    for (const source of relatedContactSourcesFromCanonical(pkg, relationData)) {
      addSectionSource(pkg, "contacts", source);
    }
  }
}

function seedPackageSectionsForEntry(entry = {}) {
  if (hasSourceType(entry, JOURNAL_SOURCE_TYPES)) return [];
  if (hasSourceType(entry, LEGAL_BASIS_SOURCE_TYPES)) return [];
  if (hasSourceType(entry, FORM_SOURCE_TYPES)) return [];
  if (hasSourceType(entry, CONTACT_SOURCE_TYPES)) return [];
  const type = itemType(entry);
  if (hasSourceType(entry, SERVICE_SOURCE_TYPES) || type === "service" || type === "benefit" || type === "toetus") {
    const hints = sectionHints(entry).filter(section => PACKAGE_SECTION_KEYS.includes(section));
    if (hints.length) return hints.filter(section => !["legal_basis", "forms", "contacts", "fees", "deadlines"].includes(section));
    return ["description", "eligibility", "application"];
  }
  return [];
}

function servicePagePartialSectionsForEntry(entry = {}) {
  if (!isServicePackageEntry(entry)) return [];
  const hints = sectionHints(entry).filter(section => ["forms", "contacts"].includes(section));
  return [...new Set(hints)];
}

function isServicePackageEntry(entry = {}) {
  const type = itemType(entry);
  return hasSourceType(entry, SERVICE_SOURCE_TYPES) || type === "service" || type === "benefit" || type === "toetus";
}

function associationSectionsForEntry(entry = {}, pkg = {}) {
  if (!pkg?.canonical_item_id || !pkg?.municipality_id) return [];
  if (municipalityId(entry) !== pkg.municipality_id) return [];
  if (hasSourceType(entry, JOURNAL_SOURCE_TYPES)) return [];

  const normalizedPackageCanonicalId = normalizeSourcePackageCanonicalItemId(pkg.canonical_item_id);
  const directCanonicalMatch = normalizeSourcePackageCanonicalItemId(canonicalItemId(entry)) === normalizedPackageCanonicalId;
  const relatedMatch = relatedCanonicalItemIds(entry)
    .map(normalizeSourcePackageCanonicalItemId)
    .includes(normalizedPackageCanonicalId);
  const generalKovRegulation = isGeneralKovRegulation(entry);

  if (hasSourceType(entry, FORM_SOURCE_TYPES) || itemType(entry) === "form") {
    return directCanonicalMatch || relatedMatch ? ["forms"] : [];
  }
  if (hasSourceType(entry, CONTACT_SOURCE_TYPES) || itemType(entry) === "contact") {
    return directCanonicalMatch || relatedMatch ? ["contacts"] : [];
  }
  if (hasSourceType(entry, LEGAL_BASIS_SOURCE_TYPES)) {
    if (directCanonicalMatch || relatedMatch) return regulationSectionsForEntry(entry);
    if (generalKovRegulation && isRegulationRelevantToPackage(entry, pkg)) return regulationSectionsForEntry(entry);
  }
  return [];
}

function packageAnchorTokens(pkg = {}) {
  const municipalityTokens = new Set(normalizedTextTokens(pkg.municipality_id || pkg.municipalityId || pkg.municipality_name || pkg.municipalityName));
  const text = normalizeSourcePackageCanonicalItemId(pkg.canonical_item_id) || pkg.title || "";
  return String(text)
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .split(/\s+/)
    .map(value => value.trim())
    .filter(Boolean)
    .filter(value => value.length >= 4)
    .filter(value => !municipalityTokens.has(value))
    .filter(value => ![
      "vald",
      "linn",
      "service",
      "benefit",
      "resource",
      "teenus",
      "teenuse",
      "toetus",
      "toetuse"
    ].includes(value));
}

function inflectedAnchorTokens(token) {
  const out = [token];
  if (token.endsWith("teenus")) out.push(`${token.slice(0, -"teenus".length)}teenuse`);
  if (token.endsWith("toetus")) out.push(`${token.slice(0, -"toetus".length)}toetuse`);
  return out;
}

function normalizedTextTokens(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .split(/\s+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function hasParagraphSignal(entry = {}) {
  return !!clean(entry.paragraph_number || entry.paragraphNumber || entry.paragraph_title || entry.paragraphTitle) ||
    /(^|\s)§\s*\d+/.test(String(entry.title || ""));
}

function isRegulationRelevantToPackage(entry = {}, pkg = {}) {
  if (!hasParagraphSignal(entry)) return true;
  const tokens = new Set(normalizedTextTokens(textSignal(entry)));
  return packageAnchorTokens(pkg).some(token =>
    inflectedAnchorTokens(token).some(anchor => tokens.has(anchor))
  );
}

function textSignal(entry = {}) {
  return [
    entry.title,
    entry.section,
    entry.paragraph_title,
    entry.paragraphTitle,
    entry.resource_type,
    entry.resourceType,
    entry.item_type,
    entry.itemType,
    ...sectionHints(entry)
  ].map(value => String(value || "").toLowerCase()).join(" ");
}

function hasFeeSignal(entry = {}) {
  const text = textSignal(entry);
  return sectionHints(entry).includes("fees") ||
    /\b(tasu|tasud|hind|hinnad|maksumus|omaosalus|summa|maar|määr)\b/.test(text);
}

function hasDeadlineSignal(entry = {}) {
  const text = textSignal(entry);
  return sectionHints(entry).includes("deadlines") ||
    /\b(tahtaeg|tähtaeg|tahtajad|tähtajad|tahtaja|tähtaja|menetlustahtaeg|menetlustähtaeg|toopaev|tööpäev)\b/.test(text);
}

function regulationSectionsForEntry(entry = {}) {
  const sections = ["legal_basis"];
  if (hasFeeSignal(entry)) sections.push("fees");
  if (hasDeadlineSignal(entry)) sections.push("deadlines");
  return sections;
}

function isGeneralKovRegulation(entry = {}) {
  if (!hasSourceType(entry, LEGAL_BASIS_SOURCE_TYPES)) return false;
  const text = [
    entry.title,
    entry.act_title,
    entry.actTitle,
    entry.collection_id,
    entry.collectionId
  ].map(value => String(value || "").toLowerCase()).join(" ");
  return GENERAL_SOCIAL_ASSISTANCE_REGULATION_TERMS.some(term => text.includes(term)) ||
    text.includes("kov_regulations");
}

function isPartialAssociation(entry = {}, pkg = {}, section) {
  if (!hasSourceType(entry, LEGAL_BASIS_SOURCE_TYPES)) return false;
  const normalizedPackageCanonicalId = normalizeSourcePackageCanonicalItemId(pkg.canonical_item_id);
  if (normalizeSourcePackageCanonicalItemId(canonicalItemId(entry)) === normalizedPackageCanonicalId) return false;
  if (relatedCanonicalItemIds(entry).map(normalizeSourcePackageCanonicalItemId).includes(normalizedPackageCanonicalId)) return false;
  return section === "legal_basis" || section === "fees" || section === "deadlines";
}

function safeSectionSource(entry = {}, index = 0) {
  return Object.fromEntries(Object.entries({
    source_id: sourceId(entry, index),
    title: clean(entry.title),
    url: clean(entry.url || entry.source_url || entry.url_canonical || entry.official_url || entry.officialUrl),
    source_type: sourceType(entry),
    collection_id: clean(entry.collection_id || entry.collectionId),
    item_type: itemType(entry),
    resource_type: clean(entry.resource_type || entry.resourceType),
    municipality_id: municipalityId(entry),
    municipality_name: municipalityName(entry),
    source_status: currentAwareSourceStatus(entry),
    last_checked: lastChecked(entry),
    historical: historicalFlag(entry),
    evidence_strength: explicitEvidenceStrength(entry)
  }).filter(([, value]) => value !== null && typeof value !== "undefined"));
}

function safeRelatedSectionSource(entry = {}, relatedId, section) {
  const type = section === "forms" ? "application_form" : "official_contact";
  const item = section === "forms" ? "form" : "contact";
  return Object.fromEntries(Object.entries({
    source_id: relatedId,
    title: relatedId,
    url: clean(entry.url || entry.source_url || entry.url_canonical || entry.official_url || entry.officialUrl),
    source_type: type,
    collection_id: clean(entry.collection_id || entry.collectionId),
    item_type: item,
    resource_type: section === "forms" ? "form" : "contact",
    municipality_id: municipalityId(entry),
    municipality_name: municipalityName(entry),
    source_status: currentAwareSourceStatus(entry) || "active",
    last_checked: lastChecked(entry),
    historical: historicalFlag(entry),
    evidence_strength: "strong"
  }).filter(([, value]) => value !== null && typeof value !== "undefined"));
}

function addSectionSource(pkg, section, source) {
  if (!Array.isArray(pkg?.sections?.[section]) || !source?.source_id) return;
  if (!pkg.sections[section].some(item => item.source_id === source.source_id)) {
    pkg.sections[section].push(source);
  }
  if (!pkg.source_ids.includes(source.source_id)) pkg.source_ids.push(source.source_id);
}

function buildEmptySections() {
  return Object.fromEntries(PACKAGE_SECTION_KEYS.map(key => [key, []]));
}

function sectionFilledCount(sections = {}) {
  return PACKAGE_SECTION_KEYS.filter(key => Array.isArray(sections[key]) && sections[key].length).length;
}

function confidenceForPackage(sections = {}) {
  const count = sectionFilledCount(sections);
  if (count >= 5) return "high";
  if (count >= 2) return "medium";
  return "low";
}

function latestDate(values = []) {
  const cleaned = values.map(clean).filter(Boolean).sort();
  return cleaned.length ? cleaned[cleaned.length - 1] : null;
}

function sectionCounts(sections = {}) {
  return Object.fromEntries(PACKAGE_SECTION_KEYS.map(key => [
    key,
    Array.isArray(sections[key]) ? sections[key].length : 0
  ]));
}

export function buildRuntimeSourcePackages(entries = []) {
  if (!Array.isArray(entries) || !entries.length) return [];

  const packages = new Map();
  entries.forEach((entry, index) => {
    const rawCanonicalId = canonicalItemId(entry);
    const canonicalId = normalizeSourcePackageCanonicalItemId(rawCanonicalId);
    const muniId = municipalityId(entry);
    const sections = seedPackageSectionsForEntry(entry);
    if (!canonicalId || !muniId || !sections.length) return;

    const key = `${muniId}::${canonicalId}`;
    if (!packages.has(key)) {
      const type = itemType(entry);
      packages.set(key, {
        package_id: packageIdFor(muniId, canonicalId),
        canonical_item_id: canonicalId,
        package_type: packageTypeFromItem(type),
        title: clean(entry.title) || canonicalId,
        municipality_id: muniId,
        municipality_name: municipalityName(entry) || undefined,
        sections: buildEmptySections(),
        source_ids: [],
        last_checked_values: [],
        confidence: "low",
        missing_sections: []
      });
    }

    const pkg = packages.get(key);
    if (!isServicePackageEntry(entry)) return;
    const id = sourceId(entry, index);
    const safeSource = safeSectionSource(entry, index);
    if (id && !pkg.source_ids.includes(id)) pkg.source_ids.push(id);
    if (lastChecked(entry)) pkg.last_checked_values.push(lastChecked(entry));
    if (!pkg.title && entry.title) pkg.title = clean(entry.title);
    for (const section of sections) {
      addSectionSource(pkg, section, safeSource);
    }
    for (const section of servicePagePartialSectionsForEntry(entry)) {
      addSectionSource(pkg, section, {
        ...safeSource,
        evidence_strength: "partial"
      });
    }
    for (const relatedId of relatedFormIds(entry)) {
      addSectionSource(pkg, "forms", safeRelatedSectionSource(entry, relatedId, "forms"));
    }
    for (const relatedId of relatedContactIds(entry)) {
      addSectionSource(pkg, "contacts", safeRelatedSectionSource(entry, relatedId, "contacts"));
    }
  });

  entries.forEach((entry, index) => {
    const id = sourceId(entry, index);
    if (!id) return;
    for (const pkg of packages.values()) {
      const sections = associationSectionsForEntry(entry, pkg);
      if (!sections.length) continue;
      const safeSource = safeSectionSource({
        ...entry,
        evidence_strength: isPartialAssociation(entry, pkg, sections[0])
          ? "partial"
          : explicitEvidenceStrength(entry)
      }, index);
      if (lastChecked(entry)) pkg.last_checked_values.push(lastChecked(entry));
      if (!pkg.source_ids.includes(id)) pkg.source_ids.push(id);
      for (const section of sections) {
        const sourceForSection = isPartialAssociation(entry, pkg, section)
          ? { ...safeSource, evidence_strength: "partial" }
          : safeSource;
        addSectionSource(pkg, section, sourceForSection);
      }
    }
  });

  for (const pkg of packages.values()) {
    enrichPackageFromCanonicalRelations(pkg);
  }

  return Array.from(packages.values()).map(pkg => {
    const last = latestDate(pkg.last_checked_values);
    const missing = PACKAGE_SECTION_KEYS.filter(key => !pkg.sections[key]?.length);
    return Object.fromEntries(Object.entries({
      package_id: pkg.package_id,
      canonical_item_id: pkg.canonical_item_id,
      package_type: pkg.package_type,
      title: pkg.title,
      municipality_id: pkg.municipality_id,
      municipality_name: pkg.municipality_name,
      sections: pkg.sections,
      section_counts: sectionCounts(pkg.sections),
      source_ids: pkg.source_ids,
      last_checked: last || undefined,
      confidence: confidenceForPackage(pkg.sections),
      missing_sections: missing
    }).filter(([, value]) => typeof value !== "undefined"));
  }).sort((a, b) => String(a.package_id).localeCompare(String(b.package_id)));
}
