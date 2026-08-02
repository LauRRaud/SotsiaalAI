/**
 * TEENUSPÄEVIK-V1 E3 — üksik suunamine: jääk, muutmine, lõpetamine.
 *
 * DELETE-i EI OLE. Suunamise kustutamine kaotaks aluse kirjetelt, mis on juba
 * esitatud arve alus — lõpetamine (`PATCH { action: "end" }`) jätab kirjed
 * alles ja sulgeb ainult uue mahu kirjutamise.
 */
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { roleFromSession } from "@/lib/authz";
import { errorJson, json } from "@/lib/documents/server";
import { enforceChatRateLimit } from "@/lib/chat-api-rate-limit";
import { safeError } from "@/lib/privacy/safeError";
import { endReferral, getReferralBalance, updateReferral } from "@/lib/serviceLog/referrals";
import { ServiceLogError } from "@/lib/serviceLog/errors";
import { ServiceLogDisabledError, isServiceLogEnabled } from "@/lib/serviceLog/flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function guard(req, scope) {
  if (!isServiceLogEnabled()) {
    return { response: errorJson("service_log.errors.not_found", 404) };
  }
  const session = await getServerSession(authConfig).catch(() => null);
  const userId = session?.user?.id ? String(session.user.id) : "";
  if (!userId) return { response: errorJson("api.common.unauthorized", 401) };
  if (roleFromSession(session) !== "SERVICE_PROVIDER") {
    return { response: errorJson("api.common.forbidden", 403) };
  }
  const limited = enforceChatRateLimit(req, { scope, userId, limit: 60, windowMs: 60_000 });
  if (limited) return { response: limited };
  return { userId };
}

function respondToError(error, route) {
  if (error instanceof ServiceLogDisabledError || error instanceof ServiceLogError) {
    return errorJson(error.messageKey, error.status);
  }
  console.error(...safeError(`[${route}] unexpected`, error));
  return errorJson("api.common.server_error", 500);
}

export async function GET(req, context) {
  const { response, userId } = await guard(req, "service_referrals_balance");
  if (response) return response;

  try {
    const { id } = await context.params;
    const url = new URL(req.url);
    const balance = await getReferralBalance(userId, String(id), {
      month: url.searchParams.get("month")
    });
    return json({ balance });
  } catch (error) {
    return respondToError(error, "service-referrals balance");
  }
}

export async function PATCH(req, context) {
  const { response, userId } = await guard(req, "service_referrals_patch");
  if (response) return response;

  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return errorJson("service_log.errors.invalid_input", 400);
    }
    if (String(body.action || "").toLowerCase() === "end") {
      return json({ referral: await endReferral(userId, String(id)) });
    }
    return json({ referral: await updateReferral(userId, String(id), body) });
  } catch (error) {
    return respondToError(error, "service-referrals PATCH");
  }
}
