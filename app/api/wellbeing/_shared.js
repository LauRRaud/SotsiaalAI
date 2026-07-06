import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth";
import { requireSubscription, resolveSessionRoleState } from "@/lib/authz";
import { canUseWellbeingRole } from "@/lib/wellbeingTools";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "X-Content-Type-Options": "nosniff",
  Pragma: "no-cache",
  Expires: "0"
};

export function wellbeingJson(payload, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: NO_STORE_HEADERS
  });
}

export async function requireWellbeingApiUser(request) {
  const session = await getServerSession(authConfig).catch(() => null);
  const userId = session?.user?.id ? String(session.user.id) : "";
  if (!userId) {
    return {
      ok: false,
      response: wellbeingJson({ ok: false, message: "api.common.unauthorized" }, 401)
    };
  }

  const roleState = resolveSessionRoleState(session, request.cookies);
  if (!canUseWellbeingRole(roleState.effectiveRole, Boolean(roleState.isAdmin))) {
    return {
      ok: false,
      response: wellbeingJson({ ok: false, message: "wellbeing.errors.forbidden" }, 403)
    };
  }

  const gate = await requireSubscription(session, roleState.effectiveRole);
  if (!gate.ok) {
    return {
      ok: false,
      response: wellbeingJson({
        ok: false,
        message: "api.common.subscription_required",
        redirect: gate.redirect,
        requireSubscription: gate.requireSubscription
      }, 402)
    };
  }

  return {
    ok: true,
    session,
    userId,
    roleState
  };
}
