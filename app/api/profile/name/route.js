export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authConfig } from "@/auth";
import { prisma } from "@/lib/prisma";
import { safeError } from "@/lib/privacy/safeError";
import { saveProfileNameForUser } from "@/lib/profile/ownName";

/**
 * Inimese enda nimi. Eraldi marsruut, mitte `PUT /api/profile` osa: seal muudetakse e-posti
 * ja PIN-i, mis küsivad kehtivat PIN-i ja võivad sessiooni lõpetada. Nime muutmine ei tohi
 * selle rajaga kokku puutuda.
 */

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};

function json(payload, status = 200) {
  return NextResponse.json(payload, { status, headers: NO_STORE_HEADERS });
}

/* Vastus kannab tõlkevõtit, mitte lauset: lehe `resolveApiMessage` tõlgib selle ja täidab
   kohatäited `details` väljalt. */
function errorJson(messageKey, status, details) {
  const payload = { ok: false, message: messageKey, messageKey };
  if (details) payload.details = details;
  return json(payload, status);
}

export async function PUT(request) {
  const session = await getServerSession(authConfig).catch(() => null);
  const userId = String(session?.user?.id || "").trim();
  if (!userId) return errorJson("api.common.unauthorized", 401);

  try {
    const body = await request.json().catch(() => ({}));
    const result = await saveProfileNameForUser({
      db: prisma,
      userId,
      firstName: body?.firstName,
      lastName: body?.lastName
    });
    if (!result.ok) return errorJson(result.error.messageKey, result.error.status, result.error.details);
    return json({ ok: true, name: result.name });
  } catch (error) {
    console.error("profile name PUT error", safeError(error));
    return errorJson("profile.name.save_failed", 500);
  }
}
