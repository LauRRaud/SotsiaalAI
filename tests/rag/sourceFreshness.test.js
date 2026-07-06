import test from "node:test";
import assert from "node:assert/strict";

import {
  assessSourceFreshness,
  summarizeHighRiskSourceFreshness,
  normalizeSourceMetadataForFreshness,
  summarizeFreshnessAudit
} from "../../lib/rag/sourceFreshness.js";

const NOW = new Date("2026-04-26T12:00:00Z");

test("normalizes RagDocument metadata for freshness audit", () => {
  const normalized = normalizeSourceMetadataForFreshness({
    id: "doc_1",
      title: "Koduteenus",
      type: "document",
      status: "active",
      sourceUrl: "https://example.test/koduteenus",
      fileName: "tartu.rag.md",
      metadata: {
        source_id: "tartu_koduteenus",
        document_id: "kov::tartu::koduteenus",
        source_type: "kov_service_info",
        collection_id: "kov_services",
      source_status: "active",
      last_checked: "2026-04-25",
      municipality_id: "tartu_linn",
      sections_present: ["description", "forms"],
      related_forms_count: 1
    }
  });

  assert.equal(normalized.source_id, "tartu_koduteenus");
  assert.equal(normalized.document_id, "kov::tartu::koduteenus");
  assert.equal(normalized.title, "Koduteenus");
  assert.equal(normalized.source_type, "kov_service_info");
  assert.equal(normalized.collection_family, "kov_web");
  assert.equal(normalized.source_file_type, "rag_md");
  assert.equal(normalized.last_checked, "2026-04-25");
  assert.equal(normalized.url, "https://example.test/koduteenus");
  assert.deepEqual(normalized.sections_present, ["description", "forms"]);
  assert.equal(normalized.related_forms_count, 1);
});

test("normalizes legacy freshness aliases through canonical metadata contract", () => {
  const normalized = normalizeSourceMetadataForFreshness({
    id: "doc_legacy",
    title: "Legacy seadus",
    metadata: {
      canonical_source_id: "legacy-law",
      docId: "national-rt-legacy",
      source_type: "national_law",
      authority: "official_legal",
      language: "et",
      audience: "BOTH",
      checked_at: "2026-04-24T10:00:00Z",
      content_status: "current",
      effective_start: "2026-01-01T00:00:00Z",
      effective_end: "2026-12-31T00:00:00Z",
      is_current_version: false,
      url: "https://www.riigiteataja.ee/akt/123"
    }
  });

  assert.equal(normalized.source_id, "legacy-law");
  assert.equal(normalized.document_id, "national-rt-legacy");
  assert.equal(normalized.last_checked, "2026-04-24");
  assert.equal(normalized.source_status, "active");
  assert.equal(normalized.valid_from, "2026-01-01");
  assert.equal(normalized.valid_to, "2026-12-31");
  assert.equal(normalized.historical, true);
  assert.equal(normalized.url_canonical, "https://www.riigiteataja.ee/akt/123");
});

test("flags stale high-priority KOV forms as errors", () => {
  const result = assessSourceFreshness({
    source_id: "tartu_hooldajatoetus_vorm",
    title: "Hooldajatoetuse vorm",
    source_type: "application_form",
    source_status: "active",
    last_checked: "2025-10-01",
    historical: false
  }, {
    now: NOW
  });

  assert.equal(result.freshness_status, "stale");
  assert.equal(result.severity, "error");
  assert.ok(result.reasons.includes("last_checked_stale"));
  assert.equal(result.max_age_days, 90);
});

test("keeps background historical articles out of current freshness errors", () => {
  const result = assessSourceFreshness({
    source_id: "sotsiaaltoo_2017_voimaluste_kohvik",
    title: "Voimaluste kohvik",
    source_type: "journal_article",
    source_status: "active",
    historical: true
  }, {
    now: NOW
  });

  assert.equal(result.freshness_status, "missing_last_checked");
  assert.equal(result.severity, "warning");
  assert.equal(result.current_evidence, false);
});

