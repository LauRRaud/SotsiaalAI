import crypto from "crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { loadMunicipalitySeedEntries } from "@/lib/help/municipalityData";
import { buildRagHeaders, ragServiceRequest } from "@/lib/documents/ragService";
import { prisma } from "@/lib/prisma";

import { readStoredKovFile } from "./storage";
import {
  KOV_ADMIN_STATUS_VALUES,
  KOV_DB_ROLE_TO_KEY,
  KOV_FILE_KEYS,
  KOV_FILE_ROLE_META,
  KOV_INGEST_STATUS_VALUES,
  KOV_RT_FILE_KEYS,
  KOV_RT_STATUS_VALUES,
  KOV_WEB_FILE_KEYS,
  resolveKovFileKeyFromDbRole
} from "./shared";
import { buildKovRtXmlIngestPayload } from "./rtXml";
import { executeKovRagWebLayerCleanupBySlug } from "./resetState";
import { auditKovRtManifestEntry, findKovRtManifestEntry, readKovRtManifest } from "./rtManifest";
import { validateKovFileContent } from "./validation";

function normalizeUrl(value) {
  const trimmed = String(value || "").trim();
  return trimmed || null;
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeNotes(value) {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed.slice(0, 8000) : null;
}

function normalizeCheckedAt(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ensureStatus(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return KOV_ADMIN_STATUS_VALUES.includes(normalized) ? normalized : "NOT_STARTED";
}

function ensureIngestStatus(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return KOV_INGEST_STATUS_VALUES.includes(normalized) ? normalized : "NOT_INGESTED";
}

function ensureRtStatus(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return KOV_RT_STATUS_VALUES.includes(normalized) ? normalized : "NOT_STARTED";
}

function ensureAutoCheckStatus(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return [
    "IDLE",
    "DUE",
    "CHECKING",
    "CHANGES_DETECTED",
    "NO_CHANGES",
    "ERROR"
  ].includes(normalized)
    ? normalized
    : "IDLE";
}

function buildUtcScheduleDate(year, monthIndex, dayOfMonth) {
  return new Date(Date.UTC(year, monthIndex, dayOfMonth, 9, 0, 0));
}

function getDefaultReviewSchedule(referenceDate = new Date()) {
  const year = referenceDate.getUTCFullYear();
  const januaryFullReview = buildUtcScheduleDate(year, 0, 31);
  const julyLightCheck = buildUtcScheduleDate(year, 6, 31);

  return {
    reviewCadence: "ANNUAL_JAN_PLUS_JULY_CHECK",
    nextFullReviewAt: referenceDate.getTime() <= januaryFullReview.getTime()
      ? januaryFullReview
      : buildUtcScheduleDate(year + 1, 0, 31),
    nextLightCheckAt: referenceDate.getTime() <= julyLightCheck.getTime()
      ? julyLightCheck
      : buildUtcScheduleDate(year + 1, 6, 31)
  };
}

function buildReviewSchedule(row) {
  const defaults = getDefaultReviewSchedule();
  const now = Date.now();
  const nextFullReviewAt = row?.nextFullReviewAt || defaults.nextFullReviewAt;
  const nextLightCheckAt = row?.nextLightCheckAt || defaults.nextLightCheckAt;
  const autoCheckStatus = ensureAutoCheckStatus(row?.autoCheckStatus);
  const fullReviewDue = nextFullReviewAt ? new Date(nextFullReviewAt).getTime() <= now : false;
  const lightCheckDue = nextLightCheckAt ? new Date(nextLightCheckAt).getTime() <= now : false;

  let state = "ON_TRACK";
  if (autoCheckStatus === "CHANGES_DETECTED") state = "CHANGES_DETECTED";
  else if (autoCheckStatus === "ERROR") state = "ERROR";
  else if (autoCheckStatus === "CHECKING") state = "CHECKING";
  else if (fullReviewDue) state = "FULL_REVIEW_DUE";
  else if (lightCheckDue || autoCheckStatus === "DUE") state = "LIGHT_CHECK_DUE";
  else if (autoCheckStatus === "NO_CHANGES") state = "NO_CHANGES";

  return {
    reviewCadence: String(row?.reviewCadence || defaults.reviewCadence),
    autoCheckStatus,
    lastFullReviewAt: row?.lastFullReviewAt || null,
    nextFullReviewAt,
    lastLightCheckAt: row?.lastLightCheckAt || null,
    nextLightCheckAt,
    lastChangeDetectedAt: row?.lastChangeDetectedAt || null,
    fullReviewDue,
    lightCheckDue,
    state
  };
}

function buildRtReviewSchedule(row) {
  const defaults = getDefaultReviewSchedule();
  const now = Date.now();
  const nextLightCheckAt = row?.rtNextLightCheckAt || defaults.nextLightCheckAt;
  const autoCheckStatus = ensureAutoCheckStatus(row?.rtAutoCheckStatus);
  const lightCheckDue = nextLightCheckAt ? new Date(nextLightCheckAt).getTime() <= now : false;

  let state = "ON_TRACK";
  if (autoCheckStatus === "CHANGES_DETECTED") state = "CHANGES_DETECTED";
  else if (autoCheckStatus === "ERROR") state = "ERROR";
  else if (autoCheckStatus === "CHECKING") state = "CHECKING";
  else if (lightCheckDue || autoCheckStatus === "DUE") state = "LIGHT_CHECK_DUE";
  else if (autoCheckStatus === "NO_CHANGES") state = "NO_CHANGES";

  return {
    autoCheckStatus,
    lastLightCheckAt: row?.rtLastLightCheckAt || null,
    nextLightCheckAt,
    lastChangeDetectedAt: row?.rtLastChangeDetectedAt || null,
    state
  };
}

function summarizeLightCheckResult(summary) {
  const normalized = summary && typeof summary === "object" ? summary : {};
  return {
    mode: typeof normalized.mode === "string" ? normalized.mode : null,
    checkedSourceCount: Number(normalized.checkedSourceCount || 0),
    reachableSourceCount: Number(normalized.reachableSourceCount || 0),
    changedSourceCount: Number(normalized.changedSourceCount || 0),
    newSourceCount: Number(normalized.newSourceCount || 0),
    removedSourceCount: Number(normalized.removedSourceCount || 0),
    errorCount: Number(normalized.errorCount || 0),
    checkedAt: normalized.checkedAt || null,
    changedSources: Array.isArray(normalized.changedSources) ? normalized.changedSources.slice(0, 20) : [],
    removedSources: Array.isArray(normalized.removedSources) ? normalized.removedSources.slice(0, 20) : [],
    errorSources: Array.isArray(normalized.errorSources) ? normalized.errorSources.slice(0, 20) : []
  };
}

function buildSourceSnapshotKey(source = {}) {
  const key = String(source?.key || "").trim();
  const url = String(source?.url || "").trim();
  return key || url;
}

async function fetchSourceSnapshot(source = {}) {
  const url = String(source?.url || "").trim();
  const key = String(source?.key || "").trim();
  const title = String(source?.title || "").trim();
  const type = String(source?.type || "").trim();
  const checkedAt = new Date().toISOString();

  if (!url) {
    return {
      key,
      title,
      type,
      url,
      checkedAt,
      ok: false,
      statusCode: null,
      contentType: null,
      size: 0,
      sha256: null,
      error: "Source URL is missing"
    };
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
      headers: {
        "User-Agent": "SotsiaalAI-KOV-LightCheck/1.0"
      }
    });

    const buffer = Buffer.from(await response.arrayBuffer());

    return {
      key,
      title,
      type,
      url,
      checkedAt,
      ok: response.ok,
      statusCode: response.status,
      contentType: response.headers.get("content-type") || null,
      size: buffer.length,
      sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
      error: response.ok ? null : `HTTP ${response.status}`
    };
  } catch (error) {
    return {
      key,
      title,
      type,
      url,
      checkedAt,
      ok: false,
      statusCode: null,
      contentType: null,
      size: 0,
      sha256: null,
      error: String(error?.message || "Source fetch failed").slice(0, 300)
    };
  }
}

function invalidValidation(message) {
  return {
    validationStatus: "INVALID",
    validationMessage: String(message || "Validation failed").slice(0, 240),
    validatedAt: new Date()
  };
}

function mimeForKovFileKey(fileKey) {
  if (fileKey === "ragMd") return "text/markdown";
  if (fileKey === "rtXml") return "application/xml";
  return "application/json";
}

function fileNameForKovKey(slug, fileKey) {
  return String(KOV_FILE_ROLE_META[fileKey]?.fileNamePattern || "").replace("{slug}", String(slug || "").trim());
}

function buildVirtualKovFileRecord({
  entry,
  fileKey,
  originalName,
  size,
  uploadedAt,
  validationStatus,
  validationMessage,
  validatedAt
}) {
  return {
    role: KOV_FILE_ROLE_META[fileKey].dbRole,
    originalName,
    mime: mimeForKovFileKey(fileKey),
    size,
    version: 1,
    createdAt: uploadedAt,
    updatedAt: uploadedAt,
    validationStatus,
    validationMessage,
    validatedAt,
    storagePath: null,
    storageKind: "repository",
    municipalityKovAdminId: entry.id
  };
}

