import { NextResponse } from "next/server";
import { CHAT_NO_STORE_HEADERS, requireChatUser } from "@/lib/chat/routeServerUtils";
import { enforceChatRateLimit, readChatRateLimit } from "@/lib/chat-api-rate-limit";
import { ragRetiredPayload } from "@/lib/rag/retired";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
const windowMs = readChatRateLimit(process.env.CHAT_RATE_LIMIT_WINDOW_MS, 60_000, 1000);

// History routes remain available. Paused generation must not reserve quota,
// persist an unfinished turn or contact an AI provider.
export async function POST(req) {
  const auth = await requireChatUser();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, messageKey: auth.message, message: auth.message }, {
      status: auth.status, headers: CHAT_NO_STORE_HEADERS
    });
  }
  const limited = enforceChatRateLimit(req, {
    scope: "main_post", userId: auth.userId,
    limit: readChatRateLimit(process.env.CHAT_RATE_LIMIT_CHAT_POST_MAX, 24), windowMs
  });
  if (limited) return limited;
  return NextResponse.json(ragRetiredPayload(), { status: 503, headers: CHAT_NO_STORE_HEADERS });
}

export async function GET(req) {
  const limited = enforceChatRateLimit(req, {
    scope: "main_get", limit: readChatRateLimit(process.env.CHAT_RATE_LIMIT_CHAT_GET_MAX, 120), windowMs
  });
  if (limited) return limited;
  return NextResponse.json({ ok: true, route: "api/chat", generationAvailable: false }, {
    headers: CHAT_NO_STORE_HEADERS
  });
}
