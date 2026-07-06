#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

import {
  loadKnowledgeMetadataFiles,
  validateKnowledgeMetadata
} from "./lib/knowledge-docs.mjs";
import {
  analyzePdfSectionIndex,
  applyPdfSectionAnalysisToMetadata
} from "./lib/pdf-section-index.mjs";

const RAW_RAG_HOST = String(process.env.RAG_INTERNAL_HOST || process.env.RAG_API_BASE || "127.0.0.1:8000").trim();
const RAG_KEY = String(process.env.RAG_SERVICE_API_KEY || process.env.RAG_API_KEY || "").trim();
const DEFAULT_TIMEOUT_MS = Math.max(
  30_000,
  Number.parseInt(String(process.env.RAG_INGEST_REQUEST_TIMEOUT_MS || "300000"), 10) || 300_000
);

function usage() {
  console.log(`
Usage:
  npm run knowledge:folder:plan -- --root "Andmebaasi/lisatest"
  npm run knowledge:folder:ingest -- --root "Andmebaasi/lisatest" --skip-existing
  npm run knowledge:folder:ingest -- --root "Andmebaasi/uuringud-ja-juhendid" --analyze-pdf --skip-existing --json logs/knowledge-folder-ingest.json

Options:
  --root <path>                  Folder with knowledge-doc-v1 JSON files and source PDFs.
  --dry-run                      Validate and plan only. Default unless --ingest is passed.
  --ingest                       Send PDFs with metadata to RAG /ingest/pdf-with-metadata.
  --skip-existing                Skip docId already present in RAG registry.
  --doc-id <id>                  Process only this docId. Can be repeated.
  --limit <n>                    Process at most n valid items.
  --analyze-pdf                  Build an in-memory sectionIndex from PDF TOC/headings before ingest.
  --require-section-index        Fail items whose PDF sectionIndex cannot be detected.
  --section-analysis-max-pages <n>
                                 Maximum pages to inspect for headings. Default: 250.
  --base-url <url>               RAG service URL. Default from env or http://127.0.0.1:8000
  --request-timeout-ms <n>       Default 300000.
  --json <path>                  Write full result JSON.
  --help

Environment:
  RAG_SERVICE_API_KEY or RAG_API_KEY is required with --ingest.
  RAG_INTERNAL_HOST or RAG_API_BASE can set the RAG service URL.
`.trim());
}

function normalizeBaseFromHost(value) {
  const raw = String(value || "").trim();
  if (!raw) return "http://127.0.0.1:8000";
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/+$/u, "");
  return `http://${raw.replace(/\/+$/u, "")}`;
}

function parseArgs(argv = []) {
  const args = {
    root: "",
    dryRun: true,
    ingest: false,
    skipExisting: false,
    docIds: [],
    limit: 0,
    analyzePdf: false,
    requireSectionIndex: false,
    sectionAnalysisMaxPages: 250,
    baseUrl: normalizeBaseFromHost(RAW_RAG_HOST),
    requestTimeoutMs: DEFAULT_TIMEOUT_MS,
    json: ""
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index] || "");
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else if (arg === "--root") {
      args.root = String(argv[++index] || "").trim();
    } else if (arg === "--dry-run") {
      args.dryRun = true;
      args.ingest = false;
    } else if (arg === "--ingest") {
      args.ingest = true;
      args.dryRun = false;
    } else if (arg === "--skip-existing") {
      args.skipExisting = true;
    } else if (arg === "--doc-id") {
      const value = String(argv[++index] || "").trim();
      if (value) args.docIds.push(value);
    } else if (arg === "--limit") {
      args.limit = Math.max(0, Number.parseInt(String(argv[++index] || "0"), 10) || 0);
    } else if (arg === "--analyze-pdf") {
      args.analyzePdf = true;
    } else if (arg === "--require-section-index") {
      args.requireSectionIndex = true;
    } else if (arg === "--section-analysis-max-pages") {
      args.sectionAnalysisMaxPages = Math.max(1, Number.parseInt(String(argv[++index] || "250"), 10) || 250);
    } else if (arg === "--base-url") {
      args.baseUrl = normalizeBaseFromHost(String(argv[++index] || ""));
    } else if (arg === "--request-timeout-ms") {
      args.requestTimeoutMs = Math.max(10_000, Number.parseInt(String(argv[++index] || ""), 10) || DEFAULT_TIMEOUT_MS);
    } else if (arg === "--json") {
      args.json = String(argv[++index] || "").trim();
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return args;
}

function unique(values = []) {
  return [...new Set(values.map(value => String(value ?? "").trim()).filter(Boolean))];
}

