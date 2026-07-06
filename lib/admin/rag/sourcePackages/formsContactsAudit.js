const FORM_SOURCE_TYPES = new Set(["application_form", "web_form", "pdf_form", "official_form"]);
const CONTACT_SOURCE_TYPES = new Set(["official_contact", "contact_page"]);
const FORM_RESOURCE_TYPES = new Set(["form", "application_form", "web_form", "pdf_form", "official_form"]);
const CONTACT_RESOURCE_TYPES = new Set(["contact", "official_contact", "contact_page"]);
const MAX_TEXT_VALUE = 160;

function clean(value) {
  const text = String(value || "").trim();
  return text || null;
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values = []) {
  return [...new Set(arrayValue(values).map(clean).filter(Boolean))].sort();
}

function normalizeSourcePackageAuditCanonicalItemId(value) {
  let text = clean(value);
  if (!text) return null;
  const duplicatePrefixes = [
    "jogeva_vald_service_jogeva_vald_service_",
    "jogeva_vald_benefit_jogeva_vald_benefit_"
  ];
  for (const prefix of duplicatePrefixes) {
    if (text.startsWith(prefix)) {
      return text.replace(prefix, prefix.slice(0, prefix.indexOf("_jogeva_vald_") + 1));
    }
  }
  return text;
}

function compactText(value) {
  const text = clean(value);
  if (!text) return null;
  return text.length > MAX_TEXT_VALUE ? `${text.slice(0, MAX_TEXT_VALUE - 3)}...` : text;
}

function sourceId(source = {}) {
  return clean(source.source_id || source.sourceId || source.document_id || source.documentId || source.id || source.key);
}

function sourceKey(source = {}) {
  return clean(source.key || source.source_key || source.sourceKey || source.id);
}

function sourceType(source = {}) {
  return clean(source.source_type || source.sourceType || source.type);
}

function resourceType(source = {}) {
  return clean(source.resource_type || source.resourceType);
}

function itemType(source = {}) {
  return clean(source.itemType || source.item_type || source.item_type);
}

function titleOf(source = {}) {
  return clean(source.title || source.name || source.label);
}

function urlOf(source = {}) {
  return clean(source.url_canonical || source.url || source.officialUrl || source.href);
}

function municipalityIdOf(source = {}) {
  return clean(source.municipality_id || source.municipalityId);
}

function isFormSource(source = {}) {
  return FORM_SOURCE_TYPES.has(sourceType(source)) ||
    FORM_RESOURCE_TYPES.has(resourceType(source)) ||
    itemType(source) === "form";
}

function isContactSource(source = {}) {
  return CONTACT_SOURCE_TYPES.has(sourceType(source)) ||
    CONTACT_RESOURCE_TYPES.has(resourceType(source)) ||
    itemType(source) === "contact";
}

function isServiceItem(item = {}) {
  const type = itemType(item);
  return type && !["form", "contact"].includes(type);
}

function safeSourceSummary(source = {}) {
  return {
    source_id: sourceId(source),
    key: sourceKey(source),
    title: compactText(titleOf(source)),
    source_type: sourceType(source),
    resource_type: resourceType(source),
    item_type: itemType(source),
    municipality_id: municipalityIdOf(source),
    url: urlOf(source)
  };
}

function containsLongText(value) {
  if (typeof value === "string") return value.length > 260;
  if (Array.isArray(value)) return value.some(containsLongText);
  if (value && typeof value === "object") return Object.values(value).some(containsLongText);
  return false;
}

function byId(items = []) {
  return new Map(arrayValue(items).map(item => [clean(item.id || item.source_id || item.key), item]).filter(([id]) => id));
}

function sourcesByKey(sources = []) {
  return new Map(arrayValue(sources).map(source => [sourceKey(source), source]).filter(([key]) => key));
}

function normalizeRegistryDocuments(registry) {
  if (!registry) return [];
  if (Array.isArray(registry)) return registry;
  const candidates = [
    registry.documents,
    registry.sources,
    registry.items,
    registry.records,
    registry.data
  ];
  for (const value of candidates) {
    if (Array.isArray(value)) return value;
  }
  if (typeof registry === "object") return Object.values(registry).filter(value => value && typeof value === "object");
  return [];
}

