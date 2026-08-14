import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { safeFetch, SafeFetchError } from "./safe-fetch.mjs";

export const DEFAULT_MASTER_PATH = "docs/Andmebaas/allikaregister/master_sources_final.json";
export const DEFAULT_OUTPUT_DIR = "docs/Andmebaas/RAG/master_sources_pdf";
export const DEFAULT_REPORT_DIR = "docs/Andmebaas/RAG";
export const DEFAULT_SCAN_ROOTS = Object.freeze([
  "docs/Andmebaas"
]);
export const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;
export const DEFAULT_TIMEOUT_MS = 60_000;
export const DEFAULT_CONCURRENCY = 3;
export const DEFAULT_RETRIES = 2;

export class SourceMasterDownloadError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SourceMasterDownloadError";
    this.code = code;
  }
}

function clean(value) {
  return String(value ?? "").trim();
}

function normalizedUrl(value) {
  const raw = clean(value);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    url.hash = "";
    return url.toString();
  } catch {
    return raw;
  }
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function filesBelow(root) {
  const absolute = path.resolve(root);
  if (!await exists(absolute)) return [];
  const output = [];
  const pending = [absolute];
  while (pending.length) {
    const current = pending.pop();
    const entries = await fs.readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, "et"));
    for (const entry of entries) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(target);
      else if (entry.isFile()) output.push(target);
    }
  }
  return output;
}

export async function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  const handle = await fs.open(filePath, "r");
  try {
    for await (const chunk of handle.createReadStream()) hash.update(chunk);
  } finally {
    await handle.close().catch(() => {});
  }
  return hash.digest("hex");
}

function walkObjects(value, visit) {
  if (Array.isArray(value)) {
    for (const item of value) walkObjects(item, visit);
    return;
  }
  if (!value || typeof value !== "object") return;
  visit(value);
  for (const child of Object.values(value)) walkObjects(child, visit);
}

function addMatch(map, key, filePath) {
  const normalized = clean(key);
  if (!normalized) return;
  if (!map.has(normalized)) map.set(normalized, new Set());
  map.get(normalized).add(filePath);
}

async function loadSidecarMatches(jsonPath, catalog) {
  let parsed;
  try {
    parsed = JSON.parse(await fs.readFile(jsonPath, "utf8"));
  } catch {
    return;
  }
  if (/\.metadata\.json$/iu.test(jsonPath)) {
    const generatedPdf = jsonPath.replace(/\.metadata\.json$/iu, ".pdf");
    if (catalog.pdfPaths.has(generatedPdf)) {
      addMatch(catalog.bySourceId, parsed?.source?.source_id ?? parsed?.source?.sourceId, generatedPdf);
      for (const url of [parsed?.source?.url, parsed?.source?.source_url, parsed?.source?.sourceUrl, parsed?.final_url]) {
        addMatch(catalog.byUrl, normalizedUrl(url), generatedPdf);
      }
    }
  }
  walkObjects(parsed, object => {
    const sourcePath = clean(object.source_path ?? object.sourcePath);
    if (!sourcePath) return;
    const resolved = path.resolve(path.dirname(jsonPath), sourcePath);
    if (path.extname(resolved).toLowerCase() !== ".pdf" || !catalog.pdfPaths.has(resolved)) return;
    addMatch(catalog.bySourceId, object.source_id ?? object.sourceId, resolved);
    for (const url of [object.url, object.source_url, object.sourceUrl, object.url_canonical, object.urlCanonical]) {
      addMatch(catalog.byUrl, normalizedUrl(url), resolved);
    }
  });
}

export async function inventoryLocalPdfs(scanRoots) {
  const allFiles = (await Promise.all(scanRoots.map(filesBelow))).flat();
  const pdfs = [...new Set(allFiles.filter(file => path.extname(file).toLowerCase() === ".pdf"))].sort();
  const jsons = [...new Set(allFiles.filter(file => path.extname(file).toLowerCase() === ".json"))].sort();
  const catalog = {
    pdfPaths: new Set(pdfs),
    bySourceId: new Map(),
    byUrl: new Map(),
    byHash: new Map(),
    pdfCount: pdfs.length
  };
  for (const jsonPath of jsons) await loadSidecarMatches(jsonPath, catalog);
  for (const pdfPath of pdfs) {
    const hash = await sha256File(pdfPath);
    addMatch(catalog.byHash, hash, pdfPath);
  }
  return catalog;
}

