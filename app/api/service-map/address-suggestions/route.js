import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { isAdmin, roleFromSession } from "@/lib/authz";
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { suggestServiceMapAddresses } from "@/lib/serviceMap/geocoding";
import { safeError } from "@/lib/privacy/safeError";
import { consumeHelpRateLimit } from "@/lib/help/rateLimit";
import { getRequestIpFromRequest } from "@/lib/request-ip";
import { signServiceMapSuggestion } from "@/lib/serviceMap/addressSuggestionToken";
import { SERVICE_PROFILE_LIMITS } from "@/lib/serviceProviderProfileLimits";

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

  return { ok: true, userId };
}

export async function GET(request) {
  const locale = localeFromRequest(request);
  const auth = await requireServiceMapAddressUser();
  if (!auth.ok) {
    return errorJson(auth.message, auth.status, locale);
  }

  const ipAddress = getRequestIpFromRequest(request);
  let requestLimit;
  try {
    requestLimit = await consumeHelpRateLimit({
      operation: "address-request",
      userId: auth.userId,
      ipAddress
    });
  } catch {
    return errorJson("HELP_RATE_LIMIT_UNAVAILABLE", 503, locale);
  }
  if (!requestLimit.allowed) {
    return json({
      ok: false,
      message: "api.common.rate_limited",
      retryAfterSeconds: requestLimit.retryAfterSeconds
    }, 429, { "Retry-After": String(requestLimit.retryAfterSeconds) });
  }

  const requestUrl = new URL(request.url);
  const query = String(requestUrl.searchParams.get("query") || "").trim();
  if (query.length > SERVICE_PROFILE_LIMITS.addressQuery) {
    return errorJson("service_provider_profile.errors.address_query_too_long", 413, locale, {
      details: { field: "query", maxLength: SERVICE_PROFILE_LIMITS.addressQuery }
    });
  }
  if (query.length < 2) {
    return json({
      ok: true,
      suggestions: [],
      reason: "query_too_short"
    });
  }

  let providerLimit;
  try {
    providerLimit = await consumeHelpRateLimit({
      operation: "address-provider",
      userId: auth.userId,
      ipAddress
    });
  } catch {
    return errorJson("HELP_RATE_LIMIT_UNAVAILABLE", 503, locale);
  }
  if (!providerLimit.allowed) {
    return json({
      ok: false,
      message: "api.common.rate_limited",
      retryAfterSeconds: providerLimit.retryAfterSeconds
    }, 429, { "Retry-After": String(providerLimit.retryAfterSeconds) });
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
      suggestions: (result.suggestions || []).map((suggestion) => ({
        ...suggestion,
        suggestionToken: signServiceMapSuggestion(suggestion, { userId: auth.userId })
      })).filter((suggestion) => suggestion.suggestionToken)
    });
  } catch (error) {
    console.error("[service-map-address-suggestions] failed", safeError(error));
    return errorJson("service_provider_profile.errors.address_suggestions_failed", 500, locale);
  }
}
