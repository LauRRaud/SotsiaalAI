import { ANSWER_SCHEMA, ANSWER_VERSION, answerRequest, validateAnswer, boundedDraft, digest, reject } from './contracts.js';
import { hash } from '../contracts.js';
import { evidenceSegments, segmentedEvidenceContext } from './evidence-segments.js';

// Version 1 remains readable for the original candidate and keeps its quote
// contract intact. Version 2 is opt-in and sends only server-created IDs.
export const EVIDENCE_DRAFT_VERSION = 'm4-evidence-draft-1';
export const EVIDENCE_DRAFT_PROMPT = 'm4-evidence-first-1';
export const EVIDENCE_DRAFT_V2_VERSION = 'm4-evidence-draft-2';
export const EVIDENCE_DRAFT_V2_PROMPT = 'm4-evidence-first-2';
export const HISTORICAL_EVIDENCE_DRAFT_V1_SCHEMA_HASH = '936c5cbd4b1765e4c10f93a56d90538fe3da32638b387c9a87ecbd4dc32b4033';
export const HISTORICAL_EVIDENCE_DRAFT_V1_ANSWER_SCHEMA_HASH = '658feab21168047d10107520a84ae0998d8eea70b252e7d0512d4f720c6b50e0';
export const MAX_DRAFT_BYTES = 32768;

export const EVIDENCE_DRAFT_SCHEMA = {
  ...ANSWER_SCHEMA,
  properties: { ...ANSWER_SCHEMA.properties, blocks: { ...ANSWER_SCHEMA.properties.blocks,
    items: { type: 'object', additionalProperties: false, required: ['evidence', 'text', 'factual', 'refs'], properties: {
      evidence: { type: 'array', minItems: 1, maxItems: 5, description: 'Select exact excerpts from the supplied source text before writing the claim. This is evidence data, not reasoning.',
        items: { type: 'object', additionalProperties: false, required: ['ref', 'quote'], properties: {
          ref: { type: 'string' }, quote: { type: 'string', minLength: 1, maxLength: 1200, pattern: '\\S',
            description: 'One exact contiguous excerpt, preserving needed conditions, negations, time and modality. Do not normalize or rewrite it.' },
        } } },
      ...ANSWER_SCHEMA.properties.blocks.items.properties,
    } },
  } },
};

export const EVIDENCE_DRAFT_V2_SCHEMA = {
  ...ANSWER_SCHEMA,
  properties: { ...ANSWER_SCHEMA.properties, blocks: { ...ANSWER_SCHEMA.properties.blocks,
    items: { type: 'object', additionalProperties: false, required: ['evidence', 'text', 'factual', 'refs'], properties: {
      evidence: { type: 'array', minItems: 1, maxItems: 5, description: 'Select server-assigned segment IDs before writing the claim. Never copy source text, add offsets or invent IDs.',
        items: { type: 'object', additionalProperties: false, required: ['ref', 'segmentId'], properties: {
          ref: { type: 'string' }, segmentId: { type: 'string', minLength: 1 },
        } } },
      ...ANSWER_SCHEMA.properties.blocks.items.properties,
    } },
  } },
};

export function evidenceDraftContract(config) {
  if (config.evidenceDraftVersion === undefined) return null;
  if (config.evidenceDraftVersion === EVIDENCE_DRAFT_VERSION) return { version: EVIDENCE_DRAFT_VERSION, promptVersion: EVIDENCE_DRAFT_PROMPT, schema: EVIDENCE_DRAFT_SCHEMA };
  if (config.evidenceDraftVersion === EVIDENCE_DRAFT_V2_VERSION) return { version: EVIDENCE_DRAFT_V2_VERSION, promptVersion: EVIDENCE_DRAFT_V2_PROMPT, schema: EVIDENCE_DRAFT_V2_SCHEMA };
  reject('unsupported_evidence_draft', 403);
}

export function evidenceDraftEnabled(config) { return evidenceDraftContract(config) !== null; }

