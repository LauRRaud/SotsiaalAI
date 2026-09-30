import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireChatUser, CHAT_NO_STORE_HEADERS } from './routeServerUtils';
import { readPilotConfig } from '../rag-v2/pilot/config.js';
import { PilotStore } from '../rag-v2/pilot/store.js';
import { PilotService } from '../rag-v2/pilot/service.js';
import { runtimeAdapters } from '../rag-v2/pilot/retrieval.js';
import { municipalDirectoryAdapter } from '../rag-v2/adapters/municipal-directory.js';
import { exact, reject } from '../rag-v2/pilot/contracts.js';
import { livePilotRows, pilotExpiry } from '../rag-v2/pilot/lifetime.js';
import { pilotChatResult, pilotChatMessages } from './m4PilotClientContract';
import { dialogueEnabled } from '../rag-v2/pilot/dialogue.js';
import { detectCrisis } from './safety.js';

export const pilotJson = (value, status = 200) => NextResponse.json(value, { status, headers: CHAT_NO_STORE_HEADERS });
export async function pilotBody(req) {
  if (!req.headers.get('content-type')?.startsWith('application/json')) reject('json_required', 415);
  const expected = new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000').origin;
  if (req.headers.get('origin') !== expected || ['cross-site', 'none'].includes(req.headers.get('sec-fetch-site'))) reject('invalid_request_origin', 403);
  if (Number(req.headers.get('content-length')) > 18000) reject('input_too_large', 413);
  const reader = req.body?.getReader();
  if (!reader) reject('body_required');
  const chunks = []; let length = 0;
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > 18000) reject('input_too_large', 413); chunks.push(value); } }
  finally { await reader.cancel().catch(() => {}); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { reject('invalid_json'); }
}
async function pilotAuth() {
  const auth = await requireChatUser({ includeSession: true });
  if (!auth.ok || auth.session?.authDegraded) reject('unauthorized', 401);
  return auth;
}
export async function pilotSession(authenticated = null) {
  const auth = authenticated || await pilotAuth();
  const readConfig = async (options = { purpose: 'read' }) => {
    const current = await requireChatUser({ includeSession: true });
    if (!current.ok || current.userId !== auth.userId || current.session?.authDegraded) reject('session_revoked', 401);
    return readPilotConfig(auth.userId, options);
  };
  const config = await readConfig();
  const store = new PilotStore(prisma);
  const service = new PilotService({ store, readConfig, adapters: runtimeAdapters(readConfig, auth.userId, municipalDirectoryAdapter(prisma)) });
  return { auth, config, store, service };
}
// The reply to a failed request as { status, body }: a JSON response, or the final event of an answer stream.
export function pilotFailure(error) {
  // No provider body, request, key, database message or source content reaches the browser/log.
  const code = /^[a-z][a-z_]{1,80}$/.test(error.code || '') ? error.code : 'pilot_failed';
  // A full conversation needs a new conversation; a full topic needs a shorter message or a new topic.
  const messageKey = code === 'conversation_context_limit' ? 'm4Pilot.conversationLimit'
    : ['context_window_full', 'context_search_budget_exceeded', 'context_dialogue_budget_exceeded'].includes(code)
      ? 'm4Pilot.contextLimit' : ['context_unavailable', 'context_reference_unavailable', 'context_required'].includes(code) ? 'm4Pilot.contextUnavailable' : null;
  return { status: Number.isInteger(error.status) ? error.status : 500, body: { ok: false, code, ...(messageKey ? { messageKey } : {}) } };
}
export async function pilotHandler(fn) {
  try { return await fn(); }
  catch (error) { const { status, body } = pilotFailure(error); return pilotJson(body, status); }
}
// An answer stream (ADR-040): 'delta' events carry the provisional text, the one 'done' event the reply the JSON
// path would send ({ status, body }). The turn runs to its end even when the reader goes away: a reconnect with the
// same turn key reads the saved result back. A comment line keeps a quiet connection open while the search runs.
// no-transform keeps compression from holding events back (as the research and room streams do).
const STREAM_HEADERS = { ...CHAT_NO_STORE_HEADERS, 'Cache-Control': `${CHAT_NO_STORE_HEADERS['Cache-Control']}, no-transform`,
  'Content-Type': 'text/event-stream; charset=utf-8', 'X-Accel-Buffering': 'no' };
