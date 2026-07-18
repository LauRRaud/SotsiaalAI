import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth";
import { assertAdmin } from "@/lib/authz";
import {
  listNotificationOperations,
  requeueNotificationOperation
} from "@/lib/notificationOperations";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };
const json = (payload, status = 200) => NextResponse.json(payload, { status, headers: NO_STORE });

async function requireAdmin() {
  const session = await getServerSession(authConfig).catch(() => null);
  return assertAdmin(session);
}

export async function GET(request) {
  const authz = await requireAdmin();
  if (!authz.ok) return json({ ok: false, message: authz.message || "api.common.forbidden" }, authz.status || 403);
  try {
    const limit = Math.max(1, Math.min(Number(new URL(request.url).searchParams.get("limit")) || 50, 100));
    return json({ ok: true, rows: await listNotificationOperations({ limit }) });
  } catch (error) {
    console.error("[admin/notifications] list failed", safeError(error));
    return json({ ok: false, message: "api.admin.notifications.load_failed" }, 500);
  }
}

export async function POST(request) {
  const authz = await requireAdmin();
  if (!authz.ok) return json({ ok: false, message: authz.message || "api.common.forbidden" }, authz.status || 403);
  const body = await request.json().catch(() => ({}));
  try {
    return json({ ok: true, ...(await requeueNotificationOperation(body?.eventId)) });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("[admin/notifications] requeue failed", safeError(error));
    return json({ ok: false, message: status === 404 ? "api.common.not_found" : "api.admin.notifications.requeue_failed" }, status);
  }
}
