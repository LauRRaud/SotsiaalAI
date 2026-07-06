import { listOrganizationAdminEntries } from "@/lib/admin/rag/organizations/service";
import { errorJson, json, requireOrganizationAdminSession } from "@/lib/admin/rag/organizations/api";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  const auth = await requireOrganizationAdminSession(request);
  if (!auth.ok) return auth.response;

  try {
    const items = await listOrganizationAdminEntries();
    return json({
      ok: true,
      items,
      total: items.length
    });
  } catch (error) {
    console.error("[organization-admin] list failed", safeError(error));
    return errorJson("api.common.server_error", 500, auth.locale, {
      debug: process.env.NODE_ENV !== "production" ? String(error?.message || error) : undefined
    });
  }
}
