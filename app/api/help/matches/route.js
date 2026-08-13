import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { createHelpMatchAndRoom, listIncomingHelpMatches, toPublicHelpMatchProjection } from "@/lib/help";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIpFromRequest } from "@/lib/request-ip";
import { logDataAudit } from "@/lib/privacy/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};
const RATE_LIMIT_MAX = 12;
const RATE_LIMIT_WINDOW_MS = 60_000;

function json(payload, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: NO_STORE_HEADERS
  });
}

async function requireUser() {
  try {
    const session = await getServerSession(authConfig);
    if (!session?.user?.id) return null;
    return {
      userId: session.user.id
    };
  } catch {
    return null;
  }
}

export async function POST(request) {
  const auth = await requireUser();
  if (!auth) {
    return json({ ok: false, message: "api.common.unauthorized" }, 401);
  }

  const limiter = consumeRateLimit(
    `help-match:create:${auth.userId}:${getRequestIpFromRequest(request)}`,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS
  );
  if (!limiter.allowed) return json({ ok: false, message: "api.common.rate_limited" }, 429);

  const payload = await request.json().catch(() => ({}));

  try {
    const match = await createHelpMatchAndRoom({
      requestId: payload?.requestId,
      offerId: payload?.offerId,
      initiatedByUserId: auth.userId
    });

    if (match.status === "DECLINED" || match.status === "CLOSED") {
      return json({ ok: false, message: "HELP_MATCH_NOT_AVAILABLE" }, 409);
    }

    const recipientUserId = match.initiatedByUserId === match.requesterId ? match.offererId : match.requesterId;
    if (match.wasCreated) {
      void logDataAudit({
        actorUserId: auth.userId,
        targetUserId: recipientUserId || null,
        action: "HELP_MATCH_PENDING_CREATED",
        resourceType: "HELP_MATCH",
        resourceId: match.id,
        ipAddress: getRequestIpFromRequest(request),
        meta: { requestId: match.requestId, offerId: match.offerId }
      });
    }

    return json({
      ok: true,
      match: toPublicHelpMatchProjection(match)
    });
  } catch (error) {
    const status = error?.code === "HELP_MATCH_NOT_COMPATIBLE" ? 409 : error?.code === "HELP_MATCH_INITIATOR_INVALID" ? 404 : 400;
    return json({
      ok: false,
      message: error?.code || "HELP_MATCH_CREATE_FAILED"
    }, status);
  }
}

export async function GET(request) {
  const auth = await requireUser();
  if (!auth) return json({ ok: false, message: "api.common.unauthorized" }, 401);
  try {
    const url = new URL(request.url);
    const result = await listIncomingHelpMatches(auth.userId, {
      limit: url.searchParams.get("limit"),
      cursor: url.searchParams.get("cursor")
    });
    return json({ ok: true, items: result.items, page: result.page });
  } catch (error) {
    const code = error?.code || "HELP_MATCH_LIST_FAILED";
    return json({ ok: false, message: code }, code === "HELP_MATCH_CURSOR_INVALID" ? 400 : 500);
  }
}
