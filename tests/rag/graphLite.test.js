import test from "node:test";
import assert from "node:assert/strict";

import {
  isAllowedRelation,
  normalizeEntityName,
  validateGraphRelation
} from "../../lib/rag/graph/graphSchema.js";
import { buildKovGraph, mergeGraphBuilds } from "../../lib/rag/graph/kovGraphBuilder.js";

const FIXTURE_BUNDLE = {
  docId: "kov-testvald",
  municipality_id: "test_vald",
  municipality_name: "Testi vald",
  county: "Testimaa",
  items: [
    {
      id: "test_vald_service_koduteenus",
      canonical_item_id: "test_vald:service:koduteenus",
      itemType: "service",
      title: "Koduteenus",
      summary: "Koduteenus toetab igapäevatoimingutes.",
      officialUrl: "https://test.ee/koduteenus",
      relatedForms: ["test_vald_form_avaldus"],
      relatedContacts: ["test_vald_contact_mari"]
    },
    {
      id: "test_vald_form_avaldus",
      canonical_item_id: "test_vald:form:avaldus",
      itemType: "form",
      title: "Sotsiaalteenuse avaldus"
    },
    {
      id: "test_vald_contact_mari",
      canonical_item_id: "test_vald:contact:mari",
      itemType: "contact",
      title: "Mari Maasikas"
    },
    {
      id: "test_vald_benefit_sunnitoetus",
      canonical_item_id: "test_vald:benefit:sunnitoetus",
      itemType: "benefit",
      title: "Sünnitoetus",
      relatedForms: ["missing_form_id"]
    }
  ]
};

test("normalizeEntityName strips diacritics and punctuation", () => {
  assert.equal(normalizeEntityName("Sünnitoetus (II osa)"), "sunnitoetus ii osa");
});

test("allowed triples accept service relations and reject nonsense", () => {
  assert.equal(isAllowedRelation("SERVICE", "AVAILABLE_IN", "MUNICIPALITY"), true);
  assert.equal(isAllowedRelation("SERVICE", "HAS_FORM", "FORM"), true);
  assert.equal(isAllowedRelation("FORM", "AVAILABLE_IN", "MUNICIPALITY"), false);
  assert.equal(isAllowedRelation("MUNICIPALITY", "HAS_LEGAL_BASIS", "LAW"), false);
});

test("risk relations require NEEDS_REVIEW status", () => {
  const entityTypes = new Map([
    ["risk:1", "RISK_SIGNAL"],
    ["workflow:1", "WORKFLOW"]
  ]);
  const autoApproved = validateGraphRelation({
    fromKey: "risk:1",
    toKey: "workflow:1",
    relationType: "ESCALATES_TO",
    reviewStatus: "AUTO_APPROVED",
    evidence: { source_document_id: "doc-1" }
  }, entityTypes);
  assert.equal(autoApproved.ok, false);
  const needsReview = validateGraphRelation({
    fromKey: "risk:1",
    toKey: "workflow:1",
    relationType: "ESCALATES_TO",
    reviewStatus: "NEEDS_REVIEW",
    evidence: { source_document_id: "doc-1" }
  }, entityTypes);
  assert.equal(needsReview.ok, true);
});

test("relations without evidence are rejected", () => {
  const entityTypes = new Map([
    ["svc:1", "SERVICE"],
    ["mun:1", "MUNICIPALITY"]
  ]);
  const result = validateGraphRelation({
    fromKey: "svc:1",
    toKey: "mun:1",
    relationType: "AVAILABLE_IN",
    reviewStatus: "AUTO_APPROVED",
    evidence: {}
  }, entityTypes);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.includes("evidence")));
});

test("buildKovGraph builds entities and evidence-carrying relations", () => {
  const build = buildKovGraph(FIXTURE_BUNDLE);
  const byType = build.entities.reduce((acc, entity) => {
    acc[entity.type] = (acc[entity.type] || 0) + 1;
    return acc;
  }, {});
  assert.deepEqual(byType, { MUNICIPALITY: 1, SERVICE: 1, FORM: 1, CONTACT_POINT: 1, BENEFIT: 1 });

  const relationTypes = build.relations.map(relation => relation.relationType).sort();
  assert.deepEqual(relationTypes, [
    "AVAILABLE_IN",
    "AVAILABLE_IN",
    "BELONGS_TO",
    "BELONGS_TO",
    "HAS_CONTACT_POINT",
    "HAS_FORM"
  ]);

  for (const relation of build.relations) {
    assert.equal(relation.evidence.source_document_id, "kov-testvald");
  }
  const hasForm = build.relations.find(relation => relation.relationType === "HAS_FORM");
  assert.equal(hasForm.fromKey, "kov_item:test_vald:test_vald:service:koduteenus");
  assert.equal(hasForm.toKey, "kov_item:test_vald:test_vald:form:avaldus");

  assert.ok(build.warnings.some(warning => warning.includes("missing_form_id")));
});

test("buildKovGraph skips bundles without municipality_id", () => {
  const build = buildKovGraph({ docId: "x", items: [] });
  assert.equal(build.entities.length, 0);
  assert.ok(build.warnings[0].includes("municipality_id"));
});

test("mergeGraphBuilds dedupes entities and relations", () => {
  const buildA = buildKovGraph(FIXTURE_BUNDLE);
  const buildB = buildKovGraph(FIXTURE_BUNDLE);
  const merged = mergeGraphBuilds([buildA, buildB]);
  assert.equal(merged.summary.entity_count, buildA.entities.length);
  assert.equal(merged.summary.relation_count, buildA.relations.length);
});

test("relationRowsFor maps evidence fields and skips unresolved keys", async () => {
  const { relationRowsFor, chunked } = await import("../../scripts/apply-rag-graph.mjs");
  const ids = new Map([["a", "id-a"], ["b", "id-b"]]);
  const { rows, skipped } = relationRowsFor([
    { fromKey: "a", toKey: "b", relationType: "HAS_FORM", evidence: { source_document_id: "doc-1", canonical_item_id: "item-1", chunk_id: null } },
    { fromKey: "a", toKey: "missing", relationType: "HAS_FORM", evidence: { source_document_id: "doc-1" } }
  ], ids);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].fromEntityId, "id-a");
  assert.equal(rows[0].sourceDocumentId, "doc-1");
  assert.equal(rows[0].evidenceRef, "item-1");
  assert.equal(skipped.length, 1);
  assert.deepEqual(chunked([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});