export async function loadMasterPdfRecords(masterPath) {
  let parsed;
  try {
    parsed = JSON.parse(await fs.readFile(path.resolve(masterPath), "utf8"));
  } catch (error) {
    throw new SourceMasterDownloadError("master_read_failed", `Cannot read master list: ${error?.code || "invalid_json"}`);
  }
  if (!Array.isArray(parsed)) throw new SourceMasterDownloadError("master_invalid", "Master list must be a JSON array");
  const records = parsed.filter(record => clean(record?.source_format).toLowerCase() === "pdf");
  const seen = new Set();
  for (const record of records) {
    const sourceId = clean(record?.source_id);
    if (!sourceId) throw new SourceMasterDownloadError("master_missing_source_id", "A PDF record has no source_id");
    if (seen.has(sourceId)) throw new SourceMasterDownloadError("master_duplicate_source_id", `Duplicate PDF source_id: ${sourceId}`);
    if (!clean(record?.url)) throw new SourceMasterDownloadError("master_missing_url", `PDF record has no URL: ${sourceId}`);
    seen.add(sourceId);
  }
  return records;
}

function firstPath(set) {
  return set ? [...set].sort()[0] : null;
}

export function findProvenLocalPdf(record, catalog) {
  const sourceIdMatch = firstPath(catalog.bySourceId.get(clean(record.source_id)));
  if (sourceIdMatch) return { path: sourceIdMatch, matched_by: "source_id_sidecar" };
  const urlMatch = firstPath(catalog.byUrl.get(normalizedUrl(record.url)));
  if (urlMatch) return { path: urlMatch, matched_by: "source_url_sidecar" };
  return null;
}

export async function buildPlan({ records, catalog }) {
  const results = [];
  for (const record of records) {
    const local = findProvenLocalPdf(record, catalog);
    if (local) {
      const stats = await fs.stat(local.path);
      results.push({
        source_id: record.source_id,
        title: record.title || "",
        url: record.url,
        status: "LOCAL_FILE_EXISTS",
        local_path: local.path,
        matched_by: local.matched_by,
        sha256: await sha256File(local.path),
        bytes: stats.size,
        error: null
      });
    } else {
      results.push({
        source_id: record.source_id,
        title: record.title || "",
        url: record.url,
        status: "WOULD_DOWNLOAD",
        local_path: null,
        matched_by: null,
        sha256: null,
        bytes: null,
        error: null
      });
    }
  }
  return {
    mode: "plan",
    generated_at: new Date().toISOString(),
    counts: {
      total: results.length,
      local_file_exists: results.filter(item => item.status === "LOCAL_FILE_EXISTS").length,
      would_download: results.filter(item => item.status === "WOULD_DOWNLOAD").length
    },
    results
  };
}

