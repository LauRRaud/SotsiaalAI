import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const ragServicePath = path.join(repoRoot, "rag-service", "main.py");

function readRagServiceMain() {
  return fs.readFileSync(ragServicePath, "utf8");
}

function extractPythonFunction(source, name) {
  const startMarker = `def ${name}(`;
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `${name} not found in rag-service/main.py`);

  const nextDef = source.indexOf("\ndef ", start + startMarker.length);
  assert.notEqual(nextDef, -1, `could not find end of ${name}`);
  return source.slice(start, nextDef);
}

test("RAG service ingest payload defines V2 source contract fields before metadata use", () => {
  const fn = extractPythonFunction(readRagServiceMain(), "_build_ingest_payload");
  const fields = [
    "metadata_schema_version",
    "source_id",
    "document_id",
    "legacy_source_type",
    "authority",
    "url_canonical",
    "retrieved_at",
    "last_checked",
    "valid_from",
    "valid_to",
    "historical",
    "source_status",
    "canonical_item_id",
    "content_hash"
  ];

  for (const field of fields) {
    const assignment = fn.indexOf(`${field} =`);
    const metadataUse = fn.indexOf(`"${field}": ${field}`);
    assert.notEqual(assignment, -1, `${field} assignment missing`);
    assert.notEqual(metadataUse, -1, `${field} metadata use missing`);
    assert.ok(
      assignment < metadataUse,
      `${field} must be assigned before it is written into chunk metadata`
    );
  }
});

test("RAG service chunk metadata entry defines schema version before writing metadata", () => {
  const fn = extractPythonFunction(readRagServiceMain(), "_build_chunk_metadata_entry");
  const assignment = fn.indexOf("metadata_schema_version =");
  const metadataUse = fn.indexOf('"metadata_schema_version": metadata_schema_version');

  assert.notEqual(assignment, -1, "metadata_schema_version assignment missing");
  assert.notEqual(metadataUse, -1, "metadata_schema_version metadata use missing");
  assert.ok(
    assignment < metadataUse,
    "metadata_schema_version must be assigned before it is written into chunk metadata"
  );
});

test("RAG service PDF metadata ingest logs unexpected failures with source identifiers", () => {
  const fn = extractPythonFunction(readRagServiceMain(), "ingest_pdf_with_metadata");

  assert.match(fn, /except HTTPException:\s+raise/s);
  assert.match(fn, /logger\.exception\(/);
  assert.match(fn, /PDF metadata ingest failed/);
  assert.match(fn, /doc_id/);
  assert.match(fn, /original_doc_id/);
  assert.match(fn, /source_type/);
});

test("RAG service PDF ingest maps sectionIndex into chunk metadata", () => {
  const source = readRagServiceMain();
  const fn = extractPythonFunction(source, "_build_ingest_payload");

  assert.match(source, /def _normalize_section_index/);
  assert.match(source, /def _section_for_page/);
  assert.match(fn, /section_index = _normalize_section_index\(meta_common\)/);
  assert.match(fn, /\[PDF_SECTION\]/);
  assert.match(fn, /"section_id": section_meta\.get\("section_id"\)/);
  assert.match(fn, /"section_title": section_meta\.get\("title"\)/);
  assert.match(fn, /"section_evidence_role": section_meta\.get\("evidence_role"\)/);
  assert.match(fn, /"allowed_claim_types": section_meta\.get\("allowed_claim_types"\)/);
  assert.match(fn, /"disallowed_claim_types": section_meta\.get\("disallowed_claim_types"\)/);
});

test("RAG URL ingest rejects private hosts before fetch", () => {
  const source = readRagServiceMain();
  const hostGuard = extractPythonFunction(source, "_host_resolves_to_non_public_ip");
  const urlGuard = extractPythonFunction(source, "_assert_safe_fetch_url");

  assert.match(hostGuard, /raw_host\.lower\(\) == "localhost"/);
  assert.match(hostGuard, /ipaddress\.ip_address\(raw_host\)/);
  assert.match(hostGuard, /return not parsed_ip\.is_global/);
  assert.match(hostGuard, /socket\.getaddrinfo\(raw_host, None, proto=socket\.IPPROTO_TCP\)/);
  assert.match(hostGuard, /return True/);

  assert.match(urlGuard, /parsed\.scheme not in \{"http", "https"\}/);
  assert.match(urlGuard, /not parsed\.netloc/);
  assert.match(urlGuard, /not ALLOW_PRIVATE_URL_FETCH and _host_resolves_to_non_public_ip\(parsed\.hostname or ""\)/);
  assert.match(urlGuard, /Private or local network URLs are not allowed/);
});

test("RAG URL ingest revalidates redirect targets before following them", () => {
  const fn = extractPythonFunction(readRagServiceMain(), "_fetch_remote_html");

  assert.match(fn, /_assert_safe_fetch_url\(url\)/);
  assert.match(fn, /allow_redirects=False/);
  assert.match(fn, /300 <= response\.status_code < 400/);
  assert.match(fn, /location = response\.headers\.get\("location"\)/);
  assert.match(fn, /current = _assert_safe_fetch_url\(urljoin\(current, location\)\)/);
  assert.match(fn, /Too many redirects/);
});
