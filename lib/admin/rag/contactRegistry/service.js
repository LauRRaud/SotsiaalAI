import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { prisma as defaultPrisma } from "../../../prisma.js";
import { syncKovContactsToServiceMap } from "../../../serviceMap/kovContactSync.js";

const CONTACT_FILE_NAME = "kov_kontaktid_loplik.json";
const SUMMARY_FILE_NAME = "kov_kontaktid_loplik.summary.json";
const CHECK_FILE_NAME = "kov_kontaktid_loplik.kontroll.json";
const CHECK_REPORT_FILE_NAME = "kov_kontaktid_loplik.kontroll.report.json";
const LOV_DIR = "LOV";

const LOV_FILE_CONFIG = new Map([
  ["haabersti_kontaktid_koond.json", { district: "Haabersti", slug: "tallinn-haabersti" }],
  ["kesklinn_kontaktid_koond.json", { district: "Kesklinn", slug: "tallinn-kesklinn" }],
  ["kristiine_kontaktid_koond.json", { district: "Kristiine", slug: "tallinn-kristiine" }],
  ["lasnamae_kontaktid_koond.json", { district: "Lasnamäe", slug: "tallinn-lasnamae" }],
  ["mustamae_kontaktid_koond.json", { district: "Mustamäe", slug: "tallinn-mustamae" }],
  ["nomme_kontaktid_koond.json", { district: "Nõmme", slug: "tallinn-nomme" }],
  ["pirita_kontaktid_koond.json", { district: "Pirita", slug: "tallinn-pirita" }],
  ["pohja_tallinn_kontaktid_koond.json", { district: "Põhja-Tallinn", slug: "tallinn-pohja-tallinn" }]
]);

