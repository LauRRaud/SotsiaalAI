import assert from "node:assert/strict";
import test from "node:test";

import {
  buildKnowledgeDocIngestPayload,
  DISALLOWED_CURRENT_EVIDENCE_CLAIMS,
  upgradeKnowledgeMetadata,
  validateKnowledgeMetadata
} from "../../scripts/lib/knowledge-docs.mjs";
import {
  buildKnowledgeMetadataFromSourceMasterRecord,
  buildSourceMasterPdfPlan,
  isSourceMasterPdfKnowledgeCandidate
} from "../../scripts/lib/source-master-knowledge-docs.mjs";

test("knowledge guideline metadata stays separate from KOV service and legal layers", () => {
  const metadata = upgradeKnowledgeMetadata({
    docId: "sm-terviseprobleemiga-laste-perede-hea-tava-2025",
    title: "Terviseprobleemiga laste ja nende perede toetamise hea tava",
    source_path: "Terviseprobleemiga laste ja nende perede toetamise hea tava 12.122025_VEEB.pdf"
  });
  const validation = validateKnowledgeMetadata(metadata, { root: process.cwd() });
  const payload = buildKnowledgeDocIngestPayload(metadata);

  assert.equal(validation.ok, true);
  assert.equal(metadata.collection_id, "national_guidelines");
  assert.equal(metadata.source_type, "official_guideline");
  assert.equal(metadata.evidence_role, "practice_guidance");
  assert.notEqual(metadata.collection_id, "kov_services");
  assert.notEqual(metadata.evidence_role, "legal_basis");
  for (const claim of DISALLOWED_CURRENT_EVIDENCE_CLAIMS) {
    assert.equal(metadata.disallowed_claim_types.includes(claim), true);
  }

  assert.equal(payload.metadata.legal_basis, false);
  assert.equal(payload.metadata.collection_id, "national_guidelines");
  assert.equal(payload.chunks.length, metadata.sectionIndex.length);
  assert.equal(payload.chunks.every(chunk => chunk.metadata.legal_basis === false), true);
  assert.equal(payload.chunks.every(chunk => chunk.metadata.collection_id !== "kov_services"), true);
});

test("knowledge validator rejects guideline metadata that tries to act as legal or KOV evidence", () => {
  const metadata = upgradeKnowledgeMetadata({
    docId: "bad-guideline",
    title: "Bad guideline",
    source_path: "bad.pdf"
  });
  metadata.collection_id = "kov_services";
  metadata.evidence_role = "legal_basis";
  metadata.display_full_text = true;

  const validation = validateKnowledgeMetadata(metadata);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /kov_services/);
  assert.match(validation.errors.join("\n"), /legal_basis/);
  assert.match(validation.errors.join("\n"), /display_full_text/);
});

test("source master PDF candidate becomes safe knowledge-doc metadata", () => {
  const record = {
    source_id: "oiguskantsler_juhend_abivajavast_lapsest",
    title: "Juhend: abivajavast lapsest teatamine ja andmekaitse",
    url: "https://example.test/juhend.pdf",
    normalized_url: "https://example.test/juhend.pdf",
    source_format: "pdf",
    source_type: "official_guideline",
    resource_type: "best_practice_guidance",
    publisher: "Õiguskantsler",
    collection_hint: "national_guidelines",
    evidence_role: "practice_guidance",
    topic_tags: ["lapsed ja pered", "andmekaitse"],
    audience: "BOTH",
    language: "et",
    link_check_status: ["OK"],
    ingest_status: "ingest_candidate",
    ingest_priority: "high",
    recommended_pipeline: "knowledge_doc_pipeline"
  };

  assert.equal(isSourceMasterPdfKnowledgeCandidate(record), true);
  const metadata = buildKnowledgeMetadataFromSourceMasterRecord(record, { checkedAt: "2026-05-02" });
  const validation = validateKnowledgeMetadata(metadata);

  assert.equal(validation.ok, true);
  assert.equal(metadata.docId, record.source_id);
  assert.equal(metadata.source_id, record.source_id);
  assert.equal(metadata.collection_id, "national_guidelines");
  assert.equal(metadata.source_type, "official_guideline");
  assert.equal(metadata.source_url, record.url);
  assert.equal(metadata.url_canonical, record.normalized_url);
  assert.equal(metadata.legal_basis, false);
  assert.equal(metadata.evidence_allowed, true);
  assert.equal(metadata.display_full_text, false);
  for (const claim of DISALLOWED_CURRENT_EVIDENCE_CLAIMS) {
    assert.equal(metadata.disallowed_claim_types.includes(claim), true);
  }
});

test("source master PDF plan ignores organization web pages and reports invalid metadata", () => {
  const records = [
    {
      source_id: "pdf_ok",
      title: "PDF ok",
      url: "https://example.test/a.pdf",
      normalized_url: "https://example.test/a.pdf",
      source_format: "pdf",
      source_type: "research_report",
      publisher: "Publisher",
      collection_hint: "research_reports",
      evidence_role: "research_evidence",
      language: "et",
      audience: "SOCIAL_WORKER",
      ingest_status: "ingest_candidate",
      ingest_priority: "medium",
      recommended_pipeline: "knowledge_doc_pipeline"
    },
    {
      source_id: "org_page",
      title: "Organization page",
      url: "https://example.test/",
      source_format: "html",
      source_type: "organization_profile",
      ingest_status: "referenced_only",
      recommended_pipeline: "organization_collection_agent"
    }
  ];

  const plan = buildSourceMasterPdfPlan(records, { checkedAt: "2026-05-02" });
  assert.equal(plan.ok, true);
  assert.equal(plan.source_count, 2);
  assert.equal(plan.pdf_candidate_count, 1);
  assert.equal(plan.planned_count, 1);
  assert.equal(plan.items[0].metadata.collection_id, "research_reports");
  assert.equal(plan.items[0].metadata.source_type, "research_report");
});

test("source master PDF plan warns about possible encoding issues", () => {
  const plan = buildSourceMasterPdfPlan([
    {
      source_id: "bad_encoding_pdf",
      title: "PĆ¤Ć¤stevahendid hooldekodus",
      url: "https://example.test/b.pdf",
      normalized_url: "https://example.test/b.pdf",
      source_format: "pdf",
      source_type: "information_material",
      publisher: "Publisher",
      collection_hint: "national_guidelines",
      language: "et",
      audience: "BOTH",
      ingest_status: "ingest_candidate",
      ingest_priority: "medium",
      recommended_pipeline: "knowledge_doc_pipeline"
    }
  ], { checkedAt: "2026-05-02" });

  assert.equal(plan.ok, true);
  assert.equal(plan.warning_count, 1);
  assert.match(plan.items[0].validation.warnings.join("\n"), /possible encoding issue in title/);
});
