import test from "node:test";
import assert from "node:assert/strict";

import {
  canSupportClaimType,
  evidenceRoleFor,
  isKovRegulationSource,
  isKovSource,
  isKovWebSource,
  normalizeRagSourceMetadata,
  normalizeCollectionId,
  normalizeSourceType,
  RAG_METADATA_SCHEMA_VERSION,
  inferKovItemRagSourceType,
  isLegalSource,
  isKnownRagSourceStatus,
  isKnownRagSourceType,
  isMaterialSource,
  isNationalLawSource,
  isOrganizationSource,
  isPublicBodyInfoSource,
  isResearchOrJournalSource,
  mapKovItemStatusToRagSourceStatus,
  sourceLayerFor,
  validateRagSourceMetadataContract
} from "../../lib/rag/sourceMetadata.js";

test("known RAG source types and statuses cover V1 contract values", () => {
  assert.equal(isKnownRagSourceType("kov_service_info"), true);
  assert.equal(isKnownRagSourceType("application_form"), true);
  assert.equal(isKnownRagSourceType("official_contact"), true);
  assert.equal(isKnownRagSourceType("journal_article"), true);
  assert.equal(isKnownRagSourceType("unknown_custom_type"), false);

  assert.equal(isKnownRagSourceStatus("active"), true);
  assert.equal(isKnownRagSourceStatus("stale"), true);
  assert.equal(isKnownRagSourceStatus("draft"), false);
});

test("KOV item metadata maps to evidence-aware RAG source types", () => {
  assert.equal(inferKovItemRagSourceType("service"), "kov_service_info");
  assert.equal(inferKovItemRagSourceType("benefit"), "kov_service_info");
  assert.equal(inferKovItemRagSourceType("form"), "application_form");
  assert.equal(inferKovItemRagSourceType("contact"), "official_contact");
  assert.equal(inferKovItemRagSourceType("resource", "guidance"), "state_guide");
  assert.equal(inferKovItemRagSourceType("resource", "provider"), "partner_service_info");
});

test("KOV item status maps to RAG source status", () => {
  assert.equal(mapKovItemStatusToRagSourceStatus("active"), "active");
  assert.equal(mapKovItemStatusToRagSourceStatus("ended"), "inactive");
  assert.equal(mapKovItemStatusToRagSourceStatus("inactive"), "inactive");
  assert.equal(mapKovItemStatusToRagSourceStatus("unclear"), "unknown");
});

test("RAG source metadata contract enforces critical V2 fields", () => {
  const valid = validateRagSourceMetadataContract({
    metadata_schema_version: RAG_METADATA_SCHEMA_VERSION,
    source_id: "tartu_koduteenus",
    document_id: "kov::tartu::item::koduteenus",
    title: "Koduteenus",
    source_type: "kov_service_info",
    authority: "KOV",
    audience: ["CLIENT", "SOCIAL_WORKER"],
    language: "et",
    municipality_id: "tartu_linn",
    last_checked: "2026-04-25",
    historical: false,
    source_status: "active"
  }, {
    requireMunicipality: true,
    requireMetadataSchemaVersion: true
  });

  assert.equal(valid.ok, true);
  assert.deepEqual(valid.errors, []);
  assert.ok(valid.warnings.some(item => item.includes("content_hash")));

  const invalid = validateRagSourceMetadataContract({
    source_id: "bad",
    document_id: "doc",
    title: "Bad",
    source_type: "journal_article",
    authority: "editorial",
    audience: ["CLIENT"],
    language: "et",
    last_checked: "2026-04-25",
    historical: true,
    source_status: "active"
  }, {
    label: "source",
    requireMunicipality: true
  });

  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.includes("source.municipality_id: missing required RAG metadata"));
});

