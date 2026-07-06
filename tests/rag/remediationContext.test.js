import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRemediationContext,
  buildRemediationFieldDefaults,
  buildRemediationMetadataStub,
  findRemediationTargetItem,
  getRemediationIdentifierValue,
  normalizeRemediationLookup
} from "../../components/admin/rag/remediationContext.js";

test("builds remediation context from quality queue query params", () => {
  const params = new URLSearchParams({
    remediation_action: "fill_required_metadata_fields",
    fields: "authority,source_status",
    recommended_fields: "content_hash",
    source_id: "source-1",
    document_id: "doc-1",
    source_type: "journal_article",
    source_file_type: "article_ingest",
    source_path: "article.pdf",
    focus: "ingest_metadata",
    file_key: "dataJson"
  });

  const context = buildRemediationContext(params, "et");

  assert.equal(context.action, "fill_required_metadata_fields");
  assert.equal(context.actionLabel, "Täida kohustuslikud metadata väljad");
  assert.deepEqual(context.fields, ["authority", "source_status"]);
  assert.deepEqual(context.recommendedFields, ["content_hash"]);
  assert.equal(context.focus, "ingest_metadata");
  assert.equal(context.fileKey, "dataJson");
  assert.deepEqual(context.identifiers, [
    ["source_id", "source-1"],
    ["document_id", "doc-1"],
    ["source_type", "journal_article"],
    ["source_file_type", "article_ingest"],
    ["source_path", "article.pdf"]
  ]);
});

test("builds a metadata stub from remediation context", () => {
  const context = buildRemediationContext(new URLSearchParams({
    remediation_action: "fill_recommended_metadata_fields",
    fields: "url",
    recommended_fields: "content_hash",
    source_id: "source-1",
    document_id: "doc-1",
    source_type: "journal_article",
    municipality: "tartu_linn"
  }));

  assert.equal(buildRemediationMetadataStub(context), [
    "{",
    "  \"source_id\": \"source-1\",",
    "  \"document_id\": \"doc-1\",",
    "  \"source_type\": \"journal_article\",",
    "  \"url\": \"\",",
    "  \"content_hash\": \"\"",
    "}",
    ""
  ].join("\n"));
});

test("prefills safe remediation metadata defaults", () => {
  const context = buildRemediationContext(new URLSearchParams({
    remediation_action: "fill_required_metadata_fields",
    fields: "source_type,authority,last_checked,source_status,url",
    source_id: "source-1",
    document_id: "doc-1",
    source_type: "file",
    source_path: "https://jogeva.ee/koduteenus",
    municipality: "jogeva_vald",
    suggested_source_type: "kov_service_info"
  }));

  assert.deepEqual(buildRemediationFieldDefaults(context, { today: "2026-04-27" }), {
    authority: "KOV",
    last_checked: "2026-04-27",
    source_status: "active",
    source_type: "kov_service_info",
    url: "https://jogeva.ee/koduteenus"
  });

  assert.equal(buildRemediationMetadataStub(context, { today: "2026-04-27" }), [
    "{",
    "  \"source_id\": \"source-1\",",
    "  \"document_id\": \"doc-1\",",
    "  \"source_type\": \"kov_service_info\",",
    "  \"source_path\": \"https://jogeva.ee/koduteenus\",",
    "  \"authority\": \"KOV\",",
    "  \"last_checked\": \"2026-04-27\",",
    "  \"source_status\": \"active\",",
    "  \"url\": \"https://jogeva.ee/koduteenus\"",
    "}",
    ""
  ].join("\n"));
});

test("returns null when query params do not contain remediation context", () => {
  assert.equal(buildRemediationContext(new URLSearchParams({ tab: "ingest" }), "en"), null);
});

test("finds remediation target items by normalized identifiers", () => {
  const context = buildRemediationContext(new URLSearchParams({
    remediation_action: "review_source_metadata",
    municipality: "tartu_linn",
    source_id: "source-1"
  }));

  assert.equal(getRemediationIdentifierValue(context, "municipality"), "tartu_linn");
  assert.equal(normalizeRemediationLookup("Tartu_linn"), "tartu linn");
  assert.deepEqual(
    findRemediationTargetItem([
      { slug: "voru-vald", displayName: "Voru vald" },
      { slug: "tartu-linn", displayName: "Tartu linn" }
    ], [getRemediationIdentifierValue(context, "municipality")]),
    { slug: "tartu-linn", displayName: "Tartu linn" }
  );
});
