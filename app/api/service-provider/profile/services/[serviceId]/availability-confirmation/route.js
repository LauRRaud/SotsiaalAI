import { getServerSession } from "next-auth";

import { authConfig } from "@/auth";
import { isAdmin, roleFromSession } from "@/lib/authz";
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import {
  confirmServiceAvailabilityForOwner,
  serializeServiceProviderProfile
} from "@/lib/serviceProviderProfiles";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request, { params }) {
  const locale = localeFromRequest(request);
  const session = await getServerSession(authConfig).catch(() => null);
  const ownerId = session?.user?.id ? String(session.user.id) : "";
  if (!ownerId) return errorJson("api.common.unauthorized", 401, locale);
  if (!isAdmin(session.user) && roleFromSession(session) !== "SERVICE_PROVIDER") {
    return errorJson("api.common.forbidden", 403, locale);
  }

  try {
    const { serviceId } = await params;
    const body = await request.json().catch(() => ({}));
    const profile = await confirmServiceAvailabilityForOwner(ownerId, serviceId, body?.fingerprint);
    return json({
      ok: true,
      profile: serializeServiceProviderProfile(profile, { includeAvailabilityOperations: true })
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("[service-availability] confirmation failed", safeError(error));
    return errorJson(error?.message || "service_provider_profile.errors.availability_confirmation_failed", status, locale);
  }
}
