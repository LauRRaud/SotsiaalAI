import { getServerSession } from "next-auth";

import { authConfig } from "@/auth";
import { assertAdmin } from "@/lib/authz";
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { safeError } from "@/lib/privacy/safeError";
import { isSameOriginRequest } from "@/lib/security/sameOriginRequest";
import {
  confirmRepresentationAsAdmin,
  listRepresentationAdminRows,
  revokeRepresentationAsAdmin
} from "@/lib/serviceProviderRepresentation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* Teenuseprofiili esindusõiguse kinnitus. AINULT haldur: kinnitus lubab profiili avaldada
   asutuse registrikoodi all, vale kinnitus laseb võõra nime all esineda. */
const ACTION_ERROR_KEYS = new Set([
  "api.common.not_found",
  "admin.service_representation.errors.basis_required",
  "admin.service_representation.errors.registry_code_changed"
]);

async function requireAdmin() {
  const session = await getServerSession(authConfig).catch(() => null);
  const authz = assertAdmin(session);
  if (!authz.ok) return authz;
  const userId = session?.user?.id ? String(session.user.id) : "";
  if (!userId) return { ok: false, status: 401, message: "api.common.unauthorized" };
  return { ok: true, userId };
}

export async function GET(request) {
  const locale = localeFromRequest(request);
  const authz = await requireAdmin();
  if (!authz.ok) return errorJson(authz.message, authz.status || 403, locale);
  try {
    return json({ ok: true, rows: await listRepresentationAdminRows() });
  } catch (error) {
    console.error("[admin/service-representation] load failed", safeError(error));
    return errorJson("admin.service_representation.errors.load_failed", 500, locale);
  }
}

export async function POST(request) {
  const locale = localeFromRequest(request);
  const authz = await requireAdmin();
  if (!authz.ok) return errorJson(authz.message, authz.status || 403, locale);
  if (!isSameOriginRequest(request)) return errorJson("api.common.forbidden", 403, locale);
  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "");
    const profileId = String(body?.profileId || "").trim();
    if (!profileId || !["confirm", "revoke"].includes(action)) {
      return errorJson("api.common.bad_request", 400, locale);
    }
    const row = action === "confirm"
      ? await confirmRepresentationAsAdmin({
          profileId,
          adminUserId: authz.userId,
          registryCode: body?.registryCode,
          basis: body?.basis
        })
      : await revokeRepresentationAsAdmin({ profileId, adminUserId: authz.userId });
    return json({ ok: true, row });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status < 500 && ACTION_ERROR_KEYS.has(error?.message)) {
      return errorJson(error.message, status, locale, error?.details ? { details: error.details } : {});
    }
    console.error("[admin/service-representation] action failed", safeError(error));
    return errorJson("admin.service_representation.errors.action_failed", 500, locale);
  }
}
