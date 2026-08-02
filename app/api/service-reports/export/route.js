/**
 * TEENUSPÄEVIK-V1 E6 — ekspordi API.
 *
 * Periood + saaja + mall → fail. See marsruut lunastab DoD punktid 2 ja 3:
 * kuu lõpus sünnib esitis juba sisestatud kirjetest ja mitut KOV-i teenindav
 * osutaja saab igaühele TEMA read.
 */
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { roleFromSession } from "@/lib/authz";
import { errorJson } from "@/lib/documents/server";
import { enforceChatRateLimit } from "@/lib/chat-api-rate-limit";
import { safeError } from "@/lib/privacy/safeError";
import { buildServiceLogExport, exportFileName, exportToCsv } from "@/lib/serviceLog/exportService";
import { ServiceLogError } from "@/lib/serviceLog/errors";
import { ServiceLogDisabledError, isServiceLogEnabled } from "@/lib/serviceLog/flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req) {
  // Värav enne autentimist — suletud pind on eristamatu olematust marsruudist.
  if (!isServiceLogEnabled()) return errorJson("service_log.errors.not_found", 404);

  const session = await getServerSession(authConfig).catch(() => null);
  const userId = session?.user?.id ? String(session.user.id) : "";
  if (!userId) return errorJson("api.common.unauthorized", 401);
  if (roleFromSession(session) !== "SERVICE_PROVIDER") {
    return errorJson("api.common.forbidden", 403);
  }

  const limited = enforceChatRateLimit(req, {
    scope: "service_reports_export",
    userId,
    limit: 30,
    windowMs: 60_000
  });
  if (limited) return limited;

  try {
    const url = new URL(req.url);
    const month = url.searchParams.get("month");
    const template = url.searchParams.get("template");
    const kovName = url.searchParams.get("kovName");

    const { document } = await buildServiceLogExport(userId, {
      month,
      template,
      kovName,
      referralId: url.searchParams.get("referralId"),
      variant: url.searchParams.get("variant") || undefined,
      includeDrafts: url.searchParams.get("includeDrafts") === "1",
      includeClientConfirmation: url.searchParams.get("clientConfirmation") === "1",
      includeTravelTime: url.searchParams.get("travelTime") === "1"
    });

    const csv = exportToCsv(document);
    const fileName = exportFileName({ month, template, kovName });

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        /* Eksport on isikuandmetega fail — vahemällu teda ei panda. */
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    if (error instanceof ServiceLogDisabledError || error instanceof ServiceLogError) {
      return errorJson(error.messageKey, error.status);
    }
    console.error(...safeError("[service-reports export] unexpected", error));
    return errorJson("api.common.server_error", 500);
  }
}