export function evidenceDraftRequest(config, question, context, language) {
  const contract = evidenceDraftContract(config);
  if (!contract || contract.version === EVIDENCE_DRAFT_VERSION) {
    const body = answerRequest(config, question, context, language);
    return { ...body, instructions: body.instructions + ' ' + EVIDENCE_DRAFT_PROMPT
      + '. For each source block, first select a small coherent set of exact source excerpts in evidence, then write the visible claim from those excerpts. '
      + 'Keep necessary conditions, negations, responsible actors and time. Every final ref must have an excerpt in that block, and every excerpt ref must appear in refs. '
      + 'Do not output reasoning or a self-assessed correctness grade. The evidence is private audit data. Limits of your selected evidence stay in limitations; irrelevant side facts need not be added. '
      + 'A quote can be genuine while a paraphrase overstates it; preserve its scope. The existing total output-token limit includes these excerpts.',
      text: { format: { ...body.text.format, name: 'evidence_bound_draft', schema: EVIDENCE_DRAFT_SCHEMA } } };
  }
  const body = answerRequest(config, question, segmentedEvidenceContext(context), language);
  return { ...body, instructions: body.instructions + ' ' + EVIDENCE_DRAFT_V2_PROMPT
    + '. Each source item contains server-assigned segment IDs and their exact text. For every source claim, select a small coherent set of those IDs in evidence, then write the visible claim. '
    + 'The application reconstructs source text and offsets; never copy a quote, create an ID, add offsets or add any evidence fields. Use adjoining segments when a condition, negation, actor, order or time continues across a segment boundary. '
    + 'Every final ref must have a selected segment in that block, and every selected ref must appear in refs. Do not output reasoning or a self-assessed correctness grade. '
    + 'The evidence is private audit data. Limits of the selected segments stay in limitations; do not turn a missing selected segment into a document-wide absence claim. The existing total output-token limit includes segment IDs.',
    text: { format: { ...body.text.format, name: 'evidence_segment_draft', schema: EVIDENCE_DRAFT_V2_SCHEMA } } };
}

function scopeMismatch(packet, config, reference, given, source) {
  return !reference || !given || !source || source.evidence_id !== reference.evidence_id
    || reference.tenant !== packet.tenant || reference.query_id !== packet.query_id || reference.generation_id !== packet.generation_id
    || packet.tenant !== config.tenant || config.documents[reference.document_id] !== reference.document_version_id
    || typeof source.source_text !== 'string' || given.text !== source.source_text || hash(given.text) !== reference.source_text_sha256;
}

function draftFailure(packet, code, path, received = null) {
  throw Object.assign(new Error(code), { code, status: 422,
    validation: { valid: false, code, path, received: boundedDraft(received, 2048), allowedReferences: Object.keys(packet.reference_map || {}) } });
}

async function projectV1(value, packet, config, canonical, answerVersion) {
  const refs = Object.keys(packet.reference_map || {});
  const fail = (code, path, received = null) => draftFailure(packet, code, path, received);
  if (Buffer.byteLength(JSON.stringify(value ?? null), 'utf8') > MAX_DRAFT_BYTES) fail('evidence_draft_too_large', '$');
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !Object.hasOwn(ANSWER_SCHEMA.properties, key))
    || !Array.isArray(value.blocks) || value.blocks.length > 12) fail('invalid_evidence_draft', '$');
  const blocks = [], bindings = [];
  for (const [index, block] of value.blocks.entries()) {
    const path = `$.blocks[${index}]`;
    if (!block || typeof block !== 'object' || Array.isArray(block) || Object.keys(block).some(key => !['evidence', 'text', 'factual', 'refs'].includes(key))
      || !Array.isArray(block.evidence) || !block.evidence.length || block.evidence.length > 5 || !Array.isArray(block.refs)) fail('invalid_evidence_draft', path);
    const quotes = [];
    for (const [quoteIndex, part] of block.evidence.entries()) {
      const quotePath = `${path}.evidence[${quoteIndex}]`;
      if (!part || typeof part !== 'object' || Array.isArray(part) || Object.keys(part).some(key => !['ref', 'quote'].includes(key))
        || typeof part.ref !== 'string' || typeof part.quote !== 'string' || !part.quote.trim() || part.quote.length > 1200) fail('invalid_evidence_excerpt', quotePath);
      const reference = packet.reference_map[part.ref];
      const given = packet.model_context?.evidence?.find(item => item.ref === part.ref);
      const source = packet.evidence?.find(item => item.evidence_id === reference?.evidence_id);
      if (scopeMismatch(packet, config, reference, given, source)) fail('evidence_reference_scope_mismatch', quotePath, part.ref);
      await canonical(config, packet, part.ref);
      const start = given.text.indexOf(part.quote);
      if (start < 0) fail('evidence_excerpt_not_found', `${quotePath}.quote`, part.quote);
      if (given.text.indexOf(part.quote, start + 1) >= 0) fail('evidence_excerpt_ambiguous', `${quotePath}.quote`, part.quote);
      quotes.push({ ref: part.ref, quote: part.quote, start, end: start + part.quote.length,
        offsetBasis: 'source_text_utf16_half_open', reference: { ...reference } });
    }
    const quoteRefs = [...new Set(quotes.map(item => item.ref))].sort();
    if (digest([...new Set(block.refs)].sort()) !== digest(quoteRefs)) fail('evidence_reference_set_mismatch', `${path}.refs`, block.refs);
    blocks.push({ text: block.text, factual: block.factual, refs: block.refs });
    bindings.push({ blockIndex: index, quotes });
  }
  const answer = validateAnswer({ kind: value.kind, blocks, limitations: value.limitations, clarification: value.clarification }, refs, answerVersion);
  return { answer, audit: { version: EVIDENCE_DRAFT_VERSION, promptVersion: EVIDENCE_DRAFT_PROMPT, answerVersion,
    packetHash: digest(packet), draftHash: digest(value), projectionHash: digest(answer), bindings,
    sourceBinding: 'pass', semanticSupport: 'not_evaluated', draftBytes: Buffer.byteLength(JSON.stringify(value), 'utf8') } };
}

