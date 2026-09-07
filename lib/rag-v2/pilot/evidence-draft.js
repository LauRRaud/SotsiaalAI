import { ANSWER_SCHEMA, ANSWER_VERSION, answerRequest, validateAnswer, boundedDraft, digest, reject } from './contracts.js';
import { hash } from '../contracts.js';

export const EVIDENCE_DRAFT_VERSION = 'm4-evidence-draft-1';
export const EVIDENCE_DRAFT_PROMPT = 'm4-evidence-first-1';
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

export function evidenceDraftEnabled(config) {
  if (config.evidenceDraftVersion === undefined) return false;
  if (config.evidenceDraftVersion !== EVIDENCE_DRAFT_VERSION) reject('unsupported_evidence_draft', 403);
  return true;
}

export function evidenceDraftRequest(config, question, context, language) {
  const body = answerRequest(config, question, context, language);
  return { ...body, instructions: body.instructions + ' ' + EVIDENCE_DRAFT_PROMPT
    + '. For each source block, first select a small coherent set of exact source excerpts in evidence, then write the visible claim from those excerpts. '
    + 'Keep necessary conditions, negations, responsible actors and time. Every final ref must have an excerpt in that block, and every excerpt ref must appear in refs. '
    + 'Do not output reasoning or a self-assessed correctness grade. The evidence is private audit data. Limits of your selected evidence stay in limitations; irrelevant side facts need not be added. '
    + 'A quote can be genuine while a paraphrase overstates it; preserve its scope. The existing total output-token limit includes these excerpts.',
    text: { format: { ...body.text.format, name: 'evidence_bound_draft', schema: EVIDENCE_DRAFT_SCHEMA } } };
}

export async function projectEvidenceDraft(value, packet, config, canonical) {
  const refs = Object.keys(packet.reference_map || {});
  const fail = (code, path, received = null) => { throw Object.assign(new Error(code), { code, status: 422,
    validation: { valid: false, code, path, received: boundedDraft(received, 2048), allowedReferences: refs } }); };
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
      if (!reference || !given || !source || reference.tenant !== packet.tenant || reference.query_id !== packet.query_id
        || reference.generation_id !== packet.generation_id || packet.tenant !== config.tenant
        || config.documents[reference.document_id] !== reference.document_version_id
        || typeof source.source_text !== 'string' || given.text !== source.source_text || hash(given.text) !== reference.source_text_sha256) fail('evidence_reference_scope_mismatch', quotePath, part.ref);
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
  const answer = validateAnswer({ kind: value.kind, blocks, limitations: value.limitations, clarification: value.clarification }, refs, ANSWER_VERSION);
  return { answer, audit: { version: EVIDENCE_DRAFT_VERSION, promptVersion: EVIDENCE_DRAFT_PROMPT, answerVersion: ANSWER_VERSION,
    packetHash: digest(packet), draftHash: digest(value), projectionHash: digest(answer), bindings,
    sourceBinding: 'pass', semanticSupport: 'not_evaluated', draftBytes: Buffer.byteLength(JSON.stringify(value), 'utf8') } };
}
