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

/** The sources that wait for the next corpus increment: what waited before and what this round replaced, each once. */
export function incrementSelection(previous, replacedPaths) {
  const paths = new Set([...(Array.isArray(previous) ? previous : []).map(item => item?.source).filter(source => typeof source === 'string'), ...replacedPaths]);
  return [...paths].sort().map(source => ({ source }));
}
