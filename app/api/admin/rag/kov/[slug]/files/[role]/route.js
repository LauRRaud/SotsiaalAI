import { prisma } from "@/lib/prisma";
import { getKovAdminEntryBySlug, serializeKovAdminWithRepositoryFallback, syncKovAdminIngestStatusById } from "@/lib/admin/rag/kov/service";
import { deleteStoredKovFile } from "@/lib/admin/rag/kov/storage";
import { KOV_FILE_ROLE_META, resolveKovFileKeyFromParam } from "@/lib/admin/rag/kov/shared";
import { errorJson, json, requireKovAdminSession } from "@/lib/admin/rag/kov/api";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function resolveParams(paramsLike) {
  const params = await paramsLike;
  return {
    slug: String(params?.slug || "").trim().toLowerCase(),
    role: String(params?.role || "").trim()
  };
}

export async function DELETE(request, { params }) {
  const auth = await requireKovAdminSession(request);
  if (!auth.ok) return auth.response;

  const { slug, role } = await resolveParams(params);
  const fileKey = resolveKovFileKeyFromParam(role);
  if (!slug || !fileKey) return errorJson("api.common.bad_request", 400, auth.locale);

  try {
    const entry = await getKovAdminEntryBySlug(slug);
    if (!entry) return errorJson("api.common.not_found", 404, auth.locale);

    const existing = entry.files.find(item => item.role === KOV_FILE_ROLE_META[fileKey].dbRole);
    if (!existing) {
      return errorJson("api.common.not_found", 404, auth.locale);
    }

    await deleteStoredKovFile(existing.storagePath);
    await prisma.municipalityKovAdminFile.delete({
      where: {
        kovAdminId_role: {
          kovAdminId: entry.id,
          role: existing.role
        }
      }
    });
    await prisma.municipalityKovAdmin.update({
      where: { id: entry.id },
      data:
        KOV_FILE_ROLE_META[fileKey].layer === "RT"
          ? { rtCheckedAt: new Date() }
          : { checkedAt: new Date() }
    });
    await syncKovAdminIngestStatusById(entry.id);

    const updated = await getKovAdminEntryBySlug(slug);
    return json({
      ok: true,
      item: await serializeKovAdminWithRepositoryFallback(updated)
    });
  } catch (error) {
    console.error("[kov-admin] delete file failed", safeError(error));
    return errorJson("api.admin.kov.file_delete_failed", 500, auth.locale);
  }
}
