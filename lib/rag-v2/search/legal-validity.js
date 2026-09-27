// Legal validity at a reference date (Codex review 27.09.2026). A source that declares validity (a legal act:
// valid_from, valid_to or a proven open end) is evidence only in a version in force on the date the user asks
// about, or else on today's date in Estonia. A missing date is not proof of validity: without a start, or
// without an end and no proven open end, the version's validity is unknown and it is left out. Sources that
// declare no validity (articles, guides, reports) are not filtered here.
export const LEGAL_VALIDITY_VERSION = 'rag-v2/legal-validity-1';

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

/** The reference: today's Estonian date and the user's periods (validated calendar days, at most two). */
export function legalReference(asOf, periods = []) {
  if (!ISO_DATE.test(asOf)) throw Object.assign(new Error('invalid_legal_reference'), { code: 'invalid_legal_reference' });
  const asked = periods.filter(period => ISO_DATE.test(period?.from) && ISO_DATE.test(period?.to) && period.from <= period.to)
    .slice(0, 2).map(({ from, to, basis }) => ({ from, to, ...(basis ? { basis } : {}) }));
  return { version: LEGAL_VALIDITY_VERSION, as_of: asOf, periods: asked };
}

/**
 * Splits directory rows into those that may be evidence and the legal versions left out. A version is kept
 * when it is in force on the as-of date or at some point of a period the user asked about; so a question about
 * 2023 can also use a 2023 version, and a year in the question (a birth year) never removes today's law.
 */
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
