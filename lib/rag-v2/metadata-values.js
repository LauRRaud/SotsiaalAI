// A URL written percent-encoded or in decomposed Unicode is the same address, but an escape is
// decoded only where that cannot change the URL's structure. In a path segment everything except
// "/", "?", "#" and "%" decodes ("%20" is a space, "%2B" a plus); in the query and fragment only
// unreserved characters and non-ASCII text decode, so "a%26b" is not "a&b" and "a%2Bb" not "a+b".
// The host is compared case-insensitively. Only the comparison uses this form.
const escape = char => `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`;
function decodeEscapes(text, keep) {
  return text.replace(/(?:%[0-9A-Fa-f]{2})+/gu, run => {
    let decoded;
    try { decoded = decodeURIComponent(run); } catch { return run.toUpperCase(); } // Not UTF-8: keep the written bytes.
    return [...decoded].map(char => keep(char) ? escape(char) : char).join('');
  });
}
const STRUCTURAL_IN_PATH = new Set(['/', '?', '#', '%']);
const reservedAscii = char => char.length === 1 && char.charCodeAt(0) < 0x80 && !/[A-Za-z0-9\-._~]/u.test(char);
function sameUrl(value) {
  let url;
  try { url = new URL(value); } catch { return value.normalize('NFC'); }
  const path = url.pathname.split('/').map(segment => decodeEscapes(segment, char => STRUCTURAL_IN_PATH.has(char))).join('/');
  const query = decodeEscapes(url.search, reservedAscii), fragment = decodeEscapes(url.hash, reservedAscii);
  const user = url.username ? `${url.username}${url.password ? `:${url.password}` : ''}@` : '';
  return `${url.protocol}//${user}${url.host}${path}${query}${fragment}`.normalize('NFC');
}
// An audience "BOTH" names both audiences.
const AUDIENCE_BOTH = ['CLIENT', 'SOCIAL_WORKER'];

/** Comparable form of a metadata value. XML Schema calendar dates may have a zone but no time;
 *  never shift their day. */
export function metadataValue(field, value) {
  if (field === 'source_url' && typeof value === 'string') return sameUrl(value);
  if (field === 'audience' && (typeof value === 'string' || Array.isArray(value))) {
    const values = (Array.isArray(value) ? value : [value]).flatMap(item => item === 'BOTH' ? AUDIENCE_BOTH : [item]);
    return [...new Set(values)].sort();
  }
  if (!['valid_from', 'valid_to', 'publication_date'].includes(field) || typeof value !== 'string') return value;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})(?:Z|[+-](?:0\d|1[0-3]):[0-5]\d|[+-]14:00)?$/u);
  if (!match || !Number.isFinite(Date.parse(match[1])) || new Date(match[1]).toISOString().slice(0, 10) !== match[1]) return value;
  return match[1];
}
