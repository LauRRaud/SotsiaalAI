/**
 * TEENUSPÄEVIK-V1 E5 — kuunarratiivide API.
 *
 * `?seed=1` tagastab LÄHTEKOONDI (perioodi faktid, tegevused,
 * päritolumärgistatud märkmed, suunamise eesmärgid) — mitte teksti. Teksti
 * kirjutab inimene; koond on aus lähtepunkt, mis midagi juurde ei leiuta.
 */
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { roleFromSession } from "@/lib/authz";
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { enforceChatRateLimit } from "@/lib/chat-api-rate-limit";
import { safeError } from "@/lib/privacy/safeError";
import { getNarrativeSeed, listNarratives, upsertNarrative } from "@/lib/serviceLog/narratives";
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
  const limited = enforceChatRateLimit(req, { scope, userId, limit: 60, windowMs: 60_000 });
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
  const { response, userId } = await guard(req, "service_narratives_get");
  if (response) return response;

  try {
    const url = new URL(req.url);
    if (url.searchParams.get("seed") === "1") {
      const seed = await getNarrativeSeed(userId, {
        referralId: url.searchParams.get("referralId"),
        clientUserId: url.searchParams.get("clientUserId"),
        clientDisplayName: url.searchParams.get("clientDisplayName"),
        periodYear: url.searchParams.get("periodYear"),
        periodMonth: url.searchParams.get("periodMonth")
      });
      return json({ seed });
    }

    const narratives = await listNarratives(userId, {
      periodYear: url.searchParams.get("periodYear"),
      periodMonth: url.searchParams.get("periodMonth")
    });
    return json({ narratives });
  } catch (error) {
    return respondToError(error, "service-narratives GET", localeFromRequest(req));
  }
}

export async function PUT(req) {
  const { response, userId } = await guard(req, "service_narratives_put");
  if (response) return response;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return errorJson("service_log.errors.invalid_input", 400, localeFromRequest(req));
    }
    /* PUT, mitte POST: narratiiv on kuu kohta ÜKS ja korduv salvestamine peab
       andma sama tulemuse. Kirjutaja naaseb teksti juurde mitu korda. */
    return json({ narrative: await upsertNarrative(userId, body) });
  } catch (error) {
    return respondToError(error, "service-narratives PUT", localeFromRequest(req));
  }
}