test("summarizes freshness audit counts", () => {
  const result = summarizeFreshnessAudit([
    {
      source_id: "ok",
      title: "Teenuseinfo",
      source_type: "kov_service_info",
      source_status: "active",
      last_checked: "2026-04-20",
      url: "https://example.test/koduteenus"
    },
    {
      source_id: "stale",
      title: "Kontakt",
      source_type: "official_contact",
      source_status: "active",
      last_checked: "2025-12-01",
      url: "https://example.test/kontakt"
    },
    {
      source_id: "missing",
      title: "Vorm",
      source_type: "application_form",
      source_status: "active"
    }
  ], {
    now: NOW
  });

  assert.equal(result.ok, false);
  assert.equal(result.summary.total, 3);
  assert.equal(result.summary.ok, 1);
  assert.equal(result.summary.stale, 1);
  assert.equal(result.summary.missing_last_checked, 1);
  assert.equal(result.summary.errors, 2);
});

test("summarizes metadata contract completeness", () => {
  const result = summarizeFreshnessAudit([
    {
      source_id: "complete",
      document_id: "doc-complete",
      title: "Koduteenus",
      source_type: "kov_service_info",
      collection_id: "kov_services",
      legacy_source_type: "kov_dataset_item",
      authority: "KOV",
      language: "et",
      source_status: "active",
      municipality_id: "tartu_linn",
      last_checked: "2026-04-20",
      url: "https://example.test/koduteenus",
      content_hash: "abc123"
    },
    {
      source_id: "missing",
      document_id: "doc-missing",
      title: "Ajakirja artikkel",
      source_type: "journal_article",
      collection_id: "sotsiaaltoo_articles",
      fileName: "artikkel.json",
      language: "et",
      last_checked: "2026-04-20",
      url: "https://example.test/artikkel"
    }
  ], {
    now: NOW
  });

  assert.equal(result.summary.metadata_quality.complete, 1);
  assert.equal(result.summary.metadata_quality.incomplete, 1);
  assert.equal(result.summary.metadata_quality.completeness_rate, 0.5);
  assert.equal(result.summary.metadata_quality.missing_required_fields.authority, 1);
  assert.equal(result.summary.metadata_quality.missing_required_fields.source_status, undefined);
  assert.equal(result.summary.metadata_quality.missing_recommended_fields.content_hash, 1);
  assert.equal(result.summary.metadata_quality.by_collection.kov_web.complete, 1);
  assert.equal(result.summary.metadata_quality.by_collection.ajakiri_sotsiaaltoo.incomplete, 1);
  assert.equal(result.summary.metadata_quality.by_collection.ajakiri_sotsiaaltoo.missing_required_fields.authority, 1);
  assert.equal(result.summary.metadata_quality.by_file_type.kov_data_item.complete, 1);
  assert.equal(result.summary.metadata_quality.by_file_type.article_ingest.incomplete, 1);
  assert.equal(result.summary.metadata_quality.by_file_type.article_ingest.missing_required_fields.authority, 1);

  const missing = result.items.find(item => item.source_id === "missing");
  assert.equal(missing.remediation.action, "fill_required_metadata_fields");
  assert.deepEqual(missing.remediation.fields, ["authority"]);
  assert.equal(missing.remediation.target.collection_family, "ajakiri_sotsiaaltoo");
  assert.equal(missing.remediation.target.source_file_type, "article_ingest");
  assert.ok(missing.remediation.target.admin_href.startsWith("/admin/rag/ingest?"));
  const href = new URL(missing.remediation.target.admin_href, "https://example.test");
  assert.equal(href.pathname, "/admin/rag/ingest");
  assert.equal(href.searchParams.get("source"), "ajakiri_sotsiaaltoo");
  assert.equal(href.searchParams.get("remediation_action"), "fill_required_metadata_fields");
  assert.equal(href.searchParams.get("fields"), "authority");
  assert.equal(href.searchParams.get("recommended_fields"), "content_hash");
  assert.equal(href.searchParams.get("source_id"), "missing");
  assert.equal(href.searchParams.get("document_id"), "doc-missing");
  assert.equal(href.searchParams.get("suggested_source_type"), "journal_article");
  assert.equal(href.searchParams.get("suggested_authority"), "editorial");
  assert.equal(href.searchParams.get("focus"), "ingest_metadata");
});

