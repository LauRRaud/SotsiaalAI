import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { isAdmin, roleFromSession } from "@/lib/authz";
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import {
  getServiceProviderProfileForOwner,
  serializeServiceProviderProfile,
  upsertServiceProviderProfileForOwner
} from "@/lib/serviceProviderProfiles";
import { safeError } from "@/lib/privacy/safeError";
import {
  consumeServiceProviderProfileRateLimit,
  normalizeIdempotencyKey,
  serviceProviderCorrelationId,
  serviceProviderProfileErrorDescriptor
} from "@/lib/serviceProviderProfileBoundary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function requireServiceProviderProfileUser() {
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

  return {
    ok: true,
    session,
    userId,
    role,
    isAdmin: isAdmin(session.user)
  };
}

export async function GET(request) {
  const locale = localeFromRequest(request);
  const correlationId = serviceProviderCorrelationId(request);
  const auth = await requireServiceProviderProfileUser();
  if (!auth.ok) {
    return errorJson(auth.message, auth.status, locale);
  }

  try {
    const limit = await consumeServiceProviderProfileRateLimit({ operation: "profile:read", userId: auth.userId });
    if (!limit.allowed) {
      return errorJson("api.common.rate_limited", 429, locale, {
        retryAfterSeconds: limit.retryAfterSeconds
      }, {
        "Retry-After": String(limit.retryAfterSeconds),
        "X-Correlation-ID": correlationId
      });
    }
    const profile = await getServiceProviderProfileForOwner(auth.userId);
    return json({
      ok: true,
      profile: serializeServiceProviderProfile(profile, { includeAvailabilityOperations: true }),
      canManageServiceProfile: true
    });
  } catch (error) {
    console.error("[service-provider-profile] load failed", { correlationId, error: safeError(error) });
    return errorJson("service_provider_profile.errors.load_failed", 500, locale, { correlationId }, {
      "X-Correlation-ID": correlationId
    });
  }
}

export async function PUT(request) {
  const locale = localeFromRequest(request);
  const correlationId = serviceProviderCorrelationId(request);
  const auth = await requireServiceProviderProfileUser();
  if (!auth.ok) {
    return errorJson(auth.message, auth.status, locale);
  }

  try {
    const idempotencyKey = normalizeIdempotencyKey(request.headers.get("Idempotency-Key"));
    const limit = await consumeServiceProviderProfileRateLimit({ operation: "profile:write", userId: auth.userId });
    if (!limit.allowed) {
      return errorJson("api.common.rate_limited", 429, locale, {
        retryAfterSeconds: limit.retryAfterSeconds
      }, {
        "Retry-After": String(limit.retryAfterSeconds),
        "X-Correlation-ID": correlationId
      });
    }
    const body = await request.json().catch(() => ({}));
    const profile = await upsertServiceProviderProfileForOwner(auth.userId, body, {
      actorUserId: auth.userId,
      correlationId,
      idempotencyKey
    });
    return json({
      ok: true,
      profile: serializeServiceProviderProfile(profile, { includeAvailabilityOperations: true })
    });
  } catch (error) {
    const descriptor = serviceProviderProfileErrorDescriptor(
      error,
      "service_provider_profile.errors.save_failed",
      correlationId
    );
    if (descriptor.status >= 500) {
      console.error("[service-provider-profile] save failed", { correlationId, error: safeError(error) });
    }
    return errorJson(descriptor.messageKey, descriptor.status, locale, descriptor.extras, {
      "X-Correlation-ID": correlationId
    });
  }
}
