import { fail, stable } from './contracts.js';

const present = value => value !== undefined && value !== null && value !== '';
const ALIASES = {
  document_id: ['document_id', 'articleId', 'canonical_source_id', 'docId', 'source_id', 'organization_id'],
  title: ['title', 'name', 'municipality_name', 'municipality'], source_path: ['source_path'], source_format: ['source_format'],
  source_type: ['source_type'], language: ['language'], authors: ['authors'], tags: ['tags'], year: ['year'],
  publication_date: ['publication_date', 'published'], valid_from: ['valid_from', 'effective_start'], valid_to: ['valid_to', 'effective_end'],
  authority: ['authority', 'publisher', 'source_organization'], last_checked: ['last_checked', 'checked_at', 'checkedAt'],
  retrieved_at: ['retrieved_at'], source_url: ['source_url', 'url_canonical', 'url', 'officialUrl'],
  journalTitle: ['journalTitle'], issueLabel: ['issueLabel'], pageRange: ['pageRange', 'page_range'],
  section: ['section'], description: ['description', 'summary'], collection_id: ['collection_id'], audience: ['audience', 'audiences'],
  jurisdiction_level: ['jurisdiction_level'], municipality_id: ['municipality_id'], municipality_name: ['municipality_name'],
  county: ['county'], country: ['country'], source_status: ['source_status'], historical: ['historical'],
  copyright_status: ['copyright_status'], display_full_text: ['display_full_text'], allow_excerpts: ['allow_excerpts'],
};

/** Translate collected metadata without dropping the original or hiding conflicting candidates. */
export function adaptMetadata(input, metadataFile) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('invalid_metadata');
  const candidates = [{ value: input, path: '' }];
  for (const [index, entry] of (input.metadata_variants || []).entries()) {
    if (entry.metadata?.source) candidates.push({ value: entry.metadata.source, path: `/metadata_variants/${index}/metadata/source` });
    if (entry.metadata) candidates.push({ value: entry.metadata, path: `/metadata_variants/${index}/metadata` });
  }
  for (const [index, entry] of (input.server_metadata || []).entries()) if (entry.metadata) candidates.push({ value: entry.metadata, path: `/server_metadata/${index}/metadata` });
  if (input.metadata_adaptation && ['document_id', 'title', 'source_path', 'source_type', 'language'].every(key => present(input[key])) && candidates.length === 1) return input;
  const metadata = { ...input }, origins = {}, conflicts = [];
  for (const [field, aliases] of Object.entries(ALIASES)) {
    const found = candidates.flatMap(candidate => aliases.filter(key => present(candidate.value[key]))
      .map(key => ({ value: candidate.value[key], path: `${candidate.path}/${key}` })));
    if (!found.length) continue;
    metadata[field] = found[0].value; origins[field] = found[0].path;
    const differing = found.slice(1).filter(candidate => stable(candidate.value) !== stable(found[0].value));
    if (differing.length && !['document_id', 'source_path'].includes(field)) conflicts.push({ field, selected: found[0], alternatives: differing });
  }
  if (!metadata.source_path && (Array.isArray(input.items) || input.organization_id)) {
    metadata.source_path = metadataFile; metadata.source_format = 'json';
    origins.source_path = null;
  }
  metadata.source_type ||= input.journalTitle ? 'journal_article' : Array.isArray(input.items) ? 'municipal_source_package'
    : input.organization_id ? 'organization_source_package' : 'information_document';
  metadata.language ||= Array.isArray(input.items) || input.organization_id ? 'et' : 'und';
  if (typeof metadata.title === 'object') metadata.title = metadata.title.name;
  metadata.metadata_adaptation = { schema_version: 'rag-v2/metadata-adaptation-1', origins, conflicts,
    generated_fields: Object.keys(metadata).filter(key => key !== 'metadata_adaptation' && !origins[key] && input[key] === undefined) };
  return metadata;
}
