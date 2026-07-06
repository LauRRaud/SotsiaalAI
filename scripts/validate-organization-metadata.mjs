#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  expectedOrganizationCoreFileName,
  validateOrganizationPackagePayload
} from "../lib/admin/rag/organizations/package.js";

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
  console.log("Usage: npm run organization:validate -- --slug astangu --root <organisatsioonide kaust> [--json logs/out.json]");
}

async function readRequiredText(root, slug, fileKey) {
  const fileName = expectedOrganizationCoreFileName(slug, fileKey);
  const filePath = path.join(root, fileName);
  const text = await fs.readFile(filePath, "utf8");
  return {
    fileName,
    filePath,
    text
  };
}

function parseJson(text, fileName) {
  try {
    return JSON.parse(text);
  } catch (error) {
    const wrapped = new Error(`${fileName} is not readable JSON: ${error.message}`);
    wrapped.cause = error;
    throw wrapped;
  }
}

export async function loadOrganizationPackageFromRoot({ root = DEFAULT_ROOT, slug }) {
  const normalizedSlug = String(slug || "").trim().toLowerCase();
  if (!normalizedSlug) throw new Error("--slug is required");
  const resolvedRoot = path.resolve(root || DEFAULT_ROOT);
  const [sourcesFile, dataFile, metaFile, ragFile] = await Promise.all([
    readRequiredText(resolvedRoot, normalizedSlug, "sourcesJson"),
    readRequiredText(resolvedRoot, normalizedSlug, "dataJson"),
    readRequiredText(resolvedRoot, normalizedSlug, "metaJson"),
    readRequiredText(resolvedRoot, normalizedSlug, "ragMd")
  ]);

  return {
    slug: normalizedSlug,
    root: resolvedRoot,
    fileNames: {
      sourcesJson: sourcesFile.fileName,
      dataJson: dataFile.fileName,
      metaJson: metaFile.fileName,
      ragMd: ragFile.fileName
    },
    filePaths: {
      sourcesJson: sourcesFile.filePath,
      dataJson: dataFile.filePath,
      metaJson: metaFile.filePath,
      ragMd: ragFile.filePath
    },
    sourcesPayload: parseJson(sourcesFile.text, sourcesFile.fileName),
    dataPayload: parseJson(dataFile.text, dataFile.fileName),
    metaPayload: parseJson(metaFile.text, metaFile.fileName),
    ragText: ragFile.text
  };
}

export async function validateOrganizationPackageFromRoot(options) {
  const loaded = await loadOrganizationPackageFromRoot(options);
  const validation = validateOrganizationPackagePayload(loaded);
  return {
    ok: validation.ok,
    root: loaded.root,
    slug: loaded.slug,
    core_files_present: true,
    fileNames: loaded.fileNames,
    ...validation
  };
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
    const result = await validateOrganizationPackageFromRoot(args);
    await writeJson(args.json, result);
    console.log(JSON.stringify({
      ok: result.ok,
      slug: result.slug,
      rag_doc_id: result.rag_doc_id,
      ingest_ready: result.ingest_ready,
      source_key_reference_errors: result.source_key_reference_errors,
      errors: result.errors,
      warnings: result.warnings
    }, null, 2));
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    console.error(String(error?.message || error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
