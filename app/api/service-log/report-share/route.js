/**
 * TEENUSPÄEVIK — kuuaruande jagamine juhile (E10a).
 *
 * GET  = kellele ma saan saata + mida ma olen saatnud.
 * POST = saada.
 *
 * MÕLEMAD ON OMANIKU RAJAD. Juhi pool elab org-marsruudil, sest tema õigus
 * tuleb liikmesusest, mitte teenuseprofiilist — ja kahe eri õiguse segamine ühe
 * marsruudi sisse on täpselt see koht, kus üks neist ükskord teise ära sööb.
 */
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { safeError } from "@/lib/privacy/safeError";
import { guardServiceLogRequest } from "@/lib/serviceLog/access";
import { ServiceLogError } from "@/lib/serviceLog/errors";
import { ServiceLogDisabledError, isServiceLogEnabled } from "@/lib/serviceLog/flags";
import { listOwnShares, listShareRecipients, shareMonthlyReport } from "@/lib/serviceLog/reportShare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req) {
  // Värav enne autentimist — suletud pind on eristamatu olematust marsruudist.
  if (!isServiceLogEnabled()) return errorJson("service_log.errors.not_found", 404, localeFromRequest(req));
  const { response, userId, locale } = await guardServiceLogRequest(req, {
    scope: "service_log_report_share_list",
    limit: 60
  });
  if (response) return response;

  try {
    const month = new URL(req.url).searchParams.get("month");
    const [recipients, shares] = await Promise.all([
      listShareRecipients(userId),
      listOwnShares(userId, { month: month || null })
    ]);
    return json({ recipients, shares });
  } catch (error) {
    if (error instanceof ServiceLogDisabledError || error instanceof ServiceLogError) {
      return errorJson(error.messageKey, error.status, locale);
    }
    console.error("[service-log report-share list] unexpected", safeError(error));
    return errorJson("api.common.server_error", 500, locale);
  }
}

export async function POST(req) {
  if (!isServiceLogEnabled()) return errorJson("service_log.errors.not_found", 404, localeFromRequest(req));
  const { response, userId, locale } = await guardServiceLogRequest(req, {
    scope: "service_log_report_share_send",
    limit: 20
  });
  if (response) return response;

  try {
    const body = await req.json().catch(() => ({}));
    const result = await shareMonthlyReport({
      ownerUserId: userId,
      documentId: body?.documentId,
      recipientMembershipId: body?.recipientMembershipId,
      note: body?.note
    });
    return json({ share: { id: result.id, month: result.month } }, 201);
  } catch (error) {
    if (error instanceof ServiceLogDisabledError || error instanceof ServiceLogError) {
      return errorJson(error.messageKey, error.status, locale);
    }
    console.error("[service-log report-share send] unexpected", safeError(error));
    return errorJson("api.common.server_error", 500, locale);
  }
}
