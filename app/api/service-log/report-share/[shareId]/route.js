/**
 * TEENUSPÄEVIK — jagamise tagasivõtmine (E10a).
 *
 * DELETE EI KUSTUTA RIDA. „Ma ei saatnud seda kunagi" ja „ma võtsin selle
 * tagasi" on kaks eri asja ja auditijälg peab neid eristama — rida jääb alles
 * `RECALLED` seisus ja kaob ainult saaja loendist.
 */
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { safeError } from "@/lib/privacy/safeError";
import { guardServiceLogRequest } from "@/lib/serviceLog/access";
import { ServiceLogError } from "@/lib/serviceLog/errors";
import { ServiceLogDisabledError, isServiceLogEnabled } from "@/lib/serviceLog/flags";
import { recallShare } from "@/lib/serviceLog/reportShare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function DELETE(req, context) {
  if (!isServiceLogEnabled()) return errorJson("service_log.errors.not_found", 404, localeFromRequest(req));
  const { response, userId, locale } = await guardServiceLogRequest(req, {
    scope: "service_log_report_share_recall",
    limit: 30
  });
  if (response) return response;

  try {
    const params = await context?.params;
    const result = await recallShare(String(params?.shareId || "").trim(), { ownerUserId: userId });
    return json({ share: result });
  } catch (error) {
    if (error instanceof ServiceLogDisabledError || error instanceof ServiceLogError) {
      return errorJson(error.messageKey, error.status, locale);
    }
    console.error("[service-log report-share recall] unexpected", safeError(error));
    return errorJson("api.common.server_error", 500, locale);
  }
}