function mergeMetadata(record = {}) {
  const metadata = record.metadata && typeof record.metadata === "object" ? record.metadata : {};
  return { ...metadata, ...record };
}

function normalizeSourceRecords(records = [], origin = "registry") {
  return arrayValue(records)
    .map(mergeMetadata)
    .map(record => ({ ...record, origin }))
    .filter(record => sourceId(record) || sourceKey(record) || titleOf(record));
}

function sourceKeyMatchesItem(item = {}, source = {}) {
  const keys = arrayValue(item.sourceKeys).map(clean).filter(Boolean);
  if (!keys.length) return false;
  return keys.includes(sourceKey(source)) || keys.includes(sourceId(source));
}

function relationSourceCandidates(relatedId, itemById, sourceByKey, sourceRecords, kind) {
  const relatedItem = itemById.get(relatedId);
  const directSources = [];
  if (relatedItem) {
    for (const key of arrayValue(relatedItem.sourceKeys)) {
      const source = sourceByKey.get(clean(key));
      if (source) directSources.push(source);
    }
  }

  const matchingRecords = sourceRecords.filter(source => {
    const id = sourceId(source);
    if (id === relatedId || sourceKey(source) === relatedId) return true;
    if (relatedItem && sourceKeyMatchesItem(relatedItem, source)) return true;
    if (kind === "forms" && isFormSource(source) && urlOf(source) && relatedItem?.officialUrl && urlOf(source) === relatedItem.officialUrl) return true;
    if (kind === "contacts" && isContactSource(source) && urlOf(source) && relatedItem?.officialUrl && urlOf(source) === relatedItem.officialUrl) return true;
    return false;
  });

  const allSources = [...directSources, ...matchingRecords];
  const allowedSources = allSources.filter(source => kind === "forms" ? isFormSource(source) : isContactSource(source));
  return allowedSources.length ? allowedSources : allSources;
}

function packageForService(service = {}, snapshots = []) {
  const id = normalizeSourcePackageAuditCanonicalItemId(service.id);
  return arrayValue(snapshots).find(snapshot =>
    normalizeSourcePackageAuditCanonicalItemId(snapshot.canonicalItemId || snapshot.canonical_item_id) === id ||
    clean(snapshot.packageId || snapshot.package_id)?.includes(id)
  ) || null;
}

function sectionSourceIdsFromSnapshot(snapshot = {}, section) {
  const sectionSummary = snapshot?.sectionSummary && typeof snapshot.sectionSummary === "object"
    ? snapshot.sectionSummary
    : {};
  return unique(sectionSummary?.[section]?.source_ids);
}

function relationIds(service = {}, kind) {
  return kind === "forms"
    ? unique(service.relatedForms)
    : unique(service.relatedContacts);
}

function itemSignals(service = {}, kind) {
  const values = [
    service.summary,
    service.conditions,
    service.application,
    service.targetGroup,
    service.amount,
    service.deadline,
    service.decisionTime,
    service.officialUrl
  ].map(value => String(value || "").toLowerCase()).join(" ");

  if (kind === "forms") {
    return {
      has_form_reference: /\b(vorm|blankett|taotlus|taotlusvorm|pdf|docx)\b/i.test(values)
    };
  }

  return {
    has_contact_reference: /(kontakt|telefon|e-post|email|@|\b\d{3,}[\s\d]+)\b/i.test(values)
  };
}

function reasonForMissing({ kind, service, related, relatedItems, candidateSources, registryCandidates, packageSourceIds }) {
  if (packageSourceIds.length) return "present";
  if (related.length && candidateSources.length) return "relation_exists_but_not_indexed";
  if (related.length && relatedItems.length && !candidateSources.length) return "relation_exists_but_not_indexed";
  if (related.length && !relatedItems.length) return "relation_exists_but_not_indexed";
  if (registryCandidates.length) return "registry_candidate_without_relation";

  const signals = itemSignals(service, kind);
  if (kind === "forms" && signals.has_form_reference) return "service_page_contains_form_but_not_extracted";
  if (kind === "contacts" && signals.has_contact_reference) return "service_page_contains_contact_but_not_extracted";
  return "no_registry_candidate";
}

