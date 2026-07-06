#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

import { buildLegacyAjakiriCleanupPlan } from "../lib/rag/legacyAjakiriCleanup.js";

const RAW_RAG_HOST = String(process.env.RAG_INTERNAL_HOST || process.env.RAG_API_BASE || "127.0.0.1:8000").trim();
const RAG_KEY = String(process.env.RAG_SERVICE_API_KEY || "").trim();

function normalizeBaseFromHost(host) {
  const trimmed = String(host || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "http://127.0.0.1:8000";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

function usage() {
  console.log(`
Usage:
  npm run rag:cleanup:ajakiri-legacy -- --dry-run --plan-json logs/ajakiri-legacy-cleanup-plan.json
  npm run rag:cleanup:ajakiri-legacy -- --delete --concurrency 2 --plan-json logs/ajakiri-legacy-cleanup-run.json

Options:
  --base-url <url>       RAG service URL. Default from env or http://127.0.0.1:8000
  --page-size <n>        Documents API page size. Default: 100.
  --max-docs <n>         Maximum documents to fetch before planning. Default: 5000.
  --limit <n>            Limit duplicate deletes when --delete is used.
  --concurrency <n>      Parallel delete requests. Default: 1. Max: 3.
  --plan-json <path>     Write the cleanup plan/result JSON.
  --dry-run              Build the plan only. This is the default.
  --delete               Delete only safe delete_duplicate actions.
  --stop-on-error        Stop after first failed delete.
`.trim());
}

function parseArgs(argv) {
  const args = {
    baseUrl: normalizeBaseFromHost(RAW_RAG_HOST),
    pageSize: 100,
    maxDocs: 5000,
    limit: 0,
    concurrency: 1,
    planJson: "",
    delete: false,
    stopOnError: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index] || "");
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    if (arg === "--base-url") {
      args.baseUrl = normalizeBaseFromHost(String(argv[++index] || ""));
      continue;
    }
    if (arg === "--page-size") {
      args.pageSize = Math.max(1, Math.min(100, Number.parseInt(String(argv[++index] || "100"), 10) || 100));
      continue;
    }
    if (arg === "--max-docs") {
      args.maxDocs = Math.max(1, Number.parseInt(String(argv[++index] || "5000"), 10) || 5000);
      continue;
    }
    if (arg === "--limit") {
      args.limit = Math.max(0, Number.parseInt(String(argv[++index] || "0"), 10) || 0);
      continue;
    }
    if (arg === "--concurrency") {
      args.concurrency = Math.max(1, Math.min(3, Number.parseInt(String(argv[++index] || "1"), 10) || 1));
      continue;
    }
    if (arg === "--plan-json") {
      args.planJson = String(argv[++index] || "").trim();
      continue;
    }
    if (arg === "--dry-run") {
      args.delete = false;
      continue;
    }
    if (arg === "--delete") {
      args.delete = true;
      continue;
    }
    if (arg === "--stop-on-error") {
      args.stopOnError = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!RAG_KEY) {
    throw new Error("RAG_SERVICE_API_KEY is missing.");
  }
  return args;
}

function buildHeaders(extra = {}) {
  return {
    "X-API-Key": RAG_KEY,
    ...extra
  };
}

async function fetchDocumentsPage(baseUrl, limit, offset) {
  const url = new URL("/documents", `${baseUrl}/`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  const response = await fetch(url, {
    headers: buildHeaders()
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Documents API failed HTTP ${response.status}: ${text.slice(0, 200)}`);
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

async function collectDocuments(args) {
  const out = [];
  for (let offset = 0; out.length < args.maxDocs; offset += args.pageSize) {
    const limit = Math.min(args.pageSize, args.maxDocs - out.length);
    const page = await fetchDocumentsPage(args.baseUrl, limit, offset);
    out.push(...page);
    if (page.length < limit) break;
  }
  return out;
}

async function deleteDocument(baseUrl, docId) {
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/documents/${encodeURIComponent(docId)}`, {
    method: "DELETE",
    headers: buildHeaders({
      "X-Observability-Route": "script/cleanup-legacy-ajakiri-rag-docs",
      "X-Observability-Stage": "rag_legacy_cleanup"
    })
  });
  const data = await response.json().catch(async () => ({ detail: await response.text().catch(() => "") }));
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.detail || data?.message || `HTTP ${response.status}`);
  }
  return data;
}

async function runPool(items, concurrency, worker) {
  let index = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (index < items.length) {
      const item = items[index++];
      await worker(item);
    }
  });
  await Promise.all(workers);
}

function printPlan(plan, args) {
  const duplicateCount = plan.summary.delete_duplicate || 0;
  const reviewCount = plan.summary.review_legacy || 0;
  console.log(`[ajakiri:cleanup] base: ${args.baseUrl}`);
  console.log(`[ajakiri:cleanup] mode: ${args.delete ? "delete" : "dry-run"}`);
  console.log(`[ajakiri:cleanup] documents: ${plan.summary.total_documents}`);
  console.log(`[ajakiri:cleanup] article_ingest: ${plan.summary.article_ingest_documents}`);
  console.log(`[ajakiri:cleanup] legacy_file: ${plan.summary.legacy_ajakiri_file_documents}`);
  console.log(`[ajakiri:cleanup] delete_duplicate: ${duplicateCount}`);
  console.log(`[ajakiri:cleanup] review_legacy: ${reviewCount}`);

  const preview = plan.actions.slice(0, 20);
  for (const item of preview) {
    if (item.action === "delete_duplicate") {
      console.log(`[delete_candidate] ${item.doc_id} -> ${item.replacement_doc_id} (${item.match_reason})`);
    } else {
      console.log(`[review] ${item.doc_id} ${item.reason}`);
    }
  }
  if (plan.actions.length > preview.length) {
    console.log(`[ajakiri:cleanup] ... ${plan.actions.length - preview.length} more`);
  }
}

async function writePlan(filePath, payload) {
  if (!filePath) return;
  await fs.mkdir(path.dirname(filePath), { recursive: true }).catch(() => {});
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`[ajakiri:cleanup] plan json: ${filePath}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const documents = await collectDocuments(args);
  const plan = buildLegacyAjakiriCleanupPlan(documents);
  printPlan(plan, args);

  const deleteItems = plan.actions
    .filter(item => item.action === "delete_duplicate")
    .slice(0, args.limit > 0 ? args.limit : undefined);

  const result = {
    ...plan,
    mode: args.delete ? "delete" : "dry-run",
    deleted: [],
    failed: []
  };

  if (!args.delete) {
    await writePlan(args.planJson, result);
    console.log("[ajakiri:cleanup] dry-run complete. No documents deleted.");
    return;
  }

  await runPool(deleteItems, args.concurrency, async item => {
    try {
      const deleteResult = await deleteDocument(args.baseUrl, item.doc_id);
      result.deleted.push({
        doc_id: item.doc_id,
        replacement_doc_id: item.replacement_doc_id,
        hadEntry: deleteResult?.hadEntry ?? null
      });
      console.log(`[deleted] ${item.doc_id}`);
    } catch (error) {
      result.failed.push({
        doc_id: item.doc_id,
        error: error.message
      });
      console.error(`[error] ${item.doc_id}: ${error.message}`);
      if (args.stopOnError) throw error;
    }
  });

  await writePlan(args.planJson, result);
  console.log(`[ajakiri:cleanup] done deleted=${result.deleted.length} failed=${result.failed.length}`);
  if (result.failed.length > 0) process.exitCode = 1;
}

main().catch(error => {
  console.error("[ajakiri:cleanup] Failed:", error.message);
  process.exit(1);
});
