export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { assertAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { safeError } from "@/lib/privacy/safeError";
import { getAdminUsageUserDetail } from "@/lib/usage/adminUserDetail";
import { normalizeReason } from "@/lib/usage/adminValidation";

const HEADERS = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };
const json = (body, status = 200) => NextResponse.json(body, { status, headers: HEADERS });

async function requireAdmin() {
  const session = await getServerSession(authConfig).catch(() => null);
  const authz = assertAdmin(session);
  return { session, authz };
}

export async function GET(request) {
  const { authz } = await requireAdmin();
  if (!authz.ok) return json({ ok: false, messageKey: authz.message }, authz.status || 403);
  try {
    const q = new URL(request.url).searchParams.get("q");
    const detail = await getAdminUsageUserDetail(q);
    if (!detail) return json({ ok: false, messageKey: "api.admin.usage.user_not_found" }, 404);
    return json({ ok: true, ...detail });
  } catch (error) {
    console.error("[admin/usage/users GET]", safeError(error));
    return json({ ok: false, messageKey: "api.admin.usage.user_load_failed" }, 500);
  }
}

export async function PATCH(request) {
  const { session, authz } = await requireAdmin();
  if (!authz.ok) return json({ ok: false, messageKey: authz.message }, authz.status || 403);
  try {
    const body = await request.json();
    const userId = String(body?.userId || "").trim();
    const action = String(body?.action || "").trim().toLowerCase();
    const reason = normalizeReason(body?.reason);
    if (!userId || !["suspend", "resume"].includes(action)) throw new TypeError("Invalid user action");
    if (userId === session.user.id) return json({ ok: false, messageKey: "api.admin.usage.user_action_forbidden" }, 409);

    await prisma.$transaction(async tx => {
      const target = await tx.user.findUnique({ where: { id: userId }, select: { id: true, isAdmin: true, accessSuspendedAt: true } });
      if (!target) {
        const error = new Error("User was not found");
        error.code = "USER_NOT_FOUND";
        throw error;
      }
      if (target.isAdmin) {
        const error = new Error("Admin accounts cannot be suspended here");
        error.code = "USER_ACTION_FORBIDDEN";
        throw error;
      }
      const suspended = action === "suspend";
      await tx.user.update({
        where: { id: userId },
        data: {
          accessSuspendedAt: suspended ? new Date() : null,
          accessSuspendedReason: suspended ? reason : null,
          accessSuspendedByUserId: suspended ? session.user.id : null,
          sessionVersion: { increment: 1 }
        }
      });
      await tx.session.deleteMany({ where: { userId } });
      await tx.dataAuditLog.create({
        data: {
          actorUserId: session.user.id,
          targetUserId: userId,
          action: suspended ? "USER_ACCESS_SUSPENDED" : "USER_ACCESS_RESUMED",
          resourceType: "User",
          resourceId: userId,
          ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
          userAgent: request.headers.get("user-agent"),
          meta: { reason, previousSuspendedAt: target.accessSuspendedAt?.toISOString() ?? null }
        }
      });
    });
    return json({ ok: true, detail: await getAdminUsageUserDetail(userId) });
  } catch (error) {
    const invalid = error instanceof TypeError;
    console.error("[admin/usage/users PATCH]", safeError(error));
    const forbidden = error?.code === "USER_ACTION_FORBIDDEN";
    return json({
      ok: false,
      messageKey: forbidden ? "api.admin.usage.user_action_forbidden" : invalid ? "api.admin.usage.invalid_input" : "api.admin.usage.user_action_failed"
    }, error?.code === "USER_NOT_FOUND" ? 404 : forbidden ? 409 : invalid ? 400 : 500);
  }
}
