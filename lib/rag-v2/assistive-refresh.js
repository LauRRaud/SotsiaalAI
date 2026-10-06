import { createHash } from 'node:crypto';
import { pointSources } from './assistive-points.js';

// ADR-098 (owner, 06.10.2026: "saad sa teha süsteemi, mis kord kuus uuendab teatud abivahendite infot?"). The
// assistive device information in the corpus goes out of date: the Social Insurance Board's table of sales points,
// its guidance pages and the vendors' own pages (a check answer quoted two vendors' daily prices). This module decides
// what a new reading changes. The owner's rule for collected data holds (04.10.2026): a change is applied when a second
// reading shows the same change, and nothing is deleted by itself.
export const ASSISTIVE_REFRESH = 'rag-v2/assistive-refresh-1';

const sha = value => createHash('sha256').update(value).digest('hex');
// What a point says, in one fixed order: two readings that say the same give the same text.
const valueOf = point => JSON.stringify([point.name, point.address, point.lat, point.lon, point.website ?? null, point.phone ?? null, point.email ?? null,
  point.municipalities.map(item => item.id).sort(), [...point.counties].sort(), point.offers.map(offer => `${offer.category}/${offer.service}`).sort()]);
const where = point => point.municipalities.map(item => item.name).join(', ');

/** What `read` changes in `accepted` (both lists of points): a point that is new, one whose values differ, one that
 *  is gone. `hash` says what the change leads to, so the same change in a later reading is recognised. */
export function pointChanges(accepted, read) {
  const before = new Map(accepted.map(point => [point.key, point])), after = new Map(read.map(point => [point.key, point])), changes = [];
  for (const [key, point] of after) {
    const known = before.get(key);
    if (!known) changes.push({ key, kind: 'added', hash: sha(valueOf(point)), name: point.name, where: where(point) });
    else if (valueOf(known) !== valueOf(point)) changes.push({ key, kind: 'changed', hash: sha(valueOf(point)), name: point.name, where: where(point) });
  }
  for (const [key, point] of before) if (!after.has(key)) changes.push({ key, kind: 'removed', hash: 'gone', name: point.name, where: where(point) });
  return changes;
}

/** What to do with a reading. `pending` are the changes the reading before this one proposed; a change that is among
 *  them again is confirmed. A confirmed new or changed point is applied. A confirmed removal waits for a person:
 *  `approveRemovals` names the keys that may go. Returns the accepted points after this reading, what was applied,
 *  what is proposed now (the next reading's `pending`) and the removals that wait for approval. */
export function decidePoints({ accepted, read, pending = [], approveRemovals = [] }) {
  const id = change => `${change.key}\0${change.kind}\0${change.hash}`, seen = new Set(pending.map(id)), may = new Set(approveRemovals);
  const next = new Map(accepted.map(point => [point.key, point])), fresh = new Map(read.map(point => [point.key, point]));
  const applied = [], proposed = [], removalsWaiting = [];
  for (const change of pointChanges(accepted, read)) {
    const confirmed = seen.has(id(change));
    if (confirmed && change.kind !== 'removed') { next.set(change.key, fresh.get(change.key)); applied.push(change); }
    else if (confirmed && may.has(change.key)) { next.delete(change.key); applied.push(change); }
    else if (confirmed) { removalsWaiting.push(change); proposed.push(change); }
    else proposed.push(change);
  }
  return { points: [...next.values()].sort((a, b) => a.key.localeCompare(b.key)), applied, proposed, removalsWaiting };
}

// A points page names the day of the reading it was made from. A page whose points are what they were is not made
// again for the day alone: it would be a new version of every page each month for one changed line.
const withoutDay = html => html.replace(/loetud \d{2}\.\d{2}\.\d{4}/gu, 'loetud');

/** The pages of the accepted points that differ from the ones the corpus has (`ingested`: path → html), apart from
 *  the day of the reading. Returns the pages to ingest (new or changed) and how many stay as they are. */
export function refreshedPointPages({ points, municipalities, readAt, ingested }) {
  const pages = pointSources(points, { municipalities, readAt }), changed = [];
  let unchanged = 0;
  for (const page of pages) {
    const known = ingested.get(page.path);
    if (known !== undefined && withoutDay(known) === withoutDay(page.html)) { unchanged++; continue; }
    changed.push({ ...page, state: known === undefined ? 'new' : 'changed' });
  }
  const made = new Set(pages.map(page => page.path));
  return { changed, unchanged, gone: [...ingested.keys()].filter(path => !made.has(path)) };
}
