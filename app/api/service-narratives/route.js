/**
 * TEENUSPÄEVIK-V1 E5 — kuunarratiivide API.
 *
 * `?seed=1` tagastab LÄHTEKOONDI (perioodi faktid, tegevused,
 * päritolumärgistatud märkmed, suunamise eesmärgid) — mitte teksti. Teksti
 * kirjutab inimene; koond on aus lähtepunkt, mis midagi juurde ei leiuta.
 */
import { errorJson, json } from "@/lib/documents/server";
import { safeError } from "@/lib/privacy/safeError";
import { guardServiceLogRequest } from "@/lib/serviceLog/access";
import { getNarrativeSeed, listNarratives, upsertNarrative } from "@/lib/serviceLog/narratives";
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
  console.error(`[${route}] unexpected`, safeError(error));
  return errorJson("api.common.server_error", 500, locale);
}

export async function GET(req) {
  const { response, userId, locale } = await guardServiceLogRequest(req, { scope: "service_narratives_get" });
  if (response) return response;

  try {
    const url = new URL(req.url);
    if (url.searchParams.get("seed") === "1") {
      const seed = await getNarrativeSeed(userId, {
        referralId: url.searchParams.get("referralId"),
        clientUserId: url.searchParams.get("clientUserId"),
        clientDisplayName: url.searchParams.get("clientDisplayName"),
        clientExternalRef: url.searchParams.get("clientExternalRef"),
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
    return respondToError(locale, error, "service-narratives GET");
  }
}

export async function PUT(req) {
  const { response, userId, locale } = await guardServiceLogRequest(req, { scope: "service_narratives_put" });
  if (response) return response;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return errorJson("service_log.errors.invalid_input", 400, locale);
    }
    /* PUT, mitte POST: narratiiv on kuu kohta ÜKS ja korduv salvestamine peab
       andma sama tulemuse. Kirjutaja naaseb teksti juurde mitu korda. */
    return json({ narrative: await upsertNarrative(userId, body) });
  } catch (error) {
    return respondToError(locale, error, "service-narratives PUT");
  }
}
