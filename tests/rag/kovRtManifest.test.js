import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { auditKovRtManifestEntry, resolveKovRtXmlFile } from "../../lib/admin/rag/kov/rtManifest.js";

test("resolves KOV RT XML from shared kov_rt folder", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "kov-rt-manifest-"));
  await mkdir(path.join(root, "kov_rt"), { recursive: true });
  await mkdir(path.join(root, "harku-vald"), { recursive: true });
  await writeFile(path.join(root, "kov_rt", "404072025017.xml"), "<akt/>", "utf8");

  const result = await resolveKovRtXmlFile(root, {
    slug: "harku-vald",
    xml_file: "404072025017.xml"
  });

  assert.equal(result.status, "ready");
  assert.equal(result.xml_found, true);
  assert.equal(result.xml_file, "404072025017.xml");
  assert.equal(result.xml_path, path.join(root, "kov_rt", "404072025017.xml"));
  assert.deepEqual(result.errors, []);
});

test("shared kov_rt XML can be resolved even before web folder exists", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "kov-rt-manifest-"));
  await mkdir(path.join(root, "kov_rt"), { recursive: true });
  await writeFile(path.join(root, "kov_rt", "412042025007.xml"), "<akt/>", "utf8");

  const result = await resolveKovRtXmlFile(root, {
    slug: "tallinn",
    xml_file: "412042025007.xml"
  });

  assert.equal(result.status, "ready");
  assert.equal(result.xml_found, true);
  assert.equal(result.xml_path, path.join(root, "kov_rt", "412042025007.xml"));
  assert.match(result.warnings.join("\n"), /KOV folder missing: tallinn/);
  assert.deepEqual(result.errors, []);
});

test("deferred RT manifest entry keeps explicit deferred status", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "kov-rt-manifest-"));
  await mkdir(path.join(root, "kov_rt"), { recursive: true });

  const result = await auditKovRtManifestEntry(root, {
    municipality_name: "Tallinn",
    municipality_id: "tallinn",
    slug: "tallinn",
    rt_doc_id: "kov-rt-tallinn",
    act_title: "Sotsiaalhoolekandelise abi andmise kord",
    act_url: "https://www.riigiteataja.ee/akt/412042025007?leiaKehtiv",
    act_reference: "412042025007",
    xml_file: "412042025007.xml",
    generated_metadata: {
      collection_id: "kov_legal",
      source_type: "kov_regulation",
      source_format: "xml",
      jurisdiction_level: "MUNICIPALITY",
      legal_basis: true,
      source_status: "active",
      historical: false,
      is_current_version: true
    },
    auto_ingest: false,
    ingest_status: "deferred"
  });

  assert.equal(result.ingest_status, "deferred");
  assert.equal(result.auto_ingest, false);
  assert.equal(result.xml_found, false);
  assert.equal(result.generated_metadata_valid, true);
});
