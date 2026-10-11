// Legal validity at a reference date (Codex review 27.09.2026). A source that declares validity (a legal act:
// valid_from, valid_to or a proven open end) is evidence only in a version in force on the date the user asks
// about, or else on today's date in Estonia. A missing date is not proof of validity: without a start, or
// without an end and no proven open end, the version's validity is unknown and it is left out. Sources that
// declare no validity (articles, guides, reports) are not filtered here.
// legal-validity-2 (ADR-077, 04.10.2026): an asked single day also takes the day before it. A question about what changes
// on a day needs the version that day's version replaced; before the day today's law brings it, from the day on nothing
// did. The period in the reference is listed as it is applied, so the scope the model reads stays true to its evidence.
export const LEGAL_VALIDITY_VERSION = 'rag-v2/legal-validity-2';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
/** The calendar date in Estonia (Europe/Tallinn) at an instant, as YYYY-MM-DD. */
export function estonianDate(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Tallinn', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(now).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** The declared validity of a directory row, or null when the source declares none. */
export function declaredValidity(fields) {
  const from = fields?.valid_from?.value ?? null, to = fields?.valid_to?.value ?? null, openEnd = fields?.valid_to?.open_end === true;
  if (!from && !to && !openEnd) return null;
  return { from: typeof from === 'string' && ISO_DATE.test(from.slice(0, 10)) ? from.slice(0, 10) : null,
    to: typeof to === 'string' && ISO_DATE.test(to.slice(0, 10)) ? to.slice(0, 10) : null, open_end: !to && openEnd };
}

/** in_force | not_yet_in_force | expired | unknown_validity for a period [from, to] (both days included). */
export function validityState(validity, from, to = from) {
  if (!validity.from || !validity.to && !validity.open_end) return 'unknown_validity';
  if (validity.from > to) return 'not_yet_in_force';
  if (validity.to && validity.to < from) return 'expired';
  return 'in_force';
}

const dayBefore = day => new Date(Date.parse(`${day}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
/** The reference: today's Estonian date and the user's periods (validated calendar days, at most two). A period of one
 *  day starts the day before it. */
export function legalReference(asOf, periods = []) {
  if (!ISO_DATE.test(asOf)) throw Object.assign(new Error('invalid_legal_reference'), { code: 'invalid_legal_reference' });
  const asked = periods.filter(period => ISO_DATE.test(period?.from) && ISO_DATE.test(period?.to) && period.from <= period.to)
    .slice(0, 2).map(({ from, to, basis }) => ({ from: from === to ? dayBefore(from) : from, to, ...(basis ? { basis } : {}) }));
  return { version: LEGAL_VALIDITY_VERSION, as_of: asOf, periods: asked };
}

/**
 * Splits directory rows into those that may be evidence and the legal versions left out. A version is kept
 * when it is in force on the as-of date or at some point of a period the user asked about; so a question about
 * 2023 can also use a 2023 version, and a year in the question (a birth year) never removes today's law.
 */
// ADR-130 (10.10.2026): which left-out versions a turn names to the answer model. The scope's report listed every
// national legal version not in force on the day, with its title and dates, in every turn's context: 26 future versions
// added by one corpus increment (v75) made every turn 1107 tokens longer, whatever it asked. A left-out version says
// something only about an act the turn is about. So:
// - `absent`: the versions of an act that has NO version in the search that day (not yet in force, or expired with no
//   successor indexed). They are always named: the act is in the corpus and the turn cannot read it, which is the one
//   sign of an act whose next version was not added in time (ADR-124).
// - `other`: the left-out versions of an act that does have a version in the search. They are named only in a turn
//   whose evidence holds that act (evidenceScope below); otherwise they are counted.
// titles: document id -> title as the index has it (unverified: it only decides which act a version is of; a title the
// model reads is the evidence's own or one read from the loaded source).
export function leftOutVersions(excluded, eligible, titles) {
  const inSearch = new Set(eligible.map(row => titles.get(row.document_id)).filter(title => typeof title === 'string'));
  const absent = [], other = [];
  for (const row of excluded) (inSearch.has(titles.get(row.document_id)) ? other : absent).push(row);
  return { absent, other };
}
/** The scope report as a turn's context carries it: the left-out versions of the acts its evidence holds are listed
 *  beside the absent acts' (by the evidence's own title), the rest are counted. A report without a legal scope, or
 *  without other versions, is returned as it is. */
export function evidenceScope(report, otherVersions, evidence) {
  if (!report?.legal_validity || !Array.isArray(otherVersions)) return report;
  const held = new Set(evidence.map(entry => entry.bibliography?.title?.value ?? entry.bibliography?.title).filter(title => typeof title === 'string'));
  const listed = otherVersions.filter(row => held.has(row.title));
  return { ...report, legal_validity: { ...report.legal_validity, excluded: [...report.legal_validity.excluded, ...listed],
    excluded_other_national_documents: otherVersions.length - listed.length } };
}
export function legalValidityScope(rows, reference) {
  const eligible = [], excluded = [];
  for (const row of rows) {
    const validity = declaredValidity(row.fields);
    if (!validity) { eligible.push(row); continue; }
    const windows = [{ from: reference.as_of, to: reference.as_of }, ...reference.periods];
    if (windows.some(window => validityState(validity, window.from, window.to) === 'in_force')) eligible.push(row);
    else excluded.push({ document_id: row.document_id, valid_from: validity.from, valid_to: validity.to, open_end: validity.open_end,
      state: validityState(validity, reference.as_of) });
  }
  return { eligible, excluded };
}
