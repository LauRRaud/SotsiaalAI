import { randomUUID } from "node:crypto";
import { safeFetch } from "../../../../scripts/lib/safe-fetch.mjs";
import { extractStaffFromHtml } from "../../../serviceMap/kovStaffExtract.js";
import {
  SERVICE_MAP_CONTACT_TYPES,
  SERVICE_MAP_VERIFIABLE_CONTACT_NAMESPACES
} from "../../../serviceMap/contactFreshnessProjection.js";
import { contactPageChecks, normalizeText, phoneNumbers, staffNameKey } from "./pageCheck.js";
import {
  contactPageLinks,
  contactRowProposal,
  lacksRole,
  locationTemplate,
  needsOwner,
  newPersonProposals,
  nextProposalState,
  registerEmails,
  rowAfterProposal,
  successorPages
} from "./proposals.js";

// The proposal layer of the contact register (ADR-073): reads the official pages, says what the register would have
// to change, and writes a change only when it is handed an approved proposal. Reading changes nothing.
// The caller passes the database client, so the layer is tested against a stand-in without a database.

const READ_ACTION = "SERVICE_MAP_CONTACT_PROPOSAL_READ";
const APPLIED_ACTION = "SERVICE_MAP_CONTACT_PROPOSAL_APPLIED";
const REVERTED_ACTION = "SERVICE_MAP_CONTACT_PROPOSAL_REVERTED";
const BATCH_ACTION = "SERVICE_MAP_CONTACT_PROPOSAL_BATCH";
const REGISTRY_RESOURCE = "ServiceMapContactRegistry";
const ENTRY_RESOURCE = "ServiceMapEntry";
const DECISION_RECORD = "docs/rag-v2/adr-073-kov-staff-from-official-page.md";
// The same lock the weekly check takes for its write, so a change never lands in the middle of one.
const CONTACT_CHECK_LOCK_KEY = "service-map-contact-freshness-check";
const DEFAULT_CONCURRENCY = 5;
const DEFAULT_TIMEOUT_MS = 12_000;
const ROW_SELECT = Object.freeze({
  id: true, type: true, title: true, description: true, municipalityId: true, municipalityName: true, county: true,
  address: true, normalizedAddress: true, phone: true, email: true, website: true, sourceUrl: true, sourceNamespace: true,
  status: true, tombstonedAt: true, geocodingStatus: true, latitude: true, longitude: true, adsObjectId: true, revision: true
});

function clean(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || null;
}

// The same request the weekly check sends, so both see the same page.
async function fetchContactPage(url, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  try {
    const response = await safeFetch(url, {
      timeoutMs,
      maxBytes: 2 * 1024 * 1024,
      maxRedirects: 4,
      headers: {
        Accept: "text/html,application/xhtml+xml,*/*",
        "User-Agent": "SotsiaalAI service-map contact checker/1.0 (+https://sotsiaal.ai)"
      }
    });
    return response.ok
      ? { ok: true, status: response.status, body: response.body, finalUrl: response.finalUrl }
      : { ok: false, status: response.status, error: "http_error" };
  } catch (error) {
    return { ok: false, status: null, error: clean(error?.code || error?.message) || "fetch_failed" };
  }
}

function staffOf(body) {
  try {
    return extractStaffFromHtml(body.toString("utf8")).people;
  } catch {
    return [];
  }
}

async function runWorkers(items, concurrency, worker) {
  let cursor = 0;
  const results = new Array(items.length);
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), items.length || 1) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  }));
  return results;
}

function mostCommon(values) {
  const counts = new Map();
  for (const value of values) if (value) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] || null;
}

