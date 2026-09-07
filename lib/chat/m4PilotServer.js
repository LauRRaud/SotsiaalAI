import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireChatUser, CHAT_NO_STORE_HEADERS } from './routeServerUtils';
import { readPilotConfig } from '../rag-v2/pilot/config.js';
import { PilotStore } from '../rag-v2/pilot/store.js';
import { PilotService } from '../rag-v2/pilot/service.js';
import { runtimeAdapters } from '../rag-v2/pilot/retrieval.js';
import { exact, reject } from '../rag-v2/pilot/contracts.js';
import { livePilotRows, pilotExpiry } from '../rag-v2/pilot/lifetime.js';
import { pilotChatResult, pilotChatMessages } from './m4PilotClientContract';

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
export async function pilotSession() {
  const auth = await requireChatUser({ includeSession: true });
  if (!auth.ok || auth.session?.authDegraded) reject('unauthorized', 401);
  const readConfig = async (options = { purpose: 'read' }) => {
    const current = await requireChatUser({ includeSession: true });
    if (!current.ok || current.userId !== auth.userId || current.session?.authDegraded) reject('session_revoked', 401);
    return readPilotConfig(auth.userId, options);
  };
  const config = await readConfig();
  const store = new PilotStore(prisma);
  const service = new PilotService({ store, readConfig, adapters: runtimeAdapters(readConfig, auth.userId) });
  return { auth, config, store, service };
}
export async function pilotHandler(fn) {
  try { return await fn(); }
  catch (error) {
    // No provider body, request, key, database message or source content reaches the browser/log.
    const code = /^[a-z][a-z_]{1,80}$/.test(error.code || '') ? error.code : 'pilot_failed';
    return pilotJson({ ok: false, code }, Number.isInteger(error.status) ? error.status : 500);
  }
}
export async function pilotPost(req) {
  return pilotHandler(async () => {
    const { auth, config, store, service } = await pilotSession();
    const input = await pilotBody(req);
    if (req.headers.get('x-rag-pilot-format') === 'chat' && config.questionPolicy?.mode === 'locked') {
      const locked = config.questionPolicy.inputs.find(item => item.question === input.question && item.contextMode === input.contextMode);
      if (locked) input.language = locked.language;
    }
    let turn;
    try { turn = await service.run(auth.userId, input); }
    catch (error) {
      // Read back this exact key only; a failed request never causes a replacement search/call.
      if (req.headers.get('x-rag-pilot-format') !== 'chat' || !error.pilotTurnId) throw error;
      const row = await store.existing(await service.access(), auth.userId, input);
      if (!row || !['answer_rejected', 'stopped'].includes(row.state)) throw error;
      turn = await service.restore(row);
    }
    if (req.headers.get('x-rag-pilot-format') === 'chat') {
      const result = pilotChatResult(turn, input.convId);
      return pilotJson(result, result.ok ? 200 : 409);
    }
    return pilotJson(turn);
  });
}
export async function pilotGet(req) {
  return pilotHandler(async () => {
    const { auth, config, store, service } = await pilotSession();
    await store.purge();
    const url = new URL(req.url), convId = url.searchParams.get('convId'), turnId = url.searchParams.get('turnId'), ref = url.searchParams.get('ref');
    if (!convId) return pilotJson({ mode: config.mode, generationAvailable: config.mode === 'real', testAvailable: config.mode === 'test', profile: config.profile.id,
      conversations: await prisma.conversation.findMany({ where: { userId: auth.userId, archivedAt: null, ...livePilotRows(), metadata: { path: ['m4'], equals: true } }, select: { id: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 30 }) });
    await store.locked(config, tx => store.conversation(tx, auth.userId, convId));
    const rows = await prisma.m4PilotTurn.findMany({ where: { configHash: config.configHash, chatTurn: { userId: auth.userId, conversationId: convId }, ...(turnId ? { id: turnId } : {}) }, orderBy: { createdAt: 'asc' }, take: 100 });
    if (ref) {
      const row = rows.find(r => r.id === turnId);
      if (!row || row.state !== 'completed') reject('source_unavailable', 404);
      await service.restore(row);
      const canonical = await service.adapters.canonical(config, row.payload.packet, ref);
      const evidence = row.payload.packet.evidence.find(e => e.evidence_id === canonical.evidence_id);
      await service.access(row);
      return pilotJson({ title: evidence.bibliography.title, version: canonical.document_version_id, pages: canonical.pdf_pages, text: evidence.source_text, ref });
    }
    const turns = []; for (const row of rows) turns.push({ ...await service.restore(row), createdAt: row.createdAt });
    if (url.searchParams.get('format') === 'chat') {
      const messages = pilotChatMessages(turns, convId);
      return pilotJson({ ok: true, convId, messages, text: messages.at(-1)?.text || '', sources: messages.at(-1)?.sources || [] });
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
