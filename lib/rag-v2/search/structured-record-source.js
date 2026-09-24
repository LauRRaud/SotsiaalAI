import { randomUUID } from 'node:crypto';
import { fail, hash, id, nonempty, stable } from '../contracts.js';
import { accessContext } from './policy.js';
import { filtersMatch } from './ranking.js';
import { indexUnit } from './embedding.js';
import { modelProjection } from './model-context.js';
import { sourceEntry } from './retrieval.js';
import { retrievalDirectory } from './discovery.js';

export const RECORD_RETRIEVAL_VERSION = 'rag-v2/record-catalogue-2';
const defaults = Object.freeze({ documents: 300, contextTokens: 12000, records: 300 });
const catalogueFields = new Set(['title', 'summary', 'name', 'role', 'department', 'official_url']);
const titleFields = new Set(['title', 'name']);

// Region records share one catalogue: per-source provenance and repeated warnings stay in
// the audit bundle; the model gets each record's source type, check date and one warning list.
function compactEntry(entry, limitations) {
  for (const warning of entry.limitations) if (warning.code !== 'description_not_verified' && !limitations.has(warning.code))
    limitations.set(warning.code, { code: warning.code, ...(warning.detail ? { detail: warning.detail } : {}) });
  const metadata = Object.fromEntries(['source_type', 'source_checked_at'].map(key => [key, { value: entry.source_metadata[key]?.value ?? null }]));
  return { ...entry, source_metadata: metadata, limitations: [] };
}

/** Client-independent interface over immutable, authorized source records.
 * A catalogue is enumerated within a region, never a text-search top-k list.
 * Contact authorization is an adapter contract; absent verification hides it. */
export class StructuredRecordSource {
  constructor({ postgres, policy, authorizeContact = async () => false }) {
    Object.assign(this, { postgres, policy, authorizeContact });
  }
  async retrieve({ context, region, generationId, recordIds = [], kinds = ['service', 'benefit', 'resource'], limits: overrides = {} }) {
    accessContext(context);
    const limits = { ...defaults, ...overrides };
    if (!nonempty(region) || region.length > 100 || !Array.isArray(recordIds) || recordIds.length > 10 || !recordIds.every(nonempty)
      || !Array.isArray(kinds) || !kinds.length || kinds.length > 10 || !kinds.every(nonempty)
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
    // Requested details first, then a stable order: a budget cut never drops a requested detail.
    const priority = [...catalogue].sort((a, b) => Number(details.has(b)) - Number(details.has(a)) || a.value.id.localeCompare(b.value.id, 'en'));
    const project = (view, listed) => {
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
      const evidence = [], byChunk = new Map(), limitations = new Map();
      const refsAt = (record, paths) => {
        const chunks = record.bundle.chunks.filter(chunk => chunk.source_locations?.some(location => paths.includes(location.path)));
        for (const chunk of chunks) {
          const key = record.bundle.version.id + '/' + chunk.id;
          if (!byChunk.has(key)) {
            const unit = indexUnit(chunk, record.bundle, generation.config.embedding);
            byChunk.set(key, 'S' + (evidence.length + 1));
            evidence.push(compactEntry(sourceEntry(unit, record.bundle, 'structured_record', null), limitations));
          }
        }
        return chunks.map(chunk => byChunk.get(record.bundle.version.id + '/' + chunk.id));
      };
      const shown = view === 'summary' ? catalogueFields : titleFields;
      const entries = ordered.map(record => {
        const fields = {};
        for (const [key, field] of Object.entries(record.value.fields)) {
          const full = details.has(record) || !roots.includes(record);
          if (!full && !shown.has(key)) continue;
          const refs = refsAt(record, [field.path]);
          if (!refs.length) continue; // An unanchored imported field is never answer evidence.
          fields[key] = { value: field.value, refs };
        }
        return { key: keys.get(record), record_id: record.value.id, kind: record.value.kind, region, fields,
          detail: details.has(record) ? 'selected_detail' : 'catalogue' };
      });
      const linked = relations.map(({ root, link, target }) => ({ from: keys.get(root), relation: link.relation,
        to: target ? keys.get(target) : null, state: target ? 'source_declared' : 'unavailable',
        refs: target ? refsAt(root, [link.path]) : [] }));
      if (linked.some(link => link.to && !link.refs.length)) fail('record_link_evidence_missing');
      const packet = { schema_version: 'rag-v2/evidence-1', tenant: context.tenant, query_id: id('query', context.tenant, randomUUID()),
        generation_id: generation.id, state: 'ok', evidence,
        record_context: { version: RECORD_RETRIEVAL_VERSION, region, view, entries, relations: linked,
          catalogue_count: catalogue.length, listed_count: listed.length, catalogue_scope: 'authorized_indexed_records_only',
          completeness: listed.length < catalogue.length ? 'partial_context_budget'
            : bundles.length === records.length ? 'complete_within_authorized_indexed_scope' : 'partial_unstructured_sources',
          freshness: { contact: 'identity_and_channels_verified_at_read', other_records: 'collected_not_verified_current' },
          source_limitations: [...limitations.values()], current_availability: 'not_established' } };
      return { packet, included, entries, projection: modelProjection(evidence, packet) };
    };
    const fits = built => built.projection.measurements.model_context_tokens <= limits.contextTokens;
    // A real municipality can exceed the budget with summaries. Degrade to titles, then to a
    // marked partial title list; fail only when not even the requested details fit.
    let built = project('summary', catalogue);
    if (!fits(built)) built = project('titles', catalogue);
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
