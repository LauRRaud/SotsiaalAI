import { listKovAdminEntries } from "@/lib/admin/rag/kov/service";
import { errorJson, json, requireKovAdminSession } from "@/lib/admin/rag/kov/api";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  const auth = await requireKovAdminSession(request);
  if (!auth.ok) return auth.response;

  try {
    const items = await listKovAdminEntries();
    return json({
      ok: true,
      items,
      total: items.length
    });
  } catch (error) {
    console.error("[kov-admin] list failed", safeError(error));
    return errorJson("api.admin.kov.list_failed", 500, auth.locale, {
      debug: process.env.NODE_ENV !== "production" ? String(error?.message || error) : undefined
    });
  }
}
