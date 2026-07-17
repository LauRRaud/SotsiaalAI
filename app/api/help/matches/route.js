import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { createHelpMatchAndRoom, listIncomingHelpMatches } from "@/lib/help";
import { createNotificationEvent, NOTIFICATION_EVENT_TYPES } from "@/lib/notifications";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIpFromRequest } from "@/lib/request-ip";

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

    const recipientUserId = match.initiatedByUserId === match.requesterId
      ? match.offererId
      : match.requesterId;
    if (match.status === "PENDING" && recipientUserId) {
      await createNotificationEvent({
        userId: recipientUserId,
        type: NOTIFICATION_EVENT_TYPES.HELP_MATCH_CONSENT_REQUEST,
        sourceId: match.id,
        targetId: match.id,
        dedupeSuffix: "pending",
        emailPolicy: "NONE"
      });
    }

    return json({
      ok: true,
      match
    });
  } catch (error) {
    const status = error?.code === "HELP_MATCH_NOT_COMPATIBLE" ? 409 : error?.code === "HELP_MATCH_INITIATOR_INVALID" ? 404 : 400;
    return json({
      ok: false,
      message: error?.code || "HELP_MATCH_CREATE_FAILED"
    }, status);
  }
}

export async function GET() {
  const auth = await requireUser();
  if (!auth) return json({ ok: false, message: "api.common.unauthorized" }, 401);
  try {
    return json({ ok: true, items: await listIncomingHelpMatches(auth.userId) });
  } catch {
    return json({ ok: false, message: "HELP_MATCH_LIST_FAILED" }, 500);
  }
}
