import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { resolveKovRtXmlFile } from "../kov/rtManifest.js";

const RT_DIR_NAME = "kov_rt";
const MANIFEST_FILE_NAME = "kov_rt_manifest.json";
const CHECK_MANIFEST_FILE_NAME = "kov_rt_manifest.kontroll.json";
const CHECK_REPORT_FILE_NAME = "kov_rt_manifest.kontroll.report.json";
const CHECK_XML_DIR_NAME = "kontroll_xml";
const DEFAULT_KOV_ROOT = path.join(/*turbopackIgnore: true*/ process.cwd(), "KOV");

function clean(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || null;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
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

function rtDir(kovRoot) {
  return path.join(kovRoot, RT_DIR_NAME);
}

function manifestPath(kovRoot) {
  return path.join(rtDir(kovRoot), MANIFEST_FILE_NAME);
}

function checkManifestPath(kovRoot) {
  return path.join(rtDir(kovRoot), CHECK_MANIFEST_FILE_NAME);
}

function checkReportPath(kovRoot) {
  return path.join(rtDir(kovRoot), CHECK_REPORT_FILE_NAME);
}

function checkXmlDir(kovRoot) {
  return path.join(rtDir(kovRoot), CHECK_XML_DIR_NAME);
}

function stripTags(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function toAbsoluteRtUrl(url) {
  const value = clean(url);
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return `https://www.riigiteataja.ee${value}`;
  return `https://www.riigiteataja.ee/${value.replace(/^\/+/, "")}`;
}

function actUrlFromReference(reference) {
  const ref = clean(reference);
  return ref ? `https://www.riigiteataja.ee/akt/${ref}?leiaKehtiv` : null;
}

function extractRtPageSignals(html, fallbackUrl = "") {
  const source = String(html || "");
  const text = stripTags(source);
  const xmlHref =
    [...source.matchAll(/<a\b[^>]*href=["']([^"']+\.xml(?:\?[^"']*)?)["'][^>]*>\s*XML failina\s*<\/a>/giu)][0]?.[1] ||
    [...source.matchAll(/href=["']([^"']+\.xml(?:\?[^"']*)?)["']/giu)][0]?.[1] ||
    null;
  const xmlUrl = toAbsoluteRtUrl(xmlHref);
  const actReference =
    clean(xmlUrl?.match(/\/akt\/(\d+)\.xml/i)?.[1]) ||
    clean(fallbackUrl.match(/\/akt\/(\d+)/i)?.[1]);
  const title =
    clean(source.match(/<h1[^>]*>\s*([^<]+?)\s*<\/h1>/i)?.[1]) ||
    clean(text.match(/#?\s*Sotsiaalhoolekandelise abi andmise kord[^.]*?/i)?.[0]);
  const effectiveDate = clean(text.match(/Redaktsiooni jõustumise kp:\s*([0-9.]+)/i)?.[1]);
  const validUntil = clean(text.match(/Redaktsiooni kehtivuse lõpp:\s*([^ ]+(?: [^ ]+)*) Avaldamismärge:/i)?.[1]);
  return {
    title,
    actReference,
    actUrl: actUrlFromReference(actReference) || clean(fallbackUrl),
    xmlUrl,
    xmlFile: actReference ? `${actReference}.xml` : clean(xmlUrl?.split("/").pop()?.split("?")[0]),
    effectiveDate,
    validUntil
  };
}

async function fetchWithTimeout(url, { timeoutMs = 15_000, accept = "text/html,application/xhtml+xml" } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: accept,
        "User-Agent": "SotsiaalAI KOV RT checker/1.0 (+https://sotsiaal.ai)"
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

async function readLocalXmlHash(kovRoot, entry) {
  const resolved = await resolveKovRtXmlFile(kovRoot, entry);
  if (!resolved?.xml_found || !resolved.xml_path) return { found: false, hash: null, path: null };
  const text = await fs.readFile(resolved.xml_path, "utf8");
  return {
    found: true,
    hash: sha256(text),
    path: resolved.xml_path
  };
}

function updateEntryFromSignals(entry, signals, { remoteXmlHash = null } = {}) {
  const generated = {
    ...(entry.generated_metadata || {}),
    act_reference: signals.actReference || entry.generated_metadata?.act_reference || entry.act_reference,
    act_title: signals.title || entry.generated_metadata?.act_title || entry.act_title,
    act_url: signals.actUrl || entry.generated_metadata?.act_url || entry.act_url,
    xml_file: signals.xmlFile || entry.generated_metadata?.xml_file || entry.xml_file,
    xml_sha256: remoteXmlHash || entry.generated_metadata?.xml_sha256 || entry.xml_sha256 || null
  };
  return {
    ...entry,
    act_title: signals.title || entry.act_title,
    act_url: signals.actUrl || entry.act_url,
    act_reference: signals.actReference || entry.act_reference,
    xml_file: signals.xmlFile || entry.xml_file,
    xml_sha256: remoteXmlHash || entry.xml_sha256 || null,
    generated_metadata: generated
  };
}

function summarizeEntryChange(entry, nextEntry, details = {}) {
  const fieldChanges = [];
  for (const field of ["act_title", "act_url", "act_reference", "xml_file", "xml_sha256"]) {
    const oldValue = clean(entry?.[field]);
    const newValue = clean(nextEntry?.[field]);
    if (oldValue !== newValue) fieldChanges.push({ field, oldValue, newValue });
  }
  if (details.xmlChanged) {
    fieldChanges.push({
      field: "xml_hash",
      oldValue: details.localXmlHash || null,
      newValue: details.remoteXmlHash || null
    });
  }
  return fieldChanges;
}

function visibleChanges(report, limit = 60) {
  const changes = Array.isArray(report?.changes) ? report.changes : [];
  return changes.slice(0, limit).map((change) => ({
    slug: clean(change.slug),
    title: clean(change.title),
    actReference: clean(change.actReference),
    newActReference: clean(change.newActReference),
    xmlFile: clean(change.xmlFile),
    newXmlFile: clean(change.newXmlFile),
    fields: Array.isArray(change.fields) ? change.fields : [],
    xmlChanged: Boolean(change.xmlChanged),
    status: clean(change.status)
  }));
}

export async function checkKovRtRegistryFromWeb({
  kovRoot = DEFAULT_KOV_ROOT,
  maxUrls = 0
} = {}) {
  const sourcePath = manifestPath(kovRoot);
  const manifest = await readJson(sourcePath, null);
  const entries = Array.isArray(manifest?.entries) ? manifest.entries : [];
  if (!entries.length) throw new Error(`RT manifest puudub või on tühi: KOV/${RT_DIR_NAME}/${MANIFEST_FILE_NAME}`);

  const candidateEntries = entries.map((entry) => ({ ...entry, generated_metadata: { ...(entry.generated_metadata || {}) } }));
  const selectedIndexes = entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => /^https?:\/\//i.test(clean(entry?.act_url) || ""))
    .slice(0, maxUrls > 0 ? maxUrls : entries.length);
  const xmlOutputDir = checkXmlDir(kovRoot);
  await fs.mkdir(xmlOutputDir, { recursive: true });

  const fetchResults = [];
  const changes = [];
  let downloadedXml = 0;

  for (const { entry, index } of selectedIndexes) {
    try {
      const htmlResponse = await fetchWithTimeout(entry.act_url);
      if (!htmlResponse.ok) {
        fetchResults.push({ slug: entry.slug, url: entry.act_url, ok: false, status: htmlResponse.status, stage: "html" });
        continue;
      }

      const signals = extractRtPageSignals(htmlResponse.text, htmlResponse.url || entry.act_url);
      let remoteXmlHash = null;
      let xmlChanged = false;
      let remoteXmlFilePath = null;
      const localXml = await readLocalXmlHash(kovRoot, entry);
      if (signals.xmlUrl) {
        const xmlResponse = await fetchWithTimeout(signals.xmlUrl, { accept: "application/xml,text/xml,*/*" });
        if (xmlResponse.ok) {
          remoteXmlHash = sha256(xmlResponse.text);
          const baselineXmlHash = localXml.hash || clean(entry.xml_sha256) || clean(entry.generated_metadata?.xml_sha256);
          xmlChanged = baselineXmlHash !== remoteXmlHash;
          if (xmlChanged && signals.xmlFile) {
            remoteXmlFilePath = path.join(xmlOutputDir, signals.xmlFile);
            await fs.writeFile(remoteXmlFilePath, xmlResponse.text, "utf8");
            downloadedXml += 1;
          }
        }
        fetchResults.push({
          slug: entry.slug,
          url: entry.act_url,
          ok: htmlResponse.ok,
          status: htmlResponse.status,
          xmlUrl: signals.xmlUrl,
          xmlOk: xmlResponse.ok,
          xmlStatus: xmlResponse.status
        });
      } else {
        fetchResults.push({ slug: entry.slug, url: entry.act_url, ok: true, status: htmlResponse.status, xmlOk: false, error: "xml_link_missing" });
      }

      const nextEntry = updateEntryFromSignals(entry, signals, { remoteXmlHash });
      const fields = summarizeEntryChange(entry, nextEntry, {
        xmlChanged,
        localXmlHash: localXml.hash || clean(entry.xml_sha256) || clean(entry.generated_metadata?.xml_sha256),
        remoteXmlHash
      });
      if (fields.length) {
        candidateEntries[index] = nextEntry;
        changes.push({
          index,
          slug: clean(entry.slug),
          title: clean(entry.act_title),
          actReference: clean(entry.act_reference),
          newActReference: clean(nextEntry.act_reference),
          xmlFile: clean(entry.xml_file),
          newXmlFile: clean(nextEntry.xml_file),
          fields,
          xmlChanged,
          localXmlFound: localXml.found,
          localXmlHash: localXml.hash || clean(entry.xml_sha256) || clean(entry.generated_metadata?.xml_sha256),
          remoteXmlHash,
          candidateXmlFile: remoteXmlFilePath ? `KOV/${RT_DIR_NAME}/${CHECK_XML_DIR_NAME}/${path.basename(remoteXmlFilePath)}` : null,
          status: "changed"
        });
      }
    } catch (error) {
      fetchResults.push({
        slug: entry.slug,
        url: entry.act_url,
        ok: false,
        status: null,
        error: error?.name === "AbortError" ? "timeout" : error?.message || "fetch_failed"
      });
    }
  }

  const candidateManifest = {
    ...manifest,
    generated_at: manifest.generated_at || new Date().toISOString().slice(0, 10),
    entries: candidateEntries
  };
  const report = {
    ok: true,
    generatedAt: new Date().toISOString(),
    sourceFile: `KOV/${RT_DIR_NAME}/${MANIFEST_FILE_NAME}`,
    outputFile: `KOV/${RT_DIR_NAME}/${CHECK_MANIFEST_FILE_NAME}`,
    reportFile: `KOV/${RT_DIR_NAME}/${CHECK_REPORT_FILE_NAME}`,
    candidateXmlDir: `KOV/${RT_DIR_NAME}/${CHECK_XML_DIR_NAME}`,
    entries: entries.length,
    urls: selectedIndexes.length,
    checkedUrls: selectedIndexes.length,
    fetchedOk: fetchResults.filter((result) => result.ok).length,
    fetchedFailed: fetchResults.filter((result) => !result.ok).length,
    changedEntries: changes.length,
    downloadedXml,
    changes,
    fetchResults,
    sourceFingerprint: canonicalHash(manifest),
    candidateFingerprint: canonicalHash(candidateManifest)
  };

  await fs.writeFile(checkManifestPath(kovRoot), jsonText(candidateManifest), "utf8");
  await fs.writeFile(checkReportPath(kovRoot), jsonText(report), "utf8");
  return report;
}

export async function applyKovRtRegistryCheck({
  kovRoot = DEFAULT_KOV_ROOT
} = {}) {
  const sourcePath = manifestPath(kovRoot);
  const candidatePath = checkManifestPath(kovRoot);
  const reportPath = checkReportPath(kovRoot);
  const manifest = await readJson(sourcePath, null);
  const candidate = await readJson(candidatePath, null);
  const report = await readJson(reportPath, null);
  if (!manifest?.entries?.length) throw new Error(`RT manifest puudub või on tühi: KOV/${RT_DIR_NAME}/${MANIFEST_FILE_NAME}`);
  if (!candidate?.entries?.length) throw new Error(`RT kontrollmanifest puudub või on tühi: KOV/${RT_DIR_NAME}/${CHECK_MANIFEST_FILE_NAME}`);
  if (!report?.sourceFingerprint || !report?.candidateFingerprint) {
    throw new Error(`RT kontrollraport puudub või ei sisalda fingerprint'i: KOV/${RT_DIR_NAME}/${CHECK_REPORT_FILE_NAME}`);
  }

  if (canonicalHash(manifest) !== report.sourceFingerprint) {
    throw new Error("RT manifest on pärast kontrolli muutunud. Käivita RT kontroll uuesti.");
  }
  if (canonicalHash(candidate) !== report.candidateFingerprint) {
    throw new Error("RT kontrollmanifest ei vasta raportile. Käivita RT kontroll uuesti.");
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(rtDir(kovRoot), `backup-${stamp}`);
  await fs.mkdir(backupDir, { recursive: true });
  const backupManifest = path.join(backupDir, MANIFEST_FILE_NAME);
  await fs.copyFile(sourcePath, backupManifest);

  let appliedXml = 0;
  for (const change of Array.isArray(report.changes) ? report.changes : []) {
    const xmlFile = clean(change.newXmlFile || change.xmlFile);
    if (!xmlFile || !change.xmlChanged) continue;
    const candidateXml = path.join(checkXmlDir(kovRoot), xmlFile);
    if (!(await fileExists(candidateXml))) continue;
    const targetXml = path.join(rtDir(kovRoot), xmlFile);
    if (await fileExists(targetXml)) {
      await fs.copyFile(targetXml, path.join(backupDir, xmlFile));
    }
    await fs.copyFile(candidateXml, targetXml);
    appliedXml += 1;
  }

  await fs.writeFile(sourcePath, jsonText(candidate), "utf8");
  const appliedReport = {
    ...report,
    appliedAt: new Date().toISOString(),
    appliedBackupDir: `KOV/${RT_DIR_NAME}/${path.basename(backupDir)}`,
    appliedXml
  };
  await fs.writeFile(reportPath, jsonText(appliedReport), "utf8");

  return {
    ok: true,
    changedEntries: Number(report.changedEntries || 0),
    appliedXml,
    backupDir: appliedReport.appliedBackupDir
  };
}

export async function getKovRtRegistryStatus({
  kovRoot = DEFAULT_KOV_ROOT
} = {}) {
  const manifest = await readJson(manifestPath(kovRoot), {});
  const report = await readJson(checkReportPath(kovRoot), {});
  const entries = Array.isArray(manifest?.entries) ? manifest.entries : [];
  return {
    ok: true,
    manifestFileExists: await fileExists(manifestPath(kovRoot)),
    checkFileExists: await fileExists(checkManifestPath(kovRoot)),
    reportExists: Boolean(report && Object.keys(report).length),
    counts: {
      entries: entries.length,
      autoIngest: entries.filter((entry) => entry?.auto_ingest === true).length,
      deferred: entries.filter((entry) => clean(entry?.ingest_status)?.toLowerCase() === "deferred").length,
      withActUrl: entries.filter((entry) => /^https?:\/\//i.test(clean(entry?.act_url) || "")).length
    },
    check: {
      generatedAt: clean(report?.generatedAt),
      appliedAt: clean(report?.appliedAt),
      checkedUrls: Number(report?.checkedUrls || 0),
      fetchedOk: Number(report?.fetchedOk || 0),
      fetchedFailed: Number(report?.fetchedFailed || 0),
      changedEntries: Number(report?.changedEntries || 0),
      downloadedXml: Number(report?.downloadedXml || 0),
      outputFile: `KOV/${RT_DIR_NAME}/${CHECK_MANIFEST_FILE_NAME}`,
      reportFile: `KOV/${RT_DIR_NAME}/${CHECK_REPORT_FILE_NAME}`,
      candidateXmlDir: `KOV/${RT_DIR_NAME}/${CHECK_XML_DIR_NAME}`,
      changes: visibleChanges(report)
    }
  };
}
