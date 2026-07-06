import test from "node:test";
import assert from "node:assert/strict";

import {
  groupByCollection,
  normalizeDocument,
  ragServiceBaseUrl,
  toCsv
} from "../../scripts/list-rag-documents.mjs";

test("normalizeDocument picks best title/collection/url fields", () => {
  const d = normalizeDocument({
    id: "doc-1",
    fileName: "fail.pdf",
    title: "Pealkiri",
    collection_id: "research_reports",
    type: "FILE",
    source_type: "research_report",
    chunks: 12,
    url: "https://x.ee/a.pdf"
  });
  assert.equal(d.docId, "doc-1");
  assert.equal(d.title, "Pealkiri");
  assert.equal(d.collection_id, "research_reports");
  assert.equal(d.source_type, "research_report");
  assert.equal(d.chunks, 12);
  assert.equal(d.url, "https://x.ee/a.pdf");
});

test("normalizeDocument falls back to fileName and placeholders", () => {
  const d = normalizeDocument({ id: "d2", fileName: "raport.pdf", chunks: 0 });
  assert.equal(d.title, "raport.pdf");
  assert.equal(d.collection_id, "(määramata)");
  assert.equal(d.source_type, "(määramata)");
  assert.equal(d.url, null);
});

test("groupByCollection groups and sorts titles", () => {
  const groups = groupByCollection([
    { title: "B doc", collection_id: "x" },
    { title: "A doc", collection_id: "x" },
    { title: "C doc", collection_id: "y" }
  ]);
  assert.deepEqual(Object.keys(groups).sort(), ["x", "y"]);
  assert.deepEqual(groups.x.map(d => d.title), ["A doc", "B doc"]);
});

test("toCsv escapes commas and quotes", () => {
  const csv = toCsv([
    { title: "Doc, with comma", collection_id: "c", source_type: "t", chunks: 3, year: 2024, authority: "KOV", url: "u", docId: "id1" }
  ]);
  const lines = csv.split("\n");
  assert.equal(lines[0], "title,collection_id,source_type,chunks,year,authority,url,docId");
  assert.ok(lines[1].startsWith('"Doc, with comma",c,t,3,2024,KOV,u,id1'));
});

test("ragServiceBaseUrl normalizes host forms", () => {
  assert.equal(ragServiceBaseUrl("127.0.0.1:8000"), "http://127.0.0.1:8000");
  assert.equal(ragServiceBaseUrl("https://rag.example.com/"), "https://rag.example.com");
});
