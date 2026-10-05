import { createHash } from "node:crypto";
import { parseDocument } from "htmlparser2";
import { hasJobTitle, isSocialFieldStaff } from "../../../serviceMap/kovStaffExtract.js";
import {
  contactRoleFromDescription,
  normalizeText,
  phoneNumbers,
  staffNameKey,
  staffRoleMatches
} from "./pageCheck.js";

// What the register would have to change to say what the official page says (ADR-073): a proposal per register row
// (a moved page, a changed phone, e-mail or role) and per social-field person the page shows and the register does
// not hold. A proposal changes nothing by itself. It takes effect on the owner's approval, or after two reads at
// least five days apart gave the same result; a person gone from the page is never a proposal, the row stays hidden.
// Pure functions: the database and the network are in proposalService.js.

export const CONTACT_PROPOSAL_VERSION = 1;
// A row read off the official page. The freshness rule already allows this namespace, and no file sync owns it, so
// nothing hides the row for being absent from a source file.
export const PAGE_CONTACT_NAMESPACE = "OFFICIAL_KOV_CONTACT";
const SOCIAL_CONTACT_TYPE = "KOV_SOCIAL_CONTACT";
const MIN_READ_GAP_MS = 5 * 24 * 60 * 60 * 1000;
const READS_TO_APPLY = 2;
const MAX_AUTOMATIC_PER_PAGE = 10;
const MAX_AUTOMATIC_PER_RUN = 40;
const MAX_CONTACT_PAGE_LINKS = 8;
const CONTACT_PAGE_WORD = /kontakt|ametnik|teenistuja|töötaja/iu;
// A department that names another field next to the social one ("Haridus-, kultuuri- ja sotsiaalosakond") does not
// say which of them a person works in, and a role that names another field says it is not the social one.
const OTHER_FIELD = /haridus|kultuur|sport|noorsoo|noorte|majandus|arendus|ehitus|keskkon|planeeri|kommunikatsioon/iu;
// What a repeat read cannot vouch for: the same page gives the extractor the same answer twice, right or wrong.
// These proposals wait for the owner.
const OWNER_ONLY_FLAGS = new Set([
  "clears_phone",
  "clears_email",
  "no_channel_in_common",
  "weak_page_match",
  "social_by_heading",
  "email_shared_on_page",
  "email_has_diacritic",
  "role_unusual",
  "not_confirmed_after_change"
]);

function clean(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || null;
}

/** A proposal no repeat read can vouch for; the other flags only tell the reviewer something. */
export function needsOwner(proposal) {
  return proposal.flags.some(flag => OWNER_ONLY_FLAGS.has(flag));
}

/**
 * The owner's answer to a reviewed list, by its numbers. A proposal without an owner-only flag is approved unless
 * excepted; a flagged one only when named in `also`; `hold` neither applies nor turns down. The rest is turned down,
 * so the two-read rule does not bring it back.
 * @returns {{ approve: string[], hold: string[], reject: string[] }} signatures
 */