export function pilotStream(produce, { keepAliveMs = 15000 } = {}) {
  const encoder = new TextEncoder();
  let open = true, timer = null;
  const stream = new ReadableStream({
    start(controller) {
      const write = text => { if (!open) return; try { controller.enqueue(encoder.encode(text)); } catch { open = false; } };
      const send = (event, data) => write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      timer = setInterval(() => write(': keep-alive\n\n'), keepAliveMs);
      timer.unref?.();
      Promise.resolve().then(() => produce(send)).catch(error => send('done', pilotFailure(error))).finally(() => {
        clearInterval(timer);
        if (open) { open = false; try { controller.close(); } catch { /* already closed */ } }
      });
    },
    cancel() { open = false; clearInterval(timer); },
  });
  return new Response(stream, { status: 200, headers: STREAM_HEADERS });
}
// A turn another request is still working on (a reconnect after a lost stream): its saved state is read again until
// it is no longer 'claimed', at most `limitMs`; never a second search or model call.
async function settledTurn(turn, { service, store, userId, input, intervalMs, limitMs }) {
  const until = Date.now() + limitMs;
  while (turn?.state === 'claimed' && Date.now() < until) {
    await new Promise(resolve => setTimeout(resolve, intervalMs));
    const row = await store.existing(await service.access(), userId, input);
    if (!row) break;
    turn = await service.restore(row);
  }
  return turn;
}
// Tests replace only the authentication and RAG session boundaries (and the reconnect wait).
export async function pilotPost(req, { authenticate = pilotAuth, session = pilotSession, settle = { intervalMs: 1000, limitMs: 120000 } } = {}) {
  return pilotHandler(async () => {
    // Authentication and request validation stay first. After them, the crisis contacts do not
    // depend on the RAG configuration, search, answer or restore: every later failure of a
    // crisis sentence returns the crisis notice instead of an error (fail-closed).
    const auth = await authenticate();
    const input = await pilotBody(req);
    const chat = req.headers.get('x-rag-pilot-format') === 'chat';
    // A chat client that accepts an event stream sees the answer while it is written (ADR-040).
    const streaming = chat && (req.headers.get('accept') || '').includes('text/event-stream');
    const crisis = chat && typeof input?.question === 'string' && detectCrisis(input.question);
    const crisisNotice = result => ({ status: 200, body: { ...result, ok: true, isCrisis: true, messageKey: 'chat.crisis.notice', sources: result.sources || [] } });
    const failed = error => { if (crisis) return crisisNotice({ completionStatus: 'FAILED', pilotState: 'stopped' }); throw error; };
    let prepared;
    try {
      prepared = await session(auth);
      if (chat && prepared.config.questionPolicy?.mode === 'locked') {
        const locked = prepared.config.questionPolicy.inputs.find(item => item.question === input.question && item.contextMode === input.contextMode);
        if (locked) input.language = locked.language;
      }
    } catch (error) { const { status, body } = failed(error); return pilotJson(body, status); }
    const { store, service } = prepared;
    // The reply of this request as { status, body }, whether it goes out as JSON or as a stream's last event.
    const reply = async onAnswerText => {
      try {
        let turn;
        try { turn = await service.run(auth.userId, input, ...(onAnswerText ? [{ onAnswerText }] : [])); }
        catch (error) {
          // Read back this exact key only; a failed request never causes a replacement search/call.
          if (!chat || !error.pilotTurnId) throw error;
          const row = await store.existing(await service.access(), auth.userId, input);
          if (!row || !['answer_rejected', 'stopped'].includes(row.state)) throw error;
          turn = await service.restore(row);
        }
        if (onAnswerText) turn = await settledTurn(turn, { service, store, userId: auth.userId, input, ...settle });
        if (chat) {
          const result = pilotChatResult(turn, input.convId);
          if (result.isCrisis && !result.ok) return crisisNotice(result);
          return { status: result.ok ? 200 : 409, body: result };
        }
        return { status: 200, body: turn };
      } catch (error) { return failed(error); }
    };
    if (!streaming) { const { status, body } = await reply(null); return pilotJson(body, status); }
    return pilotStream(async send => send('done', await reply(text => send('delta', { t: text }))));
  });
}
export async function pilotGet(req) {
  return pilotHandler(async () => {
    const { auth, config, store, service } = await pilotSession();
    await store.purge();
    const url = new URL(req.url), convId = url.searchParams.get('convId'), turnId = url.searchParams.get('turnId'), ref = url.searchParams.get('ref');
    if (!convId) return pilotJson({ mode: config.mode, dialogueEnabled: dialogueEnabled(config), generationAvailable: config.mode === 'real', testAvailable: config.mode === 'test', profile: config.profile.id,
      conversations: await prisma.conversation.findMany({ where: { userId: auth.userId, archivedAt: null, ...livePilotRows(), metadata: { path: ['m4'], equals: true } }, select: { id: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 30 }) });
    if (url.searchParams.get('context') === '1') {
      if (!dialogueEnabled(config)) reject('dialogue_not_enabled', 404);
      if (!/^[\w-]{8,100}$/.test(convId)) reject('invalid_conversation_id');
      return pilotJson(await store.contextSummary(config, auth.userId, convId));
    }
    await store.locked(config, tx => store.conversation(tx, auth.userId, convId));
    const rows = await prisma.m4PilotTurn.findMany({ where: { configHash: config.configHash, chatTurn: { userId: auth.userId, conversationId: convId }, ...(turnId ? { id: turnId } : {}) }, orderBy: { createdAt: 'asc' }, take: 100 });
    if (ref) {
      const row = rows.find(r => r.id === turnId);
      if (!row || row.state !== 'completed') reject('source_unavailable', 404);
      await service.restore(row);
      const canonical = await service.adapters.canonical(config, row.payload.packet, ref);
      const evidence = row.payload.packet.evidence.find(e => e.evidence_id === canonical.evidence_id);
      const links = await service.adapters.sourceLinks?.(config, canonical).catch(() => []) ?? [];
      await service.access(row);
      return pilotJson({ title: evidence.bibliography.title, version: canonical.document_version_id, pages: canonical.pdf_pages,
        ...(canonical.source_locations === undefined ? {} : { source_locations: canonical.source_locations }), text: evidence.source_text, ref, links });
    }
    const turns = []; for (const row of rows) turns.push({ ...await service.restore(row), createdAt: row.createdAt });
    if (url.searchParams.get('format') === 'chat') {
      const messages = pilotChatMessages(turns, convId);
      return pilotJson({ ok: true, convId, messages, text: messages.at(-1)?.text || '', sources: messages.at(-1)?.sources || [],
        attachments: messages.at(-1)?.attachments || [], isCrisis: !!messages.at(-1)?.isCrisis });
    }
    return pilotJson({ convId, mode: config.mode, turns });
  });
}
export async function pilotManage(req) {
  return pilotHandler(async () => {
    const { auth, config, store, service } = await pilotSession();
    const body = await pilotBody(req);
    exact(body, ['action', 'convId', 'turnId']);
    if (body.action === 'ensure') {
      if (typeof body.convId !== 'string' || !/^[\w-]{8,100}$/.test(body.convId)) reject('invalid_conversation_id');
      await store.locked(config, async tx => {
        const exists = await tx.conversation.findUnique({ where: { id: body.convId }, select: { id: true } });
        if (exists) { await store.conversation(tx, auth.userId, body.convId); return; }
        await tx.conversation.create({ data: { id: body.convId, userId: auth.userId, role: auth.session.user.role || 'CLIENT', title: 'M4 sisepiloot', metadata: { m4: true },
          expiresAt: pilotExpiry(config) } });
      });
      return pilotJson({ ok: true, convId: body.convId });
    }
    if (body.action === 'create') {
      const conv = await prisma.conversation.create({ data: { userId: auth.userId, role: 'CLIENT', title: 'M4 sisepiloot', metadata: { m4: true },
        expiresAt: pilotExpiry(config) } });
      return pilotJson({ convId: conv.id });
    }
    if (body.action === 'delete') {
      await store.locked(config, async tx => { await store.conversation(tx, auth.userId, body.convId); await tx.conversation.delete({ where: { id: body.convId } }); });
      return pilotJson({ deleted: true });
    }
    if (body.action === 'recover') {
      const row = await prisma.m4PilotTurn.findFirst({ where: { id: body.turnId, chatTurn: { userId: auth.userId, conversationId: body.convId } } });
      if (!row) reject('turn_unavailable', 404);
      return pilotJson(await service.recover(row));
    }
    reject('invalid_action');
  });
}
