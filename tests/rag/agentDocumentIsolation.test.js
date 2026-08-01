import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pythonExecutable =
  process.env.PYTHON ||
  (process.platform === "win32" ? "python" : "python3");

test("RAG general-search isolation helper rejects private and legacy agent-document metadata", () => {
  const result = spawnSync(
    pythonExecutable,
    [path.join(ROOT, "rag-service", "test_search_security.py")],
    { cwd: ROOT, encoding: "utf8" }
  );

  assert.equal(
    result.status,
    0,
    result.error?.message || result.stderr || result.stdout
  );
  assert.match(`${result.stdout}\n${result.stderr}`, /OK/);
});

test("dense and lexical retrieval share the immutable server-side general-search boundary", () => {
  const source = readFileSync(path.join(ROOT, "rag-service", "main.py"), "utf8");

  assert.match(source, /build_general_search_where\(client_where\)/);
  assert.match(source, /collection\.query\([\s\S]*?where=chroma_where/);
  assert.match(source, /_fetch_lexical_candidates\([\s\S]*?chroma_where/);
  assert.match(source, /is_general_search_metadata_allowed\(md\)/);
  assert.match(source, /is_general_search_metadata_allowed\(candidate_md\)/);
});

test("owner document retrieval uses the exact private endpoint without a client where filter", () => {
  const source = readFileSync(path.join(ROOT, "lib", "documents", "search.js"), "utf8");
  const ragSource = readFileSync(path.join(ROOT, "rag-service", "main.py"), "utf8");
  const exactModel = ragSource.split("class AgentDocumentSearchIn", 2)[1]?.split("# --------------------", 1)[0] || "";

  assert.match(source, /"\/search\/agent-documents"/);
  assert.match(source, /doc_ids:\s*ragDocIds/);
  assert.doesNotMatch(source, /where:\s*\{/);
  assert.match(exactModel, /model_config\s*=\s*\{"extra":\s*"forbid"\}/);
  assert.doesNotMatch(exactModel, /owner_id|tenant_id|collection_id|\bwhere\b/);
});

test("research rejects the private collection before building any geo variant", () => {
  const source = readFileSync(path.join(ROOT, "app", "api", "research", "jobs", "route.js"), "utf8");

  assert.match(source, /PRIVATE_AGENT_RAG_COLLECTION_IDS/);
  assert.match(source, /\.filter\(v => !PRIVATE_AGENT_RAG_COLLECTION_IDS\.has\(v\.toLowerCase\(\)\)\)/);
});
