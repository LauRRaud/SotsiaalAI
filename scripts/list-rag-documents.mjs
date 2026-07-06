#!/usr/bin/env node

// Lists every document currently in the RAG database (read-only). Pulls the
// rag-service /documents registry and prints a readable inventory, or writes
// JSON / CSV. Run on the server (env loaded) or via a tunnel to 127.0.0.1:8000.

import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";

const DEFAULT_HOST = "127.0.0.1:8000";
const PAGE_SIZE = 100;

function usage() {
  return [
    "Usage:",
    "  npm run rag:list:docs                          (readable list, grouped by collection)",
    "  npm run rag:list:docs -- --json docs.json      (full JSON)",
    "  npm run rag:list:docs -- --csv docs.csv        (spreadsheet: title,collection,source_type,chunks,url,docId)",
    "  npm run rag:list:docs -- --collection sotsiaaltoo_articles   (filter one collection)",
    "  npm run rag:list:docs -- --titles-only         (just titles, one per line)",
    "",
    "Environment:",
    "  RAG_INTERNAL_HOST / RAG_API_BASE   RAG service host (default 127.0.0.1:8000)",
    "  RAG_SERVICE_API_KEY / RAG_API_KEY  X-API-Key for the RAG service",
    "",
    "Read-only: never writes to the RAG service."
  ].join("\n");
}

function parseArgs(argv = []) {
  const args = {
    baseUrl: null,
    apiKey: process.env.RAG_SERVICE_API_KEY || process.env.RAG_API_KEY || "",
    jsonPath: null,
    csvPath: null,
    collection: null,
    titlesOnly: false,
    help: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--base-url") args.baseUrl = argv[++index] || null;
    else if (arg === "--api-key") args.apiKey = argv[++index] || "";
    else if (arg === "--json") args.jsonPath = argv[++index] || null;
    else if (arg === "--csv") args.csvPath = argv[++index] || null;
    else if (arg === "--collection") args.collection = argv[++index] || null;
    else if (arg === "--titles-only") args.titlesOnly = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return args;
}

export function ragServiceBaseUrl(explicit = null) {
  const raw = explicit || process.env.RAG_INTERNAL_HOST || process.env.RAG_API_BASE || DEFAULT_HOST;
  const trimmed = String(raw).trim().replace(/\/+$/u, "");
  return /^https?:\/\//u.test(trimmed) ? trimmed : `http://${trimmed}`;
}

function firstValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return null;
}

export function normalizeDocument(doc = {}) {
  return {
    docId: firstValue(doc.docId, doc.id),
    title: firstValue(doc.title, doc.fileName, "(pealkirjata)"),
    collection_id: firstValue(doc.collection_id, doc.collectionId, "(määramata)"),
    source_type: firstValue(doc.source_type, doc.sourceType, doc.type, "(määramata)"),
    chunks: Number.isFinite(doc.chunks) ? doc.chunks : (doc.chunks ? Number(doc.chunks) : 0),
    url: firstValue(doc.url_canonical, doc.urlCanonical, doc.url, doc.sourceUrl, doc.source_url),
    year: firstValue(doc.year, doc.source_year),
    authority: firstValue(doc.authority)
  };
}

async function fetchAllDocuments(baseUrl, apiKey) {
  const docs = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const response = await fetch(`${baseUrl}/documents?limit=${PAGE_SIZE}&offset=${offset}`, {
      headers: { "X-API-Key": apiKey }
    });
    if (!response.ok) {
      throw new Error(`GET /documents failed with HTTP ${response.status} at offset ${offset}`);
    }
    const page = await response.json();
    const items = Array.isArray(page) ? page : [];
    docs.push(...items);
    if (items.length < PAGE_SIZE) break;
  }
  return docs;
}

export function groupByCollection(docs = []) {
  const groups = {};
  for (const doc of docs) {
    const key = doc.collection_id || "(määramata)";
    (groups[key] = groups[key] || []).push(doc);
  }
  for (const list of Object.values(groups)) {
    list.sort((a, b) => String(a.title).localeCompare(String(b.title), "et"));
  }
  return groups;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(docs = []) {
  const header = ["title", "collection_id", "source_type", "chunks", "year", "authority", "url", "docId"];
  const rows = docs.map(d => header.map(k => csvCell(d[k])).join(","));
  return [header.join(","), ...rows].join("\n");
}

function printReadable(groups, total) {
  const collections = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length);
  console.log(`RAG andmebaasi dokumendid: ${total} kokku, ${collections.length} kollektsiooni\n`);
  for (const collection of collections) {
    const list = groups[collection];
    console.log(`## ${collection} (${list.length})`);
    for (const doc of list) {
      const meta = [doc.year, `${doc.chunks} chunki`].filter(Boolean).join(", ");
      console.log(`  - ${doc.title}${meta ? `  [${meta}]` : ""}`);
    }
    console.log("");
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.apiKey) throw new Error("RAG_SERVICE_API_KEY or RAG_API_KEY is required");

  const baseUrl = ragServiceBaseUrl(args.baseUrl);
  process.stderr.write(`[list] fetching documents from ${baseUrl} ...\n`);
  let docs = (await fetchAllDocuments(baseUrl, args.apiKey)).map(normalizeDocument);
  if (args.collection) docs = docs.filter(d => d.collection_id === args.collection);
  docs.sort((a, b) => String(a.title).localeCompare(String(b.title), "et"));

  if (args.titlesOnly) {
    for (const doc of docs) console.log(doc.title);
    process.stderr.write(`[list] ${docs.length} documents\n`);
    return;
  }
  if (args.jsonPath) {
    await fs.writeFile(args.jsonPath, JSON.stringify({ total: docs.length, generated_at: new Date().toISOString(), documents: docs }, null, 2), "utf8");
    process.stderr.write(`[list] wrote ${docs.length} documents to ${args.jsonPath}\n`);
  }
  if (args.csvPath) {
    await fs.writeFile(args.csvPath, toCsv(docs), "utf8");
    process.stderr.write(`[list] wrote ${docs.length} documents to ${args.csvPath}\n`);
  }
  if (!args.jsonPath && !args.csvPath) {
    printReadable(groupByCollection(docs), docs.length);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(JSON.stringify({ ok: false, error: error?.message || String(error) }));
    process.exitCode = 1;
  });
}
