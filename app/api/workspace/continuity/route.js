import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth";
import { getWorkspaceContinuity } from "@/lib/workspaceContinuity";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

function json(payload, status = 200) {
  return NextResponse.json(payload, { status, headers: NO_STORE_HEADERS });
}

export async function GET() {
  const session = await getServerSession(authConfig).catch(() => null);
  const userId = String(session?.user?.id || "").trim();
  if (!userId) return json({ ok: false, message: "api.common.unauthorized" }, 401);
  try {
    const continuity = await getWorkspaceContinuity(userId);
    return json({ ok: true, ...continuity });
  } catch (error) {
    console.error("[workspace-continuity] load failed", safeError(error));
    return json({ ok: false, message: "api.notifications.continuity_failed" }, 500);
  }
}
