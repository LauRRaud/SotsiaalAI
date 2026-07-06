#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import fg from "fast-glob";

import {
  buildRagMetadataBackfillPlan,
  slugifyRagId
} from "../lib/rag/metadataBackfillPlan.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const HELP = `
Usage:
  node scripts/plan-rag-metadata-backfill.mjs [--root <dir>] [--file <json>] [--collection <name>] [--json <path>] [--limit <n>]

Examples:
  npm run rag:plan:metadata -- --root KOV --json logs/kov-metadata-plan.json
  npm run rag:plan:metadata -- --file KOV/Jogeva/jogeva-vald/jogeva-vald.sources.json --collection kov_web
`.trim();

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function normalizeRel(filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, "/") || filePath;
}

function resolvePath(value) {
  return path.isAbsolute(value) ? value : path.resolve(rootDir, value);
}

function parseArgs(argv) {
  const args = {
    roots: [],
    files: [],
    collection: "",
    jsonPath: "",
    limit: 0,
    includeItems: true
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index] || "");
    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }
    if (arg === "--root") {
      args.roots.push(String(argv[index + 1] || ""));
      index += 1;
      continue;
    }
    if (arg === "--file") {
      args.files.push(String(argv[index + 1] || ""));
      index += 1;
      continue;
    }
    if (arg === "--collection") {
      args.collection = String(argv[index + 1] || "").trim();
      index += 1;
      continue;
    }
    if (arg === "--json" || arg === "--plan-json") {
      args.jsonPath = String(argv[index + 1] || "");
      index += 1;
      continue;
    }
    if (arg === "--limit") {
      args.limit = Number.parseInt(String(argv[index + 1] || "0"), 10) || 0;
      index += 1;
      continue;
    }
    if (arg === "--sources-only") {
      args.includeItems = false;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!args.roots.length && !args.files.length) args.roots.push("KOV");
  return args;
}

function inferCollectionFamily(filePath, payload = {}, explicit = "") {
  if (explicit) return explicit;
  const normalized = normalizeRel(filePath).toLowerCase();
  const collection = String(payload.collection_id || payload.collectionId || "").trim().toLowerCase();
  if (collection.includes("national")) return "national_rt";
  if (collection.includes("kov_rt")) return "kov_rt";
  if (collection.includes("organization")) return "organizations";
  if (normalized.includes("national-rt") || normalized.includes("national_rt")) return "national_rt";
  if (normalized.includes(".rt.") || normalized.includes("/rt/") || normalized.includes("\\rt\\")) return "kov_rt";
  if (normalized.includes("organization") || normalized.includes("organisatsioon")) return "organizations";
  if (normalized.startsWith("kov/")) return "kov_web";
  return "unknown";
}

function inferSlug(filePath, payload = {}) {
  const fileName = path.basename(filePath);
  const fromFile = fileName
    .replace(/\.sources\.json$/i, "")
    .replace(/\.meta\.json$/i, "")
    .replace(/\.json$/i, "");
  return slugifyRagId(payload.id || payload.slug || payload.municipality_id || payload.municipality || fromFile);
}

function extractRecordsFromPayload(payload, filePath, args) {
  const records = [];
  const collectionFamily = inferCollectionFamily(filePath, payload, args.collection);
  const slug = inferSlug(filePath, payload);
  const root = {
    ...payload,
    id: payload.id || slug
  };
  const commonContext = {
    root,
    slug,
    municipalityId: slug,
    collectionFamily,
    filePath: normalizeRel(filePath)
  };

  if (Array.isArray(payload.sources)) {
    payload.sources.forEach((source, index) => {
      if (!isObject(source)) return;
      records.push({
        source,
        index,
        context: {
          ...commonContext,
          recordKind: "source"
        }
      });
    });
  }

  if (args.includeItems && Array.isArray(payload.items)) {
    payload.items.forEach((source, index) => {
      if (!isObject(source)) return;
      records.push({
        source,
        index,
        context: {
          ...commonContext,
          recordKind: "item"
        }
      });
    });
  }

  if (!records.length && isObject(payload.metadata)) {
    records.push({
      source: payload.metadata,
      index: 0,
      context: {
        ...commonContext,
        recordKind: "metadata"
      }
    });
  }

  return records;
}

async function discoverJsonFiles(args) {
  const explicitFiles = args.files.map(resolvePath);
  const discovered = [];

  for (const root of args.roots) {
    const absoluteRoot = resolvePath(root);
    const entries = await fg([
      "**/*.sources.json",
      "**/*.rt.sources.json",
      "**/national-rt.sources.json",
      "**/*.meta.json"
    ], {
      cwd: absoluteRoot,
      absolute: true,
      onlyFiles: true,
      unique: true,
      dot: false
    });
    discovered.push(...entries);
  }

  return [...new Set([...explicitFiles, ...discovered])].sort();
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function compactItem(item) {
  return {
    status: item.status,
    collection_family: item.collection_family,
    record_kind: item.record_kind,
    file_path: item.file_path,
    index: item.index,
    source_id: item.source_id,
    document_id: item.document_id,
    title: item.title,
    source_type: item.source_type,
    inferred_fields: item.inferred_fields,
    remaining_errors: item.remaining_errors
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }

  const files = await discoverJsonFiles(args);
  const records = [];
  const unreadable = [];

  for (const filePath of files) {
    try {
      const payload = await readJson(filePath);
      records.push(...extractRecordsFromPayload(payload, filePath, args));
    } catch (error) {
      unreadable.push({
        file_path: normalizeRel(filePath),
        error: error.message
      });
    }
  }

  const limitedRecords = args.limit > 0 ? records.slice(0, args.limit) : records;
  const plan = buildRagMetadataBackfillPlan(limitedRecords);
  plan.summary.files = files.length;
  plan.summary.records_discovered = records.length;
  plan.summary.records_planned = limitedRecords.length;
  plan.summary.unreadable_files = unreadable.length;
  plan.unreadable_files = unreadable;

  const output = {
    ...plan,
    items: plan.items.map(compactItem)
  };

  if (args.jsonPath) {
    const absoluteJsonPath = resolvePath(args.jsonPath);
    await fs.mkdir(path.dirname(absoluteJsonPath), { recursive: true });
    await fs.writeFile(absoluteJsonPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  }

  console.log("[rag:plan:metadata]");
  console.log(`  files: ${plan.summary.files}`);
  console.log(`  records: ${plan.summary.records_planned}/${plan.summary.records_discovered}`);
  console.log(`  ready: ${plan.summary.ready}`);
  console.log(`  backfill_required: ${plan.summary.backfill_required}`);
  console.log(`  blocked: ${plan.summary.blocked}`);
  if (args.jsonPath) console.log(`  plan_json: ${normalizeRel(resolvePath(args.jsonPath))}`);

  if (plan.summary.blocked > 0) {
    const blocked = output.items.filter(item => item.status === "blocked").slice(0, 10);
    for (const item of blocked) {
      console.log(`[blocked] ${item.file_path} ${item.title || item.source_id || "unknown"} ${item.remaining_errors[0] || ""}`);
    }
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error("[rag:plan:metadata] Failed:", error.message);
  process.exit(1);
});
