import { NextResponse } from 'next/server';
import { intakeSession } from '@/lib/admin/rag/v2Server';
import { intakeError } from '@/lib/rag-v2/admin/intake.js';
import { boundedFormData, readBoundedBody, sameOrigin } from '@/lib/rag-v2/admin/http-body.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const headers = { 'Cache-Control': 'no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' };
const json = (value, status = 200) => NextResponse.json(value, { status, headers });
function failure(error) {
  const code = /^[a-z][a-z0-9_]{1,80}$/.test(error?.code || '') ? error.code : 'rag_v2_intake_failed';
  const status = error?.status >= 400 && error.status <= 599 ? error.status
    : code === 'request_body_too_large' ? 413 : code === 'same_origin_required' ? 403
      : code === 'rag_v2_admin_disabled' ? 404 : code.startsWith('rag_v2_admin_') ? 503 : 400;
  return json({ ok: false, code }, status);
}

export async function POST(request) {
  try {
    sameOrigin(request);
    const { config, service } = await intakeSession();
    const type = request.headers.get('content-type') || '';
    if (type.startsWith('multipart/form-data;')) {
      const form = await boundedFormData(request, config.maxFileBytes + config.maxMetadataBytes + 65536);
      const keys = [...form.keys()];
      if (keys.length !== 3 || new Set(keys).size !== 3 || keys.some(key => !['pdf', 'metadata', 'sourceUse'].includes(key))) throw intakeError('invalid_intake_fields');
      const pdf = form.get('pdf'), metadata = form.get('metadata');
      if (!pdf || typeof pdf.arrayBuffer !== 'function' || pdf.size > config.maxFileBytes) throw intakeError('invalid_pdf', 413);
      if (!metadata || typeof metadata.arrayBuffer !== 'function' || metadata.size > config.maxMetadataBytes) throw intakeError('invalid_metadata', 413);
      const receipt = await service.prepare({ pdfBytes: Buffer.from(await pdf.arrayBuffer()), metadataBytes: Buffer.from(await metadata.arrayBuffer()),
        sourceUse: form.get('sourceUse') === 'confirmed' });
      return json({ ok: true, receipt });
    }
    if (!type.startsWith('application/json')) throw intakeError('json_required', 415);
    let payload;
    try { payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await readBoundedBody(request, 4096))); }
    catch (error) { if (error.code) throw error; throw intakeError('invalid_json'); }
    if (!payload || Object.keys(payload).sort().join(',') !== 'action,jobId,planHash' || payload.action !== 'publish'
      || typeof payload.jobId !== 'string' || !/^[a-f0-9]{64}$/.test(payload.planHash || '')) throw intakeError('publish_action_invalid');
    return json({ ok: true, receipt: await service.publish(payload.jobId, payload.planHash) });
  } catch (error) { return failure(error); }
}

export async function GET(request) {
  try {
    const { service } = await intakeSession(), url = new URL(request.url);
    const job = url.searchParams.get('job'), asset = url.searchParams.get('asset');
    if (!job) return json({ ok: true, status: await service.status() });
    const result = await service.get(job, asset);
    if (!asset) return json({ ok: true, receipt: result });
    return new NextResponse(result.bytes, { headers: { ...headers, 'Content-Type': result.type,
      'Content-Security-Policy': "sandbox; default-src 'none'",
      'Content-Disposition': 'attachment; filename="' + (asset === 'pdf' ? 'source.pdf' : 'metadata.json') + '"' } });
  } catch (error) { return failure(error); }
}
