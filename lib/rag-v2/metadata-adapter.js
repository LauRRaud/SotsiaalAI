import { fail, stable } from './contracts.js';
import { metadataValue } from './metadata-values.js';

export const METADATA_ADAPTATION = 'rag-v2/metadata-adaptation-3';

const present = value => value !== undefined && value !== null && value !== '';
// Fields a source must have; a confirmation cannot declare them absent.
const REQUIRED = ['document_id', 'title', 'source_path', 'source_type', 'language'];
const ALIASES = {
  document_id: ['document_id', 'articleId', 'canonical_source_id', 'docId', 'source_id', 'organization_id'],
  title: ['title'], source_path: ['source_path'], source_format: ['source_format'],
  source_type: ['source_type'], language: ['language'], authors: ['authors'], tags: ['tags'], year: ['year'],
  publication_date: ['publication_date', 'published'], valid_from: ['valid_from', 'effective_start'], valid_to: ['valid_to', 'effective_end'],
  authority: ['authority', 'publisher', 'source_organization'], last_checked: ['last_checked', 'checked_at', 'checkedAt'],
  retrieved_at: ['retrieved_at'], source_url: ['source_url', 'url_canonical', 'url', 'officialUrl'],
  journalTitle: ['journalTitle'], issueLabel: ['issueLabel'], pageRange: ['pageRange', 'page_range'],
  section: ['section'], description: ['description', 'summary'], collection_id: ['collection_id'], audience: ['audience', 'audiences'],
  jurisdiction_level: ['jurisdiction_level'], municipality_id: ['municipality_id'], municipality_name: ['municipality_name'],
  county: ['county'], country: ['country'], regions: ['regions'], source_status: ['source_status'], historical: ['historical'],
  copyright_status: ['copyright_status'], display_full_text: ['display_full_text'], allow_excerpts: ['allow_excerpts'],
};

// Candidates that assert nothing about the field: a collection plan's "known" status, a level of
// government given as the authority, and descriptions a merge generated from folder headings.
const UNINFORMATIVE = {
  source_status: value => value === 'known',
  authority: value => ['state', 'KOV', 'municipal', 'national', 'local'].includes(value),
  description: value => typeof value === 'string' && /^(?:Source master headings:|Duplikaadid ühendatud:)/u.test(value),
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
  if (input.metadata_adaptation && REQUIRED.every(key => present(input[key])) && candidates.length === 1) return input;
  // After review, a metadata file may confirm its own top-level value of a field
  // (metadata_confirmations: field, value, confirmed_by, confirmed_at, basis). That value is
  // selected and the differing candidates are kept as superseded, not reported as conflicts.
  // A confirmation with `absent: true` and no value says the source gives no such value (a
  // document with a year but no date): the field stays empty and every candidate is superseded.
  const confirmations = new Map();
  for (const item of input.metadata_confirmations ?? []) {
    const absent = item?.absent === true;
    if (!item || typeof item !== 'object' || !Object.hasOwn(ALIASES, item.field) || confirmations.has(item.field)
      || (absent ? item.value !== undefined || REQUIRED.includes(item.field) : item.absent !== undefined || !present(item.value))
      || ['confirmed_by', 'confirmed_at', 'basis'].some(key => typeof item[key] !== 'string' || !item[key].trim())
      || !Number.isFinite(Date.parse(item.confirmed_at))) fail('invalid_metadata_confirmation');
    confirmations.set(item.field, item);
  }
  const metadata = { ...input }, origins = {}, conflicts = [], confirmed = [];
  for (const [field, aliases] of Object.entries(ALIASES)) {
    let found = candidates.flatMap(candidate => aliases.filter(key => present(candidate.value[key]))
      .map(key => ({ value: candidate.value[key], path: `${candidate.path}/${key}` })));
    // A record name and its display title may describe different things.
    // Compare explicit titles with titles; use names only when no title exists.
    if (field === 'title' && !found.length) found = candidates.filter(candidate => present(candidate.value.name))
      .map(candidate => ({ value: candidate.value.name, path: `${candidate.path}/name` }));
    // A municipality can title a package with no title/name. It is not an
    // alternative title for a service, benefit or contact inside that package.
    if (field === 'title' && !found.length) found = candidates.flatMap(candidate => ['municipality_name', 'municipality']
      .filter(key => present(candidate.value[key]))
      .map(key => typeof candidate.value[key] === 'object'
        ? { value: candidate.value[key].name, path: `${candidate.path}/${key}/name` }
        : { value: candidate.value[key], path: `${candidate.path}/${key}` })).filter(candidate => present(candidate.value));
    if (UNINFORMATIVE[field] && found.some(candidate => !UNINFORMATIVE[field](candidate.value))) {
      found = found.filter(candidate => !UNINFORMATIVE[field](candidate.value));
    }
    // Check dates record separate checks: the latest one holds, earlier ones are history.
    if (field === 'last_checked') found = [...found].sort((a, b) => String(b.value).localeCompare(String(a.value)));
    const confirmation = confirmations.get(field);
    if (confirmation?.absent) {
      delete metadata[field];
      confirmed.push({ field, selected: null, superseded: found, absent: true,
        confirmed_by: confirmation.confirmed_by, confirmed_at: confirmation.confirmed_at, basis: confirmation.basis });
      continue;
    }
    if (!found.length) continue;
    if (confirmation) {
      const own = found.find(candidate => /^\/[^/]+$/u.test(candidate.path));
      if (!own || stable(metadataValue(field, own.value)) !== stable(metadataValue(field, confirmation.value))) fail('metadata_confirmation_mismatch');
      found = [own, ...found.filter(candidate => candidate !== own)];
    }
    metadata[field] = found[0].value; origins[field] = found[0].path;
    const differing = found.slice(1).filter(candidate => stable(metadataValue(field, candidate.value)) !== stable(metadataValue(field, found[0].value)));
    if (confirmation) confirmed.push({ field, selected: found[0], superseded: differing,
      confirmed_by: confirmation.confirmed_by, confirmed_at: confirmation.confirmed_at, basis: confirmation.basis });
    else if (differing.length && !['document_id', 'source_path', 'last_checked'].includes(field)) conflicts.push({ field, selected: found[0], alternatives: differing });
  }
  if (confirmed.length !== confirmations.size) fail('metadata_confirmation_mismatch');
  if (!metadata.source_path && (Array.isArray(input.items) || input.organization_id)) {
    metadata.source_path = metadataFile; metadata.source_format = 'json';
    origins.source_path = null;
  }
  metadata.source_type ||= input.journalTitle ? 'journal_article' : Array.isArray(input.items) ? 'municipal_source_package'
    : input.organization_id ? 'organization_source_package' : 'information_document';
  metadata.language ||= Array.isArray(input.items) || input.organization_id ? 'et' : 'und';
  if (typeof metadata.title === 'object') metadata.title = metadata.title.name;
  metadata.metadata_adaptation = { schema_version: METADATA_ADAPTATION, origins, conflicts, confirmed,
    generated_fields: Object.keys(metadata).filter(key => key !== 'metadata_adaptation' && !origins[key] && input[key] === undefined) };
  return metadata;
}
