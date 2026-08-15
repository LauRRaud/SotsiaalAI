/**
 * TEENUSPÄEVIK E8 — aruandlusaja proovid ja baasjoon.
 *
 * GET annab kutsuja ENDA baasjoone. Võõra profiili
 * baasjoont ei saa küsida: skoop tuleb `requireWritableProfile`-ist, nagu kogu
 * ülejäänud teemas.
 *
 * Proove ei võeta vastu eraldi telemeetriapäringuga: sisestusaja tõend tekib
 * ainult teenuskirje eduka loomise serverirajal.
 */
import { errorJson, json } from "@/lib/documents/server";
import { safeError } from "@/lib/privacy/safeError";
import { guardServiceLogRequest } from "@/lib/serviceLog/access";
import { ServiceLogError } from "@/lib/serviceLog/errors";
import { ServiceLogDisabledError } from "@/lib/serviceLog/flags";
import { readBaseline } from "@/lib/serviceLog/timeSamples";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function respondToError(locale, error, route) {
  if (error instanceof ServiceLogDisabledError || error instanceof ServiceLogError) {
    return errorJson(error.messageKey, error.status, locale);
  }
  console.error(`[${route}] unexpected`, safeError(error));
  return errorJson("api.common.server_error", 500, locale);
}

export async function GET(req) {
  const { response, userId, locale } = await guardServiceLogRequest(req, {
    scope: "service_log_measure_get",
    limit: 60
  });
  if (response) return response;

  try {
    return json({ baseline: await readBaseline(userId) });
  } catch (error) {
    return respondToError(locale, error, "service-log measure GET");
  }
}
