import { fail, id, stable } from './contracts.js';

export const KNOWLEDGE_SCHEMA = 'rag-v2/knowledge-input-1';
export const KNOWLEDGE_TYPES = Object.freeze(['assertion', 'condition', 'exception', 'definition']);
export const DEPENDENCY_TYPES = Object.freeze(['MENTIONS', 'RELATED_TOPIC', 'CITES', 'DESCRIBES', 'REQUIRES', 'EXCEPTION_TO', 'DEFINES', 'QUALIFIES', 'SUPERSEDES']);
export const KNOWLEDGE_STATE = 'source_anchored_unreviewed';
const keyPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;
const versionPattern = /^version_[a-f0-9]{64}$/;
const documentPattern = /^document_[a-f0-9]{64}$/;

function shape(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) fail('invalid_knowledge_shape');
}
function text(value, max) {
  if (typeof value !== 'string' || !value.trim() || !value.isWellFormed() || value.includes('\0') || value.length > max) fail('invalid_knowledge_text');
}
function list(value, min, max) {
  if (!Array.isArray(value) || value.length < min || value.length > max) fail('invalid_knowledge_list');
}
function key(value) { if (typeof value !== 'string' || !keyPattern.test(value)) fail('invalid_knowledge_key'); }
function anchors(value) {
  list(value, 1, 8);
  for (const anchor of value) {
    shape(anchor, ['pdf_page', 'quote', 'start']); text(anchor.quote, 4000);
    if (!Number.isSafeInteger(anchor.pdf_page) || anchor.pdf_page < 1
      || anchor.start !== undefined && (!Number.isSafeInteger(anchor.start) || anchor.start < 0)) fail('invalid_knowledge_anchor');
  }
}

/** Imported JSON describes source claims; it cannot confer a verified review state. */
export function validateKnowledgeInput(value) {
  if (value === undefined) return;
  shape(value, ['schema_version', 'cards', 'dependencies']);
  if (value.schema_version !== KNOWLEDGE_SCHEMA) fail('unsupported_knowledge_schema');
  list(value.cards, 1, 256); list(value.dependencies, 0, 512);
  const keys = new Set();
  for (const card of value.cards) {
    shape(card, ['key', 'kind', 'statement', 'subject', 'predicate', 'object', 'scope', 'anchors']);
    key(card.key); text(card.statement, 2000); text(card.scope, 1000); anchors(card.anchors);
    if (!KNOWLEDGE_TYPES.includes(card.kind) || keys.has(card.key)) fail('invalid_knowledge_card');
    keys.add(card.key);
    const parts = ['subject', 'predicate', 'object'];
    if (parts.some(part => card[part] !== undefined)) for (const part of parts) text(card[part], 500);
  }
  const edgeKeys = new Set();
  for (const edge of value.dependencies) {
    shape(edge, ['key', 'type', 'from', 'targets', 'operator', 'scope', 'anchors']);
    key(edge.key); key(edge.from); text(edge.scope, 1000); anchors(edge.anchors);
    if (edgeKeys.has(edge.key) || !keys.has(edge.from) || !DEPENDENCY_TYPES.includes(edge.type)
      || !['all', 'any'].includes(edge.operator) || edge.operator === 'any' && edge.type !== 'REQUIRES') fail('invalid_knowledge_dependency');
    edgeKeys.add(edge.key); list(edge.targets, 1, 16);
    const targets = new Set();
    for (const target of edge.targets) {
      shape(target, ['key', 'document_id', 'version_id']); key(target.key);
      if ((target.document_id === undefined) !== (target.version_id === undefined)) fail('knowledge_target_version_required');
      if (target.document_id === undefined ? !keys.has(target.key)
        : !documentPattern.test(target.document_id) || !versionPattern.test(target.version_id)) fail('invalid_knowledge_target');
      if (targets.has(stable(target))) fail('duplicate_knowledge_target');
      targets.add(stable(target));
    }
  }
}

