import { pilotPost } from '@/lib/chat/m4PilotServer';
import { ethicsRagConfig, validateEthicsTurn } from '@/lib/ethics/ragScope';
import { enforceChatRateLimit } from '@/lib/chat-api-rate-limit';
import { requireChatUser, CHAT_NO_STORE_HEADERS } from '@/lib/chat/routeServerUtils';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request) {
  const auth = await requireChatUser();
  if (!auth.ok) return NextResponse.json({ ok: false, messageKey: auth.message }, { status: auth.status, headers: CHAT_NO_STORE_HEADERS });
  const limited = enforceChatRateLimit(request, { scope: 'main_post', userId: auth.userId, limit: 24, windowMs: 60000 });
  if (limited) return limited;
  return pilotPost(request, { configurationScope: ethicsRagConfig, inputPolicy: validateEthicsTurn });
}
