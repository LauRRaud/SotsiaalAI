#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import {
  assertRagSourceMetadataContract,
  inferKovItemRagSourceType,
  mapKovItemStatusToRagSourceStatus
} from "../lib/rag/sourceMetadata.js";
import { syncKovWebCliIngest } from "./lib/kov-admin-sync.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const RAW_RAG_HOST = String(process.env.RAG_INTERNAL_HOST || process.env.RAG_API_BASE || "127.0.0.1:8000").trim();
const RAG_KEY = String(process.env.RAG_SERVICE_API_KEY || "").trim();

function usage() {
  console.log(`
Usage:
  node scripts/ingest-kov-rag.mjs <dir|base-path|file> [--slug <slug>] [--skip-validate] [--bundle-only] [--doc-id <doc-id>] [--dry-run]
  node scripts/ingest-kov-rag.mjs <dir|base-path|file> --replace-existing --confirm-cleanup

Examples:
  node scripts/ingest-kov-rag.mjs output/parnu-linn
  npm run rag:ingest:kov -- output --slug parnu-linn
`.trim());
}

function normalizeBaseFromHost(host) {
  const trimmed = String(host || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "http://127.0.0.1:8000";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function _slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function deriveAudienceStorage(audience) {
  const values = Array.isArray(audience) ? audience : [];
  const cleaned = [...new Set(values.map((value) => String(value || "").trim().toUpperCase()).filter(Boolean))];
  if (cleaned.length === 1) return cleaned[0];
  return "BOTH";
}

function formatList(lines, emptyValue = "Puudub.") {
  const cleaned = Array.isArray(lines)
    ? lines.map((line) => String(line || "").trim()).filter(Boolean)
    : typeof lines === "string" && lines.trim()
      ? [lines.trim()]
      : [];
  if (!cleaned.length) return emptyValue;
  return cleaned.map((line) => `- ${line}`).join("\n");
}

function formatInline(value, emptyValue = "Puudub.") {
  if (Array.isArray(value)) {
    const cleaned = value.map((entry) => String(entry || "").trim()).filter(Boolean);
    return cleaned.length ? cleaned.join("; ") : emptyValue;
  }
  const text = String(value ?? "").trim();
  return text || emptyValue;
}

function formatForms(forms) {
  const cleaned = Array.isArray(forms) ? forms.filter((entry) => isObject(entry)) : [];
  if (!cleaned.length) return "Puudub.";
  return cleaned
    .map((entry) => {
      const title = String(entry.title || "").trim() || "Vorm";
      const format = String(entry.format || "").trim();
      const url = String(entry.url || "").trim();
      return `- ${title}${format ? ` (${format})` : ""}${url ? `: ${url}` : ""}`;
    })
    .join("\n");
}

function formatContacts(contacts) {
  const cleaned = Array.isArray(contacts) ? contacts.filter((entry) => isObject(entry)) : [];
  if (!cleaned.length) return "Puudub.";
  return cleaned
    .map((entry) => {
      const parts = [
        String(entry.name || "").trim(),
        String(entry.role || "").trim(),
        String(entry.phone || "").trim(),
        String(entry.email || "").trim(),
        String(entry.url || "").trim()
      ].filter(Boolean);
      return parts.length ? `- ${parts.join(" | ")}` : null;
    })
    .filter(Boolean)
    .join("\n") || "Puudub.";
}

function formatLegalBasis(entries) {
  const cleaned = Array.isArray(entries) ? entries.filter((entry) => isObject(entry)) : [];
  if (!cleaned.length) return "Puudub.";
  return cleaned
    .map((entry) => {
      const parts = [
        String(entry.title || "").trim(),
        String(entry.citation || "").trim(),
        String(entry.url || "").trim()
      ].filter(Boolean);
      return parts.length ? `- ${parts.join(" | ")}` : null;
    })
    .filter(Boolean)
    .join("\n") || "Puudub.";
}

function countItems(value) {
  return Array.isArray(value) ? value.length : 0;
}

function hasObjectText(value, fields) {
  if (!value || !isObject(value)) return false;
  return fields.some((field) => {
    const fieldValue = value[field];
    if (Array.isArray(fieldValue)) return fieldValue.length > 0;
    return String(fieldValue || "").trim().length > 0;
  });
}

function deriveSectionsPresent(item = {}) {
  const sections = [];
  if (item.summary || item.description) sections.push("description");
  if (item.conditions || item.targetGroup) sections.push("eligibility");
  if (
    hasObjectText(item.application, ["channels", "steps", "deadline", "decisionTime", "notes"]) ||
    countItems(item.submissionChannels) > 0 ||
    item.deadline ||
    item.decisionTime
  ) {
    sections.push("application");
  }
  if (countItems(item.forms) > 0 || countItems(item.relatedForms) > 0) sections.push("forms");
  if (
    countItems(item.contacts) > 0 ||
    countItems(item.relatedContacts) > 0 ||
    item.phone ||
    item.email ||
    item.address
  ) {
    sections.push("contacts");
  }
  if (countItems(item.legalBasis) > 0) sections.push("legal_basis");
  return sections;
}

function _buildItemText(item, sourceMap) {
  const sourceLines = (Array.isArray(item.sourceKeys) ? item.sourceKeys : [])
    .map((key) => {
      const source = sourceMap.get(key);
      if (!source) return `- ${key}`;
      return `- ${key}: ${source.title || key}${source.url ? ` | ${source.url}` : ""}`;
    })
    .join("\n") || "Puudub.";
  const provider = item.provider && isObject(item.provider)
    ? [item.provider.name, item.provider.type, item.provider.unit, item.provider.url].filter(Boolean).join(" | ")
    : "Puudub.";
  const pricing = item.pricingOrAmount && isObject(item.pricingOrAmount)
    ? [
        item.pricingOrAmount.type,
        item.pricingOrAmount.value != null ? String(item.pricingOrAmount.value) : "",
        item.pricingOrAmount.currency,
        item.pricingOrAmount.note
      ].filter(Boolean).join(" | ") || "Puudub."
    : "Puudub.";

  return [
    `# ${item.title}`,
    "",
    `Liik: ${item.itemType}`,
    `Staatus: ${item.status}`,
    `Sihtrühm: ${formatList(item.targetGroup, "Puudub.").replace(/^- /, "")}`,
    `Auditoorium: ${(Array.isArray(item.audience) ? item.audience : []).join(", ") || "Puudub."}`,
    `Kokkuvõte: ${item.summary || "Puudub."}`,
    item.resourceType ? `Ressursi tüüp: ${item.resourceType}` : null,
    "",
    "Taotlemine:",
    formatList(item.application?.channels, "Puudub."),
    Array.isArray(item.application?.steps) && item.application.steps.length ? "Sammud:" : null,
    Array.isArray(item.application?.steps) && item.application.steps.length ? formatList(item.application.steps) : null,
    item.application?.deadline ? `Tähtaeg: ${item.application.deadline}` : null,
    item.application?.decisionTime ? `Otsuse aeg: ${item.application.decisionTime}` : null,
    item.application?.notes ? `Märkused: ${item.application.notes}` : null,
    "",
    "Vormid:",
    formatForms(item.forms),
    "",
    `Haldaja / teenuseosutaja: ${provider}`,
    "",
    "Kontaktid:",
    formatContacts(item.contacts),
    "",
    `Tasulisus või summa: ${pricing}`,
    "",
    "Õiguslik alus:",
    formatLegalBasis(item.legalBasis),
    "",
    "Allikad:",
    sourceLines
  ].filter(Boolean).join("\n");
}

function formatApplication(application) {
  if (application && isObject(application)) {
    return [
      "Kanalid:",
      formatList(application.channels, "Puudub."),
      Array.isArray(application.steps) && application.steps.length ? "Sammud:" : null,
      Array.isArray(application.steps) && application.steps.length ? formatList(application.steps) : null,
      application.deadline ? `Tähtaeg: ${application.deadline}` : null,
      application.decisionTime ? `Otsuse aeg: ${application.decisionTime}` : null,
      application.notes ? `Märkused: ${application.notes}` : null
    ].filter(Boolean).join("\n");
  }
  return formatInline(application);
}

function buildFlexibleItemText(item, sourceMap) {
  const sourceLines = (Array.isArray(item.sourceKeys) ? item.sourceKeys : [])
    .map((key) => {
      const source = sourceMap.get(key);
      if (!source) return `- ${key}`;
      return `- ${key}: ${source.title || key}${source.url ? ` | ${source.url}` : ""}`;
    })
    .join("\n") || "Puudub.";
  const provider = item.provider && isObject(item.provider)
    ? [item.provider.name, item.provider.type, item.provider.unit, item.provider.url].filter(Boolean).join(" | ")
    : "Puudub.";
  const pricing = item.pricingOrAmount && isObject(item.pricingOrAmount)
    ? [
        item.pricingOrAmount.type,
        item.pricingOrAmount.value != null ? String(item.pricingOrAmount.value) : "",
        item.pricingOrAmount.currency,
        item.pricingOrAmount.note
      ].filter(Boolean).join(" | ") || "Puudub."
    : formatInline(item.amount);

  return [
    `# ${item.title}`,
    "",
    `Liik: ${item.itemType}`,
    `Staatus: ${item.status}`,
    item.name ? `Nimi: ${item.name}` : null,
    item.role ? `Roll: ${item.role}` : null,
    item.department ? `Osakond: ${item.department}` : null,
    item.phone ? `Telefon: ${item.phone}` : null,
    item.email ? `E-post: ${item.email}` : null,
    item.address ? `Aadress: ${item.address}` : null,
    item.format ? `Failivorming: ${item.format}` : null,
    item.officialUrl ? `Ametlik link: ${item.officialUrl}` : null,
    `Sihtrühm: ${formatInline(item.targetGroup)}`,
    `Auditoorium: ${(Array.isArray(item.audience) ? item.audience : []).join(", ") || "Puudub."}`,
    `Kokkuvõte: ${item.summary || "Puudub."}`,
    item.resourceType ? `Ressursi tüüp: ${item.resourceType}` : null,
    item.conditions ? `Tingimused: ${item.conditions}` : null,
    item.decisionTime ? `Otsuse aeg: ${item.decisionTime}` : null,
    item.deadline ? `Tähtaeg: ${item.deadline}` : null,
    "",
    "Taotlemine:",
    formatApplication(item.application),
    Array.isArray(item.submissionChannels) && item.submissionChannels.length ? "Esitamise kanalid:" : null,
    Array.isArray(item.submissionChannels) && item.submissionChannels.length ? formatList(item.submissionChannels) : null,
    "",
    "Vormid:",
    formatForms(item.forms),
    Array.isArray(item.relatedForms) && item.relatedForms.length ? "Seotud vormid:" : null,
    Array.isArray(item.relatedForms) && item.relatedForms.length ? formatList(item.relatedForms) : null,
    "",
    `Haldaja / teenuseosutaja: ${provider}`,
    "",
    "Kontaktid:",
    formatContacts(item.contacts),
    Array.isArray(item.relatedContacts) && item.relatedContacts.length ? "Seotud kontaktid:" : null,
    Array.isArray(item.relatedContacts) && item.relatedContacts.length ? formatList(item.relatedContacts) : null,
    Array.isArray(item.relatedTo) && item.relatedTo.length ? "Seotud kirjed:" : null,
    Array.isArray(item.relatedTo) && item.relatedTo.length ? formatList(item.relatedTo) : null,
    "",
    `Tasulisus või summa: ${pricing}`,
    "",
    "Õiguslik alus:",
    formatLegalBasis(item.legalBasis),
    "",
    "Allikad:",
    sourceLines
  ].filter(Boolean).join("\n");
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function resolveDatasetPaths(inputArg, slugArg) {
  const input = path.isAbsolute(inputArg) ? inputArg : path.resolve(rootDir, inputArg);
  let stats = null;
  try {
    stats = await fs.stat(input);
  } catch {
    stats = null;
  }

  let dirPath = input;
  let slug = slugArg || "";
  if (stats?.isDirectory()) {
    dirPath = input;
    if (!slug) {
      const names = await fs.readdir(dirPath);
      const candidates = names.filter((name) => name.endsWith(".sources.json")).map((name) => name.slice(0, -13));
      if (candidates.length !== 1) throw new Error("Pass --slug when directory contains zero or multiple datasets");
      slug = candidates[0];
    }
  } else if (stats?.isFile()) {
    dirPath = path.dirname(input);
    const fileName = path.basename(input);
    if (!slug) {
      if (fileName.endsWith(".sources.json")) slug = fileName.slice(0, -13);
      else if (fileName.endsWith(".meta.json")) slug = fileName.slice(0, -10);
      else if (fileName.endsWith(".rag.md")) slug = fileName.slice(0, -7);
      else if (fileName.endsWith(".json")) slug = fileName.slice(0, -5);
      else throw new Error(`Cannot derive slug from ${fileName}`);
    }
  } else {
    dirPath = path.dirname(input);
    slug = slug || path.basename(input);
  }

  return {
    dirPath,
    slug,
    sourcesPath: path.join(dirPath, `${slug}.sources.json`),
    datasetPath: path.join(dirPath, `${slug}.json`),
    metaPath: path.join(dirPath, `${slug}.meta.json`),
    ragPath: path.join(dirPath, `${slug}.rag.md`)
  };
}

function parseArgs(argv) {
  let slug = "";
  let docId = "";
  let skipValidate = false;
  let bundleOnly = false;
  let dryRun = false;
  let replaceExisting = false;
  let confirmCleanup = false;
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index] || "");
    if (!arg) continue;
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    if (arg === "--slug") {
      slug = String(argv[index + 1] || "").trim();
      index += 1;
      continue;
    }
    if (arg === "--doc-id") {
      docId = String(argv[index + 1] || "").trim();
      index += 1;
      continue;
    }
    if (arg === "--skip-validate") {
      skipValidate = true;
      continue;
    }
    if (arg === "--bundle-only") {
      bundleOnly = true;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--replace-existing" || arg === "--replace-existing-web") {
      replaceExisting = true;
      continue;
    }
    if (arg === "--confirm-cleanup") {
      confirmCleanup = true;
      continue;
    }
    positional.push(arg);
  }

  if (!positional.length) {
    usage();
    process.exit(1);
  }

  return {
    input: positional[0],
    slug,
    docId,
    skipValidate,
    bundleOnly,
    dryRun,
    replaceExisting,
    confirmCleanup
  };
}

