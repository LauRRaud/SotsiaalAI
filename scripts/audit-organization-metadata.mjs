#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateOrganizationPackageFromRoot } from "./validate-organization-metadata.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_ROOT = path.join(REPO_ROOT, "Andmebaasi", "organisatsioonid");

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    slug: "",
    root: DEFAULT_ROOT,
    json: ""
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--slug") args.slug = String(argv[++index] || "").trim().toLowerCase();
    else if (arg === "--root") args.root = String(argv[++index] || "").trim();
    else if (arg === "--json") args.json = String(argv[++index] || "").trim();
    else if (arg === "--help" || arg === "-h") args.help = true;
  }
  return args;
}

function printHelp() {
  console.log("Usage: npm run organization:audit-metadata -- --slug astangu --root <organisatsioonide kaust> --json logs/audit.json");
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
    printHelp();
    return;
  }

  try {
    const validation = await validateOrganizationPackageFromRoot(args);
    const audit = {
      ok: validation.ok,
      slug: validation.slug,
      root: validation.root,
      core_files_present: validation.core_files_present,
      metadata_valid: validation.metadata_valid,
      ingest_ready: validation.ingest_ready,
      rag_doc_id: validation.rag_doc_id,
      rag_payload_preview: validation.rag_payload_preview,
      chunk_metadata_preview: validation.chunk_metadata_preview,
      source_key_reference_errors: validation.source_key_reference_errors,
      documents_summary: {
        referenced_only: validation.documents_summary.referenced_only,
        ingest_candidate: validation.documents_summary.ingest_candidate,
        ingest_ready: validation.documents_summary.ingest_ready,
        needs_review: validation.documents_summary.needs_review,
        total: validation.documents_summary.total,
        items: validation.documents_summary.items
      },
      remote_source_url_supported: validation.remote_source_url_supported,
      risks: validation.risks,
      recommended_fixes: validation.recommended_fixes,
      errors: validation.errors,
      warnings: validation.warnings
    };

    await writeJson(args.json, audit);
    console.log(JSON.stringify({
      ok: audit.ok,
      slug: audit.slug,
      rag_doc_id: audit.rag_doc_id,
      metadata_valid: audit.metadata_valid,
      ingest_ready: audit.ingest_ready,
      documents_summary: audit.documents_summary,
      risks: audit.risks,
      recommended_fixes: audit.recommended_fixes
    }, null, 2));
    if (!audit.ok) process.exitCode = 1;
  } catch (error) {
    console.error(String(error?.message || error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
