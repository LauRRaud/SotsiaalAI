import { randomUUID } from 'node:crypto';
import { fail, hash, id, stable } from '../contracts.js';
import { DISCOVERY_SCHEMA } from './discovery.js';
import { modelProjection } from './model-context.js';
import { filtersMatch, publicationYear } from './ranking.js';

export const UNIFIED_RETRIEVAL_VERSION = 'rag-v2/unified-retrieval-1';
export const UNIFIED_LIMITS = Object.freeze({ directoryDocuments: 1000, periods: 2, contextTokens: 24000 });

export function unifiedDirectory(directories) {
  if (!Array.isArray(directories) || directories.length > UNIFIED_LIMITS.directoryDocuments
    || directories.some(row => row.schema_version !== DISCOVERY_SCHEMA || !row.source
      || typeof row.source.journal !== 'boolean'
      || row.source.record_kind !== null && typeof row.source.record_kind !== 'string')
    || new Set(directories.map(row => row.document_id)).size !== directories.length) fail('unified_directory_required');
  return { knowledge: directories.filter(row => row.source.record_kind === null),
    journals: directories.filter(row => row.source.record_kind === null && row.source.journal) };
}

export const publicationFilters = period => ({ ...(period.from ? { publication_from: period.from } : {}),
  ...(period.to ? { publication_to: period.to } : {}) });

function coverage(directories, packet, filters = {}) {
  const eligible = directories.filter(row => filtersMatch({ document: { fields: row.fields } }, filters));
  const byYear = {}, yearOnly = row => !row.fields.publication_date.value && publicationYear(row.fields.publication_year?.value);
  for (const row of eligible) {
    const year = row.fields.publication_date.value?.slice(0, 4) || publicationYear(row.fields.publication_year?.value);
    if (year) byYear[year] = (byYear[year] || 0) + 1;
  }
  return { counting_unit: 'indexed_source_document', indexed_documents: eligible.length,
    selected_documents: new Set(packet.evidence.map(entry => entry.document_id)).size,
    // Neither a full date nor an imported year: such a source belongs to no period.
    missing_publication_date_documents: directories.filter(row => !row.fields.publication_date.value && !yearOnly(row)).length,
    publication_year_only_documents: directories.filter(yearOnly).length,
    documents_by_publication_year: byYear, article_deduplication: 'not_assessed',
    corpus_completeness: 'not_assessed', selection: 'bounded_excerpts_not_exhaustive_reading' };
}

function remapRefs(value, references) {
  if (Array.isArray(value)) return value.map(item => remapRefs(item, references));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, key === 'refs' ? item.map(ref => {
    if (!references.has(ref)) fail('unified_reference_missing');
    return references.get(ref);
  }) : remapRefs(item, references)]));
}

/** All lanes share one authorized generation. Rebuild S references once, keeping
 * source-record links and graph dependencies attached to their original evidence. */
export function mergeUnifiedPackets({ tenant, generationId, directories, plan, lanes }) {
  const groups = unifiedDirectory(directories);
  if (plan.version !== UNIFIED_RETRIEVAL_VERSION || !Array.isArray(plan.publicationCandidates)
    || plan.publicationCandidates.length > UNIFIED_LIMITS.periods || !Array.isArray(lanes) || lanes.length > 4
    || new Set(lanes.map(lane => lane.key)).size !== lanes.length) fail('invalid_unified_plan');
  const packet = { tenant, generation_id: generationId, query_id: id('query', tenant, randomUUID()), state: 'ok', evidence: [] };
  const byDocument = new Map(directories.map(row => [row.document_id, row]));
  const seen = new Map(), reports = [], dependencies = [];
  for (const lane of lanes) {
    const source = lane.packet;
    if (source.tenant !== tenant || source.generation_id !== generationId || !['ok', 'empty'].includes(source.state)) fail('unified_lane_scope_mismatch');
    const references = new Map();
    for (const [index, entry] of source.evidence.entries()) {
      const directory = byDocument.get(entry.document_id);
      if (directory?.version_id !== entry.document_version_id
        || lane.kind === 'knowledge' && directory.source.record_kind !== null
        || lane.kind === 'publication_period' && (!directory.source.journal || directory.source.record_kind !== null
          || !filtersMatch({ document: { fields: directory.fields } }, publicationFilters(lane.period)))) fail('unified_lane_scope_mismatch');
      const existing = seen.get(entry.evidence_id);
      if (existing && stable({ ...existing.entry, selection: null }) !== stable({ ...entry, selection: null })) fail('unified_evidence_conflict');
      if (!existing) {
        packet.evidence.push(entry);
        seen.set(entry.evidence_id, { entry, ref: `S${packet.evidence.length}` });
      }
      references.set(`S${index + 1}`, seen.get(entry.evidence_id).ref);
    }
    if (source.record_context) {
      if (packet.record_context) fail('duplicate_record_lane');
      packet.record_context = remapRefs(source.record_context, references);
    }
    if (source.dependency_context) {
      const mapped = remapRefs(source.dependency_context, references), key = value => `${lane.key}/${value}`;
      dependencies.push({ ...mapped, claims: mapped.claims.map(claim => ({ ...claim, key: key(claim.key) })),
        relations: mapped.relations.map(edge => ({ ...edge, from: key(edge.from), targets: edge.targets.map(key) })),
        unresolved: mapped.unresolved.map(gap => ({ ...gap, ...(gap.from ? { from: key(gap.from) } : {}) })) });
    }
    reports.push({ key: lane.key, kind: lane.kind, state: source.evidence.length ? 'selected' : 'no_evidence',
      refs: [...new Set(references.values())],
      ...(lane.kind === 'publication_period' ? { period: lane.period, filters: publicationFilters(lane.period),
        coverage: coverage(groups.journals, source, publicationFilters(lane.period)) } : {}),
      ...(lane.kind === 'knowledge' ? { filters: {}, coverage: coverage(groups.knowledge, source) } : {}) });
  }
  if (dependencies.length) packet.dependency_context = { schema_version: 'rag-v2/dependency-context-1',
    known_context: dependencies.some(value => value.known_context === 'incomplete') ? 'incomplete' : 'included',
    corpus_completeness: 'not_assessed', verification_state: 'source_anchored_unreviewed',
    claims: dependencies.flatMap(value => value.claims), relations: dependencies.flatMap(value => value.relations),
    unresolved: dependencies.flatMap(value => value.unresolved) };
  packet.retrieval_context = { version: UNIFIED_RETRIEVAL_VERSION, interpretation: plan.interpretation,
    temporal: plan.temporal, lanes: reports, semantic_quality: 'NOT_PROVEN' };
  packet.retrieval_audit = { version: UNIFIED_RETRIEVAL_VERSION, directory_hash: hash(stable(directories)),
    context_hash: hash(stable(packet.retrieval_context)) };
  const projection = modelProjection(packet.evidence, packet);
  if (projection.measurements.model_context_tokens > UNIFIED_LIMITS.contextTokens) fail('unified_context_budget_exceeded');
  return { ...packet, model_context: projection.context, reference_map: projection.references, measurements: projection.measurements };
}

/** Counts are derived data too: a revoked document cannot survive as a denominator
 * just because none of its excerpts was selected. Recheck the full counted scope. */
export function checkUnifiedDirectory(packet, directories) {
  unifiedDirectory(directories);
  if (packet.retrieval_audit?.version !== UNIFIED_RETRIEVAL_VERSION
    || packet.retrieval_audit.directory_hash !== hash(stable(directories))
    || packet.retrieval_audit.context_hash !== hash(stable(packet.retrieval_context))) fail('unified_scope_changed');
}
