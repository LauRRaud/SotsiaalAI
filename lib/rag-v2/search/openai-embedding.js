import { performance } from 'node:perf_hooks';
import { fail } from '../contracts.js';
import { OPENAI_EMBEDDING_ENDPOINT, validateVector } from './embedding.js';

// Only the approved pilot runner calls this transport. It is not a retrieval adapter.
export function openAITransport(apiKey) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) fail('openai_key_missing');
  return async ({ text, config }) => {
    if (config.endpoint !== OPENAI_EMBEDDING_ENDPOINT || config.provider !== 'openai' || config.model !== 'text-embedding-3-large' || config.dimensions !== 3072) fail('embedding_endpoint_mismatch');
    const start = performance.now();
    const response = await fetch(OPENAI_EMBEDDING_ENDPOINT, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: text, model: config.model, dimensions: config.dimensions, encoding_format: 'float' }) });
    const requestId = response.headers.get('x-request-id');
    if (!response.ok) throw Object.assign(new Error('embedding_http_error'), { code: 'embedding_http_error', status: response.status, requestId });
    return { body: await response.json(), request_id: requestId, duration_ms: performance.now() - start };
  };
}
export function validateEmbeddingResponse(response, config, expectedTokens) {
  const body = response?.body;
  if (!body || body.model !== config.model || !Array.isArray(body.data) || body.data.length !== 1 || body.data[0].index !== 0 || body.data[0].object !== 'embedding') fail('embedding_response_mismatch');
  validateVector(body.data[0].embedding, config);
  if (!Number.isSafeInteger(body.usage?.prompt_tokens) || body.usage.prompt_tokens !== expectedTokens || body.usage.total_tokens !== expectedTokens) fail('embedding_usage_mismatch');
  return body.data[0].embedding;
}
