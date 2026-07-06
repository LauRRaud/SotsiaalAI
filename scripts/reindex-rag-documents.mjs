#!/usr/bin/env node
import crypto from "node:crypto";

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
  node scripts/reindex-rag-documents.mjs --journal "Sotsiaaltöö" --dry-run
  node scripts/reindex-rag-documents.mjs --journal "Sotsiaaltöö" --concurrency 2
  node scripts/reindex-rag-documents.mjs --doc-id <doc-id>

Options:
  --base-url <url>       RAG service URL. Default from env or http://127.0.0.1:8000
  --journal <name>       Filter by exact journalTitle.
  --doc-id <id>          Reindex one exact document id. Can be passed multiple times.
  --audience <value>     Filter by audience value.
  --type <value>         Filter by registry type, e.g. FILE.
  --limit <n>            Stop after n matched docs.
  --offset <n>           Skip first n matched docs.
  --concurrency <n>      Parallel requests. Default: 1. Recommended: 1-3.
  --page-size <n>        Documents API page size. Default: 100.
  --dry-run              List matched docs without reindexing.
  --stop-on-error        Stop after first failed reindex.
`.trim());
}

function parseArgs(argv) {
  const args = {
    baseUrl: normalizeBaseFromHost(RAW_RAG_HOST),
    journal: "",
    docIds: [],
    audience: "",
    type: "",
    limit: 0,
    offset: 0,
    concurrency: 1,
    pageSize: 100,
    dryRun: false,
    stopOnError: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i] || "");
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    if (arg === "--base-url") {
      args.baseUrl = normalizeBaseFromHost(String(argv[++i] || ""));
      continue;
    }
    if (arg === "--journal") {
      args.journal = String(argv[++i] || "").trim();
      continue;
    }
    if (arg === "--doc-id") {
      const value = String(argv[++i] || "").trim();
      if (value) args.docIds.push(value);
      continue;
    }
    if (arg === "--audience") {
      args.audience = String(argv[++i] || "").trim();
      continue;
    }
    if (arg === "--type") {
      args.type = String(argv[++i] || "").trim().toUpperCase();
      continue;
    }
    if (arg === "--limit") {
      args.limit = Math.max(0, Number.parseInt(String(argv[++i] || "0"), 10) || 0);
      continue;
    }
    if (arg === "--offset") {
      args.offset = Math.max(0, Number.parseInt(String(argv[++i] || "0"), 10) || 0);
      continue;
    }
    if (arg === "--concurrency") {
      args.concurrency = Math.max(1, Math.min(5, Number.parseInt(String(argv[++i] || "1"), 10) || 1));
      continue;
    }
    if (arg === "--page-size") {
      args.pageSize = Math.max(1, Math.min(100, Number.parseInt(String(argv[++i] || "100"), 10) || 100));
      continue;
    }
    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (arg === "--stop-on-error") {
      args.stopOnError = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!args.docIds.length && !args.journal && !args.audience && !args.type) {
    throw new Error("Pass at least one filter: --doc-id, --journal, --audience, or --type.");
  }
  if (!args.dryRun && !RAG_KEY) {
    throw new Error("RAG_SERVICE_API_KEY is missing.");
  }
  return args;
}

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function buildHeaders(extra = {}) {
  return {
    ...(RAG_KEY ? { "X-API-Key": RAG_KEY } : {}),
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
    throw new Error(`Documents API failed HTTP ${response.status}: ${text.slice(0, 180)}`);
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

function matchesFilters(doc, args) {
  if (args.docIds.length && !args.docIds.includes(String(doc?.docId || doc?.id || "").trim())) return false;
  if (args.journal && normalizeText(doc?.journalTitle) !== normalizeText(args.journal)) return false;
  if (args.audience && String(doc?.audience || "").trim().toUpperCase() !== String(args.audience).trim().toUpperCase()) return false;
  if (args.type && String(doc?.type || "").trim().toUpperCase() !== args.type) return false;
  return true;
}

async function collectMatchedDocuments(args) {
  const matched = [];
  let remoteOffset = 0;
  let done = false;
  while (!done) {
    const page = await fetchDocumentsPage(args.baseUrl, args.pageSize, remoteOffset);
    if (!page.length) break;
    for (const doc of page) {
      if (matchesFilters(doc, args)) matched.push(doc);
    }
    if (page.length < args.pageSize) done = true;
    remoteOffset += page.length;
  }

  const sliced = matched.slice(args.offset, args.limit > 0 ? args.offset + args.limit : undefined);
  return sliced;
}

async function reindexDocument(baseUrl, docId) {
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/documents/${encodeURIComponent(docId)}/reindex`, {
    method: "POST",
    headers: buildHeaders({
      "X-Observability-Route": "script/reindex-rag-documents",
      "X-Observability-Stage": "rag_reindex"
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
      const current = items[index++];
      await worker(current);
    }
  });
  await Promise.all(workers);
}

function shortFingerprint(value = "") {
  return crypto.createHash("sha1").update(String(value || "")).digest("hex").slice(0, 8);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const docs = await collectMatchedDocuments(args);

  console.log(`[rag:reindex] base: ${args.baseUrl}`);
  console.log(`[rag:reindex] matched: ${docs.length}`);

  for (const doc of docs.slice(0, 20)) {
    console.log(`  - ${doc.docId} | ${doc.journalTitle || "-"} | ${doc.title || "-"} | ${doc.type || "-"} | ${doc.audience || "-"}`);
  }
  if (docs.length > 20) {
    console.log(`  ... ${docs.length - 20} more`);
  }

  if (args.dryRun) return;

  let ok = 0;
  let failed = 0;
  await runPool(docs, args.concurrency, async doc => {
    const docId = String(doc?.docId || doc?.id || "").trim();
    if (!docId) return;
    try {
      const result = await reindexDocument(args.baseUrl, docId);
      ok += 1;
      console.log(`[ok] ${docId} inserted=${result?.inserted ?? "?"}`);
    } catch (error) {
      failed += 1;
      console.error(`[error] ${docId} ${shortFingerprint(docId)}: ${error.message}`);
      if (args.stopOnError) throw error;
    }
  });

  console.log(`[rag:reindex] done ok=${ok} failed=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch(error => {
  console.error("[rag:reindex] Failed:", error.message);
  process.exit(1);
});
