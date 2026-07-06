#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

import {
  buildSourceMasterPdfPlan,
  DEFAULT_SOURCE_MASTER_PATH,
  loadSourceMasterRecords
} from "./lib/source-master-knowledge-docs.mjs";
import {
  analyzePdfSectionIndex,
  applyPdfSectionAnalysisToMetadata
} from "./lib/pdf-section-index.mjs";
import { validateKnowledgeMetadata } from "./lib/knowledge-docs.mjs";

const RAW_RAG_HOST = String(process.env.RAG_INTERNAL_HOST || process.env.RAG_API_BASE || "127.0.0.1:8000").trim();
const RAG_KEY = String(process.env.RAG_SERVICE_API_KEY || "").trim();
const DEFAULT_TIMEOUT_MS = Math.max(
  30_000,
  Number.parseInt(String(process.env.RAG_INGEST_REQUEST_TIMEOUT_MS || "300000"), 10) || 300_000
);

function usage() {
  console.log(`
Usage:
  npm run knowledge:source-master:plan -- --json logs/source-master-pdf-plan.json
  npm run knowledge:source-master:plan -- --priority high --limit 5
  npm run knowledge:source-master:ingest -- --priority high --limit 5 --skip-existing

Options:
  --master <path>       Source master JSON. Default: ${DEFAULT_SOURCE_MASTER_PATH}
  --dry-run             Build plan only. Default unless --ingest is passed.
  --ingest              Download PDFs and send them to /ingest/pdf-with-metadata.
  --priority <value>    Filter by ingest_priority: high, medium, low, all. Default: all.
  --source-id <id>      Process only matching source_id. Can be repeated.
  --limit <n>           Process at most n planned candidates.
  --metadata-dir <path> Write generated metadata JSON files for review.
  --analyze-pdf         Download PDFs during planning and build sectionIndex from TOC/headings.
  --no-analyze-pdf      Disable PDF section analysis. By default it runs for --ingest and --metadata-dir.
  --section-analysis-max-pages <n>
                        Maximum pages to inspect for headings. Default: 250.
  --require-section-index
                        Mark an item as invalid if no reliable sectionIndex is found.
  --json <path>         Write plan/result JSON.
  --skip-existing       With --ingest, skip docId already in RAG registry.
  --base-url <url>      RAG service URL. Default from env or http://127.0.0.1:8000
  --request-timeout-ms <n>
  --help

Notes:
  This script processes only PDF knowledge-doc candidates from master_sources_final.json.
  Organization/web pages remain outside this pipeline and should use separate collection agents.
  PDF section analysis is conservative: if no reliable TOC/headings are found, the item is flagged for review.
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
    master: DEFAULT_SOURCE_MASTER_PATH,
    dryRun: true,
    ingest: false,
    priority: "all",
    sourceIds: [],
    limit: 0,
    metadataDir: "",
    json: "",
    skipExisting: false,
    baseUrl: normalizeBaseFromHost(RAW_RAG_HOST),
    requestTimeoutMs: DEFAULT_TIMEOUT_MS,
    analyzePdf: null,
    sectionAnalysisMaxPages: 250,
    requireSectionIndex: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index] || "");
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else if (arg === "--master") {
      args.master = String(argv[++index] || "").trim();
    } else if (arg === "--dry-run") {
      args.dryRun = true;
      args.ingest = false;
    } else if (arg === "--ingest") {
      args.ingest = true;
      args.dryRun = false;
    } else if (arg === "--priority") {
      args.priority = String(argv[++index] || "all").trim().toLowerCase() || "all";
    } else if (arg === "--source-id") {
      const value = String(argv[++index] || "").trim();
      if (value) args.sourceIds.push(value);
    } else if (arg === "--limit") {
      args.limit = Math.max(0, Number.parseInt(String(argv[++index] || "0"), 10) || 0);
    } else if (arg === "--metadata-dir") {
      args.metadataDir = String(argv[++index] || "").trim();
    } else if (arg === "--analyze-pdf") {
      args.analyzePdf = true;
    } else if (arg === "--no-analyze-pdf") {
      args.analyzePdf = false;
    } else if (arg === "--section-analysis-max-pages") {
      args.sectionAnalysisMaxPages = Math.max(1, Number.parseInt(String(argv[++index] || "250"), 10) || 250);
    } else if (arg === "--require-section-index") {
      args.requireSectionIndex = true;
    } else if (arg === "--json") {
      args.json = String(argv[++index] || "").trim();
    } else if (arg === "--skip-existing") {
      args.skipExisting = true;
    } else if (arg === "--base-url") {
      args.baseUrl = normalizeBaseFromHost(String(argv[++index] || ""));
    } else if (arg === "--request-timeout-ms") {
      args.requestTimeoutMs = Math.max(10_000, Number.parseInt(String(argv[++index] || ""), 10) || DEFAULT_TIMEOUT_MS);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (args.analyzePdf === null) args.analyzePdf = args.ingest || Boolean(args.metadataDir);
  return args;
}

function unique(values = []) {
  return [...new Set(values.map(value => String(value ?? "").trim()).filter(Boolean))];
}

async function writeJson(filePath, payload) {
  await fs.mkdir(path.dirname(path.resolve(filePath)), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
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

async function downloadPdf(url, timeoutMs) {
  const response = await fetchWithTimeout(url, {
    method: "GET",
    headers: {
      "Accept": "application/pdf,application/octet-stream;q=0.9,*/*;q=0.1",
      "User-Agent": "SotsiaalAI-RAG-ingest/1.0"
    }
  }, timeoutMs);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`download failed HTTP ${response.status}: ${text.slice(0, 200)}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
    const contentType = response.headers.get("content-type") || "unknown";
    throw new Error(`download did not return a PDF: content-type=${contentType}`);
  }
  return buffer;
}