async function lockRegister(tx) {
  if (typeof tx.$executeRaw === "function") {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${CONTACT_CHECK_LOCK_KEY}))`;
  }
}

/**
 * Reads every official page of the register and returns what the register would have to change. Writes nothing.
 * @param {object} options
 * @param {Record<string, string[]>} [options.candidatePages] pages named by the operator as the successor of a
 *   register page; without one, the contact pages linked from the site's front page are tried.
 * @returns {Promise<{ readAt: string, pages: Array<object>, proposals: Array<object>, counts: object }>}
 */
export async function readContactProposals({
  prisma,
  candidatePages = {},
  concurrency = DEFAULT_CONCURRENCY,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchPage = fetchContactPage,
  now = new Date()
} = {}) {
  const rows = await prisma.serviceMapEntry.findMany({
    where: { type: { in: SERVICE_MAP_CONTACT_TYPES } },
    orderBy: [{ municipalityName: "asc" }, { title: "asc" }, { id: "asc" }],
    select: ROW_SELECT
  });
  // Every contact row names its person for the municipality, hidden rows too: a hidden person is not added again.
  const knownNames = new Map();
  const knownChannels = new Map();
  for (const row of rows) {
    const municipality = normalizeText(row.municipalityName);
    if (!knownNames.has(municipality)) { knownNames.set(municipality, new Set()); knownChannels.set(municipality, new Set()); }
    knownNames.get(municipality).add(staffNameKey(row.title));
    for (const channel of [...phoneNumbers(row.phone), ...registerEmails(row.email)]) knownChannels.get(municipality).add(channel);
  }
  const groups = new Map();
  for (const row of rows) {
    const url = clean(row.sourceUrl);
    if (!url || row.status !== "PUBLISHED" || row.tombstonedAt || !SERVICE_MAP_VERIFIABLE_CONTACT_NAMESPACES.includes(row.sourceNamespace)) continue;
    groups.set(url, [...(groups.get(url) || []), row]);
  }
  const urls = [...groups.keys()].sort();

  const results = await runWorkers(urls, concurrency, async url => {
    const contacts = groups.get(url);
    const municipality = mostCommon(contacts.map(row => row.municipalityName));
    const fetched = await fetchPage(url, { timeoutMs });
    const own = fetched.ok ? { url, body: fetched.body, staff: staffOf(fetched.body) } : null;
    const naming = (page, entry) => page.staff.some(person => staffNameKey(person.name) === staffNameKey(entry.title));
    // A page that does not answer, or names none of its rows, may have moved: the operator's candidates first, then
    // the contact pages the site's front page links to. The front page may itself have moved to another host; the
    // address a candidate ends up at after redirects is the one proposed.
    let successors = [];
    if (!own || (contacts.length >= 2 && !contacts.some(entry => naming(own, entry)))) {
      let candidateUrls = candidatePages[url];
      if (!candidateUrls) {
        const front = await fetchPage(new URL("/", url).href, { timeoutMs });
        const home = front.ok ? front.finalUrl || new URL("/", url).href : null;
        candidateUrls = home ? [...contactPageLinks(front.body.toString("utf8"), home), new URL("/kontakt", home).href] : [];
      }
      const candidates = [];
      for (const candidateUrl of new Set(candidateUrls)) {
        const page = await fetchPage(candidateUrl, { timeoutMs });
        const address = page.ok ? page.finalUrl || candidateUrl : null;
        if (address && address !== url && !candidates.some(candidate => candidate.url === address)) candidates.push({ url: address, body: page.body, staff: staffOf(page.body) });
      }
      successors = successorPages(contacts, candidates);
    }
    const moved = successors.length > 0;
    // New people are read off one page: the register's own, or the successor that names most of its rows.
    const main = moved ? successors[0] : own;
    const summary = { url, municipality, rows: contacts.length, status: fetched.status, staffPeople: main?.staff.length || 0, tally: {}, newPeople: 0, skipped: {} };
    const add = (name, count = 1) => { summary.tally[name] = (summary.tally[name] || 0) + count; };
    if (!main) return { summary: { ...summary, state: "unreachable", error: fetched.error }, proposals: [] };
    summary.state = moved ? "moved" : "read";
    // A row of a moved page goes to the successor that names it; the one that names most rows comes first.
    const pageOf = entry => (moved ? successors.find(candidate => naming(candidate, entry)) || main : own);
    if (moved) {
      const used = new Set(contacts.filter(entry => successors.some(page => naming(page, entry))).map(entry => pageOf(entry).url));
      Object.assign(summary, { movedTo: successors.map(page => page.url).filter(address => used.has(address)), found: contacts.filter(entry => successors.some(page => naming(page, entry))).length });
    }

    const proposals = [];
    // A changed row has to pass the next check, or the change only swaps one hidden row for another.
    const confirms = (page, row) => contactPageChecks(page.body, [row]).checks[0].verified === true;
    const checks = moved ? null : new Map(contactPageChecks(own.body, contacts).checks.map(check => [check.entry.id, check]));
    for (const entry of contacts) {
      const check = checks?.get(entry.id);
      // A confirmed row without a role is still looked at: the page may show the person's job title.
      const confirmed = check?.verified && !check.roleDiffers;
      if (confirmed && !lacksRole(entry)) { add("confirmed"); continue; }
      const page = pageOf(entry);
      const { state, proposal } = contactRowProposal(entry, page.staff, { pageUrl: page.url, page: moved ? { rows: page.rows, found: page.found } : null });
      if (!proposal) { add(confirmed ? "confirmed" : state === "same" ? "unexplained" : state); continue; }
      if (!confirms(page, rowAfterProposal(entry, proposal))) proposal.flags.push("not_confirmed_after_change");
      add(moved ? "moved" : check?.verified ? "role_reworded" : "changed");
      proposals.push(proposal);
    }
    const fresh = newPersonProposals(main.staff, {
      pageUrl: main.url,
      municipality,
      knownNames: knownNames.get(normalizeText(municipality)) || new Set(),
      knownChannels: knownChannels.get(normalizeText(municipality)) || new Set(),
      template: locationTemplate(contacts)
    });
    for (const proposal of fresh.proposals) {
      if (!confirms(main, { ...proposal.create, revision: 1 })) proposal.flags.push("not_confirmed_after_change");
      proposals.push(proposal);
    }
    summary.newPeople = fresh.proposals.length;
    summary.skipped = fresh.skipped;
    return { summary, proposals };
  });

  // One person on two pages of a municipality is one proposal: the first page in address order keeps it.
  const seen = new Set();
  const proposals = [];
  for (const result of results) {
    for (const proposal of result.proposals) {
      if (seen.has(proposal.key)) { result.summary.newPeople -= 1; continue; }
      seen.add(proposal.key);
      proposals.push(proposal);
    }
  }
  const collator = new Intl.Collator("et");
  proposals.sort((left, right) => collator.compare(left.municipality || "", right.municipality || "")
    || left.kind.localeCompare(right.kind) || collator.compare(left.name, right.name) || left.key.localeCompare(right.key));
  const pages = results.map(result => result.summary);
  const sum = pick => pages.reduce((total, page) => total + pick(page), 0);
  const tallied = name => sum(page => page.tally[name] || 0);
  return {
    readAt: new Date(now).toISOString(),
    pages,
    proposals,
    counts: {
      registerRows: sum(page => page.rows),
      pages: pages.length,
      pagesRead: pages.filter(page => page.state === "read").length,
      pagesMoved: pages.filter(page => page.state === "moved").length,
      pagesUnreachable: pages.filter(page => page.state === "unreachable").length,
      rowsOnUnreachablePages: sum(page => (page.state === "unreachable" ? page.rows : 0)),
      confirmed: tallied("confirmed"),
      movedRows: tallied("moved"),
      changedRows: tallied("changed"),
      rewordedRoles: tallied("role_reworded"),
      notOnPage: tallied("not_on_page"),
      away: tallied("away"),
      leftSocialField: tallied("left_social_field"),
      roleKept: tallied("role_kept"),
      sameNameTwice: tallied("same_name_twice"),
      unexplained: tallied("unexplained"),
      newPeople: proposals.filter(proposal => proposal.kind === "person").length,
      proposals: proposals.length,
      ownerOnly: proposals.filter(needsOwner).length
    }
  };
}

async function latestProposalState(db) {
  const latest = await db.dataAuditLog.findFirst({
    where: { action: READ_ACTION, resourceType: REGISTRY_RESOURCE },
    orderBy: { createdAt: "desc" },
    select: { meta: true }
  });
  return latest?.meta && typeof latest.meta === "object" ? latest.meta : {};
}

/**
 * Records one read for the two-read rule: per proposal its signature and how many reads in a row gave it. The record
 * holds no names. `rejected` adds signatures the owner turned down.
 */
export async function recordContactProposalRead({ prisma, proposals = [], readAt = new Date(), rejected = {}, counts = null } = {}) {
  return prisma.$transaction(async tx => {
    await lockRegister(tx);
    const state = nextProposalState(await latestProposalState(tx), proposals, { readAt });
    Object.assign(state.rejected, rejected);
    await tx.dataAuditLog.create({ data: { action: READ_ACTION, resourceType: REGISTRY_RESOURCE, meta: { ...state, ...(counts ? { counts } : {}) } } });
    return state;
  }, { maxWait: 10_000, timeout: 120_000 });
}

/**
 * Writes approved proposals to the register in one transaction. A changed row follows the register's own rule for a
 * changed contact (kovContactSync.js): revision +1 and checkedAt cleared, so the row is shown again only after the
 * next check has confirmed it on the page. A row that is not what the proposal read (another revision, another old
 * value, hidden meanwhile) is skipped. Every write gets an audit record with the old and the new value.
 * @param {object} options
 * @param {"owner_approval"|"two_reads"} options.basis
 */
export async function applyContactProposals({ prisma, proposals = [], basis, approvedBy = null, batchId = randomUUID(), now = new Date() } = {}) {
  if (!["owner_approval", "two_reads"].includes(basis)) throw new TypeError("A basis is required to change the contact register");
  const skipped = [];
  let updated = 0;
  let created = 0;
  await prisma.$transaction(async tx => {
    await lockRegister(tx);
    const audits = [];
    const audit = (proposal, meta) => audits.push({
      action: APPLIED_ACTION,
      resourceType: ENTRY_RESOURCE,
      resourceId: proposal.kind === "row" ? proposal.entryId : proposal.create.id,
      meta: { batchId, kind: proposal.kind, key: proposal.key, signature: proposal.signature, basis, approvedBy, officialPage: proposal.pageUrl,
        evidence: proposal.evidence, decisionRecord: DECISION_RECORD, ...meta }
    });
    for (const proposal of proposals.filter(item => item.kind === "row")) {
      const before = Object.fromEntries(Object.entries(proposal.fields).map(([name, change]) => [name, change.before]));
      const after = Object.fromEntries(Object.entries(proposal.fields).map(([name, change]) => [name, change.after]));
      const result = await tx.serviceMapEntry.updateMany({
        where: { id: proposal.entryId, revision: proposal.revision, status: "PUBLISHED", tombstonedAt: null, ...before },
        data: { ...after, checkedAt: null, revision: { increment: 1 } }
      });
      if (result.count !== 1) { skipped.push({ key: proposal.key, reason: "row_changed" }); continue; }
      updated += 1;
      audit(proposal, { fields: proposal.fields, revisionBefore: proposal.revision, revisionAfter: proposal.revision + 1 });
    }
    const people = proposals.filter(item => item.kind === "person");
    if (people.length) {
      // The register may have gained the person since the read: by the same proposal, or by a row of the same name.
      const existing = await tx.serviceMapEntry.findMany({
        where: { OR: [{ id: { in: people.map(item => item.create.id) } },
          { type: { in: SERVICE_MAP_CONTACT_TYPES }, municipalityName: { in: [...new Set(people.map(item => item.create.municipalityName))] } }] },
        select: { id: true, title: true, municipalityName: true }
      });
      const taken = new Set(existing.flatMap(row => [row.id, `${normalizeText(row.municipalityName)}|${staffNameKey(row.title)}`]));
      for (const proposal of people) {
        const person = `${normalizeText(proposal.create.municipalityName)}|${staffNameKey(proposal.create.title)}`;
        if (taken.has(proposal.create.id) || taken.has(person)) { skipped.push({ key: proposal.key, reason: "already_in_register" }); continue; }
        taken.add(proposal.create.id).add(person);
        await tx.serviceMapEntry.create({ data: { ...proposal.create, lastSeenAt: now, checkedAt: null, sourceGeneration: `contact-proposal:${batchId}` } });
        created += 1;
        audit(proposal, { created: proposal.create, revisionAfter: 1 });
      }
    }
    if (audits.length) await tx.dataAuditLog.createMany({ data: audits });
    await tx.dataAuditLog.create({ data: { action: BATCH_ACTION, resourceType: REGISTRY_RESOURCE, resourceId: batchId,
      meta: { batchId, basis, approvedBy, appliedAt: new Date(now).toISOString(), proposals: proposals.length, updated, created, skipped: skipped.length, decisionRecord: DECISION_RECORD } } });
  }, { maxWait: 10_000, timeout: 120_000 });
  return { batchId, updated, created, skipped };
}

/**
 * Takes back the changes of one batch, all or the named proposals. A changed row gets its old values back (revision
 * +1, checkedAt cleared); an added row is hidden, never deleted. A row somebody changed after the batch is left as
 * it is. What is taken back is recorded as rejected, so the two-read rule does not bring it back.
 */
export async function revertContactProposals({ prisma, batchId, keys = null, now = new Date() } = {}) {
  if (!clean(batchId)) throw new TypeError("A batch id is required");
  const skipped = [];
  let restored = 0;
  let hidden = 0;
  await prisma.$transaction(async tx => {
    await lockRegister(tx);
    const inBatch = record => record.meta?.batchId === batchId;
    const applied = (await tx.dataAuditLog.findMany({ where: { action: APPLIED_ACTION }, orderBy: { createdAt: "asc" } })).filter(inBatch);
    const takenBack = new Set((await tx.dataAuditLog.findMany({ where: { action: REVERTED_ACTION } })).filter(inBatch).map(record => record.meta.key));
    const audits = [];
    const rejected = {};
    for (const record of applied) {
      const { key, kind, signature, fields, revisionAfter } = record.meta;
      if ((keys && !keys.includes(key)) || takenBack.has(key)) continue;
      const result = kind === "row"
        ? await tx.serviceMapEntry.updateMany({
          where: { id: record.resourceId, revision: revisionAfter, ...Object.fromEntries(Object.entries(fields).map(([name, change]) => [name, change.after])) },
          data: { ...Object.fromEntries(Object.entries(fields).map(([name, change]) => [name, change.before])), checkedAt: null, revision: { increment: 1 } }
        })
        : await tx.serviceMapEntry.updateMany({
          where: { id: record.resourceId, revision: revisionAfter, status: "PUBLISHED" },
          data: { status: "HIDDEN", tombstonedAt: now, revision: { increment: 1 } }
        });
      if (result.count !== 1) { skipped.push({ key, reason: "row_changed" }); continue; }
      if (kind === "row") restored += 1; else hidden += 1;
      rejected[signature] = { at: new Date(now).toISOString(), reason: "reverted", batchId };
      audits.push({ action: REVERTED_ACTION, resourceType: ENTRY_RESOURCE, resourceId: record.resourceId,
        meta: { batchId, kind, key, signature, appliedAuditId: record.id, revisionBefore: revisionAfter, revisionAfter: revisionAfter + 1,
          ...(kind === "row" ? { fields: Object.fromEntries(Object.entries(fields).map(([name, change]) => [name, { before: change.after, after: change.before }])) } : { hidden: true }) } });
    }
    if (audits.length) await tx.dataAuditLog.createMany({ data: audits });
    if (Object.keys(rejected).length) {
      const state = await latestProposalState(tx);
      await tx.dataAuditLog.create({ data: { action: READ_ACTION, resourceType: REGISTRY_RESOURCE,
        meta: { ...state, rejected: { ...(state.rejected || {}), ...rejected } } } });
    }
  }, { maxWait: 10_000, timeout: 120_000 });
  return { batchId, restored, hidden, skipped };
}
