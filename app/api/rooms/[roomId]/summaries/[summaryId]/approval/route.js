import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { ROOM_WRITE, resolveRoomAccess } from "@/lib/rooms/accessGuard";
import { respondToSummaryApproval } from "@/lib/rooms/summaryApproval";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* T20 COLLAB-P2 — osaleja vastus kokkuvõtte kinnitusringile.
 * POST { status: "APPROVED" | "CORRECTION", note?: string }
 * Keskne ruumivärav kontrollib billing'u ja ruumi elutsükli; kinnitusringi
 * teenus kontrollib lisaks rolli, ringi, jagajat ja tagasi võetud jagamist. */

const RATE_LIMIT_WINDOW_MS = Number(process.env.ROOM_SUMMARY_APPROVAL_RATE_LIMIT_WINDOW_MS || 60_000);
const RATE_LIMIT_POST = Number(process.env.ROOM_SUMMARY_APPROVAL_RATE_LIMIT_MAX || 10);

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0"
    }
  });
}

function errorJson(messageKey, status) {
  return json({ ok: false, messageKey, message: messageKey }, status);
}

async function requireUser() {
  try {
    const session = await getServerSession(authConfig);
    if (!session?.user?.id) return { ok: false, status: 401, message: "api.common.unauthorized" };
    return { ok: true, userId: session.user.id, userRole: session.user.role };
  } catch {
    return { ok: false, status: 401, message: "api.common.unauthorized" };
  }
}

async function resolveParams(paramsLike) {
  const params = paramsLike instanceof Promise ? await paramsLike : paramsLike;
  return {
    roomId: String(params?.roomId || "").trim(),
    summaryId: String(params?.summaryId || "").trim()
  };
}

export async function POST(req, { params }) {
  const auth = await requireUser();
  if (!auth.ok) return errorJson(auth.message, auth.status);

  const { roomId, summaryId } = await resolveParams(params);
  if (!roomId || !summaryId) return errorJson("api.common.not_found", 404);

  const access = await resolveRoomAccess({
    userId: auth.userId,
    userRole: auth.userRole,
    roomId,
    intent: ROOM_WRITE
  });
  if (!access.ok) return errorJson(access.message, access.status || 403);

  const limiter = consumeRateLimit(
    `roomsummaryapproval:${roomId}:${auth.userId}`,
    RATE_LIMIT_POST,
    RATE_LIMIT_WINDOW_MS
  );
  if (!limiter.allowed) return errorJson("api.common.rate_limited", 429);

  let payload;
  try {
    payload = await req.json();
  } catch {
    return errorJson("api.common.invalid_json", 400);
  }

  try {
    const approval = await respondToSummaryApproval({
      roomId,
      summaryId,
      userId: auth.userId,
      userRole: auth.userRole,
      status: payload?.status,
      note: payload?.note
    });
    return json({ ok: true, approval: { status: approval.status, updatedAt: approval.updatedAt } });
  } catch (err) {
    const status = Number(err?.status);
    if (Number.isFinite(status) && status >= 400 && status < 500) {
      return errorJson(err.message || "api.rooms.summary_response_failed", status);
    }
    console.error("[summary approval POST] failed", safeError(err));
    return errorJson("api.rooms.summary_response_failed", 500);
  }
}