async function readRepositoryKovFileFallback(entry, fileKey) {
  const slug = String(entry?.municipality?.slug || entry?.slug || "").trim();
  const displayName = String(entry?.municipality?.displayName || entry?.displayName || "").trim();
  if (!slug || !fileKey) return null;

  if (fileKey === "rtXml") {
    const fallbackFileName = fileNameForKovKey(slug, fileKey);
    const fallbackPath = path.resolve(process.cwd(), "KOV", slug, fallbackFileName);
    try {
      const [buffer, stats] = await Promise.all([fs.readFile(fallbackPath), fs.stat(fallbackPath)]);
      const validation = validateKovFileContent({
        fileKey,
        text: buffer.toString("utf8"),
        slug,
        displayName
      });
      return {
        text: buffer.toString("utf8"),
        file: buildVirtualKovFileRecord({
          entry,
          fileKey,
          originalName: fallbackFileName,
          size: buffer.byteLength,
          uploadedAt: stats.mtime,
          validationStatus: validation.validationStatus,
          validationMessage: validation.validationMessage,
          validatedAt: validation.validatedAt
        })
      };
    } catch {
      // Fall through to RT manifest fallback.
    }

    try {
      const { manifest } = await readKovRtManifest("KOV");
      const manifestEntry = findKovRtManifestEntry(manifest, slug);
      if (!manifestEntry) return null;
      const audit = await auditKovRtManifestEntry("KOV", manifestEntry);
      if (!audit.xml_found || !audit.xml_path) return null;
      const [buffer, stats] = await Promise.all([fs.readFile(audit.xml_path), fs.stat(audit.xml_path)]);
      const contentValidation = validateKovFileContent({
        fileKey,
        text: buffer.toString("utf8"),
        slug,
        displayName
      });
      const validation = audit.generated_metadata_valid
        ? contentValidation
        : invalidValidation(audit.errors?.[0] || "RT manifest metadata is invalid");
      return {
        text: buffer.toString("utf8"),
        file: buildVirtualKovFileRecord({
          entry,
          fileKey,
          originalName: audit.xml_file || path.basename(audit.xml_path),
          size: buffer.byteLength,
          uploadedAt: stats.mtime,
          validationStatus: validation.validationStatus,
          validationMessage: validation.validationMessage,
          validatedAt: validation.validatedAt
        })
      };
    } catch {
      return null;
    }
  }

  const fileName = fileNameForKovKey(slug, fileKey);
  if (!fileName) return null;
  const filePath = path.resolve(process.cwd(), "KOV", slug, fileName);

  try {
    const [buffer, stats] = await Promise.all([fs.readFile(filePath), fs.stat(filePath)]);
    const validation = validateKovFileContent({
      fileKey,
      text: buffer.toString("utf8"),
      slug,
      displayName
    });
    return {
      text: buffer.toString("utf8"),
      file: buildVirtualKovFileRecord({
        entry,
        fileKey,
        originalName: fileName,
        size: buffer.byteLength,
        uploadedAt: stats.mtime,
        validationStatus: validation.validationStatus,
        validationMessage: validation.validationMessage,
        validatedAt: validation.validatedAt
      })
    };
  } catch {
    return null;
  }
}

export async function serializeKovAdminWithRepositoryFallback(row) {
  if (!row) return null;
  const existingRoles = new Set(arrayValue(row.files).map(file => String(file?.role || "").trim()).filter(Boolean));
  const fallbackFiles = [];

  for (const fileKey of KOV_FILE_KEYS) {
    const dbRole = KOV_FILE_ROLE_META[fileKey]?.dbRole;
    if (!dbRole || existingRoles.has(dbRole)) continue;
    const fallback = await readRepositoryKovFileFallback(row, fileKey);
    if (fallback?.file) fallbackFiles.push(fallback.file);
  }

  if (!fallbackFiles.length) return serializeKovAdmin(row);
  return serializeKovAdmin({
    ...row,
    files: [...arrayValue(row.files), ...fallbackFiles]
  });
}

function stableUniqueStrings(values = []) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function normalizeIngestErrorMessage(error) {
  const payloadMessage = error?.payload?.message || error?.payload?.detail || error?.payload?.error;
  const message = String(payloadMessage || error?.message || "RAG ingest failed").trim();
  return message.slice(0, 1000);
}

function getFileRecordByKey(row, fileKey) {
  const roleMeta = KOV_FILE_ROLE_META[fileKey];
  if (!roleMeta) return null;
  return Array.isArray(row?.files)
    ? row.files.find(item => item.role === roleMeta.dbRole) || null
    : null;
}

function computeLayerFileSummary(filesMap, requiredKeys = []) {
  const presentKeys = [];
  const validKeys = [];
  const invalidKeys = [];
  const missingKeys = [];

  for (const key of requiredKeys) {
    const file = filesMap?.[key];
    if (file?.status !== "missing") presentKeys.push(key);
    if (file?.validationStatus === "VALID") validKeys.push(key);
    if (file?.validationStatus === "INVALID") invalidKeys.push(key);
    if (file?.validationStatus === "MISSING") missingKeys.push(key);
  }

  return {
    requiredCount: requiredKeys.length,
    presentCount: presentKeys.length,
    validCount: validKeys.length,
    invalidCount: invalidKeys.length,
    missingCount: missingKeys.length,
    presentKeys,
    validKeys,
    invalidKeys,
    missingKeys,
    allFilesValid: validKeys.length === requiredKeys.length
  };
}

function computeIngestSummary(row, filesMap, options = {}) {
  const base = computeLayerFileSummary(filesMap, KOV_WEB_FILE_KEYS);
  const readyForIngest = "readyForIngest" in options
    ? options.readyForIngest === true
    : row?.readyForIngest === true;

  const blockingIssues = [];
  if (base.missingKeys.length) {
    blockingIssues.push(`Missing required files: ${base.missingKeys.join(", ")}`);
  }
  if (base.invalidKeys.length) {
    blockingIssues.push(`Invalid files: ${base.invalidKeys.join(", ")}`);
  }
  if (readyForIngest !== true) {
    blockingIssues.push("Ready for ingest is not enabled");
  }

  return {
    ...base,
    canIngest: blockingIssues.length === 0,
    blockingIssues
  };
}

function computeRtIngestSummary(row, filesMap, options = {}) {
  const base = computeLayerFileSummary(filesMap, KOV_RT_FILE_KEYS);
  const rtStatus = "rtStatus" in options ? options.rtStatus : row?.rtStatus;
  const blockingIssues = [];

  if (base.missingKeys.length) {
    blockingIssues.push(`Missing RT files: ${base.missingKeys.join(", ")}`);
  }
  if (base.invalidKeys.length) {
    blockingIssues.push(`Invalid RT files: ${base.invalidKeys.join(", ")}`);
  }
  if (ensureRtStatus(rtStatus) !== "READY") {
    blockingIssues.push("RT status is not marked ready");
  }

  return {
    ...base,
    canIngest: blockingIssues.length === 0,
    blockingIssues
  };
}

function computeCombinedLayerReadiness(row, webIngestSummary, rtIngestSummary) {
  const webReady = webIngestSummary?.canIngest === true || ensureIngestStatus(row?.ingestStatus) === "INGESTED";
  const rtReady = rtIngestSummary?.canIngest === true || ensureIngestStatus(row?.rtIngestStatus) === "INGESTED";
  const readyLayerCount = Number(webReady) + Number(rtReady);
  const fullyIngested =
    ensureIngestStatus(row?.ingestStatus) === "INGESTED"
    && ensureIngestStatus(row?.rtIngestStatus) === "INGESTED";

  let state = "NOT_READY";
  if (fullyIngested) state = "BOTH_INGESTED";
  else if (webReady && rtReady) state = "BOTH_READY";
  else if (webReady) state = "WEB_READY";
  else if (rtReady) state = "RT_READY";

  return {
    state,
    webReady,
    rtReady,
    readyLayerCount,
    totalLayers: 2,
    fullyIngested
  };
}

function deriveDefaultIngestStatus(row, filesMap, ingestSummary = null) {
  const current = ensureIngestStatus(row?.ingestStatus);
  if (current === "INGESTING") return current;
  if (current === "INGESTED" || current === "ERROR") return current;
  return (ingestSummary || computeIngestSummary(row, filesMap)).canIngest ? "READY" : "NOT_INGESTED";
}

export function buildKovRagDocId(slug) {
  return `kov-${String(slug || "").trim().toLowerCase()}`;
}

export function buildKovRtRagDocId(slug) {
  return `kov-rt-${String(slug || "").trim().toLowerCase()}`;
}

