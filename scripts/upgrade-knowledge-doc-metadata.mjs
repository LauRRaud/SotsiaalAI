#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

import {
  isKnowledgeSourceFile,
  listKnowledgeFiles,
  loadKnowledgeMetadataFiles,
  readJson,
  upgradeKnowledgeMetadata,
  writeJson
} from "./lib/knowledge-docs.mjs";

function usage() {
  return [
    "Usage:",
    "  npm run knowledge:upgrade -- --root \"C:\\Users\\rauds\\Desktop\\SotsiaalAI\\Andmebaasi\\uuringud ja juhendid\" --dry-run",
    "  npm run knowledge:upgrade -- --root \"C:\\Users\\rauds\\Desktop\\SotsiaalAI\\Andmebaasi\\uuringud ja juhendid\" --write",
    "",
    "Options:",
    "  --root <path>   Knowledge document folder",
    "  --dry-run       Show planned metadata upgrades. Default.",
    "  --write         Write upgraded JSON and create .bak-<timestamp> backup",
    "  --help          Show help"
  ].join("\n");
}

function parseArgs(argv = []) {
  const args = {
    root: "",
    write: false,
    help: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--root") args.root = argv[++index] || "";
    else if (arg === "--dry-run") args.write = false;
    else if (arg === "--write") args.write = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return args;
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/u, "Z");
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function upgradeRoot(root, write) {
  const files = await listKnowledgeFiles(root);
  const sourceFiles = files.filter(isKnowledgeSourceFile);
  const metadataFiles = await loadKnowledgeMetadataFiles(root);
  const stamp = timestamp();
  const results = [];

  for (const item of metadataFiles) {
    const before = item.data || await readJson(item.filePath) || {};
    const after = upgradeKnowledgeMetadata(before);
    const changed = stableJson(before) !== stableJson(after);
    const result = {
      metadata_file: item.fileName,
      docId: after.docId,
      changed,
      written: false,
      backup: null
    };
    if (write && changed) {
      const backup = `${item.filePath}.bak-${stamp}`;
      await fs.copyFile(item.filePath, backup);
      await writeJson(item.filePath, after);
      result.written = true;
      result.backup = path.basename(backup);
    }
    results.push(result);
  }

  return {
    ok: true,
    mode: write ? "write" : "dry-run",
    root,
    source_file_count: sourceFiles.length,
    metadata_file_count: metadataFiles.length,
    changed_count: results.filter(item => item.changed).length,
    written_count: results.filter(item => item.written).length,
    results
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.root) throw new Error("Pass --root <path>.");

  const root = path.resolve(args.root);
  const report = await upgradeRoot(root, args.write);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(`[knowledge:upgrade] ${error?.message || String(error)}`);
  process.exitCode = 1;
});
