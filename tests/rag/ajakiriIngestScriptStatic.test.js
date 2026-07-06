import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const ingestScriptPath = path.join(repoRoot, "scripts", "ingest-ajakiri-sotsiaaltoo.mjs");

function readIngestScript() {
  return fs.readFileSync(ingestScriptPath, "utf8");
}

test("ajakiri ingest script protects RAG HTTP calls with a request timeout", () => {
  const source = readIngestScript();

  assert.match(source, /const DEFAULT_REQUEST_TIMEOUT_MS =/);
  assert.match(source, /--request-timeout-ms/);
  assert.match(source, /async function fetchWithTimeout/);
  assert.match(source, /controller\.abort\(\)/);
  assert.match(source, /RAG request timed out after/);
  assert.match(source, /isDocumentExisting\(baseUrl, expectedDocId, timeoutMs\)/);
  assert.match(source, /ingestItem\(baseUrl, item, timeoutMs\)/);
  assert.match(source, /await fetchWithTimeout\(`\$\{baseUrl\}\/documents\/\$\{encodeURIComponent\(expectedDocId\)\}`/);
  assert.match(source, /await fetchWithTimeout\(`\$\{baseUrl\}\/ingest\/pdf-with-metadata`/);
});