function cleanKovMetadataString(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeKovMunicipalityId(value) {
  const text = cleanKovMetadataString(value);
  return text ? text.toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_") : null;
}

function deriveKovBundleMetadataFields(entry, metaPayload = {}, sourcesPayload = {}) {
  const municipalitySlug = cleanKovMetadataString(entry?.municipality?.slug);
  const municipalityId =
    normalizeKovMunicipalityId(metaPayload?.municipality_id)
    || normalizeKovMunicipalityId(metaPayload?.municipalityId)
    || normalizeKovMunicipalityId(sourcesPayload?.municipality_id)
    || normalizeKovMunicipalityId(municipalitySlug);
  const municipalityName =
    cleanKovMetadataString(metaPayload?.municipality_name)
    || cleanKovMetadataString(metaPayload?.municipality)
    || cleanKovMetadataString(sourcesPayload?.municipality_name)
    || cleanKovMetadataString(entry?.municipality?.displayName);
  const county =
    cleanKovMetadataString(metaPayload?.county)
    || cleanKovMetadataString(sourcesPayload?.county)
    || cleanKovMetadataString(entry?.municipality?.county);
  const checkedAt =
    cleanKovMetadataString(metaPayload?.checked_at)
    || cleanKovMetadataString(metaPayload?.checkedAt)
    || cleanKovMetadataString(sourcesPayload?.checked_at)
    || cleanKovMetadataString(sourcesPayload?.checkedAt)
    || entry?.checkedAt?.toISOString?.()
    || null;

  return {
    country: cleanKovMetadataString(metaPayload?.country) || cleanKovMetadataString(sourcesPayload?.country) || "EE",
    county,
    jurisdiction_level:
      cleanKovMetadataString(metaPayload?.jurisdiction_level)
      || cleanKovMetadataString(sourcesPayload?.jurisdiction_level)
      || "MUNICIPALITY",
    municipality_id: municipalityId,
    municipality_name: municipalityName,
    municipality_slug: municipalitySlug,
    municipality: municipalityName,
    checked_at: checkedAt,
    last_checked: checkedAt,
    language: cleanKovMetadataString(metaPayload?.language) || cleanKovMetadataString(sourcesPayload?.language) || "et",
    collection_id:
      cleanKovMetadataString(metaPayload?.collection_id)
      || cleanKovMetadataString(sourcesPayload?.collection_id)
      || "kov_services"
  };
}

export async function ensureMunicipalityBaseData() {
  const count = await prisma.municipality.count();
  if (count > 0) return count;

  const entries = await loadMunicipalitySeedEntries();
  if (!entries.length) return 0;

  await prisma.municipality.createMany({
    data: entries.map(entry => ({
      slug: entry.slug,
      baseName: entry.baseName,
      type: entry.type,
      displayName: entry.displayName,
      county: entry.county,
      isActive: entry.isActive !== false
    })),
    skipDuplicates: true
  });

  return prisma.municipality.count();
}

export async function ensureKovAdminSeeded() {
  await ensureMunicipalityBaseData();
  const defaultSchedule = getDefaultReviewSchedule();

  const municipalities = await prisma.municipality.findMany({
    select: { id: true }
  });

  if (!municipalities.length) return 0;

  const existing = await prisma.municipalityKovAdmin.findMany({
    select: { municipalityId: true }
  });

  const existingIds = new Set(existing.map(item => item.municipalityId));
  const missing = municipalities.filter(item => !existingIds.has(item.id));

  if (missing.length) {
    await prisma.municipalityKovAdmin.createMany({
      data: missing.map(item => ({
        municipalityId: item.id,
        status: "NOT_STARTED",
        readyForIngest: false,
        reviewCadence: defaultSchedule.reviewCadence,
        nextFullReviewAt: defaultSchedule.nextFullReviewAt,
        nextLightCheckAt: defaultSchedule.nextLightCheckAt
      })),
      skipDuplicates: true
    });
  }

  await prisma.municipalityKovAdmin.updateMany({
    where: { nextFullReviewAt: null },
    data: { nextFullReviewAt: defaultSchedule.nextFullReviewAt }
  });
  await prisma.municipalityKovAdmin.updateMany({
    where: { nextLightCheckAt: null },
    data: { nextLightCheckAt: defaultSchedule.nextLightCheckAt }
  });

  return municipalities.length;
}

function serializeFile(file, municipalitySlug) {
  const key = KOV_DB_ROLE_TO_KEY[file.role];
  if (!key) return null;
  return {
    key,
    role: file.role,
    originalName: file.originalName,
    mime: file.mime,
    size: file.size,
    version: file.version,
    uploadedAt: file.updatedAt?.toISOString?.() || file.createdAt?.toISOString?.() || null,
    status: file.version > 1 ? "replaced" : "uploaded",
    validationStatus: file.validationStatus || "INVALID",
    validationMessage: file.validationMessage || "",
    validatedAt: file.validatedAt?.toISOString?.() || null,
    storageKind: file.storageKind || (file.storagePath ? "uploaded" : "repository"),
    downloadUrl: file.storagePath
      ? `/api/admin/rag/kov/${encodeURIComponent(municipalitySlug)}/files/${encodeURIComponent(KOV_FILE_ROLE_META[key].paramRole)}/download`
      : null
  };
}

export function serializeKovAdmin(row) {
  const filesMap = Object.fromEntries(
    KOV_FILE_KEYS.map(key => [
      key,
      {
        key,
        role: KOV_FILE_ROLE_META[key].dbRole,
        originalName: null,
        mime: null,
        size: null,
        version: 0,
        uploadedAt: null,
        status: "missing",
        validationStatus: "MISSING",
        validationMessage: "",
        validatedAt: null,
        downloadUrl: null
      }
    ])
  );

  for (const file of row.files || []) {
    const serialized = serializeFile(file, row.municipality.slug);
    if (serialized) {
      filesMap[serialized.key] = serialized;
    }
  }

  const webFiles = Object.fromEntries(KOV_WEB_FILE_KEYS.map(key => [key, filesMap[key]]));
  const rtFiles = Object.fromEntries(KOV_RT_FILE_KEYS.map(key => [key, filesMap[key]]));
  const webFileSummary = computeLayerFileSummary(filesMap, KOV_WEB_FILE_KEYS);
  const rtFileSummary = computeLayerFileSummary(filesMap, KOV_RT_FILE_KEYS);
  const webRepositoryBacked = KOV_WEB_FILE_KEYS.some(key => filesMap[key]?.storageKind === "repository");
  const rtRepositoryBacked = KOV_RT_FILE_KEYS.some(key => filesMap[key]?.storageKind === "repository");
  const repositoryWebReady = webRepositoryBacked && webFileSummary.allFilesValid;
  const repositoryRtReady = rtRepositoryBacked && rtFileSummary.allFilesValid;
  const lastValidatedAt = Object.values(filesMap)
    .map(file => file.validatedAt)
    .filter(Boolean)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] || null;
  const storedReadyForIngest = row.readyForIngest === true;
  const effectiveReadyForIngestFlag = storedReadyForIngest || repositoryWebReady;
  const storedRtStatus = ensureRtStatus(row.rtStatus);
  const effectiveRtStatus = repositoryRtReady && storedRtStatus !== "READY" ? "READY" : storedRtStatus;
  const ingestSummary = computeIngestSummary(row, webFiles, {
    readyForIngest: effectiveReadyForIngestFlag
  });
  const rtIngestSummary = computeRtIngestSummary(row, rtFiles, {
    rtStatus: effectiveRtStatus
  });
  const combinedReadiness = computeCombinedLayerReadiness(row, ingestSummary, rtIngestSummary);
  const storedStatus = ensureStatus(row.status);
  const effectiveReadyForIngest = effectiveReadyForIngestFlag && ingestSummary.canIngest;
  const effectiveStatus = (() => {
    if (storedStatus === "READY_FOR_INGEST" && !effectiveReadyForIngest) return "NEEDS_REVIEW";
    if (repositoryWebReady && ["NOT_STARTED", "DRAFT", "NEEDS_REVIEW"].includes(storedStatus)) return "READY_FOR_INGEST";
    return storedStatus;
  })();
  const reviewSchedule = buildReviewSchedule(row);
  const rtReviewSchedule = buildRtReviewSchedule(row);
  const lightCheckSummary = summarizeLightCheckResult(row.lastLightCheckSummary);
  const rtLightCheckSummary = summarizeLightCheckResult(row.rtLastLightCheckSummary);
  const ingestStatus = deriveDefaultIngestStatus(row, filesMap, ingestSummary);
  const rtIngestStatus = (() => {
    const current = ensureIngestStatus(row.rtIngestStatus);
    if (current === "INGESTING") return current;
    if (current === "INGESTED" || current === "ERROR") return current;
    return rtIngestSummary.canIngest ? "READY" : "NOT_INGESTED";
  })();

  return {
    slug: row.municipality.slug,
    displayName: row.municipality.displayName,
    county: row.municipality.county || "",
    type: row.municipality.type,
    isActive: row.municipality.isActive === true,
    officialWebsite: row.officialWebsite || "",
    riigiTeatajaUrl: row.riigiTeatajaUrl || "",
    status: effectiveStatus,
    checkedAt: row.checkedAt?.toISOString?.() || null,
    lastValidatedAt,
    notes: row.notes || "",
    readyForIngest: effectiveReadyForIngest,
    ingestStatus,
    lastIngestedAt: row.lastIngestedAt?.toISOString?.() || null,
    lastIngestError: row.lastIngestError || "",
    ragDocId: row.ragDocId || buildKovRagDocId(row.municipality.slug),
    rtCheckedAt: row.rtCheckedAt?.toISOString?.() || null,
    rtNotes: row.rtNotes || "",
    rtStatus: effectiveRtStatus,
    rtIngestStatus,
    rtLastIngestedAt: row.rtLastIngestedAt?.toISOString?.() || null,
    rtLastIngestError: row.rtLastIngestError || "",
    rtRagDocId: row.rtRagDocId || buildKovRtRagDocId(row.municipality.slug),
    reviewCadence: reviewSchedule.reviewCadence,
    autoCheckStatus: reviewSchedule.autoCheckStatus,
    lastFullReviewAt: reviewSchedule.lastFullReviewAt?.toISOString?.() || null,
    nextFullReviewAt: reviewSchedule.nextFullReviewAt?.toISOString?.() || null,
    lastLightCheckAt: reviewSchedule.lastLightCheckAt?.toISOString?.() || null,
    nextLightCheckAt: reviewSchedule.nextLightCheckAt?.toISOString?.() || null,
    lastChangeDetectedAt: reviewSchedule.lastChangeDetectedAt?.toISOString?.() || null,
    reviewSchedule,
    lightCheckSummary,
    rtAutoCheckStatus: rtReviewSchedule.autoCheckStatus,
    rtLastLightCheckAt: rtReviewSchedule.lastLightCheckAt?.toISOString?.() || null,
    rtNextLightCheckAt: rtReviewSchedule.nextLightCheckAt?.toISOString?.() || null,
    rtLastChangeDetectedAt: rtReviewSchedule.lastChangeDetectedAt?.toISOString?.() || null,
    rtReviewSchedule,
    rtLightCheckSummary,
    fileCount: webFileSummary.presentCount,
    rtFileCount: rtFileSummary.presentCount,
    validationSummary: {
      presentCount: webFileSummary.presentCount,
      validCount: webFileSummary.validCount,
      invalidCount: webFileSummary.invalidCount,
      missingCount: webFileSummary.missingCount,
      invalidKeys: webFileSummary.invalidKeys,
      missingKeys: webFileSummary.missingKeys,
      allFilesValid: webFileSummary.allFilesValid
    },
    ingestSummary,
    rtIngestSummary,
    combinedReadiness,
    sourceCoverage: {
      webRepositoryBacked,
      rtRepositoryBacked,
      repositoryWebReady,
      repositoryRtReady,
      adminWorkflowStale:
        (repositoryWebReady && storedReadyForIngest !== true)
        || (repositoryRtReady && storedRtStatus !== "READY")
    },
    webFiles,
    rtFiles,
    webSummary: webFileSummary,
    rtSummary: rtFileSummary,
    files: filesMap
  };
}

