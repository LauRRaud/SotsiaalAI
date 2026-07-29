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

  /* KÕVA REEGEL (SotsiaalAI.md, omanik 28.07): ligipääs OMA andmetele ei aegu
     tellimusega — lugemine (GET) ja kustutamine (DELETE) on tellimuseväravata.
     Kirje sees juba salvestatud AI-soovitus on makstud ja valminud tulemus, mitte
     uus AI-kulu. Loomine/muutmine ja kõik uut AI-kulu tekitav jääb värava taha. */
  const method = String(request?.method || "").toUpperCase();
  const gate = await requireSubscription(session, roleState.effectiveRole, {
    allowWithoutSubscription: method === "GET" || method === "DELETE"
  });
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
