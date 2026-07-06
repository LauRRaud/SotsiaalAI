import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  applyKovWebSourcesCheck,
  checkKovWebSourcesFromWeb,
  getKovWebSourcesStatus
} from "../../../lib/admin/rag/kovSourceMonitor/service.js";

async function makeTempKovRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "kov-source-monitor-"));
  await fs.mkdir(path.join(root, "viimsi-vald"), { recursive: true });
  return root;
}

function sourcesPayload(source = {}) {
  return {
    schemaVersion: "kov-sources-v2.5-sourcepackage",
    municipality: "Viimsi vald",
    sources: [
      {
        source_key: "service_page",
        title: "Teenuse leht",
        url: "https://example.test/service",
        source_format: "html",
        source_status: "active",
        ...source
      }
    ]
  };
}

test("KOV source monitor writes candidate baseline without changing source file", async () => {
  const kovRoot = await makeTempKovRoot();
  const sourcePath = path.join(kovRoot, "viimsi-vald", "viimsi-vald.sources.json");
  await fs.writeFile(sourcePath, JSON.stringify(sourcesPayload(), null, 2));

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    url: "https://example.test/service",
    text: async () => "<html><title>Teenuse leht</title><main>Abi kirjeldus ja taotlemine</main></html>"
  });

  try {
    const report = await checkKovWebSourcesFromWeb({ kovRoot, slug: "viimsi-vald" });
    assert.equal(report.files, 1);
    assert.equal(report.baselineMissing, 1);
    assert.equal(report.candidatesWritten, 1);

    const source = JSON.parse(await fs.readFile(sourcePath, "utf8"));
    const candidate = JSON.parse(await fs.readFile(path.join(kovRoot, "viimsi-vald", "viimsi-vald.sources.kontroll.json"), "utf8"));
    assert.equal(source.sources[0].web_content_sha256, undefined);
    assert.match(candidate.sources[0].web_content_sha256, /^[a-f0-9]{64}$/);
  } finally {
    global.fetch = originalFetch;
  }
});

test("KOV source monitor apply promotes candidate and later reports unchanged", async () => {
  const kovRoot = await makeTempKovRoot();
  const sourcePath = path.join(kovRoot, "viimsi-vald", "viimsi-vald.sources.json");
  await fs.writeFile(sourcePath, JSON.stringify(sourcesPayload(), null, 2));

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    url: "https://example.test/service",
    text: async () => "<html><title>Teenuse leht</title><main>Abi kirjeldus ja taotlemine</main></html>"
  });

  try {
    await checkKovWebSourcesFromWeb({ kovRoot, slug: "viimsi-vald" });
    const applied = await applyKovWebSourcesCheck({ kovRoot });
    assert.equal(applied.appliedFiles, 1);

    const source = JSON.parse(await fs.readFile(sourcePath, "utf8"));
    assert.match(source.sources[0].web_content_sha256, /^[a-f0-9]{64}$/);

    const second = await checkKovWebSourcesFromWeb({ kovRoot, slug: "viimsi-vald" });
    assert.equal(second.baselineMissing, 0);
    assert.equal(second.changedSources, 0);

    const status = await getKovWebSourcesStatus({ kovRoot });
    assert.equal(status.sourceFiles, 1);
    assert.equal(status.report.checkedUrls, 1);
  } finally {
    global.fetch = originalFetch;
  }
});
