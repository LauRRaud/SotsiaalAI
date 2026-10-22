import { fail, hash, id, stable } from '../contracts.js';
import { filtersMatch } from './ranking.js';
import { structuralRole } from './structural-role.js';

export const LEGACY_DISCOVERY_SCHEMA = 'rag-v2/retrieval-directory-1';
export const TYPED_DISCOVERY_SCHEMA = 'rag-v2/retrieval-directory-2';
export const DISCOVERY_SCHEMA = 'rag-v2/retrieval-directory-3';
export const DISCOVERY_SCHEMAS = Object.freeze([LEGACY_DISCOVERY_SCHEMA, TYPED_DISCOVERY_SCHEMA, DISCOVERY_SCHEMA]);
export const REVERSE_DEPENDENCIES = new Set(['EXCEPTION_TO', 'DEFINES', 'QUALIFIES', 'SUPERSEDES']);

// ADR-175: a bundle's hash covers its whole content (up to 36 MB as JSON, 0.13-0.34 s), and the catalog keeps a verified
// bundle as one object across turns, so each object's hash is computed from its own content once. Like the other
// per-bundle caches (structuralRole, section aids, legal dates), this holds because nothing changes a bundle once it is
// read: an evidence entry shares some of its arrays (span_ids, pdf_pages, limitations), which are never changed in place.
// A stored bundle that is not an object (a damaged row) is hashed as before, so its check fails with its own code.
const bundleHashes = new WeakMap();
export function bundleHash(bundle) {
  if (bundle === null || typeof bundle !== 'object') return hash(stable(bundle));
  let value = bundleHashes.get(bundle);
  if (value === undefined) bundleHashes.set(bundle, value = hash(stable(bundle)));
  return value;
}

/** Addresses and filter values only. Source text is loaded and verified after ranking. */
export function retrievalDirectory(bundle, config, schema = DISCOVERY_SCHEMA) {
  if (!DISCOVERY_SCHEMAS.includes(schema)) fail('unsupported_retrieval_directory');
  // v3 carries the imported publication year: most journal PDFs have a year but no
  // full publication date, and period filters must not silently drop them.
  // A proven open end (a legal act in force with no end date) travels with valid_to; other
  // documents keep the same projection as before.
  const fields = Object.fromEntries(['regions', 'publication_date', 'valid_from', 'valid_to', ...(schema === DISCOVERY_SCHEMA ? ['publication_year'] : [])]
    .map(key => [key, { value: bundle.document.fields[key]?.value ?? null,
      ...key === 'valid_to' && bundle.document.fields.valid_to?.open_end === true ? { open_end: true } : {} }]));
  return { schema_version: schema, document_id: bundle.document.id, version_id: bundle.version.id,
    bundle_hash: bundleHash(bundle), fields,
    ...(schema !== LEGACY_DISCOVERY_SCHEMA ? { source: {
      record_kind: bundle.document.fields.structured_record?.value.kind ?? null,
      journal: Boolean(bundle.document.fields.journal_title?.value) || bundle.document.fields.source_type?.value === 'journal_article',
    } } : {}),
    units: bundle.chunks.map(chunk => ({ id: id('unit', bundle.version.id, chunk.id, config.input_version),
      chunk_id: chunk.id, role: structuralRole(chunk, bundle) })),
    incoming: (bundle.dependencies || []).filter(edge => REVERSE_DEPENDENCIES.has(edge.type))
      .map(edge => ({ id: edge.id, targets: edge.targets })) };
}

export function verifyDirectory(row, generation) {
  const directory = row.retrieval_directory;
  if (!directory || directory.schema_version !== (generation.config.directory || LEGACY_DISCOVERY_SCHEMA) || hash(stable(directory)) !== row.retrieval_hash
    || directory.document_id !== row.document_id || directory.version_id !== row.version_id
    || directory.bundle_hash !== row.bundle_hash || generation.snapshot.documents[row.document_id]?.version_id !== row.version_id
    || !Array.isArray(directory.units) || !Array.isArray(directory.incoming)) fail('retrieval_directory_integrity_failed');
  return directory;
}

export function directoryScope(directories, query) {
  const allowed = directories.filter(directory => filtersMatch({ document: { fields: directory.fields } }, query.filters));
  const byDocument = new Map(allowed.map(directory => [directory.document_id, directory]));
  const units = new Map(allowed.flatMap(directory => directory.units.map(unit => [unit.id, { ...unit,
    document_id: directory.document_id, version_id: directory.version_id }])));
  const incoming = new Map();
  for (const directory of allowed) for (const edge of directory.incoming) for (const target of edge.targets) {
    if (byDocument.get(target.document_id)?.version_id !== target.document_version_id) continue;
    const key = `${target.document_version_id}/${target.card_id}`;
    if (!incoming.has(key)) incoming.set(key, new Set());
    incoming.get(key).add(directory.document_id);
  }
  return { byDocument, units, documentIds: [...byDocument.keys()],
    eligibleIds: [...units.values()].filter(unit => query.includeDocumentLabels || unit.role.evidence_eligible).map(unit => unit.id),
    incomingDocuments: card => [...(incoming.get(`${card.document_version_id}/${card.id}`) || [])].sort() };
}