function clean(value) {
  const text = String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
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

function normalizeForSearch(value) {
  return String(value || "")
    .toLocaleLowerCase("et")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/š/g, "s")
    .replace(/ž/g, "z")
    .replace(/[^\p{L}\p{N}@.+-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
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

async function listJsonFiles(dirPath, predicate = () => true) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json") && predicate(entry.name))
      .map((entry) => path.join(dirPath, entry.name))
      .sort((left, right) => path.basename(left).localeCompare(path.basename(right), "et"));
  } catch {
    return [];
  }
}

async function fingerprintFiles(files, rootPath) {
  const parts = [];
  for (const filePath of files) {
    const text = await fs.readFile(filePath, "utf8");
    const relativePath = path.relative(rootPath, filePath).replace(/\\/g, "/");
    parts.push(`${relativePath}:${sha256(text)}`);
  }
  return sha256(parts.join("\n"));
}

function cleanLovAddress(value) {
  const raw = clean(value);
  if (!raw) return null;
  return raw
    .split(/\s*;\s*/u)
    .map((part) => clean(part))
    .filter(Boolean)
    .filter((part, index) => {
      if (index === 0) return true;
      return !/\b(kabinet|kab\.?|ruum|ii korrus|iii korrus|iv korrus|korrus)\b/iu.test(part);
    })
    .join("; ");
}

function mapLovContact(contact, { district, slug, index }) {
  const name = clean(contact?.name);
  const role = clean(contact?.role) || clean(contact?.title) || "KOV kontakt";
  return {
    slug,
    municipality: "Tallinna linn",
    county: "Harjumaa",
    district,
    title: name ? role : role,
    name,
    role,
    department: clean(contact?.department),
    contactType: clean(contact?.contactType || contact?.contact_type) || (name ? "social_contact" : "general_social_contact"),
    serviceArea: clean(contact?.service_area || contact?.serviceArea),
    isPrimary: !name,
    phone: clean(contact?.phone) || "",
    email: clean(contact?.email)?.toLowerCase() || null,
    address: cleanLovAddress(contact?.address),
    workingHours: clean(contact?.status_note || contact?.workingHours),
    officialUrl: clean(contact?.source_url || contact?.officialUrl),
    confidence: clean(contact?.confidence) || "high",
    id: `${slug}-lov-${String(index + 1).padStart(3, "0")}`
  };
}

function isLovContact(contact) {
  const slug = clean(contact?.slug);
  return Boolean(slug && slug.startsWith("tallinn-"));
}

function unique(values) {
  return [...new Set(values.map((value) => clean(value)).filter(Boolean))];
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function decodeCloudflareEmail(encoded) {
  const hex = clean(encoded);
  if (!hex || !/^[a-f0-9]+$/i.test(hex) || hex.length < 4) return null;
  const key = Number.parseInt(hex.slice(0, 2), 16);
  let result = "";
  for (let index = 2; index < hex.length; index += 2) {
    result += String.fromCharCode(Number.parseInt(hex.slice(index, index + 2), 16) ^ key);
  }
  return /@/.test(result) ? result.toLowerCase() : null;
}

function stripTags(html) {
  return decodeHtmlEntities(
    String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  ).replace(/\s+/g, " ");
}

function extractEmailsFromText(value) {
  const plain = decodeHtmlEntities(String(value || ""))
    .replace(/\s*(?:\[|\(|\{)\s*(?:ät|at|ätt)\s*(?:\]|\)|\})\s*/giu, "@")
    .replace(/\s+(?:ät|at|ätt)\s+/giu, "@")
    .replace(/\s*(?:\[|\(|\{)\s*(?:punkt|dot)\s*(?:\]|\)|\})\s*/giu, ".")
    .replace(/\s+(?:punkt|dot)\s+/giu, ".");
  return unique(plain.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/giu) || []).map((email) => email.toLowerCase());
}

function extractPhonesFromText(value) {
  const candidates = String(value || "").match(/(?:\+372\s*)?(?:\d[\s.-]?){6,10}\d/g) || [];
  return unique(candidates.map((phone) => phone.replace(/\s+/g, " ").trim())).filter((phone) => /\d{7,}/.test(phone.replace(/\D/g, "")));
}

function extractPageSignals(html) {
  const cfEmails = unique([...String(html || "").matchAll(/data-cfemail=["']([a-f0-9]+)["']/giu)].map((match) => decodeCloudflareEmail(match[1])));
  const mailtoEmails = unique([...String(html || "").matchAll(/mailto:([^"'?#\s>]+)/giu)].map((match) => decodeURIComponent(match[1])));
  const text = stripTags(html);
  const emails = unique([...cfEmails, ...mailtoEmails, ...extractEmailsFromText(html), ...extractEmailsFromText(text)]).map((email) => email.toLowerCase());
  return {
    text,
    normalizedText: normalizeForSearch(text),
    emails,
    phones: extractPhonesFromText(text),
    decodedProtectedEmails: cfEmails
  };
}

function emailLooksLikeName(email, name) {
  const local = normalizeForSearch(String(email || "").split("@")[0]).replace(/\s/g, ".");
  const tokens = normalizeForSearch(name).split(" ").filter((token) => token.length > 1);
  if (!local || tokens.length < 2) return false;
  return tokens.every((token) => local.includes(token));
}

function findNearbyEmail(page, contact) {
  const name = clean(contact?.name);
  if (!page || !name) return null;
  const normalizedName = normalizeForSearch(name);
  const index = page.normalizedText.indexOf(normalizedName);
  if (index === -1) return null;
  const windowText = page.normalizedText.slice(Math.max(0, index - 900), index + normalizedName.length + 900);
  const nearby = page.emails.filter((email) => windowText.includes(normalizeForSearch(email)));
  const nameLike = page.emails.filter((email) => emailLooksLikeName(email, name));
  const candidates = unique([...nearby, ...nameLike]);
  if (candidates.length === 1) {
    return {
      email: candidates[0],
      confidence: nearby.includes(candidates[0]) && nameLike.includes(candidates[0]) ? "high" : "medium",
      reason: nearby.includes(candidates[0]) ? "email_near_name" : "email_matches_name"
    };
  }
  return null;
}

function findSinglePageEmail(page, contact) {
  if (!page || clean(contact?.name)) return null;
  if (page.emails.length === 1) {
    return {
      email: page.emails[0],
      confidence: "medium",
      reason: "single_email_on_general_contact_page"
    };
  }
  return null;
}

async function fetchWithTimeout(url, { timeoutMs = 12_000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "SotsiaalAI contact registry checker/1.0 (+https://sotsiaal.ai)"
      }
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      text
    };
  } finally {
    clearTimeout(timeout);
  }
}

function sourceUrlForContact(contact) {
  return clean(contact?.officialUrl || contact?.sourceUrl || contact?.url_canonical || contact?.website);
}

function shouldUseFoundEmail(contact, match) {
  if (!match?.email) return false;
  const current = clean(contact?.email)?.toLowerCase();
  if (!current) return true;
  if (current === match.email) return false;
  return match.confidence === "high";
}

function compareContacts(before, after) {
  const changes = [];
  before.forEach((contact, index) => {
    const next = after[index] || {};
    for (const field of ["email", "phone", "address", "officialUrl"]) {
      const oldValue = clean(contact?.[field]);
      const newValue = clean(next?.[field]);
      if (oldValue !== newValue) {
        changes.push({
          index,
          slug: clean(contact?.slug),
          name: clean(contact?.name || contact?.title),
          field,
          oldValue,
          newValue
        });
      }
    }
  });
  return changes;
}

function visibleChanges(report, limit = 50) {
  const changes = Array.isArray(report?.changes) ? report.changes : [];
  return changes.slice(0, limit).map((change) => ({
    index: change.index,
    slug: clean(change.slug),
    name: clean(change.name),
    field: clean(change.field),
    oldValue: clean(change.oldValue),
    newValue: clean(change.newValue)
  }));
}

async function readLovSourceUrls(kovRoot) {
  const lovPath = path.join(kovRoot, LOV_DIR);
  const files = await listJsonFiles(lovPath, (name) => LOV_FILE_CONFIG.has(name));
  const urls = [];
  for (const filePath of files) {
    const data = await readJson(filePath, {});
    urls.push(...(Array.isArray(data?.source_urls) ? data.source_urls : []));
  }
  return unique(urls);
}

export async function checkKovContactRegistryFromWeb({
  kovRoot = path.resolve(process.cwd(), "KOV"),
  maxUrls = 0
} = {}) {
  const contactFilePath = path.join(kovRoot, CONTACT_FILE_NAME);
  const checkFilePath = path.join(kovRoot, CHECK_FILE_NAME);
  const reportFilePath = path.join(kovRoot, CHECK_REPORT_FILE_NAME);
  const contacts = await readJson(contactFilePath, null);
  if (!Array.isArray(contacts) || contacts.length === 0) {
    throw new Error(`Keskne kontaktfail puudub või on tühi: KOV/${CONTACT_FILE_NAME}`);
  }

  const candidate = contacts.map((contact) => ({ ...contact }));
  const directUrls = contacts.map(sourceUrlForContact);
  const lovSourceUrls = await readLovSourceUrls(kovRoot);
  const urls = unique([...directUrls, ...lovSourceUrls]).filter((url) => /^https?:\/\//i.test(url));
  const selectedUrls = maxUrls > 0 ? urls.slice(0, maxUrls) : urls;
  const pageCache = new Map();
  const fetchResults = [];

  for (const url of selectedUrls) {
    try {
      const response = await fetchWithTimeout(url);
      const page = response.ok ? extractPageSignals(response.text) : null;
      pageCache.set(url, page);
      fetchResults.push({
        url,
        ok: response.ok,
        status: response.status,
        emails: page?.emails?.length || 0,
        protectedEmailsDecoded: page?.decodedProtectedEmails?.length || 0
      });
    } catch (error) {
      pageCache.set(url, null);
      fetchResults.push({
        url,
        ok: false,
        status: null,
        error: error?.name === "AbortError" ? "timeout" : error?.message || "fetch_failed"
      });
    }
  }

  const matches = [];
  candidate.forEach((contact, index) => {
    const url = sourceUrlForContact(contact);
    const page = url ? pageCache.get(url) : null;
    const match = findNearbyEmail(page, contact) || findSinglePageEmail(page, contact);
    if (!match) return;

    const currentEmail = clean(contact.email)?.toLowerCase() || null;
    const changed = shouldUseFoundEmail(contact, match);
    if (changed) {
      candidate[index] = {
        ...candidate[index],
        email: match.email,
        confidence: match.confidence === "high" ? "high" : candidate[index].confidence || "medium"
      };
    }

    matches.push({
      index,
      slug: clean(contact.slug),
      name: clean(contact.name || contact.title),
      officialUrl: url,
      currentEmail,
      foundEmail: match.email,
      confidence: match.confidence,
      reason: match.reason,
      changed
    });
  });

  const changes = compareContacts(contacts, candidate);
  const report = {
    ok: true,
    generatedAt: new Date().toISOString(),
    sourceFile: `KOV/${CONTACT_FILE_NAME}`,
    outputFile: `KOV/${CHECK_FILE_NAME}`,
    reportFile: `KOV/${CHECK_REPORT_FILE_NAME}`,
    contacts: contacts.length,
    urls: urls.length,
    checkedUrls: selectedUrls.length,
    skippedUrls: urls.length - selectedUrls.length,
    fetchedOk: fetchResults.filter((result) => result.ok).length,
    fetchedFailed: fetchResults.filter((result) => !result.ok).length,
    protectedEmailsDecoded: fetchResults.reduce((sum, result) => sum + (result.protectedEmailsDecoded || 0), 0),
    matches: matches.length,
    changedContacts: changes.length,
    changes,
    emailMatches: matches,
    fetchResults,
    sourceFingerprint: canonicalHash(contacts),
    candidateFingerprint: canonicalHash(candidate)
  };

  await fs.writeFile(checkFilePath, jsonText(candidate), "utf8");
  await fs.writeFile(reportFilePath, jsonText(report), "utf8");

  return report;
}

export async function applyKovContactRegistryCheck({
  kovRoot = path.resolve(process.cwd(), "KOV"),
  prisma = defaultPrisma,
  syncServiceMap = false
} = {}) {
  const contactFilePath = path.join(kovRoot, CONTACT_FILE_NAME);
  const checkFilePath = path.join(kovRoot, CHECK_FILE_NAME);
  const reportFilePath = path.join(kovRoot, CHECK_REPORT_FILE_NAME);
  const contacts = await readJson(contactFilePath, null);
  const candidate = await readJson(checkFilePath, null);
  const report = await readJson(reportFilePath, null);

  if (!Array.isArray(contacts) || contacts.length === 0) {
    throw new Error(`Keskne kontaktfail puudub või on tühi: KOV/${CONTACT_FILE_NAME}`);
  }
  if (!Array.isArray(candidate) || candidate.length === 0) {
    throw new Error(`Kontrollfail puudub või on tühi: KOV/${CHECK_FILE_NAME}`);
  }
  if (!report?.candidateFingerprint || !report?.sourceFingerprint) {
    throw new Error(`Kontrollraport puudub või ei sisalda fingerprint'i: KOV/${CHECK_REPORT_FILE_NAME}`);
  }

  const currentFingerprint = canonicalHash(contacts);
  const candidateFingerprint = canonicalHash(candidate);
  if (currentFingerprint !== report.sourceFingerprint) {
    throw new Error("Põhifail on pärast kontrolli muutunud. Käivita veebikontroll uuesti.");
  }
  if (candidateFingerprint !== report.candidateFingerprint) {
    throw new Error("Kontrollfail ei vasta raportile. Käivita veebikontroll uuesti.");
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = path.join(kovRoot, `kov_kontaktid_loplik.bak-${stamp}.json`);
  await fs.copyFile(contactFilePath, backupFile);
  await fs.writeFile(contactFilePath, jsonText(candidate), "utf8");

  const appliedReport = {
    ...report,
    appliedAt: new Date().toISOString(),
    appliedBackupFile: path.relative(kovRoot, backupFile).replace(/\\/g, "/")
  };
  await fs.writeFile(reportFilePath, jsonText(appliedReport), "utf8");

  const result = {
    ok: true,
    appliedContacts: candidate.length,
    changedContacts: Number(report.changedContacts || 0),
    backupFile: `KOV/${appliedReport.appliedBackupFile}`,
    sync: null
  };

  if (syncServiceMap) {
    const sync = await syncKovContactsToServiceMap({
      kovRoot,
      prisma,
      dryRun: false
    });
    result.sync = {
      scannedFiles: sync.scannedFiles,
      scannedContacts: sync.scannedContacts,
      skipped: sync.skipped,
      upserted: sync.upserted
    };
  }

  return result;
}

async function readLovContacts(kovRoot) {
  const lovPath = path.join(kovRoot, LOV_DIR);
  const files = await listJsonFiles(lovPath, (name) => LOV_FILE_CONFIG.has(name));
  const contacts = [];
  let addressCleanups = 0;

  for (const filePath of files) {
    const fileName = path.basename(filePath);
    const config = LOV_FILE_CONFIG.get(fileName);
    const data = await readJson(filePath, {});
    const rows = Array.isArray(data?.contacts) ? data.contacts : [];
    rows.forEach((contact, index) => {
      const mapped = mapLovContact(contact, config ? { ...config, index } : { district: clean(data?.district), slug: "tallinn-lov", index });
      if (clean(contact?.address) && mapped.address !== clean(contact.address)) addressCleanups += 1;
      contacts.push(mapped);
    });
  }

  return { files, contacts, addressCleanups };
}

function summarizeContacts(contacts, { kovFiles, lovFiles, lovContacts, sourceFingerprint, outputFingerprint, addressCleanups }) {
  const activeContacts = contacts.filter((contact) => contact?.active !== false);
  const contactsWithEmail = contacts.filter((contact) => clean(contact?.email)).length;
  return {
    generatedAt: new Date().toISOString(),
    sourceFolder: "KOV",
    sourceFiles: [
      ...kovFiles.map((filePath) => path.relative("KOV", filePath).replace(/\\/g, "/")),
      ...lovFiles.map((filePath) => path.relative("KOV", filePath).replace(/\\/g, "/"))
    ],
    outputFile: `KOV/${CONTACT_FILE_NAME}`,
    sourceRows: contacts.length,
    contacts: contacts.length,
    contactsWithEmail,
    contactsMissingEmail: contacts.length - contactsWithEmail,
    inactiveContacts: contacts.length - activeContacts.length,
    displayableContacts: activeContacts.length,
    lovSourceFolder: "KOV/LOV",
    lovSourceFiles: lovFiles.map((filePath) => path.relative("KOV", filePath).replace(/\\/g, "/")),
    tallinnLovContacts: lovContacts.length,
    tallinnLovDistricts: new Set(lovContacts.map((contact) => contact.district).filter(Boolean)).size,
    tallinnLovStableIds: lovContacts.filter((contact) => clean(contact.id)).length,
    tallinnLovAddressCleanups: addressCleanups,
    sourceFingerprint,
    outputFingerprint
  };
}

export async function buildKovContactRegistry({ kovRoot = path.resolve(process.cwd(), "KOV") } = {}) {
  const contactFilePath = path.join(kovRoot, CONTACT_FILE_NAME);
  const existingContacts = await readJson(contactFilePath, []);
  const hasCentralContacts = Array.isArray(existingContacts) && existingContacts.length > 0;
  const kov = {
    files: hasCentralContacts ? [contactFilePath] : [],
    contacts: hasCentralContacts ? existingContacts.filter((contact) => !isLovContact(contact)) : []
  };
  const lov = await readLovContacts(kovRoot);
  const sourceFiles = lov.files;
  const contacts = [...kov.contacts, ...lov.contacts];
  const sourceFingerprint = await fingerprintFiles(sourceFiles, kovRoot);
  const outputFingerprint = canonicalHash(contacts);
  const summary = summarizeContacts(contacts, {
    kovFiles: kov.files,
    lovFiles: lov.files,
    lovContacts: lov.contacts,
    sourceFingerprint,
    outputFingerprint,
    addressCleanups: lov.addressCleanups
  });

  return {
    kovRoot,
    contactFilePath,
    summaryFilePath: path.join(kovRoot, SUMMARY_FILE_NAME),
    sourceFiles,
    contacts,
    summary
  };
}

async function getServiceMapStatus(prisma) {
  try {
    const [total, byStatus] = await Promise.all([
      prisma.serviceMapEntry.count({ where: { type: { in: ["KOV_SOCIAL_CONTACT", "KOV_GENERAL_CONTACT"] } } }),
      prisma.serviceMapEntry.groupBy({
        by: ["geocodingStatus"],
        where: { type: { in: ["KOV_SOCIAL_CONTACT", "KOV_GENERAL_CONTACT"] } },
        _count: true
      })
    ]);
    return {
      ok: true,
      total,
      geocodingStatus: byStatus.reduce((result, row) => {
        result[row.geocodingStatus || "UNKNOWN"] = row._count;
        return result;
      }, {})
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Service map status unavailable"
    };
  }
}

export async function getKovContactRegistryStatus({
  kovRoot = path.resolve(process.cwd(), "KOV"),
  prisma = defaultPrisma
} = {}) {
  const registry = await buildKovContactRegistry({ kovRoot });
  const existingContacts = await readJson(registry.contactFilePath, []);
  const existingSummary = await readJson(registry.summaryFilePath, {});
  const checkReport = await readJson(path.join(kovRoot, CHECK_REPORT_FILE_NAME), {});
  const contactFileExists = await fileExists(registry.contactFilePath);
  const summarySourceFingerprint = clean(existingSummary?.sourceFingerprint);
  const summaryOutputFingerprint = clean(existingSummary?.outputFingerprint);
  const currentOutputFingerprint = Array.isArray(existingContacts) ? canonicalHash(existingContacts) : null;
  const sourceChanged = summarySourceFingerprint ? summarySourceFingerprint !== registry.summary.sourceFingerprint : null;
  const outputChanged = summaryOutputFingerprint && currentOutputFingerprint
    ? summaryOutputFingerprint !== currentOutputFingerprint
    : null;
  const generatedDiffersFromContactFile = currentOutputFingerprint
    ? currentOutputFingerprint !== registry.summary.outputFingerprint
    : null;

  return {
    ok: true,
    contactFileExists,
    summaryFileExists: Boolean(existingSummary && Object.keys(existingSummary).length),
    generatedAt: clean(existingSummary?.generatedAt),
    sourceFingerprint: registry.summary.sourceFingerprint,
    storedSourceFingerprint: summarySourceFingerprint,
    sourceChanged,
    outputChanged,
    generatedDiffersFromContactFile,
    needsRefresh: !contactFileExists || sourceChanged === true || !summarySourceFingerprint,
    counts: {
      sourceFiles: registry.sourceFiles.length,
      generatedContacts: registry.contacts.length,
      existingContacts: Array.isArray(existingContacts) ? existingContacts.length : 0,
      contactsWithEmail: registry.summary.contactsWithEmail,
      contactsMissingEmail: registry.summary.contactsMissingEmail,
      tallinnLovContacts: registry.summary.tallinnLovContacts,
      tallinnLovDistricts: registry.summary.tallinnLovDistricts
    },
    check: {
      fileExists: await fileExists(path.join(kovRoot, CHECK_FILE_NAME)),
      reportExists: Boolean(checkReport && Object.keys(checkReport).length),
      generatedAt: clean(checkReport?.generatedAt),
      appliedAt: clean(checkReport?.appliedAt),
      checkedUrls: Number(checkReport?.checkedUrls || 0),
      changedContacts: Number(checkReport?.changedContacts || 0),
      protectedEmailsDecoded: Number(checkReport?.protectedEmailsDecoded || 0),
      changes: visibleChanges(checkReport),
      emailChanges: visibleChanges({
        changes: (Array.isArray(checkReport?.changes) ? checkReport.changes : []).filter((change) => change?.field === "email")
      }),
      outputFile: `KOV/${CHECK_FILE_NAME}`,
      reportFile: `KOV/${CHECK_REPORT_FILE_NAME}`
    },
    serviceMap: await getServiceMapStatus(prisma)
  };
}

export async function writeKovContactRegistryBaseline({
  kovRoot = path.resolve(process.cwd(), "KOV")
} = {}) {
  const registry = await buildKovContactRegistry({ kovRoot });
  await fs.writeFile(registry.summaryFilePath, jsonText(registry.summary), "utf8");

  return {
    ok: true,
    summaryFile: `KOV/${SUMMARY_FILE_NAME}`,
    generatedAt: registry.summary.generatedAt,
    sourceFiles: registry.summary.sourceFiles.length,
    contacts: registry.summary.contacts,
    outputFile: registry.summary.outputFile
  };
}

export async function refreshKovContactRegistry({
  kovRoot = path.resolve(process.cwd(), "KOV"),
  prisma = defaultPrisma,
  syncServiceMap = false
} = {}) {
  const contactFilePath = path.join(kovRoot, CONTACT_FILE_NAME);
  const existingContacts = await readJson(contactFilePath, null);
  if (!Array.isArray(existingContacts) || existingContacts.length === 0) {
    throw new Error(`Keskne kontaktfail puudub või on tühi: KOV/${CONTACT_FILE_NAME}`);
  }

  const registry = await buildKovContactRegistry({ kovRoot });
  await fs.writeFile(registry.contactFilePath, jsonText(registry.contacts), "utf8");
  await fs.writeFile(registry.summaryFilePath, jsonText(registry.summary), "utf8");

  const result = {
    ok: true,
    summary: registry.summary,
    sync: null
  };

  if (syncServiceMap) {
    const sync = await syncKovContactsToServiceMap({
      kovRoot,
      prisma,
      dryRun: false
    });
    result.sync = {
      scannedFiles: sync.scannedFiles,
      scannedContacts: sync.scannedContacts,
      skipped: sync.skipped,
      upserted: sync.upserted
    };
  }

  return result;
}
