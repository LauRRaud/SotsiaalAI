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

/** The register's municipalities that have no indexed act in force on `today`. The groups are read from the index, so a
 *  municipality whose registered act was an old or a repealed version never reached the check (30.09.2026: 31 of 78). */
export function municipalCoverage(acts, municipalities, today) {
  const inForce = acts.filter(act => act.index_from && act.index_from <= today && (!act.index_to || act.index_to >= today));
  const covered = new Set(inForce.flatMap(act => act.regions || []));
  return { municipalities: municipalities.length,
    without_current_act: municipalities.filter(entry => !covered.has(entry.municipality_id))
      .map(({ municipality_id, municipality_name }) => ({ municipality_id, municipality_name })) };
}

// ADR-124 (10.10.2026): what the manifest alone shows about the coming weeks, with no request to Riigi Teataja. The search
// keeps a legal text only in a version in force on the reference date (search/legal-validity.js), so a group whose indexed
// versions stop leaves every answer the next morning and nothing fails: counted on 10.10.2026, 3 of 38 national groups have
// no indexed version in force on 01.11.2026 and 17 on 01.01.2027. An end without a date (index_to null) is read as open,
// as municipalCoverage reads it: the manifest does not keep the proof of an open end.
const groupKey = act => act.group || `act:${act.globaal_id}`;
const inForceOn = (act, day) => Boolean(act.index_from) && act.index_from <= day && (!act.index_to || act.index_to >= day);
const national = act => !act.regions?.length;
const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
const OPEN = '9999-12-31';
/** The version (sorted by start, `to` set) that covers the last day reached from `day` through versions that follow each
 *  other without a break; null when none is in force on `day`. */
function reach(versions, day) {
  let last = null;
  for (const v of versions) {
    if (v.to < day || (last && v.to <= last.to)) continue;
    if (v.index_from > (last ? addDays(last.to, 1) : day)) break;
    last = v;
    if (last.to === OPEN) break;
  }
  return last;
}

/** How many groups have an indexed version in force on `day`: national (no region) and municipal. */
export function groupsInForce(acts, day) {
  const groups = new Map(acts.filter(act => inForceOn(act, day)).map(act => [groupKey(act), national(act)]));
  const nationals = [...groups.values()].filter(Boolean).length;
  return { national: nationals, municipal: groups.size - nationals };
}

/** Every group with an indexed version in force on `today` but none on some day up to `today + horizonDays`: its last
 *  covered day, the days left after today, and `resumes_on` with `gap_days` when the manifest already holds a later
 *  version of the group that starts after uncovered days; `ends_again_on` when what resumes stops too before the
 *  horizon (versions to 30.10 and from 01.11 to 31.12 with next year's not indexed: the return would hide the real end).
 *  A replacing act usually has a new group, so for a municipal act `candidates` names the groups of the same issuer and
 *  regions whose first indexed version starts the day after (on 10.10.2026 a council's procedure ending on 31.12.2026
 *  had its successor of the same title indexed that way). A candidate is never proof (ADR-038) and the group stays
 *  listed; a national act gets none, since another law of the same parliament from that day says nothing about it.
 *  National acts first, then by last day. */
export function actsEnding(acts, today, horizonDays) {
  const horizon = addDays(today, horizonDays), groups = new Map();
  for (const act of acts.filter(item => item.index_from)) {
    if (!groups.has(groupKey(act))) groups.set(groupKey(act), []);
    groups.get(groupKey(act)).push({ ...act, to: act.index_to ?? OPEN });
  }
  for (const versions of groups.values()) versions.sort((a, b) => a.index_from.localeCompare(b.index_from));
  const ending = [];
  for (const [group, versions] of groups) {
    const last = reach(versions, today);
    if (!last || last.to >= horizon) continue;
    const dayAfter = addDays(last.to, 1), next = versions.find(v => v.index_from > dayAfter && v.to >= v.index_from), again = next ? reach(versions, next.index_from) : null;
    const candidates = national(last) ? [] : [...groups].filter(([other, [first]]) => other !== group && first.index_from === dayAfter && first.issuer === last.issuer
      && String(first.regions) === String(last.regions)).map(([other, [first]]) => ({ group: other, title: first.title, same_title: first.title === last.title }));
    ending.push({ group, globaal_id: last.globaal_id, title: last.title, issuer: last.issuer, regions: last.regions || [], last_day: last.to,
      days_left: daysBetween(today, last.to), resumes_on: next?.index_from ?? null, gap_days: next ? daysBetween(dayAfter, next.index_from) : null,
      ends_again_on: again && again.to < horizon ? again.to : null, candidates });
  }
  return ending.sort((a, b) => national(b) - national(a) || a.last_day.localeCompare(b.last_day) || String(a.title).localeCompare(String(b.title), 'et'));
}

/** Report exit code: 20 when any request failed after retries, 10 for findings or items to review, 0 when unchanged. */
export function exitCode(groups) {
  if (groups.some(g => g.errors?.length)) return 20;
  return groups.some(g => g.findings.length || g.review.length) ? 10 : 0;
}
