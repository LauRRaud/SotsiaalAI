import { prisma as defaultPrisma } from "../../../prisma.js";
import { getServiceMapStatus } from "./service.js";
import { safeFetch } from "../../../../scripts/lib/safe-fetch.mjs";
import { contactPageChecks } from "./pageCheck.js";
import {
  CONTACT_VERIFICATION_VERSION,
  SERVICE_MAP_CONTACT_CHECK_SCHEDULE,
  SERVICE_MAP_VERIFIABLE_CONTACT_NAMESPACES,
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

function contactSnapshotFingerprint(entry = {}) {
  return JSON.stringify([
    clean(entry.type),
    clean(entry.title),
    clean(entry.description),
    clean(entry.municipalityId),
    clean(entry.municipalityName),
    clean(entry.county),
    clean(entry.address),
    clean(entry.normalizedAddress),
    clean(entry.phone),
    clean(entry.email)?.toLocaleLowerCase("et") || null,
    clean(entry.website),
    clean(entry.sourceUrl),
    clean(entry.sourceDocId),
    clean(entry.sourceNamespace),
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
    sourceNamespace: { in: SERVICE_MAP_VERIFIABLE_CONTACT_NAMESPACES },
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
      auditVerifiedIdentityContacts: Number(meta.verifiedIdentityContacts || 0),
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
      normalizedAddress: true,
      phone: true,
      email: true,
      website: true,
      sourceUrl: true,
      sourceDocId: true,
      sourceNamespace: true,
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
      const { checks, staffPeople } = contactPageChecks(response.body, group.contacts);
      return {
        url: group.url,
        contacts: group.contacts.length,
        ok: true,
        status: response.status,
        observedAt,
        staffPeople,
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
  const verifiedIdentityIds = [];
  const observedFieldVerificationById = new Map();
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
      if (check.identityVerified) {
        verifiedIdentityIds.push(check.entry.id);
        observedFieldVerificationById.set(check.entry.id, {
          phone: check.phoneVerified === true,
          email: check.emailVerified === true
        });
      }
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
  let verifiedIdentityContactCount = 0;
  let supersededContactObservations = 0;
  // How much of the decision the staff lists carried: people read off the pages, and register contacts they decided.
  const staffPeople = results.reduce((sum, result) => sum + (result.ok ? result.staffPeople || 0 : 0), 0);
  const staffDecidedContacts = results.reduce((sum, result) => sum +
    (result.ok ? result.checks.filter(check => check.decidedBy === "staff_record").length : 0), 0);
  // Confirmed social contacts whose title the page words differently now: the register's role is out of date.
  const roleDiffersContactIds = results.flatMap(result => result.ok
    ? result.checks.filter(check => check.roleDiffers === true).map(check => check.entry.id)
    : []).sort();
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
    const verifiedIdentityState = new Set(
      (hasCurrentVerificationState && Array.isArray(previousMeta.verifiedContactIdentityIds)
        ? previousMeta.verifiedContactIdentityIds
        : [])
        .map(clean)
        .filter(id => id && currentContactIds.has(id))
    );
    const contactFieldVerification = Object.fromEntries(
      Object.entries(hasCurrentVerificationState && previousMeta.contactFieldVerification && typeof previousMeta.contactFieldVerification === "object"
        ? previousMeta.contactFieldVerification
        : {})
        .filter(([id]) => currentContactIds.has(id))
        .map(([id, value]) => [id, {
          phone: value?.phone === true,
          email: value?.email === true
        }])
    );
    const decisionObservedAt = Object.fromEntries(
      Object.entries(hasCurrentVerificationState && previousMeta.contactDecisionObservedAt && typeof previousMeta.contactDecisionObservedAt === "object"
        ? previousMeta.contactDecisionObservedAt
        : {})
        .filter(([id, value]) => currentContactIds.has(id) && Number.isFinite(Date.parse(String(value || ""))))
    );
    const contactDecisionRevision = Object.fromEntries(
      Object.entries(hasCurrentVerificationState && previousMeta.contactDecisionRevision && typeof previousMeta.contactDecisionRevision === "object"
        ? previousMeta.contactDecisionRevision
        : {})
        .filter(([id, value]) => {
          const revision = Number(value);
          return currentContactIds.has(id) && Number.isSafeInteger(revision) && revision > 0;
        })
        .map(([id, value]) => [id, Number(value)])
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
            normalizedAddress: true,
            phone: true,
            email: true,
            website: true,
            sourceUrl: true,
            sourceDocId: true,
            sourceNamespace: true,
            revision: true
          }
        })
      : [];
    const currentById = new Map(currentContacts.map(contact => [contact.id, contactSnapshotFingerprint(contact)]));
    const revisionById = new Map(contacts.map(contact => [contact.id, contact.revision]));
    const verifiedIdentityIdSet = new Set(verifiedIdentityIds);
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
      decisionObservedAt[id] = proposedObservedAtById.get(id);
      contactDecisionRevision[id] = revisionById.get(id);
      if (verifiedIdentityIdSet.has(id)) {
        verifiedIdentityState.add(id);
        contactFieldVerification[id] = observedFieldVerificationById.get(id) || { phone: false, email: false };
      } else {
        verifiedIdentityState.delete(id);
        delete contactFieldVerification[id];
      }
      const candidate = candidateById.get(id);
      if (candidate) {
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
          select: { id: true, revision: true }
        });
        const confirmedIds = new Set(
          confirmedRows
            .filter(row => row.revision === revisionById.get(row.id))
            .map(row => row.id)
        );
        for (const id of batchIds) {
          if (!confirmedIds.has(id)) {
            supersededContactObservations += 1;
            continue;
          }
          verifiedIdsToUpdate.push(id);
          decisionObservedAt[id] = observedAt;
          contactDecisionRevision[id] = revisionById.get(id);
          stronglyMissingState.delete(id);
          reviewState.delete(id);
          verifiedState.add(id);
        }
      }
    }
    stronglyMissingContactIds = [...stronglyMissingState].sort();
    verifiedIdentityContactCount = verifiedIdentityState.size;
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
          verifiedIdentityContacts: verifiedIdentityContactCount,
          changedContacts: candidates.length,
          fetchedOk: results.filter(result => result.ok).length,
          fetchedFailed: failures.length,
          staffPeople,
          staffDecidedContacts,
          roleDiffersContactIds,
          supersededContactObservations,
          stronglyMissingContacts: stronglyMissingContactIds.length,
          stronglyMissingContactIds,
          verifiedContactIds: [...verifiedState].sort(),
          verifiedContactIdentityIds: [...verifiedIdentityState].sort(),
          reviewContactIds: [...reviewState].sort(),
          contactDecisionObservedAt: Object.fromEntries(
            Object.entries(decisionObservedAt).sort(([left], [right]) => left.localeCompare(right))
          ),
          contactDecisionRevision: Object.fromEntries(
            Object.entries(contactDecisionRevision).sort(([left], [right]) => left.localeCompare(right))
          ),
          contactFieldVerification: Object.fromEntries(
            Object.entries(contactFieldVerification).sort(([left], [right]) => left.localeCompare(right))
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
    verifiedIdentityContacts: verifiedIdentityContactCount,
    changedContacts: candidates.length,
    fetchedOk: results.filter(result => result.ok).length,
    fetchedFailed: failures.length,
    staffPeople,
    staffDecidedContacts,
    roleDiffersContacts: roleDiffersContactIds.length,
    candidates: candidates.slice(0, MAX_CANDIDATE_PREVIEW),
    failures: failures.slice(0, MAX_FAILURE_PREVIEW)
  };
}
