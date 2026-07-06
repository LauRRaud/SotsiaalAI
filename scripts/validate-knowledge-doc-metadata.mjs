#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

import {
  clean,
  isKnowledgeSourceFile,
  listKnowledgeFiles,
  loadKnowledgeMetadataFiles,
  validateKnowledgeMetadata,
  writeJson
} from "./lib/knowledge-docs.mjs";

function usage() {
  return [
    "Usage:",
    "  npm run knowledge:validate -- --root \"C:\\Users\\rauds\\Desktop\\SotsiaalAI\\Andmebaasi\\uuringud ja juhendid\"",
    "  npm run knowledge:validate -- --root ./Andmebaasi/uuringud-ja-juhendid --json logs/knowledge-validate.json",
    "",
    "Options:",
    "  --root <path>   Knowledge document folder",
    "  --json <path>   Write JSON validation report",
    "  --help          Show help",
    "",
    "Read-only: validates local metadata and source file references."
  ].join("\n");
}

function parseArgs(argv = []) {
  const args = {
    root: "",
    json: "",
    help: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--root") args.root = argv[++index] || "";
    else if (arg === "--json") args.json = argv[++index] || "";
    else throw new Error(`Unknown option: ${arg}`);
  }
  return args;
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function validateRoot(root) {
  const files = await listKnowledgeFiles(root);
  const sourceFiles = files.filter(isKnowledgeSourceFile);
  const metadataFiles = await loadKnowledgeMetadataFiles(root);
  const sourcePathToMetadata = new Map();
  const docIds = new Map();
  const items = [];
  const errors = [];

  for (const item of metadataFiles) {
    const result = validateKnowledgeMetadata(item.data || {}, { root });
    if (result.metadata?.source_path) {
      sourcePathToMetadata.set(path.basename(result.metadata.source_path), item.fileName);
      const sourceExists = await exists(result.sourceFilePath);
      if (!sourceExists) result.errors.push(`source_path does not exist: ${result.metadata.source_path}`);
    }
    const docId = clean(result.metadata?.docId);
    if (docId) {
      if (!docIds.has(docId)) docIds.set(docId, []);
      docIds.get(docId).push(item.fileName);
    }
    items.push({
      metadata_file: item.fileName,
      docId,
      title: result.metadata?.title || null,
      source_path: result.metadata?.source_path || null,
      source_file_exists: result.sourceFilePath ? await exists(result.sourceFilePath) : false,
      document_kind: result.metadata?.document_kind || null,
      resource_type: result.metadata?.resource_type || null,
      source_type: result.metadata?.source_type || null,
      collection_id: result.metadata?.collection_id || null,
      evidence_role: result.metadata?.evidence_role || null,
      ingest_ready: result.ok && (result.sourceFilePath ? await exists(result.sourceFilePath) : false),
      errors: result.errors,
      warnings: result.warnings
    });
    errors.push(...result.errors.map(error => `${item.fileName}: ${error}`));
  }

  for (const sourceFile of sourceFiles) {
    if (!sourcePathToMetadata.has(sourceFile)) {
      errors.push(`${sourceFile}: matching JSON metadata missing or source_path does not point to this file`);
    }
  }

  for (const [docId, filesForDocId] of docIds.entries()) {
    if (filesForDocId.length > 1) {
      errors.push(`docId is not unique: ${docId} (${filesForDocId.join(", ")})`);
    }
  }

  return {
    ok: errors.length === 0,
    root,
    checked_at: new Date().toISOString(),
    source_file_count: sourceFiles.length,
    metadata_file_count: metadataFiles.length,
    ingest_ready_count: items.filter(item => item.ingest_ready).length,
    errors,
    items
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
  const report = await validateRoot(root);
  if (args.json) await writeJson(args.json, report);
  console.log(JSON.stringify({
    ok: report.ok,
    root: report.root,
    source_file_count: report.source_file_count,
    metadata_file_count: report.metadata_file_count,
    ingest_ready_count: report.ingest_ready_count,
    errors: report.errors,
    output: args.json || null
  }, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`[knowledge:validate] ${error?.message || String(error)}`);
  process.exitCode = 1;
});
