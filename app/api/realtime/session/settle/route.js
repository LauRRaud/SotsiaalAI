import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authConfig } from "@/auth";
import { VOICE_SESSION_LIMIT_SECONDS, clampVoiceUsageSeconds } from "@/lib/chat/realtimeVoice";
import { verifyVoiceSettlementToken } from "@/lib/chat/realtimeVoiceToken";
import { usageService } from "@/lib/usage/service";
import { commitUsageForRequest } from "@/lib/usage/routeAdapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};

function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

export async function POST(request) {
  const session = await getServerSession(authConfig).catch(() => null);
  if (!session?.user?.id) return json({ ok: false }, 401);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false }, 400);
  }

  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
  const claim = verifyVoiceSettlementToken(payload?.token, {
    userId: session.user.id,
    secret
  });
  if (!claim) return json({ ok: false }, 400);

  // Serveri kell on arvelduse alus; klient ei saa kasutatud sekundeid väiksemaks valetada.
  const elapsedSeconds = (Date.now() - claim.iat) / 1000;
  const actualSeconds = clampVoiceUsageSeconds(elapsedSeconds);
  const handle = {
    userId: session.user.id,
    metric: "STT_SECONDS",
    amount: BigInt(VOICE_SESSION_LIMIT_SECONDS),
    idempotencyKey: claim.key,
    service: usageService
  };

  try {
    await commitUsageForRequest(handle, {
      actualAmount: actualSeconds,
      metadata: { actualSeconds, interface: "realtime-voice" }
    });
    return json({ ok: true, chargedSeconds: actualSeconds });
  } catch {
    return json({ ok: false }, 503);
  }
}
