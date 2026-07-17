import { errorJson, json, requireKovAdminSession } from "@/lib/admin/rag/kov/api";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  const auth = await requireKovAdminSession(request);
  if (!auth.ok) return auth.response;
  if (process.env.MASTER_SOURCE_FILESYSTEM_ENABLED !== "1") {
    return json({ ok: true, state: "degraded", reason: "master_source_filesystem_disabled", queue: [], counts: {}, generatedAt: null });
  }
  try {
    const { getMasterSourcesWorkQueue } = await import("@/lib/admin/rag/masterSources/service");
    return json(await getMasterSourcesWorkQueue());
  } catch (error) {
    console.error("[master-sources] queue status failed", safeError(error));
    return errorJson("api.admin.kov.update_failed", 500, auth.locale);
  }
}
