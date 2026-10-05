import { randomUUID } from 'node:crypto';
import { fail, hash, id, nonempty, stable } from '../contracts.js';
import { accessContext } from './policy.js';
import { filtersMatch, rrf } from './ranking.js';
import { indexUnit } from './embedding.js';
import { answerLimitations, modelProjection } from './model-context.js';
import { chunkExcerpt } from './excerpt.js';
import { sourceEntry } from './retrieval.js';
import { retrievalDirectory } from './discovery.js';
import { withoutStopwords } from './query-stopwords.js';
import { generationIdentity } from './layout.js';

// catalogue-3 (ADR-086): a contact reached through a record's link is shown without its page address and check time,
// and only the contacts a view shows get a decision.
// catalogue-4 (ADR-089): beside the records closest to the question, the closest contact directory is opened too.
export const RECORD_RETRIEVAL_VERSION = 'rag-v2/record-catalogue-4';
// Stored turns and historical plans stay readable; only the current contract may execute.
export const READABLE_RECORD_RETRIEVAL_VERSIONS = Object.freeze(['rag-v2/record-catalogue-1', 'rag-v2/record-catalogue-2', 'rag-v2/record-catalogue-3', RECORD_RETRIEVAL_VERSION]);
const defaults = Object.freeze({ documents: 300, contextTokens: 12000, records: 300 });
// The records most relevant to the question are shown with all their fields (amount, conditions,
// application), so a first answer can use them; only while every title still fits the budget.
const RELEVANT_DETAILS = 3;
// A municipality's contact directory, as the register's export declares it (municipal-contact-export.js): a record
// that links to the people of one unit. Its own text is names and roles, so a question about a service never ranks it
// among the closest records: in the turns measured on 05.10.2026 the right directory stood 21st in Tallinn and 22nd in
// Narva behind the services, its people were not shown, and an answer to "whom do I call" had no contact to give
// (ADR-089). The most relevant directory is therefore opened beside the closest records, marked as what it is.
const CONTACT_DIRECTORY = 'municipal_contact_directory';
const contactDirectory = record => record.bundle.document.fields.source_type?.value === CONTACT_DIRECTORY;
const catalogueFields = new Set(['title', 'summary', 'name', 'role', 'department', 'official_url']);
const titleFields = new Set(['title', 'name']);
// A linked contact is a person to reach: who, in what role and unit, and how. The page the contact was verified on is
// the linking record's own address, and the time of the check is on the contact's source card: on corpus v56 the two
// took a third of the 83 tokens of a contact's evidence text and two of the seven fields of its entry (ADR-086).
const linkedContactOmits = new Set(['official_url', 'checked_at']);

