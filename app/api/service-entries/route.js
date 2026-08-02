/**
 * TEENUSPÄEVIK-V1 E2 — teenuskirjete API (loend + loomine).
 *
 * VÄRAV ON ESIMENE SAMM. `assertServiceLogEnabled` viskab 404, mitte 403:
 * väljas väravaga ei tohi vastus paljastada, et selline pind olemas on.
 *
 * ROLLIPIIR ON KITSAS (leping 8.2): ainult `SERVICE_PROVIDER`. Platvormi
 * admin EI kirjuta kellegi teise arve alusdokumente — tema rada on
 * haldusvaadete lugemine, mitte sisestus.
 */
import { errorJson, json } from "@/lib/documents/server";
import { safeError } from "@/lib/privacy/safeError";
import { guardServiceLogRequest } from "@/lib/serviceLog/access";
import { createEntry, getEntryDefaults, listEntries } from "@/lib/serviceLog/entries";
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

const GET_LIMIT = 60;
const POST_LIMIT = 60;

/**
 * Väravaviga ja skoobiviga vastavad MÕLEMAD 404-ga, seega kutsuja ei saa
 * eristada „funktsiooni ei ole" ja „see kirje ei ole sinu oma".
 */
function respondToError(locale, error, route) {
  if (error instanceof ServiceLogDisabledError || error instanceof ServiceLogError) {
    return errorJson(error.messageKey, error.status, locale);
  }
  console.error(...safeError(`[${route}] unexpected`, error));
  return errorJson("api.common.server_error", 500, locale);
}

export async function GET(req) {
  const { response, userId, locale } = await guardServiceLogRequest(req, {
    scope: "service_entries_get",
    limit: GET_LIMIT
  });
  if (response) return response;

  try {
    const url = new URL(req.url);
    /* `?defaults=1` tagastab TULETAMISOTSUSE, mitte kirjed: UI küsib enne vormi
       näitamist, mida üldse küsida. Reeglid on serveri tõde, mitte kliendi
       oletus — muidu tekiks kaks eri „mida küsida" loogikat. */
    if (url.searchParams.get("defaults") === "1") {
      const defaults = await getEntryDefaults(userId, {
        clientUserId: url.searchParams.get("clientUserId"),
        clientDisplayName: url.searchParams.get("clientDisplayName")
      });
      return json({ defaults });
    }

    const entries = await listEntries(userId, {
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      clientUserId: url.searchParams.get("clientUserId"),
      clientDisplayName: url.searchParams.get("clientDisplayName"),
      take: url.searchParams.get("take")
    });
    return json({ entries });
  } catch (error) {
    return respondToError(locale, error, "service-entries GET", localeFromRequest(req));
  }
}

export async function POST(req) {
  const { response, userId, locale } = await guardServiceLogRequest(req, {
    scope: "service_entries_post",
    limit: POST_LIMIT
  });
  if (response) return response;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return errorJson("service_log.errors.invalid_input", 400, locale);
    }
    const entry = await createEntry(userId, body);
    return json({ entry }, 201);
  } catch (error) {
    return respondToError(locale, error, "service-entries POST", localeFromRequest(req));
  }
}
