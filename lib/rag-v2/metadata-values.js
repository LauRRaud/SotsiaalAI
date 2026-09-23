/** XML Schema calendar dates may have a zone but no time; never shift their day. */
export function metadataValue(field, value) {
  if (!['valid_from', 'valid_to', 'publication_date'].includes(field) || typeof value !== 'string') return value;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})(?:Z|[+-](?:0\d|1[0-3]):[0-5]\d|[+-]14:00)?$/u);
  if (!match || !Number.isFinite(Date.parse(match[1])) || new Date(match[1]).toISOString().slice(0, 10) !== match[1]) return value;
  return match[1];
}
