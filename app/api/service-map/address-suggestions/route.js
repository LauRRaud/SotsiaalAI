import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { isAdmin, roleFromSession } from "@/lib/authz";
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { suggestServiceMapAddresses } from "@/lib/serviceMap/geocoding";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function requireServiceMapAddressUser() {
  const session = await getServerSession(authConfig).catch(() => null);
  const userId = session?.user?.id ? String(session.user.id) : "";
  if (!userId) {
    return {
      ok: false,
      status: 401,
      message: "api.common.unauthorized"
    };
  }

  const role = roleFromSession(session);
  if (!isAdmin(session.user) && role !== "SERVICE_PROVIDER") {
    return {
      ok: false,
      status: 403,
      message: "api.common.forbidden"
    };
  }

  return { ok: true };
}

export async function GET(request) {
  const locale = localeFromRequest(request);
  const auth = await requireServiceMapAddressUser();
  if (!auth.ok) {
    return errorJson(auth.message, auth.status, locale);
  }

  const requestUrl = new URL(request.url);
  const query = String(requestUrl.searchParams.get("query") || "").trim();
  if (query.length < 2) {
    return json({
      ok: true,
      suggestions: [],
      reason: "query_too_short"
    });
  }

  try {
    const result = await suggestServiceMapAddresses(query, {
      provider: process.env.SERVICE_MAP_GEOCODER_PROVIDER || process.env.GEOCODER_PROVIDER || "maaruum",
      municipalityName: requestUrl.searchParams.get("municipalityName") || undefined,
      county: requestUrl.searchParams.get("county") || undefined,
      limit: requestUrl.searchParams.get("limit") || 8,
      timeoutMs: 3500
    });
    return json({
      ok: true,
      provider: result.provider,
      reason: result.reason,
      suggestions: result.suggestions || []
    });
  } catch (error) {
    console.error("[service-map-address-suggestions] failed", safeError(error));
    return errorJson("service_provider_profile.errors.address_suggestions_failed", 500, locale);
  }
}
