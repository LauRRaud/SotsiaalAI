/**
 * TEENUSPÄEVIK E2c — päevateekonna API.
 *
 * GET  = tänane teekond (tööpäev + külastused + koond + kontrollivajadus).
 * POST = uus külastus teekonnale.
 *
 * ÜKS VASTUS KANNAB TERVET PÄEVA. Kolm eraldi päringut tähendaks kolme kohta,
 * kus vaade võib jääda poolikuks — ja pooleliolev külastus on täpselt see asi,
 * mille poolik pilt maksab töötajale valesti mõõdetud sõiduaja.
 */
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { safeError } from "@/lib/privacy/safeError";
import { guardServiceLogRequest } from "@/lib/serviceLog/access";
import { createVisit, getDayRoute } from "@/lib/serviceLog/dayRoute";
import { ServiceLogError } from "@/lib/serviceLog/errors";
import { ServiceLogDisabledError, isServiceLogDayRouteEnabled } from "@/lib/serviceLog/flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* VÄRAV ENNE AUTENTIMIST. Suletud pind peab olema eristamatu olematust
   marsruudist: 401 ütleks, et siin on midagi, mille jaoks tasub konto teha. */
function gate(req) {
  if (isServiceLogDayRouteEnabled()) return null;
  return errorJson("service_log.errors.not_found", 404, localeFromRequest(req));
}

export async function GET(req) {
  const closed = gate(req);
  if (closed) return closed;

  const { response, userId, locale } = await guardServiceLogRequest(req, {
    scope: "service_visits_day",
    limit: 120
  });
  if (response) return response;

  try {
    const date = new URL(req.url).searchParams.get("date");
    return json({ day: await getDayRoute(userId, { date }) });
  } catch (error) {
    if (error instanceof ServiceLogDisabledError || error instanceof ServiceLogError) {
      return errorJson(error.messageKey, error.status, locale);
    }
    console.error("[service-visits day] unexpected", safeError(error));
    return errorJson("api.common.server_error", 500, locale);
  }
}

export async function POST(req) {
  const closed = gate(req);
  if (closed) return closed;

  const { response, userId, locale } = await guardServiceLogRequest(req, {
    scope: "service_visits_create",
    limit: 120
  });
  if (response) return response;

  try {
    const body = await req.json().catch(() => ({}));
    const visit = await createVisit(userId, body);
    return json({ visit }, 201);
  } catch (error) {
    if (error instanceof ServiceLogDisabledError || error instanceof ServiceLogError) {
      return errorJson(error.messageKey, error.status, locale);
    }
    console.error("[service-visits create] unexpected", safeError(error));
    return errorJson("api.common.server_error", 500, locale);
  }
}
