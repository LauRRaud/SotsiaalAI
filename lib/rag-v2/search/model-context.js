import { fail, hash, stable } from '../contracts.js';
import { tokenCount, TOKENIZER } from './embedding.js';
import { accessContext } from './policy.js';

// json-2: every source card carries declared values only (27.09.2026).
// json-3 (ADR-062): a legal act's source card carries the act's own dates (act_dates) and an excerpt the amendment notes
// of its provisions (amendments). A source without them projects as in json-2.
// json-4 (ADR-086): the record lane's part is stated once where it repeated itself. Records whose source cards declare
// the same values share one card; a linked contact's entry names the person and the role, and its evidence text holds
// the unit and the channels; the links of one record to several others are one relation. Other evidence projects as
// in json-3.
export const MODEL_SERIALIZER = 'rag-v2/model-context-json-4';
// The legal dates' own cap, in tokens over the whole context. They are outside every token budget and selection measure,
// so they never cost a turn an excerpt, and no token limit fails a turn over them; the context can pass a measured limit
// by about this much (the cap counts each fragment on its own; in the context a fragment's first token can join the one
// before it, which made the real growth up to 3 tokens more than the counted sum over the registered acts). Of the pilot
// service's two byte checks, the audit packet's reads the packet without them (auditPacketBytes); the answer-input bound
// counts the request as it is sent, the dates and their instruction included.
export const LEGAL_DATES_TOKENS = 1500;
// The most a turn's audit packet may hold, in bytes of its JSON.
export const AUDIT_PACKET_BYTES = 512000;
export function serializeModelContext(context) { return context === null ? '' : JSON.stringify(context); }
export function modelSourceMetadata(bundle) {
  const scope = ['municipality_id', 'municipality_name', 'county', 'country', 'regions', 'jurisdiction_level']
    .filter(key => bundle.document.fields[key]?.value != null);
  return Object.fromEntries(['source_type', 'authority', 'language', 'historical', 'source_status', 'valid_from', 'valid_to', 'source_checked_at', ...scope]
    .map(key => [key, { value: bundle.document.fields[key]?.value ?? null,
      provenance: bundle.document.fields[key]?.provenance ?? [], review_state: bundle.document.fields[key]?.review_state ?? 'imported_not_verified' }]));
}
// Only limitations that bear on an answer reach the model: content that was not extracted, collected
// or unreviewed text, uncertain metadata and a reference list outside the evidence. Processing notes
// (layout, glyph repair, title checks, an unverified description) stay in the audit packet.
const ANSWER_LIMITATIONS = new Set(['pdf_pages_without_text_layer', 'non_text_media_not_extracted', 'collected_package_text',
  'knowledge_import_unreviewed', 'metadata_candidate_conflict', 'source_metadata_conflict', 'publication_year_conflict',
  'reference_list_not_visible', 'reference_list_not_chunked', 'test_transport_fixed_selection']);
