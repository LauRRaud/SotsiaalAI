#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadOrganizationPackageFromRoot,
  validateOrganizationPackageFromRoot
} from "./validate-organization-metadata.mjs";
import {
  buildOrganizationRagDocId,
  buildOrganizationRagPayloadPreview,
  normalizeOrganizationSourcesPayload,
  summarizeOrganizationDocuments
} from "../lib/admin/rag/organizations/package.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_ROOT = path.join(REPO_ROOT, "Andmebaasi", "organisatsioonid");
const RAW_RAG_HOST = String(process.env.RAG_INTERNAL_HOST || process.env.RAG_API_BASE || "127.0.0.1:8000").trim();
const RAG_KEY = String(process.env.RAG_SERVICE_API_KEY || process.env.RAG_API_KEY || "").trim();
const DEFAULT_TIMEOUT_MS = Math.max(
  30_000,
  Number.parseInt(String(process.env.RAG_INGEST_REQUEST_TIMEOUT_MS || "300000"), 10) || 300_000
);

function usage() {
  console.log(`
Usage:
  npm run organization:ingest:plan -- --root "Andmebaasi/organisatsioonid"
  npm run organization:ingest -- --root "Andmebaasi/organisatsioonid" --slug astangu --skip-existing

Options:
  --root <path>              Folder with <slug>.sources.json, <slug>.json, <slug>.meta.json, <slug>.rag.md.
                             Default: Andmebaasi/organisatsioonid
  --slug <slug>              Organization slug. Can be repeated. If omitted, inferred from *.meta.json files.
  --dry-run                  Validate and plan only. Default unless --ingest is passed.
  --ingest                   Send rag.md text with organization metadata to RAG /ingest/text.
  --skip-existing            Skip docId already present in RAG registry.
  --base-url <url>           RAG service URL. Default from env or http://127.0.0.1:8000
  --request-timeout-ms <n>   Default 300000.
  --json <path>              Write full result JSON.
  --help

Environment:
  RAG_SERVICE_API_KEY or RAG_API_KEY is required with --ingest.

Notes:
  This ingests only the organization profile RAG text package. Documents referenced inside
  organization JSON remain separate knowledge-doc ingest candidates.
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
    root: DEFAULT_ROOT,
    slugs: [],
    dryRun: true,
    ingest: false,
    skipExisting: false,
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
      args.root = String(argv[++index] || "").trim() || DEFAULT_ROOT;
    } else if (arg === "--slug") {
      const slug = String(argv[++index] || "").trim().toLowerCase();
      if (slug) args.slugs.push(slug);
    } else if (arg === "--dry-run") {
      args.dryRun = true;
      args.ingest = false;
    } else if (arg === "--ingest") {
      args.ingest = true;
      args.dryRun = false;
    } else if (arg === "--skip-existing") {
      args.skipExisting = true;
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
  if (!filePath) return;
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

async function inferSlugs(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  return entries
    .filter(entry => entry.isFile() && entry.name.endsWith(".meta.json"))
    .map(entry => entry.name.slice(0, -".meta.json".length).toLowerCase())
    .sort();
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

function clean(value, max = 1000) {
  const text = String(value || "").trim();
  return text ? text.slice(0, max) : null;
}

function stableUniqueStrings(values = []) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const normalized = clean(value, 1200);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function collectOrganizationItemCount(dataPayload = {}) {
  return [
    dataPayload.items,
    dataPayload.services,
    dataPayload.resources,
    dataPayload.contacts,
    dataPayload.documents
  ].reduce((sum, value) => sum + (Array.isArray(value) ? value.length : 0), 0);
}

function buildIngestMetadata(loaded) {
  const sources = normalizeOrganizationSourcesPayload(loaded.sourcesPayload);
  const preview = buildOrganizationRagPayloadPreview({
    slug: loaded.slug,
    metaPayload: loaded.metaPayload,
    sourcesPayload: sources,
    dataPayload: loaded.dataPayload
  });
  const sourceKeys = stableUniqueStrings(preview.sourceKeys);
  const sourceUrls = stableUniqueStrings(sources.map(source => source?.url || source?.source_url));
  const officialWebsite = clean(
    loaded.dataPayload?.officialWebsite ||
    loaded.metaPayload?.officialWebsite ||
    preview.officialUrl ||
    sourceUrls[0] ||
    null,
    1200
  );
  const notes = stableUniqueStrings([
    ...(Array.isArray(loaded.metaPayload?.notes) ? loaded.metaPayload.notes : [])
  ]);
  const unresolvedIssues = stableUniqueStrings(
    Array.isArray(loaded.metaPayload?.unresolvedIssues) ? loaded.metaPayload.unresolvedIssues : []
  );

  return {
    ...preview,
    doc_id: preview.docId,
    docId: preview.docId,
    title: preview.title || `${preview.organization_name || loaded.slug} teenused ja ressursid`,
    country: loaded.dataPayload?.country || loaded.metaPayload?.country || "EE",
    jurisdiction_level: loaded.dataPayload?.jurisdiction_level || loaded.metaPayload?.jurisdiction_level || "ORGANIZATION",
    organization_slug: preview.slug || loaded.slug,
    county: loaded.dataPayload?.county || loaded.metaPayload?.county || null,
    official_website: officialWebsite,
    officialWebsite,
    source_url: officialWebsite,
    sourceUrl: officialWebsite,
    url_canonical: officialWebsite,
    urlCanonical: officialWebsite,
    url: officialWebsite,
    contact_email: loaded.dataPayload?.contactEmail || loaded.metaPayload?.contactEmail || null,
    contact_phone: loaded.dataPayload?.contactPhone || loaded.metaPayload?.contactPhone || null,
    checked_at: preview.checked_at || loaded.metaPayload?.checkedAt || null,
    status: loaded.metaPayload?.status || loaded.dataPayload?.status || null,
    coverage: loaded.metaPayload?.coverage && typeof loaded.metaPayload.coverage === "object" ? loaded.metaPayload.coverage : null,
    notes,
    unresolved_issues: unresolvedIssues,
    source_urls: sourceUrls,
    source_keys: sourceKeys,
    sourceKeys,
    item_count: collectOrganizationItemCount(loaded.dataPayload),
    documents_summary: summarizeOrganizationDocuments(loaded.dataPayload),
    legal_basis: false
  };
}

async function loadItem(root, slug) {
  const [validation, loaded] = await Promise.all([
    validateOrganizationPackageFromRoot({ root, slug }),
    loadOrganizationPackageFromRoot({ root, slug })
  ]);
  return {
    slug,
    validation,
    ragText: String(loaded.ragText || "").trim(),
    metadata: buildIngestMetadata(loaded),
    files: loaded.fileNames
  };
}

function summarizeItem(item) {
  return {
    slug: item.slug,
    ok: item.validation.ok,
    ingest_ready: item.validation.ingest_ready,
    rag_doc_id: item.validation.rag_doc_id || item.metadata.docId || buildOrganizationRagDocId(item.slug),
    title: item.metadata.title,
    collection_id: item.metadata.collection_id,
    source_type: item.metadata.source_type,
    resource_type: item.metadata.resource_type,
    source_count: item.validation.sourceKeys?.length || 0,
    document_count: item.metadata.documents_summary?.total || 0,
    rag_text_chars: item.ragText.length,
    errors: item.validation.errors || [],
    warnings: item.validation.warnings || [],
    risks: item.validation.risks || []
  };
}

async function ingestItem(args, item) {
  if (!item.validation.ok) {
    return {
      slug: item.slug,
      docId: item.metadata.docId,
      status: "invalid_metadata",
      errors: item.validation.errors
    };
  }
  if (!item.ragText) {
    return {
      slug: item.slug,
      docId: item.metadata.docId,
      status: "invalid_metadata",
      errors: ["rag.md is empty"]
    };
  }
  if (args.skipExisting && await isDocumentExisting(args.baseUrl, item.metadata.docId, args.requestTimeoutMs)) {
    return {
      slug: item.slug,
      docId: item.metadata.docId,
      status: "skipped_existing"
    };
  }

  const response = await fetchWithTimeout(`${args.baseUrl}/ingest/text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": RAG_KEY,
      "X-Observability-Route": "script/ingest-organization-rag-folder",
      "X-Observability-Stage": "rag_ingest"
    },
    body: JSON.stringify({
      doc_id: item.metadata.docId,
      text: item.ragText,
      metadata: item.metadata
    })
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
    slug: item.slug,
    docId: item.metadata.docId,
    status: "ingested",
    inserted: data?.inserted ?? null
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(args.root || DEFAULT_ROOT);
  if (args.ingest && !RAG_KEY) throw new Error("RAG_SERVICE_API_KEY or RAG_API_KEY is required with --ingest.");

  const slugs = unique(args.slugs.length ? args.slugs : await inferSlugs(root));
  if (!slugs.length) throw new Error(`No organization *.meta.json files found in ${root}`);

  const items = [];
  for (const slug of slugs) {
    items.push(await loadItem(root, slug));
  }

  const result = {
    ok: items.every(item => item.validation.ok && item.ragText.length > 0),
    mode: args.ingest ? "ingest" : "dry-run",
    root,
    baseUrl: args.ingest ? args.baseUrl : null,
    total_packages: items.length,
    valid_count: items.filter(item => item.validation.ok && item.ragText.length > 0).length,
    invalid_count: items.filter(item => !item.validation.ok || item.ragText.length === 0).length,
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
          slug: item.slug,
          docId: item.metadata?.docId,
          status: "error",
          error: error?.message || String(error)
        });
      }
    }
    result.ok = result.ok && result.ingest_results.every(item => !["error", "invalid_metadata"].includes(item.status));
  }

  await writeJson(args.json, result);
  console.log(JSON.stringify({
    ok: result.ok,
    mode: result.mode,
    root: result.root,
    baseUrl: result.baseUrl,
    total_packages: result.total_packages,
    valid_count: result.valid_count,
    invalid_count: result.invalid_count,
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
  console.error(`[organization:ingest] ${error?.message || String(error)}`);
  process.exitCode = 1;
});
