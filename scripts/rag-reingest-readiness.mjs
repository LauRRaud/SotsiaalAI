#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import fg from "fast-glob";

import {
  buildRagMetadataBackfillPlan,
  planRagMetadataBackfillForSource,
  slugifyRagId
} from "../lib/rag/metadataBackfillPlan.js";
import {
  normalizeRagSourceMetadata,
  RAG_METADATA_REQUIRED_FOR_READINESS,
  RAG_METADATA_RECOMMENDED_FOR_READINESS
} from "../lib/rag/sourceMetadata.js";
import { normalizeSourceMetadataForFreshness } from "../lib/rag/sourceFreshness.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const HELP = `
Usage:
  node scripts/rag-reingest-readiness.mjs [--root <dir>] [--file <json>] [--collection <name>] [--json <path>] [--limit <n>] [--summary-only]

Examples:
  npm run rag:reingest:readiness -- --root KOV --json logs/rag-reingest-readiness.json
  npm run rag:reingest:readiness -- --file KOV/Jogeva/jogeva-vald/jogeva-vald.sources.json

Notes:
  - Dry-run only: does not write to RAG service, modify inputs, or touch storage.
  - blocked > 0 means the input set is not yet ready for a clean canonical reingest.
`.trim();

const LEGAL_SOURCE_TYPES = new Set(["national_law", "kov_regulation"]);
const KOV_SOURCE_TYPES = new Set([
  "kov_service_info",
  "kov_regulation",
  "application_form",
  "web_form",
  "pdf_form",
  "official_form",
  "official_contact",
  "contact_page",
  "partner_service_info",
  "faq"
]);
const ORGANIZATION_SOURCE_TYPES = new Set(["partner_service_info"]);
const TEMPLATE_SOURCE_TYPES = new Set(["template", "methodology_guide", "service_standard", "quality_guideline"]);

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function firstValue(...values) {
  for (const value of values) {
    if (Array.isArray(value)) {
      if (value.length > 0) return value;
      continue;
    }
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && !value.trim()) continue;
    return value;
  }
  return null;
}

function normalizeRel(filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, "/") || filePath;
}

function resolvePath(value) {
  return path.isAbsolute(value) ? value : path.resolve(rootDir, value);
}

function parseArgs(argv) {
  const args = {
    roots: [],
    files: [],
    collection: "",
    jsonPath: "",
    limit: 0,
    includeItems: true,
    summaryOnly: false,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index] || "");
    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }
    if (arg === "--root") {
      args.roots.push(String(argv[index + 1] || ""));
      index += 1;
      continue;
    }
    if (arg === "--file") {
      args.files.push(String(argv[index + 1] || ""));
      index += 1;
      continue;
    }
    if (arg === "--collection") {
      args.collection = String(argv[index + 1] || "").trim();
      index += 1;
      continue;
    }
    if (arg === "--json") {
      args.jsonPath = String(argv[index + 1] || "");
      index += 1;
      continue;
    }
    if (arg === "--limit") {
      args.limit = Number.parseInt(String(argv[index + 1] || "0"), 10) || 0;
      index += 1;
      continue;
    }
    if (arg === "--summary-only") {
      args.summaryOnly = true;
      continue;
    }
    if (arg === "--sources-only") {
      args.includeItems = false;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!args.roots.length && !args.files.length) args.roots.push("KOV");
  return args;
}

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function inferCollectionFamily(filePath, payload = {}, explicit = "") {
  if (explicit) return explicit;
  const normalized = normalizeRel(filePath).toLowerCase();
  const collection = String(payload.collection_id || payload.collectionId || "").trim().toLowerCase();
  if (collection === "national_regulations") return "national_rt";
  if (collection === "kov_regulations") return "kov_rt";
  if (collection === "kov_services") return "kov_web";
  if (collection === "sotsiaaltoo_articles") return "ajakiri_sotsiaaltoo";
  if (collection.includes("organization")) return "organizations";
  if (normalized.includes("ajakiri_sotsiaaltoo")) return "ajakiri_sotsiaaltoo";
  if (normalized.includes("national-rt") || normalized.includes("national_rt")) return "national_rt";
  if (normalized.includes(".rt.") || normalized.includes("/rt/") || normalized.includes("\\rt\\")) return "kov_rt";
  if (normalized.includes("organization") || normalized.includes("organisatsioon")) return "organizations";
  if (normalized.startsWith("kov/")) return "kov_web";
  return "unknown";
}

function inferSlug(filePath, payload = {}) {
  const fileName = path.basename(filePath);
  const fromFile = fileName
    .replace(/\.sources\.json$/i, "")
    .replace(/\.meta\.json$/i, "")
    .replace(/\.json$/i, "");
  return slugifyRagId(payload.id || payload.slug || payload.municipality_id || payload.municipality || fromFile);
}

function looksLikeSingleRecord(payload = {}) {
  return isObject(payload) && [
    "source_id",
    "sourceId",
    "canonical_source_id",
    "title",
    "source_type",
    "sourceType",
    "itemType",
    "officialUrl",
    "url"
  ].some(key => hasValue(payload[key]));
}

function extractRecordsFromPayload(payload, filePath, args) {
  const records = [];
  const collectionFamily = inferCollectionFamily(filePath, payload, args.collection);
  const slug = inferSlug(filePath, payload);
  const root = {
    ...payload,
    id: payload.id || slug
  };
  const commonContext = {
    root,
    slug,
    municipalityId: slug,
    collectionFamily,
    filePath: normalizeRel(filePath)
  };

  if (Array.isArray(payload.sources)) {
    payload.sources.forEach((source, index) => {
      if (!isObject(source)) return;
      records.push({
        source,
        index,
        context: {
          ...commonContext,
          recordKind: "source"
        }
      });
    });
  }

  if (args.includeItems && Array.isArray(payload.items)) {
    payload.items.forEach((source, index) => {
      if (!isObject(source)) return;
      records.push({
        source,
        index,
        context: {
          ...commonContext,
          recordKind: "item"
        }
      });
    });
  }

  if (!records.length && isObject(payload.metadata)) {
    records.push({
      source: payload.metadata,
      index: 0,
      context: {
        ...commonContext,
        recordKind: "metadata"
      }
    });
  }

  if (!records.length && looksLikeSingleRecord(payload)) {
    records.push({
      source: payload,
      index: 0,
      context: {
        ...commonContext,
        recordKind: "document"
      }
    });
  }

  return records;
}

async function discoverJsonFiles(args) {
  const explicitFiles = args.files.map(resolvePath);
  const discovered = [];

  for (const root of args.roots) {
    const absoluteRoot = resolvePath(root);
    const entries = await fg([
      "**/*.sources.json",
      "**/*.rt.sources.json",
      "**/national-rt.sources.json",
      "**/*.meta.json",
      "**/*.json"
    ], {
      cwd: absoluteRoot,
      absolute: true,
      onlyFiles: true,
      unique: true,
      dot: false,
      ignore: [
        "**/node_modules/**",
        "**/.next/**",
        "**/logs/**",
        "**/package-lock.json",
        "**/package.json",
        "**/jsconfig.json",
        "**/messages/**",
        "**/src/server/data/**",
        "**/public/rag-meta-templates/**"
      ]
    });
    discovered.push(...entries);
  }

  return [...new Set([...explicitFiles, ...discovered])].sort();
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function increment(map, key, by = 1) {
  const normalized = String(key || "unknown");
  map[normalized] = (map[normalized] || 0) + by;
}

function pushUnique(list, value) {
  if (!value) return;
  if (!list.includes(value)) list.push(value);
}

function createSummary() {
  return {
    total: 0,
    ready: 0,
    backfill_required: 0,
    blocked: 0,
    by_collection: {},
    by_source_type: {},
    by_file_type: {},
    missing_required_fields: {},
    missing_recommended_fields: {},
    inferred_fields: {}
  };
}

function addFieldCounts(target, fields = []) {
  for (const field of fields) increment(target, field);
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value.map(item => String(item || "").trim()).filter(Boolean);
  if (!hasValue(value)) return [];
  return [String(value || "").trim()].filter(Boolean);
}

function normalizedCollectionId(metadata = {}, context = {}) {
  return String(
    firstValue(
      metadata.collection_id,
      metadata.collectionId,
      context.root?.collection_id,
      context.root?.collectionId,
      inferCollectionIdFallback(metadata, context)
    ) || ""
  ).trim() || null;
}

function inferCollectionIdFallback(metadata = {}, context = {}) {
  const collectionFamily = String(context.collectionFamily || "").trim();
  const sourceType = String(metadata.source_type || "").trim();
  if (collectionFamily === "national_rt" || sourceType === "national_law") return "national_regulations";
  if (collectionFamily === "kov_rt" || sourceType === "kov_regulation") return "kov_regulations";
  if (collectionFamily === "ajakiri_sotsiaaltoo" || sourceType === "journal_article") return "sotsiaaltoo_articles";
  if (collectionFamily === "kov_web" || KOV_SOURCE_TYPES.has(sourceType)) return "kov_services";
  if (collectionFamily === "organizations" || ORGANIZATION_SOURCE_TYPES.has(sourceType)) return "organizations";
  return null;
}

function inferAuditFileType(record = {}, normalized = {}) {
  const filePath = String(record.context?.filePath || "").toLowerCase();
  const recordKind = String(record.context?.recordKind || "").trim().toLowerCase();
  const sourceType = String(normalized.source_type || "").trim();

  if (filePath.endsWith(".sources.json")) return "sources_json";
  if (filePath.endsWith(".meta.json")) return "meta_json";
  if (filePath.endsWith(".rag.md")) return "rag_md";
  if (filePath.endsWith(".xml")) return "xml";
  if (recordKind === "item" && filePath.endsWith(".json")) return "kov_data_item";
  if (recordKind === "metadata" && filePath.endsWith(".json")) return "metadata_json";
  if (sourceType === "journal_article") return "article_ingest";
  return "unknown";
}

function extraRequiredFieldsForItem(metadata = {}, context = {}) {
  const sourceType = String(metadata.source_type || "").trim();
  const collectionId = normalizedCollectionId(metadata, context);
  const recordKind = String(context.recordKind || "").trim();
  const required = [];
  const recommended = [];
  const fieldErrors = [];
  const suggestedRemediation = [];

  if (LEGAL_SOURCE_TYPES.has(sourceType) || ["national_regulations", "kov_regulations"].includes(collectionId)) {
    required.push("collection_id", "jurisdiction_level", "act_title", "paragraph_number", "source_status", "historical", "last_checked");
    recommended.push("act_reference", "paragraph_title", "subsection_number", "point_number", "valid_from", "valid_to");

    if (sourceType === "national_law" && collectionId && collectionId !== "national_regulations") {
      fieldErrors.push("collection_id_expected_national_regulations");
    }
    if (sourceType === "kov_regulation") {
      required.push("municipality_id");
      if (collectionId && collectionId !== "kov_regulations") {
        fieldErrors.push("collection_id_expected_kov_regulations");
      }
    }
  }

  if (KOV_SOURCE_TYPES.has(sourceType) || collectionId === "kov_services") {
    required.push("collection_id", "municipality_id", "municipality_name");
    recommended.push("resource_type");
    if (recordKind === "item" || hasValue(metadata.item_type)) {
      required.push("canonical_item_id", "item_type");
      recommended.push("url_canonical");
      if (!hasValue(metadata.url_canonical) && normalizeArray(metadata.source_urls).length === 0) {
        pushUnique(suggestedRemediation, "link_canonical_item_to_official_url");
      }
    }

    if (recordKind === "item") {
      recommended.push("source_urls");
      if (Array.isArray(context.source?.sourceKeys) && context.source.sourceKeys.length > 0) {
        pushUnique(suggestedRemediation, "map_source_keys_to_source_urls_or_registry_links");
      }
      if (hasValue(context.source?.officialUrl) && !hasValue(metadata.url_canonical)) {
        pushUnique(suggestedRemediation, "map_officialUrl_to_url_canonical");
      }
    }
  }

  if (sourceType === "journal_article" || collectionId === "sotsiaaltoo_articles") {
    required.push("collection_id", "source_type", "authority", "journalTitle", "articleId", "year");
    recommended.push("issueId", "issueLabel", "authors", "section", "pageRange", "url_canonical");
    if (collectionId && collectionId !== "sotsiaaltoo_articles") {
      fieldErrors.push("collection_id_expected_sotsiaaltoo_articles");
    }
    if (hasValue(metadata.authority) && String(metadata.authority).trim() !== "editorial") {
      fieldErrors.push("authority_expected_editorial");
    }
  }

  if (ORGANIZATION_SOURCE_TYPES.has(sourceType)) {
    required.push("authority");
    recommended.push("organization_id", "organization_name", "resource_type");
  }

  if (TEMPLATE_SOURCE_TYPES.has(sourceType)) {
    required.push("authority");
    recommended.push("template_type", "evidence_allowed_for", "evidence_not_allowed_for");
  }

  return {
    required: [...new Set(required)],
    recommended: [...new Set(recommended)],
    fieldErrors: [...new Set(fieldErrors)],
    suggestedRemediation: [...new Set(suggestedRemediation)]
  };
}

function missingFields(metadata = {}, fields = []) {
  return fields.filter(field => {
    if (field === "source_urls") return normalizeArray(metadata.source_urls).length === 0;
    return !hasValue(metadata[field]);
  });
}

function remediationSuggestionsForItem(item = {}) {
  const suggestions = [];
  const missingRequired = item.missing_required_fields || [];
  const missingRecommended = item.missing_recommended_fields || [];
  const profileRemediation = item.profile_remediation || [];
  const sourceType = item.source_type || "unknown";
  const filePath = item.file_path || "unknown";

  if (missingRequired.length > 0) {
    suggestions.push({
      action: "fill_required_canonical_fields",
      reason: `Required canonical fields missing for ${sourceType}`,
      fields: missingRequired,
      example: `${filePath} :: ${item.title || item.source_id || "unknown"}`
    });
  }

  if (missingRecommended.length > 0) {
    suggestions.push({
      action: "fill_recommended_canonical_fields",
      reason: `Recommended canonical fields missing for ${sourceType}`,
      fields: missingRecommended,
      example: `${filePath} :: ${item.title || item.source_id || "unknown"}`
    });
  }

  for (const action of profileRemediation) {
    suggestions.push({
      action,
      reason: `Profile-specific canonicalization gap for ${sourceType}`,
      fields: [],
      example: `${filePath} :: ${item.title || item.source_id || "unknown"}`
    });
  }

  return suggestions;
}

function buildAuditItem(record = {}, options = {}) {
  const plan = planRagMetadataBackfillForSource(record.source, record.context, options);
  const metadata = normalizeRagSourceMetadata(plan.metadata);
  const freshnessNormalized = normalizeSourceMetadataForFreshness({
    ...record.source,
    metadata
  });
  const collectionId = normalizedCollectionId(metadata, record.context);
  const sourceType = String(metadata.source_type || freshnessNormalized.source_type || "unknown").trim() || "unknown";
  const fileType = inferAuditFileType(record, metadata);
  const profile = extraRequiredFieldsForItem(metadata, {
    ...record.context,
    source: record.source
  });
  const requiredFields = [...new Set([...RAG_METADATA_REQUIRED_FOR_READINESS, ...profile.required])];
  const recommendedFields = [...new Set([...RAG_METADATA_RECOMMENDED_FOR_READINESS, ...profile.recommended])];
  const missingRequired = missingFields({
    ...metadata,
    collection_id: collectionId,
    source_urls: metadata.source_urls
  }, requiredFields);
  const missingRecommended = missingFields({
    ...metadata,
    collection_id: collectionId,
    source_urls: metadata.source_urls
  }, recommendedFields);

  let status = plan.status;
  if (profile.fieldErrors.length > 0 || missingRequired.length > 0) status = "blocked";
  else if (status === "ready" && (plan.inferred_fields.length > 0 || missingRecommended.length > 0)) status = "backfill_required";

  const item = {
    status,
    base_status: plan.status,
    collection_id: collectionId || "unknown",
    collection_family: record.context.collectionFamily || "unknown",
    source_type: sourceType,
    source_file_type: fileType,
    record_kind: record.context.recordKind || "source",
    file_path: record.context.filePath || null,
    index: record.index ?? null,
    source_id: metadata.source_id || plan.source_id || null,
    document_id: metadata.document_id || plan.document_id || null,
    chunk_id: metadata.chunk_id || null,
    title: metadata.title || plan.title || null,
    inferred_fields: plan.inferred_fields || [],
    missing_required_fields: missingRequired,
    missing_recommended_fields: missingRecommended,
    profile_errors: profile.fieldErrors,
    profile_remediation: profile.suggestedRemediation,
    remaining_errors: [...new Set([...(plan.remaining_errors || []), ...profile.fieldErrors])],
    warnings: plan.warnings || [],
    metadata: {
      metadata_schema_version: metadata.metadata_schema_version || null,
      source_id: metadata.source_id || null,
      document_id: metadata.document_id || null,
      chunk_id: metadata.chunk_id || null,
      title: metadata.title || null,
      source_type: sourceType,
      authority: metadata.authority || null,
      language: metadata.language || null,
      audience: metadata.audience || null,
      last_checked: metadata.last_checked || null,
      historical: metadata.historical,
      source_status: metadata.source_status || null,
      valid_from: metadata.valid_from || null,
      valid_to: metadata.valid_to || null,
      url_canonical: metadata.url_canonical || null,
      content_hash: metadata.content_hash || null,
      collection_id: collectionId || null,
      jurisdiction_level: metadata.jurisdiction_level || null,
      municipality_id: metadata.municipality_id || null,
      municipality_name: metadata.municipality_name || null,
      canonical_item_id: metadata.canonical_item_id || null,
      item_type: metadata.item_type || null,
      resource_type: metadata.resource_type || null,
      act_title: metadata.act_title || null,
      act_reference: metadata.act_reference || null,
      paragraph_number: metadata.paragraph_number || null,
      paragraph_title: metadata.paragraph_title || null,
      subsection_number: metadata.subsection_number || null,
      point_number: metadata.point_number || null,
      journalTitle: metadata.journalTitle || null,
      issueId: metadata.issueId || null,
      issueLabel: metadata.issueLabel || null,
      articleId: metadata.articleId || null,
      authors: metadata.authors || [],
      year: metadata.year || null,
      section: metadata.section || null,
      pageRange: metadata.pageRange || null,
      source_urls: metadata.source_urls || []
    }
  };

  item.remediation_suggestions = remediationSuggestionsForItem(item);
  return item;
}

function compactItem(item = {}) {
  return {
    status: item.status,
    collection_id: item.collection_id,
    collection_family: item.collection_family,
    source_type: item.source_type,
    source_file_type: item.source_file_type,
    record_kind: item.record_kind,
    file_path: item.file_path,
    index: item.index,
    source_id: item.source_id,
    document_id: item.document_id,
    chunk_id: item.chunk_id,
    title: item.title,
    inferred_fields: item.inferred_fields,
    missing_required_fields: item.missing_required_fields,
    missing_recommended_fields: item.missing_recommended_fields,
    remaining_errors: item.remaining_errors,
    remediation_suggestions: item.remediation_suggestions
  };
}

function summarizeAuditItems(items = []) {
  const summary = createSummary();
  const examplesBlocked = [];
  const examplesBackfillRequired = [];
  const remediationMap = new Map();

  for (const item of items) {
    summary.total += 1;
    summary[item.status] += 1;
    increment(summary.by_collection, item.collection_id || item.collection_family || "unknown");
    increment(summary.by_source_type, item.source_type || "unknown");
    increment(summary.by_file_type, item.source_file_type || "unknown");
    addFieldCounts(summary.missing_required_fields, item.missing_required_fields);
    addFieldCounts(summary.missing_recommended_fields, item.missing_recommended_fields);
    addFieldCounts(summary.inferred_fields, item.inferred_fields);

    if (item.status === "blocked" && examplesBlocked.length < 10) {
      examplesBlocked.push(compactItem(item));
    }
    if (item.status === "backfill_required" && examplesBackfillRequired.length < 10) {
      examplesBackfillRequired.push(compactItem(item));
    }

    for (const suggestion of item.remediation_suggestions || []) {
      if (!remediationMap.has(suggestion.action)) {
        remediationMap.set(suggestion.action, {
          action: suggestion.action,
          count: 0,
          reasons: new Set(),
          fields: new Set(),
          examples: []
        });
      }
      const entry = remediationMap.get(suggestion.action);
      entry.count += 1;
      if (suggestion.reason) entry.reasons.add(suggestion.reason);
      for (const field of suggestion.fields || []) entry.fields.add(field);
      if (suggestion.example && entry.examples.length < 5) entry.examples.push(suggestion.example);
    }
  }

  const remediationSuggestions = [...remediationMap.values()]
    .sort((left, right) => right.count - left.count || left.action.localeCompare(right.action))
    .map(entry => ({
      action: entry.action,
      count: entry.count,
      reasons: [...entry.reasons],
      fields: [...entry.fields],
      examples: entry.examples
    }));

  return {
    summary,
    examples_blocked: examplesBlocked,
    examples_backfill_required: examplesBackfillRequired,
    remediation_suggestions: remediationSuggestions
  };
}

export async function runReingestReadinessAudit(rawArgs = {}) {
  const args = rawArgs.roots || rawArgs.files
    ? rawArgs
    : parseArgs(Array.isArray(rawArgs.argv) ? rawArgs.argv : process.argv.slice(2));

  const files = await discoverJsonFiles(args);
  const records = [];
  const unreadable = [];

  for (const filePath of files) {
    try {
      const payload = await readJson(filePath);
      records.push(...extractRecordsFromPayload(payload, filePath, args));
    } catch (error) {
      unreadable.push({
        file_path: normalizeRel(filePath),
        error: error.message
      });
    }
  }

  const limitedRecords = args.limit > 0 ? records.slice(0, args.limit) : records;
  const auditOptions = {
    defaultLastChecked: todayDateOnly()
  };
  const plan = buildRagMetadataBackfillPlan(limitedRecords, auditOptions);
  const items = limitedRecords.map(record => buildAuditItem(record, auditOptions));
  const aggregate = summarizeAuditItems(items);

  const output = {
    ok: aggregate.summary.blocked === 0,
    summary: {
      ...aggregate.summary,
      files: files.length,
      records_discovered: records.length,
      records_planned: limitedRecords.length,
      unreadable_files: unreadable.length
    },
    unreadable_files: unreadable,
    examples_blocked: aggregate.examples_blocked,
    examples_backfill_required: aggregate.examples_backfill_required,
    remediation_suggestions: aggregate.remediation_suggestions,
    audit_basis: {
      dry_run: true,
      validate_normalize_validate: true,
      readiness_policy: {
        blocked_means_not_ready: true,
        backfill_required_allowed_if_normalizable: true,
        missing_recommended_non_blocking: true
      },
      plan_summary: plan.summary
    },
    items: args.summaryOnly ? [] : items.map(compactItem)
  };

  if (args.jsonPath) {
    const absoluteJsonPath = resolvePath(args.jsonPath);
    await fs.mkdir(path.dirname(absoluteJsonPath), { recursive: true });
    await fs.writeFile(absoluteJsonPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  }

  return output;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }

  const output = await runReingestReadinessAudit(args);
  console.log("[rag:reingest:readiness]");
  console.log(`  dry_run: true`);
  console.log(`  files: ${output.summary.files}`);
  console.log(`  records: ${output.summary.records_planned}/${output.summary.records_discovered}`);
  console.log(`  ready: ${output.summary.ready}`);
  console.log(`  backfill_required: ${output.summary.backfill_required}`);
  console.log(`  blocked: ${output.summary.blocked}`);
  if (args.jsonPath) console.log(`  json: ${normalizeRel(resolvePath(args.jsonPath))}`);

  if (output.examples_blocked.length > 0) {
    for (const item of output.examples_blocked.slice(0, 10)) {
      console.log(`[blocked] ${item.file_path} ${item.title || item.source_id || "unknown"} ${item.missing_required_fields[0] || item.remaining_errors[0] || ""}`);
    }
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error("[rag:reingest:readiness] Failed:", error.message);
    process.exit(1);
  });
}
