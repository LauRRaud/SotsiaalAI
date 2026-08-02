/**
 * TEENUSPÄEVIK-V1 E3 — suunamiste API (loend koos jäägiga + loomine).
 *
 * Loend tagastab saldo KAASA (DoD punkt 4: jääk on alati nähtav). Eraldi
 * saldopäring tähendaks, et mõni vaade unustab ta küsida ja ületus jääb
 * märkamata just seal, kus ta maksab.
 */
import { errorJson, json } from "@/lib/documents/server";
import { safeError } from "@/lib/privacy/safeError";
import { guardServiceLogRequest } from "@/lib/serviceLog/access";
import { createReferral, listReferrals } from "@/lib/serviceLog/referrals";
import { ServiceLogError } from "@/lib/serviceLog/errors";
import { ServiceLogDisabledError } from "@/lib/serviceLog/flags";

/* VEATEATED KASUTAJA KEELES. `errorJson` lokaadi vaikeväärtus on "en" — ilma
   `localeFromRequest`-ita tuli eestikeelsele kasutajale ingliskeelne teade.
   Brauserikontroll näitas seda: kinnitamise tõrge kuvati kujul „The entry is
   already final." keset eestikeelset pinda. `i18n:check` ei püüa seda kinni,
   sest ta kontrollib võtmete PARITEETI, mitte kasutuskohta. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function respondToError(locale, error, route) {
  if (error instanceof ServiceLogDisabledError || error instanceof ServiceLogError) {
    return errorJson(error.messageKey, error.status, locale);
  }
  console.error(...safeError(`[${route}] unexpected`, error));
  return errorJson("api.common.server_error", 500, locale);
}

export async function GET(req) {
  const { response, userId, locale } = await guardServiceLogRequest(req, { scope: "service_referrals_get" });
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
    return respondToError(locale, error, "service-referrals GET");
  }
}

export async function POST(req) {
  const { response, userId, locale } = await guardServiceLogRequest(req, { scope: "service_referrals_post" });
  if (response) return response;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return errorJson("service_log.errors.invalid_input", 400, locale);
    }
    return json({ referral: await createReferral(userId, body) }, 201);
  } catch (error) {
    return respondToError(locale, error, "service-referrals POST");
  }
}
