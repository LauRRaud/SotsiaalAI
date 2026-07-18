#!/usr/bin/env node

import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  BaselineError,
  buildBaselineReport,
  loadLiveTelemetry,
  loadSanitizedFixture,
  parseInterval,
  writeReportPairAtomic
} from "./lib/rag-quality-baseline.mjs";

const DEFAULT_OUTPUT_DIR = "logs";

export function usage() {
  return [
    "Usage:",
    "  npm run rag:qm:baseline -- --from <ISO> --to <ISO>",
    "  npm run rag:qm:baseline -- --from <ISO> --to <ISO> --fixture <path> --json",
    "",
    "Options:",
    "  --from <ISO>         Inclusive interval start; required",
    "  --to <ISO>           Exclusive interval end; required",
    "  --fixture <path>     Sanitized synthetic fixture instead of the live database",
    `  --output-dir <path>  Report directory (default ${DEFAULT_OUTPUT_DIR})`,
    "  --now <ISO>          Deterministic report timestamp for fixtures and audits",
    "  --json               Print the validated report object to stdout",
    "  --help               Show this help",
    "",
    "Live mode performs only bounded SELECT queries against ChatLog.",
    "It never reads ConversationMessage.content and never writes to the database.",
    "Exit codes: 0 success; 2 CLI/range; 3 fixture/privacy/schema; 4 database read; 5 output write."
  ].join("\n");
}

export function parseArgs(argv = []) {
  const args = {
    from: null,
    to: null,
    fixture: null,
    outputDir: DEFAULT_OUTPUT_DIR,
    now: null,
    json: false,
    help: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[++index];
      if (!value) throw new BaselineError("missing_option_value", "CLI option requires a value", 2);
      return value;
    };
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--from") args.from = next();
    else if (arg === "--to") args.to = next();
    else if (arg === "--fixture") args.fixture = next();
    else if (arg === "--output-dir") args.outputDir = next();
    else if (arg === "--now") args.now = next();
    else if (arg === "--json") args.json = true;
    else throw new BaselineError("unknown_option", "Unknown CLI option", 2);
  }
  return args;
}

function parseGeneratedAt(value) {
  if (!value) return new Date();
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || !/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new BaselineError("invalid_now", "--now must be a valid ISO-8601 instant", 2);
  }
  return date;
}

async function defaultPrismaLoader() {
  try {
    const imported = await import("../lib/prisma.js");
    return imported.default || imported.prisma;
  } catch {
    throw new BaselineError("database_unavailable", "Read-only database client is unavailable", 4);
  }
}

export async function runBaseline(args, { prismaLoader = defaultPrismaLoader } = {}) {
  const interval = parseInterval(args.from, args.to);
  const generatedAt = parseGeneratedAt(args.now);
  let prisma = null;
  try {
    let telemetry;
    if (args.fixture) {
      telemetry = await loadSanitizedFixture(path.resolve(process.cwd(), args.fixture), interval);
    } else {
      prisma = await prismaLoader();
      telemetry = await loadLiveTelemetry(prisma, interval);
    }
    const report = buildBaselineReport({
      ...telemetry,
      interval,
      generatedAt,
      sourceKind: args.fixture ? "sanitized_fixture" : "chatlog_read_only"
    });
    const outputs = await writeReportPairAtomic(path.resolve(process.cwd(), args.outputDir), report);
    return { report, outputs };
  } finally {
    if (prisma && typeof prisma.$disconnect === "function") {
      await prisma.$disconnect().catch(() => {});
    }
  }
}

export async function main(argv = process.argv.slice(2), dependencies = {}) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return null;
  }
  const result = await runBaseline(args, dependencies);
  if (args.json) {
    process.stdout.write(`${JSON.stringify(result.report, null, 2)}\n`);
  } else {
    process.stdout.write([
      "RAG-QM-P0 baseline report created.",
      `Source: ${result.report.source}`,
      `Interval: ${result.report.interval.from} .. ${result.report.interval.to}`,
      `JSON: ${result.outputs.jsonFile}`,
      `Markdown: ${result.outputs.markdownFile}`
    ].join("\n") + "\n");
  }
  return result;
}

const directRun = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (directRun) {
  const jsonMode = process.argv.slice(2).includes("--json");
  main().catch(error => {
    const known = error instanceof BaselineError;
    const payload = {
      ok: false,
      error: {
        code: known ? error.code : "unexpected_error",
        message: known ? error.message : "Unexpected baseline failure"
      }
    };
    if (jsonMode) process.stderr.write(`${JSON.stringify(payload)}\n`);
    else process.stderr.write(`[rag:qm:baseline] ${payload.error.code}: ${payload.error.message}\n`);
    process.exitCode = known ? error.exitCode : 1;
  });
}
