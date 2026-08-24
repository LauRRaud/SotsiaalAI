import { prisma as defaultPrisma } from "../../../prisma.js";
import { getServiceMapStatus } from "./service.js";
import { safeFetch } from "../../../../scripts/lib/safe-fetch.mjs";
import {
  CONTACT_VERIFICATION_VERSION,
  SERVICE_MAP_CONTACT_CHECK_SCHEDULE,
  SERVICE_MAP_PERSON_CONTACT_NAMESPACES,
  isStronglyMissingContactCandidate,
  loadServiceMapContactVerificationProjection,
  stronglyMissingContactIdsFromAuditMeta
} from "../../../serviceMap/contactFreshnessProjection.js";

const CONTACT_TYPES = ["KOV_SOCIAL_CONTACT", "KOV_GENERAL_CONTACT"];
const CHECK_ACTION = "SERVICE_MAP_CONTACT_FRESHNESS_CHECK";
const CHECK_RESOURCE_TYPE = "ServiceMapContactRegistry";
const DEFAULT_CONCURRENCY = 5;
const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_CANDIDATE_PREVIEW = 80;
const MAX_FAILURE_PREVIEW = 40;
const CONTACT_CHECK_LOCK_KEY = "service-map-contact-freshness-check";

function clean(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || null;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLocaleLowerCase("et")
    .replace(/[^\p{Letter}\p{Number}@.+'’-]+/gu, " ")
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

function injectDecodedEmailText(html) {
  return String(html || "")
    .replace(/(<a\b[^>]*href=["']mailto:([^"'?#]+)(?:\?[^"']*)?["'][^>]*>)/giu, (tag, _whole, encoded) => {
      try {
        const email = decodeHtml(decodeURIComponent(encoded)).trim().toLocaleLowerCase("et");
        return email.includes("@") ? `${tag}${email} ` : tag;
      } catch {
        return tag;
      }
    })
    .replace(/(<a\b[^>]*href=["']tel:([^"'?]+)["'][^>]*>)/giu, (tag, _whole, encoded) => {
      try {
        const phone = decodeHtml(decodeURIComponent(encoded)).trim();
        return phone ? `${tag}${phone} ` : tag;
      } catch {
        return tag;
      }
    })
    .replace(/(<[^>]*data-cfemail=["']([a-f0-9]+)["'][^>]*>)/giu, (tag, _whole, encoded) => {
      const email = decodeCloudflareEmail(encoded);
      return email ? `${tag}${email} ` : tag;
    })
    .replace(/(<[^>]*href=["'][^"']*\/email-protection#([a-f0-9]+)[^"']*["'][^>]*>)/giu, (tag, _whole, encoded) => {
      const email = decodeCloudflareEmail(encoded);
      return email ? `${tag}${email} ` : tag;
    })
    .replace(/(<[^>]*data-enc-email=["']([^"']+)["'][^>]*>)/giu, (tag, _whole, encoded) => {
      const email = rot13(decodeHtml(encoded).replace(/\s*\[at\]\s*/giu, "@")).toLocaleLowerCase("et");
      return email.includes("@") ? `${tag}${email} ` : tag;
    });
}

function escapeRegex(value = "") {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function contactTitleOccurrences(normalizedPage = "", contacts = []) {
  const occurrences = [];
  for (const entry of contacts) {
    const title = normalizeText(entry?.title);
    if (!entry?.id || !title) continue;
    const pattern = new RegExp(`(?<![\\p{Letter}\\p{Number}'’\\-])${escapeRegex(title)}(?![\\p{Letter}\\p{Number}'’\\-])`, "gu");
    for (const match of normalizedPage.matchAll(pattern)) {
      occurrences.push({
        id: entry.id,
        index: match.index || 0,
        end: (match.index || 0) + String(match[0] || "").length
      });
    }
  }
  return occurrences.sort((left, right) => left.index - right.index || left.end - right.end);
}

function pageSignals(buffer, contacts = []) {
  const html = buffer.toString("utf8");
  const htmlWithDecodedEmails = injectDecodedEmailText(html);
  const decodedEmails = Array.from(new Set([
    ...cloudflareEmails(html),
    ...encodedAttributeEmails(html)
  ]));
  const text = decodeHtml(htmlWithDecodedEmails)
    .replace(/<script[\s\S]*?<\/script>/giu, " ")
    .replace(/<style[\s\S]*?<\/style>/giu, " ")
    .replace(/<svg[\s\S]*?<\/svg>/giu, " ")
    .replace(/<(?:br|hr)\b[^>]*>/giu, "\n")
    .replace(/<\/(?:address|article|aside|dd|div|dl|dt|figcaption|footer|h[1-6]|header|li|main|ol|p|section|table|tbody|td|tfoot|th|thead|tr|ul)>/giu, "\n")
    .replace(/<[^>]+>/gu, " ")
    .replace(/[\t\f\v ]+/gu, " ")
    .replace(/\s*\r?\n\s*/gu, "\n")
    .replace(/\n{2,}/gu, "\n")
    .trim();
  const normalized = normalizeText(text);
  return {
    normalized,
    lowercase: `${html}\n${text}\n${decodedEmails.join("\n")}`.toLocaleLowerCase("et"),
    phones: new Set(pagePhoneNumbers(`${html}\n${text}`)),
    contactOccurrences: contactTitleOccurrences(normalized, contacts)
  };
}

function normalizePhoneDigits(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("372") && (digits.length === 10 || digits.length === 11)) {
    return digits.slice(3);
  }
  return digits;
}

function phoneNumbers(value) {
  return String(value || "")
    .split(/\s*(?:\/|,|;|\||\bor\b|\band\b|\bja\b|\bvoi\b|\bvõi\b|(?:^|\s)и(?:\s|$))\s*/giu)
    .map(normalizePhoneDigits)
    .filter(digits => digits.length >= 7 && digits.length <= 8);
}

function pagePhoneNumbers(value) {
  return Array.from(String(value || "").matchAll(/(?<!\d)(?:\+?372[\s()-]*)?\d(?:[\s()-]*\d){6,7}(?!\d)/gu))
    .map(match => normalizePhoneDigits(match[0]))
    .filter(digits => digits.length >= 7 && digits.length <= 8);
}

function contactRoleFromDescription(value = "") {
  const description = String(value || "");
  const role = description.match(/^\s*Roll:\s*(.+)$/imu);
  if (role) return clean(role[1]);
  const department = description.match(/^\s*Osakond:\s*(.+)$/imu);
  return clean(department?.[1]);
}

function contactWindows(entry, page) {
  const occurrences = page.contactOccurrences.filter(occurrence => occurrence.id === entry.id);
  return occurrences.map(occurrence => {
    const nextOther = page.contactOccurrences
      .find(candidate => candidate.id !== entry.id && candidate.index >= occurrence.end);
    // In unstructured HTML only the name-to-next-name range is relation-safe.
    // Fields before the name may still belong to the previous person; if a site
    // renders role/contact data first, keep the row in review instead of guessing.
    const start = occurrence.index;
    const end = Math.min(nextOther?.index || page.normalized.length, occurrence.end + 640);
    return page.normalized.slice(start, end);
  });
}

function entrySignals(entry, page) {
  const title = normalizeText(entry.title);
  const email = clean(entry.email)?.toLocaleLowerCase("et") || null;
  const rawPhone = clean(entry.phone);
  const phones = phoneNumbers(rawPhone);
  const phoneUnparseable = Boolean(rawPhone && !phones.length);
  const role = normalizeText(contactRoleFromDescription(entry.description));
  const titleSeen = Boolean(title && page.normalized.includes(title));
  const pageEmailSeen = !email || page.lowercase.includes(email);
  const pagePhoneSeen = !phoneUnparseable && (!phones.length || phones.every(phone => page.phones.has(phone)));
  const windows = contactWindows(entry, page);
  const tupleWindow = windows.find(window => {
    const windowPhones = new Set(pagePhoneNumbers(window));
    return !phoneUnparseable &&
      window.includes(title) &&
      (!email || window.includes(normalizeText(email))) &&
      (!phones.length || phones.every(phone => windowPhones.has(phone))) &&
      (!role || window.includes(role));
  });
  const emailSeen = !email || windows.some(window => window.includes(normalizeText(email)));
  const phoneSeen = !phoneUnparseable && (!phones.length || windows.some(window => {
    const windowPhones = new Set(pagePhoneNumbers(window));
    return phones.every(phone => windowPhones.has(phone));
  }));
  const roleSeen = !role || windows.some(window => window.includes(role));
  const stronglyMissing = !titleSeen && (!email || !pageEmailSeen) && (!phones.length || !pagePhoneSeen);
  const reasons = [];
  if (!titleSeen) reasons.push("contact_name_not_found");
  if (!emailSeen) reasons.push("email_not_found");
  if (phoneUnparseable) reasons.push("phone_unparseable");
  else if (!phoneSeen) reasons.push("phone_not_found");
  if (!roleSeen) reasons.push("contact_role_not_found");
  if (titleSeen && !tupleWindow) reasons.push("contact_tuple_not_confirmed");
  return {
    verified: Boolean(tupleWindow),
    stronglyMissing,
    reasons
  };
}

function contactSnapshotFingerprint(entry = {}) {
  return JSON.stringify([
    clean(entry.type),
    clean(entry.title),
    clean(entry.description),
    clean(entry.municipalityId),
    clean(entry.municipalityName),
    clean(entry.county),
    clean(entry.address),
    clean(entry.phone),
    clean(entry.email)?.toLocaleLowerCase("et") || null,
    clean(entry.website),
    clean(entry.sourceUrl),
    clean(entry.revision)
  ]);
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
    sourceNamespace: { in: SERVICE_MAP_PERSON_CONTACT_NAMESPACES },
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
  const now = new Date();
  const [existingContacts, sourceBackedContacts, latest, serviceMap, projection] = await Promise.all([
    prisma.serviceMapEntry.count({ where: contactWhere() }),
    prisma.serviceMapEntry.count({ where: { ...contactWhere(), sourceUrl: { not: null } } }),
    latestCheck(prisma),
    getServiceMapStatus(prisma),
    loadServiceMapContactVerificationProjection(prisma, { now })
  ]);
  const eligibleContacts = await prisma.serviceMapEntry.count({
    where: {
      ...contactWhere(),
      sourceUrl: { not: null },
      ...projection.whereIdentity
    }
  });
  const meta = latest?.meta && typeof latest.meta === "object" ? latest.meta : {};
  const candidates = Array.isArray(meta.candidates) ? meta.candidates : [];
  return {
    ok: true,
    mode: "database",
    generatedAt: latest?.createdAt?.toISOString?.() || null,
    sourceChanged: Number(meta.changedContacts || 0) > 0,
    needsRefresh: projection.mode !== "per_contact_verification" ||
      existingContacts > sourceBackedContacts ||
      eligibleContacts < sourceBackedContacts ||
      Number(meta.fetchedFailed || 0) > 0 ||
      Number(meta.skippedUrls || 0) > 0,
    counts: { existingContacts, sourceBackedContacts, eligibleContacts },
    check: {
      fileExists: false,
      reportExists: Boolean(latest),
      generatedAt: latest?.createdAt?.toISOString?.() || null,
      appliedAt: null,
      checkedUrls: Number(meta.checkedUrls || 0),
      checkedContacts: Number(meta.checkedContacts || 0),
      verifiedContacts: eligibleContacts,
      auditVerifiedContacts: Number(meta.verifiedContacts || 0),
      verificationMode: projection.mode,
      verificationVersion: projection.verificationVersion,
      changedContacts: Number(meta.changedContacts || 0),
      fetchedFailed: Number(meta.fetchedFailed || 0),
      protectedEmailsDecoded: 0,
      changes: candidates,
      emailChanges: candidates.filter(candidate => Array.isArray(candidate.reasons) && candidate.reasons.includes("email_not_found")),
      outputFile: null,
      reportFile: "DataAuditLog/SERVICE_MAP_CONTACT_FRESHNESS_CHECK"
    },
    schedule: SERVICE_MAP_CONTACT_CHECK_SCHEDULE,
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
      type: true,
      title: true,
      description: true,
      municipalityId: true,
      municipalityName: true,
      county: true,
      address: true,
      phone: true,
      email: true,
      website: true,
      sourceUrl: true,
      revision: true
    }
  });
  const allGroups = groupByUrl(contacts);
  if (maxUrls > 0) {
    const latest = await latestCheck(prisma);
    const latestMeta = latest?.meta && typeof latest.meta === "object" ? latest.meta : {};
    if (Number(latestMeta.contactVerificationVersion) !== CONTACT_VERIFICATION_VERSION) {
      throw new Error("full_contact_verification_required_before_partial_check");
    }
  }
  const groups = maxUrls > 0 ? allGroups.slice(0, maxUrls) : allGroups;
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
      const observedAt = new Date().toISOString();
      if (!response.ok) {
        return { url: group.url, contacts: group.contacts.length, ok: false, status: response.status, error: "http_error" };
      }
      const page = pageSignals(response.body, group.contacts);
      const checks = group.contacts.map(entry => ({ entry, ...entrySignals(entry, page) }));
      return {
        url: group.url,
        contacts: group.contacts.length,
        ok: true,
        status: response.status,
        observedAt,
        checks
      };
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
  const successfullyCheckedIds = [];
  const observedAtByContactId = new Map();
  const candidates = [];
  const failures = [];
  for (const result of results) {
    if (!result.ok) {
      failures.push({ url: result.url, contacts: result.contacts, status: result.status, error: result.error });
      continue;
    }
    for (const check of result.checks) {
      successfullyCheckedIds.push(check.entry.id);
      observedAtByContactId.set(check.entry.id, result.observedAt);
      if (check.verified) {
        verifiedIds.push(check.entry.id);
      } else {
        candidates.push({
          id: check.entry.id,
          name: check.entry.title,
          municipality: check.entry.municipalityName,
          sourceUrl: result.url,
          stronglyMissing: check.stronglyMissing,
          reasons: check.reasons
        });
      }
    }
  }
  let stronglyMissingContactIds = [];
  const verifiedIdsToUpdate = [];
  let supersededContactObservations = 0;
  const completedAt = new Date();

  await prisma.$transaction(async tx => {
    if (typeof tx.$executeRaw === "function") {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${CONTACT_CHECK_LOCK_KEY}))`;
    }
    const latestAtWrite = await latestCheck(tx);
    const previousMeta = latestAtWrite?.meta && typeof latestAtWrite.meta === "object"
      ? latestAtWrite.meta
      : {};
    const currentContactRows = await tx.serviceMapEntry.findMany({
      where: { ...contactWhere(), sourceUrl: { not: null } },
      select: { id: true }
    });
    const currentContactIds = new Set(currentContactRows.map(contact => contact.id));
    const stronglyMissingState = new Set(
      stronglyMissingContactIdsFromAuditMeta(previousMeta).filter(id => currentContactIds.has(id))
    );
    const hasCurrentVerificationState = Number(previousMeta.contactVerificationVersion) === CONTACT_VERIFICATION_VERSION &&
      Array.isArray(previousMeta.verifiedContactIds);
    const verifiedState = new Set(
      (hasCurrentVerificationState ? previousMeta.verifiedContactIds : [])
        .map(clean)
        .filter(id => id && currentContactIds.has(id))
    );
    const reviewState = new Set(
      (hasCurrentVerificationState && Array.isArray(previousMeta.reviewContactIds) ? previousMeta.reviewContactIds : [])
        .map(clean)
        .filter(id => id && currentContactIds.has(id))
    );
    const decisionObservedAt = Object.fromEntries(
      Object.entries(hasCurrentVerificationState && previousMeta.contactDecisionObservedAt && typeof previousMeta.contactDecisionObservedAt === "object"
        ? previousMeta.contactDecisionObservedAt
        : {})
        .filter(([id, value]) => currentContactIds.has(id) && Number.isFinite(Date.parse(String(value || ""))))
    );
    const candidateById = new Map(candidates.map(candidate => [candidate.id, candidate]));
    const snapshotById = new Map(contacts.map(contact => [contact.id, contactSnapshotFingerprint(contact)]));
    const currentContacts = successfullyCheckedIds.length
      ? await tx.serviceMapEntry.findMany({
          where: {
            ...contactWhere(),
            sourceUrl: { not: null },
            id: { in: successfullyCheckedIds }
          },
          select: {
            id: true,
            type: true,
            title: true,
            description: true,
            municipalityId: true,
            municipalityName: true,
            county: true,
            address: true,
            phone: true,
            email: true,
            website: true,
            sourceUrl: true,
            revision: true
          }
        })
      : [];
    const currentById = new Map(currentContacts.map(contact => [contact.id, contactSnapshotFingerprint(contact)]));
    const revisionById = new Map(contacts.map(contact => [contact.id, contact.revision]));
    const applicableIds = new Set();
    const proposedObservedAtById = new Map();
    for (const id of successfullyCheckedIds) {
      if (!currentContactIds.has(id)) {
        supersededContactObservations += 1;
        continue;
      }
      const observedAt = String(observedAtByContactId.get(id) || "");
      const observedAtMs = Date.parse(observedAt);
      if (!Number.isFinite(observedAtMs)) {
        supersededContactObservations += 1;
        continue;
      }
      const previousObservedAt = Date.parse(String(decisionObservedAt[id] || ""));
      if (Number.isFinite(previousObservedAt) && previousObservedAt > observedAtMs) {
        supersededContactObservations += 1;
        continue;
      }
      if (!currentById.has(id) || currentById.get(id) !== snapshotById.get(id)) {
        supersededContactObservations += 1;
        continue;
      }
      applicableIds.add(id);
      proposedObservedAtById.set(id, new Date(observedAtMs).toISOString());
      const candidate = candidateById.get(id);
      if (candidate) {
        decisionObservedAt[id] = proposedObservedAtById.get(id);
        stronglyMissingState.delete(id);
        verifiedState.delete(id);
        reviewState.add(id);
        if (isStronglyMissingContactCandidate(candidate)) stronglyMissingState.add(id);
      }
    }
    const verifiedIdsToAttempt = verifiedIds.filter(id => applicableIds.has(id));
    const verifiedIdsByObservedAt = new Map();
    for (const id of verifiedIdsToAttempt) {
      const observedAt = proposedObservedAtById.get(id);
      if (!verifiedIdsByObservedAt.has(observedAt)) verifiedIdsByObservedAt.set(observedAt, []);
      verifiedIdsByObservedAt.get(observedAt).push(id);
    }
    for (const [observedAt, ids] of verifiedIdsByObservedAt.entries()) {
      const observedAtDate = new Date(observedAt);
      for (let index = 0; index < ids.length; index += 250) {
        const batchIds = ids.slice(index, index + 250);
        await tx.serviceMapEntry.updateMany({
          where: {
            ...contactWhere(),
            sourceUrl: { not: null },
            OR: batchIds.map(id => ({ id, revision: revisionById.get(id) }))
          },
          data: { checkedAt: observedAtDate, lastSeenAt: observedAtDate }
        });
        const confirmedRows = await tx.serviceMapEntry.findMany({
          where: {
            ...contactWhere(),
            sourceUrl: { not: null },
            id: { in: batchIds },
            checkedAt: observedAtDate
          },
          select: { id: true }
        });
        const confirmedIds = new Set(confirmedRows.map(row => row.id));
        for (const id of batchIds) {
          if (!confirmedIds.has(id)) {
            supersededContactObservations += 1;
            continue;
          }
          verifiedIdsToUpdate.push(id);
          decisionObservedAt[id] = observedAt;
          stronglyMissingState.delete(id);
          reviewState.delete(id);
          verifiedState.add(id);
        }
      }
    }
    stronglyMissingContactIds = [...stronglyMissingState].sort();
    await tx.dataAuditLog.create({
      data: {
        action: CHECK_ACTION,
        resourceType: CHECK_RESOURCE_TYPE,
        meta: {
          contactVerificationVersion: CONTACT_VERIFICATION_VERSION,
          checkedAt: completedAt.toISOString(),
          totalContacts: contacts.length,
          totalUrls: allGroups.length,
          checkedUrls: groups.length,
          skippedUrls: allGroups.length - groups.length,
          checkedContacts: results.reduce((sum, result) => sum + (result.ok ? result.contacts : 0), 0),
          verifiedContacts: verifiedIdsToUpdate.length,
          changedContacts: candidates.length,
          fetchedOk: results.filter(result => result.ok).length,
          fetchedFailed: failures.length,
          supersededContactObservations,
          stronglyMissingContacts: stronglyMissingContactIds.length,
          stronglyMissingContactIds,
          verifiedContactIds: [...verifiedState].sort(),
          reviewContactIds: [...reviewState].sort(),
          contactDecisionObservedAt: Object.fromEntries(
            Object.entries(decisionObservedAt).sort(([left], [right]) => left.localeCompare(right))
          ),
          candidates: candidates.slice(0, MAX_CANDIDATE_PREVIEW),
          candidatePreviewTruncated: candidates.length > MAX_CANDIDATE_PREVIEW,
          failures: failures.slice(0, MAX_FAILURE_PREVIEW),
          failurePreviewTruncated: failures.length > MAX_FAILURE_PREVIEW
        }
      }
    });
  }, { maxWait: 10_000, timeout: 120_000 });

  return {
    ok: true,
    checkedAt: completedAt.toISOString(),
    contacts: contacts.length,
    urls: allGroups.length,
    checkedUrls: groups.length,
    skippedUrls: allGroups.length - groups.length,
    checkedContacts: results.reduce((sum, result) => sum + (result.ok ? result.contacts : 0), 0),
    verifiedContacts: verifiedIdsToUpdate.length,
    changedContacts: candidates.length,
    fetchedOk: results.filter(result => result.ok).length,
    fetchedFailed: failures.length,
    candidates: candidates.slice(0, MAX_CANDIDATE_PREVIEW),
    failures: failures.slice(0, MAX_FAILURE_PREVIEW)
  };
}
