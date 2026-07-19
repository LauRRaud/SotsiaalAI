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

export function reflectionJson(payload, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: NO_STORE_HEADERS
  });
}

/* Sama väravaring mis Tööheaolul: autenditud + spetsialistiroll + tellimus.
   Rollivärav on TEADLIKULT sama funktsioon (`canUseWellbeingRole` =
   SOCIAL_WORKER): Meetodipeegel on sama sihtrühma professionaalne tööriist ja
   teine sõnastus tekitaks kaks lahknevat spetsialisti-definitsiooni.
   NB see värav annab ligipääsu AINULT kasutaja ENDA kirjetele — iga lib-päring
   on omanik-skoobitud; admin-erand siin tähendab admini OMA kirjeid, mitte
   teiste nägemist (ptk 3.6 p3: kirjete olemasolu ei näe ka admin). */
export async function requireReflectionApiUser(request) {
  const session = await getServerSession(authConfig).catch(() => null);
  const userId = session?.user?.id ? String(session.user.id) : "";
  if (!userId) {
    return {
      ok: false,
      response: reflectionJson({ ok: false, message: "api.common.unauthorized" }, 401)
    };
  }

  const roleState = resolveSessionRoleState(session, request.cookies);
  if (!canUseWellbeingRole(roleState.effectiveRole, Boolean(roleState.isAdmin))) {
    return {
      ok: false,
      response: reflectionJson({ ok: false, message: "reflection.errors.forbidden" }, 403)
    };
  }

  const gate = await requireSubscription(session, roleState.effectiveRole);
  if (!gate.ok) {
    return {
      ok: false,
      response: reflectionJson({
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

export function reflectionErrorResponse(error, fallbackMessage) {
  const status = Number(error?.status) || 500;
  const message = status === 500 ? fallbackMessage : (error?.message || fallbackMessage);
  const payload = { ok: false, message };
  if (error?.details && status !== 500) payload.details = error.details;
  return reflectionJson(payload, status);
}