function summarizeSectionAnalysis(items = []) {
  const summary = {
    checked: false,
    analyzed: 0,
    with_section_index: 0,
    empty_section_index: 0,
    by_method: {},
    by_confidence: {},
    warnings: 0
  };
  for (const item of items) {
    const analysis = item.metadata?.pdf_section_analysis;
    if (!analysis?.checked) continue;
    summary.checked = true;
    summary.analyzed += 1;
    const count = Number(analysis.section_count) || 0;
    if (count > 0) summary.with_section_index += 1;
    else summary.empty_section_index += 1;
    const method = analysis.method || "unknown";
    const confidence = analysis.confidence || "unknown";
    summary.by_method[method] = (summary.by_method[method] || 0) + 1;
    summary.by_confidence[confidence] = (summary.by_confidence[confidence] || 0) + 1;
    summary.warnings += Array.isArray(analysis.warnings) ? analysis.warnings.length : 0;
  }
  return summary;
}

function updateValidationFromMetadata(item, extraWarnings = [], extraErrors = []) {
  const validation = validateKnowledgeMetadata(item.metadata);
  item.validation = {
    ok: validation.ok && extraErrors.length === 0,
    errors: unique([...validation.errors, ...extraErrors]),
    warnings: unique([...validation.warnings, ...extraWarnings])
  };
  return item.validation;
}

async function applyPdfSectionAnalysis(args, item, pdfBuffer) {
  try {
    const analysis = await analyzePdfSectionIndex(pdfBuffer, item.metadata, {
      maxPages: args.sectionAnalysisMaxPages
    });
    item.metadata = applyPdfSectionAnalysisToMetadata(item.metadata, analysis);
    const extraWarnings = (analysis.warnings || []).map(warning => `pdf_section_analysis: ${warning}`);
    const extraErrors = [];
    if (args.requireSectionIndex && !item.metadata.sectionIndex?.length) {
      extraErrors.push("pdf_section_analysis: sectionIndex is required but was not detected");
    }
    updateValidationFromMetadata(item, extraWarnings, extraErrors);
  } catch (error) {
    const message = String(error?.message || error || "unknown error").slice(0, 240);
    item.metadata = {
      ...item.metadata,
      pdf_section_analysis: {
        checked: true,
        ok: false,
        method: "error",
        confidence: "none",
        section_count: 0,
        warnings: [message]
      },
      quality: {
        ...(item.metadata.quality || {}),
        section_index_complete: false,
        section_index_method: "error",
        section_index_confidence: "none",
        needs_manual_review: true
      }
    };
    const extraErrors = args.requireSectionIndex ? [`pdf_section_analysis failed: ${message}`] : [];
    updateValidationFromMetadata(item, [`pdf_section_analysis failed: ${message}`], extraErrors);
  }
  return item;
}

