import { fail, hash, stable } from '../contracts.js';
import { tokenCount, TOKENIZER } from './embedding.js';
import { accessContext } from './policy.js';

export const MODEL_SERIALIZER = 'rag-v2/model-context-json-1';
export function serializeModelContext(context) { return context === null ? '' : JSON.stringify(context); }
export function modelSourceMetadata(bundle) {
  const scope = ['municipality_id', 'municipality_name', 'county', 'country', 'regions', 'jurisdiction_level']
    .filter(key => bundle.document.fields[key]?.value != null);
  return Object.fromEntries(['source_type', 'authority', 'language', 'historical', 'source_status', 'valid_from', 'valid_to', 'source_checked_at', ...scope]
    .map(key => [key, { value: bundle.document.fields[key]?.value ?? null,
      provenance: bundle.document.fields[key]?.provenance ?? [], review_state: bundle.document.fields[key]?.review_state ?? 'imported_not_verified' }]));
}
function constraints(entry) {
  return entry.limitations.filter(w => w.code !== 'description_not_verified').map(w => ({ code: w.code,
    ...(w.detail ? { detail: w.detail } : {}), ...(w.resolution ? { resolution: w.resolution } : {}) }));
}
// Structured-record evidence is cited by its ref only: JSON paths, record IDs and empty page lists
// stay in the reference map and the audit packet. Its source card keeps declared values only,
// unwrapped (ADR-025). Only the catalogue path produces 'structured_record' evidence.
const recordEvidence = entry => entry.selection?.reason === 'structured_record';
// A record's card never repeats its title: the record entry and the evidence text carry it.
function compactCard({ title: _title, ...card }) {
  return Object.fromEntries(Object.entries(card).flatMap(([key, value]) => {
    const plain = value && typeof value === 'object' && !Array.isArray(value) && Object.hasOwn(value, 'value') ? value.value : value;
    return plain === null || plain === undefined || (Array.isArray(plain) && !plain.length) ? [] : [[key, plain]];
  }));
}
function modelRecords(context, defaults) {
  const entries = context.entries?.map(({ key, kind, fields, detail }) => ({ key, kind, fields, ...(detail && detail !== 'catalogue' ? { detail } : {}) }));
  return { ...context, ...(entries ? { entries } : {}), ...(Object.keys(defaults).length ? { source_defaults: defaults } : {}) };
}
// Values shared by every record source card are stated once as records.source_defaults.
function hoistRecordDefaults(sources, recordSources) {
  const cards = [...recordSources].map(source => sources[source]);
  if (cards.length < 2) return {};
  const defaults = Object.fromEntries(Object.entries(cards[0]).filter(([key, value]) => typeof value !== 'object'
    && cards.every(card => Object.hasOwn(card, key) && card[key] === value)));
  for (const card of cards) for (const key of Object.keys(defaults)) delete card[key];
  return defaults;
}
/** Lossless source-text projection. No descriptions, span arrays, hashes or rank scores go to the model. */
export function modelProjection(entries, scope) {
  const sources = {}, documents = new Map(), references = {}, evidence = [], recordSources = new Set();
  for (const [index, entry] of entries.entries()) {
    const documentKey = `${entry.document_id}/${entry.document_version_id}`;
    let source = documents.get(documentKey);
    if (!source) {
      source = `D${documents.size + 1}`; documents.set(documentKey, source);
      const card = { ...entry.bibliography, ...(entry.source_metadata || {}), limitations: constraints(entry) };
      sources[source] = recordEvidence(entry) ? compactCard(card) : card;
      if (recordEvidence(entry)) recordSources.add(source);
    }
    const ref = `S${index + 1}`;
    evidence.push(recordEvidence(entry) ? { ref, source, text: entry.source_text }
      : { ref, source, pdf_pages: entry.pdf_pages, ...(entry.pdf_pages.length ? {} : { source_locations: entry.source_locations?.map(({ kind, path, act_reference, record_id }) => ({ kind, path, ...(act_reference ? { act_reference } : {}), ...(record_id ? { record_id } : {}) })) }), text: entry.source_text });
    references[ref] = { tenant: scope.tenant, query_id: scope.query_id, generation_id: scope.generation_id,
      evidence_id: entry.evidence_id, document_id: entry.document_id, document_version_id: entry.document_version_id,
      unit_id: entry.unit_id, chunk_id: entry.chunk_id, span_ids: entry.span_ids, pdf_pages: entry.pdf_pages, ...(entry.source_locations === undefined ? {} : { source_locations: entry.source_locations }), source_text_sha256: hash(entry.source_text) };
  }
  const context = entries.length || scope.record_context || scope.retrieval_context ? { schema_version: MODEL_SERIALIZER, sources, evidence,
    ...(scope.dependency_context ? { dependencies: scope.dependency_context } : {}),
    ...(scope.record_context ? { records: modelRecords(scope.record_context, hoistRecordDefaults(sources, recordSources)) } : {}),
    ...(scope.retrieval_context ? { retrieval: scope.retrieval_context } : {}) } : null;
  const serialized = serializeModelContext(context);
  const headerOnly = context ? { ...context, evidence: evidence.map(e => ({ ...e, text: '' })) } : null;
  return { context, references, measurements: { tokenizer: TOKENIZER, serializer: MODEL_SERIALIZER,
    audit_tokens: tokenCount(JSON.stringify(entries)), model_context_tokens: tokenCount(serialized),
    source_text_tokens: tokenCount(entries.map(e => e.source_text).join('\n')),
    reference_header_tokens: tokenCount(serializeModelContext(headerOnly)),
    token_parts_are_additive: false } };
}
export async function resolveModelReference({ packet, reference, context, policy, queryId, sourceResolver }) {
  accessContext(context);
  if (context.tenant !== packet.tenant || queryId !== packet.query_id || !/^S[1-9]\d*$/.test(reference)) fail('reference_scope_mismatch');
  const projection = modelProjection(packet.evidence, packet);
  const expected = projection.references[reference];
  if (!expected || stable(expected) !== stable(packet.reference_map?.[reference])) fail('invalid_model_reference');
  const access = await policy.allowed(context);
  if (!access.documents.includes(expected.document_id)) fail('reference_access_denied');
  if (typeof sourceResolver !== 'function') fail('canonical_source_resolver_required');
  const canonical = await sourceResolver(expected);
  if (stable(canonical) !== stable(expected)) fail('canonical_reference_mismatch');
  return canonical;
}

/** One canonical read for a packet; keep all per-reference bindings and a fresh
 * access check before and after the read. Nothing is cached across requests. */
export async function resolveModelReferences({ packet, context, policy, sourceResolver }) {
  accessContext(context);
  if (packet.tenant !== context.tenant) fail('reference_scope_mismatch');
  const projection = modelProjection(packet.evidence, packet);
  if (stable(projection.references) !== stable(packet.reference_map)) fail('invalid_model_reference');
  const expected = Object.values(projection.references), access = await policy.allowed(context);
  if (expected.some(ref => !access.documents.includes(ref.document_id))) fail('reference_access_denied');
  const canonical = await sourceResolver(expected);
  if (stable(canonical) !== stable(expected)) fail('canonical_reference_mismatch');
  const current = await policy.allowed(context);
  if (current.revision !== access.revision || expected.some(ref => !current.documents.includes(ref.document_id))) fail('reference_access_denied');
  return canonical;
}
