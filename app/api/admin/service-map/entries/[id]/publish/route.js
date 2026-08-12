export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { assertAdmin } from "@/lib/authz";
import { safeError } from "@/lib/privacy/safeError";
import { publishServiceMapEntry } from "@/lib/serviceMap/moderation";

const json = (body, status = 200) => NextResponse.json(body, {
  status,
  headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" }
});

export async function POST(request, { params }) {
  const session = await getServerSession(authConfig).catch(() => null);
  const authz = assertAdmin(session);
  if (!authz.ok) return json({ ok: false, messageKey: authz.message }, authz.status || 403);

  try {
    const { id } = await params;
    const body = await request.json();
    const entry = await publishServiceMapEntry({
      entryId: id,
      actorUserId: session.user.id,
      expectedRevision: body?.expectedRevision,
      reason: body?.reason
    });
    return json({ ok: true, entry });
  } catch (error) {
    const status = error?.code === "SERVICE_MAP_ENTRY_NOT_FOUND"
      ? 404
      : error?.code === "SERVICE_MAP_MODERATION_INVALID"
        ? 400
        : String(error?.code || "").includes("CONFLICT")
          ? 409
          : 500;
    if (status === 500) console.error("[admin/service-map/publish]", safeError(error));
    return json({
      ok: false,
      code: status === 500 ? "SERVICE_MAP_MODERATION_FAILED" : error.code,
      messageKey: status === 404 ? "api.common.not_found" : status === 400 ? "api.common.invalid_request" : status === 409 ? "api.common.conflict" : "api.common.error"
    }, status);
  }
}