async function analyzePlanItems(args, items = []) {
  for (const item of items) {
    if (!item.validation.ok) continue;
    try {
      const pdf = await downloadPdf(item.url, args.requestTimeoutMs);
      await applyPdfSectionAnalysis(args, item, pdf);
    } catch (error) {
      const message = String(error?.message || error || "unknown error").slice(0, 240);
      item.metadata = {
        ...item.metadata,
        pdf_section_analysis: {
          checked: true,
          ok: false,
          method: "download_error",
          confidence: "none",
          section_count: 0,
          warnings: [message]
        },
        quality: {
          ...(item.metadata.quality || {}),
          section_index_complete: false,
          section_index_method: "download_error",
          section_index_confidence: "none",
          needs_manual_review: true
        }
      };
      const extraErrors = args.requireSectionIndex ? [`pdf download/analysis failed: ${message}`] : [];
      updateValidationFromMetadata(item, [`pdf download/analysis failed: ${message}`], extraErrors);
    }
  }
}

function fileNameFromItem(item) {
  try {
    const url = new URL(item.url);
    const base = path.basename(decodeURIComponent(url.pathname));
    if (base && /\.pdf$/i.test(base)) return base;
  } catch {
    // fall through
  }
  return `${item.metadata.docId}.pdf`;
}

