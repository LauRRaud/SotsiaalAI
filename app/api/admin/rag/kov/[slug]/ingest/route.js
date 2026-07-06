import { ingestKovEntryBySlug } from "@/lib/admin/rag/kov/service";
import { json, requireKovAdminSession } from "@/lib/admin/rag/kov/api";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function resolveSlug(paramsLike) {
  const params = await paramsLike;
  return String(params?.slug || "").trim().toLowerCase();
}

export async function POST(request, { params }) {
  const auth = await requireKovAdminSession(request);
  if (!auth.ok) return auth.response;

  const slug = await resolveSlug(params);
  if (!slug) {
    return json(
      {
        ok: false,
        message: "Missing municipality slug."
      },
      400
    );
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const replaceExisting = body?.replaceExisting === true;
  const confirmCleanup = body?.confirmCleanup === true;
  if (replaceExisting && !confirmCleanup) {
    return json(
      {
        ok: false,
        message: "Replace ingest requires confirmCleanup=true."
      },
      400
    );
  }

  try {
    const item = await ingestKovEntryBySlug(slug, { replaceExisting });
    if (!item) {
      return json(
        {
          ok: false,
          message: "KOV not found."
        },
        404
      );
    }

    return json({
      ok: true,
      replaceExisting,
      item
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    console.error("[kov-admin] ingest failed", { slug, error: safeError(error) });
    return json(
      {
        ok: false,
        message: String(error?.message || "KOV ingest failed"),
        blockingIssues: Array.isArray(error?.blockingIssues) ? error.blockingIssues : undefined
      },
      status
    );
  }
}
