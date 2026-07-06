#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

import { auditKovRtManifestEntry, readKovRtManifest } from "../lib/admin/rag/kov/rtManifest.js";

function parseArgs(argv = process.argv.slice(2)) {
  const args = { root: "KOV", json: "", help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") args.root = String(argv[++index] || "").trim();
    else if (arg === "--json") args.json = String(argv[++index] || "").trim();
    else if (arg === "--help" || arg === "-h") args.help = true;
  }
  return args;
}

async function writeJson(filePath, payload) {
  if (!filePath) return;
  const resolved = path.resolve(filePath);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await fs.writeFile(resolved, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function main() {
  const args = parseArgs();
  if (args.help) {
    console.log("Usage: npm run kov:audit-rt -- --root KOV --json logs/kov-rt-audit.json");
    return;
  }

  const { manifestPath, manifest, entries } = await readKovRtManifest(args.root);
  const items = [];
  for (const entry of entries) items.push(await auditKovRtManifestEntry(args.root, entry));
  const summary = {
    total: items.length,
    xml_found: items.filter(item => item.xml_found).length,
    ingest_ready: items.filter(item => item.ingest_status === "ingest_ready").length,
    deferred: items.filter(item => item.ingest_status === "deferred").length,
    skipped: items.filter(item => item.ingest_status === "skipped").length,
    needs_review: items.filter(item => item.ingest_status === "needs_review").length,
    generated_metadata_valid: items.filter(item => item.generated_metadata_valid).length
  };
  const payload = {
    ok: true,
    all_ready: items.every(item => item.ingest_status === "ingest_ready" || item.ingest_status === "skipped" || item.ingest_status === "deferred"),
    manifestPath,
    schemaVersion: manifest.schemaVersion,
    policy: manifest.policy || {},
    summary,
    items
  };

  await writeJson(args.json, payload);
  console.log(JSON.stringify({ ok: payload.ok, manifestPath, summary }, null, 2));
}

main().catch(error => {
  console.error(String(error?.message || error));
  process.exitCode = 1;
});