async function projectV2(value, packet, config, canonical, answerVersion) {
  const refs = Object.keys(packet.reference_map || {});
  const fail = (code, path, received = null) => draftFailure(packet, code, path, received);
  if (Buffer.byteLength(JSON.stringify(value ?? null), 'utf8') > MAX_DRAFT_BYTES) fail('evidence_draft_too_large', '$');
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !Object.hasOwn(ANSWER_SCHEMA.properties, key))
    || !Array.isArray(value.blocks) || value.blocks.length > 12) fail('invalid_evidence_draft', '$');
  const blocks = [], bindings = [];
  for (const [index, block] of value.blocks.entries()) {
    const path = `$.blocks[${index}]`;
    if (!block || typeof block !== 'object' || Array.isArray(block) || Object.keys(block).some(key => !['evidence', 'text', 'factual', 'refs'].includes(key))
      || !Array.isArray(block.evidence) || !block.evidence.length || block.evidence.length > 5 || !Array.isArray(block.refs)) fail('invalid_evidence_draft', path);
    if (new Set(block.evidence.map(item => item?.segmentId)).size !== block.evidence.length) fail('duplicate_evidence_segment', `${path}.evidence`);
    if (new Set(block.refs).size !== block.refs.length) fail('duplicate_evidence_reference', `${path}.refs`);
    const segments = [];
    for (const [segmentIndex, selection] of block.evidence.entries()) {
      const selectionPath = `${path}.evidence[${segmentIndex}]`;
      if (!selection || typeof selection !== 'object' || Array.isArray(selection) || Object.keys(selection).some(key => !['ref', 'segmentId'].includes(key))
        || typeof selection.ref !== 'string' || typeof selection.segmentId !== 'string' || !selection.segmentId) fail('invalid_evidence_segment', selectionPath);
      const reference = packet.reference_map[selection.ref];
      const given = packet.model_context?.evidence?.find(item => item.ref === selection.ref);
      const source = packet.evidence?.find(item => item.evidence_id === reference?.evidence_id);
      if (scopeMismatch(packet, config, reference, given, source)) fail('evidence_reference_scope_mismatch', selectionPath, selection.ref);
      await canonical(config, packet, selection.ref);
      const segment = evidenceSegments(selection.ref, given.text).find(item => item.segmentId === selection.segmentId);
      if (!segment) fail('evidence_segment_id_mismatch', `${selectionPath}.segmentId`, selection.segmentId);
      segments.push({ ref: selection.ref, segmentId: segment.segmentId, ordinal: segment.ordinal, quote: segment.text,
        start: segment.start, end: segment.end, offsetBasis: 'source_text_utf16_half_open', sourceTextSha256: segment.sourceTextSha256,
        reference: { ...reference } });
    }
    const selectedRefs = [...new Set(segments.map(item => item.ref))].sort();
    if (digest([...new Set(block.refs)].sort()) !== digest(selectedRefs)) fail('evidence_reference_set_mismatch', `${path}.refs`, block.refs);
    blocks.push({ text: block.text, factual: block.factual, refs: block.refs });
    bindings.push({ blockIndex: index, segments });
  }
  const answer = validateAnswer({ kind: value.kind, blocks, limitations: value.limitations, clarification: value.clarification }, refs, answerVersion);
  return { answer, audit: { version: EVIDENCE_DRAFT_V2_VERSION, promptVersion: EVIDENCE_DRAFT_V2_PROMPT, answerVersion,
    packetHash: digest(packet), draftHash: digest(value), projectionHash: digest(answer), bindings,
    sourceBinding: 'pass', semanticSupport: 'not_evaluated', segmentation: 'm4-evidence-segments-1', draftBytes: Buffer.byteLength(JSON.stringify(value), 'utf8') } };
}

export async function projectEvidenceDraft(value, packet, config, canonical, answerVersion = ANSWER_VERSION) {
  // Direct callers of the original helper omitted the opt-in field; retain its
  // v1 behavior while the service only dispatches it for an enabled candidate.
  const contract = evidenceDraftContract(config) || { version: EVIDENCE_DRAFT_VERSION };
  return contract.version === EVIDENCE_DRAFT_VERSION
    ? projectV1(value, packet, config, canonical, answerVersion)
    : projectV2(value, packet, config, canonical, answerVersion);
}
