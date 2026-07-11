export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { assertAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { safeError } from "@/lib/privacy/safeError";
import {
  normalizeEntitlementInput,
  normalizePrice,
  normalizeReason
} from "@/lib/usage/adminValidation";

const HEADERS = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };
const json = (body, status = 200) => NextResponse.json(body, { status, headers: HEADERS });

function serializePlan(plan) {
  return {
    ...plan,
    price: String(plan.price),
    effectiveFrom: plan.effectiveFrom?.toISOString?.() || plan.effectiveFrom,
    effectiveTo: plan.effectiveTo?.toISOString?.() || plan.effectiveTo,
    entitlements: (plan.entitlements || []).map(item => ({
      ...item,
      softLimit: item.softLimit?.toString() ?? null,
      hardLimit: item.hardLimit?.toString() ?? null
    }))
  };
}

async function requireAdmin() {
  const session = await getServerSession(authConfig).catch(() => null);
  const authz = assertAdmin(session);
  return { session, authz };
}

export async function GET() {
  const { authz } = await requireAdmin();
  if (!authz.ok) return json({ ok: false, messageKey: authz.message }, authz.status || 403);
  try {
    const [plans, audit] = await Promise.all([
      prisma.planDefinition.findMany({
        where: { active: true },
        include: { entitlements: { orderBy: { metric: "asc" } }, _count: { select: { subscriptions: true } } },
        orderBy: [{ role: "asc" }, { key: "asc" }, { version: "desc" }]
      }),
      prisma.dataAuditLog.findMany({
        where: { action: "usage_plan_version_created" },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, createdAt: true, actorUserId: true, resourceId: true, meta: true }
      })
    ]);
    return json({ ok: true, plans: plans.map(serializePlan), audit });
  } catch (error) {
    console.error("[admin/usage/plans GET]", safeError(error));
    return json({ ok: false, messageKey: "api.admin.usage.plans_load_failed" }, 500);
  }
}

export async function PATCH(request) {
  const { session, authz } = await requireAdmin();
  if (!authz.ok) return json({ ok: false, messageKey: authz.message }, authz.status || 403);
  try {
    const body = await request.json();
    const planId = String(body?.planId || "").trim();
    const reason = normalizeReason(body?.reason);
    const price = normalizePrice(body?.price);
    const entitlements = (Array.isArray(body?.entitlements) ? body.entitlements : []).map(normalizeEntitlementInput);
    if (!planId) throw new TypeError("planId is required");
    if (new Set(entitlements.map(item => item.metric)).size !== entitlements.length) {
      throw new TypeError("Duplicate usage metric");
    }

    const result = await prisma.$transaction(async tx => {
      const previous = await tx.planDefinition.findUnique({
        where: { id: planId },
        include: { entitlements: true }
      });
      if (!previous || !previous.active) {
        const error = new Error("Active plan was not found");
        error.code = "PLAN_NOT_FOUND";
        throw error;
      }
      const latest = await tx.planDefinition.findFirst({
        where: { key: previous.key },
        orderBy: { version: "desc" },
        select: { version: true }
      });
      const now = new Date();
      await tx.planDefinition.update({
        where: { id: previous.id },
        data: { active: false, effectiveTo: now }
      });
      const created = await tx.planDefinition.create({
        data: {
          key: previous.key,
          name: previous.name,
          role: previous.role,
          price,
          currency: previous.currency,
          version: Number(latest?.version || previous.version) + 1,
          active: true,
          effectiveFrom: now,
          entitlements: { create: entitlements }
        },
        include: { entitlements: { orderBy: { metric: "asc" } }, _count: { select: { subscriptions: true } } }
      });
      const reassigned = await tx.subscription.updateMany({
        where: {
          planDefinitionId: previous.id,
          status: { in: ["NONE", "ACTIVE", "PAST_DUE"] }
        },
        data: { planDefinitionId: created.id, plan: created.key }
      });
      await tx.dataAuditLog.create({
        data: {
          actorUserId: session.user.id,
          action: "usage_plan_version_created",
          resourceType: "PlanDefinition",
          resourceId: created.id,
          ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
          userAgent: request.headers.get("user-agent"),
          meta: {
            reason,
            previousPlanId: previous.id,
            previousVersion: previous.version,
            newVersion: created.version,
            reassignedSubscriptions: reassigned.count,
            metrics: entitlements.map(item => item.metric)
          }
        }
      });
      return created;
    });
    return json({ ok: true, plan: serializePlan(result) });
  } catch (error) {
    const invalid = error instanceof TypeError;
    console.error("[admin/usage/plans PATCH]", safeError(error));
    return json({
      ok: false,
      messageKey: invalid ? "api.admin.usage.invalid_input" : "api.admin.usage.plan_update_failed"
    }, error?.code === "PLAN_NOT_FOUND" ? 404 : invalid ? 400 : 500);
  }
}
