/**
 * TEENUSPÄEVIK E7 — kliendi enda kuuvaade ja kinnitus.
 *
 * OMA VÄRAV, MITTE `guardServiceLogRequest`. See marsruut on ainus terves
 * teemas, mille kutsub KLIENT, mitte osutaja — jagatud värav nõuab
 * `SERVICE_PROVIDER` rolli ja annaks siin igale kliendile 403. Reegel „üks
 * värav" kehtib osutaja pindadele; siin on teadlikult teine pind.
 *
 * ROLLI EI KONTROLLITA ÜLDSE. Skoop tuleb andmetest: `clientUserId = userId`.
 * Kui keegi ei ole ühegi kirje klient, saab ta tühja kuu — see on õige vastus,
 * mitte viga. Rollikontroll lisaks siia teise tõe allika ilma kasuta.
 */
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { safeError } from "@/lib/privacy/safeError";
import { enforceChatRateLimit } from "@/lib/chat-api-rate-limit";
import { confirmClientMonth, readClientMonth } from "@/lib/serviceLog/clientView";
import { ServiceLogError } from "@/lib/serviceLog/errors";
import { ServiceLogDisabledError, isServiceLogClientViewEnabled } from "@/lib/serviceLog/flags";

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

/**
 * Värav ENNE autentimist, nagu mujalgi: väljas lülitiga ei tohi anonüümne saada
 * 401 ja klient 200 — kaks eri vastust ütleksid, et pind on olemas.
 */
async function guard(req, scope) {
  const locale = localeFromRequest(req);
  if (!isServiceLogClientViewEnabled()) {
    return { response: errorJson("service_log.errors.not_found", 404, locale) };
  }
  const session = await getServerSession(authConfig).catch(() => null);
  const userId = session?.user?.id ? String(session.user.id) : "";
  if (!userId) return { response: errorJson("api.common.unauthorized", 401, locale) };

  const limited = enforceChatRateLimit(req, { scope, userId, limit: 60, windowMs: 60_000 });
  if (limited) return { response: limited };

  return { userId, locale };
}

export async function GET(req) {
  const { response, userId, locale } = await guard(req, "service_log_client_get");
  if (response) return response;

  try {
    const month = new URL(req.url).searchParams.get("month");
    return json({ report: await readClientMonth(userId, { month }) });
  } catch (error) {
    return respondToError(locale, error, "service-log client GET");
  }
}

export async function POST(req) {
  const { response, userId, locale } = await guard(req, "service_log_client_post");
  if (response) return response;

  try {
    const body = await req.json().catch(() => null);
    return json({
      result: await confirmClientMonth(userId, {
        month: body?.month,
        snapshotToken: body?.snapshotToken
      })
    });
  } catch (error) {
    return respondToError(locale, error, "service-log client POST");
  }
}
