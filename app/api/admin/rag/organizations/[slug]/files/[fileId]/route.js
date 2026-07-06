import { prisma } from "@/lib/prisma";
import {
  getOrganizationAdminEntryBySlug,
  serializeOrganizationAdmin,
  syncOrganizationFileCountById,
  syncOrganizationIngestStatusById
} from "@/lib/admin/rag/organizations/service";
import { deleteStoredOrganizationFile } from "@/lib/admin/rag/organizations/storage";
import { errorJson, json, requireOrganizationAdminSession } from "@/lib/admin/rag/organizations/api";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function resolveParams(paramsLike) {
  const params = await paramsLike;
  return {
    slug: String(params?.slug || "").trim().toLowerCase(),
    fileId: String(params?.fileId || "").trim()
  };
}

export async function DELETE(request, { params }) {
  const auth = await requireOrganizationAdminSession(request);
  if (!auth.ok) return auth.response;

  const { slug, fileId } = await resolveParams(params);
  if (!slug || !fileId) return errorJson("api.common.bad_request", 400, auth.locale);

  try {
    const entry = await getOrganizationAdminEntryBySlug(slug);
    if (!entry) return errorJson("api.common.not_found", 404, auth.locale);

    const file = entry.files.find(item => item.id === fileId);
    if (!file) return errorJson("api.common.not_found", 404, auth.locale);

    await deleteStoredOrganizationFile(file.storagePath);
    await prisma.organizationAdminFile.delete({
      where: { id: fileId }
    });
    await syncOrganizationFileCountById(entry.id);
    const updated = await syncOrganizationIngestStatusById(entry.id);
    return json({
      ok: true,
      item: updated || serializeOrganizationAdmin(await getOrganizationAdminEntryBySlug(slug))
    });
  } catch (error) {
    console.error("[organization-admin] delete file failed", safeError(error));
    return errorJson("api.common.server_error", 500, auth.locale);
  }
}
