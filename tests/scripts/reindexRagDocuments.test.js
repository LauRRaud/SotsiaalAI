import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";

const execFileAsync = promisify(execFile);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("reindex dry-run excludes deleted registry rows", async t => {
  const server = http.createServer((request, response) => {
    assert.equal(new URL(request.url, "http://127.0.0.1").pathname, "/documents");
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify([
      {
        docId: "deleted-journal-row",
        journalTitle: "Sotsiaaltöö",
        lifecycleState: "DELETED",
        title: "Aegunud kirje"
      },
      {
        docId: "active-journal-row",
        journalTitle: "Sotsiaaltöö",
        lifecycleState: "ACTIVE",
        title: "Kehtiv kirje"
      }
    ]));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => new Promise(resolve => server.close(resolve)));

  const address = server.address();
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/reindex-rag-documents.mjs",
      "--journal",
      "Sotsiaaltöö",
      "--base-url",
      `http://127.0.0.1:${address.port}`,
      "--dry-run"
    ],
    {
      cwd: rootDir,
      env: { ...process.env, RAG_SERVICE_API_KEY: "" }
    }
  );

  assert.match(stdout, /\[rag:reindex\] matched: 1/u);
  assert.match(stdout, /active-journal-row/u);
  assert.doesNotMatch(stdout, /deleted-journal-row/u);
});