// Region records share one catalogue: per-source provenance stays in the audit bundle. The
// model keeps each source's type, check date and its own declared status and validity period.
const VALIDITY_FIELDS = ['historical', 'source_status', 'valid_from', 'valid_to'];
export function compactEntry(entry) {
  const metadata = Object.fromEntries(['source_type', 'source_checked_at'].map(key => [key, { value: entry.source_metadata[key]?.value ?? null }]));
  for (const key of VALIDITY_FIELDS) {
    const value = entry.source_metadata[key]?.value;
    if (value !== null && value !== undefined && value !== false) metadata[key] = { value };
  }
  const limitations = answerLimitations(entry.limitations)
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

const spanMaps = new WeakMap();
const spanMap = bundle => {
  if (!spanMaps.has(bundle)) spanMaps.set(bundle, new Map(bundle.spans.map(span => [span.id, span])));
  return spanMaps.get(bundle);
};
const EMPTY_VALUE = /^\s*(?:\[\s*\]|\{\s*\}|null)\s*$/u;
const IDENTIFIER = /^[\p{Ll}\p{N}]+(?:[_:.-][\p{Ll}\p{N}]+)+$/u;
// A JSON list of machine identifiers (other records' IDs) is not the record's own text.
function identifierList(text) {
  let value; try { value = JSON.parse(text); } catch { return false; }
  return Array.isArray(value) && value.length > 0 && value.every(item => typeof item === 'string' && IDENTIFIER.test(item));
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
      || generation.id !== generationIdentity(context.tenant, generation.snapshot, generation.config, generation.layout)) fail('search_generation_integrity_failed');
    const allowed = new Set(access.documents), visible = Object.keys(generation.snapshot.documents).filter(doc => allowed.has(doc));
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
    // Do not expose contact identities, fields or channels without a live adapter decision. A contact is decided when
    // a view would show it, once for the turn: a municipality of over a hundred contacts used to decide every one of
    // them on every turn, although a turn shows the contacts of a few records (ADR-086).
    const authorized = new Map();
    const decide = async list => {
      for (const record of list) if (record.value.kind === 'contact' && !authorized.has(record)) {
        authorized.set(record, await this.authorizeContact({ context, record: record.value, bundle: record.bundle }) === true);
      }
    };
    const allowedRecord = record => record.value.kind !== 'contact' || authorized.get(record) === true;
    // Contacts asked for as catalogue records themselves are decided here; linked ones when a view shows them.
    await decide(roots);
    const catalogue = roots.filter(allowedRecord);
    // Question relevance orders the catalogue, it never filters it. With the turn's query vector the
    // generation's vector index ranks this region's record units, so a description of the situation
    // reaches a service whose name it never uses. Without a vector the lexical channel ranks them
    // (function words dropped, ADR-024). Records rank by their best unit. Vector-only, not RRF fusion:
    // on 53 real municipality/situation pairs fusion let generic word matches ("kodu") outrank the
    // vector's first hit (ADR-026).
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
    if (queryVector && unitIds.length) channels.vector = best(await this.qdrant.query(generation, documentIds, queryVector, unitIds.length, unitIds));
    else if (terms && unitIds.length) channels.lexical = best(await this.postgres.lexical(context.tenant, generation.id, documentIds, terms, unitIds.length, unitIds));
    const byId = new Map(catalogue.map(record => [record.value.id, record]));
    const fused = Object.keys(channels).length ? rrf(channels) : [];
    for (const row of fused) relevance.set(byId.get(row.id), row.score);
    // Audit only (the model view drops it): where each record landed in the fused ranking.
    const rankOf = new Map(fused.map((row, index) => [byId.get(row.id), index + 1]));
    const score = record => relevance.get(record) || 0;
    // Requested details first, then question relevance, then a stable order: a budget cut never
    // drops a requested detail and drops the least relevant records first.
    const priority = [...catalogue].sort((a, b) => Number(details.has(b)) - Number(details.has(a)) || score(b) - score(a)
      || a.value.id.localeCompare(b.value.id, 'en'));
    // `nearest`: the contact directory opened beside the closest records, when a view has one.
    let expanded = details, nearest = null;
    // contacts: false measures a view as if no linked contact could be shown, without deciding any.
    const project = async (view, listed, summarized = new Set(), { contacts = true } = {}) => {
      const included = new Set(listed), relations = [];
      // The full view expands every listed record; the title view expands only records shown in full.
      const opened = listed.filter(root => view === 'summary' || expanded.has(root));
      const linkTarget = link => { const target = aliases.get(link.target); return target && link.target_kinds.includes(target.value.kind) ? target : null; };
      if (contacts) await decide(opened.flatMap(root => root.value.links.map(linkTarget).filter(Boolean)));
      for (const root of opened) for (const link of root.value.links) {
        const target = linkTarget(link);
        const resolved = target && (contacts || target.value.kind !== 'contact') && allowedRecord(target);
        if (resolved) included.add(target);
        // Hidden/wrong-region/unverified targets have one neutral state and no ID/name leak.
        relations.push({ root, link, target: resolved ? target : null });
      }
      const ordered = [...included].sort((a, b) => a.value.id.localeCompare(b.value.id, 'en'));
      const keys = new Map(ordered.map((record, index) => [record, 'R' + (index + 1)]));
      const evidence = [], byChunk = new Map(), read = new Map();
      const refsAt = (record, paths, full = false) => {
        const chunks = record.bundle.chunks.filter(chunk => chunk.source_locations?.some(location => paths.includes(location.path)));
        for (const chunk of chunks) {
          const key = record.bundle.version.id + '/' + chunk.id;
          if (!byChunk.has(key)) {
            const unit = indexUnit(chunk, record.bundle, generation.config.embedding);
            byChunk.set(key, 'S' + (evidence.length + 1));
            evidence.push(compactEntry(sourceEntry(unit, record.bundle, 'structured_record', null)));
            read.set(key, { record, chunk, entry: evidence.at(-1), paths: new Set(), full: false });
          }
          const shown = read.get(key);
          for (const path of paths) shown.paths.add(path);
          shown.full ||= full;
        }
        return chunks.map(chunk => byChunk.get(record.bundle.version.id + '/' + chunk.id));
      };
      const entries = ordered.map(record => {
        const fields = {}, shown = view === 'summary' || summarized.has(record) ? catalogueFields : titleFields;
        // A contact that is here only as the target of a link: its fields without the page address and the check time,
        // and of its text only what those fields hold.
        const linkedContact = record.value.kind === 'contact' && !roots.includes(record);
        for (const [key, field] of Object.entries(record.value.fields)) {
          const full = expanded.has(record) || !roots.includes(record);
          if (!full && !shown.has(key) || linkedContact && linkedContactOmits.has(key)) continue;
          const refs = refsAt(record, [field.path], full && !linkedContact);
          if (!refs.length) continue; // An unanchored imported field is never answer evidence.
          fields[key] = { value: field.value, refs };
        }
        return { key: keys.get(record), record_id: record.value.id, kind: record.value.kind, region, fields,
          detail: details.has(record) ? 'selected_detail' : record === nearest ? 'contact_directory' : expanded.has(record) ? 'relevant_detail'
            : summarized.has(record) ? 'relevant_summary' : 'catalogue',
          ...(rankOf.has(record) ? { relevance_rank: rankOf.get(record) } : {}) };
      });
      const linked = relations.map(({ root, link, target }) => ({ from: keys.get(root), relation: link.relation,
        to: target ? keys.get(target) : null, state: target ? 'source_declared' : 'unavailable',
        refs: target ? refsAt(root, [link.path]) : [] }));
      if (linked.some(link => link.to && !link.refs.length)) fail('record_link_evidence_missing');
      // A record is one chunk (source-structure-v25); its evidence is the excerpt this view shows. A
      // listed title is its title, a summary adds the summary fields, a record shown in full keeps its
      // content. Identifier lists, empty values and targets of relations that are not shown (hidden
      // contacts, other regions) never leave the record: not in the packet, not in the model context.
      for (const { record, chunk, entry, paths, full } of read.values()) {
        const spans = spanMap(record.bundle), pathOf = span => record.bundle.source_units?.[span.source_unit_index]?.locator.path;
        const linkPaths = new Set(record.value.links.map(link => link.path));
        const kept = chunk.span_ids.map(spanId => spans.get(spanId)).filter(span => !EMPTY_VALUE.test(span.source_text)
          && (paths.has(pathOf(span)) || full && !linkPaths.has(pathOf(span)) && !identifierList(span.source_text)));
        if (!kept.length) fail('record_view_without_text');
        if (kept.length < chunk.span_ids.length) Object.assign(entry, chunkExcerpt(record.bundle, chunk, kept.map(span => span.id), spans));
      }
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
      return { packet, included, entries, projection: modelProjection(evidence, packet, { measure: 'budget' }) };
    };
    const fits = built => built.projection.measurements.model_context_tokens <= limits.contextTokens;
    // A real municipality can exceed the budget with summaries. Degrade to titles, then to a
    // marked partial title list; fail only when not even the requested details fit.
    const fitCatalogue = async () => {
    // The summary view shows the linked contacts of every record. When it does not fit even without them it cannot
    // fit with them, and none of them is decided.
    let built = fits(await project('summary', catalogue, new Set(), { contacts: false })) ? await project('summary', catalogue) : null;
    if (!built || !fits(built)) {
      built = await project('titles', catalogue);
      // The titles view still summarizes the records most relevant to the question, as many as fit.
      const relevant = priority.filter(record => !expanded.has(record) && score(record) > 0);
      for (let low = 1, high = fits(built) ? relevant.length : 0; low <= high;) {
        const middle = Math.floor((low + high) / 2), attempt = await project('titles', catalogue, new Set(relevant.slice(0, middle)));
        if (fits(attempt)) { built = attempt; low = middle + 1; } else high = middle - 1;
      }
    }
    if (!fits(built)) {
      let best = null, low = 1, high = priority.length;
      while (low <= high) {
        const middle = Math.floor((low + high) / 2), attempt = await project('titles', priority.slice(0, middle));
        if (fits(attempt)) { best = attempt; low = middle + 1; } else high = middle - 1;
      }
      if (!best || best.packet.record_context.listed_count < details.size) return null;
      built = best;
    }
    return built;
    };
    // First with the most relevant records in full; with fewer of them when that would cut the title list, the most
    // relevant one last to go (ADR-085: a record that links to many others, a contact directory, took all three
    // details away with it); without them when not even one fits.
    const automatic = priority.filter(record => !details.has(record) && score(record) > 0).slice(0, RELEVANT_DETAILS);
    // The contact directory closest to the question, when the question ranked anything and the directory is not opened
    // already. It is the first to go: a view that would cut the title list is tried again without it (ADR-089).
    const closest = automatic.length ? priority.find(contactDirectory) : null;
    const directory = closest && !details.has(closest) && !automatic.includes(closest) ? closest : null;
    const attempts = [...(directory ? [[...automatic, directory]] : []), ...automatic.map((_, at) => automatic.slice(0, automatic.length - at))];
    let built = null;
    for (const opened of attempts) {
      expanded = new Set([...details, ...opened]); nearest = directory && opened.includes(directory) ? directory : null;
      const attempt = await fitCatalogue();
      built ??= attempt;
      if (attempt && attempt.packet.record_context.completeness !== 'partial_context_budget') { built = attempt; break; }
    }
    if (!built || built.packet.record_context.completeness === 'partial_context_budget') { expanded = details; nearest = null; built = await fitCatalogue() ?? built; }
    if (!built) fail('record_context_budget_exceeded');
    const { packet, included, entries } = built, projection = modelProjection(packet.evidence, packet);
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
