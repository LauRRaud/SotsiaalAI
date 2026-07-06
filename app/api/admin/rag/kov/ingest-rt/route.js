import { ingestKovRtEntriesBySlugs } from "@/lib/admin/rag/kov/service";
import { json, requireKovAdminSession } from "@/lib/admin/rag/kov/api";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request) {
  const auth = await requireKovAdminSession(request);
  if (!auth.ok) return auth.response;

  let payload = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const slugs = Array.isArray(payload?.slugs) ? payload.slugs : [];
  if (!slugs.length) {
    return json(
      {
        ok: false,
        message: "Missing municipality slugs."
      },
      400
    );
  }

  try {
    const items = await ingestKovRtEntriesBySlugs(slugs);
    return json({
      ok: true,
      items
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    console.error("[kov-admin] bulk rt ingest failed", { slugs, error: safeError(error) });
    return json(
      {
        ok: false,
        message: String(error?.message || "Bulk RT ingest failed"),
        blockingIssues: Array.isArray(error?.blockingIssues) ? error.blockingIssues : undefined
      },
      status
    );
  }
}