function sha256Buffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function safeSourceId(value) {
  const cleaned = clean(value)
    .split("")
    .map(character => character.charCodeAt(0) < 32 ? "_" : character)
    .join("")
    .replace(/[<>:"/\\|?*]/gu, "_")
    .replace(/[. ]+$/gu, "")
    .slice(0, 160);
  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/iu;
  if (!cleaned) throw new SourceMasterDownloadError("invalid_source_id", "source_id cannot become an empty filename");
  return reserved.test(cleaned) ? `_${cleaned}` : cleaned;
}

function isPdf(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= 5 && buffer.subarray(0, 5).toString("latin1") === "%PDF-";
}

function statusCounts(results) {
  const counts = { total: results.length };
  for (const result of results) {
    const key = result.status.toLowerCase();
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

async function mapConcurrent(items, concurrency, mapper) {
  const output = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, concurrency), Math.max(1, items.length)) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      output[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return output;
}

async function fetchPdfWithRetries(record, {
  fetcher,
  maxBytes,
  timeoutMs,
  retries,
  sleep
}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetcher(record.url, {
        timeoutMs,
        maxBytes,
        headers: {
          Accept: "application/pdf,application/octet-stream;q=0.9,*/*;q=0.1",
          "User-Agent": "SotsiaalAI source archive/1.0 (+https://sotsiaal.ai)"
        }
      });
      if (!response.ok) {
        const error = new SourceMasterDownloadError("http_error", `HTTP ${response.status}`);
        error.retryable = response.status === 429 || response.status >= 500;
        throw error;
      }
      return response;
    } catch (error) {
      lastError = error;
      const retryable = error?.retryable !== false && (
        error instanceof SafeFetchError ||
        error instanceof TypeError ||
        error?.retryable === true
      );
      if (attempt >= retries || !retryable) break;
      await sleep(Math.min(2000, 250 * (2 ** attempt)));
    }
  }
  throw lastError;
}

async function uniqueTarget(outputDir, sourceId, hash) {
  const base = safeSourceId(sourceId);
  const primary = path.join(outputDir, `${base}.pdf`);
  if (!await exists(primary)) return { target: primary, existing: false };
  if (await sha256File(primary) === hash) return { target: primary, existing: true };
  const versioned = path.join(outputDir, `${base}--${hash.slice(0, 12)}.pdf`);
  if (!await exists(versioned)) return { target: versioned, existing: false };
  if (await sha256File(versioned) === hash) return { target: versioned, existing: true };
  throw new SourceMasterDownloadError("target_collision", `Existing output collision for ${sourceId}`);
}

async function writePdfExclusive(target, body) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.partial-${process.pid}-${crypto.randomUUID()}`;
  try {
    await fs.writeFile(temporary, body, { flag: "wx" });
    await fs.rename(temporary, target);
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

function baseResult(record) {
  return {
    source_id: record.source_id,
    title: record.title || "",
    url: record.url,
    status: null,
    local_path: null,
    matched_by: null,
    final_url: null,
    sha256: null,
    bytes: null,
    error: null
  };
}

function classifiedFailure(record, error) {
  let status = "DOWNLOAD_FAILED";
  if (error instanceof SafeFetchError && error.code === "response_too_large") status = "TOO_LARGE";
  return {
    ...baseResult(record),
    status,
    error: error?.code === "http_error" ? error.message : error?.code || error?.message || "download_failed"
  };
}

export async function downloadMissingPdfs({
  records,
  catalog,
  outputDir,
  fetcher = safeFetch,
  maxBytes = DEFAULT_MAX_BYTES,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  concurrency = DEFAULT_CONCURRENCY,
  retries = DEFAULT_RETRIES,
  sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
  now = () => new Date()
}) {
  const absoluteOutput = path.resolve(outputDir);
  const hashGates = new Map();
  const results = await mapConcurrent(records, concurrency, async record => {
    const provenLocal = findProvenLocalPdf(record, catalog);
    if (provenLocal) {
      const stats = await fs.stat(provenLocal.path);
      return {
        ...baseResult(record),
        status: "LOCAL_FILE_EXISTS",
        local_path: provenLocal.path,
        matched_by: provenLocal.matched_by,
        sha256: await sha256File(provenLocal.path),
        bytes: stats.size
      };
    }

    let response;
    try {
      response = await fetchPdfWithRetries(record, { fetcher, maxBytes, timeoutMs, retries, sleep });
    } catch (error) {
      return classifiedFailure(record, error);
    }
    if (!isPdf(response.body)) {
      return {
        ...baseResult(record),
        status: "NOT_A_PDF",
        final_url: response.finalUrl || record.url,
        bytes: response.body?.length ?? null,
        error: "pdf_signature_missing"
      };
    }

    const hash = sha256Buffer(response.body);
    const duplicate = firstPath(catalog.byHash.get(hash));
    if (duplicate) {
      const stats = await fs.stat(duplicate);
      return {
        ...baseResult(record),
        status: "LOCAL_FILE_EXISTS",
        local_path: duplicate,
        matched_by: "sha256_after_download",
        final_url: response.finalUrl || record.url,
        sha256: hash,
        bytes: stats.size
      };
    }

    const pendingHash = hashGates.get(hash);
    if (pendingHash) {
      await pendingHash;
      const parallelDuplicate = firstPath(catalog.byHash.get(hash));
      if (parallelDuplicate) {
        const stats = await fs.stat(parallelDuplicate);
        return {
          ...baseResult(record),
          status: "LOCAL_FILE_EXISTS",
          local_path: parallelDuplicate,
          matched_by: "sha256_after_parallel_download",
          final_url: response.finalUrl || record.url,
          sha256: hash,
          bytes: stats.size
        };
      }
    }

    let releaseHashGate;
    hashGates.set(hash, new Promise(resolve => { releaseHashGate = resolve; }));

    try {
      const targetInfo = await uniqueTarget(absoluteOutput, record.source_id, hash);
      if (!targetInfo.existing) await writePdfExclusive(targetInfo.target, response.body);
      const metadataPath = targetInfo.target.replace(/\.pdf$/iu, ".metadata.json");
      if (!await exists(metadataPath)) {
        await writeAtomic(metadataPath, `${JSON.stringify({
          source: record,
          final_url: response.finalUrl || record.url,
          redirects: response.redirects || [],
          sha256: hash,
          bytes: response.body.length,
          downloaded_at: now().toISOString()
        }, null, 2)}\n`);
      }
      addMatch(catalog.byHash, hash, targetInfo.target);
      return {
        ...baseResult(record),
        status: targetInfo.existing ? "ALREADY_DOWNLOADED" : "DOWNLOADED",
        local_path: targetInfo.target,
        matched_by: targetInfo.existing ? "existing_output_sha256" : "download",
        final_url: response.finalUrl || record.url,
        sha256: hash,
        bytes: response.body.length
      };
    } catch (error) {
      return classifiedFailure(record, error);
    } finally {
      hashGates.delete(hash);
      releaseHashGate?.();
    }
  });
  return {
    mode: "download",
    generated_at: now().toISOString(),
    counts: statusCounts(results),
    results
  };
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function reportCsv(report) {
  const fields = ["source_id", "title", "url", "status", "local_path", "matched_by", "sha256", "bytes", "error"];
  return [
    fields.map(csvCell).join(","),
    ...report.results.map(item => fields.map(field => csvCell(item[field])).join(","))
  ].join("\n") + "\n";
}

function reportMarkdown(report) {
  const counts = Object.entries(report.counts).map(([key, value]) => `- ${key}: ${value}`).join("\n");
  const failures = report.results.filter(item => item.error);
  return [
    "# Source master PDF report",
    "",
    `Generated: ${report.generated_at}`,
    `Mode: ${report.mode}`,
    "",
    "## Counts",
    "",
    counts,
    "",
    "## Failures",
    "",
    ...(failures.length ? failures.map(item => `- ${item.source_id}: ${item.error}`) : ["- none"]),
    ""
  ].join("\n");
}

async function writeAtomic(filePath, content) {
  const absolute = path.resolve(filePath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  const temporary = `${absolute}.partial-${process.pid}-${crypto.randomUUID()}`;
  try {
    await fs.writeFile(temporary, content, { flag: "wx" });
    await fs.rename(temporary, absolute);
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

export async function writeReports(reportDir, report) {
  const root = path.resolve(reportDir);
  await Promise.all([
    writeAtomic(path.join(root, "master_sources_pdf_report.json"), `${JSON.stringify(report, null, 2)}\n`),
    writeAtomic(path.join(root, "master_sources_pdf_report.csv"), reportCsv(report)),
    writeAtomic(path.join(root, "master_sources_pdf_report.md"), reportMarkdown(report))
  ]);
}
