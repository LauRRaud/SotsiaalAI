import { randomUUID } from 'node:crypto';
import { fail, hash, id, nonempty, stable } from '../contracts.js';
import { accessContext } from './policy.js';
import { filtersMatch, rrf } from './ranking.js';
import { indexUnit } from './embedding.js';
import { modelProjection } from './model-context.js';
import { sourceEntry } from './retrieval.js';
import { retrievalDirectory } from './discovery.js';
import { withoutStopwords } from './query-stopwords.js';

export const RECORD_RETRIEVAL_VERSION = 'rag-v2/record-catalogue-2';
// Stored turns and historical plans stay readable; only the current contract may execute.
export const READABLE_RECORD_RETRIEVAL_VERSIONS = Object.freeze(['rag-v2/record-catalogue-1', RECORD_RETRIEVAL_VERSION]);
const defaults = Object.freeze({ documents: 300, contextTokens: 12000, records: 300 });
const catalogueFields = new Set(['title', 'summary', 'name', 'role', 'department', 'official_url']);
const titleFields = new Set(['title', 'name']);
// Channel weights for fusing the catalogue's lexical and vector record rankings (ADR-026).
export const RECORD_RELEVANCE_WEIGHTS = Object.freeze({ lexical: 1, vector: 1 });

// Region records share one catalogue: per-source provenance stays in the audit bundle. The
// model keeps each source's type, check date and its own declared status and validity period.
const VALIDITY_FIELDS = ['historical', 'source_status', 'valid_from', 'valid_to'];
export function compactEntry(entry) {
  const metadata = Object.fromEntries(['source_type', 'source_checked_at'].map(key => [key, { value: entry.source_metadata[key]?.value ?? null }]));
  for (const key of VALIDITY_FIELDS) {
    const value = entry.source_metadata[key]?.value;
    if (value !== null && value !== undefined && value !== false) metadata[key] = { value };
  }
  const limitations = entry.limitations.filter(warning => warning.code !== 'description_not_verified')
    .map(warning => ({ code: warning.code, ...(warning.detail ? { detail: warning.detail } : {}) }));
  return { ...entry, source_metadata: metadata, limitations };
}
// A warning identical on every source is listed once; a source-specific warning stays with its source.
export function shareLimitations(evidence) {
  const counts = new Map();
  for (const entry of evidence) for (const key of new Set(entry.limitations.map(stable))) counts.set(key, (counts.get(key) || 0) + 1);
  const shared = new Set([...counts].filter(([, count]) => count === evidence.length).map(([key]) => key));
  for (const entry of evidence) entry.limitations = entry.limitations.filter(warning => !shared.has(stable(warning)));
  return [...shared].map(key => JSON.parse(key));
}

/** Client-independent interface over immutable, authorized source records.
 * A catalogue is enumerated within a region, never a text-search top-k list.
 * Contact authorization is an adapter contract; absent verification hides it. */
