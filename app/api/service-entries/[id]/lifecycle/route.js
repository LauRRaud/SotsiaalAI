/**
 * TEENUSPÄEVIK-V1 E2 — kirje elutsükkel: kinnitamine ja tühistamine.
 *
 * ERALDI MARSRUUT, MITTE PATCH-i väli. Kinnitamine ja tühistamine ei ole
 * „veel üks välja muutmine": kinnitamine tekitab kirjendamise hetke, millest
 * hakkab jooksma säilitustähtaeg, ja tühistamine võtab rea aruandest välja.
 * Eraldi uks teeb need toimingud logis, testis ja õiguste ülevaatuses
 * nähtavaks — PATCH-i sees kaoksid nad ülejäänud väljade sekka.
 */
import { errorJson, json } from "@/lib/documents/server";
import { safeError } from "@/lib/privacy/safeError";
import { guardServiceLogRequest } from "@/lib/serviceLog/access";
import { finalizeEntry, setManualConfirmation, voidEntry } from "@/lib/serviceLog/entries";
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

export async function POST(req, context) {
  const { response, userId, locale } = await guardServiceLogRequest(req, {
    scope: "service_entries_lifecycle",
    limit: 60
  });
  if (response) return response;

  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => null);
    const action = String(body?.action || "").toLowerCase();

    if (action === "finalize") {
      return json({ entry: await finalizeEntry(userId, String(id)) });
    }
    /* KÄSITSI KINNITUS (E7) — VÄLINE klient, kes kirjutas paberile alla.
       Platvormi kliendi digikinnitus käib oma teed (`/api/service-log/client`)
       ja seda EI TOHI siit teha: osutaja ei tohi kliendi nimel kinnitada. */
    if (action === "confirm_manual" || action === "unconfirm_manual") {
      return json({
        entry: await setManualConfirmation(userId, String(id), {
          confirmed: action === "confirm_manual"
        })
      });
    }

    if (action === "void") {
      /* Tühistamise põhjus on kohustuslik ja seda kontrollib teenuskiht —
         siin ei dubleerita valideerimist, et kaks reeglit ei saaks lahkneda. */
      return json({ entry: await voidEntry(userId, String(id), { reason: body?.reason }) });
    }
    return errorJson("service_log.errors.invalid_input", 400, locale);
  } catch (error) {
    if (error instanceof ServiceLogDisabledError || error instanceof ServiceLogError) {
      return errorJson(error.messageKey, error.status, locale, error.details || {});
    }
    console.error("[service-entries lifecycle] unexpected", safeError(error));
    return errorJson("api.common.server_error", 500, locale);
  }
}
