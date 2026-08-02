/**
 * TEENUSPÄEVIK-V1 E4 — kuuvaate API.
 *
 * Üks vastus kannab koondi, suunamiste jäägid JA rütmi. Kolm eraldi päringut
 * tähendaks kolme kohta, kus vaade võib jääda poolikuks — ja kuu lõpp on
 * täpselt see hetk, mil poolik pilt maksab raha.
 */
import { errorJson, json } from "@/lib/documents/server";
import { safeError } from "@/lib/privacy/safeError";
import { guardServiceLogRequest } from "@/lib/serviceLog/access";
import { getMonthlyReport } from "@/lib/serviceLog/monthReport";
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

export async function GET(req) {
  const { response, userId, locale } = await guardServiceLogRequest(req, {
    scope: "service_log_month",
    limit: 60
  });
  if (response) return response;

  try {
    const url = new URL(req.url);
    const report = await getMonthlyReport(userId, { month: url.searchParams.get("month") });
    return json({ report });
  } catch (error) {
    if (error instanceof ServiceLogDisabledError || error instanceof ServiceLogError) {
      return errorJson(error.messageKey, error.status, locale);
    }
    console.error(...safeError("[service-log month] unexpected", error));
    return errorJson("api.common.server_error", 500, locale);
  }
}