test("flags invalid URLs and non-official contact sources", () => {
  const result = summarizeFreshnessAudit([
    {
      source_id: "contact_article",
      title: "Kontakt: teenusepakkuja",
      source_type: "journal_article",
      source_status: "active",
      last_checked: "2026-04-20",
      url: "not-a-url"
    }
  ], {
    now: NOW
  });

  assert.equal(result.summary.warnings, 1);
  assert.equal(result.items[0].freshness_status, "invalid_url");
  assert.ok(result.items[0].reasons.includes("invalid_url"));
  assert.ok(result.items[0].reasons.includes("contact_not_official_source"));
  assert.equal(result.summary.reasons.invalid_url, 1);
});

test("flags KOV service packages without a form source", () => {
  const result = summarizeFreshnessAudit([
    {
      source_id: "tartu_koduteenus",
      title: "Koduteenus",
      source_type: "kov_service_info",
      source_status: "active",
      last_checked: "2026-04-20",
      url: "https://example.test/koduteenus",
      canonical_item_id: "tartu_koduteenus",
      sections_present: ["description", "application", "forms"],
      related_forms_count: 1
    },
    {
      source_id: "tartu_koduteenus_contact",
      title: "Koduteenuse kontakt",
      source_type: "official_contact",
      source_status: "active",
      last_checked: "2026-04-20",
      url: "https://example.test/kontakt",
      canonical_item_id: "tartu_koduteenus"
    }
  ], {
    now: NOW
  });

  const service = result.items.find(item => item.source_id === "tartu_koduteenus");
  assert.equal(service.freshness_status, "kov_service_missing_form_source");
  assert.equal(service.severity, "warning");
  assert.ok(service.reasons.includes("kov_service_missing_form_source"));
  assert.equal(result.summary.reasons.kov_service_missing_form_source, 1);
});

test("does not infer missing KOV form source without package form signals", () => {
  const result = summarizeFreshnessAudit([
    {
      source_id: "tartu_koduteenus",
      title: "Koduteenus",
      source_type: "kov_service_info",
      source_status: "active",
      last_checked: "2026-04-20",
      url: "https://example.test/koduteenus",
      canonical_item_id: "tartu_koduteenus",
      sections_present: ["description", "application"]
    }
  ], {
    now: NOW
  });

  const service = result.items.find(item => item.source_id === "tartu_koduteenus");
  assert.equal(service.freshness_status, "ok");
  assert.equal(result.summary.reasons.kov_service_missing_form_source, undefined);
});

test("flags canonical item packages that mix municipalities", () => {
  const result = summarizeFreshnessAudit([
    {
      source_id: "tartu_koduteenus",
      document_id: "doc-tartu-koduteenus",
      title: "Koduteenus",
      source_type: "kov_service_info",
      authority: "KOV",
      language: "et",
      source_status: "active",
      last_checked: "2026-04-20",
      url: "https://tartu.example.test/koduteenus",
      municipality_id: "tartu_linn",
      canonical_item_id: "koduteenus"
    },
    {
      source_id: "voru_koduteenus",
      document_id: "doc-voru-koduteenus",
      title: "Koduteenus",
      source_type: "kov_service_info",
      authority: "KOV",
      language: "et",
      source_status: "active",
      last_checked: "2026-04-20",
      url: "https://voru.example.test/koduteenus",
      municipality_id: "voru_linn",
      canonical_item_id: "koduteenus"
    }
  ], {
    now: NOW
  });

  const tartu = result.items.find(item => item.source_id === "tartu_koduteenus");
  const voru = result.items.find(item => item.source_id === "voru_koduteenus");
  assert.equal(tartu.freshness_status, "canonical_item_municipality_conflict");
  assert.equal(voru.freshness_status, "canonical_item_municipality_conflict");
  assert.equal(tartu.severity, "warning");
  assert.ok(tartu.reasons.includes("canonical_item_municipality_conflict"));
  assert.equal(result.summary.reasons.canonical_item_municipality_conflict, 2);
  assert.equal(tartu.remediation.action, "resolve_canonical_item_municipality_conflict");
  assert.deepEqual(tartu.remediation.fields, ["canonical_item_id", "municipality_id"]);
  const href = new URL(tartu.remediation.target.admin_href, "https://example.test");
  assert.equal(href.pathname, "/admin/rag/kov");
  assert.equal(href.searchParams.get("municipality"), "tartu_linn");
  assert.equal(href.searchParams.get("remediation_action"), "resolve_canonical_item_municipality_conflict");
  assert.equal(href.searchParams.get("fields"), "canonical_item_id,municipality_id");
});

