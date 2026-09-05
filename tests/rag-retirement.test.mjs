import assert from "node:assert/strict";
import test from "node:test";

import { ragServiceRequest, deleteRagDocument } from "../lib/documents/ragService.js";
import { getSourceAttributionId } from "../lib/chat/sourceAttribution.js";
import { createDeletionJobRetryService } from "../lib/privacy/deletionJobRetryService.js";
import { runEffectivePracticeRagRecovery } from "../lib/effectivePracticeRagRecovery.js";

test("retired RAG never contacts the old host, including deletion", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error("Unexpected network request"); };
  try {
    await assert.rejects(ragServiceRequest("/search"), error =>
      error.status === 503 && error.code === "RAG_RETIRED");
    const removal = await deleteRagDocument("existing-document");
    assert.equal(removal.ok, false);
    assert.equal(removal.reason, "rag_retired");
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("an absent document id is not reported as successful deletion", async () => {
  const result = await deleteRagDocument("");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "missing_doc_id");
});

test("stored source and feedback identifiers remain stable", () => {
  assert.equal(getSourceAttributionId({ source_id: "source-1", id: "chunk-1" }), "source-1");
  assert.equal(getSourceAttributionId({ source_type: "national_law", source_id: "act-1", id: "section-1" }), "section-1");
  assert.equal(getSourceAttributionId({ url_canonical: "https://example.org/source" }), "https://example.org/source");
  assert.equal(getSourceAttributionId({}, 3), "source_3");
});

test("retired RAG jobs keep their reference and retry budget", async () => {
  for (const action of ["RAG_DELETE", "RAG_INGEST"]) {
    const job = { id: "job-1", action, externalRef: "existing-document", attempts: 2 };
    let writes = 0;
    const retry = createDeletionJobRetryService({
      db: {
        dataDeletionJob: {
          findUnique: async () => job,
          update: async () => { writes += 1; }
        },
        $transaction: async () => { writes += 1; }
      }
    });
    await assert.rejects(retry({ jobId: job.id }), error => error.code === "RAG_RETIRED");
    assert.equal(writes, 0);
    assert.equal(job.externalRef, "existing-document");
    assert.equal(job.attempts, 2);
  }
});

test("the notification job skips retired recovery without claiming any work", async () => {
  let claims = 0;
  const result = await runEffectivePracticeRagRecovery({
    db: { $transaction: async () => { claims += 1; } }
  });
  assert.equal(result.state, "retired");
  assert.equal(result.skipped, true);
  assert.equal(claims, 0);
  assert.equal(result.succeeded, undefined);
});
