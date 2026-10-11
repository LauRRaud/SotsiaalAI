// The re-reading of the official guidance pages in the corpus (ADR-116): what a round of the page collector found,
// told per publisher, and what follows for the source register and the next corpus increment. The collector itself
// (web-collect.js, web-page.js, scripts/rag-v2-web-pages.mjs) reads the pages and keeps the rule for collected data:
// a changed page is a proposal first and replaces the stored copy on the second equal reading, a page marked for
// review waits for a person, and nothing is deleted. Nothing here fetches or writes.
import { fail } from './contracts.js';

export const OFFICIAL_REFRESH = 'rag-v2/official-refresh-1';

/** What became of one page of a round, from the collector's report row:
 *   unchanged    reads as the stored copy
 *   proposed     differs from the stored copy for the first time: kept as a proposal, the stored copy stays
 *   replaced     differs as the proposal before did: the stored copy was replaced
 *   held         differs as the proposal before did, but was not placed: it is marked for review, or the round only looked
 *   new          a listed page without a stored copy
 *   unreachable  could not be read, or the site's robots.txt no longer allows it: the stored copy stays
 *   other        the same content as another page of the round, or an address that left its section */
export function pageOutcome(row) {
  if (row.status === 'unchanged' || row.status === 'proposed' || row.status === 'new') return row.status;
  if (row.status === 'confirmed') return row.applied ? 'replaced' : 'held';
  return row.status === 'failed' || row.status === 'robots_disallowed' ? 'unreachable' : 'other';
}

const OUTCOMES = ['unchanged', 'proposed', 'replaced', 'held', 'new', 'unreachable', 'other'];
/** A round told per publisher, with the pages a person should look at named by id and address (never by text).
 *  `rows` are the collector's report rows, each with the publisher of its list entry. */
export function refreshSummary(rows) {
  const publishers = {}, total = Object.fromEntries(OUTCOMES.map(key => [key, 0])), named = { proposed: [], replaced: [], held: [], new: [], unreachable: [] };
  for (const row of rows) {
    const outcome = pageOutcome(row), bag = publishers[row.publisher ?? '?'] ??= Object.fromEntries(OUTCOMES.map(key => [key, 0]));
    bag[outcome]++; total[outcome]++;
    if (named[outcome]) named[outcome].push({ id: row.id, url: row.url, ...(row.needsReview ? { review: row.warnings ?? [] } : {}), ...(row.error ? { error: row.error } : {}),
      ...(Number.isFinite(row.words) ? { words: row.words } : {}) });
  }
  return { pages: rows.length, total, publishers, ...named };
}

/** The register after a round replaced stored pages: the hash of each replaced file, and the page's title when it
 *  changed. `replaced`: [{ path, sha256, metadata_path, metadata_sha256, title }] with the register's own paths. An
 *  entry the register does not have is an error: a stored page is always a registered one. */
export function registerAfterRefresh(register, replaced) {
  const byPath = new Map(register.entries.map(entry => [entry.path, entry])), changes = [];
  for (const page of replaced) {
    const source = byPath.get(page.path), metadata = byPath.get(page.metadata_path);
    if (!source || source.role !== 'source' || !metadata || metadata.role !== 'metadata') fail('refresh_register_entry_missing');
    const before = { sha256: source.sha256, title: source.title };
    source.sha256 = page.sha256; metadata.sha256 = page.metadata_sha256;
    if (page.title && page.title !== source.title) source.title = page.title;
    changes.push({ path: page.path, bytes_changed: before.sha256 !== page.sha256, ...(before.title !== source.title ? { title_before: before.title, title: source.title } : {}) });
  }
  return { register, changes };
}

/** The register's page rows in REGISTER.md name a page by its title: a replaced page whose title changed gets its row
 *  rewritten. Rows are found by the page's path; a row that is not there is left alone. */
export function markdownAfterRefresh(markdown, changes) {
  const eol = markdown.includes('\r\n') ? '\r\n' : '\n', lines = markdown.split(eol);
  for (const change of changes.filter(item => item.title)) {
    const end = `| [${change.path}](<${change.path}>) |`, at = lines.findIndex(line => line.endsWith(end));
    if (at >= 0) lines[at] = `| ${change.title.replace(/\|/gu, '\\|')} ${end}`;
  }
  return lines.join(eol);
}

/** The stored pages no list names, as list entries of their own (ADR-117). The first official pages (ADR-095) were
 *  collected from a list of 18 pages with the pages below them, so most of their stored copies are sub-pages no list
 *  names. Each is read again by its own address and no sub-page is looked for: a refresh reads what the corpus has.
 *  `stored`: [{ folder, meta }], the metadata of every stored copy with the folder it lies in; `listed`: the ids the
 *  lists name; `except`: listed pages another refresh reads (with the pages below them). A copy whose folder is not
 *  its publisher's is an error: the collector could not find it again. */
const folderOf = value => String(value ?? '').toLowerCase().normalize('NFKD').replace(/\p{M}+/gu, '').replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '') || 'muu';
export function restEntries(stored, listed, except = []) {
  const named = new Set(listed), entries = [];
  for (const { folder, meta } of stored) {
    const id = meta?.source_id;
    if (typeof id !== 'string' || named.has(id) || except.some(other => id === other || id.startsWith(`${other}--`))) continue;
    if (typeof meta.url !== 'string' || !meta.publisher || folderOf(meta.publisher) !== folder) fail('refresh_stored_page_unreadable');
    entries.push({ source_id: id, url: meta.url, title: meta.register_title || meta.title, publisher: meta.publisher, source_type: meta.source_type, language: meta.language,
      ...(meta.jurisdiction_level ? { jurisdiction_level: meta.jurisdiction_level } : {}), ...(meta.tags?.length ? { topic_tags: meta.tags } : {}), subpages: false });
  }
  return entries.sort((a, b) => a.source_id.localeCompare(b.source_id, 'en'));
}

/** The table of confirmed readings after a round (ADR-117): `confirmed` are the hashes of the stored pages' bytes that
 *  a reading found the same today (an unchanged page's copy, a replaced page's new copy). A day only moves forward
 *  and no entry is taken out: a copy that was replaced keeps the last day it was confirmed. Returns the table and how
 *  many entries moved. */
export const WEB_PAGE_CHECKS = 'rag-v2/web-page-checks-1';
export function checksAfterRefresh(table, confirmed, day) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(day) || Number.isNaN(Date.parse(day))) fail('refresh_check_day_invalid');
  if (table != null && table.schema_version !== WEB_PAGE_CHECKS) fail('refresh_check_table_invalid');
  const checks = { ...(table?.checks ?? {}) };
  let moved = 0;
  for (const bytes of new Set(confirmed)) {
    if (typeof bytes !== 'string' || !/^[0-9a-f]{64}$/u.test(bytes)) fail('refresh_check_hash_invalid');
    if (!Object.hasOwn(checks, bytes) || checks[bytes] < day) { checks[bytes] = day; moved++; }
  }
  return { table: { schema_version: WEB_PAGE_CHECKS, checks: Object.fromEntries(Object.entries(checks).sort(([a], [b]) => a.localeCompare(b, 'en'))) }, moved };
}

/** The sources that wait for the next corpus increment: what waited before and what this round replaced, each once. */
export function incrementSelection(previous, replacedPaths) {
  const paths = new Set([...(Array.isArray(previous) ? previous : []).map(item => item?.source).filter(source => typeof source === 'string'), ...replacedPaths]);
  return [...paths].sort().map(source => ({ source }));
}
