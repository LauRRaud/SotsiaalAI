import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth";
import {
  getNotificationPreference,
  updateNotificationPreference
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

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return json({ ok: false, message: "api.common.unauthorized" }, 401);
  try {
    const preference = await getNotificationPreference(auth.userId);
    return json({ ok: true, preference });
  } catch (error) {
    console.error("[notification-preferences] load failed", safeError(error));
    return json({ ok: false, message: "api.notifications.preference_load_failed" }, 500);
  }
}

export async function PATCH(request) {
  const auth = await requireUser();
  if (!auth.ok) return json({ ok: false, message: "api.common.unauthorized" }, 401);
  const body = await request.json().catch(() => ({}));
  try {
    const preference = await updateNotificationPreference(auth.userId, {
      emailEnabled: body?.emailEnabled,
      expectedVersion: body?.expectedVersion
    });
    return json({ ok: true, preference });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("[notification-preferences] update failed", safeError(error));
    const message = status === 409
      ? "api.notifications.preference_conflict"
      : status === 400
        ? "api.notifications.invalid_preference"
        : "api.notifications.preference_update_failed";
    return json({ ok: false, message }, status);
  }
}