test("does not flag KOV service package when a form source exists", () => {
  const result = summarizeFreshnessAudit([
    {
      source_id: "tartu_koduteenus",
      title: "Koduteenus",
      source_type: "kov_service_info",
      source_status: "active",
      last_checked: "2026-04-20",
      url: "https://example.test/koduteenus",
      canonical_item_id: "tartu_koduteenus",
      sections_present: ["description", "application", "forms"],
      related_forms_count: 1
    },
    {
      source_id: "tartu_koduteenus_form",
      title: "Koduteenuse taotlus",
      source_type: "application_form",
      source_status: "active",
      last_checked: "2026-04-20",
      url: "https://example.test/taotlus",
      canonical_item_id: "tartu_koduteenus"
    }
  ], {
    now: NOW
  });

  const service = result.items.find(item => item.source_id === "tartu_koduteenus");
  assert.equal(service.freshness_status, "ok");
  assert.equal(service.severity, "info");
  assert.equal(result.summary.reasons.kov_service_missing_form_source, undefined);
});

test("flags KOV service packages with contact signals but no official contact source", () => {
  const result = summarizeFreshnessAudit([
    {
      source_id: "tartu_koduteenus",
      document_id: "doc-tartu-koduteenus",
      title: "Koduteenus",
      source_type: "kov_service_info",
      authority: "KOV",
      language: "et",
      source_status: "active",
      last_checked: "2026-04-20",
      url: "https://example.test/koduteenus",
      municipality_id: "tartu_linn",
      canonical_item_id: "tartu_koduteenus",
      sections_present: ["description", "contacts"],
      related_contacts_count: 1
    },
    {
      source_id: "tartu_koduteenus_article",
      document_id: "doc-tartu-koduteenus-article",
      title: "Koduteenuse taust",
      source_type: "journal_article",
      authority: "editorial",
      language: "et",
      source_status: "active",
      last_checked: "2026-04-20",
      url: "https://example.test/artikkel",
      canonical_item_id: "tartu_koduteenus"
    }
  ], {
    now: NOW
  });

  const service = result.items.find(item => item.source_id === "tartu_koduteenus");
  assert.equal(service.freshness_status, "kov_service_missing_official_contact_source");
  assert.equal(service.severity, "warning");
  assert.ok(service.reasons.includes("kov_service_missing_official_contact_source"));
  assert.equal(service.remediation.action, "add_or_link_official_contact_source");
  const href = new URL(service.remediation.target.admin_href, "https://example.test");
  assert.equal(href.pathname, "/admin/rag/kov");
  assert.equal(href.searchParams.get("remediation_action"), "add_or_link_official_contact_source");
  assert.equal(href.searchParams.get("fields"), "official_contact,contact_page,canonical_item_id");
  assert.equal(href.searchParams.get("source_id"), "tartu_koduteenus");
  assert.equal(href.searchParams.get("canonical_item_id"), "tartu_koduteenus");
  assert.equal(href.searchParams.get("focus"), "kov_web_links");
  assert.equal(result.summary.reasons.kov_service_missing_official_contact_source, 1);
});