async function writeJson(filePath, payload) {
  await fs.mkdir(path.dirname(path.resolve(filePath)), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function exists(filePath) {
  if (!filePath) return false;
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

async function isDocumentExisting(baseUrl, docId, timeoutMs) {
  const response = await fetchWithTimeout(`${baseUrl}/documents/${encodeURIComponent(docId)}`, {
    method: "GET",
    headers: { "X-API-Key": RAG_KEY }
  }, timeoutMs);
  if (response.status === 404) return false;
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`registry check failed HTTP ${response.status}: ${text.slice(0, 200)}`);
  }
  return true;
}

async function readPdf(filePath) {
  const buffer = Buffer.from(await fs.readFile(filePath));
  if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new Error("source_path does not point to a PDF file");
  }
  return buffer;
}

function fileNameFromMetadata(metadata = {}) {
  const sourcePath = String(metadata.source_path || "").trim();
  const base = sourcePath ? path.basename(sourcePath) : "";
  return base || `${metadata.docId || "knowledge-doc"}.pdf`;
}

async function maybeAnalyzePdf(args, item, pdfBuffer) {
  if (!args.analyzePdf) return item;
  try {
    const analysis = await analyzePdfSectionIndex(pdfBuffer, item.metadata, {
      maxPages: args.sectionAnalysisMaxPages
    });
    item.metadata = applyPdfSectionAnalysisToMetadata(item.metadata, analysis);
    item.validation = validateKnowledgeMetadata(item.metadata, { root: item.root });
    item.sectionAnalysis = analysis;
    if (args.requireSectionIndex && !item.metadata.sectionIndex?.length) {
      item.validation = {
        ...item.validation,
        ok: false,
        errors: unique([...(item.validation.errors || []), "pdf_section_analysis: sectionIndex is required but was not detected"])
      };
    }
  } catch (error) {
    const message = String(error?.message || error || "unknown error").slice(0, 240);
    item.sectionAnalysis = {
      checked: true,
      ok: false,
      method: "error",
      confidence: "none",
      section_count: 0,
      warnings: [message]
    };
    item.validation = {
      ...item.validation,
      ok: !args.requireSectionIndex && item.validation.ok,
      errors: args.requireSectionIndex
        ? unique([...(item.validation.errors || []), `pdf_section_analysis failed: ${message}`])
        : item.validation.errors,
      warnings: unique([...(item.validation.warnings || []), `pdf_section_analysis failed: ${message}`])
    };
  }
  return item;
}

async function loadItems(args) {
  const root = path.resolve(args.root);
  const metadataFiles = await loadKnowledgeMetadataFiles(root);
  const docIdFilter = new Set(args.docIds);
  const items = [];
  for (const file of metadataFiles) {
    const validation = validateKnowledgeMetadata(file.data || {}, { root });
    const metadata = validation.metadata;
    if (docIdFilter.size && !docIdFilter.has(metadata.docId)) continue;
    const sourceFilePath = validation.sourceFilePath;
    const sourceFileExists = await exists(sourceFilePath);
    items.push({
      root,
      file: file.fileName,
      filePath: file.filePath,
      metadata,
      sourceFilePath,
      sourceFileExists,
      validation: {
        ok: validation.ok && sourceFileExists,
        errors: unique([
          ...validation.errors,
          ...(sourceFileExists ? [] : ["source_path file is missing"])
        ]),
        warnings: validation.warnings
      }
    });
    if (args.limit && items.length >= args.limit) break;
  }
  return items;
}

function summarizeItem(item = {}) {
  return {
    file: item.file,
    docId: item.metadata?.docId,
    title: item.metadata?.title,
    source_path: item.metadata?.source_path,
    source_file_exists: item.sourceFileExists,
    collection_id: item.metadata?.collection_id,
    source_type: item.metadata?.source_type,
    resource_type: item.metadata?.resource_type,
    evidence_role: item.metadata?.evidence_role,
    section_index_count: item.metadata?.sectionIndex?.length || 0,
    validation: item.validation
  };
}

