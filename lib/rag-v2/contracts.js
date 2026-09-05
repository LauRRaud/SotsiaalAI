import { createHash } from 'node:crypto';

export const SCHEMA_VERSION = 'rag-v2/1';
export const DEFAULT_CONFIG = Object.freeze({
  parser: 'pdfjs-dist@5.4.296', normalization: 'layout-v3-bounded-items', chunking: 'section-lines-v1',
  maxFileBytes: 20 * 1024 * 1024, maxMetadataBytes: 1024 * 1024,
  maxPages: 250, maxTextChars: 2000000, timeoutMs: 30000,
  maxPdfItemsPerPage: 20000, maxPdfItems: 100000, maxExpandedChars: 20000000,
  chunkMaxChars: 2200, marginFraction: 0.045, headingRatio: 1.5,
  embeddingInputVersion: 'title-section-text-v1',
});

export function fail(code) { throw Object.assign(new Error(code), { code }); }
export function hash(value) { return createHash('sha256').update(value).digest('hex'); }
export function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export function id(kind, ...parts) { return `${kind}_${hash(stable(parts))}`; }
export function nonempty(value) { return typeof value === 'string' && value.trim().length > 0; }
export function validateMetadata(meta) {
  if (!meta || Array.isArray(meta) || typeof meta !== 'object') fail('invalid_metadata');
  for (const key of ['document_id', 'title', 'source_path', 'source_type', 'language']) {
    if (!nonempty(meta[key])) fail(`invalid_metadata_${key}`);
  }
  for (const key of ['authors', 'tags']) {
    if (meta[key] !== undefined && (!Array.isArray(meta[key]) || !meta[key].every(nonempty))) fail(`invalid_metadata_${key}`);
  }
  for (const key of ['docId', 'articleId', 'source_id', 'description', 'section', 'last_checked', 'journalTitle', 'issueLabel', 'audience', 'authority', 'source_status', 'collection_id']) {
    if (meta[key] !== undefined && !nonempty(meta[key])) fail(`invalid_metadata_${key}`);
  }
  if (meta.historical !== undefined && typeof meta.historical !== 'boolean') fail('invalid_metadata_historical');
  for (const key of ['year', 'pdf_start_page', 'pdf_end_page']) {
    if (meta[key] !== undefined && (!Number.isInteger(meta[key]) || meta[key] < 1)) fail(`invalid_metadata_${key}`);
  }
  const fieldLimits = {
    document_id: 512, title: 500, source_path: 1024, source_type: 100, language: 16,
    docId: 512, articleId: 512, source_id: 512, description: 20000, section: 300,
    last_checked: 64, journalTitle: 300, issueLabel: 100, audience: 100,
    authority: 100, source_status: 100, collection_id: 512,
  };
  for (const [key, limit] of Object.entries(fieldLimits)) {
    if (meta[key] !== undefined && String(meta[key]).length > limit) fail(`metadata_${key}_too_long`);
  }
  for (const [key, limit, count] of [['authors', 300, 32], ['tags', 200, 100]]) {
    if (meta[key]?.length > count || meta[key]?.some(value => value.length > limit)) fail(`metadata_${key}_too_large`);
  }
}
export function configuration(overrides = {}) {
  if (Object.keys(overrides).some(k => !(k in DEFAULT_CONFIG))) fail('unknown_configuration');
  const config = { ...DEFAULT_CONFIG, ...overrides };
  for (const key of ['maxFileBytes', 'maxMetadataBytes', 'maxPages', 'maxTextChars', 'timeoutMs', 'maxPdfItemsPerPage', 'maxPdfItems', 'maxExpandedChars', 'chunkMaxChars']) {
    if (!Number.isSafeInteger(config[key]) || config[key] < 1 || config[key] > DEFAULT_CONFIG[key] * 10) fail('invalid_configuration');
  }
  if (config.maxPdfItemsPerPage > config.maxPdfItems) fail('invalid_configuration');
  if (config.chunkMaxChars < 100 || config.marginFraction < 0 || config.marginFraction > 0.1 || config.headingRatio < 1.1 || config.headingRatio > 3) fail('invalid_configuration');
  for (const key of ['parser', 'normalization', 'chunking', 'embeddingInputVersion']) {
    if (config[key] !== DEFAULT_CONFIG[key]) fail('unsupported_processing_version');
  }
  return config;
}

// Runtime referential validation complements the public typed contract.
export function validateBundle(bundle) {
  if (bundle.schema_version !== SCHEMA_VERSION || !nonempty(bundle.tenant_id)) fail('invalid_bundle');
  const objects = [bundle.document, bundle.version, ...bundle.assets, ...bundle.spans, ...bundle.sections, ...bundle.blocks, ...bundle.chunks, ...bundle.relations];
  const ids = new Set(objects.map(o => o.id));
  if (ids.size !== objects.length || objects.some(o => !nonempty(o.id) || o.tenant_id !== bundle.tenant_id)) fail('invalid_identity_scope');
  const spans = new Map(bundle.spans.map(s => [s.id, s]));
  const sections = new Set(bundle.sections.map(s => s.id));
  const blocks = new Map(bundle.blocks.map(b => [b.id, b]));
  for (const block of bundle.blocks) {
    if (!['heading', 'paragraph', 'quote', 'list_item'].includes(block.kind) || block.span_ids.some(s => !spans.has(s))) fail('invalid_block');
  }
  for (const span of bundle.spans) {
    const page = bundle.pages[span.parser_page_index];
    if (!page || span.pdf_page !== span.parser_page_index + 1 || span.document_version_id !== bundle.version.id || span.start < 0 || span.end <= span.start || page.raw_text.slice(span.start, span.end) !== span.source_text) fail('invalid_source_span');
    if (!blocks.get(span.block_id)?.span_ids.includes(span.id)) fail('invalid_span_block');
  }
  for (const chunk of bundle.chunks) {
    if (!chunk.span_ids.length || chunk.span_ids.some(s => !spans.has(s)) || !sections.has(chunk.parent_section_id)) fail('invalid_chunk_reference');
    if (chunk.source_text !== chunk.span_ids.map(s => spans.get(s).source_text).join('\n')) fail('invalid_chunk_text');
    if (chunk.document_version_id !== bundle.version.id || !nonempty(chunk.retrieval_text)) fail('invalid_chunk');
  }
  for (const edge of bundle.relations) {
    if (!['BELONGS_TO', 'PARENT_SECTION', 'NEXT_SPAN'].includes(edge.type) || !ids.has(edge.from_id) || !ids.has(edge.to_id) || !edge.span_ids.length || edge.span_ids.some(s => !spans.has(s))) fail('invalid_relation');
  }
  for (const value of Object.values(bundle.document.fields)) {
    if (!Array.isArray(value.provenance) || value.provenance.length === 0) fail('missing_field_provenance');
    for (const source of value.provenance) if (source.span_ids?.some(s => !spans.has(s))) fail('invalid_field_source');
  }
  return bundle;
}
