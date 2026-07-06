import { prisma } from "@/lib/prisma";
import {
  getOrganizationAdminEntryBySlug,
  serializeOrganizationAdmin,
  syncOrganizationFileCountById,
  syncOrganizationIngestStatusById
} from "@/lib/admin/rag/organizations/service";
import {
  buildOrganizationStoredFilePath,
  readStoredOrganizationFile,
  deleteStoredOrganizationFile,
  ensureOrganizationStorage,
  writeUploadedOrganizationFile
} from "@/lib/admin/rag/organizations/storage";
import { ORGANIZATION_FILE_ROLE_META, resolveOrganizationFileKeyFromParam } from "@/lib/admin/rag/organizations/shared";
import { expectedOrganizationCoreFileName } from "@/lib/admin/rag/organizations/package";
import { validateOrganizationFileContent } from "@/lib/admin/rag/organizations/validation";
import { errorJson, json, requireOrganizationAdminSession } from "@/lib/admin/rag/organizations/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function resolveSlug(paramsLike) {
  const params = await paramsLike;
  return String(params?.slug || "").trim().toLowerCase();
}

export async function POST(request, { params }) {
  const auth = await requireOrganizationAdminSession(request);
  if (!auth.ok) return auth.response;

  const slug = await resolveSlug(params);
  if (!slug) return errorJson("api.common.bad_request", 400, auth.locale);

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return errorJson("api.common.bad_request", 400, auth.locale);
  }

  const file = formData.get("file");
  const roleParam = String(formData.get("role") || "attachment").trim();
  const fileKey = resolveOrganizationFileKeyFromParam(roleParam);
  if (!fileKey) return errorJson("api.common.bad_request", 400, auth.locale);
  if (fileKey !== "attachment") {
    const expectedName = expectedOrganizationCoreFileName(slug, fileKey);
    if (String(file?.name || "").trim() !== expectedName) {
      return errorJson(`Expected file name ${expectedName}`, 400, auth.locale);
    }
  }

  const entry = await getOrganizationAdminEntryBySlug(slug);
  if (!entry) return errorJson("api.common.not_found", 404, auth.locale);

  let newStoragePath = "";

  try {
    await ensureOrganizationStorage();
    newStoragePath = buildOrganizationStoredFilePath(slug, roleParam, file?.name || "");
    const stored = await writeUploadedOrganizationFile(file, newStoragePath, roleParam);
    const buffer = await readStoredOrganizationFile(newStoragePath);
    const validation = validateOrganizationFileContent({
      fileKey,
      text: buffer.toString("utf8")
    });
    const roleMeta = ORGANIZATION_FILE_ROLE_META[fileKey];
    const existingCoreFile =
      roleMeta.dbRole !== "ATTACHMENT"
        ? entry.files.find(item => item.role === roleMeta.dbRole) || null
        : null;

    if (existingCoreFile) {
      await prisma.organizationAdminFile.update({
        where: { id: existingCoreFile.id },
        data: {
          role: roleMeta.dbRole,
          originalName: String(file.name || existingCoreFile.originalName),
          mime: stored.mime,
          size: stored.size,
          sha256: stored.sha256,
          storagePath: newStoragePath,
          validationStatus: validation.validationStatus,
          validationMessage: validation.validationMessage,
          validatedAt: validation.validatedAt
        }
      });
      await deleteStoredOrganizationFile(existingCoreFile.storagePath);
    } else {
      await prisma.organizationAdminFile.create({
        data: {
          organizationId: entry.id,
          role: roleMeta.dbRole,
          originalName: String(file.name || "organization-file"),
          mime: stored.mime,
          size: stored.size,
          sha256: stored.sha256,
          storagePath: newStoragePath,
          validationStatus: validation.validationStatus,
          validationMessage: validation.validationMessage,
          validatedAt: validation.validatedAt
        }
      });
    }

    await syncOrganizationFileCountById(entry.id);
    const updated = await syncOrganizationIngestStatusById(entry.id);

    return json(
      {
        ok: true,
        item: updated || serializeOrganizationAdmin(await getOrganizationAdminEntryBySlug(slug))
      },
      201
    );
  } catch (error) {
    if (newStoragePath) {
      try {
        await deleteStoredOrganizationFile(newStoragePath);
      } catch {}
    }
    const status = Number(error?.status) || 500;
    return errorJson(status === 500 ? "api.common.server_error" : error?.message || "api.common.server_error", status, auth.locale);
  }
}
