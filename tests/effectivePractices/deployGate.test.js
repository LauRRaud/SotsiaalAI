import test from "node:test";
import assert from "node:assert/strict";

import { buildPracticeDeployGateReport } from "../../lib/practiceDeployGate.js";
import { deterministicRagDocumentId } from "../../lib/effectivePractices.js";

// P1-E: pre-deploy readiness gate — read-only aggregate over RAG + review residue.

function makeDb({ ragDelete = 0, ragIngest = 0, ragProcessing = 0, ragDeadLetter = 0, staleRefs = 0, publishedUnlinked = 0, publishedWithRag = [] } = {}) {
  return {
    dataDeletionJob: {
      count: async ({ where }) => {
        if (where.action === "RAG_DELETE") return ragDelete;
        if (where.action === "RAG_INGEST") return ragIngest;
        if (where.status === "processing") return ragProcessing;
        if (where.status === "dead_letter") return ragDeadLetter;
        return 0;
      }
    },
    effectivePractice: {
      count: async ({ where }) => {
        if (where.status?.not === "PUBLISHED") return staleRefs;
        if (where.status === "PUBLISHED" && where.ragSourceId === null) return publishedUnlinked;
        return 0;
      },
      findMany: async () => publishedWithRag
    }
  };
}
const service = (findings = []) => ({ repairAssignments: async () => ({ findings }) });
const linked = (publicId, version) => ({ publicId, publishedVersion: version, ragSourceId: deterministicRagDocumentId(publicId, version) });

test("a clean state passes the gate", async () => {
  const report = await buildPracticeDeployGateReport({
    db: makeDb({ publishedWithRag: [linked("pub-1", 3)] }),
    service: service([])
  });
  assert.equal(report.ok, true);
  assert.deepEqual(report.failures, []);
});

test("pending/failed RAG deletions block the deploy", async () => {
  const report = await buildPracticeDeployGateReport({ db: makeDb({ ragDelete: 2 }), service: service([]) });
  assert.equal(report.ok, false);
  assert.ok(report.failures.includes("rag_delete_residue"));
  assert.equal(report.checks.ragDeleteResidue, 2);
});

test("pending/failed RAG ingest retries block the deploy", async () => {
  const report = await buildPracticeDeployGateReport({ db: makeDb({ ragIngest: 1 }), service: service([]) });
  assert.equal(report.ok, false);
  assert.ok(report.failures.includes("rag_ingest_residue"));
});

test("claimed and dead-letter RAG jobs block the deploy", async () => {
  const processing = await buildPracticeDeployGateReport({ db: makeDb({ ragProcessing: 1 }), service: service([]) });
  assert.equal(processing.ok, false);
  assert.ok(processing.failures.includes("rag_processing_residue"));
  const deadLetter = await buildPracticeDeployGateReport({ db: makeDb({ ragDeadLetter: 1 }), service: service([]), maxRagResidue: 99 });
  assert.equal(deadLetter.ok, false);
  assert.ok(deadLetter.failures.includes("rag_dead_letter"));
});

test("a non-published practice still holding a ragSourceId blocks the deploy", async () => {
  const report = await buildPracticeDeployGateReport({ db: makeDb({ staleRefs: 1 }), service: service([]) });
  assert.equal(report.ok, false);
  assert.ok(report.failures.includes("stale_references"));
});

test("a published practice linked to a stale document version blocks the deploy", async () => {
  const report = await buildPracticeDeployGateReport({
    db: makeDb({ publishedWithRag: [{ publicId: "pub-1", publishedVersion: 2, ragSourceId: deterministicRagDocumentId("pub-1", 1) }] }),
    service: service([])
  });
  assert.equal(report.ok, false);
  assert.ok(report.failures.includes("published_version_mismatch"));
  assert.equal(report.checks.versionMismatches, 1);
});

test("unrepaired reviewer-assignment findings block the deploy", async () => {
  const report = await buildPracticeDeployGateReport({
    db: makeDb(),
    service: service([{ type: "assignment", issue: "author_is_reviewer" }])
  });
  assert.equal(report.ok, false);
  assert.ok(report.failures.includes("assignment_repair_needed"));
});

test("a raised residue limit tolerates a bounded in-flight RAG backlog", async () => {
  const report = await buildPracticeDeployGateReport({ db: makeDb({ ragIngest: 3 }), service: service([]), maxRagResidue: 5 });
  assert.equal(report.ok, true);
});

test("a published practice not linked to RAG blocks the deploy by default (SOL-P1-5)", async () => {
  const report = await buildPracticeDeployGateReport({ db: makeDb({ publishedUnlinked: 4 }), service: service([]) });
  assert.equal(report.ok, false);
  assert.ok(report.failures.includes("published_unlinked"));
  assert.equal(report.checks.publishedUnlinked, 4);
});

test("only the explicit RAG-disabled opt-out downgrades published-unlinked (auditable)", async () => {
  const report = await buildPracticeDeployGateReport({ db: makeDb({ publishedUnlinked: 4 }), service: service([]), allowRagDisabled: true });
  assert.equal(report.ok, true);
  assert.equal(report.checks.allowRagDisabled, true); // echoed for the audit trail
});

test("an invalid/NaN residue limit fails CLOSED, never fail-open (SOL-P1-5)", async () => {
  for (const badLimit of [NaN, "abc", -3, Infinity, undefined]) {
    const report = await buildPracticeDeployGateReport({ db: makeDb({ ragIngest: 1 }), service: service([]), maxRagResidue: badLimit });
    assert.equal(report.ok, false, `limit ${String(badLimit)} must not fail open`);
    assert.ok(report.failures.includes("rag_ingest_residue"));
    assert.equal(report.checks.residueLimit, 0);
  }
});

test("the report carries only counts — no practice text, email or PII", async () => {
  const report = await buildPracticeDeployGateReport({
    db: makeDb({ ragDelete: 1, publishedWithRag: [linked("pub-1", 3)] }),
    service: service([{ type: "assignment", issue: "invalid_capability", assignmentId: "a1" }])
  });
  const serialized = JSON.stringify(report);
  assert.doesNotMatch(serialized, /@/); // no email
  for (const key of ["ragDeleteResidue", "ragIngestResidue", "ragProcessing", "ragDeadLetter", "staleReferences", "versionMismatches", "publishedUnlinked", "assignmentFindings", "residueLimit"]) {
    assert.equal(typeof report.checks[key], "number", `${key} is a bare count`);
  }
});