export class StructuredRecordSource {
  constructor({ postgres, policy, authorizeContact = async () => false, qdrant = null }) {
    Object.assign(this, { postgres, policy, authorizeContact, qdrant });
  }
  async retrieve({ context, region, generationId, recordIds = [], kinds = ['service', 'benefit', 'resource'], question = null, queryVector = null, limits: overrides = {} }) {
    accessContext(context);
    const limits = { ...defaults, ...overrides };
    if (!nonempty(region) || region.length > 100 || !Array.isArray(recordIds) || recordIds.length > 10 || !recordIds.every(nonempty)
      || !Array.isArray(kinds) || !kinds.length || kinds.length > 10 || !kinds.every(nonempty)
      || question !== null && (!nonempty(question) || question.length > 8000)
      || queryVector !== null && (!Array.isArray(queryVector) || !this.qdrant)
      || Object.entries(limits).some(([key, value]) => !Object.hasOwn(defaults, key) || !Number.isInteger(value) || value < 1 || value > defaults[key])) fail('invalid_record_query');
    const access = await this.policy.allowed(context), generation = await this.postgres.active(context.tenant);
    if (generationId && generation.id !== generationId) fail('requested_generation_not_active');
    if (generation.snapshot.snapshot_hash !== hash(stable(generation.snapshot.documents))
      || generation.id !== id('search_generation', context.tenant, generation.snapshot, generation.config)) fail('search_generation_integrity_failed');
    const visible = Object.keys(generation.snapshot.documents).filter(doc => access.documents.includes(doc));
    const directories = await this.postgres.retrievalDirectory(context.tenant, generation, visible);
    if (!directories) fail('record_directory_required');
    const selected = directories.filter(directory => filtersMatch({ document: { fields: directory.fields } }, { region }));
    if (selected.length > limits.documents) fail('record_document_budget_exceeded');
    const bundles = selected.length ? await this.postgres.bundles(context.tenant, generation.id, selected.map(d => d.document_id)) : [];
    if (bundles.length !== selected.length || new Set(bundles.map(b => b.document.id)).size !== selected.length) fail('missing_generation_source');
    const byDocument = new Map(selected.map(d => [d.document_id, d]));
    for (const bundle of bundles) {
      if (stable(retrievalDirectory(bundle, generation.config.embedding, byDocument.get(bundle.document.id).schema_version)) !== stable(byDocument.get(bundle.document.id))) fail('record_source_scope_mismatch');
    }
    const records = bundles.filter(bundle => bundle.document.fields.structured_record?.value.region === region)
      .map(bundle => ({ bundle, value: bundle.document.fields.structured_record.value }));
    if (records.length > limits.records) fail('record_count_budget_exceeded');
    const aliases = new Map();
    for (const record of records) for (const alias of record.value.aliases) {
      if (aliases.has(alias) && aliases.get(alias) !== record) fail('ambiguous_record_identity');
      aliases.set(alias, record);
    }
    const roots = records.filter(record => kinds.includes(record.value.kind));
    if (recordIds.some(key => !roots.includes(aliases.get(key)))) fail('record_not_available');
    const details = new Set(recordIds.map(key => aliases.get(key)));
    // Do not expose contact identities, fields or channels without a live adapter decision.
    const authorized = new Map();
    for (const record of records.filter(record => record.value.kind === 'contact')) {
      authorized.set(record, await this.authorizeContact({ context, record: record.value, bundle: record.bundle }) === true);
    }
    const allowedRecord = record => record.value.kind !== 'contact' || authorized.get(record) === true;
    const catalogue = roots.filter(allowedRecord);
    // Question relevance orders the catalogue, it never filters it. The generation's own lexical
    // channel (function words dropped first, ADR-024) and, when the turn's query vector is given,
    // its vector index rank this region's record units; each channel ranks records by their best
    // unit and the two rankings are fused with the main search's RRF (ADR-026). A description of
    // the situation can then reach a service whose name it never uses.
    const relevance = new Map(), terms = question === null ? '' : withoutStopwords(question);
    const recordOf = new Map();
    if (terms || queryVector) for (const record of catalogue) for (const chunk of record.bundle.chunks) recordOf.set(indexUnit(chunk, record.bundle, generation.config.embedding).id, record);
    const documentIds = catalogue.map(record => record.bundle.document.id), unitIds = [...recordOf.keys()];
    const best = rows => {
      const scores = new Map();
      for (const row of rows) {
        const record = recordOf.get(row.id);
        if (!record || row.document_id !== undefined && row.document_id !== record.bundle.document.id) fail('record_relevance_outside_scope');
        scores.set(record, Math.max(scores.get(record) ?? -Infinity, Number(row.score)));
      }
      return [...scores].sort((a, b) => b[1] - a[1] || a[0].value.id.localeCompare(b[0].value.id, 'en')).map(([record]) => ({ id: record.value.id }));
    };
    const channels = {};
    if (terms && unitIds.length) channels.lexical = best(await this.postgres.lexical(context.tenant, generation.id, documentIds, terms, unitIds.length, unitIds));
    if (queryVector && unitIds.length) channels.vector = best(await this.qdrant.query(generation, documentIds, queryVector, unitIds.length, unitIds));
    const byId = new Map(catalogue.map(record => [record.value.id, record]));
    for (const row of Object.keys(channels).length ? rrf(channels, 60, RECORD_RELEVANCE_WEIGHTS) : []) relevance.set(byId.get(row.id), row.score);
    const score = record => relevance.get(record) || 0;
    // Requested details first, then question relevance, then a stable order: a budget cut never
    // drops a requested detail and drops the least relevant records first.
    const priority = [...catalogue].sort((a, b) => Number(details.has(b)) - Number(details.has(a)) || score(b) - score(a)
      || a.value.id.localeCompare(b.value.id, 'en'));
    const project = (view, listed, summarized = new Set()) => {
      const included = new Set(listed), relations = [];
      // The full view expands every listed record; the title view expands only requested details.
      for (const root of listed) if (view === 'summary' || details.has(root)) for (const link of root.value.links) {
        const target = aliases.get(link.target);
        const resolved = target && link.target_kinds.includes(target.value.kind) && allowedRecord(target);
        if (resolved) included.add(target);
        // Hidden/wrong-region/unverified targets have one neutral state and no ID/name leak.
        relations.push({ root, link, target: resolved ? target : null });
      }
      const ordered = [...included].sort((a, b) => a.value.id.localeCompare(b.value.id, 'en'));
      const keys = new Map(ordered.map((record, index) => [record, 'R' + (index + 1)]));
      const evidence = [], byChunk = new Map();
      const refsAt = (record, paths) => {
        const chunks = record.bundle.chunks.filter(chunk => chunk.source_locations?.some(location => paths.includes(location.path)));
        for (const chunk of chunks) {
          const key = record.bundle.version.id + '/' + chunk.id;
          if (!byChunk.has(key)) {
            const unit = indexUnit(chunk, record.bundle, generation.config.embedding);
            byChunk.set(key, 'S' + (evidence.length + 1));
            evidence.push(compactEntry(sourceEntry(unit, record.bundle, 'structured_record', null)));
          }
        }
        return chunks.map(chunk => byChunk.get(record.bundle.version.id + '/' + chunk.id));
      };
      const entries = ordered.map(record => {
        const fields = {}, shown = view === 'summary' || summarized.has(record) ? catalogueFields : titleFields;
        for (const [key, field] of Object.entries(record.value.fields)) {
          const full = details.has(record) || !roots.includes(record);
          if (!full && !shown.has(key)) continue;
          const refs = refsAt(record, [field.path]);
          if (!refs.length) continue; // An unanchored imported field is never answer evidence.
          fields[key] = { value: field.value, refs };
        }
        return { key: keys.get(record), record_id: record.value.id, kind: record.value.kind, region, fields,
          detail: details.has(record) ? 'selected_detail' : summarized.has(record) ? 'relevant_summary' : 'catalogue' };
      });
      const linked = relations.map(({ root, link, target }) => ({ from: keys.get(root), relation: link.relation,
        to: target ? keys.get(target) : null, state: target ? 'source_declared' : 'unavailable',
        refs: target ? refsAt(root, [link.path]) : [] }));
      if (linked.some(link => link.to && !link.refs.length)) fail('record_link_evidence_missing');
      const sourceLimitations = shareLimitations(evidence);
      const packet = { schema_version: 'rag-v2/evidence-1', tenant: context.tenant, query_id: id('query', context.tenant, randomUUID()),
        generation_id: generation.id, state: 'ok', evidence,
        record_context: { version: RECORD_RETRIEVAL_VERSION, region, view, entries, relations: linked,
          catalogue_count: catalogue.length, listed_count: listed.length, catalogue_scope: 'authorized_indexed_records_only',
          selection: question === null && queryVector === null ? 'stable_id' : 'question_relevance', relevant_summaries: summarized.size,
          ...(queryVector !== null || question !== null ? { relevance_channels: Object.keys(channels) } : {}),
          completeness: listed.length < catalogue.length ? 'partial_context_budget'
            : bundles.length === records.length ? 'complete_within_authorized_indexed_scope' : 'partial_unstructured_sources',
          freshness: { contact: 'identity_and_channels_verified_at_read', other_records: 'collected_not_verified_current',
            validity: 'a source that declares historical status, source_status or valid_from/valid_to carries them itself' },
          source_limitations: sourceLimitations, current_availability: 'not_established' } };
      return { packet, included, entries, projection: modelProjection(evidence, packet) };
    };
    const fits = built => built.projection.measurements.model_context_tokens <= limits.contextTokens;
    // A real municipality can exceed the budget with summaries. Degrade to titles, then to a
    // marked partial title list; fail only when not even the requested details fit.
    let built = project('summary', catalogue);
    if (!fits(built)) {
      built = project('titles', catalogue);
      // The titles view still summarizes the records most relevant to the question, as many as fit.
      const relevant = priority.filter(record => !details.has(record) && score(record) > 0);
      for (let low = 1, high = fits(built) ? relevant.length : 0; low <= high;) {
        const middle = Math.floor((low + high) / 2), attempt = project('titles', catalogue, new Set(relevant.slice(0, middle)));
        if (fits(attempt)) { built = attempt; low = middle + 1; } else high = middle - 1;
      }
    }
    if (!fits(built)) {
      let best = null, low = 1, high = priority.length;
      while (low <= high) {
        const middle = Math.floor((low + high) / 2), attempt = project('titles', priority.slice(0, middle));
        if (fits(attempt)) { best = attempt; low = middle + 1; } else high = middle - 1;
      }
      if (!best || best.packet.record_context.listed_count < details.size) fail('record_context_budget_exceeded');
      built = best;
    }
    const { packet, included, entries, projection } = built;
    const now = await this.policy.allowed(context);
    if (now.revision !== access.revision || selected.some(d => !now.documents.includes(d.document_id))) fail('access_changed_during_retrieval');
    if ((await this.postgres.active(context.tenant)).id !== generation.id) fail('search_generation_changed');
    for (const record of included) if (record.value.kind === 'contact'
      && await this.authorizeContact({ context, record: record.value, bundle: record.bundle }) !== true) fail('record_contact_access_changed');
    return { ...packet, model_context: projection.context, reference_map: projection.references,
      measurements: { ...projection.measurements, external_embedding_calls: 0, generation_calls: 0,
        loaded_documents: bundles.length, records: entries.length } };
  }
}
