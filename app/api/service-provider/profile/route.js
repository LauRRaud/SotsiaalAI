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
  const auth = await requireServiceProviderProfileUser();
  if (!auth.ok) {
    return errorJson(auth.message, auth.status, locale);
  }

  try {
    const profile = await getServiceProviderProfileForOwner(auth.userId);
    return json({
      ok: true,
      profile: serializeServiceProviderProfile(profile),
      canManageServiceProfile: true
    });
  } catch (error) {
    console.error("[service-provider-profile] load failed", safeError(error));
    return errorJson("service_provider_profile.errors.load_failed", 500, locale);
  }
}

export async function PUT(request) {
  const locale = localeFromRequest(request);
  const auth = await requireServiceProviderProfileUser();
  if (!auth.ok) {
    return errorJson(auth.message, auth.status, locale);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const profile = await upsertServiceProviderProfileForOwner(auth.userId, body);
    return json({
      ok: true,
      profile: serializeServiceProviderProfile(profile)
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) {
      console.error("[service-provider-profile] save failed", safeError(error));
    }
    return errorJson(
      error?.message || "service_provider_profile.errors.save_failed",
      status,
      locale
    );
  }
}
