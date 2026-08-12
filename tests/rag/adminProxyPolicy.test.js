import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  RAG_ADMIN_CAPABILITY,
  authorizeRagProxyAction,
  resolveRagProxyAction,
  validateRagMutationOrigin
} from "../../lib/rag/adminProxyPolicy.js";
import { executeAuditedRagOperation } from "../../lib/rag/adminProxyExecution.js";

const ROOT = process.cwd();

test("SOL-RAGSVC-04: catch-all exposes only the explicit method/path matrix", () => {
  const steward = [
    ["GET", ["documents"]],
    ["GET", ["documents", "doc-1"]],
    ["GET", ["documents", "doc-1", "chunks"]],
    ["GET", ["documents", "doc-1", "source"]],
    ["POST", ["upload"]],
    ["POST", ["ingest", "pdf-with-metadata"]],
    ["POST", ["ingest", "articles"]],
    ["POST", ["ingest", "articles", "bundle-1"]],
    ["POST", ["documents", "doc-1", "reindex"]],
    ["POST", ["documents", "doc-1", "update-meta"]],
    ["POST", ["documents", "doc-1", "patch-meta"]]
  ];
  const platformOnly = [
    ["DELETE", ["documents", "doc-1"]],
    ["POST", ["ingest", "url"]]
  ];
  const forbidden = [
    ["POST", ["ingest", "file"]],
    ["POST", ["ingest", "text"]],
    ["POST", ["search"]],
    ["POST", ["search", "agent-documents"]],
    ["POST", ["analyze"]],
    ["PUT", ["documents", "doc-1"]],
    ["PATCH", ["documents", "doc-1"]],
    ["GET", ["health"]],
    ["POST", ["anything", "else"]]
  ];

  for (const [method, segments] of steward) {
    const action = resolveRagProxyAction(method, segments);
    assert.ok(action, `${method} /${segments.join("/")} puudub allowlist'ist`);
    assert.equal(authorizeRagProxyAction(RAG_ADMIN_CAPABILITY.KNOWLEDGE_STEWARD, action), true);
  }
  for (const [method, segments] of platformOnly) {
    const action = resolveRagProxyAction(method, segments);
    assert.ok(action);
    assert.equal(authorizeRagProxyAction(RAG_ADMIN_CAPABILITY.KNOWLEDGE_STEWARD, action), false);
    assert.equal(authorizeRagProxyAction(RAG_ADMIN_CAPABILITY.PLATFORM_ADMIN, action), true);
  }
  for (const [method, segments] of forbidden) {
    assert.equal(resolveRagProxyAction(method, segments), null, `${method} /${segments.join("/")} lekkis läbi`);
  }
});

test("ordinary ADMIN has no implicit RAG capability", () => {
  const read = resolveRagProxyAction("GET", ["documents"]);
  assert.equal(authorizeRagProxyAction(null, read), false);
  assert.equal(authorizeRagProxyAction(RAG_ADMIN_CAPABILITY.NONE, read), false);
});

test("mutations require an exact same-origin browser origin", () => {
  const base = { method: "POST", url: "https://sotsiaal.ai/api/rag/upload" };
  assert.equal(validateRagMutationOrigin({ ...base, origin: "https://sotsiaal.ai" }), true);
  assert.equal(validateRagMutationOrigin({ ...base, origin: null }), false);
  assert.equal(validateRagMutationOrigin({ ...base, origin: "https://evil.example" }), false);
  assert.equal(validateRagMutationOrigin({ method: "GET", url: base.url, origin: null }), true);
});

test("proxy source binds capability, allowlist, origin and mandatory audit around fetch", () => {
  const source = fs.readFileSync(path.join(ROOT, "app/api/rag/[...path]/route.js"), "utf8");
  const execution = fs.readFileSync(path.join(ROOT, "lib/rag/adminProxyExecution.js"), "utf8");
  assert.match(source, /ragAdminCapability/);
  assert.match(source, /resolveRagProxyAction/);
  assert.match(source, /authorizeRagProxyAction/);
  assert.match(source, /validateRagMutationOrigin/);
  assert.match(source, /rag_proxy_operation_started[\s\S]*executeAuditedRagOperation/);
  assert.match(execution, /await writeAudit/);
  assert.match(execution, /await fetchUpstream\(\)/);
  assert.match(execution, /rag_proxy_operation_completed/);
});

test("schema persists the RAG capability and migration preserves existing platform admins", () => {
  const schema = fs.readFileSync(path.join(ROOT, "prisma/schema.prisma"), "utf8");
  const migration = fs.readFileSync(
    path.join(ROOT, "prisma/migrations/20260812235000_sol_ragsvc_04_admin_capability/migration.sql"),
    "utf8"
  );
  assert.match(schema, /enum RagAdminCapability[\s\S]*KNOWLEDGE_STEWARD[\s\S]*PLATFORM_ADMIN/);
  assert.match(schema, /ragAdminCapability\s+RagAdminCapability\s+@default\(NONE\)/);
  assert.match(migration, /UPDATE "User"[\s\S]*['"]PLATFORM_ADMIN['"]/);
});

test("mandatory start audit blocks the upstream operation on audit failure", async () => {
  let fetched = false;
  await assert.rejects(
    executeAuditedRagOperation({
      auditBase: { meta: {} },
      writeAudit: async () => { throw new Error("audit down"); },
      fetchUpstream: async () => { fetched = true; }
    }),
    error => error?.code === "RAG_PROXY_AUDIT_START_FAILED"
  );
  assert.equal(fetched, false);
});

test("upstream failure and successful response both get a result audit", async () => {
  const failedAudits = [];
  await assert.rejects(
    executeAuditedRagOperation({
      auditBase: { meta: { operationId: "op-1" } },
      writeAudit: async row => { failedAudits.push(row); },
      fetchUpstream: async () => { throw Object.assign(new Error("offline"), { name: "AbortError" }); }
    }),
    error => error?.code === "RAG_PROXY_TIMEOUT"
  );
  assert.deepEqual(failedAudits.map(row => row.meta.outcome), ["started", "failed"]);

  const successAudits = [];
  const response = { ok: true, status: 204, body: { cancel: async () => {} } };
  const result = await executeAuditedRagOperation({
    auditBase: { meta: { operationId: "op-2" } },
    writeAudit: async row => { successAudits.push(row); },
    fetchUpstream: async () => response
  });
  assert.equal(result, response);
  assert.deepEqual(successAudits.map(row => row.meta.outcome), ["started", "succeeded"]);
});

test("result-audit failure cancels the response and never reports upstream success", async () => {
  let auditCalls = 0;
  let cancelled = false;
  await assert.rejects(
    executeAuditedRagOperation({
      auditBase: { meta: { operationId: "op-3" } },
      writeAudit: async () => {
        auditCalls += 1;
        if (auditCalls === 2) throw new Error("result audit down");
      },
      fetchUpstream: async () => ({
        ok: true,
        status: 200,
        body: { cancel: async () => { cancelled = true; } }
      })
    }),
    error => error?.code === "RAG_PROXY_AUDIT_RESULT_FAILED"
  );
  assert.equal(cancelled, true);
});
