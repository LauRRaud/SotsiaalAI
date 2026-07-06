import { prisma } from "@/lib/prisma";
import { buildRagHeaders, ragServiceRequest } from "@/lib/documents/ragService";
import { readStoredOrganizationFile } from "./storage";
import { validateOrganizationFileContent } from "./validation";

import { findOrganizationSeedEntry, listOrganizationSeedEntries } from "./seed";
import {
  buildOrganizationRagDocId,
  buildOrganizationRagPayloadPreview,
  normalizeOrganizationSourcesPayload,
  summarizeOrganizationDocuments,
  validateOrganizationPackagePayload
} from "./package";
import {
  ORGANIZATION_CORE_FILE_KEYS,
  ORGANIZATION_FILE_ROLE_META,
  resolveOrganizationFileKeyFromDbRole
} from "./shared";

const ORGANIZATION_TYPE_VALUES = Object.freeze([
  "ASSOCIATION",
  "FOUNDATION",
  "SERVICE_PROVIDER",
  "PARTNER",
  "THEMATIC_SITE",
  "PUBLIC_BODY"
]);

const ORGANIZATION_READINESS_VALUES = Object.freeze(["PLANNED", "REVIEW", "READY"]);
const ORGANIZATION_INGEST_STATUS_VALUES = Object.freeze(["NOT_INGESTED", "READY", "INGESTING", "INGESTED", "ERROR"]);

function ensureIngestStatus(value, fallback = "NOT_INGESTED") {
  const normalized = String(value || "").trim().toUpperCase();
  return ORGANIZATION_INGEST_STATUS_VALUES.includes(normalized) ? normalized : fallback;
}

function normalizeIngestErrorMessage(error) {
  const payloadMessage = error?.payload?.message || error?.payload?.detail || error?.payload?.error;
  return String(payloadMessage || error?.message || "Organization ingest failed")
    .trim()
    .slice(0, 1000);
}

