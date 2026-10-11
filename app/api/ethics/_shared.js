import { getServerSession } from 'next-auth';
import { authConfig } from '@/auth';
import { requireSubscription, resolveSessionRoleState } from '@/lib/authz';
import { canUseEthics, EthicsError } from '@/lib/ethics/shared';
import { validateJsonMutationRequest } from '@/lib/security/jsonMutationRequest';
import { enforceChatRateLimit } from '@/lib/chat-api-rate-limit';
import { NextResponse } from 'next/server';

export const ethicsJson = (body, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
export async function ethicsApi(request, action, {
  getSession = () => getServerSession(authConfig),
  subscription = requireSubscription,
  rateLimit = enforceChatRateLimit
} = {}) {
  try {
    const session = await getSession().catch(() => null);
    if (!session?.user?.id || session.authDegraded) throw new EthicsError('unauthorized', 401);
    const userId = String(session.user.id), role = resolveSessionRoleState(session, request.cookies);
    const reading = ['GET', 'DELETE'].includes(request.method);
    // Ownership still grants read/delete after a role or subscription ends.
    if (!reading && !canUseEthics(role.effectiveRole, role.isAdmin)) throw new EthicsError('forbidden', 403);
    if (!reading) {
      const gate = await subscription(session, role.effectiveRole);
      if (!gate.ok) return ethicsJson({ ok: false, message: 'api.common.subscription_required', requireSubscription: true, redirect: gate.redirect }, 402);
    }
    let input = {};
    if (request.method !== 'GET') {
      if (!validateJsonMutationRequest(request)) throw new EthicsError('invalid', 403);
      const reader = request.body?.getReader();
      if (!reader) throw new EthicsError('invalid');
      const chunks = []; let size = 0;
      try {
        for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 96000) throw new EthicsError('invalid', 413); chunks.push(value); }
      } finally { await reader.cancel().catch(() => {}); }
      try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new EthicsError('invalid'); }
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new EthicsError('invalid');
      const limited = rateLimit(request, { scope: 'ethics', userId, limit: 30 });
      if (limited) return limited;
    }
    return ethicsJson({ ok: true, ...await action(userId, input) });
  } catch (error) {
    return ethicsJson({ ok: false, message: error instanceof EthicsError ? error.message : 'ethics.errors.failed' }, error instanceof EthicsError ? error.status : 500);
  }
}