function runScopedWebCleanup({ canonicalSlug, dryRun, confirmCleanup }) {
  if (!dryRun && !confirmCleanup) {
    throw new Error("Refusing replace cleanup without --confirm-cleanup");
  }
  const cleanupSlug = String(canonicalSlug || "").trim().toLowerCase().replace(/_/g, "-");
  const cleanupArgs = [
    path.join(rootDir, "scripts", "cleanup-kov-rag-state.mjs"),
    "--municipality",
    _slugify(canonicalSlug),
    "--slug",
    cleanupSlug,
    "--layer",
    "web",
    dryRun ? "--dry-run" : "--write"
  ];
  if (!dryRun && confirmCleanup) cleanupArgs.push("--confirm-cleanup");
  const child = spawnSync(process.execPath, cleanupArgs, {
    cwd: rootDir,
    env: process.env,
    stdio: "inherit"
  });
  if (child.status !== 0) {
    throw new Error(`Scoped KOV web cleanup failed with status ${child.status}`);
  }
}

async function ingestText(baseUrl, payload) {
  const response = await fetch(`${baseUrl}/ingest/text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": RAG_KEY,
      "X-Observability-Route": "script/ingest-kov-rag",
      "X-Observability-Stage": "rag_ingest"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.detail || data?.message || `RAG ingest failed with HTTP ${response.status}`);
  }
  return data;
}

function resolveCanonicalKovSlug(paths, meta) {
  return String(meta?.id || paths.slug || "")
    .trim()
    .toLowerCase()
    .replace(/-final$/, "");
}

function sourceKeyOf(source = {}) {
  return String(source.key || source.source_key || source.source_id || source.document_id || "").trim();
}

function sourceUrlOf(source = {}) {
  return String(source.url || source.url_canonical || source.normalized_url || "").trim();
}

function legacySourceTypeFor(source = {}) {
  const sourceType = String(source.source_type || source.type || "").trim();
  const resourceType = String(source.resource_type || "").trim();
  if (source.type) return source.type;
  if (sourceType === "kov_regulation") return "RT";
  if (["application_form", "web_form", "pdf_form", "doc_form"].includes(sourceType) || resourceType === "form") return "FORMS";
  if (["official_contact", "contact_page", "contact"].includes(sourceType) || resourceType === "contact") return "CONTACT";
  if (sourceType === "kov_service_info" || resourceType === "service_page") return "DETAIL";
  return "OTHER";
}

function normalizeSourcesForIngest(sources = {}) {
  const normalizedSources = Array.isArray(sources.sources)
    ? sources.sources.map((source) => ({
        ...source,
        key: sourceKeyOf(source),
        type: legacySourceTypeFor(source),
        url: sourceUrlOf(source) || source.url || null
      }))
    : [];
  return {
    ...sources,
    sources: normalizedSources
  };
}

function normalizeItemForIngest(item = {}) {
  const itemType = item.itemType || item.item_type || "resource";
  const resourceType = item.resourceType || item.resource_type || null;
  const sourceKeys = Array.isArray(item.sourceKeys)
    ? item.sourceKeys
    : Array.isArray(item.source_keys)
      ? item.source_keys
      : [];
  return {
    ...item,
    itemType,
    item_type: item.item_type || itemType,
    resourceType,
    sourceKeys,
    source_keys: Array.isArray(item.source_keys) ? item.source_keys : sourceKeys
  };
}

function normalizeDatasetForIngest(dataset = {}) {
  return {
    ...dataset,
    items: Array.isArray(dataset.items) ? dataset.items.map(normalizeItemForIngest) : []
  };
}

async function runInputValidation(paths) {
  const [sources, dataset, meta] = await Promise.all([
    readJson(paths.sourcesPath).catch(() => ({})),
    readJson(paths.datasetPath).catch(() => ({})),
    readJson(paths.metaPath).catch(() => ({}))
  ]);
  const schemaText = [
    sources.schemaVersion,
    dataset.schemaVersion,
    meta.schemaVersion,
    meta.sourcePackageReadiness ? "sourcePackageReadiness" : ""
  ].filter(Boolean).join(" ");
  const isSourcePackageMetadata = /v2\.5|sourcepackage|sourcePackageReadiness/i.test(schemaText);
  const validationArgs = isSourcePackageMetadata
    ? [path.join(rootDir, "scripts", "validate-kov-metadata.mjs"), "--root", path.dirname(paths.dirPath), "--slug", paths.slug]
    : [path.join(rootDir, "scripts", "validate-kov-rag.mjs"), paths.dirPath, "--slug", paths.slug];
  const validation = spawnSync(process.execPath, validationArgs, {
    stdio: "inherit"
  });
  if (validation.status !== 0) {
    process.exit(validation.status ?? 1);
  }
}

function deriveSourceUrlsForItem(item, sourceMap) {
  if (Array.isArray(item.sourceUrls) && item.sourceUrls.length) {
    return item.sourceUrls;
  }
  return [...new Set((Array.isArray(item.sourceKeys) ? item.sourceKeys : [])
    .map((key) => sourceMap.get(key)?.url)
    .filter(Boolean))];
}

function buildKovSourceId(canonicalSlug, suffix) {
  return `kov_${_slugify(canonicalSlug)}_${_slugify(suffix)}`;
}

function buildCanonicalItemId(canonicalSlug, item) {
  if (!item?.id) return null;
  return `${_slugify(canonicalSlug)}_${String(item.itemType || "item").trim().toLowerCase()}_${_slugify(item.id)}`;
}

function sectionForItemType(itemType) {
  if (itemType === "service") return "Teenused";
  if (itemType === "benefit") return "Toetused";
  if (itemType === "resource") return "Ressursid";
  if (itemType === "contact") return "Kontaktid";
  if (itemType === "form") return "Blanketid ja taotlused";
  return "KOV";
}

function deriveItemTitle(item) {
  return String(
    item?.title
    || item?.name
    || item?.label
    || item?.heading
    || item?.id
    || "KOV item"
  ).trim();
}

function assertIngestMetadata(metadata, label, options = {}) {
  assertRagSourceMetadataContract(metadata, {
    label,
    requireMunicipality: true,
    requireDocumentId: true,
    requireTitle: true,
    requireAudience: true,
    requireCanonicalItemId: options.requireCanonicalItemId === true
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const baseUrl = normalizeBaseFromHost(RAW_RAG_HOST);
  const paths = await resolveDatasetPaths(args.input, args.slug);

  if (!args.skipValidate) {
    await runInputValidation(paths);
  }

  const [rawSources, rawDataset, meta, ragText] = await Promise.all([
    readJson(paths.sourcesPath),
    readJson(paths.datasetPath),
    readJson(paths.metaPath),
    fs.readFile(paths.ragPath, "utf8")
  ]);

  const sources = normalizeSourcesForIngest(rawSources);
  const dataset = normalizeDatasetForIngest(rawDataset);
  const sourceMap = new Map((sources.sources || []).map((entry) => [entry.key, entry]).filter(([key]) => key));
  const unionAudience = [...new Set((dataset.items || []).flatMap((item) => Array.isArray(item.audience) ? item.audience : []))];
  const canonicalSlug = resolveCanonicalKovSlug(paths, meta);
  const bundleDocId = args.docId || `kov::${canonicalSlug}::bundle`;
  const nowIso = new Date().toISOString();

  if (args.replaceExisting) {
    if (!args.dryRun && !args.confirmCleanup) {
      throw new Error("Refusing --replace-existing without --confirm-cleanup.");
    }
    runScopedWebCleanup({
      canonicalSlug,
      dryRun: args.dryRun,
      confirmCleanup: args.confirmCleanup
    });
  }

  if (args.dryRun) {
    console.log(`[rag:ingest:kov] Dry run OK: ${paths.slug}`);
    if (canonicalSlug !== paths.slug) console.log(`  - canonical slug: ${canonicalSlug}`);
    console.log(`  - bundle doc: ${bundleDocId}`);
    console.log(`  - item docs: ${args.bundleOnly ? 0 : (dataset.items || []).length}`);
    console.log(`  - source count: ${Array.isArray(sources.sources) ? sources.sources.length : 0}`);
    console.log(`  - rag chars: ${String(ragText || "").length}`);
    return;
  }

  if (!RAG_KEY) throw new Error("RAG_SERVICE_API_KEY is missing");

  const bundleMetadata = {
    title: meta.title || `${meta.municipality} sotsiaalteenused ja toetused`,
    description: `${meta.municipality} sotsiaalteenused, sotsiaaltoetused ja ressursid`,
    audience: deriveAudienceStorage(unionAudience),
    audiences: unionAudience,
    tags: meta.tags || [],
    language: meta.language || "et",
    collection_id: meta.collection_id || "kov_services",
    resource_type: "municipality_service_package",
    country: meta.country || "EE",
    county: meta.county,
    jurisdiction_level: meta.jurisdiction_level || "MUNICIPALITY",
    municipality_name: meta.municipality_name || meta.municipality,
    district_name: meta.district_name ?? null,
    checked_at: meta.checkedAt,
    item_type: "bundle",
    content_status: "active",
    source_keys: (sources.sources || []).map((entry) => entry.key),
    source_urls: (sources.sources || []).map((entry) => entry.url),
    source_register_file: path.basename(paths.sourcesPath),
    source_count: Array.isArray(sources.sources) ? sources.sources.length : 0,
    source_id: buildKovSourceId(canonicalSlug, "bundle"),
    docId: bundleDocId,
    document_id: bundleDocId,
    source_type: "kov_service_info",
    source_origin_type: "file",
    source_format: "markdown",
    legacy_source_type: "kov_dataset_bundle",
    authority: "KOV",
    municipality: meta.municipality,
    municipality_id: _slugify(canonicalSlug),
    last_checked: meta.checkedAt,
    retrieved_at: nowIso,
    legal_basis: false,
    historical: false,
    source_status: "active",
    canonical_item_id: null,
    source_path: paths.ragPath,
    source_url: sources.indexUrl || (sources.sources || []).find((entry) => entry?.url)?.url || null,
    url_canonical: sources.indexUrl || (sources.sources || []).find((entry) => entry?.url)?.url || null,
    fileName: path.basename(paths.ragPath),
    mimeType: "text/markdown"
  };
  assertIngestMetadata(bundleMetadata, "kov.bundle.metadata");

  const bundleResult = await ingestText(baseUrl, {
    doc_id: bundleDocId,
    text: ragText,
    metadata: bundleMetadata
  });

  let itemCount = 0;
  let chunkCount = Number(bundleResult?.inserted || 0);
  if (!args.bundleOnly) {
    for (const item of dataset.items || []) {
      const itemText = buildFlexibleItemText(item, sourceMap);
      const itemDocId = `kov::${canonicalSlug}::item::${item.id}`;
      const itemSourceUrls = deriveSourceUrlsForItem(item, sourceMap);
      const itemSourceType = inferKovItemRagSourceType(item.itemType, item.resourceType);
      const itemTitle = deriveItemTitle(item);
      const itemMetadata = {
        title: itemTitle,
        description: item.summary || item.role || item.description || itemTitle,
        section: sectionForItemType(item.itemType),
        audience: deriveAudienceStorage(item.audience),
        audiences: Array.isArray(item.audience) ? item.audience : [],
        tags: [...new Set([...(meta.tags || []), item.itemType, item.resourceType].filter(Boolean))],
        language: meta.language || "et",
        collection_id: meta.collection_id || "kov_services",
        country: meta.country || "EE",
        county: meta.county,
        jurisdiction_level: meta.jurisdiction_level || "MUNICIPALITY",
        municipality_name: meta.municipality_name || meta.municipality,
        district_name: meta.district_name ?? null,
        checked_at: dataset.checkedAt,
        item_type: item.itemType,
        content_status: item.status,
        resource_type: item.resourceType,
        source_keys: item.sourceKeys || [],
        source_urls: itemSourceUrls,
        source_register_file: path.basename(paths.sourcesPath),
        source_count: Array.isArray(sources.sources) ? sources.sources.length : 0,
        administering_body: item.provider && isObject(item.provider) ? item.provider.name || null : null,
        source_id: buildKovSourceId(canonicalSlug, `item_${item.id}`),
        document_id: itemDocId,
        source_type: itemSourceType,
        legacy_source_type: "kov_dataset_item",
        authority: "KOV",
        municipality: meta.municipality,
        municipality_id: _slugify(canonicalSlug),
        last_checked: dataset.checkedAt,
        retrieved_at: nowIso,
        historical: item.status === "ended" || item.status === "inactive",
        source_status: mapKovItemStatusToRagSourceStatus(item.status),
        canonical_item_id: buildCanonicalItemId(canonicalSlug, item),
        sections_present: deriveSectionsPresent(item),
        forms_count: countItems(item.forms),
        related_forms_count: countItems(item.relatedForms),
        contacts_count: countItems(item.contacts),
        related_contacts_count: countItems(item.relatedContacts),
        legal_basis_count: countItems(item.legalBasis),
        source_url: itemSourceUrls[0] || sources.indexUrl || null,
        url_canonical: itemSourceUrls[0] || sources.indexUrl || null,
        mimeType: "text/markdown"
      };
      assertIngestMetadata(itemMetadata, `kov.item.${item.id}.metadata`, { requireCanonicalItemId: true });

      const result = await ingestText(baseUrl, {
        doc_id: itemDocId,
        text: itemText,
        metadata: itemMetadata
      });
      itemCount += 1;
      chunkCount += Number(result?.inserted || 0);
    }
  }

  const adminSync = await syncKovWebCliIngest({
    municipalitySlug: canonicalSlug,
    municipalityName: meta.municipality_name || meta.municipality,
    county: meta.county,
    checkedAt: meta.checkedAt || dataset.checkedAt || nowIso,
    officialWebsite: sources.indexUrl || (sources.sources || []).find((entry) => entry?.url)?.url || "",
    ragDocId: bundleDocId
  });

  console.log(`[rag:ingest:kov] OK: ${paths.slug}`);
  if (canonicalSlug !== paths.slug) console.log(`  - canonical slug: ${canonicalSlug}`);
  console.log(`  - bundle doc: ${bundleDocId}`);
  console.log(`  - item docs: ${itemCount}`);
  console.log(`  - inserted chunks: ${chunkCount}`);
  console.log(
    adminSync?.synced
      ? `  - admin sync: ${adminSync.municipalitySlug} -> ${adminSync.ragDocId}`
      : `  - admin sync: skipped (${adminSync?.reason || "unknown reason"})`
  );
}

main().catch((error) => {
  console.error("[rag:ingest:kov] Failed:", error.message);
  process.exit(1);
});
