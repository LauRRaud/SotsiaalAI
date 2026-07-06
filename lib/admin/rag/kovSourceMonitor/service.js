import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const REPORT_FILE_NAME = "kov_web_sources_kontroll.report.json";
const TECHNICAL_DIRS = new Set(["Kodeerimine", "LOV", "kov_rt"]);
const DEFAULT_KOV_ROOT = "KOV";

function clean(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || null;
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      result[key] = canonical(value[key]);
      return result;
    }, {});
}

function canonicalHash(value) {
  return sha256(JSON.stringify(canonical(value)));
}

async function readJson(filePath, fallback = null) {
  try {
    const text = await fs.readFile(filePath, "utf8");
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function stripTags(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePageText(html) {
  return stripTags(html)
    .toLocaleLowerCase("et")
    .replace(/\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html) {
  return clean(String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]) ||
    clean(String(html || "").match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
}

async function fetchWithTimeout(url, { timeoutMs = 15_000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml,*/*",
        "User-Agent": "SotsiaalAI KOV source monitor/1.0 (+https://sotsiaal.ai)"
      }
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      url: response.url || url,
      text
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function discoverSourceFiles(kovRoot) {
  let entries;
  try {
    entries = await fs.readdir(kovRoot, { withFileTypes: true });
  } catch {
    // KOV allikakaust puudub (nt eemaldatud) -> tuhi loend, mitte throw.
    return [];
  }
  const files = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || TECHNICAL_DIRS.has(entry.name)) continue;
    const filePath = path.join(kovRoot, entry.name, `${entry.name}.sources.json`);
    if (await fileExists(filePath)) files.push({ slug: entry.name, filePath });
  }
  return files.sort((left, right) => left.slug.localeCompare(right.slug, "et"));
}

function sourceUrl(source) {
  return clean(source?.url_canonical || source?.url || source?.officialUrl);
}

function isCheckableSource(source) {
  const url = sourceUrl(source);
  if (!/^https?:\/\//i.test(url || "")) return false;
  if (clean(source?.source_status)?.toLowerCase() === "inactive") return false;
  const format = clean(source?.source_format || source?.format)?.toLowerCase();
  return !format || ["html", "web", "web_page"].includes(format) || /\/$|\.ee\//i.test(url);
}

function buildPageSnapshot(response) {
  const normalizedText = normalizePageText(response.text);
  return {
    finalUrl: clean(response.url),
    title: extractTitle(response.text),
    contentHash: sha256(normalizedText),
    contentLength: normalizedText.length,
    sample: normalizedText.slice(0, 420)
  };
}

function baselineHash(source) {
  return clean(source?.web_content_sha256 || source?.webContentSha256 || source?.remote_content_sha256);
}

function updateSourceCandidate(source, snapshot, checkedAt) {
  return {
    ...source,
    web_content_sha256: snapshot.contentHash,
    web_content_length: snapshot.contentLength,
    web_checked_at: checkedAt,
    web_final_url: snapshot.finalUrl || sourceUrl(source),
    web_title: snapshot.title || clean(source?.web_title)
  };
}

export async function checkKovWebSourcesFromWeb({
  kovRoot = DEFAULT_KOV_ROOT,
  maxUrls = 0,
  slug = ""
} = {}) {
  const allFiles = await discoverSourceFiles(kovRoot);
  const sourceFiles = slug ? allFiles.filter((file) => file.slug === String(slug).trim().toLowerCase()) : allFiles;
  if (!sourceFiles.length) throw new Error(slug ? `KOV sources file not found for ${slug}` : "KOV sources files not found");

  const checkedAt = new Date().toISOString();
  const reportItems = [];
  const fileReports = [];
  let checkedUrls = 0;
  let fetchedOk = 0;
  let fetchedFailed = 0;
  let changedSources = 0;
  let baselineMissing = 0;
  let candidatesWritten = 0;

  for (const sourceFile of sourceFiles) {
    const payload = await readJson(sourceFile.filePath, null);
    const sources = Array.isArray(payload?.sources) ? payload.sources : [];
    const candidateSources = sources.map((source) => ({ ...source }));
    const selected = sources
      .map((source, index) => ({ source, index, url: sourceUrl(source) }))
      .filter(({ source }) => isCheckableSource(source));
    const limited = maxUrls > 0 ? selected.slice(0, Math.max(0, maxUrls - checkedUrls)) : selected;
    const fileChanges = [];
    const fetchResults = [];

    for (const item of limited) {
      if (maxUrls > 0 && checkedUrls >= maxUrls) break;
      checkedUrls += 1;
      try {
        const response = await fetchWithTimeout(item.url);
        if (!response.ok) {
          fetchedFailed += 1;
          fetchResults.push({ url: item.url, ok: false, status: response.status });
          reportItems.push({ slug: sourceFile.slug, sourceKey: clean(item.source.source_key || item.source.key), url: item.url, status: "fetch_failed", httpStatus: response.status });
          continue;
        }
        fetchedOk += 1;
        const snapshot = buildPageSnapshot(response);
        const baseline = baselineHash(item.source);
        const status = baseline ? (baseline === snapshot.contentHash ? "unchanged" : "changed") : "baseline_missing";
        if (status === "changed") changedSources += 1;
        if (status === "baseline_missing") baselineMissing += 1;
        fetchResults.push({ url: item.url, ok: true, status: response.status, contentLength: snapshot.contentLength });

        if (status !== "unchanged") {
          candidateSources[item.index] = updateSourceCandidate(candidateSources[item.index], snapshot, checkedAt);
          const change = {
            slug: sourceFile.slug,
            sourceKey: clean(item.source.source_key || item.source.key || item.source.source_id),
            title: clean(item.source.title),
            url: item.url,
            finalUrl: snapshot.finalUrl,
            status,
            oldHash: baseline,
            newHash: snapshot.contentHash,
            contentLength: snapshot.contentLength,
            titleNow: snapshot.title,
            sample: snapshot.sample
          };
          fileChanges.push(change);
          reportItems.push(change);
        }
      } catch (error) {
        fetchedFailed += 1;
        fetchResults.push({ url: item.url, ok: false, status: null, error: error?.name === "AbortError" ? "timeout" : error?.message || "fetch_failed" });
        reportItems.push({
          slug: sourceFile.slug,
          sourceKey: clean(item.source.source_key || item.source.key),
          url: item.url,
          status: "fetch_failed",
          error: error?.name === "AbortError" ? "timeout" : error?.message || "fetch_failed"
        });
      }
    }

    const candidatePayload = { ...payload, sources: candidateSources };
    const candidatePath = path.join(path.dirname(sourceFile.filePath), `${sourceFile.slug}.sources.kontroll.json`);
    if (fileChanges.length) {
      await fs.writeFile(candidatePath, jsonText(candidatePayload), "utf8");
      candidatesWritten += 1;
    }
    fileReports.push({
      slug: sourceFile.slug,
      sourceFile: path.relative(kovRoot, sourceFile.filePath).replace(/\\/g, "/"),
      candidateFile: fileChanges.length ? path.relative(kovRoot, candidatePath).replace(/\\/g, "/") : null,
      sources: sources.length,
      checkableSources: selected.length,
      checkedSources: limited.length,
      changes: fileChanges.length,
      sourceFingerprint: canonicalHash(payload),
      candidateFingerprint: canonicalHash(candidatePayload),
      fetchResults
    });
  }

  const report = {
    ok: true,
    generatedAt: checkedAt,
    sourceFolder: "KOV",
    reportFile: `KOV/${REPORT_FILE_NAME}`,
    files: sourceFiles.length,
    checkedUrls,
    fetchedOk,
    fetchedFailed,
    changedSources,
    baselineMissing,
    candidatesWritten,
    items: reportItems,
    fileReports
  };
  await fs.writeFile(path.join(kovRoot, REPORT_FILE_NAME), jsonText(report), "utf8");
  return report;
}

export async function applyKovWebSourcesCheck({
  kovRoot = DEFAULT_KOV_ROOT
} = {}) {
  const reportPath = path.join(kovRoot, REPORT_FILE_NAME);
  const report = await readJson(reportPath, null);
  if (!report?.fileReports?.length) throw new Error(`KOV veebiallikate raport puudub: KOV/${REPORT_FILE_NAME}`);

  const applied = [];
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  for (const fileReport of report.fileReports) {
    if (!fileReport.candidateFile) continue;
    const sourcePath = path.join(kovRoot, fileReport.sourceFile);
    const candidatePath = path.join(kovRoot, fileReport.candidateFile);
    const source = await readJson(sourcePath, null);
    const candidate = await readJson(candidatePath, null);
    if (!source || !candidate) continue;
    if (canonicalHash(source) !== fileReport.sourceFingerprint) {
      throw new Error(`${fileReport.slug}: sources file changed after check. Run web check again.`);
    }
    if (canonicalHash(candidate) !== fileReport.candidateFingerprint) {
      throw new Error(`${fileReport.slug}: candidate file does not match report. Run web check again.`);
    }
    const backupPath = path.join(path.dirname(sourcePath), `${fileReport.slug}.sources.bak-${stamp}.json`);
    await fs.copyFile(sourcePath, backupPath);
    await fs.writeFile(sourcePath, jsonText(candidate), "utf8");
    applied.push({
      slug: fileReport.slug,
      changes: fileReport.changes,
      backupFile: path.relative(kovRoot, backupPath).replace(/\\/g, "/")
    });
  }

  const appliedReport = {
    ...report,
    appliedAt: new Date().toISOString(),
    applied
  };
  await fs.writeFile(reportPath, jsonText(appliedReport), "utf8");
  return {
    ok: true,
    appliedFiles: applied.length,
    appliedChanges: applied.reduce((sum, item) => sum + Number(item.changes || 0), 0),
    reportFile: `KOV/${REPORT_FILE_NAME}`
  };
}

export async function getKovWebSourcesStatus({
  kovRoot = DEFAULT_KOV_ROOT
} = {}) {
  const sourceFiles = await discoverSourceFiles(kovRoot);
  const report = await readJson(path.join(kovRoot, REPORT_FILE_NAME), {});
  return {
    ok: true,
    sourceFiles: sourceFiles.length,
    reportExists: Boolean(report && Object.keys(report).length),
    report: {
      generatedAt: clean(report?.generatedAt),
      appliedAt: clean(report?.appliedAt),
      checkedUrls: Number(report?.checkedUrls || 0),
      fetchedOk: Number(report?.fetchedOk || 0),
      fetchedFailed: Number(report?.fetchedFailed || 0),
      changedSources: Number(report?.changedSources || 0),
      baselineMissing: Number(report?.baselineMissing || 0),
      candidatesWritten: Number(report?.candidatesWritten || 0),
      reportFile: `KOV/${REPORT_FILE_NAME}`,
      items: Array.isArray(report?.items) ? report.items.slice(0, 80) : []
    }
  };
}
