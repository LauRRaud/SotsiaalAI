#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  RAG_METADATA_REQUIRED_FOR_READINESS,
  validateRagSourceMetadataContract,
  isKnownRagSourceStatus,
  isKnownRagSourceType
} from "../lib/rag/sourceMetadata.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const SOURCE_TYPES = new Set([
  "INDEX",
  "DETAIL",
  "FORMS",
  "RT",
  "CONTACT",
  "OTHER",
  "web_page",
  "contact_page",
  "pdf",
  "doc",
  "docx",
  "html",
  "e_form",
  "other"
]);
const ITEM_TYPES = new Set(["service", "benefit", "resource", "contact", "form"]);
const ITEM_STATUSES = new Set(["active", "unclear", "ended", "inactive"]);
const AUDIENCE_VALUES = new Set(["CLIENT", "SOCIAL_WORKER"]);
const FORMATS = new Set(["pdf", "doc", "docx", "xls", "xlsx", "html", "e-form"]);
const PROVIDER_TYPES = new Set(["KOV", "AGENCY", "EXTERNAL"]);
const LEGAL_BASIS_TYPES = new Set(["LAW", "REGULATION", "ORDER", "WEB"]);
const RESOURCE_TYPES = new Set(["contact", "institution", "provider", "external_link", "guidance"]);
const ROOT_JSON_REQUIRED = Object.freeze(["municipality", "county", "checkedAt"]);
const HELP_TEXT = `
Usage:
  node scripts/validate-kov-rag.mjs <dir|base-path|file> [--slug <slug>] [--allow-missing-rag-md]

Examples:
  node scripts/validate-kov-rag.mjs output/parnu-linn
  node scripts/validate-kov-rag.mjs output --slug parnu-linn
  npm run rag:validate:kov -- output/parnu-linn
`.trim();