function stableUniqueStrings(values = []) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function rowNotesToSingleLine(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function shouldSeedOrganizationAdminExamples() {
  return String(process.env.RAG_ORGANIZATION_SEED_EXAMPLES || "").trim().toLowerCase() === "true";
}

function isLikelySeedPlaceholder(row) {
  const seed = findOrganizationSeedEntry(row?.slug);
  if (!seed) return false;
  const files = Array.isArray(row?.files) ? row.files : [];
  if (files.length > 0 || Number(row?.fileCount || 0) > 0) return false;
  if (row?.lastIngestedAt || row?.lastIngestError) return false;
  if (ensureIngestStatus(row?.ingestStatus) !== "NOT_INGESTED") return false;
  return row?.displayName === seed.displayName
    && row?.type === ensureType(seed.type, "PARTNER")
    && String(row?.focus || "") === String(seed.focus || "")
    && String(row?.officialWebsite || "") === String(seed.officialWebsite || "");
}

function buildMissingCoreFileState(key) {
  const meta = ORGANIZATION_FILE_ROLE_META[key];
  return {
    key,
    id: null,
    role: meta.dbRole,
    paramRole: meta.paramRole,
    label: meta.label,
    originalName: null,
    mime: null,
    size: null,
    uploadedAt: null,
    downloadUrl: null,
    status: "missing",
    validationStatus: "MISSING",
    validationMessage: "",
    validatedAt: null
  };
}

function computePackageSummary(coreFiles, crawlReadiness) {
  const presentKeys = ORGANIZATION_CORE_FILE_KEYS.filter(key => coreFiles[key]?.status !== "missing");
  const missingKeys = ORGANIZATION_CORE_FILE_KEYS.filter(key => coreFiles[key]?.status === "missing");
  const validKeys = ORGANIZATION_CORE_FILE_KEYS.filter(key => coreFiles[key]?.validationStatus === "VALID");
  const invalidKeys = ORGANIZATION_CORE_FILE_KEYS.filter(key => coreFiles[key]?.validationStatus === "INVALID");
  const crawlReady = ensureReadiness(crawlReadiness) === "READY";

  let state = "INCOMPLETE";
  if (invalidKeys.length) state = "INVALID";
  else if (validKeys.length === ORGANIZATION_CORE_FILE_KEYS.length && crawlReady) state = "READY";
  else if (validKeys.length === ORGANIZATION_CORE_FILE_KEYS.length) state = "FILES_READY";
  else if (presentKeys.length > 0) state = "PARTIAL";

  return {
    state,
    presentCount: presentKeys.length,
    totalCount: ORGANIZATION_CORE_FILE_KEYS.length,
    missingCount: missingKeys.length,
    validCount: validKeys.length,
    invalidCount: invalidKeys.length,
    presentKeys,
    missingKeys,
    validKeys,
    invalidKeys,
    canAdvance: state === "READY"
  };
}

function computeIngestSummary(row, coreFiles) {
  const packageSummary = computePackageSummary(coreFiles, row?.crawlReadiness);
  const blockingIssues = [];

  if (packageSummary.missingKeys.length) {
    blockingIssues.push(`Missing required files: ${packageSummary.missingKeys.join(", ")}`);
  }
  if (packageSummary.invalidKeys.length) {
    blockingIssues.push(`Invalid files: ${packageSummary.invalidKeys.join(", ")}`);
  }
  if (ensureReadiness(row?.crawlReadiness) !== "READY") {
    blockingIssues.push("Organization is not marked ready");
  }

  return {
    ...packageSummary,
    canIngest: blockingIssues.length === 0,
    blockingIssues
  };
}

function normalizeString(value, max = 240) {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function normalizeNotes(value) {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed.slice(0, 8000) : null;
}

function normalizeUrl(value) {
  const normalized = normalizeString(value, 1000);
  return normalized || null;
}

function ensureType(value, fallback = "PARTNER") {
  const normalized = String(value || "").trim().toUpperCase();
  return ORGANIZATION_TYPE_VALUES.includes(normalized) ? normalized : fallback;
}

function ensureReadiness(value, fallback = "PLANNED") {
  const normalized = String(value || "").trim().toUpperCase();
  return ORGANIZATION_READINESS_VALUES.includes(normalized) ? normalized : fallback;
}

function normalizeBoolean(value, fallback = true) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

export function serializeOrganizationAdmin(row) {
  const rawFiles = Array.isArray(row.files)
    ? row.files
        .slice()
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
        .map(file => {
          const key = resolveOrganizationFileKeyFromDbRole(file.role) || "attachment";
          return {
            id: file.id,
            key,
            role: file.role,
            paramRole: ORGANIZATION_FILE_ROLE_META[key]?.paramRole || "attachment",
            label: ORGANIZATION_FILE_ROLE_META[key]?.label || "attachment",
            originalName: file.originalName,
            mime: file.mime,
            size: file.size,
            uploadedAt: file.updatedAt?.toISOString?.() || file.createdAt?.toISOString?.() || null,
            downloadUrl: `/api/admin/rag/organizations/${encodeURIComponent(row.slug)}/files/${encodeURIComponent(file.id)}/download`,
            status: "uploaded",
            validationStatus: file.validationStatus || "INVALID",
            validationMessage: file.validationMessage || "",
            validatedAt: file.validatedAt?.toISOString?.() || null
          };
        })
    : [];

  const coreFiles = Object.fromEntries(ORGANIZATION_CORE_FILE_KEYS.map(key => [key, buildMissingCoreFileState(key)]));
  const attachments = [];

  for (const file of rawFiles) {
    if (ORGANIZATION_CORE_FILE_KEYS.includes(file.key)) coreFiles[file.key] = file;
    else attachments.push(file);
  }

  const packageSummary = computePackageSummary(coreFiles, row.crawlReadiness);
  const ingestSummary = computeIngestSummary(row, coreFiles);
  const currentIngestStatus = ensureIngestStatus(row.ingestStatus);
  const ingestStatus =
    currentIngestStatus === "INGESTING"
      ? "INGESTING"
      : currentIngestStatus === "INGESTED"
        ? "INGESTED"
        : currentIngestStatus === "ERROR"
          ? "ERROR"
          : ingestSummary.canIngest
            ? "READY"
            : "NOT_INGESTED";

  return {
    slug: row.slug,
    displayName: row.displayName,
    type: row.type,
    focus: row.focus || "",
    county: row.county || "",
    isActive: row.isActive === true,
    officialWebsite: row.officialWebsite || "",
    contactEmail: row.contactEmail || "",
    contactPhone: row.contactPhone || "",
    notes: row.notes || "",
    fileCount: Number.isFinite(row.fileCount) ? row.fileCount : rawFiles.length,
    files: attachments,
    coreFiles,
    packageSummary,
    crawlReadiness: ensureReadiness(row.crawlReadiness),
    ingestSummary,
    ingestStatus,
    lastIngestedAt: row.lastIngestedAt?.toISOString?.() || null,
    lastIngestError: row.lastIngestError || "",
    ragDocId: row.ragDocId || buildOrganizationRagDocId(row.slug),
    isSeedPlaceholder: isLikelySeedPlaceholder(row),
    packageValidation: null,
    packageDocuments: null,
    createdAt: row.createdAt?.toISOString?.() || null,
    updatedAt: row.updatedAt?.toISOString?.() || null
  };
}

async function tryReadOrganizationCorePackage(row) {
  const filesByRole = new Map((Array.isArray(row?.files) ? row.files : []).map(file => [file.role, file]));
  const sourcesFile = filesByRole.get(ORGANIZATION_FILE_ROLE_META.sourcesJson.dbRole);
  const dataFile = filesByRole.get(ORGANIZATION_FILE_ROLE_META.dataJson.dbRole);
  const metaFile = filesByRole.get(ORGANIZATION_FILE_ROLE_META.metaJson.dbRole);
  const ragFile = filesByRole.get(ORGANIZATION_FILE_ROLE_META.ragMd.dbRole);
  if (!sourcesFile || !dataFile || !metaFile || !ragFile) return null;

  try {
    const [sourcesText, dataText, metaText, ragText] = await Promise.all([
      readStoredOrganizationFile(sourcesFile.storagePath).then(buffer => buffer.toString("utf8")),
      readStoredOrganizationFile(dataFile.storagePath).then(buffer => buffer.toString("utf8")),
      readStoredOrganizationFile(metaFile.storagePath).then(buffer => buffer.toString("utf8")),
      readStoredOrganizationFile(ragFile.storagePath).then(buffer => buffer.toString("utf8"))
    ]);
    return {
      sourcesPayload: JSON.parse(sourcesText),
      dataPayload: JSON.parse(dataText),
      metaPayload: JSON.parse(metaText),
      ragText,
      fileNames: {
        sourcesJson: sourcesFile.originalName,
        dataJson: dataFile.originalName,
        metaJson: metaFile.originalName,
        ragMd: ragFile.originalName
      }
    };
  } catch {
    return null;
  }
}

export async function serializeOrganizationAdminWithPackage(row) {
  const serialized = serializeOrganizationAdmin(row);
  const corePackage = await tryReadOrganizationCorePackage(row);
  if (!corePackage) return serialized;

  const validation = validateOrganizationPackagePayload({
    slug: row.slug,
    ...corePackage
  });
  const nextIngestSummary = {
    ...serialized.ingestSummary,
    canIngest: serialized.ingestSummary?.canIngest === true && validation.ok && validation.ingest_ready === true,
    blockingIssues: [
      ...(serialized.ingestSummary?.blockingIssues || []),
      ...(validation.ok ? [] : validation.errors)
    ]
  };
  const nextPackageSummary = {
    ...serialized.packageSummary,
    state: validation.ok ? serialized.packageSummary?.state : "INVALID",
    canAdvance: serialized.packageSummary?.canAdvance === true && validation.ok
  };
  const nextIngestStatus =
    serialized.ingestStatus === "INGESTED" || serialized.ingestStatus === "INGESTING" || serialized.ingestStatus === "ERROR"
      ? serialized.ingestStatus
      : nextIngestSummary.canIngest
        ? "READY"
        : "NOT_INGESTED";

  return {
    ...serialized,
    packageSummary: nextPackageSummary,
    ingestSummary: nextIngestSummary,
    ingestStatus: nextIngestStatus,
    packageValidation: validation,
    packageDocuments: validation.documents_summary
  };
}

async function ensureOrganizationAdminSeeded() {
  if (!shouldSeedOrganizationAdminExamples()) return prisma.organizationAdmin.count();

  const seeds = listOrganizationSeedEntries();
  if (!seeds.length) return 0;

  const existing = await prisma.organizationAdmin.findMany({
    select: { slug: true }
  });

  const existingSlugs = new Set(existing.map(item => item.slug));
  const missing = seeds.filter(item => !existingSlugs.has(item.slug));

  if (missing.length) {
    await prisma.organizationAdmin.createMany({
      data: missing.map(item => ({
        slug: item.slug,
        displayName: item.displayName,
        type: ensureType(item.type, "PARTNER"),
        focus: normalizeString(item.focus, 240),
        county: normalizeString(item.county, 160),
        isActive: item.isActive !== false,
        officialWebsite: normalizeUrl(item.officialWebsite),
        contactEmail: normalizeString(item.contactEmail, 240),
        contactPhone: normalizeString(item.contactPhone, 120),
        notes: normalizeNotes(item.notes),
        fileCount: Number.isFinite(item.fileCount) ? item.fileCount : 0,
        crawlReadiness: ensureReadiness(item.crawlReadiness, "PLANNED")
      })),
      skipDuplicates: true
    });
  }

  return prisma.organizationAdmin.count();
}

export async function listOrganizationAdminEntries() {
  if (shouldSeedOrganizationAdminExamples()) await ensureOrganizationAdminSeeded();
  const rows = await prisma.organizationAdmin.findMany({
    include: {
      files: true
    },
    orderBy: [{ displayName: "asc" }]
  });
  return Promise.all(rows.map(serializeOrganizationAdminWithPackage));
}

export async function getOrganizationAdminEntryBySlug(slug) {
  if (shouldSeedOrganizationAdminExamples()) await ensureOrganizationAdminSeeded();
  const normalizedSlug = String(slug || "").trim().toLowerCase();
  if (!normalizedSlug) return null;

  return prisma.organizationAdmin.findUnique({
    where: { slug: normalizedSlug },
    include: {
      files: true
    }
  });
}

export async function updateOrganizationAdminEntryBySlug(slug, input = {}) {
  const existing = await getOrganizationAdminEntryBySlug(slug);
  if (!existing) return null;

  const data = {};

  if (Object.prototype.hasOwnProperty.call(input, "displayName")) {
    data.displayName = normalizeString(input.displayName, 240) || existing.displayName;
  }
  if (Object.prototype.hasOwnProperty.call(input, "type")) {
    data.type = ensureType(input.type, existing.type);
  }
  if (Object.prototype.hasOwnProperty.call(input, "focus")) {
    data.focus = normalizeString(input.focus, 240);
  }
  if (Object.prototype.hasOwnProperty.call(input, "county")) {
    data.county = normalizeString(input.county, 160);
  }
  if (Object.prototype.hasOwnProperty.call(input, "isActive")) {
    data.isActive = normalizeBoolean(input.isActive, existing.isActive);
  }
  if (Object.prototype.hasOwnProperty.call(input, "officialWebsite")) {
    data.officialWebsite = normalizeUrl(input.officialWebsite);
  }
  if (Object.prototype.hasOwnProperty.call(input, "contactEmail")) {
    data.contactEmail = normalizeString(input.contactEmail, 240);
  }
  if (Object.prototype.hasOwnProperty.call(input, "contactPhone")) {
    data.contactPhone = normalizeString(input.contactPhone, 120);
  }
  if (Object.prototype.hasOwnProperty.call(input, "notes")) {
    data.notes = normalizeNotes(input.notes);
  }
  if (Object.prototype.hasOwnProperty.call(input, "crawlReadiness")) {
    data.crawlReadiness = ensureReadiness(input.crawlReadiness, existing.crawlReadiness);
  }

  const updated = Object.keys(data).length
    ? await prisma.organizationAdmin.update({
        where: { slug: existing.slug },
        data,
        include: {
          files: true
        }
      })
    : existing;

  const serialized = serializeOrganizationAdmin(updated);
  const nextStatus =
    ensureIngestStatus(updated.ingestStatus) === "INGESTING"
      ? "INGESTING"
      : serialized.ingestSummary.canIngest
        ? "READY"
        : "NOT_INGESTED";

  if (
    ensureIngestStatus(updated.ingestStatus) !== nextStatus
    || (nextStatus !== "ERROR" && updated.lastIngestError)
  ) {
    const synced = await prisma.organizationAdmin.update({
      where: { slug: existing.slug },
      data: {
        ingestStatus: nextStatus,
        lastIngestError: nextStatus === "ERROR" ? updated.lastIngestError : null
      },
      include: {
        files: true
      }
    });
    return serializeOrganizationAdminWithPackage(synced);
  }

  return serializeOrganizationAdminWithPackage(updated);
}

export async function syncOrganizationFileCountById(organizationId) {
  const count = await prisma.organizationAdminFile.count({
    where: { organizationId }
  });

  await prisma.organizationAdmin.update({
    where: { id: organizationId },
    data: { fileCount: count }
  });

  return count;
}

export async function syncOrganizationIngestStatusById(organizationId) {
  const row = await prisma.organizationAdmin.findUnique({
    where: { id: organizationId },
    include: {
      files: true
    }
  });

  if (!row) return null;

  const current = ensureIngestStatus(row.ingestStatus);
  const serialized = serializeOrganizationAdmin(row);
  const nextStatus =
    current === "INGESTING"
      ? "INGESTING"
      : serialized.ingestSummary.canIngest
        ? "READY"
        : "NOT_INGESTED";

  if (current === nextStatus && (!row.lastIngestError || current === "ERROR")) {
    return serializeOrganizationAdminWithPackage(row);
  }

  const updated = await prisma.organizationAdmin.update({
    where: { id: organizationId },
    data: {
      ingestStatus: nextStatus,
      lastIngestError: nextStatus === "ERROR" ? row.lastIngestError : null
    },
    include: {
      files: true
    }
  });

  return serializeOrganizationAdminWithPackage(updated);
}

export async function revalidateOrganizationEntryBySlug(slug) {
  const entry = await getOrganizationAdminEntryBySlug(slug);
  if (!entry) return null;

  for (const file of entry.files) {
    const fileKey = resolveOrganizationFileKeyFromDbRole(file.role) || "attachment";
    try {
      const buffer = await readStoredOrganizationFile(file.storagePath);
      const validation = validateOrganizationFileContent({
        fileKey,
        text: buffer.toString("utf8")
      });

      await prisma.organizationAdminFile.update({
        where: { id: file.id },
        data: {
          validationStatus: validation.validationStatus,
          validationMessage: validation.validationMessage,
          validatedAt: validation.validatedAt
        }
      });
    } catch (error) {
      await prisma.organizationAdminFile.update({
        where: { id: file.id },
        data: {
          validationStatus: "INVALID",
          validationMessage: String(error?.message || "Validation failed").slice(0, 240),
          validatedAt: new Date()
        }
      });
    }
  }

  return syncOrganizationIngestStatusById(entry.id);
}

function getOrganizationCoreFileRecord(entry, fileKey) {
  const roleMeta = ORGANIZATION_FILE_ROLE_META[fileKey];
  if (!roleMeta) return null;
  return Array.isArray(entry?.files) ? entry.files.find(file => file.role === roleMeta.dbRole) || null : null;
}

async function readOrganizationFileText(entry, fileKey) {
  const file = getOrganizationCoreFileRecord(entry, fileKey);
  if (!file?.storagePath) {
    const error = new Error(`${fileKey} file is missing`);
    error.status = 400;
    throw error;
  }

  const buffer = await readStoredOrganizationFile(file.storagePath);
  return buffer.toString("utf8");
}

function parseJsonOrThrow(text, fileName) {
  try {
    return JSON.parse(String(text || ""));
  } catch {
    const error = new Error(`${fileName} is not readable JSON`);
    error.status = 400;
    throw error;
  }
}

function assertOrganizationIngestPreconditions(entry) {
  const serialized = serializeOrganizationAdmin(entry);
  const blockingIssues = [...(serialized.ingestSummary?.blockingIssues || [])];

  if (ensureIngestStatus(entry.ingestStatus) === "INGESTING") {
    blockingIssues.unshift("Organization ingest is already in progress");
  }

  if (blockingIssues.length) {
    const error = new Error(blockingIssues.join(". "));
    error.status = 400;
    error.blockingIssues = blockingIssues;
    throw error;
  }

  return serialized;
}

function buildOrganizationIngestMetadata(entry, metaPayload, sourcesPayload, dataPayload) {
  const sources = normalizeOrganizationSourcesPayload(sourcesPayload);
  const preview = buildOrganizationRagPayloadPreview({
    slug: entry.slug,
    metaPayload,
    sourcesPayload: sources,
    dataPayload
  });
  const sourceKeys = stableUniqueStrings(preview.sourceKeys);
  const sourceUrls = stableUniqueStrings(sources.map(source => source?.url));
  const officialWebsite = entry.officialWebsite || sourceUrls[0] || null;
  const notes = stableUniqueStrings([
    rowNotesToSingleLine(entry.notes),
    ...(Array.isArray(metaPayload?.notes) ? metaPayload.notes : [])
  ]);
  const unresolvedIssues = stableUniqueStrings(Array.isArray(metaPayload?.unresolvedIssues) ? metaPayload.unresolvedIssues : []);
  const coverage =
    metaPayload?.coverage && typeof metaPayload.coverage === "object" && !Array.isArray(metaPayload.coverage)
      ? metaPayload.coverage
      : null;

  return {
    ...preview,
    doc_id: preview.docId,
    docId: preview.docId,
    title: preview.title || `${entry.displayName} teenused ja ressursid`,
    country: dataPayload.country || metaPayload.country || "EE",
    jurisdiction_level: dataPayload.jurisdiction_level || metaPayload.jurisdiction_level || "ORGANIZATION",
    organization_slug: preview.slug,
    county: entry.county || null,
    official_website: officialWebsite,
    officialWebsite,
    source_url: officialWebsite,
    sourceUrl: officialWebsite,
    url_canonical: officialWebsite,
    urlCanonical: officialWebsite,
    url: officialWebsite,
    contact_email: entry.contactEmail || null,
    contact_phone: entry.contactPhone || null,
    checked_at: preview.checked_at || metaPayload?.checkedAt || null,
    status: metaPayload?.status || dataPayload?.status || null,
    coverage,
    notes,
    unresolved_issues: unresolvedIssues,
    source_urls: sourceUrls,
    source_keys: sourceKeys,
    sourceKeys,
    item_count: collectOrganizationItemCount(dataPayload),
    documents_summary: summarizeOrganizationDocuments(dataPayload),
    legal_basis: false
  };
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

export async function ingestOrganizationEntryBySlug(slug) {
  const entry = await getOrganizationAdminEntryBySlug(slug);
  if (!entry) return null;

  assertOrganizationIngestPreconditions(entry);
  const ragDocId = buildOrganizationRagDocId(entry.slug);

  try {
    const ragText = String(await readOrganizationFileText(entry, "ragMd")).trim();
    const metaPayload = parseJsonOrThrow(await readOrganizationFileText(entry, "metaJson"), `${entry.slug}.meta.json`);
    const sourcesPayload = parseJsonOrThrow(await readOrganizationFileText(entry, "sourcesJson"), `${entry.slug}.sources.json`);
    const dataPayload = parseJsonOrThrow(await readOrganizationFileText(entry, "dataJson"), `${entry.slug}.json`);
    const packageValidation = validateOrganizationPackagePayload({
      slug: entry.slug,
      fileNames: {
        sourcesJson: getOrganizationCoreFileRecord(entry, "sourcesJson")?.originalName,
        dataJson: getOrganizationCoreFileRecord(entry, "dataJson")?.originalName,
        metaJson: getOrganizationCoreFileRecord(entry, "metaJson")?.originalName,
        ragMd: getOrganizationCoreFileRecord(entry, "ragMd")?.originalName
      },
      metaPayload,
      sourcesPayload,
      dataPayload,
      ragText
    });
    if (!packageValidation.ok) {
      const error = new Error(packageValidation.errors.join(". "));
      error.status = 400;
      throw error;
    }

    if (!ragText) {
      const error = new Error("rag.md is empty");
      error.status = 400;
      throw error;
    }

    await prisma.organizationAdmin.update({
      where: { id: entry.id },
      data: {
        ingestStatus: "INGESTING",
        lastIngestError: null,
        ragDocId
      }
    });

    await ragServiceRequest(
      "/ingest/text",
      {
        method: "POST",
        headers: buildRagHeaders("application/json", {
          route: "admin/rag/organizations",
          stage: "organization_manual_ingest"
        }),
        body: JSON.stringify({
          doc_id: ragDocId,
          text: ragText,
          metadata: buildOrganizationIngestMetadata(entry, metaPayload, sourcesPayload, dataPayload)
        })
      },
      "api.admin.organizations.ingest_failed"
    );

    const updated = await prisma.organizationAdmin.update({
      where: { id: entry.id },
      data: {
        ingestStatus: "INGESTED",
        lastIngestedAt: new Date(),
        lastIngestError: null,
        ragDocId
      },
      include: {
        files: true
      }
    });

    return serializeOrganizationAdmin(updated);
  } catch (error) {
    await prisma.organizationAdmin.update({
      where: { id: entry.id },
      data: {
        ingestStatus: "ERROR",
        lastIngestError: normalizeIngestErrorMessage(error),
        ragDocId
      }
    });
    throw error;
  }
}

export async function ingestOrganizationEntriesBySlugs(slugs = []) {
  const normalized = [...new Set((Array.isArray(slugs) ? slugs : []).map(slug => String(slug || "").trim().toLowerCase()).filter(Boolean))];
  const items = [];

  for (const slug of normalized) {
    const item = await ingestOrganizationEntryBySlug(slug);
    if (item) items.push(item);
  }

  return items;
}