export async function listKovAdminEntries() {
  await ensureKovAdminSeeded();

  const rows = await prisma.municipalityKovAdmin.findMany({
    include: {
      municipality: {
        select: {
          slug: true,
          displayName: true,
          county: true,
          type: true,
          isActive: true
        }
      },
      files: {
        orderBy: {
          updatedAt: "desc"
        }
      }
    }
  });

  return Promise.all(
    rows
      .sort((left, right) => {
        const countyCompare = String(left.municipality.county || "").localeCompare(String(right.municipality.county || ""), "et");
        if (countyCompare !== 0) return countyCompare;
        return String(left.municipality.displayName || "").localeCompare(String(right.municipality.displayName || ""), "et");
      })
      .map(item => serializeKovAdminWithRepositoryFallback(item))
  );
}

export async function getKovAdminEntryBySlug(slug) {
  await ensureKovAdminSeeded();

  const normalizedSlug = String(slug || "").trim().toLowerCase();
  if (!normalizedSlug) return null;

  const row = await prisma.municipalityKovAdmin.findFirst({
    where: {
      municipality: {
        slug: normalizedSlug
      }
    },
    include: {
      municipality: {
        select: {
          id: true,
          slug: true,
          displayName: true,
          county: true,
          type: true,
          isActive: true
        }
      },
      files: {
        orderBy: {
          updatedAt: "desc"
        }
      }
    }
  });

  return row;
}

export async function syncKovAdminIngestStatusById(kovAdminId) {
  const row = await prisma.municipalityKovAdmin.findUnique({
    where: { id: kovAdminId },
    include: {
      municipality: {
        select: {
          slug: true,
          displayName: true,
          county: true,
          type: true,
          isActive: true
        }
      },
      files: true
    }
  });

  if (!row) return null;

  const current = ensureIngestStatus(row.ingestStatus);
  const rtCurrent = ensureIngestStatus(row.rtIngestStatus);
  const serialized = await serializeKovAdminWithRepositoryFallback(row);
  const nextStatus =
    current === "INGESTING"
      ? "INGESTING"
      : serialized.ingestSummary.canIngest
        ? "READY"
        : "NOT_INGESTED";
  const nextRtStatus =
    rtCurrent === "INGESTING"
      ? "INGESTING"
      : serialized.rtIngestSummary.canIngest
        ? "READY"
        : "NOT_INGESTED";

  if (
    current === nextStatus
    && rtCurrent === nextRtStatus
    && (!row.lastIngestError || current === "ERROR")
    && (!row.rtLastIngestError || rtCurrent === "ERROR")
  ) {
    return serialized;
  }

  const updated = await prisma.municipalityKovAdmin.update({
    where: { id: kovAdminId },
    data: {
      ingestStatus: nextStatus,
      lastIngestError: nextStatus === "ERROR" ? row.lastIngestError : null,
      rtIngestStatus: nextRtStatus,
      rtLastIngestError: nextRtStatus === "ERROR" ? row.rtLastIngestError : null
    },
    include: {
      municipality: {
        select: {
          slug: true,
          displayName: true,
          county: true,
          type: true,
          isActive: true
        }
      },
      files: true
    }
  });

  return serializeKovAdminWithRepositoryFallback(updated);
}

export async function updateKovAdminEntryBySlug(slug, payload = {}) {
  const row = await getKovAdminEntryBySlug(slug);
  if (!row) return null;

  const data = {};
  if ("officialWebsite" in payload) data.officialWebsite = normalizeUrl(payload.officialWebsite);
  if ("riigiTeatajaUrl" in payload) data.riigiTeatajaUrl = normalizeUrl(payload.riigiTeatajaUrl);
  if ("status" in payload) data.status = ensureStatus(payload.status);
  if ("checkedAt" in payload) data.checkedAt = normalizeCheckedAt(payload.checkedAt);
  if ("notes" in payload) data.notes = normalizeNotes(payload.notes);
  if ("rtCheckedAt" in payload) data.rtCheckedAt = normalizeCheckedAt(payload.rtCheckedAt);
  if ("rtNotes" in payload) data.rtNotes = normalizeNotes(payload.rtNotes);
  if ("rtStatus" in payload) data.rtStatus = ensureRtStatus(payload.rtStatus);
  if ("readyForIngest" in payload) data.readyForIngest = payload.readyForIngest === true;
  if ("reviewCadence" in payload) data.reviewCadence = String(payload.reviewCadence || "").trim() || "ANNUAL_JAN_PLUS_JULY_CHECK";
  if ("autoCheckStatus" in payload) data.autoCheckStatus = ensureAutoCheckStatus(payload.autoCheckStatus);
  if ("lastFullReviewAt" in payload) data.lastFullReviewAt = normalizeCheckedAt(payload.lastFullReviewAt);
  if ("nextFullReviewAt" in payload) data.nextFullReviewAt = normalizeCheckedAt(payload.nextFullReviewAt);
  if ("lastLightCheckAt" in payload) data.lastLightCheckAt = normalizeCheckedAt(payload.lastLightCheckAt);
  if ("nextLightCheckAt" in payload) data.nextLightCheckAt = normalizeCheckedAt(payload.nextLightCheckAt);
  if ("lastChangeDetectedAt" in payload) data.lastChangeDetectedAt = normalizeCheckedAt(payload.lastChangeDetectedAt);
  if ("rtAutoCheckStatus" in payload) data.rtAutoCheckStatus = ensureAutoCheckStatus(payload.rtAutoCheckStatus);
  if ("rtLastLightCheckAt" in payload) data.rtLastLightCheckAt = normalizeCheckedAt(payload.rtLastLightCheckAt);
  if ("rtNextLightCheckAt" in payload) data.rtNextLightCheckAt = normalizeCheckedAt(payload.rtNextLightCheckAt);
  if ("rtLastChangeDetectedAt" in payload) data.rtLastChangeDetectedAt = normalizeCheckedAt(payload.rtLastChangeDetectedAt);

  const updated = await prisma.municipalityKovAdmin.update({
    where: { id: row.id },
    data,
    include: {
      municipality: {
        select: {
          slug: true,
          displayName: true,
          county: true,
          type: true,
          isActive: true
        }
      },
      files: true
    }
  });

  await syncKovAdminIngestStatusById(updated.id);
  const refreshed = await getKovAdminEntryBySlug(slug);
  return refreshed ? serializeKovAdminWithRepositoryFallback(refreshed) : serializeKovAdminWithRepositoryFallback(updated);
}

