import { fail } from '../contracts.js';

export async function readBoundedBody(request, maxBytes) {
  if (!request?.body || !Number.isSafeInteger(maxBytes) || maxBytes < 1) fail('request_body_invalid');
  if (Number(request.headers.get('content-length')) > maxBytes) fail('request_body_too_large');
  const reader = request.body.getReader(), chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) fail('request_body_too_large');
      chunks.push(Buffer.from(value));
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  return Buffer.concat(chunks, total);
}

export function sameOrigin(request, originUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000') {
  const origin = request.headers.get('origin'), site = request.headers.get('sec-fetch-site');
  let expected;
  try { expected = new URL(originUrl).origin; } catch { fail('same_origin_required'); }
  if (!origin || origin !== expected || site && site !== 'same-origin') fail('same_origin_required');
}

export async function boundedFormData(request, maxBytes) {
  const body = await readBoundedBody(request, maxBytes);
  const replay = new Request(request.url, { method: request.method, headers: { 'Content-Type': request.headers.get('content-type') }, body });
  try { return await replay.formData(); } catch { fail('invalid_multipart'); }
}
