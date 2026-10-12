// The monthly re-reading of the web pages that were chosen for the corpus by the selection rule (ADR-141): the
// organisations' own pages (ADR-095), the institutions' guidance pages (ADR-137) and the associations' pages (ADR-140).
// Their copies in the corpus are not what the page collector reads (lib/rag-v2/web-select.js takes the paragraphs that
// name a person out), so they live in the refresh's state outside the repository, a folder a group, and the collector
// never places them. A page is read by its own address; its reading is compared with the reading it was chosen from
// (the stored `content_sha256`); a change is a proposal first; on the second equal reading the rule chooses the page
// again, and only then may the chosen copy change. This file holds the two decisions of that path that are not the
// rule's own. No reading, no file, no model call here.
export const CHOSEN_REFRESH = 'rag-v2/chosen-refresh-1';
// A chosen text that falls under this share of what it was is held for a person: a site that answers every address
// with one short page, or a page moved away and left as a stub, reads the same twice too.
export const SHRINK_HELD_BELOW = 0.5;

/**
 * The reading-list entry of a stored chosen page: its own address, the title it was read with (the title the list or
 * the link gave decides how the page's heading is read, so it must stay the same), and the hints (content region, stated day, kept blocks) of the
 * list entry it came from: its own entry, or the listed page it was found below ("<listed id>--<slug>"). Without the
 * hint a page whose content the markup does not single out would be read with the site's menu and show as changed.
 * listed: Map of a list page's id to its entry.
 */
export function readingEntry(meta, listed = new Map()) {
  const from = listed.get(meta.source_id) ?? listed.get(String(meta.source_id).split('--')[0]) ?? null;
  return { source_id: meta.source_id, url: meta.url, title: meta.register_title || meta.title, publisher: meta.publisher, source_type: meta.source_type, language: meta.language,
    ...(from?.region ? { region: from.region } : {}), ...(from?.updated_region ? { updated_region: from.updated_region } : {}), ...(from?.keep ? { keep: from.keep } : {}), subpages: false };
}

/**
 * What happens to a page whose reading differed from the chosen one twice in the same way.
 *   before   the stored chosen copy { html, meta }
 *   page     today's reading as the collector stored it { html, meta }
 *   chosen   the rule's decision on today's reading (selectPage)
 *   approved a person has looked at this page and approved the change by its id
 * Returns { action, why? }:
 *   left_out  the rule now leaves the page out: it stays in the corpus as it is, for a person to decide
 *   same      the change is inside what the rule takes out: the corpus copy stays, only the stored reading moves on
 *   held      the change is not placed by itself: the content region is found another way than when the page was
 *             chosen (a site's new layout, a hint that no longer matches), or the chosen text is under half of what it was
 *   replace   the chosen copy is replaced and waits for a corpus increment
 */
export function rechosenAction({ before, page, chosen, approved = false }) {
  if (!chosen.keep) return { action: 'left_out', why: chosen.why };
  if (chosen.html === before.html) return { action: 'same' };
  if (approved) return { action: 'replace' };
  const was = before.meta?.collection?.region ?? null, now = page.meta?.collection?.region ?? null;
  if (was && now && was !== now) return { action: 'held', why: `the content region is found by "${now}", it was "${was}"` };
  const words = Number(before.meta?.selection?.words) || 0;
  if (words && chosen.words < words * SHRINK_HELD_BELOW) return { action: 'held', why: `the chosen text is ${chosen.words} words, it was ${words}` };
  return { action: 'replace' };
}

/**
 * Whether a group's state holds the pages its lists name, for the lists that name every page by itself (no sub-pages
 * are looked for): the ids only in the state and the ids only in the lists. A list that names front pages to read
 * below gives null: its pages are not known from the list.
 */
export function stateAgainstLists(storedIds, lists) {
  const pages = lists.flatMap(list => list?.pages ?? []);
  if (!pages.length || pages.some(page => page.subpages !== false)) return null;
  const listed = new Set(pages.map(page => page.source_id)), stored = new Set(storedIds);
  return { notInLists: [...stored].filter(id => !listed.has(id)).sort(), notInState: [...listed].filter(id => !stored.has(id)).sort() };
}

/**
 * The seeding of a group's state from the sources an increment put into the corpus: every page the lists name must
 * have a copy, a copy's bytes must be the ones its metadata names, and (with `inCorpus`, the source hashes of the
 * increment's review) the ones the corpus holds. Returns { copies: [{ id, rel }], problems: [text] }; nothing is
 * copied when a problem is found.
 *   sources  [{ rel, id, sha256, declared }]: the copies found (path without extension, source id, sha256 of the HTML
 *            bytes, the metadata's source_sha256)
 */
export function seedPlan({ sources, lists, inCorpus = null }) {
  const pages = lists.flatMap(list => list?.pages ?? []), wanted = new Map(pages.map(page => [page.source_id, page])), byId = new Map(), problems = [];
  if (wanted.size !== pages.length) problems.push('the lists name a page twice');
  for (const source of sources) { if (!wanted.has(source.id)) continue; if (byId.has(source.id)) problems.push(`two copies of ${source.id}`); byId.set(source.id, source); }
  for (const id of wanted.keys()) if (!byId.has(id)) problems.push(`no copy of ${id}`);
  for (const source of byId.values()) {
    if (source.sha256 !== source.declared) problems.push(`the bytes of ${source.id} are not the ones its metadata names`);
    else if (inCorpus && !inCorpus.has(source.sha256)) problems.push(`the bytes of ${source.id} are not in the corpus increment's review`);
  }
  return { copies: problems.length ? [] : [...byId.values()].map(source => ({ id: source.id, rel: source.rel })).sort((a, b) => a.rel.localeCompare(b.rel)), problems };
}
