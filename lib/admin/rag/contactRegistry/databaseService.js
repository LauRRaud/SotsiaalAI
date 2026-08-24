import { prisma as defaultPrisma } from "../../../prisma.js";
import { getServiceMapStatus } from "./service.js";
import { safeFetch } from "../../../../scripts/lib/safe-fetch.mjs";

const CONTACT_TYPES = ["KOV_SOCIAL_CONTACT", "KOV_GENERAL_CONTACT"];
const CHECK_ACTION = "SERVICE_MAP_CONTACT_FRESHNESS_CHECK";
const CHECK_RESOURCE_TYPE = "ServiceMapContactRegistry";
const DEFAULT_CONCURRENCY = 5;
const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_CANDIDATE_PREVIEW = 80;
const MAX_FAILURE_PREVIEW = 40;

function clean(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || null;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLocaleLowerCase("et")
    .replace(/[^\p{Letter}\p{Number}@.+-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&nbsp;|&#160;/giu, " ")
    .replace(/&amp;|&#38;/giu, "&")
    .replace(/&quot;|&#34;/giu, "\"")
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/&lt;|&#60;/giu, "<")
    .replace(/&gt;|&#62;/giu, ">");
}

function decodeCloudflareEmail(value) {
  const encoded = String(value || "").trim();
  if (!/^[a-f0-9]+$/iu.test(encoded) || encoded.length < 4) return null;
  const key = Number.parseInt(encoded.slice(0, 2), 16);
  let email = "";
  for (let index = 2; index < encoded.length; index += 2) {
    email += String.fromCharCode(Number.parseInt(encoded.slice(index, index + 2), 16) ^ key);
  }
  return email.includes("@") ? email.toLocaleLowerCase("et") : null;
}

function cloudflareEmails(html) {
  const encoded = [
    ...String(html || "").matchAll(/data-cfemail=["']([a-f0-9]+)["']/giu),
    ...String(html || "").matchAll(/\/email-protection#([a-f0-9]+)/giu)
  ];
  return Array.from(new Set(encoded.map(match => decodeCloudflareEmail(match[1])).filter(Boolean)));
}

function rot13(value) {
  return String(value || "").replace(/[a-z]/giu, letter => {
    const code = letter.charCodeAt(0);
    const base = code >= 97 ? 97 : 65;
    return String.fromCharCode(base + ((code - base + 13) % 26));
  });
}

function encodedAttributeEmails(html) {
  return Array.from(String(html || "").matchAll(/data-enc-email=["']([^"']+)["']/giu))
    .map(match => rot13(decodeHtml(match[1]).replace(/\s*\[at\]\s*/giu, "@")))
    .filter(email => email.includes("@"))
    .map(email => email.toLocaleLowerCase("et"));
}

function pageSignals(buffer) {
  const html = buffer.toString("utf8");
  const decodedEmails = Array.from(new Set([
    ...cloudflareEmails(html),
    ...encodedAttributeEmails(html)
  ]));
  const text = decodeHtml(html)
    .replace(/<script[\s\S]*?<\/script>/giu, " ")
    .replace(/<style[\s\S]*?<\/style>/giu, " ")
    .replace(/<svg[\s\S]*?<\/svg>/giu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    normalized: normalizeText(text),
    lowercase: `${html}\n${text}\n${decodedEmails.join("\n")}`.toLocaleLowerCase("et"),
    digits: `${html}\n${text}`.replace(/\D/g, "")
  };
}

function phoneNumbers(value) {
  return String(value || "")
    .split(/\s*(?:\/|,|;|\||\bor\b|\bvoi\b|\bvõi\b)\s*/giu)
    .map(part => part.replace(/\D/g, ""))
    .filter(digits => digits.length >= 7)
    .map(digits => digits.startsWith("372") && digits.length > 7 ? digits.slice(3) : digits);
}

function entrySignals(entry, page) {
  const title = normalizeText(entry.title);
  const email = clean(entry.email)?.toLocaleLowerCase("et") || null;
  const phones = phoneNumbers(entry.phone);
  const titleSeen = Boolean(title && page.normalized.includes(title));
  const emailSeen = !email || page.lowercase.includes(email);
  const phoneSeen = !phones.length || phones.every(phone => page.digits.includes(phone));
  const reasons = [];
  if (!titleSeen) reasons.push("contact_name_not_found");
  if (!emailSeen) reasons.push("email_not_found");
  if (!phoneSeen) reasons.push("phone_not_found");
  return {
    verified: titleSeen && emailSeen && phoneSeen,
    reasons
  };
}

function groupByUrl(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const url = clean(entry.sourceUrl);
    if (!url) continue;
    if (!groups.has(url)) groups.set(url, []);
    groups.get(url).push(entry);
  }
  return [...groups.entries()].map(([url, contacts]) => ({ url, contacts }));
}

async function runWorkers(items, concurrency, worker) {
  let cursor = 0;
  const results = new Array(items.length);
  const runners = Array.from({ length: Math.min(Math.max(1, concurrency), items.length || 1) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

function contactWhere() {
  return {
    type: { in: CONTACT_TYPES },
    status: "PUBLISHED",
    tombstonedAt: null
  };
}

async function latestCheck(prisma) {
  return prisma.dataAuditLog.findFirst({
    where: {
      action: CHECK_ACTION,
      resourceType: CHECK_RESOURCE_TYPE
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, meta: true }
  });
}

export async function getDatabaseContactRegistryStatus({ prisma = defaultPrisma } = {}) {
  const [existingContacts, latest, serviceMap] = await Promise.all([
    prisma.serviceMapEntry.count({ where: contactWhere() }),
    latestCheck(prisma),
    getServiceMapStatus(prisma)
  ]);
  const meta = latest?.meta && typeof latest.meta === "object" ? latest.meta : {};
  const candidates = Array.isArray(meta.candidates) ? meta.candidates : [];
  return {
    ok: true,
    mode: "database",
    generatedAt: latest?.createdAt?.toISOString?.() || null,
    sourceChanged: Number(meta.changedContacts || 0) > 0,
    needsRefresh: false,
    counts: { existingContacts },
    check: {
      fileExists: false,
      reportExists: Boolean(latest),
      generatedAt: latest?.createdAt?.toISOString?.() || null,
      appliedAt: null,
      checkedUrls: Number(meta.checkedUrls || 0),
      checkedContacts: Number(meta.checkedContacts || 0),
      verifiedContacts: Number(meta.verifiedContacts || 0),
      changedContacts: Number(meta.changedContacts || 0),
      fetchedFailed: Number(meta.fetchedFailed || 0),
      protectedEmailsDecoded: 0,
      changes: candidates,
      emailChanges: candidates.filter(candidate => Array.isArray(candidate.reasons) && candidate.reasons.includes("email_not_found")),
      outputFile: null,
      reportFile: "DataAuditLog/SERVICE_MAP_CONTACT_FRESHNESS_CHECK"
    },
    schedule: { cadence: "weekly", timer: "sotsiaalai-service-map-contact-check.timer" },
    serviceMap
  };
}

export async function checkDatabaseContactsFromWeb({
  prisma = defaultPrisma,
  maxUrls = 0,
  concurrency = DEFAULT_CONCURRENCY,
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  const contacts = await prisma.serviceMapEntry.findMany({
    where: contactWhere(),
    orderBy: [{ municipalityName: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      municipalityName: true,
      phone: true,
      email: true,
      sourceUrl: true
    }
  });
  const allGroups = groupByUrl(contacts);
  const groups = maxUrls > 0 ? allGroups.slice(0, maxUrls) : allGroups;
  const checkedAt = new Date();
  const results = await runWorkers(groups, concurrency, async group => {
    try {
      const response = await safeFetch(group.url, {
        timeoutMs,
        maxBytes: 2 * 1024 * 1024,
        maxRedirects: 4,
        headers: {
          Accept: "text/html,application/xhtml+xml,*/*",
          "User-Agent": "SotsiaalAI service-map contact checker/1.0 (+https://sotsiaal.ai)"
        }
      });
      if (!response.ok) {
        return { url: group.url, contacts: group.contacts.length, ok: false, status: response.status, error: "http_error" };
      }
      const page = pageSignals(response.body);
      const checks = group.contacts.map(entry => ({ entry, ...entrySignals(entry, page) }));
      return { url: group.url, contacts: group.contacts.length, ok: true, status: response.status, checks };
    } catch (error) {
      return {
        url: group.url,
        contacts: group.contacts.length,
        ok: false,
        status: null,
        error: clean(error?.code || error?.message) || "fetch_failed"
      };
    }
  });

  const verifiedIds = [];
  const candidates = [];
  const failures = [];
  for (const result of results) {
    if (!result.ok) {
      failures.push({ url: result.url, contacts: result.contacts, status: result.status, error: result.error });
      continue;
    }
    for (const check of result.checks) {
      if (check.verified) {
        verifiedIds.push(check.entry.id);
      } else {
        candidates.push({
          id: check.entry.id,
          name: check.entry.title,
          municipality: check.entry.municipalityName,
          sourceUrl: result.url,
          reasons: check.reasons
        });
      }
    }
  }

  await prisma.$transaction(async tx => {
    for (let index = 0; index < verifiedIds.length; index += 250) {
      await tx.serviceMapEntry.updateMany({
        where: { id: { in: verifiedIds.slice(index, index + 250) } },
        data: { checkedAt, lastSeenAt: checkedAt }
      });
    }
    await tx.dataAuditLog.create({
      data: {
        action: CHECK_ACTION,
        resourceType: CHECK_RESOURCE_TYPE,
        meta: {
          checkedAt: checkedAt.toISOString(),
          totalContacts: contacts.length,
          totalUrls: allGroups.length,
          checkedUrls: groups.length,
          skippedUrls: allGroups.length - groups.length,
          checkedContacts: results.reduce((sum, result) => sum + (result.ok ? result.contacts : 0), 0),
          verifiedContacts: verifiedIds.length,
          changedContacts: candidates.length,
          fetchedOk: results.filter(result => result.ok).length,
          fetchedFailed: failures.length,
          candidates: candidates.slice(0, MAX_CANDIDATE_PREVIEW),
          candidatePreviewTruncated: candidates.length > MAX_CANDIDATE_PREVIEW,
          failures: failures.slice(0, MAX_FAILURE_PREVIEW),
          failurePreviewTruncated: failures.length > MAX_FAILURE_PREVIEW
        }
      }
    });
  });

  return {
    ok: true,
    checkedAt: checkedAt.toISOString(),
    contacts: contacts.length,
    urls: allGroups.length,
    checkedUrls: groups.length,
    skippedUrls: allGroups.length - groups.length,
    checkedContacts: results.reduce((sum, result) => sum + (result.ok ? result.contacts : 0), 0),
    verifiedContacts: verifiedIds.length,
    changedContacts: candidates.length,
    fetchedOk: results.filter(result => result.ok).length,
    fetchedFailed: failures.length,
    candidates: candidates.slice(0, MAX_CANDIDATE_PREVIEW),
    failures: failures.slice(0, MAX_FAILURE_PREVIEW)
  };
}