test("normalizes legacy metadata aliases into canonical fields", () => {
  const normalized = normalizeRagSourceMetadata({
    canonical_source_id: "legacy-source",
    docId: "legacy-doc",
    checked_at: "2026-04-26T10:15:00Z",
    content_status: "current",
    effective_start: "2026-01-01T00:00:00Z",
    effective_end: "2026-12-31T00:00:00Z",
    is_current_version: false,
    url: "https://example.test/source",
    sourceKeys: ["registry_entry", "official_page"],
    language: "et",
    source_type: "national_law",
    authority: "official_legal",
    title: "Seadus",
    audience: "BOTH"
  });

  assert.equal(normalized.metadata_schema_version, RAG_METADATA_SCHEMA_VERSION);
  assert.equal(normalized.source_id, "legacy-source");
  assert.equal(normalized.document_id, "legacy-doc");
  assert.equal(normalized.last_checked, "2026-04-26");
  assert.equal(normalized.source_status, "active");
  assert.equal(normalized.valid_from, "2026-01-01");
  assert.equal(normalized.valid_to, "2026-12-31");
  assert.equal(normalized.historical, true);
  assert.equal(normalized.url_canonical, "https://example.test/source");
  assert.deepEqual(normalized.source_urls, ["registry_entry", "official_page"]);
});

test("normalizes officialUrl and sourceKeys aliases for KOV item-style inputs", () => {
  const normalized = normalizeRagSourceMetadata({
    title: "Koduteenus",
    source_type: "kov_service_info",
    authority: "KOV",
    language: "et",
    audience: ["CLIENT", "SOCIAL_WORKER"],
    officialUrl: "https://example.test/koduteenus",
    sourceKeys: ["koduteenus_page"],
    municipality: "Jõgeva vald"
  });

  assert.equal(normalized.url_canonical, "https://example.test/koduteenus");
  assert.deepEqual(normalized.source_urls, ["koduteenus_page"]);
  assert.equal(normalized.municipality_name, "Jõgeva vald");
});

test("normalizes legacy Sotsiaaltoo article metadata from file source type", () => {
  const normalized = normalizeRagSourceMetadata({
    docId: "sotsiaaltoo-4-2019",
    articleId: "omavalitsuste-noustamisuksus-2019",
    title: "Omavalitsuste jaoks loodud nõustamisüksus",
    authors: ["Heli Ferschel", "Evelyn Hallika"],
    year: 2019,
    journalTitle: "Sotsiaaltöö",
    issueLabel: "4/2019",
    section: "Sotsiaaltöö korraldus",
    pageRange: "20-23",
    audience: "BOTH",
    language: "et",
    source_type: "file",
    source_path: "ST4_2019_web_link_Part8.pdf"
  });

  assert.equal(normalized.source_type, "journal_article");
  assert.equal(normalized.collection_id, "sotsiaaltoo_articles");
  assert.equal(normalized.authority, "editorial");
  assert.equal(normalized.document_id, "sotsiaaltoo-4-2019");
  assert.equal(normalized.source_id, "omavalitsuste-noustamisuksus-2019");
  assert.equal(normalized.articleId, "omavalitsuste-noustamisuksus-2019");
  assert.equal(normalized.journalTitle, "Sotsiaaltöö");
  assert.equal(normalized.issueLabel, "4/2019");
  assert.equal(normalized.year, 2019);
  assert.deepEqual(normalized.authors, ["Heli Ferschel", "Evelyn Hallika"]);
  assert.equal(normalized.section, "Sotsiaaltöö korraldus");
  assert.equal(normalized.pageRange, "20-23");
  assert.equal(normalized.historical, true);
  assert.equal(normalized.source_status, "active");
  assert.equal(normalized.url_canonical, null);
  assert.equal(normalized.source_path, "ST4_2019_web_link_Part8.pdf");
});

test("derives source status from version flags when explicit canonical status is missing", () => {
  const archived = normalizeRagSourceMetadata({
    source_type: "journal_article",
    authority: "editorial",
    title: "Artikkel",
    language: "et",
    audience: ["CLIENT"],
    isCurrentVersion: false
  });
  const active = normalizeRagSourceMetadata({
    source_type: "journal_article",
    authority: "editorial",
    title: "Artikkel",
    language: "et",
    audience: ["CLIENT"],
    isCurrentVersion: true
  });

  assert.equal(archived.source_status, "archived");
  assert.equal(archived.historical, true);
  assert.equal(active.source_status, "active");
  assert.equal(active.historical, false);
});

