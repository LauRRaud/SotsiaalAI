import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  applyKovRtRegistryCheck,
  checkKovRtRegistryFromWeb,
  getKovRtRegistryStatus
} from "../../../lib/admin/rag/rtRegistry/service.js";

async function makeTempKovRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "kov-rt-registry-"));
  await fs.mkdir(path.join(root, "kov_rt"), { recursive: true });
  return root;
}

function manifest(entries) {
  return {
    schemaVersion: "kov-rt-manifest-v1",
    generated_at: "2026-05-20",
    entries
  };
}

test("RT web check writes candidate manifest and XML without changing source manifest", async () => {
  const kovRoot = await makeTempKovRoot();
  const entry = {
    municipality_name: "Test vald",
    municipality_id: "test_vald",
    slug: "test-vald",
    web_doc_id: "kov-test-vald",
    rt_doc_id: "kov-rt-test-vald",
    act_title: "Vana kord",
    act_url: "https://www.riigiteataja.ee/akt/111?leiaKehtiv",
    act_reference: "111",
    xml_file: "111.xml",
    generated_metadata: {
      docId: "kov-rt-test-vald",
      municipality_id: "test_vald",
      municipality_name: "Test vald",
      slug: "test-vald",
      collection_id: "kov_legal",
      source_type: "kov_regulation",
      source_format: "xml",
      jurisdiction_level: "MUNICIPALITY",
      legal_basis: true,
      act_reference: "111",
      act_title: "Vana kord",
      act_url: "https://www.riigiteataja.ee/akt/111?leiaKehtiv",
      xml_file: "111.xml",
      source_status: "active",
      historical: false,
      is_current_version: true
    },
    auto_ingest: true,
    ingest_status: "ingest_ready"
  };
  await fs.writeFile(path.join(kovRoot, "kov_rt", "kov_rt_manifest.json"), JSON.stringify(manifest([entry]), null, 2));
  await fs.writeFile(path.join(kovRoot, "kov_rt", "111.xml"), "<act>old</act>");

  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (String(url).endsWith(".xml")) {
      return {
        ok: true,
        status: 200,
        url: String(url),
        text: async () => "<act>new</act>"
      };
    }
    return {
      ok: true,
      status: 200,
      url: "https://www.riigiteataja.ee/akt/222?leiaKehtiv",
      text: async () => '<h1>Sotsiaalhoolekandelise abi andmise kord</h1><a href="https://www.riigiteataja.ee/akt/222.xml">XML failina</a>'
    };
  };

  try {
    const report = await checkKovRtRegistryFromWeb({ kovRoot });
    assert.equal(report.changedEntries, 1);
    assert.equal(report.downloadedXml, 1);

    const source = JSON.parse(await fs.readFile(path.join(kovRoot, "kov_rt", "kov_rt_manifest.json"), "utf8"));
    const candidate = JSON.parse(await fs.readFile(path.join(kovRoot, "kov_rt", "kov_rt_manifest.kontroll.json"), "utf8"));
    assert.equal(source.entries[0].act_reference, "111");
    assert.equal(candidate.entries[0].act_reference, "222");
    assert.equal(candidate.entries[0].xml_file, "222.xml");
    assert.equal(await fs.readFile(path.join(kovRoot, "kov_rt", "kontroll_xml", "222.xml"), "utf8"), "<act>new</act>");
  } finally {
    global.fetch = originalFetch;
  }
});

test("RT apply check promotes candidate manifest and keeps backups", async () => {
  const kovRoot = await makeTempKovRoot();
  await fs.writeFile(
    path.join(kovRoot, "kov_rt", "kov_rt_manifest.json"),
    JSON.stringify(manifest([
      {
        municipality_name: "Test vald",
        municipality_id: "test_vald",
        slug: "test-vald",
        rt_doc_id: "kov-rt-test-vald",
        act_title: "Vana kord",
        act_url: "https://www.riigiteataja.ee/akt/111?leiaKehtiv",
        act_reference: "111",
        xml_file: "111.xml",
        generated_metadata: {
          docId: "kov-rt-test-vald",
          municipality_id: "test_vald",
          municipality_name: "Test vald",
          slug: "test-vald",
          collection_id: "kov_legal",
          source_type: "kov_regulation",
          source_format: "xml",
          jurisdiction_level: "MUNICIPALITY",
          legal_basis: true,
          act_reference: "111",
          act_title: "Vana kord",
          act_url: "https://www.riigiteataja.ee/akt/111?leiaKehtiv",
          xml_file: "111.xml",
          source_status: "active",
          historical: false,
          is_current_version: true
        },
        auto_ingest: true,
        ingest_status: "ingest_ready"
      }
    ]), null, 2)
  );
  await fs.writeFile(path.join(kovRoot, "kov_rt", "111.xml"), "<act>old</act>");

  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (String(url).endsWith(".xml")) {
      return { ok: true, status: 200, url: String(url), text: async () => "<act>new</act>" };
    }
    return {
      ok: true,
      status: 200,
      url: String(url),
      text: async () => '<h1>Sotsiaalhoolekandelise abi andmise kord</h1><a href="https://www.riigiteataja.ee/akt/222.xml">XML failina</a>'
    };
  };

  try {
    await checkKovRtRegistryFromWeb({ kovRoot });
    const result = await applyKovRtRegistryCheck({ kovRoot });
    const source = JSON.parse(await fs.readFile(path.join(kovRoot, "kov_rt", "kov_rt_manifest.json"), "utf8"));
    const status = await getKovRtRegistryStatus({ kovRoot });
    assert.equal(result.changedEntries, 1);
    assert.equal(result.appliedXml, 1);
    assert.equal(source.entries[0].act_reference, "222");
    assert.equal(await fs.readFile(path.join(kovRoot, "kov_rt", "222.xml"), "utf8"), "<act>new</act>");
    assert.equal(status.check.changedEntries, 1);
    assert.ok(result.backupDir.startsWith("KOV/kov_rt/backup-"));
  } finally {
    global.fetch = originalFetch;
  }
});