function _fail(message) {
  console.error(`[rag:validate:kov] ${message}`);
  process.exit(1);
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function normalizeRel(filePath) {
  return path.relative(rootDir, filePath) || filePath;
}

function looksLikeDate(value) {
  if (!isNonEmptyString(value)) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidUrl(value) {
  if (!isNonEmptyString(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function toKovSlug(slug) {
  return String(slug || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toItemIdSlug(slug) {
  return toKovSlug(slug).replace(/_final$/, "");
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function compareSets(a, b) {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function describePath(base, key) {
  return base ? `${base}.${key}` : key;
}

function scanForEmptyStrings(value, label, errors) {
  if (typeof value === "string" && value === "") {
    errors.push(`${label}: empty string is not allowed; use null or []`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForEmptyStrings(entry, `${label}[${index}]`, errors));
    return;
  }
  if (!isObject(value)) return;
  for (const [key, entry] of Object.entries(value)) {
    scanForEmptyStrings(entry, describePath(label, key), errors);
  }
}

function assertAllowedKeys(obj, allowedKeys, label, errors) {
  if (!isObject(obj)) return;
  for (const key of Object.keys(obj)) {
    if (!allowedKeys.has(key)) {
      errors.push(`${label}: unexpected property "${key}"`);
    }
  }
}

function assertRequiredKeys(obj, requiredKeys, label, errors) {
  if (!isObject(obj)) {
    errors.push(`${label}: expected object`);
    return;
  }
  for (const key of requiredKeys) {
    if (!(key in obj)) {
      errors.push(`${label}: missing required property "${key}"`);
    }
  }
}

function assertString(value, label, errors, { allowNull = false, minLength = 0, pattern = null } = {}) {
  if (value == null) {
    if (allowNull) return;
    errors.push(`${label}: expected string`);
    return;
  }
  if (typeof value !== "string") {
    errors.push(`${label}: expected string`);
    return;
  }
  if (value.length < minLength) {
    errors.push(`${label}: expected at least ${minLength} characters`);
  }
  if (pattern && !pattern.test(value)) {
    errors.push(`${label}: invalid format`);
  }
}

function assertStringArray(value, label, errors, { allowEmpty = true, unique = false, allowedSet = null } = {}) {
  if (!Array.isArray(value)) {
    errors.push(`${label}: expected array`);
    return;
  }
  if (!allowEmpty && value.length === 0) {
    errors.push(`${label}: array must not be empty`);
  }
  const seen = new Set();
  value.forEach((entry, index) => {
    if (typeof entry !== "string") {
      errors.push(`${label}[${index}]: expected string`);
      return;
    }
    if (!entry.trim()) {
      errors.push(`${label}[${index}]: empty string is not allowed`);
    }
    if (allowedSet && !allowedSet.has(entry)) {
      errors.push(`${label}[${index}]: invalid value "${entry}"`);
    }
    if (unique) {
      if (seen.has(entry)) errors.push(`${label}: duplicate value "${entry}"`);
      seen.add(entry);
    }
  });
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse ${normalizeRel(filePath)}: ${error.message}`);
  }
}

async function readUtf8(filePath) {
  return fs.readFile(filePath, "utf8");
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
      const candidateSlugs = uniqueSorted(
        names
          .filter((name) => name.endsWith(".sources.json"))
          .map((name) => name.slice(0, -".sources.json".length))
      );
      if (candidateSlugs.length === 1) {
        slug = candidateSlugs[0];
      } else if (candidateSlugs.length === 0) {
        throw new Error(`No *.sources.json files found in ${normalizeRel(dirPath)}`);
      } else {
        throw new Error(
          `Multiple datasets found in ${normalizeRel(dirPath)}. Pass --slug <slug>. Candidates: ${candidateSlugs.join(", ")}`
        );
      }
    }
  } else if (stats?.isFile()) {
    dirPath = path.dirname(input);
    const fileName = path.basename(input);
    if (!slug) {
      if (fileName.endsWith(".sources.json")) slug = fileName.slice(0, -".sources.json".length);
      else if (fileName.endsWith(".meta.json")) slug = fileName.slice(0, -".meta.json".length);
      else if (fileName.endsWith(".rag.md")) slug = fileName.slice(0, -".rag.md".length);
      else if (fileName.endsWith(".json")) slug = fileName.slice(0, -".json".length);
      else throw new Error(`Cannot derive slug from ${normalizeRel(input)}`);
    }
  } else {
    dirPath = path.dirname(input);
    if (!slug) slug = path.basename(input);
  }

  if (!slug) {
    throw new Error("Slug is required");
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

function validateRootFields(data, label, errors) {
  ROOT_JSON_REQUIRED.forEach((key) => {
    if (!(key in data)) errors.push(`${label}: missing required property "${key}"`);
  });
  assertString(data.municipality, `${label}.municipality`, errors, { minLength: 1 });
  assertString(data.county, `${label}.county`, errors, { minLength: 1 });
  if ("country" in data && data.country !== "EE") errors.push(`${label}.country: expected "EE"`);
  if ("language" in data && data.language !== "et") errors.push(`${label}.language: expected "et"`);
  if (!looksLikeDate(data.checkedAt)) errors.push(`${label}.checkedAt: expected YYYY-MM-DD`);
}

function validateSourceReadinessFields(source, label, errors) {
  if (!isObject(source)) return;
  const contract = validateRagSourceMetadataContract(source, {
    label,
    requireMunicipality: true,
    requireDocumentId: false,
    requireTitle: false,
    requireAudience: true
  });
  errors.push(...contract.errors);

  if ("source_id" in source) {
    assertString(source.source_id, `${label}.source_id`, errors, { minLength: 1, pattern: /^[a-z0-9_-]+$/ });
  }
  if ("source_type" in source && !isKnownRagSourceType(source.source_type)) {
    errors.push(`${label}.source_type: invalid RAG source type "${source.source_type}"`);
  }
  if ("authority" in source && !isNonEmptyString(source.authority)) {
    errors.push(`${label}.authority: expected non-empty string`);
  }
  if ("audience" in source) {
    assertStringArray(source.audience, `${label}.audience`, errors, {
      allowEmpty: false,
      unique: true,
      allowedSet: AUDIENCE_VALUES
    });
  }
  if ("language" in source && source.language !== "et") {
    errors.push(`${label}.language: expected "et"`);
  }
  if ("municipality_id" in source && source.municipality_id != null) {
    assertString(source.municipality_id, `${label}.municipality_id`, errors, { minLength: 1, pattern: /^[a-z0-9_-]+$/ });
  }
  if ("last_checked" in source && !looksLikeDate(source.last_checked)) {
    errors.push(`${label}.last_checked: expected YYYY-MM-DD`);
  }
  for (const field of ["valid_from", "valid_to"]) {
    if (field in source && source[field] != null && !looksLikeDate(source[field])) {
      errors.push(`${label}.${field}: expected YYYY-MM-DD or null`);
    }
  }
  if ("historical" in source && typeof source.historical !== "boolean") {
    errors.push(`${label}.historical: expected boolean`);
  }
  if ("source_status" in source && !isKnownRagSourceStatus(source.source_status)) {
    errors.push(`${label}.source_status: invalid value "${source.source_status}"`);
  }
  if ("content_hash" in source && !isNonEmptyString(source.content_hash)) {
    errors.push(`${label}.content_hash: expected non-empty string`);
  }
  if ("url_canonical" in source && source.url_canonical != null && !isValidUrl(source.url_canonical)) {
    errors.push(`${label}.url_canonical: invalid URL`);
  }
}

function warnSourceReadinessCoverage(sources, label, warnings) {
  if (!warnings || !Array.isArray(sources)) return;
  const fields = RAG_METADATA_REQUIRED_FOR_READINESS;
  const missingCounts = Object.fromEntries(fields.map(field => [field, 0]));
  const contractWarnings = [];

  for (const source of sources) {
    if (!isObject(source)) continue;
    for (const field of fields) {
      if (source[field] == null || source[field] === "") {
        missingCounts[field] += 1;
      }
    }
    const contract = validateRagSourceMetadataContract(source, {
      label: `${label}.${source.key || source.title || "unknown"}`,
      requireMunicipality: true,
      requireDocumentId: false,
      requireTitle: false,
      requireAudience: true
    });
    contractWarnings.push(...contract.warnings);
  }

  const missingSummary = Object.entries(missingCounts)
    .filter(([, count]) => count > 0)
    .map(([field, count]) => `${field} (${count}/${sources.length})`);

  if (missingSummary.length) {
    warnings.push(`${label}: missing recommended V1 metadata fields: ${missingSummary.join(", ")}`);
  }
  if (contractWarnings.length) {
    warnings.push(...contractWarnings.slice(0, 20));
    if (contractWarnings.length > 20) warnings.push(`${label}: +${contractWarnings.length - 20} more recommended metadata warnings`);
  }
}

function validateSourceRecord(source, label, errors) {
  const allowed = new Set([
    "key",
    "type",
    "title",
    "url",
    "source_id",
    "source_type",
    "authority",
    "audience",
    "language",
    "municipality",
    "municipality_id",
    "last_checked",
    "valid_from",
    "valid_to",
    "historical",
    "canonical_item_id",
    "document_id",
    "chunk_id",
    "content_hash",
    "retrieved_at",
    "url_canonical",
    "source_status"
  ]);
  assertAllowedKeys(source, allowed, label, errors);
  assertRequiredKeys(source, ["key", "type", "title", "url"], label, errors);
  assertString(source.key, `${label}.key`, errors, { minLength: 1, pattern: /^[a-z0-9_]+$/ });
  if (!SOURCE_TYPES.has(source.type)) errors.push(`${label}.type: invalid source type "${source.type}"`);
  assertString(source.title, `${label}.title`, errors, { minLength: 1 });
  if (!isValidUrl(source.url)) errors.push(`${label}.url: invalid URL`);
  validateSourceReadinessFields(source, label, errors);
}

function validateSourcesJson(data, errors, warnings = null) {
  const label = "sources";
  const allowed = new Set(["municipality", "county", "country", "language", "checkedAt", "indexUrl", "sources"]);
  assertAllowedKeys(data, allowed, label, errors);
  validateRootFields(data, label, errors);
  if ("indexUrl" in data && data.indexUrl != null && !isValidUrl(data.indexUrl)) {
    errors.push(`${label}.indexUrl: invalid URL`);
  }
  if (!Array.isArray(data.sources)) {
    errors.push(`${label}.sources: expected array`);
    return;
  }
  const seenKeys = new Set();
  data.sources.forEach((source, index) => {
    const itemLabel = `${label}.sources[${index}]`;
    validateSourceRecord(source, itemLabel, errors);
    if (source?.key) {
      if (seenKeys.has(source.key)) errors.push(`${label}.sources: duplicate key "${source.key}"`);
      seenKeys.add(source.key);
    }
  });
  warnSourceReadinessCoverage(data.sources, `${label}.sources`, warnings);
}

function validateForm(form, label, errors) {
  const allowed = new Set(["title", "url", "format", "note"]);
  assertAllowedKeys(form, allowed, label, errors);
  assertRequiredKeys(form, ["title", "url", "format"], label, errors);
  assertString(form.title, `${label}.title`, errors, { minLength: 1 });
  if (!isValidUrl(form.url)) errors.push(`${label}.url: invalid URL`);
  if (!(form.format === null || FORMATS.has(form.format))) {
    errors.push(`${label}.format: invalid form format "${form.format}"`);
  }
  if (!(form.note === undefined || form.note === null || typeof form.note === "string")) {
    errors.push(`${label}.note: expected string or null`);
  }
}

function validateProvider(provider, label, errors) {
  if (provider === null) return;
  const allowed = new Set(["name", "type", "unit", "url"]);
  assertAllowedKeys(provider, allowed, label, errors);
  assertRequiredKeys(provider, ["name", "type"], label, errors);
  if (!(provider.name === null || typeof provider.name === "string")) {
    errors.push(`${label}.name: expected string or null`);
  }
  if (!(provider.type === null || PROVIDER_TYPES.has(provider.type))) {
    errors.push(`${label}.type: invalid provider type "${provider.type}"`);
  }
  if (!(provider.unit === undefined || provider.unit === null || typeof provider.unit === "string")) {
    errors.push(`${label}.unit: expected string or null`);
  }
  if (!(provider.url === undefined || provider.url === null || isValidUrl(provider.url))) {
    errors.push(`${label}.url: invalid URL`);
  }
}

function validateContact(contact, label, errors) {
  const allowed = new Set(["name", "role", "phone", "email", "url", "note"]);
  assertAllowedKeys(contact, allowed, label, errors);
  assertRequiredKeys(contact, ["name", "role", "phone", "email", "url"], label, errors);
  for (const key of ["name", "role", "phone", "note"]) {
    if (!(contact[key] === undefined || contact[key] === null || typeof contact[key] === "string")) {
      errors.push(`${label}.${key}: expected string or null`);
    }
  }
  if (!(contact.email === null || contact.email === undefined || typeof contact.email === "string")) {
    errors.push(`${label}.email: expected string or null`);
  }
  if (!(contact.url === null || contact.url === undefined || isValidUrl(contact.url))) {
    errors.push(`${label}.url: invalid URL`);
  }
}

function validateApplication(application, label, errors) {
  const allowed = new Set(["channels", "steps", "deadline", "decisionTime", "notes"]);
  assertAllowedKeys(application, allowed, label, errors);
  assertRequiredKeys(application, ["channels", "steps", "deadline", "decisionTime", "notes"], label, errors);
  assertStringArray(application.channels, `${label}.channels`, errors, { allowEmpty: true });
  assertStringArray(application.steps, `${label}.steps`, errors, { allowEmpty: true });
  for (const key of ["deadline", "decisionTime", "notes"]) {
    if (!(application[key] === null || typeof application[key] === "string")) {
      errors.push(`${label}.${key}: expected string or null`);
    }
  }
}

function validatePricing(pricing, label, errors) {
  if (pricing == null) return;
  const allowed = new Set(["type", "value", "currency", "note"]);
  assertAllowedKeys(pricing, allowed, label, errors);
  assertRequiredKeys(pricing, ["type", "value", "currency", "note"], label, errors);
  const types = new Set(["free", "paid", "amount", "unclear"]);
  if (!(pricing.type === null || types.has(pricing.type))) {
    errors.push(`${label}.type: invalid pricing type "${pricing.type}"`);
  }
  if (!(pricing.value === null || Number.isFinite(pricing.value))) {
    errors.push(`${label}.value: expected number or null`);
  }
  if (!(pricing.currency === null || pricing.currency === "EUR")) {
    errors.push(`${label}.currency: expected "EUR" or null`);
  }
  if (!(pricing.note === null || typeof pricing.note === "string")) {
    errors.push(`${label}.note: expected string or null`);
  }
}

function validateLegalBasisEntry(entry, label, errors) {
  const allowed = new Set(["title", "type", "citation", "url"]);
  assertAllowedKeys(entry, allowed, label, errors);
  assertRequiredKeys(entry, ["title", "type", "citation", "url"], label, errors);
  assertString(entry.title, `${label}.title`, errors, { minLength: 1 });
  if (!(entry.type === null || LEGAL_BASIS_TYPES.has(entry.type))) {
    errors.push(`${label}.type: invalid legal basis type "${entry.type}"`);
  }
  if (!(entry.citation === null || typeof entry.citation === "string")) {
    errors.push(`${label}.citation: expected string or null`);
  }
  if (!(entry.url === null || isValidUrl(entry.url))) {
    errors.push(`${label}.url: invalid URL`);
  }
}

function validateOptionalString(value, label, errors, { allowNull = true } = {}) {
  if (value == null && allowNull) return;
  if (typeof value !== "string") errors.push(`${label}: expected string${allowNull ? " or null" : ""}`);
}

function validateOptionalStringArray(value, label, errors) {
  if (value == null) return;
  assertStringArray(value, label, errors, { allowEmpty: true, unique: true });
}

function validateStringOrStringArray(value, label, errors) {
  if (value == null) return;
  if (typeof value === "string") return;
  assertStringArray(value, label, errors, { allowEmpty: true });
}

function validateFlexibleApplication(value, label, errors) {
  if (value == null || typeof value === "string") return;
  if (isObject(value)) {
    validateApplication(value, label, errors);
    return;
  }
  errors.push(`${label}: expected string, object, or null`);
}

function validateFlexibleItem(item, label, errors, kovSlug) {
  const allowedKeys = new Set([
    "id",
    "itemType",
    "title",
    "status",
    "audience",
    "targetGroup",
    "summary",
    "resourceType",
    "application",
    "forms",
    "provider",
    "contacts",
    "pricingOrAmount",
    "legalBasis",
    "sourceKeys",
    "sourceUrls",
    "amount",
    "conditions",
    "officialUrl",
    "relatedForms",
    "relatedContacts",
    "relatedTo",
    "decisionTime",
    "deadline",
    "phone",
    "email",
    "address",
    "name",
    "role",
    "department",
    "format",
    "submissionChannels"
  ]);
  assertAllowedKeys(item, allowedKeys, label, errors);
  assertRequiredKeys(item, ["id", "itemType", "title", "status", "sourceKeys"], label, errors);

  assertString(item.id, `${label}.id`, errors, { minLength: 1, pattern: /^[a-z0-9_]+$/ });
  if (item?.id && !new RegExp(`^${kovSlug}_(service|benefit|resource|contact|form)_[a-z0-9_]+$`).test(item.id)) {
    errors.push(`${label}.id: expected format ${kovSlug}_{service|benefit|resource|contact|form}_{item_slug}`);
  }
  if (!ITEM_TYPES.has(item.itemType)) errors.push(`${label}.itemType: invalid item type "${item.itemType}"`);
  assertString(item.title, `${label}.title`, errors, { minLength: 1 });
  if (!ITEM_STATUSES.has(item.status)) errors.push(`${label}.status: invalid status "${item.status}"`);

  if ("audience" in item) {
    assertStringArray(item.audience, `${label}.audience`, errors, {
      allowEmpty: false,
      unique: true,
      allowedSet: AUDIENCE_VALUES
    });
  }
  validateStringOrStringArray(item.targetGroup, `${label}.targetGroup`, errors);
  validateOptionalString(item.summary, `${label}.summary`, errors);
  validateOptionalString(item.amount, `${label}.amount`, errors);
  validateOptionalString(item.conditions, `${label}.conditions`, errors);
  validateFlexibleApplication(item.application, `${label}.application`, errors);
  validateOptionalString(item.decisionTime, `${label}.decisionTime`, errors);
  validateOptionalString(item.deadline, `${label}.deadline`, errors);
  validateOptionalString(item.phone, `${label}.phone`, errors);
  validateOptionalString(item.email, `${label}.email`, errors);
  validateOptionalString(item.address, `${label}.address`, errors);
  validateOptionalString(item.name, `${label}.name`, errors);
  validateOptionalString(item.role, `${label}.role`, errors);
  validateOptionalString(item.department, `${label}.department`, errors);

  if (item.officialUrl != null && !isValidUrl(item.officialUrl)) {
    errors.push(`${label}.officialUrl: invalid URL`);
  }
  if (item.resourceType != null && !RESOURCE_TYPES.has(item.resourceType)) {
    errors.push(`${label}.resourceType: invalid resource type "${item.resourceType}"`);
  }
  if (item.format != null && !FORMATS.has(item.format)) {
    errors.push(`${label}.format: invalid format "${item.format}"`);
  }
  if (item.itemType === "form" && !item.officialUrl) {
    errors.push(`${label}.officialUrl: required when itemType is "form"`);
  }

  if ("forms" in item) {
    if (!Array.isArray(item.forms)) errors.push(`${label}.forms: expected array`);
    else item.forms.forEach((form, index) => validateForm(form, `${label}.forms[${index}]`, errors));
  }
  if ("provider" in item) {
    if (!(item.provider === null || isObject(item.provider))) errors.push(`${label}.provider: expected object or null`);
    else validateProvider(item.provider, `${label}.provider`, errors);
  }
  if ("contacts" in item) {
    if (!Array.isArray(item.contacts)) errors.push(`${label}.contacts: expected array`);
    else item.contacts.forEach((contact, index) => validateContact(contact, `${label}.contacts[${index}]`, errors));
  }
  if ("pricingOrAmount" in item) validatePricing(item.pricingOrAmount, `${label}.pricingOrAmount`, errors);
  if ("legalBasis" in item) {
    if (!Array.isArray(item.legalBasis)) errors.push(`${label}.legalBasis: expected array`);
    else item.legalBasis.forEach((entry, index) => validateLegalBasisEntry(entry, `${label}.legalBasis[${index}]`, errors));
  }

  assertStringArray(item.sourceKeys, `${label}.sourceKeys`, errors, {
    allowEmpty: false,
    unique: true
  });
  validateOptionalStringArray(item.sourceUrls, `${label}.sourceUrls`, errors);
  validateOptionalStringArray(item.relatedForms, `${label}.relatedForms`, errors);
  validateOptionalStringArray(item.relatedContacts, `${label}.relatedContacts`, errors);
  validateOptionalStringArray(item.relatedTo, `${label}.relatedTo`, errors);
  validateOptionalStringArray(item.submissionChannels, `${label}.submissionChannels`, errors);

  if (Array.isArray(item.sourceUrls)) {
    item.sourceUrls.forEach((url, index) => {
      if (!isValidUrl(url)) errors.push(`${label}.sourceUrls[${index}]: invalid URL`);
    });
  }
}

function validateDatasetJson(data, slug, errors) {
  const label = "dataset";
  const allowed = new Set(["municipality", "county", "country", "language", "checkedAt", "items"]);
  assertAllowedKeys(data, allowed, label, errors);
  validateRootFields(data, label, errors);
  if (!Array.isArray(data.items)) {
    errors.push(`${label}.items: expected array`);
    return;
  }

  const kovSlug = toItemIdSlug(slug);
  const seenIds = new Set();

  data.items.forEach((item, index) => {
    const itemLabel = `${label}.items[${index}]`;
    validateFlexibleItem(item, itemLabel, errors, kovSlug);
    if (item?.id) {
      if (seenIds.has(item.id)) errors.push(`${label}.items: duplicate id "${item.id}"`);
      seenIds.add(item.id);
    }
  });
}

function validateMetaJson(data, errors) {
  const label = "meta";
  const allowed = new Set([
    "id",
    "title",
    "municipality",
    "county",
    "country",
    "language",
    "checkedAt",
    "status",
    "collection_id",
    "jurisdiction_level",
    "municipality_name",
    "district_name",
    "sources",
    "sourceRegisterFile",
    "sourceCount",
    "tags",
    "coverage",
    "notes",
    "unresolvedIssues"
  ]);
  assertAllowedKeys(data, allowed, label, errors);
  assertRequiredKeys(data, [
    "id",
    "municipality",
    "county",
    "checkedAt",
    "coverage",
    "notes",
    "unresolvedIssues"
  ], label, errors);
  assertString(data.id, `${label}.id`, errors, { minLength: 1, pattern: /^[a-z0-9_-]+$/ });
  if ("title" in data) assertString(data.title, `${label}.title`, errors, { minLength: 1 });
  validateRootFields(data, label, errors);
  if ("collection_id" in data && data.collection_id !== "kov_services") errors.push(`${label}.collection_id: expected "kov_services"`);
  if ("jurisdiction_level" in data && data.jurisdiction_level !== "MUNICIPALITY") {
    errors.push(`${label}.jurisdiction_level: expected "MUNICIPALITY"`);
  }
  if ("municipality_name" in data) assertString(data.municipality_name, `${label}.municipality_name`, errors, { minLength: 1 });
  if ("district_name" in data && data.district_name !== null) errors.push(`${label}.district_name: expected null`);
  if ("sourceRegisterFile" in data && !(data.sourceRegisterFile === null || typeof data.sourceRegisterFile === "string")) {
    errors.push(`${label}.sourceRegisterFile: expected string or null`);
  }
  if ("sourceCount" in data && !(data.sourceCount === null || (Number.isInteger(data.sourceCount) && data.sourceCount >= 0))) {
    errors.push(`${label}.sourceCount: expected integer >= 0 or null`);
  }
  if ("sources" in data && data.sources !== null && !Array.isArray(data.sources)) {
    errors.push(`${label}.sources: expected array when present`);
  } else if (Array.isArray(data.sources)) {
    const seenKeys = new Set();
    data.sources.forEach((source, index) => {
      const sourceLabel = `${label}.sources[${index}]`;
      validateSourceRecord(source, sourceLabel, errors);
      if (source?.key) {
        if (seenKeys.has(source.key)) errors.push(`${label}.sources: duplicate key "${source.key}"`);
        seenKeys.add(source.key);
      }
    });
  }
  if ("tags" in data) assertStringArray(data.tags, `${label}.tags`, errors, { allowEmpty: true, unique: true });
  if (!isObject(data.coverage)) {
    errors.push(`${label}.coverage: expected object`);
  } else {
    assertAllowedKeys(data.coverage, new Set(["services", "benefits", "resources", "contacts", "forms"]), `${label}.coverage`, errors);
    assertRequiredKeys(data.coverage, ["services", "benefits", "resources"], `${label}.coverage`, errors);
    for (const key of ["services", "benefits", "resources", "contacts", "forms"]) {
      if (!(key in data.coverage)) continue;
      const value = data.coverage[key];
      if (!Number.isInteger(value) || value < 0) {
        errors.push(`${label}.coverage.${key}: expected integer >= 0`);
      }
    }
  }
  assertStringArray(data.notes, `${label}.notes`, errors, { allowEmpty: true });
  assertStringArray(data.unresolvedIssues, `${label}.unresolvedIssues`, errors, { allowEmpty: true });
}

function validateRagMarkdown(raw, slug, errors) {
  const label = `${slug}.rag.md`;
  const headings = ["# ", "## TEENUSED", "## TOETUSED", "## RESSURSID"];
  const rawUpper = raw.toUpperCase();
  for (const heading of headings) {
    if (!rawUpper.includes(heading)) {
      errors.push(`${label}: missing heading "${heading}"`);
    }
  }
  if (/```json/i.test(raw)) {
    errors.push(`${label}: should be readable knowledge text, not embedded JSON`);
  }
}

function compareSourceRegisters(sources, meta, errors) {
  const label = "cross-file sources";
  if (!Array.isArray(sources?.sources) || !Array.isArray(meta?.sources)) return;
  const left = new Map(sources.sources.map((entry) => [entry.key, entry]));
  const right = new Map(meta.sources.map((entry) => [entry.key, entry]));

  for (const key of uniqueSorted([...left.keys(), ...right.keys()])) {
    if (!left.has(key)) {
      errors.push(`${label}: key "${key}" exists in meta.json but not in sources.json`);
      continue;
    }
    if (!right.has(key)) {
      errors.push(`${label}: key "${key}" exists in sources.json but not in meta.json`);
      continue;
    }
    const a = left.get(key);
    const b = right.get(key);
    for (const field of ["type", "title", "url"]) {
      if (a[field] !== b[field]) {
        errors.push(`${label}: mismatch for key "${key}" field "${field}"`);
      }
    }
  }
}

function validateCrossFileConsistency({ sources, dataset, meta, slug }, errors) {
  for (const key of ROOT_JSON_REQUIRED) {
    if (sources[key] !== dataset[key]) {
      errors.push(`cross-file root mismatch: sources.${key} != dataset.${key}`);
    }
    if (dataset[key] !== meta[key]) {
      errors.push(`cross-file root mismatch: dataset.${key} != meta.${key}`);
    }
  }

  if ("municipality_name" in meta && meta.municipality !== meta.municipality_name) {
    errors.push("cross-file root mismatch: meta.municipality must equal meta.municipality_name");
  }

  compareSourceRegisters(sources, meta, errors);

  if (meta.sourceRegisterFile != null && meta.sourceRegisterFile !== `${slug}.sources.json`) {
    errors.push(`meta.sourceRegisterFile mismatch: expected "${slug}.sources.json"`);
  }
  if (meta.sourceCount != null && meta.sourceCount !== (sources.sources || []).length) {
    errors.push(`meta.sourceCount mismatch: expected ${(sources.sources || []).length}`);
  }

  const sourceMap = new Map((sources.sources || []).map((entry) => [entry.key, entry]));
  const allKnownUrls = new Set((sources.sources || []).map((entry) => entry.url));
  const coverage = { service: 0, benefit: 0, resource: 0, contact: 0, form: 0 };
  const kovSlug = toItemIdSlug(slug);

  (dataset.items || []).forEach((item, index) => {
    const label = `dataset.items[${index}]`;
    coverage[item.itemType] = (coverage[item.itemType] || 0) + 1;
    const expectedUrls = uniqueSorted(
      (item.sourceKeys || [])
        .map((key) => sourceMap.get(key)?.url)
        .filter(Boolean)
    );
    const actualUrls = uniqueSorted((item.sourceUrls || []).filter(Boolean));

    for (const key of item.sourceKeys || []) {
      if (!sourceMap.has(key)) errors.push(`${label}: sourceKey "${key}" not found in sources.json`);
    }
    for (const url of item.sourceUrls || []) {
      if (!allKnownUrls.has(url)) errors.push(`${label}: sourceUrl "${url}" not found in sources.json`);
    }
    if (Array.isArray(item.sourceUrls) && item.sourceUrls.length && !compareSets(expectedUrls, actualUrls)) {
      errors.push(`${label}: sourceUrls must exactly match URLs derived from sourceKeys`);
    }

    if (item.id && !item.id.startsWith(`${kovSlug}_`)) {
      errors.push(`${label}: item id must start with "${kovSlug}_"`);
    }
  });

  const coverageFieldMap = {
    services: "service",
    benefits: "benefit",
    resources: "resource",
    contacts: "contact",
    forms: "form"
  };
  for (const [metaKey, itemType] of Object.entries(coverageFieldMap)) {
    if (meta.coverage && metaKey in meta.coverage && meta.coverage[metaKey] !== coverage[itemType]) {
      errors.push(`meta.coverage.${metaKey} mismatch: expected ${coverage[itemType]}`);
    }
  }
}

function parseArgs(argv) {
  const positional = [];
  let slug = "";
  let allowMissingRagMd = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index] || "");
    if (!arg) continue;
    if (arg === "--help" || arg === "-h") {
      console.log(HELP_TEXT);
      process.exit(0);
    }
    if (arg === "--slug") {
      slug = String(argv[index + 1] || "").trim();
      index += 1;
      continue;
    }
    if (arg === "--allow-missing-rag-md") {
      allowMissingRagMd = true;
      continue;
    }
    positional.push(arg);
  }

  if (!positional.length) {
    console.log(HELP_TEXT);
    process.exit(1);
  }

  return {
    input: positional[0],
    slug,
    allowMissingRagMd
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const paths = await resolveDatasetPaths(args.input, args.slug);
  const errors = [];
  const warnings = [];

  for (const filePath of [paths.sourcesPath, paths.datasetPath, paths.metaPath]) {
    try {
      await fs.access(filePath);
    } catch {
      errors.push(`Missing required file: ${normalizeRel(filePath)}`);
    }
  }

  let ragRaw = null;
  try {
    ragRaw = await readUtf8(paths.ragPath);
  } catch {
    if (args.allowMissingRagMd) {
      warnings.push(`Optional file missing: ${normalizeRel(paths.ragPath)}`);
    } else {
      errors.push(`Missing required file: ${normalizeRel(paths.ragPath)}`);
    }
  }

  if (errors.length) {
    throw new Error(errors.join("\n"));
  }

  const [sources, dataset, meta] = await Promise.all([
    readJson(paths.sourcesPath),
    readJson(paths.datasetPath),
    readJson(paths.metaPath)
  ]);

  scanForEmptyStrings(sources, "sources", errors);
  scanForEmptyStrings(dataset, "dataset", errors);
  scanForEmptyStrings(meta, "meta", errors);

  validateSourcesJson(sources, errors, warnings);
  validateDatasetJson(dataset, paths.slug, errors);
  validateMetaJson(meta, errors);
  if (ragRaw != null) validateRagMarkdown(ragRaw, paths.slug, errors);
  validateCrossFileConsistency({ sources, dataset, meta, slug: paths.slug }, errors);

  if (errors.length) {
    console.error(`[rag:validate:kov] Validation failed for "${paths.slug}"`);
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  console.log(`[rag:validate:kov] OK: ${paths.slug}`);
  console.log(`  - ${normalizeRel(paths.sourcesPath)}`);
  console.log(`  - ${normalizeRel(paths.datasetPath)}`);
  console.log(`  - ${normalizeRel(paths.metaPath)}`);
  if (ragRaw != null) console.log(`  - ${normalizeRel(paths.ragPath)}`);

  if (warnings.length) {
    console.log("[rag:validate:kov] Warnings:");
    for (const warning of warnings) {
      console.log(`  - ${warning}`);
    }
  }
}

main().catch((error) => {
  console.error("[rag:validate:kov] Failed:", error.message);
  process.exit(1);
});
