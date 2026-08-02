/**
 * TEENUSPÄEVIK E2c — tööpäeva enda toimingud (algus, paus, lõpp).
 *
 * ERALDI KÜLASTUSTEST, sest need EI OLE külastuse omadused: paus käib kahe
 * kliendi vahel ja tööpäeva lõpp ei kuulu ühelegi kliendile. Nende
 * paigutamine külastuse marsruudile tähendaks, et pausi saab võtta ainult
 * siis, kui mõni külastus on olemas.
 */
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { safeError } from "@/lib/privacy/safeError";
import { guardServiceLogRequest } from "@/lib/serviceLog/access";
import { applyOrder, closeRoute, openRoute, setBreak } from "@/lib/serviceLog/dayRoute";
import { ServiceLogError } from "@/lib/serviceLog/errors";
import { ServiceLogDisabledError, isServiceLogDayRouteEnabled } from "@/lib/serviceLog/flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ACTIONS = new Set(["start", "break_start", "break_end", "end", "apply_order"]);

export async function POST(req) {
  if (!isServiceLogDayRouteEnabled()) {
    return errorJson("service_log.errors.not_found", 404, localeFromRequest(req));
  }
  const { response, userId, locale } = await guardServiceLogRequest(req, {
    scope: "service_visits_route",
    limit: 60
  });
  if (response) return response;

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    /* Tundmatu toiming on 400, mitte vaikne ei-midagi: „vajutasin, ei juhtunud
       midagi" on halvim võimalik vastus tööpäeva lõpetamise nupule. */
    if (!ACTIONS.has(action)) return errorJson("service_log.errors.invalid_input", 400, locale);

    if (action === "start") return json({ route: await openRoute(userId, {}) });
    if (action === "break_start") return json({ route: await setBreak(userId, { on: true }) });
    if (action === "break_end") return json({ route: await setBreak(userId, { on: false }) });
    /* Järjestuse rakendamine on TEEKONNA toiming, mitte ühe külastuse oma:
       ta puudutab korraga kõiki ja peab olema üks tehing. */
    if (action === "apply_order") return json({ result: await applyOrder(userId, body?.visitIds) });
    return json({ route: await closeRoute(userId, {}) });
  } catch (error) {
    if (error instanceof ServiceLogDisabledError || error instanceof ServiceLogError) {
      return errorJson(error.messageKey, error.status, locale);
    }
    console.error("[service-visits route] unexpected", safeError(error));
    return errorJson("api.common.server_error", 500, locale);
  }
}
