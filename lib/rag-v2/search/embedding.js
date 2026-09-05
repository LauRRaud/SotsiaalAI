import { Tiktoken } from 'js-tiktoken/lite';
import cl100k from 'js-tiktoken/ranks/cl100k_base';
import { fail, hash, id, stable } from '../contracts.js';

const tokenizer = new Tiktoken(cl100k);
export const TOKENIZER = 'js-tiktoken@1.0.21/cl100k_base';
export const encode = text => tokenizer.encode(text, [], []);
export const decode = tokens => tokenizer.decode(tokens);
export const tokenCount = text => encode(text).length;
export function embeddingConfig(overrides = {}) {
  const base = { embedding_mode: 'mock', provider: 'local-mock', model: 'mock-sha256-v1', dimensions: 32,
    distance: 'Cosine', tokenizer: TOKENIZER, input_version: 'title-section-text-v1', max_input_tokens: 8191 };
  if (Object.keys(overrides).some(k => !(k in base))) fail('unknown_embedding_config');
  const config = { ...base, ...overrides };
  if (config.embedding_mode !== 'mock' || config.provider !== 'local-mock' || !/^mock-[a-z0-9-]+$/.test(config.model)
    || config.tokenizer !== TOKENIZER || config.distance !== 'Cosine' || !['title-section-text-v1', 'title-section-text-v2'].includes(config.input_version)
    || !Number.isInteger(config.dimensions) || config.dimensions < 2 || config.dimensions > 3072
    || !Number.isInteger(config.max_input_tokens) || config.max_input_tokens < 1 || config.max_input_tokens > 8191) fail('invalid_embedding_config');
  return Object.freeze(config);
}
export function validateVector(vector, config) {
  if (!Array.isArray(vector) || vector.length !== config.dimensions || vector.some(v => typeof v !== 'number' || !Number.isFinite(v))
    || !Number.isFinite(Math.hypot(...vector)) || Math.hypot(...vector) === 0) fail('invalid_embedding_vector');
  return vector;
}
export function checkedTokens(text, config) {
  if (typeof text !== 'string' || !text.trim() || !text.isWellFormed()) fail('invalid_embedding_input');
  const tokens = tokenCount(text);
  if (tokens > config.max_input_tokens) fail('embedding_input_too_long');
  return tokens;
}
export class MockEmbedding {
  constructor(config = {}) { this.config = embeddingConfig(config); this.calls = 0; }
  async embed(text) {
    checkedTokens(text, this.config); this.calls++;
    // Hash-derived pseudorandom vectors test transport and ranking, never semantic quality.
    const values = Array.from({ length: this.config.dimensions }, (_, i) => parseInt(hash(stable([this.config, text, i])).slice(0, 8), 16) / 0xffffffff * 2 - 1);
    const norm = Math.hypot(...values);
    return validateVector(values.map(v => v / norm), this.config);
  }
}
export function cacheKey(tenant, rights, config, text) { return id('embedding_cache', tenant, rights, config, hash(text)); }
export function indexUnit(chunk, bundle, config) {
  const text = config.input_version === 'title-section-text-v1' ? chunk.retrieval_text : `${bundle.document.fields.title.value}\n${chunk.retrieval_text}`;
  const tokens = checkedTokens(text, config);
  return { id: id('unit', bundle.version.id, chunk.id, config.input_version), chunk_id: chunk.id,
    document_id: bundle.document.id, version_id: bundle.version.id, ordinal: chunk.ordinal,
    input_hash: hash(text), input_text: text, input_tokens: tokens,
    title: bundle.document.fields.title.value, authors: (bundle.document.fields.authors.value || []).join(' '),
    body: chunk.source_text, search_aids: [bundle.document.search_aids.description?.value || '', ...(bundle.document.search_aids.tags?.value || [])].join(' '),
  };
}
