#!/usr/bin/env node

import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { stableHash } from "./kovMetadataUpgradeLib.mjs";

const DEFAULT_BASE = "127.0.0.1:8000";
const PAGE_SIZE = 100;

function usage() {
  return [
    "Usage:",
    "  npm run rag:backfill:metadata                  (dry-run: plan only, no writes)",
    "  npm run rag:backfill:metadata -- --apply       (write planned patches via /documents/{id}/patch-meta)",
    "  npm run rag:backfill:metadata -- --limit 20    (cap planned patches, useful for a careful first apply)",
    "  npm run rag:backfill:metadata -- --json out.json",
    "",
    "Environment:",
    "  RAG_INTERNAL_HOST / RAG_API_BASE   RAG service host (default 127.0.0.1:8000)",
    "  RAG_SERVICE_API_KEY / RAG_API_KEY  X-API-Key for the RAG service",
    "",
    "Backfill rules (additive only; existing values are never overwritten):",
    "  R1 journal_article without collection_id      -> collection_id = sotsiaaltoo_articles",
    "  R2 kov_services document without content_hash -> content_hash = stableHash(identity fields)",
    "Report-only findings (no automatic writes): missing authority, source_status=unknown,",
    "missing last_checked, sotsiaaltoo_articles without url_canonical."
  ].join("\n");
}

