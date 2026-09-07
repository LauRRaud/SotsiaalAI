export const EMPTY_INTAKE_FIELDS = { document_id: '', title: '', source_type: 'journal_article', language: 'et', authors: '', year: '', tags: '' };
const FORM_KEYS = new Set([...Object.keys(EMPTY_INTAKE_FIELDS), 'source_path']);
function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_metadata');
  return value;
}
export function intakeFormFromMetadata(value) {
  const data = object(value);
  return {
    fields: { ...EMPTY_INTAKE_FIELDS, ...Object.fromEntries(['document_id', 'title', 'source_type', 'language'].map(key => [key, String(data[key] ?? EMPTY_INTAKE_FIELDS[key])])),
      authors: Array.isArray(data.authors) ? data.authors.join('\n') : '', tags: Array.isArray(data.tags) ? data.tags.join('\n') : '',
      year: data.year === undefined ? '' : String(data.year) },
    extra: JSON.stringify(Object.fromEntries(Object.entries(data).filter(([key]) => !FORM_KEYS.has(key))), null, 2),
  };
}
export function intakeMetadataFromForm(fields, extra = '{}') {
  const other = object(JSON.parse(extra || '{}'));
  const result = { ...Object.fromEntries(Object.entries(other).filter(([key]) => !FORM_KEYS.has(key))),
    document_id: fields.document_id.trim(), title: fields.title.trim(), source_type: fields.source_type.trim(),
    language: fields.language.trim(), source_path: 'source.pdf',
    authors: fields.authors.split(/\r?\n/).map(v => v.trim()).filter(Boolean),
    tags: fields.tags.split(/\r?\n/).map(v => v.trim()).filter(Boolean) };
  if (fields.year.trim()) result.year = Number(fields.year);
  return result;
}
