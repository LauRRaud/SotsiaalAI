const OFFSET_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/u;

export function parseOffsetDateTime(value) {
  if (typeof value !== "string" || !OFFSET_DATE_TIME.test(value.trim())) return null;
  const date = new Date(value.trim());
  return Number.isFinite(date.getTime()) ? date : null;
}

export function localDateTimeToIso(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