export const answerLimitations = limitations => limitations.filter(w => ANSWER_LIMITATIONS.has(w.code));
function constraints(entry) {
  return answerLimitations(entry.limitations).map(w => ({ code: w.code,
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
// A contact's entry names the person and the role. Its unit, phone and e-mail stand in its evidence text, which the
// entry's refs point to: the entry repeated them with a ref on each, about 150 tokens a contact on corpus v56, and a
// municipality's contacts did not fit the record context (ADR-086). The packet keeps every field.
const CONTACT_ENTRY_FIELDS = ['name', 'role'];
function modelEntry({ key, kind, fields, detail }) {
  const shown = kind === 'contact' ? Object.fromEntries(CONTACT_ENTRY_FIELDS.filter(name => fields[name]).map(name => [name, fields[name]])) : fields;
  return { key, kind, fields: shown, ...(detail && detail !== 'catalogue' ? { detail } : {}) };
}
// A record that links to several others (a contact directory, a service with its forms) states the relation once,
// with every target: each link repeated the record, the relation, the state and the refs. Links whose target is not
// available keep their count only.
function modelRelations(relations) {
  const groups = new Map();
  for (const link of relations) {
    const key = stable([link.from, link.relation, link.state, link.refs]);
    if (!groups.has(key)) groups.set(key, { link, to: [], count: 0 });
    const group = groups.get(key);
    group.count++;
    if (link.to) group.to.push(link.to);
  }
  return [...groups.values()].map(({ link, to, count }) => ({ from: link.from, relation: link.relation, to: to.length > 1 ? to : to[0] ?? null,
    state: link.state, refs: link.refs, ...(!to.length && count > 1 ? { count } : {}) }));
}
function modelRecords(context, defaults) {
  const entries = context.entries?.map(modelEntry);
  return { ...context, ...(entries ? { entries } : {}), ...(Array.isArray(context.relations) ? { relations: modelRelations(context.relations) } : {}),
    ...(Object.keys(defaults).length ? { source_defaults: defaults } : {}) };
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
// The legal dates of the evidence (ADR-062), in evidence order under one cap: a source's card when its first excerpt
// comes, then each excerpt's notes. From the first one that does not fit, a card or an excerpt carries only the mark
// that says so (act_dates_omitted, amendments_omitted); room for every later mark is kept, so the marks are inside the
// cap too. That bound rests on finalLimit <= 30 (ranking.js): a mark is 9 tokens, and the dates come with one search's
// evidence only (of a unified turn's lanes the period ones hold journals and the record one records), so with at most
// 30 entries, each bringing its notes and at most its act's card, there are at most 60 fragments and 540 tokens of
// marks. From 167 fragments on the marks alone would pass the cap. Each fragment is counted on its own, as the JSON it
// adds, so the cap bounds that sum and not the context's exact growth.
function allotLegalDates(entries) {
  const slots = [], cards = new Set();
  for (const entry of entries) {
    const dates = recordEvidence(entry) ? null : entry.legal_dates, card = `${entry.document_id}/${entry.document_version_id}`;
    if (dates?.act && !cards.has(card)) slots.push({ entry, field: 'act_dates', value: dates.act });
    cards.add(card);
    if (dates?.amendments) slots.push({ entry, field: 'amendments', value: dates.amendments });
  }
  const mark = tokenCount(',"amendments_omitted":true'), fields = { act_dates: new Map(), amendments: new Map() };
  let tokens = 0, omitted = 0;
  for (const [index, slot] of slots.entries()) {
    const cost = tokenCount(`,"${slot.field}":${JSON.stringify(slot.value)}`);
    if (omitted || tokens + cost + mark * (slots.length - index - 1) > LEGAL_DATES_TOKENS) omitted++;
    fields[slot.field].set(slot.entry, omitted ? { [`${slot.field}_omitted`]: true } : { [slot.field]: slot.value });
    tokens += omitted ? mark : cost;
  }
  return slots.length ? { ...fields, tokens, shown: slots.length - omitted, omitted } : null;
}
// `dated` (allotLegalDates) adds a legal act's dates: act_dates closes its source card, amendments stands before the
// excerpt's text. Without it the context is the one every budget and selection step measures.
function projectContext(entries, scope, dated = null) {
  const sources = {}, documents = new Map(), evidence = [], recordSources = new Set();
  for (const [index, entry] of entries.entries()) {
    // A record's card holds declared values only and no title, so records that declare the same values share one
    // card: a municipality's services of one package, its contacts of one check (json-4). The card of other evidence
    // names its document and stays the document's own.
    const card = { ...entry.bibliography, ...(entry.source_metadata || {}), limitations: constraints(entry) };
    const shared = recordEvidence(entry) ? compactCard(card) : null;
    const documentKey = shared ? `record/${stable(shared)}` : `${entry.document_id}/${entry.document_version_id}`;
    let source = documents.get(documentKey);
    if (!source) {
      source = `D${documents.size + 1}`; documents.set(documentKey, source);
      // Declared values only: provenance paths, asset hashes and review states stay in the audit packet.
      // They cost 470-1000 tokens per source and pushed ranked evidence out of the budget (27.09.2026).
      sources[source] = shared ?? { title: card.title, ...compactCard(card), ...dated?.act_dates.get(entry) };
      if (shared) recordSources.add(source);
    }
    const ref = `S${index + 1}`;
    evidence.push(recordEvidence(entry) ? { ref, source, text: entry.source_text }
      : { ref, source, pdf_pages: entry.pdf_pages, ...(entry.pdf_pages.length ? {} : { source_locations: entry.source_locations?.map(({ kind, path, act_reference, record_id }) => ({ kind, path, ...(act_reference ? { act_reference } : {}), ...(record_id ? { record_id } : {}) })) }),
        ...dated?.amendments.get(entry), text: entry.source_text });
  }
  return entries.length || scope.record_context || scope.retrieval_context ? { schema_version: MODEL_SERIALIZER, sources, evidence,
    ...(scope.dependency_context ? { dependencies: scope.dependency_context } : {}),
    ...(scope.record_context ? { records: modelRecords(scope.record_context, hoistRecordDefaults(sources, recordSources)) } : {}),
    ...(scope.retrieval_context ? { retrieval: scope.retrieval_context } : {}) } : null;
}
/** A model context without the legal dates: the context every budget measure counts. */
export function stripLegalDates(context) {
  if (!context?.sources || !Array.isArray(context.evidence)) return context;
  return { ...context, sources: Object.fromEntries(Object.entries(context.sources).map(([key, { act_dates: _dates, act_dates_omitted: _cut, ...card }]) => [key, card])),
    evidence: context.evidence.map(({ amendments: _notes, amendments_omitted: _cut, ...excerpt }) => excerpt) };
}
/** What an audit packet's size limit counts: the packet without the legal dates of its entries and its context. Each
 *  entry carries its act's card and its own notes, which no cap over the packet bounds, so a packet that fits without
 *  them must not fail over them. A packet without them counts as it is. */
export function auditPacketBytes(packet) {
  return Buffer.byteLength(JSON.stringify({ ...packet, model_context: stripLegalDates(packet.model_context),
    ...(Array.isArray(packet.evidence) ? { evidence: packet.evidence.map(({ legal_dates: _dates, ...entry }) => entry) } : {}) }), 'utf8');
}
/** Lossless source-text projection. No descriptions, span arrays, hashes or rank scores go to the model. */
// measure 'budget' counts only the exact model context, which is all a budget decision reads: the
// audit counts tokenize the whole packet and made every fitting step slow (latency audit, 27.09.2026).
// measure 'none' is for a reference check, which reads only the references: a history load checks
// every earlier turn this way, and counting their tokens was most of its time (acceptance G5).
// annotations (ADR-062): the legal dates, in the context a turn sends (measure 'full') and never in a budget or a
// reference check, so evidence is selected exactly as without them. The full measure gives both counts:
// model_context_tokens is the context as sent, budget_context_tokens the same without the dates, which a limit reads.
export function modelProjection(entries, scope, { measure = 'full', annotations = measure === 'full' } = {}) {
  const references = {};
  for (const [index, entry] of entries.entries()) {
    references[`S${index + 1}`] = { tenant: scope.tenant, query_id: scope.query_id, generation_id: scope.generation_id,
      evidence_id: entry.evidence_id, document_id: entry.document_id, document_version_id: entry.document_version_id,
      unit_id: entry.unit_id, chunk_id: entry.chunk_id, span_ids: entry.span_ids, pdf_pages: entry.pdf_pages, ...(entry.source_locations === undefined ? {} : { source_locations: entry.source_locations }), source_text_sha256: hash(entry.source_text) };
  }
  const dated = annotations ? allotLegalDates(entries) : null, context = projectContext(entries, scope, dated);
  if (measure === 'none') return { context, references };
  const tokens = tokenCount(serializeModelContext(context));
  if (measure === 'budget') return { context, references, measurements: { tokenizer: TOKENIZER, serializer: MODEL_SERIALIZER, model_context_tokens: tokens } };
  const headerOnly = context ? { ...context, evidence: context.evidence.map(e => ({ ...e, text: '' })) } : null;
  return { context, references, measurements: { tokenizer: TOKENIZER, serializer: MODEL_SERIALIZER,
    audit_tokens: tokenCount(JSON.stringify(entries)), model_context_tokens: tokens,
    budget_context_tokens: dated ? tokenCount(serializeModelContext(projectContext(entries, scope))) : tokens,
    source_text_tokens: tokenCount(entries.map(e => e.source_text).join('\n')),
    reference_header_tokens: tokenCount(serializeModelContext(headerOnly)),
    ...(dated ? { legal_dates: { tokens: dated.tokens, limit: LEGAL_DATES_TOKENS, shown: dated.shown, omitted: dated.omitted } } : {}),
    token_parts_are_additive: false } };
}
export async function resolveModelReference({ packet, reference, context, policy, queryId, sourceResolver }) {
  accessContext(context);
  if (context.tenant !== packet.tenant || queryId !== packet.query_id || !/^S[1-9]\d*$/.test(reference)) fail('reference_scope_mismatch');
  const projection = modelProjection(packet.evidence, packet, { measure: 'none' });
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
  const projection = modelProjection(packet.evidence, packet, { measure: 'none' });
  if (stable(projection.references) !== stable(packet.reference_map)) fail('invalid_model_reference');
  const expected = Object.values(projection.references), access = await policy.allowed(context);
  if (expected.some(ref => !access.documents.includes(ref.document_id))) fail('reference_access_denied');
  const canonical = await sourceResolver(expected);
  if (stable(canonical) !== stable(expected)) fail('canonical_reference_mismatch');
  const current = await policy.allowed(context);
  if (current.revision !== access.revision || expected.some(ref => !current.documents.includes(ref.document_id))) fail('reference_access_denied');
  return canonical;
}
