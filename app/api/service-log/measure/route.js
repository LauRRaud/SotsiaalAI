/**
 * TEENUSPÄEVIK E8 — aruandlusaja proovid ja baasjoon.
 *
 * POST salvestab ühe proovi, GET annab kutsuja ENDA baasjoone. Võõra profiili
 * baasjoont ei saa küsida: skoop tuleb `requireWritableProfile`-ist, nagu kogu
 * ülejäänud teemas.
 *
 * POST VASTAB ALATI 202-ga. Proov on kõrvalsaadus — kui ta ei kõlvanud (liiga
 * pikk sessioon, tundmatu liik), ei ole see kasutaja viga ega midagi, mida ta
 * saaks parandada. Veateade siin tähendaks, et mõõdik segab tööd, mille kohta
 * ta peaks vaikselt statistikat koguma.
 */
import { errorJson, json } from "@/lib/documents/server";
import { safeError } from "@/lib/privacy/safeError";
import { guardServiceLogRequest } from "@/lib/serviceLog/access";
import { ServiceLogError } from "@/lib/serviceLog/errors";
import { ServiceLogDisabledError } from "@/lib/serviceLog/flags";
import { readBaseline, recordSample } from "@/lib/serviceLog/timeSamples";

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

export async function POST(req) {
  const { response, userId, locale } = await guardServiceLogRequest(req, {
    scope: "service_log_measure_post",
    limit: 120
  });
  if (response) return response;

  try {
    const body = await req.json().catch(() => null);
    const stored = await recordSample(userId, {
      kind: body?.kind,
      seconds: body?.seconds
    });
    return json({ stored }, 202);
  } catch (error) {
    return respondToError(locale, error, "service-log measure POST");
  }
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
