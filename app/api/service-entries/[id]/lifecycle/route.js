/**
 * TEENUSPÄEVIK-V1 E2 — kirje elutsükkel: kinnitamine ja tühistamine.
 *
 * ERALDI MARSRUUT, MITTE PATCH-i väli. Kinnitamine ja tühistamine ei ole
 * „veel üks välja muutmine": kinnitamine tekitab kirjendamise hetke, millest
 * hakkab jooksma säilitustähtaeg, ja tühistamine võtab rea aruandest välja.
 * Eraldi uks teeb need toimingud logis, testis ja õiguste ülevaatuses
 * nähtavaks — PATCH-i sees kaoksid nad ülejäänud väljade sekka.
 */
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { roleFromSession } from "@/lib/authz";
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { enforceChatRateLimit } from "@/lib/chat-api-rate-limit";
import { safeError } from "@/lib/privacy/safeError";
import { finalizeEntry, voidEntry } from "@/lib/serviceLog/entries";
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

export async function POST(req, context) {
  // Värav enne autentimist — suletud pind on eristamatu olematust marsruudist.
  if (!isServiceLogEnabled()) return errorJson("service_log.errors.not_found", 404, localeFromRequest(req));

  const session = await getServerSession(authConfig).catch(() => null);
  const userId = session?.user?.id ? String(session.user.id) : "";
  if (!userId) return errorJson("api.common.unauthorized", 401, localeFromRequest(req));
  if (roleFromSession(session) !== "SERVICE_PROVIDER") {
    return errorJson("api.common.forbidden", 403, localeFromRequest(req));
  }

  const limited = enforceChatRateLimit(req, {
    scope: "service_entries_lifecycle",
    userId,
    limit: 60,
    windowMs: 60_000
  });
  if (limited) return limited;

  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => null);
    const action = String(body?.action || "").toLowerCase();

    if (action === "finalize") {
      return json({ entry: await finalizeEntry(userId, String(id)) });
    }
    if (action === "void") {
      /* Tühistamise põhjus on kohustuslik ja seda kontrollib teenuskiht —
         siin ei dubleerita valideerimist, et kaks reeglit ei saaks lahkneda. */
      return json({ entry: await voidEntry(userId, String(id), { reason: body?.reason }) });
    }
    return errorJson("service_log.errors.invalid_input", 400, localeFromRequest(req));
  } catch (error) {
    if (error instanceof ServiceLogDisabledError || error instanceof ServiceLogError) {
      return errorJson(error.messageKey, error.status, localeFromRequest(req));
    }
    console.error(...safeError("[service-entries lifecycle] unexpected", error));
    return errorJson("api.common.server_error", 500, localeFromRequest(req));
  }
}
