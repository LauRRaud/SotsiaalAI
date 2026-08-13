import { NextResponse } from "next/server";
import { assertRetentionAccess, maybeRunRetentionCleanup } from "@/lib/retention";
import { logDataAudit } from "@/lib/privacy/audit";
import { runRetentionMaintenanceWithSharedLock } from "@/lib/search/retentionMaintenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(payload, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0"
    }
  });
}

export async function POST(request, deps = {}) {
  const access = await assertRetentionAccess(request);
  if (!access?.ok) {
    return json(
      {
        ok: false,
        messageKey: access?.message || "api.common.forbidden",
        message: access?.message || "api.common.forbidden"
      },
      access?.status || 403
    );
  }

  const runWithLock = deps.runWithLock || runRetentionMaintenanceWithSharedLock;
  const cleanup = deps.cleanup || maybeRunRetentionCleanup;
  const maintenance = await runWithLock({
    run: () => cleanup({ force: true })
  });
  if (!maintenance.ran) {
    return json({
      ok: true,
      scope: access.scope,
      ran: false,
      reason: maintenance.reason,
      retryAfterSeconds: maintenance.retryAfterSeconds
    }, 202);
  }
  const result = maintenance.result;
  await logDataAudit({
    action: "RETENTION_CLEANUP_TRIGGERED",
    resourceType: "Retention",
    ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null,
    userAgent: request.headers.get("user-agent") || null,
    meta: {
      scope: access.scope,
      ok: Boolean(result?.ok)
    }
  });
  return json({
    ok: true,
    scope: access.scope,
    ran: true,
    result
  });
}
