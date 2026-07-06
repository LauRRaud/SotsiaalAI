import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBackfillPlan,
  collectReportFindings,
  planPatchesForDocument,
  ragServiceBaseUrl
} from "../../scripts/backfill-rag-metadata.mjs";
import { stableHash } from "../../scripts/kovMetadataUpgradeLib.mjs";

test("journal article without collection_id gets sotsiaaltoo_articles", () => {
  const planned = planPatchesForDocument({
    docId: "motisklusi-sotsiaaltoost-2016-viidatud-allikad-2016",
    title: "Viidatud allikad",
    source_type: "journal_article",
    collection_id: null,
    content_hash: "396f37c3ecad55f565f50e9ac0683a995ae7cc1a"
  });
  assert.ok(planned);
  assert.deepEqual(planned.patch, { collection_id: "sotsiaaltoo_articles" });
  assert.deepEqual(planned.reasons, ["article_missing_collection_id"]);
});

test("journal article with existing collection_id is not patched", () => {
  const planned = planPatchesForDocument({
    docId: "doc-1",
    source_type: "journal_article",
    collection_id: "sotsiaaltoo_articles",
    content_hash: "abc"
  });
  assert.equal(planned, null);
});

test("kov_services document without content_hash gets identity stableHash", () => {
  const doc = {
    docId: "kov_kuusalu_vald_service_koduteenus",
    title: "Koduteenus",
    source_id: "kov_kuusalu_vald_service_koduteenus",
    source_type: "kov_service_info",
    resource_type: "service_page",
    collection_id: "kov_services",
    url_canonical: "https://kuusalu.ee/koduteenus"
  };
  const planned = planPatchesForDocument(doc);
  assert.ok(planned);
  assert.deepEqual(planned.reasons, ["kov_services_missing_content_hash"]);
  assert.equal(planned.patch.content_hash, stableHash({
    source_id: "kov_kuusalu_vald_service_koduteenus",
    title: "Koduteenus",
    url: "https://kuusalu.ee/koduteenus",
    source_type: "kov_service_info",
    resource_type: "service_page"
  }));
});

test("kov_services document with existing content_hash is not patched", () => {
  const planned = planPatchesForDocument({
    docId: "doc-2",
    source_type: "kov_service_info",
    collection_id: "kov_services",
    content_hash: "already-set"
  });
  assert.equal(planned, null);
});

test("non-target documents produce no patch", () => {
  assert.equal(planPatchesForDocument({
    docId: "doc-3",
    source_type: "national_law",
    collection_id: "national_regulations",
    content_hash: "x"
  }), null);
});

test("report findings cover authority, unknown status, last_checked and article url", () => {
  const findings = collectReportFindings({
    docId: "doc-4",
    collection_id: "sotsiaaltoo_articles",
    source_status: "unknown",
    authority: "",
    last_checked: null,
    url_canonical: null
  });
  assert.deepEqual(findings.sort(), [
    "missing_authority",
    "missing_last_checked",
    "sotsiaaltoo_article_missing_url",
    "source_status_unknown"
  ]);
});

test("buildBackfillPlan aggregates patches and report-only findings", () => {
  const plan = buildBackfillPlan([
    { docId: "a", source_type: "journal_article", collection_id: null, authority: "editorial", last_checked: "2026-04-28" },
    { docId: "b", source_type: "kov_service_info", collection_id: "kov_services", authority: "KOV", last_checked: "2026-05-01" },
    { docId: "c", source_type: "national_law", collection_id: "national_regulations", content_hash: "x", authority: "riigikogu", last_checked: "2026-05-01" }
  ]);
  assert.equal(plan.total_documents, 3);
  assert.equal(plan.planned_patches, 2);
  assert.deepEqual(plan.patch_reasons, {
    article_missing_collection_id: 1,
    kov_services_missing_content_hash: 1
  });
});

test("ragServiceBaseUrl normalizes host forms", () => {
  assert.equal(ragServiceBaseUrl("127.0.0.1:8000"), "http://127.0.0.1:8000");
  assert.equal(ragServiceBaseUrl("http://127.0.0.1:8000/"), "http://127.0.0.1:8000");
  assert.equal(ragServiceBaseUrl("https://rag.example.com"), "https://rag.example.com");
});