async function ingestItem(args, item) {
  if (!item.validation.ok) {
    return {
      source_id: item.source_id,
      docId: item.metadata.docId,
      status: "invalid_metadata",
      errors: item.validation.errors
    };
  }
  if (args.skipExisting && await isDocumentExisting(args.baseUrl, item.metadata.docId, args.requestTimeoutMs)) {
    return {
      source_id: item.source_id,
      docId: item.metadata.docId,
      status: "skipped_existing"
    };
  }

  const pdf = await downloadPdf(item.url, args.requestTimeoutMs);
  if (args.analyzePdf) {
    await applyPdfSectionAnalysis(args, item, pdf);
    if (!item.validation.ok) {
      return {
        source_id: item.source_id,
        docId: item.metadata.docId,
        status: "invalid_metadata",
        errors: item.validation.errors,
        warnings: item.validation.warnings
      };
    }
  }
  const formData = new FormData();
  formData.append("file", new Blob([pdf], { type: "application/pdf" }), fileNameFromItem(item));
  formData.append("metadata_text", JSON.stringify(item.metadata));

  const response = await fetchWithTimeout(`${args.baseUrl}/ingest/pdf-with-metadata`, {
    method: "POST",
    headers: {
      "X-API-Key": RAG_KEY,
      "X-Observability-Route": "script/ingest-source-master-pdfs",
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
    source_id: item.source_id,
    docId: item.metadata.docId,
    status: "ingested",
    inserted: data?.inserted ?? null,
    fileName: data?.fileName || fileNameFromItem(item)
  };
}

function filterRecords(records, args) {
  const sourceIdSet = new Set(args.sourceIds);
  return records.filter(record => {
    if (args.priority !== "all" && String(record.ingest_priority || "").toLowerCase() !== args.priority) return false;
    if (sourceIdSet.size && !sourceIdSet.has(record.source_id)) return false;
    return true;
  });
}

async function writeMetadataFiles(dir, items) {
  if (!dir) return [];
  const outDir = path.resolve(dir);
  await fs.mkdir(outDir, { recursive: true });
  const written = [];
  for (const item of items) {
    const filePath = path.join(outDir, `${item.metadata.docId}.json`);
    await writeJson(filePath, item.metadata);
    written.push(path.relative(process.cwd(), filePath));
  }
  return written;
}

function summarizePlanItem(item) {
  return {
    source_id: item.source_id,
    docId: item.metadata.docId,
    title: item.title,
    url: item.url,
    ingest_priority: item.ingest_priority,
    collection_id: item.metadata.collection_id,
    source_type: item.metadata.source_type,
    evidence_role: item.metadata.evidence_role,
    section_index_count: item.metadata.sectionIndex?.length || 0,
    section_index_method: item.metadata.pdf_section_analysis?.method || null,
    section_index_confidence: item.metadata.pdf_section_analysis?.confidence || null,
    section_index_warnings: item.metadata.pdf_section_analysis?.warnings || [],
    validation: item.validation
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.ingest && !RAG_KEY) throw new Error("RAG_SERVICE_API_KEY is required when --ingest is used.");

  const masterPath = path.resolve(args.master);
  const records = filterRecords(await loadSourceMasterRecords(masterPath), args);
  const plan = buildSourceMasterPdfPlan(records, {
    checkedAt: new Date().toISOString().slice(0, 10),
    sourceMasterFile: path.relative(process.cwd(), masterPath),
    limit: args.limit
  });
  if (args.analyzePdf && !args.ingest) {
    await analyzePlanItems(args, plan.items);
    plan.ok = plan.items.every(item => item.validation.ok);
    plan.invalid_count = plan.items.filter(item => !item.validation.ok).length;
    plan.warning_count = plan.items.filter(item => item.validation.warnings.length).length;
  }
  const metadataFiles = await writeMetadataFiles(args.metadataDir, plan.items);
  const sectionAnalysisSummary = summarizeSectionAnalysis(plan.items);

  const result = {
    ok: plan.ok,
    mode: args.ingest ? "ingest" : "dry-run",
    pdf_section_analysis: {
      enabled: Boolean(args.analyzePdf),
      require_section_index: Boolean(args.requireSectionIndex),
      summary: sectionAnalysisSummary
    },
    master: path.relative(process.cwd(), masterPath),
    baseUrl: args.ingest ? args.baseUrl : null,
    source_count: plan.source_count,
    pdf_candidate_count: plan.pdf_candidate_count,
    planned_count: plan.planned_count,
    by_priority: plan.by_priority,
    by_collection: plan.by_collection,
    invalid_count: plan.invalid_count,
    warning_count: plan.warning_count,
    metadata_files_written: metadataFiles.length,
    metadata_files: metadataFiles.slice(0, 20),
    items: plan.items.map(summarizePlanItem),
    ingest_results: []
  };

  if (args.ingest) {
    for (const item of plan.items) {
      try {
        const ingestResult = await ingestItem(args, item);
        result.ingest_results.push(ingestResult);
      } catch (error) {
        result.ok = false;
        result.ingest_results.push({
          source_id: item.source_id,
          docId: item.metadata.docId,
          status: "error",
          error: error?.message || String(error)
        });
      }
    }
    result.pdf_section_analysis.summary = summarizeSectionAnalysis(plan.items);
    result.warning_count = plan.items.filter(item => item.validation.warnings.length).length;
    result.invalid_count = plan.items.filter(item => !item.validation.ok).length;
    result.ok = result.ok && result.ingest_results.every(item => item.status !== "error" && item.status !== "invalid_metadata");
    result.items = plan.items.map(summarizePlanItem);
  }

  if (args.json) await writeJson(args.json, result);
  console.log(JSON.stringify({
    ok: result.ok,
    mode: result.mode,
    master: result.master,
    pdf_candidate_count: result.pdf_candidate_count,
    planned_count: result.planned_count,
    by_priority: result.by_priority,
    by_collection: result.by_collection,
    invalid_count: result.invalid_count,
    warning_count: result.warning_count,
    pdf_section_analysis: result.pdf_section_analysis,
    metadata_files_written: result.metadata_files_written,
    ingest_summary: result.ingest_results.reduce((acc, item) => {
      const key = item.status || "unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
    output: args.json || null
  }, null, 2));

  if (!result.ok) process.exitCode = 1;
}

main().catch(error => {
  console.error(`[knowledge:source-master] ${error?.message || String(error)}`);
  process.exitCode = 1;
});
