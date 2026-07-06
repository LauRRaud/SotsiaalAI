#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { summarizeFreshnessAudit } from "../lib/rag/sourceFreshness.js";

function usage() {
  return [
    "Usage:",
    "  npm run rag:audit:freshness -- --file <sources.json> [--file <more.json>] [--json] [--no-fail]",
    "  npm run rag:audit:freshness -- --db [--limit 500] [--json] [--no-fail]",
    "",
    "Audits RAG source freshness and first-pass metadata quality from source metadata. JSON files may contain an array,",
    "a { sources: [] } object, a { documents: [] } object, or one source/document object."
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    files: [],
    db: false,
    json: false,
    noFail: false,
    limit: 500
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--file" || arg === "-f") {
      const value = argv[index + 1];
      if (!value) throw new Error("--file requires a path");
      args.files.push(value);
      index += 1;
    } else if (arg === "--db") {
      args.db = true;
    } else if (arg === "--json") {
      args.json = true;
    } else if (arg === "--no-fail") {
      args.noFail = true;
    } else if (arg === "--limit") {
      const value = Number(argv[index + 1]);
      if (!Number.isFinite(value) || value <= 0) throw new Error("--limit requires a positive number");
      args.limit = Math.floor(value);
      index += 1;
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      args.files.push(arg);
    }
  }

  return args;
}

function extractRecords(value, label) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") {
    throw new Error(`${label}: expected JSON object or array`);
  }
  for (const field of ["sources", "documents", "items", "records", "data"]) {
    if (Array.isArray(value[field])) return value[field];
  }
  return [value];
}

async function loadJsonFile(filePath) {
  const absolute = path.resolve(filePath);
  const text = await fs.readFile(absolute, "utf8");
  const parsed = JSON.parse(text);
  return extractRecords(parsed, absolute);
}

async function loadDbRecords(limit) {
  const { default: prisma } = await import("../lib/prisma.js");
  try {
    return await prisma.ragDocument.findMany({
      take: limit,
      orderBy: {
        updatedAt: "desc"
      },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        audience: true,
        sourceUrl: true,
        fileName: true,
        remoteId: true,
        metadata: true,
        insertedAt: true,
        updatedAt: true
      }
    });
  } finally {
    await prisma.$disconnect?.();
  }
}

function formatIssue(item) {
  const title = item.title || item.source_id || item.document_id || "(untitled)";
  const type = item.source_type || "unknown";
  const lastChecked = item.last_checked || "missing";
  const reasons = item.reasons.length > 0 ? item.reasons.join(",") : "ok";
  return `${item.severity.toUpperCase()} ${item.freshness_status} ${type} ${lastChecked} ${title} [${reasons}]`;
}

function printTextReport(result) {
  const { summary, items } = result;
  console.log(`RAG source freshness audit: ${summary.total} sources`);
  console.log(`ok=${summary.ok} due_soon=${summary.due_soon} stale=${summary.stale} missing_last_checked=${summary.missing_last_checked} expired=${summary.expired}`);
  console.log(`warnings=${summary.warnings} errors=${summary.errors}`);

  const issues = items
    .filter(item => item.severity === "error" || item.severity === "warning")
    .sort((a, b) => {
      const severityRank = { error: 0, warning: 1, info: 2 };
      return (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9);
    })
    .slice(0, 25);

  if (issues.length > 0) {
    console.log("");
    console.log("Top issues:");
    for (const item of issues) console.log(`- ${formatIssue(item)}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (!args.db && args.files.length === 0)) {
    console.log(usage());
    return;
  }

  const records = [];
  for (const file of args.files) {
    records.push(...await loadJsonFile(file));
  }
  if (args.db) {
    records.push(...await loadDbRecords(args.limit));
  }

  const result = summarizeFreshnessAudit(records);
  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printTextReport(result);
  }

  if (!args.noFail && result.summary.errors > 0) {
    process.exitCode = 1;
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch(error => {
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
  });
}