function metadataIssues(kind, candidateSources = []) {
  return candidateSources
    .filter(source => kind === "forms" ? !isFormSource(source) : !isContactSource(source))
    .map(source => sourceId(source))
    .filter(Boolean);
}

function recommendedForReason(reason) {
  if (reason === "relation_exists_but_not_indexed") {
    return "index related form/contact items as retrievable SourcePackage evidence or pass relation candidates into the package builder";
  }
  if (reason === "registry_candidate_without_relation") {
    return "add service-to-form/contact relation metadata before package mapping";
  }
  if (reason === "metadata_type_missing") {
    return "fix source_type/resource_type/item_type metadata for form/contact evidence";
  }
  if (reason?.startsWith("service_page_contains_")) {
    return "extract embedded form/contact references into structured source metadata";
  }
  if (reason === "no_registry_candidate") {
    return "add or ingest missing form/contact source metadata";
  }
  return "no action needed";
}

function auditKind({ service, kind, itemById, sourceByKey, sourceRecords, registryCandidates, snapshot }) {
  const related = relationIds(service, kind);
  const relatedItems = related.map(id => itemById.get(id)).filter(Boolean);
  const candidateSources = related.flatMap(id => relationSourceCandidates(id, itemById, sourceByKey, sourceRecords, kind));
  const metadataIssueIds = metadataIssues(kind, candidateSources);
  const packageSourceIds = sectionSourceIdsFromSnapshot(snapshot, kind);
  let reason = reasonForMissing({
    kind,
    service,
    related,
    relatedItems,
    candidateSources,
    registryCandidates,
    packageSourceIds
  });

  if (reason === "relation_exists_but_not_indexed" && metadataIssueIds.length === candidateSources.length && candidateSources.length) {
    reason = "metadata_type_missing";
  }

  return {
    status: packageSourceIds.length ? "present" : "missing",
    reason: packageSourceIds.length ? null : reason,
    related_ids: related,
    related_items_found: relatedItems.length,
    candidate_source_ids: unique(candidateSources.map(sourceId)),
    registry_candidate_ids: unique(registryCandidates.map(sourceId)),
    package_source_ids: packageSourceIds,
    metadata_issue_source_ids: unique(metadataIssueIds),
    signals: itemSignals(service, kind),
    recommended_next_step: packageSourceIds.length ? null : recommendedForReason(reason)
  };
}

function reasonCounts(services = [], kind) {
  return services.reduce((acc, service) => {
    const reason = service[kind]?.reason || (service[kind]?.status === "present" ? "present" : "unknown");
    acc[reason] = (acc[reason] || 0) + 1;
    return acc;
  }, {});
}

function summarizeSources(sources = []) {
  return sources
    .map(safeSourceSummary)
    .filter(source => source.source_id || source.key)
    .sort((a, b) => String(a.source_id || a.key).localeCompare(String(b.source_id || b.key)));
}

function globalRecommendation(report) {
  const formsReasons = report.summary.reason_counts.forms || {};
  const contactsReasons = report.summary.reason_counts.contacts || {};
  if (formsReasons.relation_exists_but_not_indexed || contactsReasons.relation_exists_but_not_indexed) {
    return "Local inputs contain related form/contact items, but they are not present in SourcePackage snapshots; fix KOV ingest/package candidate mapping.";
  }
  if (formsReasons.registry_candidate_without_relation || contactsReasons.registry_candidate_without_relation) {
    return "Form/contact sources exist, but service relation metadata is incomplete.";
  }
  if (formsReasons.no_registry_candidate && contactsReasons.no_registry_candidate) {
    return "Form/contact sources are missing from the input/registry and need ingestion or extraction.";
  }
  return "Review per-service reasons before changing package mapping.";
}

