export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";

import { authConfig } from "@/auth";
import { revokeTrackedSession } from "@/lib/auth/sessionRevocation";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
import { safeError } from "@/lib/privacy/safeError";
import { prisma } from "@/lib/prisma";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};

function json(payload, status = 200) {
  return NextResponse.json(payload, { status, headers: NO_STORE_HEADERS });
}

function errorJson(messageKey, status = 400, locale = "en", extras = {}) {
  const translated = serverT(locale, messageKey, undefined, messageKey);
  return json({ ok: false, messageKey, message: translated, error: translated, ...extras }, status);
}

function localeFromRequest(request, bodyLocale) {
  const direct = normalizeServerLocale(bodyLocale);
  if (direct) return direct;

  const raw = String(request?.headers?.get("accept-language") || "");
  const parts = raw
    .split(",")
    .map((part) => part.split(";")[0].trim())
    .filter(Boolean);

  for (const part of parts) {
    const normalized = normalizeServerLocale(part);
    if (normalized) return normalized;
  }

  return "en";
}

/**
 * Ühe seadme väljalogimine (SOL-AUTH-14).
 *
 * Klient tohib küpsise eemaldada — `signOut()` kutsuda — AINULT selle marsruudi eduka
 * vastuse peale. Varem tegi seda NextAuthi `signOut` event best-effort'ina ja iga
 * andmebaasiviga jäi ainult logisse: kasutaja nägi end väljas, aga kopeeritud JWT
 * autoriseeris edasi. Nüüd on nähtav tulemus ja serveripoolne revokatsioon üks asi.
 */
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const locale = localeFromRequest(request, body?.locale || body?.lang);

  try {
    const session = await getServerSession(authConfig);
    const userId = session?.user?.id;
    if (!userId) {
      return errorJson("api.common.unauthorized", 401, locale);
    }

    // `sessionRecordId` elab ainult JWT-s, mitte avalikus sessiooniobjektis — seega ta
    // loetakse tokenist, mitte kliendi kehast: kliendi antud ID oleks võõra sessiooni tee.
    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
    });
    const sessionRecordId = token?.sessionRecordId;

    if (!sessionRecordId) {
      // Jälgitavat rida ei ole, seega ei ole ka midagi tühistada: küpsise eemaldamine
      // on kogu revokatsioon, mida see sessioon vajab.
      return json({ ok: true, outcome: "no_tracked_session" });
    }

    const result = await revokeTrackedSession({ db: prisma, userId, sessionRecordId });
    if (!result.ok) {
      console.error("profile logout revoke rejected", { reason: result.reason });
      return errorJson("profile.logout_failed", 409, locale, { code: "REVOKE_REJECTED" });
    }

    return json({ ok: true, outcome: result.outcome });
  } catch (error) {
    // Aus, korratav viga: küpsis jääb alles, sessioon jääb kehtima ja kasutaja saab
    // uuesti proovida. Vale eduteade oleks siin ainus asi, mis on hullem kui tõrge.
    console.error("profile logout error", safeError(error));
    return errorJson("profile.logout_failed", 500, locale, { code: "REVOKE_FAILED" });
  }
}
