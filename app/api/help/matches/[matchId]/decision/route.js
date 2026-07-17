import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authConfig } from "@/auth";
import { decideHelpMatch } from "@/lib/help";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIpFromRequest } from "@/lib/request-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };
const RATE_LIMIT_MAX = 12;
const RATE_LIMIT_WINDOW_MS = 60_000;

function json(payload, status = 200) {
  return NextResponse.json(payload, { status, headers: NO_STORE_HEADERS });
}

export async function POST(request, { params }) {
  const session = await getServerSession(authConfig).catch(() => null);
  const userId = session?.user?.id || "";
  if (!userId) return json({ ok: false, message: "api.common.unauthorized" }, 401);
  const limiter = consumeRateLimit(
    `help-match:decision:${userId}:${getRequestIpFromRequest(request)}`,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS
  );
  if (!limiter.allowed) return json({ ok: false, message: "api.common.rate_limited" }, 429);
  const body = await request.json().catch(() => ({}));
  try {
    const match = await decideHelpMatch({
      matchId: params?.matchId,
      decidedByUserId: userId,
      decision: body?.decision
    });
    return json({ ok: true, match });
  } catch (error) {
    const code = error?.code || "HELP_MATCH_DECISION_FAILED";
    const status = code === "HELP_MATCH_NOT_FOUND" || code === "HELP_MATCH_FORBIDDEN" || code === "HELP_MATCH_INITIATOR_CANNOT_DECIDE" ? 404 : 400;
    return json({ ok: false, message: code }, status);
  }
}