function parseArgs(argv = []) {
  const args = {
    baseUrl: null,
    apiKey: process.env.RAG_SERVICE_API_KEY || process.env.RAG_API_KEY || "",
    apply: false,
    limit: 0,
    jsonPath: null,
    help: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--apply") args.apply = true;
    else if (arg === "--base-url") args.baseUrl = argv[++index] || null;
    else if (arg === "--api-key") args.apiKey = argv[++index] || "";
    else if (arg === "--limit") args.limit = Math.max(0, Number.parseInt(argv[++index] || "0", 10) || 0);
    else if (arg === "--json") args.jsonPath = argv[++index] || null;
    else if (arg === "--patch-file") args.patchFile = argv[++index] || null;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return args;
}

export function ragServiceBaseUrl(explicit = null) {
  const raw = explicit || process.env.RAG_INTERNAL_HOST || process.env.RAG_API_BASE || DEFAULT_BASE;
  const trimmed = String(raw).trim().replace(/\/+$/u, "");
  return /^https?:\/\//u.test(trimmed) ? trimmed : `http://${trimmed}`;
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function firstValue(...values) {
  for (const value of values) {
    if (hasValue(value)) return value;
  }
  return null;
}

export function planPatchesForDocument(doc = {}) {
  const sourceType = firstValue(doc.source_type, doc.sourceType);
  const collectionId = firstValue(doc.collection_id, doc.collectionId);
  const patch = {};
  const reasons = [];

  if (sourceType === "journal_article" && !collectionId) {
    patch.collection_id = "sotsiaaltoo_articles";
    reasons.push("article_missing_collection_id");
  }

  if (collectionId === "kov_services" && !hasValue(firstValue(doc.content_hash, doc.contentHash))) {
    patch.content_hash = stableHash({
      source_id: firstValue(doc.source_id, doc.sourceId, doc.docId, doc.id),
      title: firstValue(doc.title) || null,
      url: firstValue(doc.url_canonical, doc.urlCanonical, doc.url, doc.sourceUrl, doc.source_url) || null,
      source_type: sourceType || null,
      resource_type: firstValue(doc.resource_type, doc.resourceType) || null
    });
    reasons.push("kov_services_missing_content_hash");
  }

  if (reasons.length === 0) return null;
  return {
    docId: firstValue(doc.docId, doc.id),
    title: firstValue(doc.title, doc.fileName) || null,
    patch,
    reasons
  };
}

export function collectReportFindings(doc = {}) {
  const findings = [];
  const collectionId = firstValue(doc.collection_id, doc.collectionId);
  if (!hasValue(firstValue(doc.authority))) findings.push("missing_authority");
  if (String(firstValue(doc.source_status, doc.sourceStatus) || "").trim() === "unknown") findings.push("source_status_unknown");
  if (!hasValue(firstValue(doc.last_checked, doc.lastChecked, doc.checked_at, doc.checkedAt))) findings.push("missing_last_checked");
  if (collectionId === "sotsiaaltoo_articles" && !hasValue(firstValue(doc.url_canonical, doc.urlCanonical, doc.url, doc.sourceUrl))) {
    findings.push("sotsiaaltoo_article_missing_url");
  }
  return findings;
}

export function buildBackfillPlan(docs = []) {
  const patches = [];
  const reasonCounts = {};
  const reportCounts = {};
  const reportDocs = {};

  for (const doc of docs) {
    const planned = planPatchesForDocument(doc);
    if (planned) {
      patches.push(planned);
      for (const reason of planned.reasons) {
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      }
    }
    for (const finding of collectReportFindings(doc)) {
      reportCounts[finding] = (reportCounts[finding] || 0) + 1;
      reportDocs[finding] = reportDocs[finding] || [];
      if (reportDocs[finding].length < 50) {
        reportDocs[finding].push({
          docId: firstValue(doc.docId, doc.id),
          title: firstValue(doc.title, doc.fileName) || null
        });
      }
    }
  }

  return {
    total_documents: docs.length,
    planned_patches: patches.length,
    patch_reasons: reasonCounts,
    report_only: reportCounts,
    report_only_docs: reportDocs,
    patches
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
    docs.push(...(Array.isArray(page) ? page : []));
    if (!Array.isArray(page) || page.length < PAGE_SIZE) break;
  }
  return docs;
}

async function applyPatches(baseUrl, apiKey, patches, { logEvery = 100 } = {}) {
  const failures = [];
  let applied = 0;
  for (const item of patches) {
    const response = await fetch(`${baseUrl}/documents/${encodeURIComponent(item.docId)}/patch-meta`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify({ metadata: item.patch })
    });
    if (response.ok) {
      applied += 1;
    } else {
      const detail = await response.text().catch(() => "");
      failures.push({ docId: item.docId, http: response.status, detail: detail.slice(0, 200) });
    }
    if ((applied + failures.length) % logEvery === 0) {
      console.error(`[backfill] ${applied + failures.length}/${patches.length} (failures: ${failures.length})`);
    }
  }
  return { applied, failures };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.apiKey) {
    throw new Error("RAG_SERVICE_API_KEY or RAG_API_KEY is required");
  }

  const baseUrl = ragServiceBaseUrl(args.baseUrl);

  if (args.patchFile) {
    const raw = JSON.parse(await fs.readFile(args.patchFile, "utf8"));
    const patches = (Array.isArray(raw) ? raw : raw.patches || []).map(item => ({
      docId: item.docId,
      title: item.title || null,
      patch: item.patch,
      reasons: item.reasons || ["curated_patch_file"]
    }));
    const output = {
      ok: true,
      mode: args.apply ? "apply" : "dry-run",
      base_url: baseUrl,
      patch_file: args.patchFile,
      planned_patches: patches.length,
      sample_patches: patches.slice(0, 5)
    };
    if (args.apply && patches.length > 0) {
      console.error(`[backfill] applying ${patches.length} curated patches ...`);
      const { applied, failures } = await applyPatches(baseUrl, args.apiKey, patches, { logEvery: 10 });
      output.applied = applied;
      output.failures = failures;
      output.ok = failures.length === 0;
    }
    const serialized = JSON.stringify(output, null, 2);
    if (args.jsonPath) await fs.writeFile(args.jsonPath, serialized, "utf8");
    console.log(serialized);
    if (!output.ok) process.exitCode = 1;
    return;
  }

  console.error(`[backfill] fetching documents from ${baseUrl} ...`);
  const docs = await fetchAllDocuments(baseUrl, args.apiKey);
  const plan = buildBackfillPlan(docs);

  if (args.limit > 0 && plan.patches.length > args.limit) {
    plan.patches = plan.patches.slice(0, args.limit);
    plan.limited_to = args.limit;
  }

  const output = {
    ok: true,
    mode: args.apply ? "apply" : "dry-run",
    base_url: baseUrl,
    total_documents: plan.total_documents,
    planned_patches: plan.planned_patches,
    applied_in_this_run: args.apply ? plan.patches.length : 0,
    patch_reasons: plan.patch_reasons,
    report_only: plan.report_only,
    report_only_docs: plan.report_only_docs,
    sample_patches: plan.patches.slice(0, 10)
  };

  if (args.apply && plan.patches.length > 0) {
    console.error(`[backfill] applying ${plan.patches.length} patches ...`);
    const { applied, failures } = await applyPatches(baseUrl, args.apiKey, plan.patches);
    output.applied = applied;
    output.failures = failures;
    output.ok = failures.length === 0;
  }

  const serialized = JSON.stringify(output, null, 2);
  if (args.jsonPath) await fs.writeFile(args.jsonPath, serialized, "utf8");
  console.log(serialized);
  if (!output.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(JSON.stringify({ ok: false, error: error?.message || String(error) }));
    process.exitCode = 1;
  });
}
