import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth";
import { assertAdmin } from "@/lib/authz";
import { addWellbeingPilotViewer } from "@/lib/wellbeing/pilotScopes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  "X-Content-Type-Options": "nosniff"
};

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: NO_STORE_HEADERS
  });
}

function errorJson(message, status = 400) {
  return json({ ok: false, message }, status);
}

export async function POST(request, context) {
  const session = await getServerSession(authConfig).catch(() => null);
  const authz = assertAdmin(session);
  if (!authz.ok) {
    return errorJson(authz.message || "api.common.forbidden", authz.status || 403);
  }

  const params = await context.params;
  const body = await request.json().catch(() => ({}));
  try {
    const viewer = await addWellbeingPilotViewer(params.id, body);
    return json({ ok: true, viewer }, 201);
  } catch (error) {
    return errorJson(error?.message || "wellbeing.pilot.viewer_add_failed", error?.status || 400);
  }
}
