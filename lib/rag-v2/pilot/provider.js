import { reject } from './contracts.js';
import { validateVector } from '../search/embedding.js';

export const ANSWER_ENDPOINT = 'https://api.openai.com/v1/responses';
export const EMBEDDING_ENDPOINT = 'https://api.openai.com/v1/embeddings';
// A streamed answer carries every text piece as its own event before the complete response (ADR-040).
const BODY_LIMIT = 2_000_000, STREAM_LIMIT = 8_000_000;
const TERMINAL_EVENTS = new Set(['response.completed', 'response.incomplete', 'response.failed']);

/** The server-sent events of a streamed Responses call: text pieces go to onText as they arrive; the result is the
 *  complete response of the terminal event, or null when the stream ended without one (usage then stays unknown). */
async function readAnswerStream(reader, started, onText) {
  const decoder = new TextDecoder();
  let buffer = '', length = 0, firstDataMs = null, firstTextMs = null, final = null, text = '';
  const event = block => {
    const data = block.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    if (!data) return;
    let parsed; try { parsed = JSON.parse(data); } catch { return; }
    if (parsed?.type === 'response.output_text.delta' && typeof parsed.delta === 'string') {
      if (firstTextMs === null) firstTextMs = performance.now() - started;
      text += parsed.delta;
      if (onText) { try { onText(parsed.delta); } catch { /* the reader's failure never changes the answer or its accounting */ } }
    } else if (TERMINAL_EVENTS.has(parsed?.type) && parsed.response && typeof parsed.response === 'object') final = parsed.response;
  };
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    if (firstDataMs === null) firstDataMs = performance.now() - started;
    length += value.length; if (length > STREAM_LIMIT) reject('provider_body_too_large', 502);
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n?/g, '\n');
    for (let end = buffer.indexOf('\n\n'); end !== -1; end = buffer.indexOf('\n\n')) { event(buffer.slice(0, end)); buffer = buffer.slice(end + 2); }
  }
  if (buffer.trim()) event(buffer);
  return { final, text, firstDataMs, firstTextMs };
}

// Raw fetch has no SDK/application retry. A thrown/unknown response stays reserved. An answer body with stream: true
// is read as events (onText receives the text pieces); its complete response passes the same checks and accounting.
export async function providerCall({ stage, body, config, apiKey, transport = fetch, onText = null }) {
  if (!apiKey || config.mode !== 'real') reject('not_configured', 503);
  const endpoint = stage === 'embedding' ? EMBEDDING_ENDPOINT : ANSWER_ENDPOINT;
  const streaming = stage !== 'embedding' && body.stream === true;
  const started = performance.now();
  const response = await transport(endpoint, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(config.timeoutMs),
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'OpenAI-Project': config.accountProject }, body: JSON.stringify(body) });
  if (!response.ok) reject('provider_http_error', 502);
  const reader = response.body?.getReader();
  if (!reader) reject('provider_empty_body', 502);
  let data, firstDataMs = null, firstTextMs = null, streamedText = '';
  try {
    if (streaming) {
      const read = await readAnswerStream(reader, started, onText);
      ({ firstDataMs, firstTextMs } = read);
      data = read.final || {}; streamedText = read.text;
    } else {
      const chunks = []; let length = 0;
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        if (firstDataMs === null) firstDataMs = performance.now() - started;
        length += value.length; if (length > BODY_LIMIT) reject('provider_body_too_large', 502);
        chunks.push(value);
      }
      try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { reject('provider_invalid_json', 502); }
    }
  } finally { await reader.cancel().catch(() => {}); }
  const timings = { firstDataMs, ...(streaming ? { firstTextMs } : {}), completeResponseMs: performance.now() - started, streaming };
  const usage = stage === 'embedding' ? { input: data.usage?.prompt_tokens, output: 0 } : { input: data.usage?.input_tokens, output: data.usage?.output_tokens };
  if (stage === 'answer') {
    usage.cachedInput = Number.isSafeInteger(data.usage?.input_tokens_details?.cached_tokens) ? data.usage.input_tokens_details.cached_tokens : null;
    usage.cacheWriteInput = Number.isSafeInteger(data.usage?.input_tokens_details?.cache_write_tokens) ? data.usage.input_tokens_details.cache_write_tokens : null;
  }
  if (Number.isSafeInteger(data.usage?.output_tokens_details?.reasoning_tokens)) usage.reasoning = data.usage.output_tokens_details.reasoning_tokens;
  const requestId = response.headers.get('x-request-id');
  const finalParts = stage === 'answer' ? (Array.isArray(data.output) ? data.output : []).filter(x => x.type === 'message').flatMap(x => x.content || [])
    .filter(x => x.type === 'output_text' || x.type === 'refusal').map(x => x.text || x.refusal || '') : [];
  // A stream that ended without its complete response keeps the text it did send as the bounded draft.
  const draftText = streaming && !data.output ? streamedText : finalParts.join('\n');
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
