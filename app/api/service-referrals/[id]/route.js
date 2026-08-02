/**
 * TEENUSPÄEVIK-V1 E3 — üksik suunamine: jääk, muutmine, lõpetamine.
 *
 * DELETE-i EI OLE. Suunamise kustutamine kaotaks aluse kirjetelt, mis on juba
 * esitatud arve alus — lõpetamine (`PATCH { action: "end" }`) jätab kirjed
 * alles ja sulgeb ainult uue mahu kirjutamise.
 */
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { safeError } from "@/lib/privacy/safeError";
import { guardServiceLogRequest } from "@/lib/serviceLog/access";
import { endReferral, getReferralBalance, updateReferral } from "@/lib/serviceLog/referrals";
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

export async function GET(req, context) {
  const { response, userId, locale } = await guardServiceLogRequest(req, { scope: "service_referrals_balance" });
  if (response) return response;

  try {
    const { id } = await context.params;
    const url = new URL(req.url);
    const balance = await getReferralBalance(userId, String(id), {
      month: url.searchParams.get("month")
    });
    return json({ balance });
  } catch (error) {
    return respondToError(locale, error, "service-referrals balance", localeFromRequest(req));
  }
}

export async function PATCH(req, context) {
  const { response, userId, locale } = await guardServiceLogRequest(req, { scope: "service_referrals_patch" });
  if (response) return response;

  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return errorJson("service_log.errors.invalid_input", 400, locale);
    }
    if (String(body.action || "").toLowerCase() === "end") {
      return json({ referral: await endReferral(userId, String(id)) });
    }
    return json({ referral: await updateReferral(userId, String(id), body) });
  } catch (error) {
    return respondToError(locale, error, "service-referrals PATCH", localeFromRequest(req));
  }
}
