import test from "node:test";
import assert from "node:assert/strict";

import {
  fetchRagServiceDocumentsForFreshness,
  normalizeRagServiceDocumentForFreshness
} from "../../lib/rag/ragServiceFreshnessFallback.js";

test("normalizes RAG service documents into freshness audit records", () => {
  const normalized = normalizeRagServiceDocumentForFreshness({
    id: "doc-1",
    docId: "sotsiaaltoo-ai-2025",
    title: "Tehisintellekt sotsiaaltoos",
    type: "journal_article",
    status: "COMPLETED",
    sourceUrl: "https://example.test/artikkel",
    fileName: "artikkel.md",
    language: "et",
    lastIngested: "2026-04-25T10:00:00Z",
    source_type: "journal_article",
    source_status: "active",
    authority: "editorial",
    metadata: {
      source_id: "sotsiaaltoo-2-2025-artikkel-12-tehisintellekt-sotsiaaltoos",
      document_id: "sotsiaaltoo-ai-2025",
      last_checked: "2026-04-25",
      content_hash: "abc123"
    }
  });

  assert.equal(normalized.id, "doc-1");
  assert.equal(normalized.remoteId, "sotsiaaltoo-ai-2025");
  assert.equal(normalized.title, "Tehisintellekt sotsiaaltoos");
  assert.equal(normalized.type, "journal_article");
  assert.equal(normalized.sourceUrl, "https://example.test/artikkel");
  assert.equal(normalized.updatedAt, "2026-04-25T10:00:00Z");
  assert.equal(normalized.metadata.source_id, "sotsiaaltoo-2-2025-artikkel-12-tehisintellekt-sotsiaaltoos");
  assert.equal(normalized.metadata.document_id, "sotsiaaltoo-ai-2025");
  assert.equal(normalized.metadata.source_type, "journal_article");
  assert.equal(normalized.metadata.source_status, "active");
  assert.equal(normalized.metadata.authority, "editorial");
  assert.equal(normalized.metadata.language, "et");
  assert.equal(normalized.metadata.last_checked, "2026-04-25");
  assert.equal(normalized.metadata.url, "https://example.test/artikkel");
});

test("fetches RAG service documents in pages for freshness fallback", async () => {
  const calls = [];
  const docs = await fetchRagServiceDocumentsForFreshness({
    limit: 3,
    pageSize: 2,
    headers: new Headers(),
    request: async path => {
      calls.push(path);
      if (path.includes("offset=0")) {
        return [
          { id: "doc-1", title: "One", metadata: { source_id: "one", document_id: "one" } },
          { id: "doc-2", title: "Two", metadata: { source_id: "two", document_id: "two" } }
        ];
      }
      return [
        { id: "doc-3", title: "Three", metadata: { source_id: "three", document_id: "three" } }
      ];
    }
  });

  assert.equal(docs.length, 3);
  assert.equal(calls.length, 2);
  assert.ok(calls[0].includes("limit=2"));
  assert.ok(calls[0].includes("offset=0"));
  assert.ok(calls[1].includes("offset=2"));
  assert.deepEqual(docs.map(doc => doc.metadata.source_id), ["one", "two", "three"]);
});
