export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { assertAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { safeError } from "@/lib/privacy/safeError";
import { normalizeEntitlementInput, normalizeReason } from "@/lib/usage/adminValidation";
import { usageSnapshotService } from "@/lib/usage/snapshot";

const HEADERS = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };
const json = (body, status = 200) => NextResponse.json(body, { status, headers: HEADERS });

async function requireAdmin() {
  const session = await getServerSession(authConfig).catch(() => null);
  const authz = assertAdmin(session);
  return { session, authz };
}

function shapeOverride(item) {
  return {
    ...item,
    softLimit: item.softLimit?.toString() ?? null,
    hardLimit: item.hardLimit?.toString() ?? null
  };
}

export async function GET(request) {
  const { authz } = await requireAdmin();
  if (!authz.ok) return json({ ok: false, messageKey: authz.message }, authz.status || 403);
  try {
    const q = String(new URL(request.url).searchParams.get("q") || "").trim();
    if (!q) return json({ ok: true, user: null, snapshot: null, overrides: [] });
    const user = await prisma.user.findFirst({
      where: { OR: [{ id: q }, { email: { equals: q, mode: "insensitive" } }] },
      select: { id: true, email: true, role: true, isAdmin: true, createdAt: true }
    });
    if (!user) return json({ ok: false, messageKey: "api.admin.usage.user_not_found" }, 404);
    const now = new Date();
    const [snapshot, overrides] = await Promise.all([
      usageSnapshotService.getUserSnapshot(user.id, { now }),
      prisma.userEntitlementOverride.findMany({
        where: { userId: user.id },
        orderBy: [{ createdAt: "desc" }],
        take: 50,
        select: {
          id: true,
          metric: true,
          enabled: true,
          softLimit: true,
          hardLimit: true,
          period: true,
          reason: true,
          validFrom: true,
          validUntil: true,
          createdByAdminId: true,
          createdAt: true
        }
      })
    ]);
    return json({ ok: true, user, snapshot, overrides: overrides.map(shapeOverride) });
  } catch (error) {
    console.error("[admin/usage/overrides GET]", safeError(error));
    return json({ ok: false, messageKey: "api.admin.usage.overrides_load_failed" }, 500);
  }
}

export async function POST(request) {
  const { session, authz } = await requireAdmin();
  if (!authz.ok) return json({ ok: false, messageKey: authz.message }, authz.status || 403);
  try {
    const body = await request.json();
    const userId = String(body?.userId || "").trim();
    const reason = normalizeReason(body?.reason);
    const entitlement = normalizeEntitlementInput(body);
    const validUntil = body?.validUntil ? new Date(body.validUntil) : null;
    if (!userId) throw new TypeError("userId is required");
    if (validUntil && (Number.isNaN(validUntil.getTime()) || validUntil <= new Date())) {
      throw new TypeError("validUntil must be in the future");
    }

    const created = await prisma.$transaction(async tx => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        const error = new Error("User was not found");
        error.code = "USER_NOT_FOUND";
        throw error;
      }
      const item = await tx.userEntitlementOverride.create({
        data: {
          userId,
          createdByAdminId: session.user.id,
          reason,
          validUntil,
          ...entitlement
        }
      });
      await tx.dataAuditLog.create({
        data: {
          actorUserId: session.user.id,
          targetUserId: userId,
          action: "usage_override_created",
          resourceType: "UserEntitlementOverride",
          resourceId: item.id,
          ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
          userAgent: request.headers.get("user-agent"),
          meta: {
            metric: item.metric,
            period: item.period,
            enabled: item.enabled,
            softLimit: item.softLimit?.toString() ?? null,
            hardLimit: item.hardLimit?.toString() ?? null,
            validUntil: item.validUntil?.toISOString() ?? null,
            reason
          }
        }
      });
      return item;
    });
    return json({ ok: true, override: shapeOverride(created) });
  } catch (error) {
    const invalid = error instanceof TypeError;
    console.error("[admin/usage/overrides POST]", safeError(error));
    return json({
      ok: false,
      messageKey: invalid ? "api.admin.usage.invalid_input" : "api.admin.usage.override_create_failed"
    }, error?.code === "USER_NOT_FOUND" ? 404 : invalid ? 400 : 500);
  }
}

export async function DELETE(request) {
  const { session, authz } = await requireAdmin();
  if (!authz.ok) return json({ ok: false, messageKey: authz.message }, authz.status || 403);
  try {
    const body = await request.json();
    const id = String(body?.id || "").trim();
    const reason = normalizeReason(body?.reason);
    if (!id) throw new TypeError("id is required");
    const ended = await prisma.$transaction(async tx => {
      const existing = await tx.userEntitlementOverride.findUnique({ where: { id } });
      if (!existing) {
        const error = new Error("Override was not found");
        error.code = "OVERRIDE_NOT_FOUND";
        throw error;
      }
      const validUntil = new Date();
      const item = await tx.userEntitlementOverride.update({ where: { id }, data: { validUntil } });
      await tx.dataAuditLog.create({
        data: {
          actorUserId: session.user.id,
          targetUserId: item.userId,
          action: "usage_override_ended",
          resourceType: "UserEntitlementOverride",
          resourceId: item.id,
          ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
          userAgent: request.headers.get("user-agent"),
          meta: { metric: item.metric, reason, validUntil: validUntil.toISOString() }
        }
      });
      return item;
    });
    return json({ ok: true, override: shapeOverride(ended) });
  } catch (error) {
    const invalid = error instanceof TypeError;
    console.error("[admin/usage/overrides DELETE]", safeError(error));
    return json({
      ok: false,
      messageKey: invalid ? "api.admin.usage.invalid_input" : "api.admin.usage.override_end_failed"
    }, error?.code === "OVERRIDE_NOT_FOUND" ? 404 : invalid ? 400 : 500);
  }
}
