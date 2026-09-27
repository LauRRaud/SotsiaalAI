// Validity of the legal texts in the active corpus against Riigi Teataja (ADR-038). Riigi Teataja closes a consolidated
// text's validity when a newer version or a replacing act is published, after we downloaded it: on 27.09.2026 17 indexed
// acts were treated as in force although they had ended. This module holds the pure analysis; the network and files
// are in scripts/rag-v2-law-validity.mjs.

const DAY = 864e5;
export const isoDay = value => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null);
export const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const later = (a, b) => (a > b ? a : b), earlier = (a, b) => (a < b ? a : b);

/** Merged coverage of versions ({ from, to|null }) inside [from, to]: the holes, the overlapping pairs, and the last
 *  covered day when coverage stops before the window's end (looking back `lookback` days, so a recently ended act
 *  is still reported). */
export function coverage(versions, window, lookback = 180) {
  const sorted = versions.filter(v => v.from).map(v => ({ ...v, to: v.to ?? '9999-12-31' })).sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  const overlaps = [];
  for (let i = 1; i < sorted.length; i++) for (let j = 0; j < i; j++) {
    const a = sorted[j], b = sorted[i], start = later(a.from, b.from), end = earlier(a.to, b.to);
    if (start <= end && end >= window.from && start <= window.to) overlaps.push({ a: a.id, b: b.id, from: later(start, window.from), to: earlier(end, window.to) });
  }
  const gaps = [];
  let covered = null; // the last covered day so far
  for (const v of sorted) {
    if (v.from > window.to) break;
    if (covered !== null && addDays(covered, 1) < v.from) {
      const hole = { from: later(addDays(covered, 1), window.from), to: earlier(addDays(v.from, -1), window.to) };
      if (hole.from <= hole.to) gaps.push(hole);
    }
    covered = covered === null ? v.to : later(covered, v.to);
  }
  const endsOn = covered !== null && covered < window.to && covered >= addDays(window.from, -lookback) ? covered : null;
  return { gaps, overlaps, ends_on: endsOn };
}

/** One consolidated-text group: the corpus versions (as indexed), what Riigi Teataja states now for each, and the
 *  group's published versions. A published version marked `repealed` is Riigi Teataja's repeal stub (no text, "Kehtetu",
 *  naming the repealing act in `repealed_by`): the group ends the day before it. Findings are facts; `review` holds what
 *  needs a person (never auto-published); `notes` explain an ended group whose official repealing act the corpus has
 *  (`repealed_by_in_corpus`). A replacement candidate (same issuer, starting near the end) is never proof, even when the
 *  corpus has it (`in_corpus`): it stays for review. */
export function analyseGroup({ group, corpus, current, published, searched, today, horizon, replacements = [] }) {
  const window = { from: today, to: horizon }, findings = [], notes = [], review = [];
  for (const item of corpus) {
    const now = current[item.globaal_id];
    if (!now) continue;
    if (now.from !== item.index_from || (now.to ?? null) !== (item.index_to ?? null)) {
      findings.push({ kind: 'validity_changed', globaal_id: item.globaal_id, document_id: item.document_id,
        index: `${item.index_from}..${item.index_to ?? 'open'}`, riigi_teataja: `${now.from}..${now.to ?? 'open'}` });
    }
  }
  const inCorpus = new Set(corpus.map(item => item.globaal_id));
  const unique = [...new Map(published.map(v => [v.globaal_id, v])).values()];
  const stubs = unique.filter(v => v.repealed);
  const versions = unique.filter(v => !v.repealed).map(v => ({ id: v.globaal_id, from: v.from, to: v.to }));
  for (const v of versions) {
    if (!inCorpus.has(v.id) && (v.to ?? '9999-12-31') >= window.from && v.from <= window.to) {
      findings.push({ kind: 'missing_version', globaal_id: v.id, valid: `${v.from}..${v.to ?? 'open'}`, in_force_today: v.from <= today && (v.to ?? '9999-12-31') >= today });
    }
  }
  // As Riigi Teataja publishes the group, and as the corpus has it (with the validity it was indexed with: what the
  // chat applies, so a stale end date shows up as an overlap).
  const rt = coverage(versions, window);
  for (const gap of rt.gaps) findings.push({ kind: 'riigi_teataja_gap', ...gap });
  for (const overlap of rt.overlaps) findings.push({ kind: 'riigi_teataja_overlap', ...overlap });
  const indexed = coverage(corpus.map(item => ({ id: item.globaal_id, from: item.index_from, to: item.index_to ?? null })), window);
  for (const gap of indexed.gaps) findings.push({ kind: 'corpus_gap', ...gap });
  for (const overlap of indexed.overlaps) findings.push({ kind: 'corpus_overlap', ...overlap });
  if (!searched) review.push({ kind: 'search_miss', detail: 'the group was not found in the search results; its versions are unknown' });
  if (rt.ends_on) {
    const stub = stubs.find(v => v.from > rt.ends_on);
    if (stub?.repealed_by_in_corpus) notes.push({ kind: 'replaced_in_corpus', on: rt.ends_on, repeal_stub: stub.globaal_id, repealed_by: stub.repealed_by });
    else {
      review.push(stub ? { kind: 'group_repealed', on: rt.ends_on, repeal_stub: stub.globaal_id, repealed_by: stub.repealed_by ?? null,
        detail: 'repealed; the repealing act is not in the corpus' }
        : { kind: 'group_ends', on: rt.ends_on, detail: 'no published version after this day (repealed, or the next version is not published yet)' });
      for (const candidate of replacements) review.push({ kind: 'replacement_candidate', ...candidate });
    }
  }
  return { group, findings, review, notes };
}

/** The status of a checked group, fetch failures apart from findings. */
export function groupStatus(result) {
  if (result.errors?.length) return 'fetch_failed';
  if (result.findings.length) return 'changed';
  if (result.review.length) return 'review';
  return 'unchanged';
}

/** Report exit code: 20 when any request failed after retries, 10 for findings or items to review, 0 when unchanged. */
export function exitCode(groups) {
  if (groups.some(g => g.errors?.length)) return 20;
  return groups.some(g => g.findings.length || g.review.length) ? 10 : 0;
}