export function buildFormsContactsAudit(input = {}) {
  const municipalityId = input.municipalityId || "jogeva_vald";
  const localData = input.localData || {};
  const localSourcesData = input.localSourcesData || {};
  const registryDocs = normalizeSourceRecords(normalizeRegistryDocuments(input.registry), "registry")
    .filter(source => !municipalityIdOf(source) || municipalityIdOf(source) === municipalityId);
  const localItems = arrayValue(localData.items);
  const sourceRecords = [
    ...normalizeSourceRecords(arrayValue(localSourcesData.sources), "local_sources"),
    ...registryDocs
  ];
  const itemById = byId(localItems);
  const sourceByKey = sourcesByKey(sourceRecords);
  const snapshotRows = arrayValue(input.snapshots);
  const snapshotCanonicalIds = new Set(snapshotRows
    .map(snapshot => normalizeSourcePackageAuditCanonicalItemId(snapshot.canonicalItemId || snapshot.canonical_item_id))
    .filter(Boolean));
  const services = localItems
    .filter(isServiceItem)
    .filter(item => !snapshotCanonicalIds.size || snapshotCanonicalIds.has(normalizeSourcePackageAuditCanonicalItemId(item.id)));
  const formItems = localItems.filter(item => itemType(item) === "form");
  const contactItems = localItems.filter(item => itemType(item) === "contact");
  const formSources = sourceRecords.filter(isFormSource);
  const contactSources = sourceRecords.filter(isContactSource);
  const registryFormSources = registryDocs.filter(isFormSource);
  const registryContactSources = registryDocs.filter(isContactSource);

  const auditedServices = services.map(service => {
    const snapshot = packageForService(service, input.snapshots);
    const forms = auditKind({
      service,
      kind: "forms",
      itemById,
      sourceByKey,
      sourceRecords,
      registryCandidates: formSources,
      snapshot
    });
    const contacts = auditKind({
      service,
      kind: "contacts",
      itemById,
      sourceByKey,
      sourceRecords,
      registryCandidates: contactSources,
      snapshot
    });

    return {
      service_id: clean(service.id),
      title: compactText(titleOf(service)),
      package_id: clean(snapshot?.packageId || snapshot?.package_id),
      relatedForms: forms.related_ids,
      relatedContacts: contacts.related_ids,
      forms,
      contacts
    };
  });

  const report = {
    ok: true,
    municipality_id: municipalityId,
    registry_available: input.registryAvailable !== false,
    snapshot_available: input.snapshotAvailable !== false,
    localJsonFound: input.localJsonFound !== false && !!localData.items,
    localDataSourcePath: input.localDataSourcePath || null,
    checkedPaths: input.checkedPaths || {},
    summary: {
      active_snapshot_count: snapshotRows.length,
      services_audited: auditedServices.length,
      local_form_items: formItems.length,
      local_contact_items: contactItems.length,
      local_form_sources: normalizeSourceRecords(arrayValue(localSourcesData.sources), "local_sources").filter(isFormSource).length,
      local_contact_sources: normalizeSourceRecords(arrayValue(localSourcesData.sources), "local_sources").filter(isContactSource).length,
      registry_form_sources: registryFormSources.length,
      registry_contact_sources: registryContactSources.length,
      candidate_form_sources: unique(formSources.map(sourceId)).length,
      candidate_contact_sources: unique(contactSources.map(sourceId)).length,
      services_with_related_forms: auditedServices.filter(service => service.relatedForms.length).length,
      services_with_related_contacts: auditedServices.filter(service => service.relatedContacts.length).length,
      reason_counts: {
        forms: reasonCounts(auditedServices, "forms"),
        contacts: reasonCounts(auditedServices, "contacts")
      }
    },
    sources: {
      forms: summarizeSources(formSources),
      contacts: summarizeSources(contactSources)
    },
    services: auditedServices
  };
  report.recommended_next_step = globalRecommendation(report);
  report.safe_output = !containsLongText(report);
  return report;
}

export const normalizeJogevaCanonicalItemId = normalizeSourcePackageAuditCanonicalItemId;
export const buildJogevaFormsContactsAudit = buildFormsContactsAudit;