test("adds file-level remediation focus for KOV data items", () => {
  const result = summarizeFreshnessAudit([
    {
      source_id: "tartu-koduteenus-item",
      document_id: "doc-tartu-koduteenus-item",
      title: "Koduteenus",
      source_type: "kov_service_info",
      source_status: "active",
      language: "et",
      last_checked: "2026-04-20",
      municipality_id: "tartu_linn",
      legacy_source_type: "kov_dataset_item",
      source_register_file: "tartu_linn.json",
      url: "https://example.test/koduteenus"
    }
  ], {
    now: NOW
  });

  const item = result.items[0];
  assert.equal(item.source_file_type, "kov_data_item");
  assert.equal(item.remediation.target.file_key, "dataJson");
  assert.equal(item.remediation.target.focus, "file");
  const href = new URL(item.remediation.target.admin_href, "https://example.test");
  assert.equal(href.pathname, "/admin/rag/kov");
  assert.equal(href.searchParams.get("municipality"), "tartu_linn");
  assert.equal(href.searchParams.get("source_file_type"), "kov_data_item");
  assert.equal(href.searchParams.get("focus"), "file");
  assert.equal(href.searchParams.get("file_key"), "dataJson");
});

test("summarizes stale source rate for high-risk traces", () => {
  const freshness = summarizeFreshnessAudit([
    {
      source_id: "law-ok",
      title: "Seadus",
      source_type: "national_law",
      source_status: "active",
      last_checked: "2026-04-20",
      url: "https://example.test/law"
    },
    {
      source_id: "kov-stale",
      title: "KOV teenus",
      source_type: "kov_service_info",
      source_status: "active",
      last_checked: "2025-01-01",
      url: "https://example.test/kov"
    }
  ], {
    now: NOW
  });

  const result = summarizeHighRiskSourceFreshness([
    {
      data: {
        rag_risk_level: "high",
        displayed_source_ids: ["law-ok"]
      }
    },
    {
      data: {
        rag_risk_level: "high",
        displayed_source_ids: ["kov-stale"]
      }
    },
    {
      data: {
        rag_risk_level: "medium",
        displayed_source_ids: ["kov-stale"]
      }
    },
    {
      data: {
        rag_risk_level: "high",
        displayed_source_ids: ["missing-source"]
      }
    }
  ], freshness.items);

  assert.equal(result.summary.high_risk_traces, 3);
  assert.equal(result.summary.high_risk_with_displayed_sources, 3);
  assert.equal(result.summary.stale_source_responses, 1);
  assert.equal(result.summary.unknown_source_responses, 1);
  assert.equal(result.summary.stale_source_rate, 1 / 3);
  assert.equal(result.summary.unknown_source_freshness_rate, 1 / 3);
  assert.equal(result.summary.displayed_source_stale_rate, 1 / 3);
  assert.equal(result.summary.displayed_unknown_source_rate, 1 / 3);
  assert.equal(result.summary.issue_reasons.last_checked_stale, 1);
});

test("keeps high-risk answer source risk separate from displayed source risk", () => {
  const freshness = summarizeFreshnessAudit([
    {
      source_id: "fresh-displayed",
      title: "Kuvatav seadus",
      source_type: "national_law",
      source_status: "active",
      last_checked: "2026-04-20",
      url: "https://example.test/fresh"
    },
    {
      source_id: "stale-answer",
      title: "Vana KOV teenus",
      source_type: "kov_service_info",
      source_status: "active",
      last_checked: "2025-01-01",
      url: "https://example.test/stale"
    }
  ], {
    now: NOW
  });

  const result = summarizeHighRiskSourceFreshness([
    {
      data: {
        rag_risk_level: "high",
        answer_source_ids: ["stale-answer"],
        displayed_source_ids: ["fresh-displayed"]
      }
    }
  ], freshness.items);

  assert.equal(result.summary.high_risk_with_answer_sources, 1);
  assert.equal(result.summary.high_risk_with_displayed_sources, 1);
  assert.equal(result.summary.stale_answer_source_responses, 1);
  assert.equal(result.summary.stale_displayed_source_responses, 0);
  assert.equal(result.summary.answer_source_stale_rate, 1);
  assert.equal(result.summary.displayed_source_stale_rate, 0);
  assert.equal(result.summary.stale_source_rate, 0);
  assert.ok(result.issues.some(item => item.layer === "answer" && item.source_id === "stale-answer"));
});

