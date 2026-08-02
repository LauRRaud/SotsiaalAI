/**
 * TEENUSPÄEVIK-V1 E4 — kuuvaate API.
 *
 * Üks vastus kannab koondi, suunamiste jäägid JA rütmi. Kolm eraldi päringut
 * tähendaks kolme kohta, kus vaade võib jääda poolikuks — ja kuu lõpp on
 * täpselt see hetk, mil poolik pilt maksab raha.
 */
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { roleFromSession } from "@/lib/authz";
import { errorJson, json } from "@/lib/documents/server";
import { enforceChatRateLimit } from "@/lib/chat-api-rate-limit";
import { safeError } from "@/lib/privacy/safeError";
import { getMonthlyReport } from "@/lib/serviceLog/monthReport";
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
    scope: "service_log_month",
    userId,
    limit: 60,
    windowMs: 60_000
  });
  if (limited) return limited;

  try {
    const url = new URL(req.url);
    const report = await getMonthlyReport(userId, { month: url.searchParams.get("month") });
    return json({ report });
  } catch (error) {
    if (error instanceof ServiceLogDisabledError || error instanceof ServiceLogError) {
      return errorJson(error.messageKey, error.status);
    }
    console.error(...safeError("[service-log month] unexpected", error));
    return errorJson("api.common.server_error", 500);
  }
}
