import {
  checkDatabaseContactsFromWeb,
  getDatabaseContactRegistryStatus
} from "@/lib/admin/rag/contactRegistry/databaseService";
import { errorJson, json, requireKovAdminSession } from "@/lib/admin/rag/kov/api";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  const auth = await requireKovAdminSession(request);
  if (!auth.ok) return auth.response;

  try {
    const status = await getDatabaseContactRegistryStatus();
    return json(status);
  } catch (error) {
    console.error("[contact-registry] status failed", safeError(error));
    return errorJson("api.admin.kov.update_failed", 500, auth.locale);
  }
}

export async function POST(request) {
  const auth = await requireKovAdminSession(request);
  if (!auth.ok) return auth.response;

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  try {
    const action = String(body?.action || "web-check");
    if (action !== "web-check") {
      return errorJson("api.admin.kov.update_failed", 409, auth.locale, {
        reason: "database_contact_registry_has_no_apply_step"
      });
    }
    const result = await checkDatabaseContactsFromWeb({
      maxUrls: Number(body?.maxUrls || 0) || 0
    });
    const status = await getDatabaseContactRegistryStatus();
    return json({
      ok: true,
      action,
      result,
      status
    });
  } catch (error) {
    console.error("[contact-registry] refresh failed", safeError(error));
    return errorJson("api.admin.kov.update_failed", 500, auth.locale);
  }
}
