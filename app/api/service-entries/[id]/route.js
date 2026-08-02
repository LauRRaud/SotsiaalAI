/**
 * TEENUSPÄEVIK-V1 E2 — üksiku teenuskirje muutmine ja kustutamine.
 *
 * DELETE vastab 409-ga, kui säilitusaeg ei ole täis. See on AINUS koht selles
 * moodulis, kus vastus ei ole 404: kasutaja näeb kirjet ja tal on õigus teada,
 * miks ta seda kustutada ei saa (vt lib/serviceLog/errors.js).
 */
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { safeError } from "@/lib/privacy/safeError";
import { guardServiceLogRequest } from "@/lib/serviceLog/access";
import { deleteEntry, updateEntry } from "@/lib/serviceLog/entries";
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

const MUTATION_LIMIT = 60;

function respondToError(locale, error, route) {
  if (error instanceof ServiceLogDisabledError || error instanceof ServiceLogError) {
    return errorJson(error.messageKey, error.status, locale);
  }
  console.error(...safeError(`[${route}] unexpected`, error));
  return errorJson("api.common.server_error", 500, locale);
}

export async function PATCH(req, context) {
  const { response, userId, locale } = await guardServiceLogRequest(req, { scope: "service_entries_patch", limit: MUTATION_LIMIT });
  if (response) return response;

  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return errorJson("service_log.errors.invalid_input", 400, locale);
    }
    const entry = await updateEntry(userId, String(id), body);
    return json({ entry });
  } catch (error) {
    return respondToError(locale, error, "service-entries PATCH", localeFromRequest(req));
  }
}

export async function DELETE(req, context) {
  const { response, userId, locale } = await guardServiceLogRequest(req, { scope: "service_entries_delete", limit: MUTATION_LIMIT });
  if (response) return response;

  try {
    const { id } = await context.params;
    const result = await deleteEntry(userId, String(id));
    return json(result);
  } catch (error) {
    return respondToError(locale, error, "service-entries DELETE", localeFromRequest(req));
  }
}
