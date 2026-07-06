import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth";
import { assertAdmin } from "@/lib/authz";
import {
  createWellbeingPilotScope,
  listWellbeingPilotScopes
} from "@/lib/wellbeing/pilotScopes";

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

async function requireAdmin() {
  const session = await getServerSession(authConfig).catch(() => null);
  return assertAdmin(session);
}

export async function GET(request) {
  void request;
  const authz = await requireAdmin();
  if (!authz.ok) {
    return errorJson(authz.message || "api.common.forbidden", authz.status || 403);
  }

  const pilotScopes = await listWellbeingPilotScopes();
  return json({ ok: true, pilotScopes });
}

export async function POST(request) {
  const authz = await requireAdmin();
  if (!authz.ok) {
    return errorJson(authz.message || "api.common.forbidden", authz.status || 403);
  }

  const body = await request.json().catch(() => ({}));
  try {
    const pilotScope = await createWellbeingPilotScope(body);
    return json({ ok: true, pilotScope }, 201);
  } catch (error) {
    return errorJson(error?.message || "wellbeing.pilot.scope_create_failed", error?.status || 400);
  }
}