async function revalidateKovFileRecord(entry, file) {
  const fileKey = resolveKovFileKeyFromDbRole(file.role);
  if (!fileKey) return null;

  let validation = invalidValidation("Unknown KOV file role");

  try {
    const buffer = await readStoredKovFile(file.storagePath);
    validation = validateKovFileContent({
      fileKey,
      text: buffer.toString("utf8"),
      slug: entry.municipality.slug,
      displayName: entry.municipality.displayName
    });
  } catch (error) {
    validation = invalidValidation(
      error?.code === "ENOENT" ? "Stored file is missing from disk" : error?.message || "Stored file could not be read"
    );
  }

  await prisma.municipalityKovAdminFile.update({
    where: {
      kovAdminId_role: {
        kovAdminId: entry.id,
        role: file.role
      }
    },
    data: {
      validationStatus: validation.validationStatus,
      validationMessage: validation.validationMessage,
      validatedAt: validation.validatedAt
    }
  });

  return validation;
}

export async function revalidateKovEntryBySlug(slug) {
  const entry = await getKovAdminEntryBySlug(slug);
  if (!entry) return null;

  for (const fileKey of KOV_WEB_FILE_KEYS) {
    const file = getFileRecordByKey(entry, fileKey);
    if (!file) continue;
    await revalidateKovFileRecord(entry, file);
  }

  await prisma.municipalityKovAdmin.update({
    where: { id: entry.id },
    data: { checkedAt: new Date() }
  });
  await syncKovAdminIngestStatusById(entry.id);

  const updated = await getKovAdminEntryBySlug(slug);
  return updated ? serializeKovAdminWithRepositoryFallback(updated) : null;
}

export async function revalidateKovRtEntryBySlug(slug) {
  const entry = await getKovAdminEntryBySlug(slug);
  if (!entry) return null;

  for (const fileKey of KOV_RT_FILE_KEYS) {
    const file = getFileRecordByKey(entry, fileKey);
    if (!file) continue;
    await revalidateKovFileRecord(entry, file);
  }

  await prisma.municipalityKovAdmin.update({
    where: { id: entry.id },
    data: { rtCheckedAt: new Date() }
  });
  await syncKovAdminIngestStatusById(entry.id);

  const updated = await getKovAdminEntryBySlug(slug);
  return updated ? serializeKovAdminWithRepositoryFallback(updated) : null;
}

export async function revalidateKovRtEntriesBySlugs(slugs = []) {
  const normalized = [...new Set((Array.isArray(slugs) ? slugs : []).map(slug => String(slug || "").trim().toLowerCase()).filter(Boolean))];
  const items = [];

  for (const slug of normalized) {
    const item = await revalidateKovRtEntryBySlug(slug);
    if (item) items.push(item);
  }

  return items;
}

export async function runKovLightCheckBySlug(slug) {
  const entry = await getKovAdminEntryBySlug(slug);
  if (!entry) return null;

  const sourcesText = await readKovFileText(entry, "sourcesJson");
  if (!sourcesText) {
    const error = new Error("sources.json is missing");
    error.status = 400;
    throw error;
  }

  const sourcesPayload = parseJsonOrThrow(sourcesText, `${entry.municipality.slug}.sources.json`);
  const sources = Array.isArray(sourcesPayload?.sources) ? sourcesPayload.sources : [];
  const uniqueSources = [];
  const seen = new Set();

  for (const source of sources) {
    const snapshotKey = buildSourceSnapshotKey(source);
    if (!snapshotKey || seen.has(snapshotKey)) continue;
    seen.add(snapshotKey);
    uniqueSources.push(source);
  }

  if (!uniqueSources.length) {
    const error = new Error("sources.json does not contain any usable sources");
    error.status = 400;
    throw error;
  }

  await prisma.municipalityKovAdmin.update({
    where: { id: entry.id },
    data: {
      autoCheckStatus: "CHECKING"
    }
  });

  const previousSnapshot = Array.isArray(entry.lightCheckSnapshot) ? entry.lightCheckSnapshot : [];
  const previousByKey = new Map(previousSnapshot.map(item => [buildSourceSnapshotKey(item), item]));
  const currentSnapshot = [];
  const changedSources = [];
  const errorSources = [];
  let reachableSourceCount = 0;
  let changedSourceCount = 0;
  let newSourceCount = 0;

  for (const source of uniqueSources) {
    const nextSnapshot = await fetchSourceSnapshot(source);
    currentSnapshot.push(nextSnapshot);

    if (nextSnapshot.ok) reachableSourceCount += 1;
    if (nextSnapshot.error) errorSources.push({ key: nextSnapshot.key, url: nextSnapshot.url, error: nextSnapshot.error });

    const previous = previousByKey.get(buildSourceSnapshotKey(nextSnapshot));
    if (!previous) {
      if (previousSnapshot.length) {
        newSourceCount += 1;
        changedSourceCount += 1;
        changedSources.push({
          key: nextSnapshot.key,
          url: nextSnapshot.url,
          reason: "new_source"
        });
      }
      continue;
    }

    if (
      String(previous?.sha256 || "") !== String(nextSnapshot.sha256 || "")
      || Number(previous?.statusCode || 0) !== Number(nextSnapshot.statusCode || 0)
      || String(previous?.contentType || "") !== String(nextSnapshot.contentType || "")
    ) {
      changedSourceCount += 1;
      changedSources.push({
        key: nextSnapshot.key,
        url: nextSnapshot.url,
        reason: "content_changed"
      });
    }
  }

  const currentKeys = new Set(currentSnapshot.map(item => buildSourceSnapshotKey(item)));
  const removedSources = previousSnapshot
    .filter(item => !currentKeys.has(buildSourceSnapshotKey(item)))
    .map(item => ({
      key: item?.key || "",
      url: item?.url || "",
      reason: "source_removed"
    }));

  const checkedAt = new Date();
  const baselineCreated = previousSnapshot.length === 0;
  const totalChanges = changedSourceCount + removedSources.length;
  const nextAutoCheckStatus =
    totalChanges > 0
      ? "CHANGES_DETECTED"
      : errorSources.length > 0
        ? "ERROR"
        : "NO_CHANGES";

  const summary = {
    mode: baselineCreated ? "BASELINE_CREATED" : "COMPARE",
    checkedSourceCount: currentSnapshot.length,
    reachableSourceCount,
    changedSourceCount: totalChanges,
    newSourceCount,
    removedSourceCount: removedSources.length,
    errorCount: errorSources.length,
    checkedAt: checkedAt.toISOString(),
    changedSources,
    removedSources,
    errorSources
  };

  const updated = await prisma.municipalityKovAdmin.update({
    where: { id: entry.id },
    data: {
      autoCheckStatus: nextAutoCheckStatus,
      lastLightCheckAt: checkedAt,
      lastChangeDetectedAt: totalChanges > 0 ? checkedAt : entry.lastChangeDetectedAt,
      lightCheckSnapshot: currentSnapshot,
      lastLightCheckSummary: summary
    },
    include: {
      municipality: {
        select: {
          slug: true,
          displayName: true,
          county: true,
          type: true,
          isActive: true
        }
      },
      files: true
    }
  });

  return serializeKovAdminWithRepositoryFallback(updated);
}