async function ingestItem(args, item) {
  if (!item.validation.ok) {
    return {
      docId: item.metadata?.docId,
      status: "invalid_metadata",
      errors: item.validation.errors
    };
  }
  if (args.skipExisting && await isDocumentExisting(args.baseUrl, item.metadata.docId, args.requestTimeoutMs)) {
    return {
      docId: item.metadata.docId,
      status: "skipped_existing"
    };
  }
  const pdf = await readPdf(item.sourceFilePath);
  if (args.analyzePdf && !item.sectionAnalysis) {
    await maybeAnalyzePdf(args, item, pdf);
  }
  if (!item.validation.ok) {
    return {
      docId: item.metadata?.docId,
      status: "invalid_metadata",
      errors: item.validation.errors,
      warnings: item.validation.warnings
    };
  }

  const formData = new FormData();
  formData.append("file", new Blob([pdf], { type: "application/pdf" }), fileNameFromMetadata(item.metadata));
  formData.append("metadata_text", JSON.stringify(item.metadata));

  const response = await fetchWithTimeout(`${args.baseUrl}/ingest/pdf-with-metadata`, {
    method: "POST",
    headers: {
      "X-API-Key": RAG_KEY,
      "X-Observability-Route": "script/ingest-knowledge-doc-folder",
      "X-Observability-Stage": "rag_ingest"
    },
    body: formData
  }, args.requestTimeoutMs);

  const raw = await response.text().catch(() => "");
  let data = {};
  if (raw.trim()) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = { detail: raw };
    }
  }
  if (!response.ok || data?.ok === false) {
    const detail = data?.detail || data?.message || raw;
    throw new Error(`RAG ingest failed HTTP ${response.status}: ${String(detail || "").slice(0, 500)}`);
  }
  return {
    docId: item.metadata.docId,
    status: "ingested",
    inserted: data?.inserted ?? null,
    fileName: data?.fileName || fileNameFromMetadata(item.metadata)
  };
}

async function analyzeItemsIfRequested(args, items = []) {
  if (!args.analyzePdf) return;
  for (const item of items) {
    if (!item.sourceFileExists) continue;
    try {
      const pdf = await readPdf(item.sourceFilePath);
      await maybeAnalyzePdf(args, item, pdf);
    } catch (error) {
      const message = String(error?.message || error || "unknown error").slice(0, 240);
      item.sectionAnalysis = {
        checked: true,
        ok: false,
        method: "error",
        confidence: "none",
        section_count: 0,
        warnings: [message]
      };
      item.validation = {
        ...item.validation,
        ok: !args.requireSectionIndex && item.validation.ok,
        errors: args.requireSectionIndex
          ? unique([...(item.validation.errors || []), `pdf_section_analysis failed: ${message}`])
          : item.validation.errors,
        warnings: unique([...(item.validation.warnings || []), `pdf_section_analysis failed: ${message}`])
      };
    }
  }
}

function countBy(items = [], field) {
  return items.reduce((acc, item) => {
    const key = String(item.metadata?.[field] || "unknown");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.root) throw new Error("Pass --root <path>.");
  if (args.ingest && !RAG_KEY) throw new Error("RAG_SERVICE_API_KEY or RAG_API_KEY is required with --ingest.");

  const items = await loadItems(args);
  await analyzeItemsIfRequested(args, items);
  const result = {
    ok: items.every(item => item.validation.ok),
    mode: args.ingest ? "ingest" : "dry-run",
    root: path.resolve(args.root),
    baseUrl: args.ingest ? args.baseUrl : null,
    total_metadata_files: items.length,
    valid_count: items.filter(item => item.validation.ok).length,
    invalid_count: items.filter(item => !item.validation.ok).length,
    by_collection: countBy(items, "collection_id"),
    by_source_type: countBy(items, "source_type"),
    by_resource_type: countBy(items, "resource_type"),
    analyze_pdf: args.analyzePdf,
    require_section_index: args.requireSectionIndex,
    items: items.map(summarizeItem),
    ingest_results: []
  };

  if (args.ingest) {
    for (const item of items) {
      try {
        result.ingest_results.push(await ingestItem(args, item));
      } catch (error) {
        result.ok = false;
        result.ingest_results.push({
          docId: item.metadata?.docId,
          status: "error",
          error: error?.message || String(error)
        });
      }
    }
    result.items = items.map(summarizeItem);
    result.valid_count = items.filter(item => item.validation.ok).length;
    result.invalid_count = items.filter(item => !item.validation.ok).length;
    result.ok = result.ok && result.ingest_results.every(item => !["error", "invalid_metadata"].includes(item.status));
  }

  if (args.json) await writeJson(args.json, result);
  console.log(JSON.stringify({
    ok: result.ok,
    mode: result.mode,
    root: result.root,
    baseUrl: result.baseUrl,
    total_metadata_files: result.total_metadata_files,
    valid_count: result.valid_count,
    invalid_count: result.invalid_count,
    by_collection: result.by_collection,
    by_source_type: result.by_source_type,
    by_resource_type: result.by_resource_type,
    analyze_pdf: result.analyze_pdf,
    require_section_index: result.require_section_index,
    ingest_summary: result.ingest_results.reduce((acc, item) => {
      const key = item.status || "unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
    output: args.json || null
  }, null, 2));
  if (!result.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`[knowledge:folder] ${error?.message || String(error)}`);
  process.exitCode = 1;
});
