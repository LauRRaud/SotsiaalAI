/**
 * TEENUSPÄEVIK-V1 E3 — suunamiste API (loend koos jäägiga + loomine).
 *
 * Loend tagastab saldo KAASA (DoD punkt 4: jääk on alati nähtav). Eraldi
 * saldopäring tähendaks, et mõni vaade unustab ta küsida ja ületus jääb
 * märkamata just seal, kus ta maksab.
 */
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { roleFromSession } from "@/lib/authz";
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { enforceChatRateLimit } from "@/lib/chat-api-rate-limit";
import { safeError } from "@/lib/privacy/safeError";
import { createReferral, listReferrals } from "@/lib/serviceLog/referrals";
import { ServiceLogError } from "@/lib/serviceLog/errors";
import { ServiceLogDisabledError, isServiceLogEnabled } from "@/lib/serviceLog/flags";

/* VEATEATED KASUTAJA KEELES. `errorJson` lokaadi vaikeväärtus on "en" — ilma
   `localeFromRequest`-ita tuli eestikeelsele kasutajale ingliskeelne teade.
   Brauserikontroll näitas seda: kinnitamise tõrge kuvati kujul „The entry is
   already final." keset eestikeelset pinda. `i18n:check` ei püüa seda kinni,
   sest ta kontrollib võtmete PARITEETI, mitte kasutuskohta. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function guard(req, scope) {
  // Värav enne autentimist — suletud pind on eristamatu olematust marsruudist.
  if (!isServiceLogEnabled()) {
    return { response: errorJson("service_log.errors.not_found", 404, localeFromRequest(req)) };
  }
  const session = await getServerSession(authConfig).catch(() => null);
  const userId = session?.user?.id ? String(session.user.id) : "";
  if (!userId) return { response: errorJson("api.common.unauthorized", 401, localeFromRequest(req)) };
  if (roleFromSession(session) !== "SERVICE_PROVIDER") {
    return { response: errorJson("api.common.forbidden", 403, localeFromRequest(req)) };
  }
  const limited = enforceChatRateLimit(req, {
    scope,
    userId,
    limit: 60,
    windowMs: 60_000
  });
  if (limited) return { response: limited };
  return { userId };
}

function respondToError(error, route, locale) {
  if (error instanceof ServiceLogDisabledError || error instanceof ServiceLogError) {
    return errorJson(error.messageKey, error.status, locale);
  }
  console.error(...safeError(`[${route}] unexpected`, error));
  return errorJson("api.common.server_error", 500, locale);
}

export async function GET(req) {
  const { response, userId } = await guard(req, "service_referrals_get");
  if (response) return response;

  try {
    const url = new URL(req.url);
    const referrals = await listReferrals(userId, {
      month: url.searchParams.get("month"),
      status: url.searchParams.get("status"),
      clientUserId: url.searchParams.get("clientUserId"),
      clientDisplayName: url.searchParams.get("clientDisplayName")
    });
    return json({ referrals });
  } catch (error) {
    return respondToError(error, "service-referrals GET", localeFromRequest(req));
  }
}

export async function POST(req) {
  const { response, userId } = await guard(req, "service_referrals_post");
  if (response) return response;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return errorJson("service_log.errors.invalid_input", 400, localeFromRequest(req));
    }
    return json({ referral: await createReferral(userId, body) }, 201);
  } catch (error) {
    return respondToError(error, "service-referrals POST", localeFromRequest(req));
  }
}
