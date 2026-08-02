/**
 * TEENUSPÄEVIK E2c — külastuse olekuüleminek.
 *
 * ÜKS MARSRUUT KÕIGILE ÜLEMINEKUTELE. Eraldi `/arrive`, `/complete`, `/cancel`
 * tähendaks, et lubatud üleminekute reeglistik oleks laiali marsruutide vahel
 * ja üks neist jääks ükskord uuendamata. Reegel elab olekumasinas, marsruut
 * ainult edastab.
 *
 * `at` TULEB KLIENDILT ja see on TAHTLIK: nupu vajutamise hetk on see, mis
 * juhtus, mitte serverini jõudmise hetk. Võrguta järjekorras oodanud vajutus
 * peab kandma oma õiget aega. Olekumasin kontrollib, et templid jäävad
 * kasvavaks, seega vale aeg ei pääse läbi vaikselt.
 */
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { safeError } from "@/lib/privacy/safeError";
import { guardServiceLogRequest } from "@/lib/serviceLog/access";
import { buildEntryDraftFromVisit, transitionVisit } from "@/lib/serviceLog/dayRoute";
import { ServiceLogError } from "@/lib/serviceLog/errors";
import { ServiceLogDisabledError, isServiceLogDayRouteEnabled } from "@/lib/serviceLog/flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function routeId(context) {
  const params = await context?.params;
  return String(params?.id || "").trim();
}

export async function PATCH(req, context) {
  if (!isServiceLogDayRouteEnabled()) {
    return errorJson("service_log.errors.not_found", 404, localeFromRequest(req));
  }
  const { response, userId, locale } = await guardServiceLogRequest(req, {
    scope: "service_visits_transition",
    limit: 240
  });
  if (response) return response;

  try {
    const body = await req.json().catch(() => ({}));
    const visit = await transitionVisit(userId, await routeId(context), body?.action, {
      at: body?.at || null,
      reason: body?.reason || null,
      locationPoint: body?.locationPoint || null
    });
    return json({ visit });
  } catch (error) {
    if (error instanceof ServiceLogDisabledError || error instanceof ServiceLogError) {
      return errorJson(error.messageKey, error.status, locale);
    }
    console.error("[service-visits transition] unexpected", safeError(error));
    return errorJson("api.common.server_error", 500, locale);
  }
}

/**
 * Teenuskirje EELTÄIDE lõpetatud külastusest. KIRJET EI LOODA — külastus ei ole
 * alati arveldatav teenus ja arve alusdokument ei tohi tekkida ilma inimese
 * kinnituseta (sama reegel mis Välitöö sillal).
 */
export async function GET(req, context) {
  if (!isServiceLogDayRouteEnabled()) {
    return errorJson("service_log.errors.not_found", 404, localeFromRequest(req));
  }
  const { response, userId, locale } = await guardServiceLogRequest(req, {
    scope: "service_visits_draft",
    limit: 120
  });
  if (response) return response;

  try {
    return json({ draft: await buildEntryDraftFromVisit(userId, await routeId(context)) });
  } catch (error) {
    if (error instanceof ServiceLogDisabledError || error instanceof ServiceLogError) {
      return errorJson(error.messageKey, error.status, locale);
    }
    console.error("[service-visits draft] unexpected", safeError(error));
    return errorJson("api.common.server_error", 500, locale);
  }
}