function resolveAnchors(values, bundle) {
  return values.map(anchor => {
    const page = bundle.pages[anchor.pdf_page - 1];
    if (!page || page.pdf_page !== anchor.pdf_page) fail('knowledge_anchor_page_missing');
    const start = anchor.start ?? page.raw_text.indexOf(anchor.quote);
    if (start < 0 || page.raw_text.slice(start, start + anchor.quote.length) !== anchor.quote) fail('knowledge_anchor_text_mismatch');
    if (anchor.start === undefined && page.raw_text.indexOf(anchor.quote, start + 1) !== -1) fail('knowledge_anchor_ambiguous');
    const end = start + anchor.quote.length;
    const spans = bundle.spans.filter(span => span.pdf_page === anchor.pdf_page && span.start < end && span.end > start).sort((a, b) => a.start - b.start);
    if (!spans.length) fail('knowledge_anchor_outside_source');
    // Every non-whitespace character of the quote must survive in canonical spans.
    let cursor = start;
    for (const span of spans) {
      if (page.raw_text.slice(cursor, Math.max(cursor, span.start)).trim()) fail('knowledge_anchor_outside_source');
      cursor = Math.max(cursor, Math.min(end, span.end));
    }
    if (page.raw_text.slice(cursor, end).trim()) fail('knowledge_anchor_outside_source');
    return { pdf_page: anchor.pdf_page, start, end, quote: anchor.quote, span_ids: spans.map(span => span.id) };
  });
}

export function prepareKnowledge(value, bundle) {
  validateKnowledgeInput(value);
  if (value === undefined) return { knowledge_cards: [], dependencies: [] };
  const scope = { tenant_id: bundle.tenant_id, document_version_id: bundle.version.id };
  const cardId = (version, key) => id('knowledge_card', scope.tenant_id, version, key);
  const grounded = entry => {
    const anchors = resolveAnchors(entry.anchors, bundle);
    return { anchors, span_ids: [...new Set(anchors.flatMap(anchor => anchor.span_ids))],
      verification_state: KNOWLEDGE_STATE, provenance: { kind: 'metadata', asset_hash: bundle.version.metadata_hash, schema_version: KNOWLEDGE_SCHEMA } };
  };
  const knowledge_cards = value.cards.map(card => ({ ...scope, id: cardId(bundle.version.id, card.key), key: card.key,
    kind: card.kind, statement: card.statement, scope: card.scope,
    ...(card.subject === undefined ? {} : { subject: card.subject, predicate: card.predicate, object: card.object }), ...grounded(card) }));
  const dependencies = value.dependencies.map(edge => ({ ...scope, id: id('dependency', scope.tenant_id, bundle.version.id, edge.key), key: edge.key,
    type: edge.type, from_card_id: cardId(bundle.version.id, edge.from), operator: edge.operator, scope: edge.scope,
    targets: edge.targets.map(target => ({ document_id: target.document_id ?? bundle.document.id,
      document_version_id: target.version_id ?? bundle.version.id, card_id: cardId(target.version_id ?? bundle.version.id, target.key) })), ...grounded(edge) }));
  return { knowledge_cards, dependencies };
}

export function validateKnowledgeBundle(bundle) {
  const input = bundle.document.legacy_metadata?.knowledge;
  if (input === undefined && !bundle.knowledge_cards?.length && !bundle.dependencies?.length) return;
  const expected = prepareKnowledge(input, bundle);
  if (stable(bundle.knowledge_cards) !== stable(expected.knowledge_cards) || stable(bundle.dependencies) !== stable(expected.dependencies)) fail('knowledge_provenance_mismatch');
}

/** Explicit four-valued input only. Missing user facts are never treated as false. */
export function conditionGroupState(operator, states) {
  if (!['all', 'any'].includes(operator) || !Array.isArray(states) || !states.length
    || states.some(state => !['true', 'false', 'unknown', 'conflict'].includes(state))) fail('invalid_condition_state');
  if (states.includes('conflict')) return 'conflict';
  if (operator === 'all') return states.includes('false') ? 'false' : states.includes('unknown') ? 'unknown' : 'true';
  return states.includes('true') ? 'true' : states.includes('unknown') ? 'unknown' : 'false';
}
