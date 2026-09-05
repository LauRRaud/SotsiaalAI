import { fail, hash, stable } from '../contracts.js';
import { tokenCount, TOKENIZER } from './embedding.js';
import { accessContext } from './policy.js';

export const MODEL_SERIALIZER = 'rag-v2/model-context-json-1';
export function serializeModelContext(context) { return context === null ? '' : JSON.stringify(context); }
export function modelSourceMetadata(bundle) {
  return Object.fromEntries(['source_type', 'authority', 'language', 'historical', 'source_status', 'valid_from', 'valid_to', 'source_checked_at']
    .map(key => [key, { value: bundle.document.fields[key]?.value ?? null,
      provenance: bundle.document.fields[key]?.provenance ?? [], review_state: bundle.document.fields[key]?.review_state ?? 'imported_not_verified' }]));
}
function constraints(entry) {
  return entry.limitations.filter(w => w.code !== 'description_not_verified').map(w => ({ code: w.code,
    ...(w.detail ? { detail: w.detail } : {}), ...(w.resolution ? { resolution: w.resolution } : {}) }));
}
/** Lossless source-text projection. No descriptions, span arrays, hashes or rank scores go to the model. */
export function modelProjection(entries, scope) {
  const sources = {}, documents = new Map(), references = {}, evidence = [];
  for (const [index, entry] of entries.entries()) {
    const documentKey = `${entry.document_id}/${entry.document_version_id}`;
    let source = documents.get(documentKey);
    if (!source) {
      source = `D${documents.size + 1}`; documents.set(documentKey, source);
      sources[source] = { ...entry.bibliography, ...(entry.source_metadata || {}), limitations: constraints(entry) };
    }
    const ref = `S${index + 1}`;
    evidence.push({ ref, source, pdf_pages: entry.pdf_pages, text: entry.source_text });
    references[ref] = { tenant: scope.tenant, query_id: scope.query_id, generation_id: scope.generation_id,
      evidence_id: entry.evidence_id, document_id: entry.document_id, document_version_id: entry.document_version_id,
      unit_id: entry.unit_id, chunk_id: entry.chunk_id, span_ids: entry.span_ids, pdf_pages: entry.pdf_pages, source_text_sha256: hash(entry.source_text) };
  }
  const context = entries.length ? { schema_version: MODEL_SERIALIZER, sources, evidence } : null;
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
