#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  assertExistingStateCompatible,
  buildInventory,
  fetchRagDocuments,
  humanSummary,
  InventoryError,
  loadRagDump,
  loadRegistry,
  machineOutput,
  writeInventoryReports,
  writeInventoryStateAtomic
} from "./lib/master-sources-inventory.mjs";

const DEFAULT_REGISTRY = "Andmebaasi/Admebaasi-materjali-lisa/master_sources_final.json";
const DEFAULT_STATE = "Andmebaasi/Admebaasi-materjali-lisa/master_sources.state.json";
const DEFAULT_REPORT_DIR = "logs";

export function usage() {
  return [
    "Usage:",
    "  npm run rag:master:inventory -- --rag-dump <path>",
    "  npm run rag:master:inventory -- --rag-dump <path> --json",
    "  npm run rag:master:inventory                         (read-only live GET /documents)",
    "",
    "Options:",
    `  --registry <path>      Registry JSON (default ${DEFAULT_REGISTRY})`,
    "  --rag-dump <path>      Saved output from rag:list:docs or compatible RAG registry dump",
    "  --base-url <url>       Live RAG service base URL (default from RAG_INTERNAL_HOST/RAG_API_BASE)",
    `  --state <path>         Generated snapshot (default ${DEFAULT_STATE})`,
    `  --report-dir <path>    JSON/Markdown reports (default ${DEFAULT_REPORT_DIR})`,
    "  --max-documents <n>    Live service document limit (default 10000)",
    "  --now <ISO timestamp>  Reproducible inventory timestamp (primarily for tests/audits)",
    "  --json                 Print a machine-readable summary to stdout",
    "  --help                 Show this help",
    "",
    "Live mode uses only paginated GET /documents with RAG_SERVICE_API_KEY/RAG_API_KEY from the environment.",
    "The command never fetches source websites and never calls ingest, patch or delete endpoints.",
    "Exit codes: 0 success; 2 input/CLI; 3 registry/state contract; 4 live service; 5 output write."
  ].join("\n");
}

export function parseArgs(argv = []) {
  const args = {
    registry: DEFAULT_REGISTRY,
    ragDump: null,
    baseUrl: null,
    state: DEFAULT_STATE,
    reportDir: DEFAULT_REPORT_DIR,
    maxDocuments: 10000,
    now: null,
    json: false,
    help: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[++index];
      if (!value) throw new InventoryError("missing_option_value", `${arg} requires a value`, 2);
      return value;
    };
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--registry") args.registry = next();
    else if (arg === "--rag-dump") args.ragDump = next();
    else if (arg === "--base-url") args.baseUrl = next();
    else if (arg === "--state") args.state = next();
    else if (arg === "--report-dir") args.reportDir = next();
    else if (arg === "--max-documents") {
      const value = Number.parseInt(next(), 10);
      if (!Number.isInteger(value) || value < 1) throw new InventoryError("invalid_max_documents", "--max-documents must be a positive integer", 2);
      args.maxDocuments = value;
    } else if (arg === "--now") args.now = next();
    else if (arg === "--json") args.json = true;
    else throw new InventoryError("unknown_option", `Unknown option: ${arg}`, 2);
  }
  return args;
}

function resolveFromCwd(filePath) {
  return path.resolve(process.cwd(), filePath);
}

export async function runInventory(args) {
  const registryPath = resolveFromCwd(args.registry);
  const statePath = resolveFromCwd(args.state);
  const reportDir = resolveFromCwd(args.reportDir);
  const registry = await loadRegistry(registryPath);
  const ragInput = args.ragDump
    ? await loadRagDump(resolveFromCwd(args.ragDump), { registrySha256: registry.sha256 })
    : await fetchRagDocuments({ baseUrl: args.baseUrl, maxDocuments: args.maxDocuments });
  const now = args.now ? new Date(args.now) : new Date();
  const state = buildInventory({
    registryRecords: registry.records,
    registrySha256: registry.sha256,
    documents: ragInput.documents,
    input: ragInput.input,
    now
  });

  // Validate any old snapshot before creating reports. The state writer repeats
  // the same fail-closed compatibility check before its atomic temp-file write.
  await assertExistingStateCompatible(statePath, registry.sha256);
  const reports = await writeInventoryReports(reportDir, state);
  await writeInventoryStateAtomic(statePath, state);
  const outputs = { state: statePath, ...reports };
  return { state, outputs };
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return null;
  }
  const result = await runInventory(args);
  if (args.json) process.stdout.write(`${JSON.stringify(machineOutput(result.state, result.outputs), null, 2)}\n`);
  else process.stdout.write(`${humanSummary(result.state, result.outputs)}\n`);
  return result;
}

const directRun = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (directRun) {
  const jsonMode = process.argv.slice(2).includes("--json");
  main().catch(error => {
    const code = error instanceof InventoryError ? error.code : "unexpected_error";
    const message = error instanceof InventoryError ? error.message : "Unexpected inventory failure";
    if (jsonMode) process.stderr.write(`${JSON.stringify({ ok: false, error: { code, message } })}\n`);
    else process.stderr.write(`[rag:master:inventory] ${code}: ${message}\n`);
    process.exitCode = error instanceof InventoryError ? error.exitCode : 1;
  });
}

export const INVENTORY_SCRIPT_PATH = fileURLToPath(import.meta.url);