test("tracks high-risk claim source freshness separately from answer and displayed sources", () => {
  const freshness = summarizeFreshnessAudit([
    {
      source_id: "fresh-law",
      title: "Kehtiv seadus",
      source_type: "national_law",
      source_status: "active",
      last_checked: "2026-04-20",
      url: "https://example.test/law"
    },
    {
      source_id: "stale-kov",
      title: "Vana KOV leht",
      source_type: "kov_service_info",
      source_status: "active",
      last_checked: "2025-01-01",
      url: "https://example.test/kov"
    }
  ], {
    now: NOW
  });

  const result = summarizeHighRiskSourceFreshness([
    {
      data: {
        rag_risk_level: "high",
        answer_source_ids: ["fresh-law"],
        displayed_source_ids: ["fresh-law"],
        claim_attributions: [
          {
            claim_id: "jogeva_koduteenus_application",
            claim_type: "application_step",
            evidence_source_ids: ["stale-kov"]
          },
          {
            claim_id: "missing_claim",
            claim_type: "eligibility",
            source_id: "missing-source"
          }
        ]
      }
    }
  ], freshness.items);

  assert.equal(result.ok, false);
  assert.equal(result.summary.high_risk_with_claim_sources, 1);
  assert.equal(result.summary.high_risk_claim_source_count, 2);
  assert.equal(result.summary.stale_claim_source_responses, 1);
  assert.equal(result.summary.unknown_claim_source_responses, 1);
  assert.equal(result.summary.claim_source_stale_rate, 1);
  assert.equal(result.summary.claim_unknown_source_rate, 1);
  assert.equal(result.summary.claim_source_risk_readiness_rate, 1);
  assert.equal(result.summary.stale_source_rate, 0);
  assert.ok(result.issues.some(item =>
    item.layer === "claim" &&
    item.source_id === "stale-kov" &&
    item.claim_refs?.[0]?.claim_id === "jogeva_koduteenus_application"
  ));
});

test("matches Riigi Teataja paragraph-level source ids to act-level freshness metadata", () => {
  const freshness = summarizeFreshnessAudit([
    {
      source_id: "national_rt_130122025029",
      document_id: "national-rt-130122025029",
      title: "Sotsiaalhoolekande seadus",
      source_type: "national_law",
      authority: "official_legal",
      language: "et",
      source_status: "active",
      act_reference: "130122025029",
      last_checked: "2026-04-20",
      url: "https://www.riigiteataja.ee/akt/130122025029"
    }
  ], {
    now: NOW
  });

  const result = summarizeHighRiskSourceFreshness([
    {
      data: {
        rag_risk_level: "high",
        answer_source_ids: [
          "rt-130122025029|paragraph-132|Toimetulekutoetuse taotlemine"
        ],
        displayed_source_ids: [
          "riigiteataja:130122025029:paragraph-131"
        ]
      }
    }
  ], freshness.items);

  assert.equal(result.summary.high_risk_answer_source_count, 1);
  assert.equal(result.summary.matched_answer_source_count, 1);
  assert.equal(result.summary.unknown_answer_source_count, 0);
  assert.equal(result.summary.matched_displayed_source_count, 1);
  assert.equal(result.summary.unknown_displayed_source_count, 0);
  assert.equal(result.issues.length, 0);
});

test("matches pipe-separated Riigi Teataja paragraph ids through document id aliases", () => {
  const freshness = summarizeFreshnessAudit([
    {
      source_id: "sotsiaalhoolekande-seadus",
      document_id: "national-rt-130122025029",
      title: "Sotsiaalhoolekande seadus",
      source_type: "national_law",
      authority: "official_legal",
      language: "et",
      source_status: "active",
      last_checked: "2026-04-20",
      url: "https://www.riigiteataja.ee/akt/130122025029"
    }
  ], {
    now: NOW
  });

  const result = summarizeHighRiskSourceFreshness([
    {
      data: {
        rag_risk_level: "high",
        answer_source_ids: [
          "rt-130122025029|paragraph-132|Toimetulekutoetuse taotlemine",
          "rt-130122025029|paragraph-133|Toimetulekutoetuse arvestamise alused"
        ]
      }
    }
  ], freshness.items);

  assert.equal(result.summary.high_risk_answer_source_count, 2);
  assert.equal(result.summary.matched_answer_source_count, 2);
  assert.equal(result.summary.unknown_answer_source_count, 0);
  assert.equal(result.issues.length, 0);
});