test("source layer helpers normalize legacy and runtime source aliases", () => {
  assert.equal(normalizeSourceType({ source_type: "municipality_kov" }), "kov_service_info");
  assert.equal(normalizeSourceType({ source_type: "municipal_regulation" }), "kov_regulation");
  assert.equal(normalizeSourceType({ source_type: "kov_service_page" }), "kov_service_info");
  assert.equal(normalizeSourceType({ source_type: "research" }), "research_report");
  assert.equal(normalizeSourceType({ source_type: "analysis" }), "policy_analysis");
  assert.equal(normalizeCollectionId({ collection_id: "journal_articles" }), "sotsiaaltoo_articles");
  assert.equal(normalizeCollectionId({ collection_id: "kov_regulations" }), "kov_legal");

  assert.equal(isNationalLawSource({ source_type: "national_law", collection_id: "national_regulations" }), true);
  assert.equal(isKovRegulationSource({ source_type: "riigiteataja_regulation", collection_id: "kov_legal" }), true);
  assert.equal(isKovSource({ source_type: "municipality_kov", municipality_id: "kuusalu_vald" }), true);
  assert.equal(sourceLayerFor({ source_type: "kov_service_page" }), "kov_web");
  assert.equal(isKovWebSource({ source_type: "contact_page", resource_type: "contact" }), false);
  assert.equal(isKovWebSource({ source_type: "contact_page", resource_type: "contact", municipality_id: "kuusalu_vald" }), true);
  assert.equal(isLegalSource({ source_type: "riigiteataja_regulation", collection_id: "national_regulations" }), true);
});

test("source layer helpers classify organizations materials research and public body info", () => {
  assert.equal(isOrganizationSource({
    source_type: "organization_profile",
    collection_id: "organizations",
    organization_id: "astangu"
  }), true);
  assert.equal(sourceLayerFor({
    source_type: "organization_profile",
    collection_id: "organizations",
    organization_id: "astangu"
  }), "organization");

  assert.equal(isMaterialSource({ source_type: "training_material", collection_id: "training_materials" }), true);
  assert.equal(sourceLayerFor({ source_type: "official_guideline", resource_type: "method_guidance" }), "guidance");

  assert.equal(isResearchOrJournalSource({ source_type: "journal_article", collection_id: "sotsiaaltoo_articles" }), true);
  assert.equal(isResearchOrJournalSource({ resource_type: "research_evidence", evidence_role: "research_evidence" }), true);

  assert.equal(isPublicBodyInfoSource({ organization_id: "sotsiaalkindlustusamet", source_type: "information_material" }), true);
  assert.equal(evidenceRoleFor({ source_type: "organization_profile", collection_id: "organizations" }), "organization_background");
  assert.equal(evidenceRoleFor({ source_type: "journal_article", collection_id: "sotsiaaltoo_articles" }), "research_evidence");
});

test("source layer helpers gate claim support by source family", () => {
  const shs = { source_type: "national_law", collection_id: "national_regulations" };
  const kovService = { source_type: "kov_service_info", collection_id: "kov_services", municipality_id: "kuusalu_vald" };
  const org = { source_type: "organization_profile", collection_id: "organizations", organization_id: "astangu" };
  const article = { source_type: "journal_article", collection_id: "sotsiaaltoo_articles" };
  const guide = { source_type: "official_guideline", resource_type: "method_guidance" };

  assert.equal(canSupportClaimType(shs, "legal_entitlement"), true);
  assert.equal(canSupportClaimType(article, "legal_entitlement"), false);
  assert.equal(canSupportClaimType(kovService, "municipal_service_availability"), true);
  assert.equal(canSupportClaimType(org, "organization_background"), true);
  assert.equal(canSupportClaimType(guide, "practice_guidance"), true);
  assert.equal(canSupportClaimType(article, "background_context"), true);
  assert.equal(canSupportClaimType(article, "application_deadline"), false);
});