export async function runKovRtLightCheckBySlug(slug) {
  const entry = await getKovAdminEntryBySlug(slug);
  if (!entry) return null;

  const urlCandidates = stableUniqueStrings([
    entry.riigiTeatajaUrl
  ]);

  const uniqueSources = urlCandidates.map((url, index) => ({
    key: index === 0 ? "riigi_teataja_primary" : `riigi_teataja_source_${index + 1}`,
    title: entry.municipality.displayName,
    type: "regulation",
    url
  }));

  if (!uniqueSources.length) {
    const error = new Error("RT allikad puuduvad");
    error.status = 400;
    throw error;
  }

  await prisma.municipalityKovAdmin.update({
    where: { id: entry.id },
    data: {
      rtAutoCheckStatus: "CHECKING"
    }
  });

  const previousSnapshot = Array.isArray(entry.rtLightCheckSnapshot) ? entry.rtLightCheckSnapshot : [];
  const previousByKey = new Map(previousSnapshot.map(item => [buildSourceSnapshotKey(item), item]));
  const currentSnapshot = [];
  const changedSources = [];
  const errorSources = [];
  let reachableSourceCount = 0;
  let changedSourceCount = 0;
  let newSourceCount = 0;

  for (const source of uniqueSources) {
    const nextSnapshot = await fetchSourceSnapshot(source);
    currentSnapshot.push(nextSnapshot);

    if (nextSnapshot.ok) reachableSourceCount += 1;
    if (nextSnapshot.error) errorSources.push({ key: nextSnapshot.key, url: nextSnapshot.url, error: nextSnapshot.error });

    const previous = previousByKey.get(buildSourceSnapshotKey(nextSnapshot));
    if (!previous) {
      if (previousSnapshot.length) {
        newSourceCount += 1;
        changedSourceCount += 1;
        changedSources.push({
          key: nextSnapshot.key,
          url: nextSnapshot.url,
          reason: "new_source"
        });
      }
      continue;
    }

    if (
      String(previous?.sha256 || "") !== String(nextSnapshot.sha256 || "")
      || Number(previous?.statusCode || 0) !== Number(nextSnapshot.statusCode || 0)
      || String(previous?.contentType || "") !== String(nextSnapshot.contentType || "")
    ) {
      changedSourceCount += 1;
      changedSources.push({
        key: nextSnapshot.key,
        url: nextSnapshot.url,
        reason: "content_changed"
      });
    }
  }

  const currentKeys = new Set(currentSnapshot.map(item => buildSourceSnapshotKey(item)));
  const removedSources = previousSnapshot
    .filter(item => !currentKeys.has(buildSourceSnapshotKey(item)))
    .map(item => ({
      key: item?.key || "",
      url: item?.url || "",
      reason: "source_removed"
    }));

  const checkedAt = new Date();
  const baselineCreated = previousSnapshot.length === 0;
  const totalChanges = changedSourceCount + removedSources.length;
  const nextAutoCheckStatus =
    totalChanges > 0
      ? "CHANGES_DETECTED"
      : errorSources.length > 0
        ? "ERROR"
        : "NO_CHANGES";

  const summary = {
    mode: baselineCreated ? "BASELINE_CREATED" : "COMPARE",
    checkedSourceCount: currentSnapshot.length,
    reachableSourceCount,
    changedSourceCount: totalChanges,
    newSourceCount,
    removedSourceCount: removedSources.length,
    errorCount: errorSources.length,
    checkedAt: checkedAt.toISOString(),
    changedSources,
    removedSources,
    errorSources
  };

  const updated = await prisma.municipalityKovAdmin.update({
    where: { id: entry.id },
    data: {
      rtAutoCheckStatus: nextAutoCheckStatus,
      rtLastLightCheckAt: checkedAt,
      rtLastChangeDetectedAt: totalChanges > 0 ? checkedAt : entry.rtLastChangeDetectedAt,
      rtLightCheckSnapshot: currentSnapshot,
      rtLastLightCheckSummary: summary
    },
    include: {
      municipality: {
        select: {
          slug: true,
          displayName: true,
          county: true,
          type: true,
          isActive: true
        }
      },
      files: true
    }
  });

  return serializeKovAdminWithRepositoryFallback(updated);
}

export async function runKovLightChecksBySlugs(slugs = []) {
  const normalized = [...new Set((Array.isArray(slugs) ? slugs : []).map(slug => String(slug || "").trim().toLowerCase()).filter(Boolean))];
  const items = [];

  for (const slug of normalized) {
    const item = await runKovLightCheckBySlug(slug);
    if (item) items.push(item);
  }

  return items;
}

export async function runKovRtLightChecksBySlugs(slugs = []) {
  const normalized = [...new Set((Array.isArray(slugs) ? slugs : []).map(slug => String(slug || "").trim().toLowerCase()).filter(Boolean))];
  const items = [];

  for (const slug of normalized) {
    const item = await runKovRtLightCheckBySlug(slug);
    if (item) items.push(item);
  }

  return items;
}

async function readKovFileText(entry, fileKey) {
  const file = getFileRecordByKey(entry, fileKey);
  if (file?.storagePath) {
    const buffer = await readStoredKovFile(file.storagePath);
    return buffer.toString("utf8");
  }
  const fallback = await readRepositoryKovFileFallback(entry, fileKey);
  return fallback?.text || null;
}

async function readRequiredKovIngestFiles(entry) {
  const ragText = await readKovFileText(entry, "ragMd");
  const dataText = await readKovFileText(entry, "dataJson");
  const metaText = await readKovFileText(entry, "metaJson");
  const sourcesText = await readKovFileText(entry, "sourcesJson");
  return {
    ragText,
    dataText,
    metaText,
    sourcesText
  };
}

