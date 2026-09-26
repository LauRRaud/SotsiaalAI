import { reject } from './contracts.js';
import { validateVector } from '../search/embedding.js';

export const ANSWER_ENDPOINT = 'https://api.openai.com/v1/responses';
export const EMBEDDING_ENDPOINT = 'https://api.openai.com/v1/embeddings';
// Raw fetch has no SDK/application retry. A thrown/unknown response stays reserved.
export async function providerCall({ stage, body, config, apiKey, transport = fetch }) {
  if (!apiKey || config.mode !== 'real') reject('not_configured', 503);
  const endpoint = stage === 'embedding' ? EMBEDDING_ENDPOINT : ANSWER_ENDPOINT;
  const started = performance.now();
  const response = await transport(endpoint, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(config.timeoutMs),
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'OpenAI-Project': config.accountProject }, body: JSON.stringify(body) });
  if (!response.ok) reject('provider_http_error', 502);
  const reader = response.body?.getReader();
  if (!reader) reject('provider_empty_body', 502);
  const chunks = []; let length = 0, firstDataMs = null;
  try { for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    if (firstDataMs === null) firstDataMs = performance.now() - started;
    length += value.length; if (length > 2_000_000) reject('provider_body_too_large', 502);
    chunks.push(value);
  } } finally { await reader.cancel().catch(() => {}); }
  let data; try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { reject('provider_invalid_json', 502); }
  const timings = { firstDataMs, completeResponseMs: performance.now() - started, streaming: false };
  const usage = stage === 'embedding' ? { input: data.usage?.prompt_tokens, output: 0 } : { input: data.usage?.input_tokens, output: data.usage?.output_tokens };
  if (stage === 'answer') {
    usage.cachedInput = Number.isSafeInteger(data.usage?.input_tokens_details?.cached_tokens) ? data.usage.input_tokens_details.cached_tokens : null;
    usage.cacheWriteInput = Number.isSafeInteger(data.usage?.input_tokens_details?.cache_write_tokens) ? data.usage.input_tokens_details.cache_write_tokens : null;
  }
  if (Number.isSafeInteger(data.usage?.output_tokens_details?.reasoning_tokens)) usage.reasoning = data.usage.output_tokens_details.reasoning_tokens;
  const requestId = response.headers.get('x-request-id');
  const finalParts = stage === 'answer' ? (Array.isArray(data.output) ? data.output : []).filter(x => x.type === 'message').flatMap(x => x.content || [])
    .filter(x => x.type === 'output_text' || x.type === 'refusal').map(x => x.text || x.refusal || '') : [];
  const draftText = finalParts.join('\n');
  if (![usage.input, usage.output].every(x => Number.isSafeInteger(x) && x >= 0)) {
    throw Object.assign(new Error('provider_usage_unknown'), { code: 'provider_usage_unknown', status: 502, requestId, timings, draftText });
  }
  try {
  if (stage === 'embedding') {
    // One input, or the question and its search variants in one request (search assist).
    const inputs = Array.isArray(body.input) ? body.input.length : 1;
    if (data.model !== config.embedding.model || data.data?.length !== inputs || data.data.some((row, i) => row.index !== i)) reject('embedding_response_mismatch', 502);
    const vectors = data.data.map(row => validateVector(row.embedding, config.embedding));
    return { value: Array.isArray(body.input) ? vectors : vectors[0], usage, requestId, timings };
  }
  if (data.model !== config.model) reject('answer_model_mismatch', 502);
  if (data.status !== 'completed' || data.incomplete_details || data.output?.some(x => !['message', 'reasoning'].includes(x.type))) reject('provider_incomplete', 502);
  const messages = data.output?.filter(x => x.type === 'message') || [];
  if (messages.length !== 1 || messages[0].content?.length !== 1 || messages[0].content[0].type !== 'output_text') reject('provider_refusal_or_invalid_output', 502);
  let value; try { value = JSON.parse(messages[0].content[0].text); } catch { reject('provider_invalid_json', 502); }
  return { value, usage, requestId, timings, draftText };
  } catch (error) { throw Object.assign(error, { usage, requestId, timings, draftText }); }
}
