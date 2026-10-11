export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authConfig } from "@/auth";
import { prisma } from "@/lib/prisma";
import { savePrivacyPromptEnabled } from "@/lib/privacy/promptPreference";
import { safeError } from "@/lib/privacy/safeError";

/**
 * Isikuandmete hoiatuse lüliti (konto seaded). Eraldi marsruut samal põhjusel nagu nimi:
 * `PUT /api/profile` muudab e-posti ja PIN-i, küsib kehtivat PIN-i ja võib sessiooni lõpetada.
 *
 * Inimene muudab ainult OMA seadet: konto tuleb sessioonist, mitte päringu kehast.
 */

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};

function json(payload, status = 200) {
  return NextResponse.json(payload, { status, headers: NO_STORE_HEADERS });
}

/* Vastus kannab tõlkevõtit, mitte lauset: lehe `resolveApiMessage` tõlgib selle. */
function errorJson(messageKey, status) {
  return json({ ok: false, message: messageKey, messageKey }, status);
}

export async function PUT(request) {
  const session = await getServerSession(authConfig).catch(() => null);
  const userId = String(session?.user?.id || "").trim();
  if (!userId) return errorJson("api.common.unauthorized", 401);

  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body?.enabled !== "boolean") return errorJson("api.common.invalid_request", 400);
    const saved = await savePrivacyPromptEnabled(userId, body.enabled, { db: prisma });
    if (!saved) return errorJson("profile.errors.user_not_found", 404);
    return json({ ok: true, enabled: saved.enabled });
  } catch (error) {
    console.error("profile privacy prompt PUT error", safeError(error));
    return errorJson("profile.privacy_prompt.save_failed", 500);
  }
}