async function readRequiredKovRtIngestFiles(entry) {
  const rtXmlText = await readKovFileText(entry, "rtXml");
  const rtXmlFile = getFileRecordByKey(entry, "rtXml");
  if (rtXmlText && rtXmlFile) return {
    rtXmlText,
    rtXmlFile,
    generatedMetadata: null
  };

  try {
    const { manifest } = await readKovRtManifest("KOV");
    const manifestEntry = findKovRtManifestEntry(manifest, entry?.municipality?.slug || entry?.slug || "");
    if (!manifestEntry) return { rtXmlText, rtXmlFile, generatedMetadata: null };
    const audit = await auditKovRtManifestEntry("KOV", manifestEntry);
    if (!audit.xml_found || !audit.xml_path || !audit.generated_metadata_valid) {
      return {
        rtXmlText,
        rtXmlFile,
        generatedMetadata: audit.generated_metadata,
        manifestAudit: audit
      };
    }
    const buffer = await fs.readFile(audit.xml_path);
    return {
      rtXmlText: buffer.toString("utf8"),
      rtXmlFile: {
        originalName: audit.xml_file,
        storagePath: audit.xml_path
      },
      generatedMetadata: audit.generated_metadata,
      manifestAudit: audit
    };
  } catch {
    return {
      rtXmlText,
      rtXmlFile,
      generatedMetadata: null
    };
  }
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

async function assertKovIngestPreconditions(entry) {
  const serialized = await serializeKovAdminWithRepositoryFallback(entry);
  const blockingIssues = [...(serialized.ingestSummary?.blockingIssues || [])];

  if (ensureIngestStatus(entry.ingestStatus) === "INGESTING") {
    blockingIssues.unshift("KOV ingest is already in progress");
  }

  if (!serialized.validationSummary?.allFilesValid) {
    if (!blockingIssues.length) {
      blockingIssues.push("All four required files must be valid before ingest");
    }
  }

  if (blockingIssues.length) {
    const error = new Error(blockingIssues.join(". "));
    error.status = 400;
    error.blockingIssues = blockingIssues;
    throw error;
  }

  return serialized;
}

async function assertKovRtIngestPreconditions(entry) {
  const serialized = await serializeKovAdminWithRepositoryFallback(entry);
  const blockingIssues = [...(serialized.rtIngestSummary?.blockingIssues || [])];

  if (ensureIngestStatus(entry.rtIngestStatus) === "INGESTING") {
    blockingIssues.unshift("RT ingest is already in progress");
  }

  if (blockingIssues.length) {
    const error = new Error(blockingIssues.join(". "));
    error.status = 400;
    error.blockingIssues = blockingIssues;
    throw error;
  }

  return serialized;
}

function buildKovIngestMetadata(entry, metaPayload, sourcesPayload) {
  const sources = Array.isArray(sourcesPayload?.sources) ? sourcesPayload.sources : [];
  const sourceKeys = stableUniqueStrings(sources.map(source => source?.key));
  const sourceUrls = stableUniqueStrings(sources.map(source => source?.url));
  const kovMetadata = deriveKovBundleMetadataFields(entry, metaPayload, sourcesPayload);
  const coverage =
    metaPayload?.coverage && typeof metaPayload.coverage === "object" && !Array.isArray(metaPayload.coverage)
      ? metaPayload.coverage
      : null;
  const notes = stableUniqueStrings([
    rowNotesToSingleLine(entry.notes),
    ...(Array.isArray(metaPayload?.notes) ? metaPayload.notes : [])
  ]);
  const unresolvedIssues = stableUniqueStrings(Array.isArray(metaPayload?.unresolvedIssues) ? metaPayload.unresolvedIssues : []);

  return {
    title: `${kovMetadata.municipality_name || entry.municipality.displayName} sotsiaalteenused ja toetused`,
    doc_id: buildKovRagDocId(entry.municipality.slug),
    collection_id: kovMetadata.collection_id,
    audience: "BOTH",
    country: kovMetadata.country,
    county: kovMetadata.county,
    jurisdiction_level: kovMetadata.jurisdiction_level,
    municipality_id: kovMetadata.municipality_id,
    municipality_name: kovMetadata.municipality_name,
    municipality_slug: kovMetadata.municipality_slug,
    municipality: kovMetadata.municipality,
    checked_at: kovMetadata.checked_at,
    last_checked: kovMetadata.last_checked,
    officialWebsite: entry.officialWebsite || null,
    riigiTeatajaUrl: entry.riigiTeatajaUrl || null,
    source_urls: sourceUrls,
    source_keys: sourceKeys,
    source_count: sources.length,
    source_type: "municipality_kov",
    language: kovMetadata.language,
    meta_status: typeof metaPayload?.status === "string" ? metaPayload.status : null,
    coverage: coverage ? JSON.stringify(coverage) : null,
    coverage_services: Number.isFinite(Number(coverage?.services)) ? Number(coverage.services) : null,
    coverage_benefits: Number.isFinite(Number(coverage?.benefits)) ? Number(coverage.benefits) : null,
    coverage_resources: Number.isFinite(Number(coverage?.resources)) ? Number(coverage.resources) : null,
    coverage_contacts: Number.isFinite(Number(coverage?.contacts)) ? Number(coverage.contacts) : null,
    coverage_forms: Number.isFinite(Number(coverage?.forms)) ? Number(coverage.forms) : null,
    notes,
    unresolved_issues: unresolvedIssues
  };
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function formatTextValue(value, emptyValue = "") {
  if (Array.isArray(value)) {
    return value
      .map(entry => formatTextValue(entry, ""))
      .filter(Boolean)
      .join("; ");
  }
  if (isPlainObject(value)) {
    return Object.entries(value)
      .map(([key, entry]) => {
        const formatted = formatTextValue(entry, "");
        return formatted ? `${key}: ${formatted}` : "";
      })
      .filter(Boolean)
      .join("; ");
  }
  const text = String(value ?? "").trim();
  return text || emptyValue;
}

function buildKovSourceMap(sourcesPayload) {
  return new Map(
    (Array.isArray(sourcesPayload?.sources) ? sourcesPayload.sources : [])
      .filter(source => source?.key)
      .map(source => [String(source.key), source])
  );
}

function buildKovItemMap(datasetPayload) {
  return new Map(
    (Array.isArray(datasetPayload?.items) ? datasetPayload.items : [])
      .filter(item => item?.id)
      .map(item => [String(item.id), item])
  );
}

function itemTypeSection(itemType) {
  if (itemType === "service") return "Teenused";
  if (itemType === "benefit") return "Toetused";
  if (itemType === "resource") return "Ressursid";
  if (itemType === "contact") return "Kontaktid";
  if (itemType === "form") return "Blanketid ja taotlused";
  return "KOV";
}

function getRelatedItems(itemMap, ids = [], expectedTypes = []) {
  const allowedTypes = new Set(expectedTypes.filter(Boolean));
  return (Array.isArray(ids) ? ids : [])
    .map(id => itemMap.get(String(id)))
    .filter(item => item && (!allowedTypes.size || allowedTypes.has(item.itemType)));
}

function formatContactLine(item) {
  const parts = [
    item?.name || item?.title,
    item?.role,
    item?.department,
    item?.phone ? `tel ${item.phone}` : "",
    item?.email ? `e-post ${item.email}` : "",
    item?.officialUrl ? `link ${item.officialUrl}` : ""
  ].map(value => String(value || "").trim()).filter(Boolean);
  return parts.join(", ");
}

function formatFormLine(item) {
  const parts = [
    item?.title || item?.name,
    item?.format ? `vorming ${item.format}` : "",
    item?.officialUrl ? `link ${item.officialUrl}` : "",
    Array.isArray(item?.submissionChannels) && item.submissionChannels.length
      ? `esitamine ${item.submissionChannels.join(", ")}`
      : ""
  ].map(value => String(value || "").trim()).filter(Boolean);
  return parts.join(", ");
}

function formatRelatedContacts(item, itemMap) {
  const contacts = getRelatedItems(itemMap, item?.relatedContacts, ["contact"]);
  if (!contacts.length) {
    return "KOV veebikihi andmetes ei ole selle kirje juures eraldi kontakti nimetatud.";
  }
  return contacts.map(contact => `- ${formatContactLine(contact)}`).filter(line => line !== "- ").join("\n");
}

function formatRelatedForms(item, itemMap) {
  const forms = getRelatedItems(itemMap, item?.relatedForms, ["form"]);
  if (!forms.length) {
    return "KOV veebikihi andmetes ei ole selle kirje juures eraldi blanketti nimetatud.";
  }
  return forms.map(form => `- ${formatFormLine(form)}`).filter(line => line !== "- ").join("\n");
}

function formatRelatedTargets(item, itemMap) {
  const targets = getRelatedItems(itemMap, item?.relatedTo, ["service", "benefit", "resource"]);
  if (!targets.length) return "Andmed puuduvad.";
  return targets
    .map(target => `- ${target.title || target.id} (${target.itemType || "kirje"})`)
    .join("\n");
}

function sourceUrlsForItem(item, sourceMap) {
  const sourceUrls = (Array.isArray(item?.sourceKeys) ? item.sourceKeys : [])
    .map(key => sourceMap.get(String(key))?.url)
    .filter(Boolean);
  return stableUniqueStrings([
    item?.officialUrl,
    ...(Array.isArray(item?.sourceUrls) ? item.sourceUrls : []),
    ...sourceUrls
  ]);
}

function countKovItems(value) {
  return Array.isArray(value) ? value.length : 0;
}

function hasKovObjectText(value, fields) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return fields.some(field => {
    const fieldValue = value[field];
    if (Array.isArray(fieldValue)) return fieldValue.length > 0;
    return String(fieldValue || "").trim().length > 0;
  });
}

function deriveKovItemSectionsPresent(item = {}) {
  const sections = [];
  if (item.summary || item.description) sections.push("description");
  if (item.conditions || item.targetGroup) sections.push("eligibility");
  if (
    hasKovObjectText(item.application, ["channels", "steps", "deadline", "decisionTime", "notes"]) ||
    countKovItems(item.submissionChannels) > 0 ||
    item.deadline ||
    item.decisionTime
  ) {
    sections.push("application");
  }
  if (countKovItems(item.forms) > 0 || countKovItems(item.relatedForms) > 0) sections.push("forms");
  if (
    countKovItems(item.contacts) > 0 ||
    countKovItems(item.relatedContacts) > 0 ||
    item.phone ||
    item.email ||
    item.address
  ) {
    sections.push("contacts");
  }
  if (countKovItems(item.legalBasis) > 0) sections.push("legal_basis");
  return sections;
}

function renderKovDatasetItemText(entry, item, itemMap, sourceMap) {
  const lines = [
    `# ${item.title || item.id}`,
    "",
    `KOV: ${entry.municipality.displayName}`,
    `Maakond: ${entry.municipality.county || ""}`,
    `Kirje ID: ${item.id}`,
    `Liik: ${item.itemType || ""}`,
    `Sektsioon: ${itemTypeSection(item.itemType)}`,
    `Staatus: ${item.status || "active"}`
  ];

  const simpleFields = [
    ["Ametlik link", item.officialUrl],
    ["Kokkuvõte", item.summary],
    ["Sihtrühm", item.targetGroup],
    ["Tingimused", item.conditions],
    ["Taotlemine", item.application],
    ["Summa", item.amount || item.pricingOrAmount],
    ["Tähtaeg", item.deadline],
    ["Otsustamise aeg", item.decisionTime],
    ["Nimi", item.name],
    ["Roll", item.role],
    ["Osakond", item.department],
    ["Telefon", item.phone],
    ["E-post", item.email],
    ["Aadress", item.address],
    ["Failivorming", item.format],
    ["Esitamise kanalid", item.submissionChannels]
  ];

  for (const [label, value] of simpleFields) {
    const formatted = formatTextValue(value, "");
    if (formatted) lines.push(`${label}: ${formatted}`);
  }

  if (item.itemType === "service" || item.itemType === "benefit" || item.itemType === "resource") {
    lines.push("", "Blanketid selle kirje juures:", formatRelatedForms(item, itemMap));
    lines.push("", "Kontaktid selle kirje juures:", formatRelatedContacts(item, itemMap));
  }

  if (item.itemType === "contact" || item.itemType === "form") {
    lines.push("", "Seotud teenused, toetused või ressursid:", formatRelatedTargets(item, itemMap));
  }

  const sourceLines = (Array.isArray(item.sourceKeys) ? item.sourceKeys : [])
    .map(key => {
      const source = sourceMap.get(String(key));
      if (!source) return `- ${key}`;
      return `- ${source.key}: ${source.title || source.key}${source.url ? ` | ${source.url}` : ""}`;
    });
  lines.push("", "Allikad:", sourceLines.length ? sourceLines.join("\n") : "Andmed puuduvad.");

  return lines
    .map(line => String(line ?? "").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildKovDatasetIngestChunks(entry, datasetPayload, sourcesPayload, metaPayload = {}) {
  const items = Array.isArray(datasetPayload?.items) ? datasetPayload.items : [];
  const itemMap = buildKovItemMap(datasetPayload);
  const sourceMap = buildKovSourceMap(sourcesPayload);
  const ragDocId = buildKovRagDocId(entry.municipality.slug);
  const kovMetadata = deriveKovBundleMetadataFields(entry, metaPayload, sourcesPayload);

  return items
    .filter(item => item?.id && item?.title)
    .map((item, index) => {
      const sourceUrls = sourceUrlsForItem(item, sourceMap);
      const relatedForms = Array.isArray(item.relatedForms) ? item.relatedForms : [];
      const relatedContacts = Array.isArray(item.relatedContacts) ? item.relatedContacts : [];
      const relatedTo = Array.isArray(item.relatedTo) ? item.relatedTo : [];
      const sourceKeys = Array.isArray(item.sourceKeys) ? item.sourceKeys : [];

      return {
        text: renderKovDatasetItemText(entry, item, itemMap, sourceMap),
        metadata: {
          canonical_chunk_id: `${ragDocId}:item:${item.id}`,
          chunk_key: `item-${item.id}`,
          title: item.title,
          section: itemTypeSection(item.itemType),
          item_id: item.id,
          itemId: item.id,
          item_type: item.itemType || null,
          itemType: item.itemType || null,
          item_status: item.status || "active",
          source_type: "municipality_kov",
          source_url: sourceUrls[0] || null,
          source_urls: sourceUrls,
          source_keys: sourceKeys,
          official_url: item.officialUrl || null,
          contact_name: item.name || item.title || null,
          contact_role: item.role || null,
          contact_department: item.department || null,
          contact_phone: item.phone || null,
          contact_email: item.email || null,
          contact_address: item.address || null,
          country: kovMetadata.country,
          county: kovMetadata.county,
          jurisdiction_level: kovMetadata.jurisdiction_level,
          municipality_id: kovMetadata.municipality_id,
          municipality_name: kovMetadata.municipality_name,
          municipality_slug: kovMetadata.municipality_slug,
          municipality: kovMetadata.municipality,
          checked_at: kovMetadata.checked_at,
          last_checked: kovMetadata.last_checked,
          language: kovMetadata.language,
          collection_id: kovMetadata.collection_id,
          related_forms: relatedForms,
          relatedForms,
          related_contacts: relatedContacts,
          relatedContacts,
          related_to: relatedTo,
          relatedTo,
          sections_present: deriveKovItemSectionsPresent(item),
          forms_count: countKovItems(item.forms),
          related_forms_count: relatedForms.length,
          contacts_count: countKovItems(item.contacts),
          related_contacts_count: relatedContacts.length,
          legal_basis_count: countKovItems(item.legalBasis),
          chunk_index_hint: index
        }
      };
    });
}

function rowNotesToSingleLine(value) {
  const normalized = String(value || "").trim();
  return normalized ? normalized.replace(/\s+/g, " ") : "";
}

export async function ingestKovEntryBySlug(slug, options = {}) {
  const entry = await getKovAdminEntryBySlug(slug);
  if (!entry) return null;

  const serialized = await assertKovIngestPreconditions(entry);
  const ragDocId = buildKovRagDocId(entry.municipality.slug);
  const replaceExisting = options.replaceExisting === true;

  let ragText = "";
  let datasetPayload = null;
  let metaPayload = null;
  let sourcesPayload = null;

  try {
    const files = await readRequiredKovIngestFiles(entry);
    ragText = String(files.ragText || "").trim();
    datasetPayload = parseJsonOrThrow(files.dataText, `${entry.municipality.slug}.json`);
    metaPayload = parseJsonOrThrow(files.metaText, `${entry.municipality.slug}.meta.json`);
    sourcesPayload = parseJsonOrThrow(files.sourcesText, `${entry.municipality.slug}.sources.json`);

    if (!ragText) {
      const error = new Error("rag.md is empty");
      error.status = 400;
      throw error;
    }
    const chunks = buildKovDatasetIngestChunks(entry, datasetPayload, sourcesPayload, metaPayload);
    if (!chunks.length) {
      const error = new Error("dataset json did not produce any ingestable KOV items");
      error.status = 400;
      throw error;
    }

    await prisma.municipalityKovAdmin.update({
      where: { id: entry.id },
      data: {
        ingestStatus: "INGESTING",
        lastIngestError: null,
        ragDocId
      }
    });

    if (replaceExisting) {
      await executeKovRagWebLayerCleanupBySlug(entry.municipality.slug);
    }

    await ragServiceRequest(
      "/ingest/text",
      {
        method: "POST",
        headers: buildRagHeaders("application/json", {
          route: "admin/rag/kov",
          stage: "kov_manual_ingest"
        }),
        body: JSON.stringify({
          doc_id: ragDocId,
          chunks,
          metadata: buildKovIngestMetadata(entry, metaPayload, sourcesPayload)
        })
      },
      "api.admin.kov.ingest_failed"
    );

    const updated = await prisma.municipalityKovAdmin.update({
      where: { id: entry.id },
      data: {
        ingestStatus: "INGESTED",
        lastIngestedAt: new Date(),
        lastIngestError: null,
        ragDocId
      },
      include: {
        municipality: {
          select: {
            slug: true,
            displayName: true,
            county: true,
            type: true,
            isActive: true
          }
        },
        files: true
      }
    });

    return serializeKovAdminWithRepositoryFallback(updated);
  } catch (error) {
    await prisma.municipalityKovAdmin.update({
      where: { id: entry.id },
      data: {
        ingestStatus: "ERROR",
        lastIngestError: normalizeIngestErrorMessage(error),
        ragDocId
      }
    });
    error.serializedEntry = serialized;
    throw error;
  }
}

export async function ingestKovRtEntryBySlug(slug) {
  const entry = await getKovAdminEntryBySlug(slug);
  if (!entry) return null;

  await assertKovRtIngestPreconditions(entry);
  const rtRagDocId = buildKovRtRagDocId(entry.municipality.slug);

  try {
    const files = await readRequiredKovRtIngestFiles(entry);
    const rtXmlText = String(files.rtXmlText || "").trim();
    const rtXmlOriginalName = String(files.rtXmlFile?.originalName || `${entry.municipality.slug}.rt.xml`);
    if (!rtXmlText) {
      const error = new Error("rt.xml is empty");
      error.status = 400;
      throw error;
    }
    const payload = buildKovRtXmlIngestPayload(entry, {
      xmlText: rtXmlText,
      sourceFile: rtXmlOriginalName,
      sourcePath: files.rtXmlFile?.storagePath || "",
      generatedMetadata: files.generatedMetadata || null
    });

    await prisma.municipalityKovAdmin.update({
      where: { id: entry.id },
      data: {
        rtIngestStatus: "INGESTING",
        rtLastIngestError: null,
        rtRagDocId
      }
    });

    await ragServiceRequest(
      "/ingest/text",
      {
        method: "POST",
        headers: buildRagHeaders("application/json", {
          route: "admin/rag/kov",
          stage: "kov_rt_manual_ingest"
        }),
        body: JSON.stringify(payload)
      },
      "api.admin.kov.ingest_failed"
    );

    const updated = await prisma.municipalityKovAdmin.update({
      where: { id: entry.id },
      data: {
        rtIngestStatus: "INGESTED",
        rtLastIngestedAt: new Date(),
        rtLastIngestError: null,
        rtRagDocId
      },
      include: {
        municipality: {
          select: {
            slug: true,
            displayName: true,
            county: true,
            type: true,
            isActive: true
          }
        },
        files: true
      }
    });

    return serializeKovAdminWithRepositoryFallback(updated);
  } catch (error) {
    await prisma.municipalityKovAdmin.update({
      where: { id: entry.id },
      data: {
        rtIngestStatus: "ERROR",
        rtLastIngestError: normalizeIngestErrorMessage(error),
        rtRagDocId
      }
    });
    throw error;
  }
}

export async function ingestKovRtEntriesBySlugs(slugs = []) {
  const normalized = [...new Set((Array.isArray(slugs) ? slugs : []).map(slug => String(slug || "").trim().toLowerCase()).filter(Boolean))];
  const items = [];

  for (const slug of normalized) {
    const item = await ingestKovRtEntryBySlug(slug);
    if (item) items.push(item);
  }

  return items;
}

export async function ingestKovEntriesBySlugs(slugs = []) {
  const normalized = [...new Set((Array.isArray(slugs) ? slugs : []).map(slug => String(slug || "").trim().toLowerCase()).filter(Boolean))];
  const items = [];

  for (const slug of normalized) {
    const item = await ingestKovEntryBySlug(slug);
    if (item) items.push(item);
  }

  return items;
}

export async function revalidateKovEntriesBySlugs(slugs = []) {
  const normalized = [...new Set((Array.isArray(slugs) ? slugs : []).map(slug => String(slug || "").trim().toLowerCase()).filter(Boolean))];
  const items = [];

  for (const slug of normalized) {
    const item = await revalidateKovEntryBySlug(slug);
    if (item) items.push(item);
  }

  return items;
}