export function reviewedDecision(reviewed = [], { also = [], except = [], hold = [] } = {}) {
  const known = new Set(reviewed.map(proposal => proposal.no));
  const numbers = list => new Set(list.map(value => {
    const number = Number(value);
    if (!known.has(number)) throw new RangeError(`The reviewed list has no proposal ${value}`);
    return number;
  }));
  const [alsoNumbers, exceptNumbers, holdNumbers] = [numbers(also), numbers(except), numbers(hold)];
  const decision = { approve: [], hold: [], reject: [] };
  for (const proposal of reviewed) {
    const answer = holdNumbers.has(proposal.no) ? "hold"
      : exceptNumbers.has(proposal.no) || (needsOwner(proposal) && !alsoNumbers.has(proposal.no)) ? "reject"
        : "approve";
    decision[answer].push(proposal.signature);
  }
  return decision;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

// The register writes a number in groups, as most of its rows do: "555 0001", "5550 0001".
function formatPhone(digits) {
  const head = digits.length === 7 ? 3 : 4;
  return `${digits.slice(0, head)} ${digits.slice(head)}`;
}

export function registerEmails(value) {
  return String(value || "").split(/[\s,;]+/u).map(normalizeText).filter(email => email.includes("@"));
}

// The page may list one person twice, under two departments. Records whose channels all stand on the fullest record
// are that one person; records with different channels may be two people of the same name, and nothing is proposed.
function onePerson(records) {
  if (!records.length) return null;
  const size = record => record.phones.length + record.emails.length;
  const fullest = records.reduce((best, record) => (size(record) > size(best) ? record : best));
  const within = record => record.phones.every(phone => fullest.phones.includes(phone))
    && record.emails.every(email => fullest.emails.includes(email));
  return records.every(within) ? fullest : null;
}

function peopleNamed(staff, name) {
  const key = staffNameKey(name);
  return key ? staff.filter(person => staffNameKey(person.name) === key) : [];
}

/** The row's description has no "Roll:" line: the check then reads its department as the role and confirms it. */
export function lacksRole(entry) {
  return !/^[ \t]*Roll:/mu.test(String(entry.description || ""));
}

// Only the "Roll:" line changes; the department, the reception hours and the reception place stay as they are.
function descriptionWithRole(description, role) {
  const text = String(description || "");
  if (/^[ \t]*Roll:.*$/mu.test(text)) return text.replace(/^[ \t]*Roll:.*$/mu, `Roll: ${role}`);
  return [`Roll: ${role}`, text.trim()].filter(Boolean).join("\n");
}

function rowSignature(key, revision, pageUrl, fields) {
  const changes = Object.keys(fields).sort().map(name => [name, fields[name].before, fields[name].after]);
  return sha256(JSON.stringify([CONTACT_PROPOSAL_VERSION, key, revision, pageUrl, changes]));
}

/**
 * One register row against the staff list of its page, or of the page that replaced it.
 * @returns {{ state: "not_on_page"|"same_name_twice"|"away"|"left_social_field"|"role_kept"|"same"|"changed", proposal?: object }}
 */
export function contactRowProposal(entry, staff = [], { pageUrl = entry.sourceUrl, page = null } = {}) {
  const records = peopleNamed(staff, entry.title);
  if (!records.length) return { state: "not_on_page" };
  const person = onePerson(records);
  if (!person) return { state: "same_name_twice" };
  if (records.some(record => record.away === true)) return { state: "away" };

  const fields = {};
  const flags = [];
  const rawPhone = clean(entry.phone);
  const phones = phoneNumbers(rawPhone);
  // A number the register holds and the person's own record does not show stops the check; a number the page adds
  // to the register's does not, and is left alone.
  if ((rawPhone && !phones.length) || !phones.every(phone => person.phones.includes(phone))) {
    fields.phone = { before: entry.phone ?? null, after: person.phones.map(formatPhone).join("; ") || null };
    if (!fields.phone.after) flags.push("clears_phone");
  }
  const emails = registerEmails(entry.email);
  const shown = person.emails.map(normalizeText);
  if (!emails.every(email => shown.includes(email))) {
    fields.email = { before: entry.email ?? null, after: person.emails.join(", ") || null };
    if (!fields.email.after) flags.push("clears_email");
    else if (person.emails.some(email => /\P{ASCII}/u.test(email))) flags.push("email_has_diacritic");
  }
  const role = normalizeText(contactRoleFromDescription(entry.description));
  let roleKept = false;
  if (lacksRole(entry)) {
    // A row without a role takes the job title the page shows for the person; its other lines stay.
    if (hasJobTitle(person.role)) fields.description = { before: entry.description ?? null, after: descriptionWithRole(entry.description, clean(person.role)) };
  } else if (!records.some(record => staffRoleMatches(role, record)) && clean(person.role)) {
    // A social contact the page now shows outside the social field is not turned into something else; it stays
    // hidden, like a person who left.
    if (entry.type === SOCIAL_CONTACT_TYPE && !records.some(isSocialFieldStaff)) return { state: "left_social_field" };
    // A text that holds no job title ("Veriora", "Eluruumi tagamise teenus") is something else the page shows where
    // a title could stand. It never replaces the register's role: the applied proposals of 05.10.2026 did that.
    if (hasJobTitle(person.role)) fields.description = { before: entry.description ?? null, after: descriptionWithRole(entry.description, clean(person.role)) };
    else roleKept = true;
  }
  const registerUrl = clean(entry.sourceUrl);
  if (pageUrl !== registerUrl) {
    fields.sourceUrl = { before: entry.sourceUrl ?? null, after: pageUrl };
    if (clean(entry.website) === registerUrl) fields.website = { before: entry.website ?? null, after: pageUrl };
    if (page && page.rows >= 2 && page.found < 2) flags.push("weak_page_match");
  }
  if (!Object.keys(fields).length) return { state: roleKept ? "role_kept" : "same" };
  // The name alone ties the row to the record when none of the register's channels stands on it.
  const kept = phones.some(phone => person.phones.includes(phone)) || emails.some(email => shown.includes(email));
  if ((fields.phone || fields.email) && (phones.length || emails.length) && !kept) flags.push("no_channel_in_common");

  const key = `row|${entry.id}`;
  return {
    state: "changed",
    proposal: {
      kind: "row",
      key,
      signature: rowSignature(key, entry.revision, pageUrl, fields),
      entryId: entry.id,
      revision: entry.revision,
      municipality: entry.municipalityName ?? null,
      name: entry.title,
      pageUrl,
      fields,
      flags,
      evidence: {
        role: person.role ?? null,
        section: person.section ?? null,
        phones: person.phones,
        emails: person.emails,
        ...(page ? { page } : {})
      }
    }
  };
}

/** The row as it would read once the proposal is applied: what the next check has to confirm. */
export function rowAfterProposal(entry, proposal) {
  return { ...entry, ...Object.fromEntries(Object.entries(proposal.fields).map(([name, change]) => [name, change.after])) };
}

/**
 * A new person gets the place of the register rows already on the page: the address most of them share.
 * @returns {object|null} the row the place is copied from
 */
export function locationTemplate(rows = []) {
  const groups = new Map();
  for (const row of rows) {
    if (!clean(row.address) || !Number.isFinite(row.latitude) || !Number.isFinite(row.longitude)) continue;
    const key = JSON.stringify([row.address, row.latitude, row.longitude]);
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  const byId = (left, right) => (left.id < right.id ? -1 : 1);
  const largest = [...groups.values()].map(group => group.sort(byId))
    .sort((left, right) => right.length - left.length || byId(left[0], right[0]))[0];
  return largest?.[0] || null;
}

/**
 * The social-field people the page shows and the municipality's register rows do not name.
 * @param {Array<object>} staff the people read off the page
 * @param {{ pageUrl: string, municipality: string, knownNames: Set<string>, knownChannels: Set<string>, template: object|null }} context
 *   knownNames holds staffNameKey of every contact row of the municipality, hidden ones too: a row an operator hid
 *   is not added again. knownChannels holds the phones and e-mails of those rows: a new person who answers one of
 *   them took over a desk, or is a person the register knows by another name.
 */
export function newPersonProposals(staff = [], { pageUrl, municipality, knownNames = new Set(), knownChannels = new Set(), template = null } = {}) {
  const proposals = [];
  const skipped = { same_name_twice: 0, no_channel: 0, away: 0, other_field: 0, no_location: 0 };
  const emailUses = new Map();
  for (const person of staff) for (const email of new Set(person.emails)) emailUses.set(email, (emailUses.get(email) || 0) + 1);
  const seen = new Set();
  for (const candidate of staff) {
    const nameKey = staffNameKey(candidate.name);
    if (!nameKey || seen.has(nameKey) || knownNames.has(nameKey)) continue;
    const records = peopleNamed(staff, candidate.name);
    if (!records.some(isSocialFieldStaff)) continue;
    seen.add(nameKey);
    const person = onePerson(records);
    if (!person) { skipped.same_name_twice += 1; continue; }
    if (records.some(record => record.away === true)) { skipped.away += 1; continue; }
    if (!person.phones.length && !person.emails.length) { skipped.no_channel += 1; continue; }
    // The record that makes the person a social-field worker carries the role and the department heading.
    const social = records.find(isSocialFieldStaff);
    const role = clean(social.role);
    const section = clean(social.section);
    const byHeading = !isSocialFieldStaff({ role, section: null });
    if (byHeading && (OTHER_FIELD.test(section || "") || OTHER_FIELD.test(role || ""))) { skipped.other_field += 1; continue; }
    if (!template) { skipped.no_location += 1; continue; }
    const flags = [];
    if (!role) flags.push("no_role");
    else if (!hasJobTitle(role)) flags.push("role_unusual");
    if (byHeading) flags.push("social_by_heading");
    if (person.emails.some(email => emailUses.get(email) > records.length)) flags.push("email_shared_on_page");
    if (person.emails.some(email => /\P{ASCII}/u.test(email))) flags.push("email_has_diacritic");
    if (person.phones.some(phone => knownChannels.has(phone)) || person.emails.some(email => knownChannels.has(normalizeText(email)))) flags.push("channel_of_another_row");
    const hash = sha256(`${normalizeText(municipality)}|${nameKey}`).slice(0, 24);
    const key = `person|${hash}`;
    const create = {
      id: `kov-contact-page-${hash}`,
      type: SOCIAL_CONTACT_TYPE,
      title: person.name,
      description: [role ? `Roll: ${role}` : null, section ? `Osakond: ${section}` : null].filter(Boolean).join("\n") || null,
      municipalityId: template.municipalityId ?? null,
      municipalityName: template.municipalityName ?? municipality ?? null,
      county: template.county ?? null,
      address: template.address,
      normalizedAddress: template.normalizedAddress ?? null,
      latitude: template.latitude,
      longitude: template.longitude,
      geocodingStatus: template.geocodingStatus,
      adsObjectId: template.adsObjectId ?? null,
      phone: person.phones.map(formatPhone).join("; ") || null,
      email: person.emails.join(", ") || null,
      website: pageUrl,
      sourceUrl: pageUrl,
      sourceNamespace: PAGE_CONTACT_NAMESPACE,
      status: "PUBLISHED"
    };
    proposals.push({
      kind: "person",
      key,
      signature: sha256(JSON.stringify([CONTACT_PROPOSAL_VERSION, key, create.title, create.description, create.phone, create.email, create.sourceUrl])),
      municipality: create.municipalityName,
      name: person.name,
      pageUrl,
      create,
      flags,
      evidence: { role, section, phones: person.phones, emails: person.emails, locationFromEntryId: template.id }
    });
  }
  return { proposals, skipped };
}

/**
 * A page that no longer answers, or names none of its register rows: which candidate pages took its place. The
 * proof is how many of the old page's rows a candidate names; the pages that name at least one, most names first.
 * @param {Array<object>} rows the register rows of the old page
 * @param {Array<{ url: string, staff: Array<object> }>} candidates
 */
export function successorPages(rows = [], candidates = []) {
  return candidates
    .map(candidate => {
      const names = new Set(candidate.staff.map(person => staffNameKey(person.name)));
      return { ...candidate, found: rows.filter(row => names.has(staffNameKey(row.title))).length, rows: rows.length };
    })
    .filter(candidate => candidate.found > 0)
    .sort((left, right) => right.found - left.found);
}

/**
 * The contact pages a municipality's front page links to on its own host: a link whose last path part or short
 * label says so ("/kontakt", "Ametnikud"), the ones nearest to the front page first. A menu section that merely has
 * the word in its name ("/vald-uudised-kontakt/eelarve") is not one.
 */
export function contactPageLinks(html, homeUrl) {
  const home = new URL(homeUrl);
  const links = [];
  const text = node => (node.type === "text" ? node.data : (node.children || []).map(text).join(""));
  const parts = url => url.pathname.split("/").filter(Boolean);
  const visit = node => {
    if (node.type === "tag" && node.name === "a" && node.attribs?.href) {
      let url = null;
      let last = "";
      try { url = new URL(node.attribs.href, home); last = decodeURIComponent(parts(url).at(-1) || ""); } catch { url = null; }
      const label = clean(text(node)) || "";
      if (url && /^https?:$/u.test(url.protocol) && url.host === home.host && !/\.[a-z0-9]{2,4}$/iu.test(url.pathname)
        && (CONTACT_PAGE_WORD.test(last) || (label.length <= 40 && CONTACT_PAGE_WORD.test(label)))) {
        url.hash = "";
        if (url.href !== home.href && !links.some(link => link.href === url.href)) links.push(url);
      }
    }
    for (const child of node.children || []) visit(child);
  };
  visit(parseDocument(String(html || ""), { decodeEntities: true }));
  return links.map((url, at) => ({ url, at })).sort((left, right) => parts(left.url).length - parts(right.url).length || left.at - right.at)
    .slice(0, MAX_CONTACT_PAGE_LINKS).map(item => item.url.href);
}

/**
 * The read history the two-read rule needs, without names: per proposal its signature and how many reads in a row
 * gave it. A read counts only when it comes at least five days after the one counted before, so that running the
 * check twice on one morning is one read. A proposal the page no longer gives, or gives differently, starts over.
 * @param {{ reads?: object, rejected?: object }} previous the state of the latest read
 */
export function nextProposalState(previous = {}, proposals = [], { readAt = new Date() } = {}) {
  const now = new Date(readAt);
  const before = previous?.reads && typeof previous.reads === "object" ? previous.reads : {};
  const reads = {};
  for (const proposal of [...proposals].sort((left, right) => left.key.localeCompare(right.key))) {
    const last = before[proposal.key];
    if (last?.signature !== proposal.signature) {
      reads[proposal.key] = { signature: proposal.signature, count: 1, firstReadAt: now.toISOString(), countedAt: now.toISOString() };
      continue;
    }
    const counts = now.getTime() - Date.parse(last.countedAt) >= MIN_READ_GAP_MS;
    reads[proposal.key] = counts ? { ...last, count: last.count + 1, countedAt: now.toISOString() } : { ...last };
  }
  return {
    version: CONTACT_PROPOSAL_VERSION,
    readAt: now.toISOString(),
    reads,
    // What the owner turned down stays turned down for as long as the page gives the same thing.
    rejected: previous?.rejected && typeof previous.rejected === "object" ? { ...previous.rejected } : {}
  };
}

/**
 * Which proposals the two-read rule may apply without the owner. Many at once on a page, or in a run, look like a
 * rebuilt page or a reading error rather than a week's changes: then none of them is applied and all wait.
 * @returns {{ apply: Array<object>, held: Array<{ proposal: object, reason: string }> }}
 */
export function automaticProposals(proposals = [], state = {}) {
  const held = [];
  const ready = [];
  for (const proposal of proposals) {
    const reason = state.rejected?.[proposal.signature] ? "rejected"
      : needsOwner(proposal) ? "owner_only"
        : (state.reads?.[proposal.key]?.signature === proposal.signature ? state.reads[proposal.key].count : 0) < READS_TO_APPLY ? "one_read"
          : null;
    if (reason) held.push({ proposal, reason });
    else ready.push(proposal);
  }
  const perPage = new Map();
  for (const proposal of ready) perPage.set(proposal.pageUrl, (perPage.get(proposal.pageUrl) || 0) + 1);
  const apply = [];
  for (const proposal of ready) {
    if (ready.length > MAX_AUTOMATIC_PER_RUN) held.push({ proposal, reason: "too_many_in_run" });
    else if (perPage.get(proposal.pageUrl) > MAX_AUTOMATIC_PER_PAGE) held.push({ proposal, reason: "too_many_on_page" });
    else apply.push(proposal);
  }
  return { apply, held };
}
