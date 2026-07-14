import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth";
import {
  listNotificationEvents,
  markNotificationRead,
  markNotificationSourceRead,
  notificationBadges
} from "@/lib/notifications";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

function json(payload, status = 200) {
  return NextResponse.json(payload, { status, headers: NO_STORE_HEADERS });
}

async function requireUser() {
  const session = await getServerSession(authConfig).catch(() => null);
  const userId = String(session?.user?.id || "").trim();
  return userId ? { ok: true, userId } : { ok: false };
}

export async function GET(request) {
  const auth = await requireUser();
  if (!auth.ok) return json({ ok: false, message: "api.common.unauthorized" }, 401);
  const url = new URL(request.url);
  const unreadOnly = ["1", "true", "yes"].includes(
    String(url.searchParams.get("unread") || "").toLowerCase()
  );
  const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit")) || 30, 100));
  try {
    const events = await listNotificationEvents(auth.userId, { limit, unreadOnly });
    return json({ ok: true, events, badges: notificationBadges(events) });
  } catch (error) {
    console.error("[notifications] list failed", safeError(error));
    return json({ ok: false, message: "api.notifications.load_failed" }, 500);
  }
}

export async function PATCH(request) {
  const auth = await requireUser();
  if (!auth.ok) return json({ ok: false, message: "api.common.unauthorized" }, 401);
  const body = await request.json().catch(() => ({}));
  try {
    const result = body?.eventId
      ? await markNotificationRead(auth.userId, body.eventId)
      : await markNotificationSourceRead(auth.userId, {
          sourceType: body?.sourceType,
          sourceId: body?.sourceId
        });
    return json({ ok: true, ...result });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("[notifications] mark read failed", safeError(error));
    return json({
      ok: false,
      message: status === 404 ? "api.common.not_found" : "api.notifications.update_failed"
    }, status);
  }
}
